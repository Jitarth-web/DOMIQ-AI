/**
 * config.js
 * Startup configuration validation & pipeline health checks.
 */

const path = require("path");

// Ensure environment variables are loaded if not already done
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env")
});

const config = {
  PRIMARY_MODEL: process.env.PRIMARY_MODEL || "google/gemini-2.5-flash",
  FALLBACK_MODELS: process.env.FALLBACK_MODELS || "google/gemini-2.5-pro,meta-llama/llama-3.1-8b-instruct",
  AI_SAFETY_MARGIN: parseInt(process.env.AI_SAFETY_MARGIN, 10),
  AI_REQUEST_TIMEOUT_MS: parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10),
  AI_CONTEXT_WINDOW: parseInt(process.env.AI_CONTEXT_WINDOW, 10)
};

const warnings = [];

// 1. Validate range parameters & apply safe defaults
if (!config.PRIMARY_MODEL) {
  warnings.push("PRIMARY_MODEL is empty. Defaulting to 'google/gemini-2.5-flash'.");
  config.PRIMARY_MODEL = "google/gemini-2.5-flash";
}

const fallbackList = (config.FALLBACK_MODELS || "")
  .split(",")
  .map(m => m.trim())
  .filter(Boolean);

if (fallbackList.length === 0) {
  warnings.push("FALLBACK_MODELS list is empty. Defaulting to 'google/gemini-2.5-pro,meta-llama/llama-3.1-8b-instruct'.");
  config.FALLBACK_MODELS = "google/gemini-2.5-pro,meta-llama/llama-3.1-8b-instruct";
}

if (isNaN(config.AI_SAFETY_MARGIN) || config.AI_SAFETY_MARGIN <= 0) {
  warnings.push(`AI_SAFETY_MARGIN is invalid (${process.env.AI_SAFETY_MARGIN}). Defaulting to 500.`);
  config.AI_SAFETY_MARGIN = 500;
}

if (isNaN(config.AI_REQUEST_TIMEOUT_MS) || config.AI_REQUEST_TIMEOUT_MS <= 0) {
  warnings.push(`AI_REQUEST_TIMEOUT_MS is invalid (${process.env.AI_REQUEST_TIMEOUT_MS}). Defaulting to 30000.`);
  config.AI_REQUEST_TIMEOUT_MS = 30000;
}

if (isNaN(config.AI_CONTEXT_WINDOW) || config.AI_CONTEXT_WINDOW < 1000 || config.AI_CONTEXT_WINDOW > 5000000) {
  // Safe default: we will fallback to standard limit maps per model, but default global window size is 16384
  config.AI_CONTEXT_WINDOW = 16384;
}

// Write validated config back to process.env so it's globally consistent
process.env.PRIMARY_MODEL = config.PRIMARY_MODEL;
process.env.FALLBACK_MODELS = config.FALLBACK_MODELS;
process.env.AI_SAFETY_MARGIN = config.AI_SAFETY_MARGIN.toString();
process.env.AI_REQUEST_TIMEOUT_MS = config.AI_REQUEST_TIMEOUT_MS.toString();
process.env.AI_CONTEXT_WINDOW = config.AI_CONTEXT_WINDOW.toString();

// Print configuration warnings if any
if (warnings.length > 0) {
  console.warn("\n=== [AI PIPELINE CONFIG WARNINGS] ===");
  warnings.forEach(w => console.warn(`⚠ ${w}`));
  console.warn("======================================\n");
}

// 2. Perform Startup Health Check
try {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const credentialsLoaded = !!(openRouterKey || openAIKey || geminiKey);
  
  if (!credentialsLoaded) {
    console.warn("⚠ Startup Health Check Warning: No AI provider keys found in environment variables!");
  }

  // Confirm tokenizer configurations can load
  const tokenizer = require("./ai/tokenizer");
  if (!tokenizer || typeof tokenizer.estimatePayloadTokens !== "function") {
    throw new Error("Tokenizer failed to initialize or missing functions");
  }

  // Confirm serializer can load
  const serializer = require("./serializer");
  if (!serializer || typeof serializer.serialize !== "function") {
    throw new Error("Serializer failed to initialize or missing functions");
  }

  // Confirm circuit breaker registry
  const registry = require("./ai/registry");
  if (!registry || !registry.providerRegistry) {
    throw new Error("Provider Registry failed to initialize");
  }

  // Print startup health status report
  console.log("✓ Providers Loaded");
  console.log("✓ Tokenizer Ready");
  console.log("✓ Serializer Ready");
  console.log("✓ Circuit Breaker Ready");
  console.log("✓ AI Pipeline Ready");
} catch (healthError) {
  console.error("⚠ Startup Health Check Failed:", healthError.message);
}

module.exports = config;
