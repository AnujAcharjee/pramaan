import { z } from 'zod';
import { UtilFields } from './util.fields.js';

const requireRequestIdForOauth = (flow?: string, requestId?: string) =>
  flow !== 'oauth' || (typeof requestId === 'string' && requestId.trim().length > 0);

const flowField = z
  .preprocess((val) => {
    if (val === null || val === undefined || val === '') return 'default';
    return val;
  }, z.enum(['oauth', 'default']))
  .default('default');

const requestIdField = z
  .preprocess((val) => {
    if (val === null || val === undefined || val === '') return undefined;
    return val;
  }, z.string().optional());

export class AuthZSchema {
  static signupSchema = z
    .object({
      body: z.object({
        name: UtilFields.nameField,
        email: UtilFields.emailField,
        gender: UtilFields.genderField,
        password: UtilFields.passwordField,
        confirmPassword: UtilFields.passwordField.optional(),
        flow: flowField,
        request_id: requestIdField,
        requestId: requestIdField,
      }),
    })
    .refine((data) => !data.body.confirmPassword || data.body.password === data.body.confirmPassword, {
      message: 'Both password fields must match',
      path: ['body', 'confirmPassword'],
    })
    .refine(
      (data) => {
        const reqId = data.body.request_id || data.body.requestId;
        return requireRequestIdForOauth(data.body.flow, reqId);
      },
      {
        message: 'Missing request_id for OAuth flow',
        path: ['body', 'request_id'],
      },
    );

  static verifyEmailSchema = z
    .object({
      query: z.object({
        token: UtilFields.tokenField(),
        email: z.string().optional(),
        flow: flowField,
        request_id: requestIdField,
        requestId: requestIdField,
      }),
    })
    .refine(
      (data) => {
        const reqId = data.query.request_id || data.query.requestId;
        return requireRequestIdForOauth(data.query.flow, reqId);
      },
      {
        message: 'Missing request_id for OAuth flow',
        path: ['query', 'request_id'],
      },
    );

  static resendVerificationEmailSchema = z
    .object({
      query: z.object({
        email: UtilFields.emailField,
        flow: flowField,
        request_id: requestIdField,
        requestId: requestIdField,
      }),
    })
    .refine(
      (data) => {
        const reqId = data.query.request_id || data.query.requestId;
        return requireRequestIdForOauth(data.query.flow, reqId);
      },
      {
        message: 'Missing request_id for OAuth flow',
        path: ['query', 'request_id'],
      },
    );

  static signinSchema = z
    .object({
      body: z.object({
        email: UtilFields.emailField,
        password: z.string(),
        flow: flowField,
        request_id: requestIdField,
        requestId: requestIdField,
      }),
    })
    .refine(
      (data) => {
        const reqId = data.body.request_id || data.body.requestId;
        return requireRequestIdForOauth(data.body.flow, reqId);
      },
      {
        message: 'Missing request_id for OAuth flow',
        path: ['body', 'request_id'],
      },
    );

  static verifySignInSchema = z
    .object({
      query: z.object({
        token: UtilFields.tokenField(),
        flow: flowField,
        request_id: requestIdField,
        requestId: requestIdField,
      }),
    })
    .refine(
      (data) => {
        const reqId = data.query.request_id || data.query.requestId;
        return requireRequestIdForOauth(data.query.flow, reqId);
      },
      {
        message: 'Missing request_id for OAuth flow',
        path: ['query', 'request_id'],
      },
    );

  static forgotPasswordSchema = z
    .object({
      body: z.object({
        email: UtilFields.emailField,
        flow: flowField,
        request_id: requestIdField,
        requestId: requestIdField,
      }),
    })
    .refine(
      (data) => {
        const reqId = data.body.request_id || data.body.requestId;
        return requireRequestIdForOauth(data.body.flow, reqId);
      },
      {
        message: 'Missing request_id for OAuth flow',
        path: ['body', 'request_id'],
      },
    );

  static resetPasswordSchema = z
    .object({
      body: z.object({
        token: UtilFields.tokenField(),
        new_password: UtilFields.passwordField.optional(),
        password: UtilFields.passwordField.optional(),
        confirm_new_password: UtilFields.passwordField.optional(),
        confirmPassword: UtilFields.passwordField.optional(),
        flow: flowField,
        request_id: requestIdField,
        requestId: requestIdField,
      }),
    })
    .refine((data) => (data.body.new_password || data.body.password), {
      message: 'New password is required',
      path: ['body', 'new_password'],
    })
    .refine(
      (data) => {
        const pwd = data.body.new_password || data.body.password;
        const confirm = data.body.confirm_new_password || data.body.confirmPassword;
        return !confirm || pwd === confirm;
      },
      {
        message: 'New password and confirm password must match',
        path: ['body', 'confirm_new_password'],
      },
    )
    .refine(
      (data) => {
        const reqId = data.body.request_id || data.body.requestId;
        return requireRequestIdForOauth(data.body.flow, reqId);
      },
      {
        message: 'Missing request_id for OAuth flow',
        path: ['body', 'request_id'],
      },
    );
}
