import type { Request, Response, NextFunction } from 'express';
import { AuthenticationFlow } from '../services/auth.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { AppError } from '../utils/appError.js';
import { ZodType, ZodError } from 'zod';

type ActionType = {
  res: Response;
  data: Record<string, unknown>;
  message: string;
};

export abstract class BaseController {
  protected handleViewRequest =
    (
      handler: (req: Request, res: Response) => Promise<void>,
      viewOnError?: string,
      buildViewData?: (req: Request) => Record<string, unknown>,
      schema?: ZodType,
    ) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (schema) {
          schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
            headers: req.headers,
          });
        }

        await handler(req, res);
      } catch (error) {
        if (error instanceof ZodError && viewOnError) {
          return res.status(400).render(viewOnError, {
            ...(buildViewData ? buildViewData(req) : {}),
            error: error.issues[0]?.message ?? 'Validation failed',
          });
        }

        if (error instanceof AppError && viewOnError && error.isOperational) {
          return res.status(error.statusCode).render(viewOnError, {
            ...(buildViewData ? buildViewData(req) : {}),
            error: error.message,
          });
        }

        next(error);
      }
    };

  protected async handleApiRequest(
    _req: Request,
    res: Response,
    next: NextFunction,
    action: () => Promise<ActionType>,
  ): Promise<void> {
    try {
      const result = await action();

      ApiResponse.success(res, result?.data, result?.message);
    } catch (error) {
      next(error);
    }
  }

  protected getFlow(req: Request): {
    flow: AuthenticationFlow;
    requestId?: string;
    isOAuthFlow: boolean;
  } {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const query = (req.query ?? {}) as Record<string, unknown>;

    const flow = (body.flow as AuthenticationFlow) ?? (query.flow as AuthenticationFlow) ?? 'default';

    const requestId =
      flow === 'oauth' ? ((body.request_id as string) ?? (query.request_id as string)) : undefined;

    return {
      flow,
      requestId,
      isOAuthFlow: flow === 'oauth',
    };
  }
}
