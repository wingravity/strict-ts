export interface Ok<T> {
    readonly ok: true;
    readonly value: T;
}
export interface Err<E> {
    readonly ok: false;
    readonly error: E;
}
export type Result<T, E> = Ok<T> | Err<E>;
export type AsyncResult<T, E> = Promise<Result<T, E>>;
export declare function ok(): Ok<undefined>;
export declare function ok<T>(value: T): Ok<T>;
export declare function err<E>(error: E): Err<E>;
export declare function map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
export declare function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>;
export declare function andThen<T, E, U, F>(result: Result<T, E>, fn: (value: T) => Result<U, F>): Result<U, E | F>;
export declare function unwrapOr<T, U>(result: Result<T, unknown>, fallback: U): T | U;
export declare function match<T, E, U>(result: Result<T, E>, handlers: {
    readonly ok: (value: T) => U;
    readonly err: (error: E) => U;
}): U;
export declare function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E>;
export declare function attempt<T, E>(fn: () => T, toError: (cause: unknown) => E): Result<T, E>;
export declare function attemptAsync<T, E>(fn: () => T | PromiseLike<T>, toError: (cause: unknown) => E): AsyncResult<T, E>;
//# sourceMappingURL=result.d.ts.map