import { AppError } from '../utils/appError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { logger } from '../config/logger.js';
import { ErrorCode } from '../utils/errorCodes.js';
import type { ErrorRequestHandler } from 'express';

/**
 * if req accepts html
 *  - for routes in AUTH_UI_REDIRECT_MAP, redirect to auth route with error message
 *  - for Others, render error page
 * if req accepts json
 *  - send JSON res
 */

export const errorMiddleware: ErrorRequestHandler = (error, req, res, next): void => {
  if (res.headersSent) {
    return next(error);
  }

  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const message = isAppError ? error.message : 'Internal server error';
  const acceptsHtml = req.accepts(['html', 'json']) === 'html';
  const isApiError = req.url.startsWith('/api');

  // Logging
  if (!isAppError || statusCode >= 500) {
    logger.error({
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn({
      message: error.message,
      path: req.path,
      method: req.method,
      statusCode,
    });
  }

  // UI response
  if (acceptsHtml && !isApiError) {
    return res.status(statusCode).render('pages/app/error', {
      title: 'Error-Page',
      statusCode,
      message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }

  // RFC 6749 Section 5.2 OAuth Token Endpoint Error Response
  if (req.path === '/api/oauth/token' || req.path === '/token') {
    let oauthError = 'invalid_request';
    if (isAppError) {
      switch (error.code) {
        case ErrorCode.INVALID_CLIENT:
          oauthError = 'invalid_client';
          break;
        case ErrorCode.INVALID_GRANT:
        case ErrorCode.UNAUTHORIZED_CLIENT:
          oauthError = 'invalid_grant';
          break;
        case ErrorCode.UNSUPPORTED_GRANT_TYPE:
          oauthError = 'unsupported_grant_type';
          break;
        case ErrorCode.INVALID_SCOPE:
          oauthError = 'invalid_scope';
          break;
        case ErrorCode.INVALID_REQUEST:
        case ErrorCode.INVALID_INPUT:
        case ErrorCode.VALIDATION_ERROR:
          oauthError = 'invalid_request';
          break;
        default:
          oauthError = statusCode >= 500 ? 'server_error' : 'invalid_request';
      }
    } else {
      oauthError = statusCode >= 500 ? 'server_error' : 'invalid_request';
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.status(statusCode).json({
      error: oauthError,
      error_description: message,
    });
    return;
  }

  // JSON response
  return ApiResponse.error(res, message, statusCode);
};
