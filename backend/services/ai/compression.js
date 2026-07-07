const { estimatePayloadTokens } = require("./tokenizer");
const logger = require("./logger");

function compressHistoryIfLarge(messages, maxTokensLimit = 2000) {
  const promptTokens = estimatePayloadTokens(messages);
  if (promptTokens <= maxTokensLimit) {
    return messages;
  }
  
  logger.dev(`Deterministic compression triggered: current tokens = ${promptTokens}, limit = ${maxTokensLimit}`);
  
  const systemMsg = messages[0];
  const latestMsg = messages[messages.length - 1];
  
  // Find the latest assistant reply in history (from messages.length - 2 down to index 1)
  let latestAssistantMsg = null;
  for (let i = messages.length - 2; i >= 1; i--) {
    if (messages[i] && messages[i].role === "assistant") {
      latestAssistantMsg = messages[i];
      break;
    }
  }
  
  const compressedMessages = [];
  if (systemMsg) {
    compressedMessages.push(systemMsg);
  }
  if (latestAssistantMsg) {
    compressedMessages.push(latestAssistantMsg);
  }
  if (latestMsg) {
    compressedMessages.push(latestMsg);
  }
  
  return compressedMessages;
}

module.exports = { compressHistoryIfLarge };
