const OpenAI = require("openai");

let cachedClient = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY
    });
  }
  return cachedClient;
}

module.exports = {
  name: "openai",
  call: async (model, payload, timeout) => {
    const ai = getClient();
    return await ai.chat.completions.create(payload, { timeout });
  }
};
