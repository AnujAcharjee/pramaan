import type { Response } from 'express';

export class ApiResponse {
  private constructor() {}

  static success(res: Response, data: unknown = null, message: string = 'Success') {
    res.status(200).json({
      success: true,
      message,
      data,
    });
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 400,
    code?: string,
    details?: unknown,
  ): void {
    res.status(statusCode).json({
      success: false,
      message,
      code,
      ...(details !== undefined && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: new Error().stack }),
    });
  }
}
