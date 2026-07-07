/**
 * server.js
 * Express server entrypoint for DomIQ AI with Helmet Security, HttpOnly Cookies, and CORS Credentials.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

// Load .env relative to project workspace root
require("dotenv").config({
  path: path.resolve(__dirname, "../.env")
});

// Import startup config validation & health check
require("./services/config");

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for dev flexibility with Three.js & inline canvas
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Cookie Parser Middleware
app.use(cookieParser());

// Enable CORS for frontend workspace clients with credentials support for HttpOnly Cookies
app.use(cors({
  origin: function(origin, callback) {
    // Allow all local dev origins
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));

// Setup JSON body parsing with large payload capacity (for base64 sketches and blueprints)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Ensure uploads folder exists and serve statically
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));

// Register API Routers
const authRouter = require("./routes/auth");
const accountRouter = require("./routes/account");
const projectsRouter = require("./routes/projects");
const assetsRouter = require("./routes/assets");
const aiRouter = require("./routes/ai");

app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/ai", aiRouter);

// Health check endpoint
app.get("/health", (req, res) => {
  const { providerRegistry, modelRegistry } = require("./services/ai/registry");
  const { getActiveModelsList } = require("./services/ai/fallback");
  
  const providers = {};
  Object.keys(providerRegistry).forEach(pKey => {
    const p = providerRegistry[pKey];
    providers[pKey] = {
      healthy: p.healthy,
      consecutiveFailures: p.consecutiveFailures,
      cooldownRemainingMs: Math.max(0, p.cooldownUntil - Date.now()),
      probing: p.probing
    };
  });

  const models = {};
  Object.keys(modelRegistry).forEach(mKey => {
    const m = modelRegistry[mKey];
    models[mKey] = {
      healthy: m.healthy,
      consecutiveFailures: m.consecutiveFailures,
      cooldownRemainingMs: Math.max(0, m.cooldownUntil - Date.now())
    };
  });

  res.json({
    status: "healthy",
    timestamp: new Date(),
    aiPipelineStatus: {
      status: "ready",
      activeModels: getActiveModelsList(),
      providerRegistry: providers,
      modelRegistry: models,
      configuration: {
        PRIMARY_MODEL: process.env.PRIMARY_MODEL,
        FALLBACK_MODELS: process.env.FALLBACK_MODELS,
        AI_SAFETY_MARGIN: parseInt(process.env.AI_SAFETY_MARGIN, 10),
        AI_REQUEST_TIMEOUT_MS: parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10),
        AI_CONTEXT_WINDOW: parseInt(process.env.AI_CONTEXT_WINDOW, 10)
      }
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Express Server Exception:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`✓ DomIQ AI Backend Server running on port ${PORT}`);
});
