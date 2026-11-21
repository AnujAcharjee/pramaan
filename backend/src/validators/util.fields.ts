import { z } from 'zod';
import { GENDERS, type Gender } from '../utils/constant.js';

export class UtilFields {
  private static readonly PASSWORD_MESSAGE =
    'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';

  static nameField = z
    .string()
    .min(2, 'Name must be at least 2 characters long.')
    .max(99, 'Name must be less than 100 characters.');

  static emailField = z.email('Please enter a valid email address.').max(99, 'Email address is too long.');

  static genderField = z.enum(Object.values(GENDERS) as [Gender, ...Gender[]]);

  static passwordField = z
    .string()
    .min(8, UtilFields.PASSWORD_MESSAGE)
    .max(99, 'Password must be less than 100 characters.')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/, UtilFields.PASSWORD_MESSAGE);

  static tokenField = () => z.string().min(1, `Token is invalid or missing.`);

  static clientIdField = z.string().min(1, 'Client ID is required.');

  static redirectUriField = z
    .string()
    .transform((v) => v.trim())
    .pipe(z.url({ message: 'Invalid redirect URI' }));
}
