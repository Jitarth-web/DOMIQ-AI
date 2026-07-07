class MetricsTracker {
  constructor() {
    this.startTime = Date.now();
  }

  getDuration() {
    return Date.now() - this.startTime;
  }

  logRequest(provider, model, retries, promptTokens, completionTokens) {
    const latency = this.getDuration();
    console.log(`✓ Provider Healthy | provider: ${provider} | model: ${model} | latency: ${latency}ms | retries: ${retries} | token usage: prompt=${promptTokens}, completion=${completionTokens}`);
  }
}

module.exports = MetricsTracker;
