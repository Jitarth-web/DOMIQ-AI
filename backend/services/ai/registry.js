const providerRegistry = {
  openrouter: {
    providerName: "openrouter",
    healthy: true,
    consecutiveFailures: 0,
    cooldownUntil: 0,
    lastFailure: 0,
    lastSuccess: 0,
    probing: false
  },
  openai: {
    providerName: "openai",
    healthy: true,
    consecutiveFailures: 0,
    cooldownUntil: 0,
    lastFailure: 0,
    lastSuccess: 0,
    probing: false
  },
  geminidirect: {
    providerName: "geminidirect",
    healthy: true,
    consecutiveFailures: 0,
    cooldownUntil: 0,
    lastFailure: 0,
    lastSuccess: 0,
    probing: false
  }
};

const modelRegistry = {};

function registerModel(fullConfigString) {
  let providerName = "openrouter";
  let modelName = fullConfigString;
  
  if (fullConfigString.includes(":")) {
    const parts = fullConfigString.split(":");
    providerName = parts[0].toLowerCase();
    modelName = parts[1];
  } else {
    if (modelName.startsWith("gpt-")) {
      providerName = process.env.OPENAI_API_KEY ? "openai" : "openrouter";
    } else if (modelName.startsWith("gemini-") && process.env.GEMINI_API_KEY) {
      providerName = "geminidirect";
    }
  }
  
  if (!modelRegistry[fullConfigString]) {
    modelRegistry[fullConfigString] = {
      modelName: modelName,
      providerName: providerName,
      healthy: true,
      consecutiveFailures: 0,
      cooldownUntil: 0
    };
  }
  
  if (!providerRegistry[providerName]) {
    providerRegistry[providerName] = {
      providerName: providerName,
      healthy: true,
      consecutiveFailures: 0,
      cooldownUntil: 0,
      lastFailure: 0,
      lastSuccess: 0,
      probing: false
    };
  }
  
  return modelRegistry[fullConfigString];
}

module.exports = {
  providerRegistry,
  modelRegistry,
  registerModel
};
