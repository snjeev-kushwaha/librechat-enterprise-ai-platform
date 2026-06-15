// api-gateway/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

// Simple in-memory rate limit (works without Redis)
// For production with Redis, install rate-limit-redis and configure it
export const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,         // 60 requests/min per user
  keyGenerator: (req) => req.user?.id || req.ip || 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded. Please wait before sending more requests.',
    });
  },
});

// Stricter limit specifically for chat
export const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15, // 15 chat messages/min
  keyGenerator: (req) => req.user?.id || req.ip || 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Chat rate limit exceeded. Try again in a minute.' });
  },
});
