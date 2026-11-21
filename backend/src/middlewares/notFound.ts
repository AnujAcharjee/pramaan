import type { Request, Response } from 'express';

/**
 * Middleware to handle 404 Not Found errors
 * This should be mounted after all other routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  return res.status(404).render('pages/app/not-found', {
    title: 'Page not found',
    statusCode: 404,
    message: 'Oops! Looks like you are lost. Page not found.',
  });
};
