import type { PostgrestError } from "@supabase/supabase-js";

export type ServiceResult<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: ServiceError;
    };

export type ServiceError = {
  message: string;
  code?: string;
  cause?: unknown;
};

export function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

export function fail<T = never>(message: string, cause?: unknown, code?: string): ServiceResult<T> {
  return {
    data: null,
    error: {
      message,
      code,
      cause,
    },
  };
}

export function fromPostgrestError(error: PostgrestError | null, fallback: string): ServiceError {
  return {
    message: error?.message ?? fallback,
    code: error?.code,
    cause: error,
  };
}
