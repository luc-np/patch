/**
 * Erros como valores para operações que podem falhar de forma esperada.
 * Exceções ficam reservadas ao inesperado (bug, rede, banco fora).
 */
export type Ok<T> = { ok: true; value: T };
export type Err<E extends string = string> = {
  ok: false;
  error: E;
  message?: string;
};
export type Result<T, E extends string = string> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E extends string>(error: E, message?: string): Err<E> {
  return { ok: false, error, message };
}

/** Erros padrão de autorização/recuperação. `not_found` cobre também o invisível: 404, não 403. */
export type NotFound = "not_found";
export type Forbidden = "forbidden";
