const CONTEXT_LIMIT_MAP = {
  "google/gemini-2.5-flash": 1000000,
  "google/gemini-2.5-pro": 2000000,
  "meta-llama/llama-3.1-8b-instruct": 131072,
  "gpt-4o-mini": 128000,
  "gpt-4o": 128000
};

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function estimatePayloadTokens(messages) {
  let count = 0;
  messages.forEach(msg => {
    const contentText = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    count += estimateTokens(contentText);
  });
  return count;
}

function calculateSafeOutputLimit(modelName, promptTokens, requestedMax) {
  const contextWindow = CONTEXT_LIMIT_MAP[modelName] || 16384;
  const safetyMargin = parseInt(process.env.AI_SAFETY_MARGIN, 10) || 500;
  
  // Strict formula: remaining = contextWindow - promptTokens - safetyMargin
  const remaining = Math.max(0, contextWindow - promptTokens - safetyMargin);
  const finalMax = Math.min(requestedMax, remaining);
  
  return {
    contextWindow,
    safeLimit: remaining,
    finalMax: Math.max(1, finalMax)
  };
}

module.exports = {
  estimateTokens,
  estimatePayloadTokens,
  calculateSafeOutputLimit
};
