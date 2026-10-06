import helmet from 'helmet';
import { Express } from 'express';
import { ENV } from '../config/env.js';

export const setupSecurityHeaders = (app: Express) => {
  // Hide Express fingerprint (reduce attack surface)
  app.disable('x-powered-by');

  app.use(
    helmet({
      /* -------- Content Security Policy -------- */

      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"], // block all external resources by default

          scriptSrc: ["'self'"], // prevent remote script injection
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // required for SSR auth pages & Google Fonts
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'], // allow avatars, logos, QR codes, and local blob previews
          fontSrc: ["'self'", 'https:', 'data:'], // allow embedded web fonts
          mediaSrc: ["'self'", 'https://res.cloudinary.com', 'blob:', 'data:'], // allow Cloudinary video streaming

          connectSrc: ["'self'", 'https:'], // restrict XHR / fetch / OAuth calls

          objectSrc: ["'none'"], // block Flash, plugins, embeds
          frameAncestors: ["'none'"], // prevent clickjacking
          baseUri: ["'self'"],

          // TODO: further restrict formAction to specific trusted domains (e.g. client app URLs) after development
          // formAction: ["'self'", "https://*.pramaan.aunjacharjee.com"],

          ...(ENV.NODE_ENV === 'production' ?
            {
              upgradeInsecureRequests: [], // force HTTPS in production
              formAction: ["'self'", 'https:'], // prevent form submission hijacking
            }
          : { formAction: ["'self'", 'http:', 'https:'] }),
        },
      },

      /* -------- Cross-origin isolation -------- */

      crossOriginEmbedderPolicy: false, // required for OAuth redirects & Swagger

      /* -------- Other protections -------- */

      dnsPrefetchControl: { allow: false }, // prevent DNS leakage
      originAgentCluster: true, // isolate origin memory
      permittedCrossDomainPolicies: { permittedPolicies: 'none' }, // block Adobe policies
    }),
  );
};
