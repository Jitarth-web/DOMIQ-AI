/**
 * authMiddleware.js
 * Express authentication middleware for verifying JWT tokens via HttpOnly cookies or Authorization header.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'domiq_secret_jwt_key_2026_stay_secure';

function authMiddleware(req, res, next) {
  let token = null;

  // 1. Try to read token from HttpOnly cookie
  if (req.cookies && req.cookies.domiq_access_token) {
    token = req.cookies.domiq_access_token;
  }
  // 2. Fallback to Authorization: Bearer <token> header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      fullName: decoded.fullName,
      email: decoded.email
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Session access token expired. Refreshing token required.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token.'
    });
  }
}

module.exports = authMiddleware;
