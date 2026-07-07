function getActiveModelsList() {
  const primary = process.env.PRIMARY_MODEL || "google/gemini-2.5-flash";
  const fallbacksStr = process.env.FALLBACK_MODELS || "google/gemini-2.5-pro,meta-llama/llama-3.1-8b-instruct";
  const list = [primary];
  if (fallbacksStr) {
    fallbacksStr.split(",").forEach(m => {
      const trimmed = m.trim();
      if (trimmed && !list.includes(trimmed)) {
        list.push(trimmed);
      }
    });
  }
  return list;
}

module.exports = { getActiveModelsList };
