import express from 'express';
import session from 'express-session';
import path from 'path';
import { IS_HTTPS } from './config.js';
import routes from './routes/index.js';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src', 'views'));

app.set('trust proxy', 1);

app.use(
  session({
    name: 'oauth-test-client',
    secret: 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_HTTPS,
      maxAge: 10 * 60 * 1000, // 10 minutes
    },
  }),
);

app.use('/', routes);

export default app;
