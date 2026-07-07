const { registerModel, providerRegistry } = require("./registry");
const { getActiveModelsList } = require("./fallback");
const { checkEligibility, handleSuccess, handleFailure } = require("./circuit-breaker");
const { estimatePayloadTokens, calculateSafeOutputLimit } = require("./tokenizer");
const { compressHistoryIfLarge } = require("./compression");
const { ProviderError } = require("./errors");
const MetricsTracker = require("./metrics");
const logger = require("./logger");
const crypto = require("crypto");

const REQUEST_TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10) || 30000;

function extractSuggestedMaxTokens(message) {
  if (!message) return null;
  
  // 1. Try matching "can only afford (\d+)"
  const affordMatch = message.match(/(?:can\s+only\s+afford|only\s+afford|afford)\s+(\d+)/i);
  if (affordMatch) {
    const val = parseInt(affordMatch[1], 10);
    if (val > 0) return val;
  }

  // 2. Try matching "(\d+) tokens" but only if accompanied by "afford"
  const affordTokensMatch = message.match(/(\d+)\s+tokens?/i);
  if (affordTokensMatch) {
    const val = parseInt(affordTokensMatch[1], 10);
    if (message.toLowerCase().includes("afford") && val > 0) {
      let cleaned = message.replace(/requested\s+(?:up\s+to\s+)?\d+\s+tokens?/gi, "");
      cleaned = cleaned.replace(/max_tokens\s*(?:is|=|:)?\s*\d+/gi, "");
      
      const subMatch = cleaned.match(/(?:afford|only|limit|available|budget)\D*(\d+)/i);
      if (subMatch) {
        const parsedVal = parseInt(subMatch[1], 10);
        if (parsedVal > 0) return parsedVal;
      }
    }
  }

  return null;
}

function classifyFailure(error) {
  const status = error.status || error.statusCode || 500;
  const message = (error.message || "").toLowerCase();
  const isTimeout = message.includes("timeout") || error.name === "TimeoutError";
  
  if (status === 401 || message.includes("unauthorized") || message.includes("authentication")) {
    return "auth";
  }
  if (status === 402 || message.includes("credit") || message.includes("payment required") || message.includes("insufficient balance") || message.includes("payment_required")) {
    return "billing";
  }
  if (status === 429 || message.includes("rate limit") || message.includes("too many requests")) {
    return "rate_limit";
  }
  if (message.includes("model_not_found") || message.includes("model not found") || message.includes("unsupported_parameters") || message.includes("invalid_model") || message.includes("context_length") || message.includes("context length") || message.includes("context_window") || message.includes("maximum context")) {
    return "model";
  }
  if (status === 503 || isTimeout || message.includes("unavailable") || message.includes("timeout") || message.includes("network") || message.includes("fetch")) {
    return "provider";
  }
  return "provider";
}

const providersAdapters = {
  openrouter: require("./providers/openrouter"),
  openai: require("./providers/openai"),
  geminidirect: require("./providers/gemini")
};

