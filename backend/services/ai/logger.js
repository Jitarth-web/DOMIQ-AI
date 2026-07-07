const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  info: (msg, details = null) => {
    if (!isProduction) {
      console.log(`[AI INFO] ${msg}`, details ? JSON.stringify(details) : '');
    } else {
      console.log(`[AI INFO] ${msg}`);
    }
  },
  warn: (msg, details = null) => {
    console.warn(`[AI WARN] ${msg}`, details ? JSON.stringify(details) : '');
  },
  error: (msg, details = null) => {
    console.error(`[AI ERROR] ${msg}`, details ? details.message || details : '');
  },
  dev: (msg, details = null) => {
    if (!isProduction) {
      console.log(`[AI DEV] ${msg}`, details ? JSON.stringify(details) : '');
    }
  }
};

module.exports = logger;
