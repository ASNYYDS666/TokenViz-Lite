import type { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Basic auth required' },
    });
    return;
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
  const [username, password] = decoded.split(':');
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

  if (username !== 'admin' || password !== adminPassword) {
    res.status(401).json({
      error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
    });
    return;
  }

  next();
}
