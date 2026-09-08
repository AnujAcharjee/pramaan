import type { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.redirect('/');
    return;
  }
  next();
}

export function guestOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.session.user) {
    res.redirect('/dashboard');
    return;
  }
  next();
}
