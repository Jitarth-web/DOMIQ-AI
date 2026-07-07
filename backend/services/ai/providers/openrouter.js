const OpenAI = require("openai");

let cachedClient = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1"
    });
  }
  return cachedClient;
}

module.exports = {
  name: "openrouter",
  call: async (model, payload, timeout) => {
    const ai = getClient();
    return await ai.chat.completions.create(payload, { timeout });
  }
};
