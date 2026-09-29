import type { NextFunction, Request, Response } from 'express';
import { appConfig } from '../config/env';
import { DomainError } from '../errors/domainErrors';
import type { DomainErrorKind } from '../errors/domainErrors';
import type { ErrorResponse } from '../types/api';
import { HttpStatus } from '../types/http';
import type { HttpStatusCode } from '../types/http';

const STATUS_BY_KIND: Readonly<Record<DomainErrorKind, HttpStatusCode>> = {
  validation: HttpStatus.BAD_REQUEST,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
};

// express.json() failures carry a `type` tag and a 4xx `status` (http-errors).
function bodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && 'status' in err) {
    const { type, status } = err;
    if (
      typeof type === 'string' &&
      typeof status === 'number' &&
      status >= 400 &&
      status < 500
    ) {
      return type;
    }
  }
  return undefined;
}

function toErrorResponse(err: unknown): { status: HttpStatusCode; body: ErrorResponse } {
  if (err instanceof DomainError) {
    return {
      status: STATUS_BY_KIND[err.kind],
      body: { code: err.code, message: err.message },
    };
  }
  const parserErrorType: string | undefined = bodyParserErrorType(err);
  if (parserErrorType === 'entity.parse.failed') {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON.' },
    };
  }
  if (parserErrorType !== undefined && err instanceof Error) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: { code: 'VALIDATION_ERROR', message: err.message },
    };
  }

  console.error('Unhandled request error:', err);
  const detail: string = err instanceof Error ? err.message : 'Unknown error';
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      code: 'INTERNAL_ERROR',
      message: appConfig.nodeEnv === 'production' ? 'Internal server error' : detail,
    },
  };
}

// Must keep all four parameters: Express identifies error middleware by arity.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction,
): void {
  const { status, body } = toErrorResponse(err);
  res.status(status).json(body);
}
