export function ok(value) {
    return { ok: true, value };
}
export function err(error) {
    return { ok: false, error };
}
export function map(result, fn) {
    return result.ok ? ok(fn(result.value)) : result;
}
export function mapErr(result, fn) {
    return result.ok ? result : err(fn(result.error));
}
export function andThen(result, fn) {
    return result.ok ? fn(result.value) : result;
}
export function unwrapOr(result, fallback) {
    return result.ok ? result.value : fallback;
}
export function match(result, handlers) {
    return result.ok ? handlers.ok(result.value) : handlers.err(result.error);
}
export function all(results) {
    const values = [];
    for (const result of results) {
        if (!result.ok) {
            return result;
        }
        values.push(result.value);
    }
    return ok(values);
}
export function attempt(fn, toError) {
    try {
        return ok(fn());
    }
    catch (cause) {
        return err(toError(cause));
    }
}
export async function attemptAsync(fn, toError) {
    try {
        return ok(await fn());
    }
    catch (cause) {
        return err(toError(cause));
    }
}
//# sourceMappingURL=result.js.map