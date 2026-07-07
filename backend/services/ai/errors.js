class ProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ProviderError";
    this.success = false;
    this.status = options.status || 500;
    this.provider = options.provider || "unknown";
    this.code = options.code || "provider_error";
    this.retryable = options.retryable !== undefined ? options.retryable : false;
    this.originalMessage = options.originalMessage || message;
    this.suggestedMaxTokens = options.suggestedMaxTokens || null;

    // Define enumerable properties so JSON.stringify(error) natively serializes all properties
    Object.defineProperty(this, "success", { enumerable: true });
    Object.defineProperty(this, "status", { enumerable: true });
    Object.defineProperty(this, "provider", { enumerable: true });
    Object.defineProperty(this, "code", { enumerable: true });
    Object.defineProperty(this, "retryable", { enumerable: true });
    Object.defineProperty(this, "message", { enumerable: true });
    Object.defineProperty(this, "originalMessage", { enumerable: true, value: this.originalMessage });
    Object.defineProperty(this, "suggestedMaxTokens", { enumerable: true });
  }
  
  toJSON() {
    return {
      success: this.success,
      status: this.status,
      provider: this.provider,
      code: this.code,
      retryable: this.retryable,
      message: this.message,
      details: this.originalMessage,
      suggestedMaxTokens: this.suggestedMaxTokens
    };
  }
}

module.exports = { ProviderError };
