const OpenAI = require("openai");

let cachedClient = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });
  }
  return cachedClient;
}

module.exports = {
  name: "geminidirect",
  call: async (model, payload, timeout) => {
    const ai = getClient();
    return await ai.chat.completions.create(payload, { timeout });
  }
};
