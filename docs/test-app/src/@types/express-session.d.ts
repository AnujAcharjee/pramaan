import 'express-session';
import { OAuthSessionData, AppUser } from './app.types.js';

declare module 'express-session' {
  interface SessionData {
    oauth?: OAuthSessionData;
    user?: AppUser;
  }
}
