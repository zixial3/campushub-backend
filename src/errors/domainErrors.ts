import type { ErrorCode } from '../types/api';

export type DomainErrorKind = 'validation' | 'not_found' | 'conflict';

// Framework-free: services throw these, and only errorHandler maps a kind to
// an HTTP status code.
export class DomainError extends Error {
  constructor(
    readonly kind: DomainErrorKind,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('validation', 'VALIDATION_ERROR', message);
  }
}

export class NotFoundError extends DomainError {
  constructor(code: ErrorCode, message: string) {
    super('not_found', code, message);
  }
}

export class ConflictError extends DomainError {
  constructor(code: ErrorCode, message: string) {
    super('conflict', code, message);
  }
}
