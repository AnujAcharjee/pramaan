import { z } from 'zod';
import { UtilFields } from '../validators/util.fields.js';

export class AccountZSchema {
  static getProfileSchema = z.object({
    params: z.object({
      user_id: z.string().min(1, 'user_id is required'),
    }),
  });

  static updateProfileSchema = z
    .object({
      body: z.object({
        updates: z
          .object({
            name: UtilFields.nameField.optional(),
            email: UtilFields.emailField.optional(),
            avatar: z.url().optional(),
          })
          .strict(),
      }),
    })
    .refine((data) => Object.keys(data.body.updates).length > 0, {
      message: 'At least one field must be updated',
    });

  static manageMfaSchema = z.object({
    body: z.object({
      action: z.enum(['enable', 'disable']),
    }),
  });

  static changePasswordSchema = z.object({
    body: z.object({
      email: UtilFields.emailField.optional(),
    }),
  });

  static updateConsentSchema = z.object({
    body: z.object({
      client_id: z.string({ message: 'client_id must be a string' }).min(1, 'client_id is required'),
    }),
  });
}
