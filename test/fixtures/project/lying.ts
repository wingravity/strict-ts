export const asserted = (x: unknown): string => x as string; // @expect @typescript-eslint/consistent-type-assertions
export const nonNull = (x: string | undefined): string => x!; // @expect @typescript-eslint/no-non-null-assertion
export const anyParam = (x: any): string => String(x); // @expect @typescript-eslint/no-explicit-any

// @ts-expect-error -- @expect @typescript-eslint/ban-ts-comment
export const wrong: number = "x";

export const tuple = [1, 2] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- @expect inline-config
export const stillReported = (x: any): string => String(x); // @expect @typescript-eslint/no-explicit-any

export function unsafeMember(x: Record<string, any>): unknown { // @expect @typescript-eslint/no-explicit-any
  return x["a"].b; // @expect @typescript-eslint/no-unsafe-member-access
}
