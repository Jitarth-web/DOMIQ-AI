const COOLDOWN_MS = parseInt(process.env.AI_PROVIDER_COOLDOWN_MS, 10) || 60000;
const PROVIDER_MAX_FAILURES = parseInt(process.env.AI_PROVIDER_MAX_FAILURES, 10) || 3;
const MODEL_MAX_FAILURES = parseInt(process.env.AI_MODEL_MAX_FAILURES, 10) || 2;
const logger = require("./logger");
const { providerRegistry } = require("./registry");

function checkEligibility(provider, model) {
  // Check provider health
  let eligibleProvider = false;
  let isProbe = false;
  
  if (provider.healthy) {
    eligibleProvider = true;
  } else if (Date.now() > provider.cooldownUntil) {
    // Only one provider in the entire registry can be probing (half-open) at a time
    const isAnyOtherProbing = Object.values(providerRegistry).some(
      p => p.providerName !== provider.providerName && p.probing
    );
    if (!isAnyOtherProbing && !provider.probing) {
      provider.probing = true;
      eligibleProvider = true;
      isProbe = true;
    }
  }
  
  if (!eligibleProvider) {
    return { eligible: false, isProbe: false };
  }
  
  // Check model health
  let eligibleModel = false;
  if (model.healthy) {
    eligibleModel = true;
  } else if (Date.now() > model.cooldownUntil) {
    eligibleModel = true;
    isProbe = true;
  }
  
  if (!eligibleModel) {
    if (isProbe) {
      provider.probing = false; // release lock
    }
    return { eligible: false, isProbe: false };
  }
  
  return { eligible: true, isProbe };
}

function handleSuccess(provider, model) {
  // All updates run synchronously (single tick) for atomic registry updates
  if (!provider.healthy) {
    provider.healthy = true;
    console.log(`✓ Provider Restored | provider: ${provider.providerName}`);
  } else {
    logger.dev(`Provider Healthy | provider: ${provider.providerName}`);
  }
  provider.consecutiveFailures = 0;
  provider.lastSuccess = Date.now();
  provider.probing = false;
  
  if (!model.healthy) {
    model.healthy = true;
    console.log(`✓ Model Restored | model: ${model.modelName}`);
  }
  model.consecutiveFailures = 0;
}

function handleFailure(provider, model, type) {
  // All updates run synchronously (single tick) for atomic registry updates
  if (type === "auth" || type === "billing") {
    // Never increment failure counters or trigger cooldowns for auth/billing errors
    if (provider.probing) {
      provider.probing = false;
    }
    return;
  }

  if (type === "rate_limit" || type === "provider") {
    provider.consecutiveFailures++;
    provider.lastFailure = Date.now();
    provider.probing = false;
    
    if (provider.consecutiveFailures >= PROVIDER_MAX_FAILURES) {
      if (provider.healthy) {
        provider.healthy = false;
        provider.cooldownUntil = Date.now() + COOLDOWN_MS;
        console.log(`⚠ Provider Cooling Down | provider: ${provider.providerName} | cooldown remaining: ${COOLDOWN_MS}ms`);
      }
    }
  } else if (type === "model") {
    model.consecutiveFailures++;
    
    if (model.consecutiveFailures >= MODEL_MAX_FAILURES) {
      if (model.healthy) {
        model.healthy = false;
        model.cooldownUntil = Date.now() + COOLDOWN_MS;
        console.log(`⚠ Model Disabled | model: ${model.modelName}`);
      }
    }
  }
}

module.exports = {
  checkEligibility,
  handleSuccess,
  handleFailure
};
