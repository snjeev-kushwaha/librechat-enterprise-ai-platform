// api-gateway/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '../types/index.js';

const SECRET = process.env.GATEWAY_JWT_SECRET!;

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, SECRET) as AuthUser;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token', detail: err.message });
  }
}
