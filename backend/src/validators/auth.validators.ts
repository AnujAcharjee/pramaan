import { z } from 'zod';
import { UtilFields } from './util.fields.js';

const requireRequestIdForOauth = (flow?: string, requestId?: string) => flow !== 'oauth' || !!requestId;

export class AuthZSchema {
  static signupSchema = z
    .object({
      body: z.object({
        name: UtilFields.nameField,
        email: UtilFields.emailField,
        gender: UtilFields.genderField,
        password: UtilFields.passwordField,
        confirmPassword: UtilFields.passwordField,
        flow: z.enum(['oauth', 'default']).optional(),
        request_id: z.string().optional(),
      }),
    })
    .refine((data) => data.body.password === data.body.confirmPassword, {
      message: 'Both password fields must match',
      path: ['body', 'confirmPassword'],
    })
    .refine((data) => requireRequestIdForOauth(data.body.flow, data.body.request_id), {
      message: 'Missing request_id for OAuth flow',
      path: ['body', 'request_id'],
    });

  static verifyEmailSchema = z
    .object({
      query: z.object({
        token: UtilFields.tokenField(),
        email: z.string().optional(),
        flow: z.enum(['oauth', 'default']).optional(),
        request_id: z.string().optional(),
      }),
    })
    .refine((data) => requireRequestIdForOauth(data.query.flow, data.query.request_id), {
      message: 'Missing request_id for OAuth flow',
      path: ['query', 'request_id'],
    });

  static resendVerificationEmailSchema = z
    .object({
      query: z.object({
        email: UtilFields.emailField,
        flow: z.enum(['oauth', 'default']).optional(),
        request_id: z.string().optional(),
      }),
    })
    .refine((data) => requireRequestIdForOauth(data.query.flow, data.query.request_id), {
      message: 'Missing request_id for OAuth flow',
      path: ['query', 'request_id'],
    });

  static signinSchema = z
    .object({
      body: z.object({
        email: UtilFields.emailField,
        password: z.string(),
        flow: z.enum(['oauth', 'default']).optional(),
        request_id: z.string().optional(),
      }),
    })
    .refine((data) => requireRequestIdForOauth(data.body.flow, data.body.request_id), {
      message: 'Missing request_id for OAuth flow',
      path: ['body', 'request_id'],
    });

  static verifySignInSchema = z
    .object({
      query: z.object({
        token: UtilFields.tokenField(),
        flow: z.enum(['oauth', 'default']).optional(),
        request_id: z.string().optional(),
      }),
    })
    .refine((data) => requireRequestIdForOauth(data.query.flow, data.query.request_id), {
      message: 'Missing request_id for OAuth flow',
      path: ['query', 'request_id'],
    });

  static forgotPasswordSchema = z
    .object({
      body: z.object({
        email: UtilFields.emailField,
        flow: z.enum(['oauth', 'default']).optional(),
        request_id: z.string().optional(),
      }),
    })
    .refine((data) => requireRequestIdForOauth(data.body.flow, data.body.request_id), {
      message: 'Missing request_id for OAuth flow',
      path: ['body', 'request_id'],
    });

  static resetPasswordSchema = z
    .object({
      body: z.object({
        token: UtilFields.tokenField(),
        new_password: UtilFields.passwordField,
        confirm_new_password: UtilFields.passwordField,
        flow: z.enum(['oauth', 'default']).optional(),
        request_id: z.string().optional(),
      }),
    })
    .refine((data) => data.body.new_password === data.body.confirm_new_password, {
      message: 'New password and confirm password must match',
      path: ['body', 'confirm_new_password'],
    })
    .refine((data) => requireRequestIdForOauth(data.body.flow, data.body.request_id), {
      message: 'Missing request_id for OAuth flow',
      path: ['body', 'request_id'],
    });
}
