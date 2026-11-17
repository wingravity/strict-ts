export function taggedError(kind, message, cause) {
    return cause === undefined ? { kind, message } : { kind, message, cause };
}
export function describeCause(cause) {
    if (cause instanceof Error) {
        return cause.message;
    }
    if (typeof cause === "string") {
        return cause;
    }
    return "unknown error";
}
//# sourceMappingURL=error.js.map