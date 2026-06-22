// api-gateway/src/routes/auth.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  loginToLibreChat,
  registerInLibreChat,
  setLibreChatToken,
  setLibreChatRefreshToken,
} from '../services/librechatClient.js';

export const authRouter = Router();

const GATEWAY_SECRET = process.env.GATEWAY_JWT_SECRET!;
const TOKEN_EXPIRY_S = 3600 * 8; // 8 hours

// POST /auth/login
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  try {
    const { user, token: lcToken, refreshToken } = await loginToLibreChat(email, password);

    // Store LibreChat access token (14-min TTL to match LC's short expiry)
    await setLibreChatToken(user.id, lcToken);

    // Store refresh token so we can silently renew the access token
    if (refreshToken) {
      await setLibreChatRefreshToken(user.id, refreshToken);
    } else {
      console.warn('[Auth] No refresh token in LibreChat login response — token renewal will require re-login');
    }

    // Issue Gateway JWT
    const gatewayToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      GATEWAY_SECRET,
      { expiresIn: TOKEN_EXPIRY_S }
    );

    res.json({
      token: gatewayToken,
      expiresIn: TOKEN_EXPIRY_S,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err: any) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message || 'Login failed';
    res.status(status).json({ error: message });
  }
});

// POST /auth/register
authRouter.post('/register', async (req, res) => {
  const { name, email, password, confirm_password } = req.body;
  if (!name || !email || !password || !confirm_password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password !== confirm_password)
    return res.status(400).json({ error: 'Passwords do not match' });

  try {
    const result = await registerInLibreChat({ name, email, password, confirm_password });
    res.status(201).json({ message: 'Registration successful. Please log in.', ...result });
  } catch (err: any) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || 'Registration failed';
    res.status(status).json({ error: message });
  }
});
