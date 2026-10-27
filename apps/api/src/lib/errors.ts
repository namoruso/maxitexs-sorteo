export type AppErrorCode =
  | 'DUPLICATE'
  | 'NO_ELIGIBLE'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'UNAUTHORIZED'
  | 'VALIDATION';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly campos?: Record<string, string>;
  readonly campo?: 'cedula' | 'telefono';

  constructor(
    code: AppErrorCode,
    message: string,
    status: number,
    extra?: { campos?: Record<string, string>; campo?: 'cedula' | 'telefono' },
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.campos = extra?.campos;
    this.campo = extra?.campo;
  }
}

/** Map Postgres unique_violation to a friendly duplicate error. */
export function mapPgUnique(err: unknown): AppError | null {
  const e = err as { code?: string; constraint?: string; message?: string };
  if (e?.code !== '23505') return null;
  const c = String(e.constraint ?? e.message ?? '');
  if (c.includes('telefono')) {
    return new AppError('DUPLICATE', 'Este teléfono ya está registrado.', 409, {
      campo: 'telefono',
    });
  }
  return new AppError('DUPLICATE', 'Esta cédula ya está registrada.', 409, {
    campo: 'cedula',
  });
}
