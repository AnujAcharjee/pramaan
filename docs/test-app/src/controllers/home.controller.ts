import type { Request, Response } from 'express';

export class HomeController {
  renderIndex(req: Request, res: Response): void {
    if (req.session.user) {
      res.redirect('/dashboard');
      return;
    }
    res.render('index');
  }

  renderDashboard(req: Request, res: Response): void {
    res.render('dashboard', { user: req.session.user });
  }
}

export const homeController = new HomeController();
