import { type AsyncResult, type Result } from "../result.ts";
export interface StandardPathSegment {
    readonly key: PropertyKey;
}
export interface StandardIssue {
    readonly message: string;
    readonly path?: readonly (PropertyKey | StandardPathSegment)[] | undefined;
}
export type StandardResult<Output> = {
    readonly value: Output;
    readonly issues?: undefined;
} | {
    readonly issues: readonly StandardIssue[];
};
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly "~standard": {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
        readonly types?: {
            readonly input: Input;
            readonly output: Output;
        } | undefined;
    };
}
export type InferOutput<S extends StandardSchemaV1> = NonNullable<S["~standard"]["types"]>["output"];
export interface SchemaIssue {
    readonly message: string;
    readonly path: string;
}
export type SchemaError = {
    readonly kind: "SchemaValidationError";
    readonly message: string;
    readonly issues: readonly SchemaIssue[];
} | {
    readonly kind: "SchemaAsyncNotSupported";
    readonly message: string;
} | {
    readonly kind: "SchemaThrew";
    readonly message: string;
    readonly cause: unknown;
};
export declare function parseWith<S extends StandardSchemaV1>(schema: S, input: unknown): Result<InferOutput<S>, SchemaError>;
export declare function parseWithAsync<S extends StandardSchemaV1>(schema: S, input: unknown): AsyncResult<InferOutput<S>, SchemaError>;
//# sourceMappingURL=schema.d.ts.map