async function executeAIRequest(payload) {
  const requestId = crypto.randomUUID();
  const activeModels = getActiveModelsList();
  const metrics = new MetricsTracker();
  const startTime = Date.now();

  let lastError = null;
  let finalStatus = "failed";
  let finalModelUsed = "N/A";
  let finalProviderUsed = "N/A";
  let totalRetryCount = 0;
  let originalPromptTokens = 0;
  let finalPromptTokens = 0;
  let requestedMaxTokens = payload.max_tokens || 1024;
  let adjustedMaxTokens = 0;
  let suggestedMaxTokens = null;
  let compressionApplied = false;

  // Clone current payload to make sure we don't mutate input objects
  const payloadCopy = {
    ...payload,
    messages: Array.isArray(payload.messages) ? payload.messages.map(m => ({ ...m })) : []
  };

  // Compute original tokens
  originalPromptTokens = estimatePayloadTokens(payloadCopy.messages);

  // Compress history if necessary (deterministic)
  const compressionThreshold = parseInt(process.env.AI_COMPRESSION_THRESHOLD, 10) || 2000;
  if (originalPromptTokens > compressionThreshold) {
    payloadCopy.messages = compressHistoryIfLarge(payloadCopy.messages, compressionThreshold);
    finalPromptTokens = estimatePayloadTokens(payloadCopy.messages);
    compressionApplied = (finalPromptTokens < originalPromptTokens);
  } else {
    finalPromptTokens = originalPromptTokens;
  }

  try {
    for (let mIndex = 0; mIndex < activeModels.length; mIndex++) {
      const fullModelString = activeModels[mIndex];
      const model = registerModel(fullModelString);
      const provider = providerRegistry[model.providerName];

      // 1. Check Circuit Breaker eligibility
      const { eligible, isProbe } = checkEligibility(provider, model);
      if (!eligible) {
        logger.dev(`Model/Provider ineligible, skipping: ${fullModelString}`);
        continue;
      }

      finalModelUsed = model.modelName;
      finalProviderUsed = provider.providerName;

      const adapter = providersAdapters[model.providerName] || providersAdapters.openrouter;
      const currentPayload = { ...payloadCopy };
      currentPayload.model = model.modelName;

      // 2. Token Budget Calculation and Validation
      let { contextWindow, safeLimit, finalMax } = calculateSafeOutputLimit(
        model.modelName,
        finalPromptTokens,
        requestedMaxTokens
      );

      // Defensively enforce context limits
      const safetyMargin = parseInt(process.env.AI_SAFETY_MARGIN, 10) || 500;
      while (finalPromptTokens + finalMax + safetyMargin > contextWindow && finalMax > 1) {
        finalMax = Math.max(1, finalMax - 100);
      }

      adjustedMaxTokens = finalMax;
      currentPayload.max_tokens = adjustedMaxTokens;

      // 3. Request Execution with Timeout Protection & Cancellation Cleanup
      const runRequest = async (payloadToRun) => {
        const controller = new AbortController();
        const timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10) || REQUEST_TIMEOUT_MS;
        
        let timeoutId = setTimeout(() => {
          controller.abort();
        }, timeoutMs);

        try {
          const res = await Promise.race([
            adapter.call(model.modelName, payloadToRun, timeoutMs, controller.signal),
            new Promise((_, reject) => {
              controller.signal.addEventListener("abort", () => {
                const err = new Error("Request timed out (AI_REQUEST_TIMEOUT_MS)");
                err.name = "TimeoutError";
                err.status = 503;
                reject(err);
              });
            })
          ]);
          return res;
        } finally {
          // Cancellation Cleanup: clear timers
          clearTimeout(timeoutId);
        }
      };

      try {
        const response = await runRequest(currentPayload);
        
        // Success -> atomic registry update
        handleSuccess(provider, model);

        const usage = response.usage || {
          prompt_tokens: finalPromptTokens,
          completion_tokens: currentPayload.max_tokens
        };
        metrics.logRequest(
          provider.providerName,
          model.modelName,
          totalRetryCount,
          usage.prompt_tokens,
          usage.completion_tokens
        );

        finalStatus = "success";
        return response;

      } catch (error) {
        const failType = classifyFailure(error);
        
        // Atomic registry update
        handleFailure(provider, model, failType);

        const suggested = extractSuggestedMaxTokens(error.message || error.details || "");
        
        const isAuthError = failType === "auth" || error.status === 401;
        const isBillingError = failType === "billing" || error.status === 402;
        const isTransientError = failType === "rate_limit" || failType === "provider" || error.status === 429 || error.status === 503;

        lastError = new ProviderError(
          isBillingError
            ? "OpenRouter account has insufficient credits."
            : isAuthError
            ? "Provider authentication failed."
            : error.message,
          {
            status: error.status || error.statusCode || (isTimeout(error) ? 503 : 500),
            provider: provider.providerName,
            code: isBillingError
              ? "quota_exceeded"
              : isAuthError
              ? "authentication_failed"
              : failType === "rate_limit"
              ? "rate_limit_exceeded"
              : "model_error",
            retryable: !isAuthError && (isBillingError || isTransientError),
            suggestedMaxTokens: suggested,
            originalMessage: error.message
          }
        );

        // Abort immediately for auth errors (no retry, no fallback, no cooldown increment)
        if (isAuthError) {
          throw lastError;
        }

        // Retry eligibility check
        const isRetryEligible = (isBillingError || isTransientError) && !currentPayload._isRetry;

        if (isRetryEligible) {
          totalRetryCount++;
          const retryPayload = { ...currentPayload };
          retryPayload._isRetry = true;
          
          if (suggested) {
            suggestedMaxTokens = suggested;
            retryPayload.max_tokens = suggested;
          } else {
            retryPayload.max_tokens = Math.max(1, Math.floor(currentPayload.max_tokens / 2));
          }

          // Aggressive deterministic history compression on retry
          if (retryPayload.messages.length > 2) {
            retryPayload.messages = [retryPayload.messages[0], retryPayload.messages[retryPayload.messages.length - 1]];
          }

          logger.dev(`Retrying local recovery on ${model.modelName} (tokens: ${retryPayload.max_tokens})`);

          try {
            const response = await runRequest(retryPayload);
            handleSuccess(provider, model);
            
            const usage = response.usage || {
              prompt_tokens: estimatePayloadTokens(retryPayload.messages),
              completion_tokens: retryPayload.max_tokens
            };
            metrics.logRequest(
              provider.providerName,
              model.modelName,
              totalRetryCount,
              usage.prompt_tokens,
              usage.completion_tokens
            );

            finalStatus = "success";
            adjustedMaxTokens = retryPayload.max_tokens;
            return response;

          } catch (retryError) {
            const localFailType = classifyFailure(retryError);
            handleFailure(provider, model, localFailType);

            lastError = new ProviderError(
              isBillingError || localFailType === "billing" || retryError.status === 402
                ? "OpenRouter account has insufficient credits."
                : retryError.message,
              {
                status: retryError.status || retryError.statusCode || 500,
                provider: provider.providerName,
                code: isBillingError || localFailType === "billing" || retryError.status === 402
                  ? "quota_exceeded"
                  : localFailType === "rate_limit"
                  ? "rate_limit_exceeded"
                  : "model_error",
                retryable: false,
                suggestedMaxTokens: suggested,
                originalMessage: retryError.message
              }
            );

            // Abort immediately for billing errors (do not switch models)
            if (isBillingError || localFailType === "billing" || retryError.status === 402) {
              throw lastError;
            }
          }
        } else {
          // If first call fails with billing and is not retryable (e.g. currentPayload._isRetry is true),
          // throw immediately to abort fallback.
          if (isBillingError) {
            throw lastError;
          }
        }

        logger.dev(`Falling back to next configured model...`);
      }
    }
    
    // Throw final error if all models in fallback list failed
    throw lastError || new ProviderError("All configured AI models and providers failed.", { status: 503, code: "service_unavailable" });

  } finally {
    // Single structured log output once per completed request
    const latencyMs = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      provider: finalProviderUsed,
      model: finalModelUsed,
      promptTokens: originalPromptTokens,
      compressed: finalPromptTokens,
      requestedTokens: requestedMaxTokens,
      adjustedTokens: adjustedMaxTokens,
      suggestedTokens: suggestedMaxTokens,
      retryCount: totalRetryCount,
      latencyMs,
      providerHealth: finalProviderUsed !== "N/A" ? (providerRegistry[finalProviderUsed]?.healthy ? "healthy" : "unhealthy") : "N/A",
      circuitState: finalProviderUsed !== "N/A" ? (providerRegistry[finalProviderUsed]?.consecutiveFailures > 0 ? "degraded" : "healthy") : "N/A",
      result: finalStatus === "success" ? "success" : `failed: ${lastError ? lastError.message : "unknown"}`
    }, null, 2));
  }
}

function isTimeout(err) {
  return err.name === "TimeoutError" || (err.message || "").toLowerCase().includes("timeout");
}

module.exports = { executeAIRequest };
