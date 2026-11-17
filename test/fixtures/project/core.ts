export const loose = (a: string, b: string): boolean => a == b; // @expect eqeqeq
export const looseNull = (a: string | null): boolean => a != null; // @expect eqeqeq
export const same = (a: number): boolean => a === a; // @expect no-self-compare
export const constant = (x: { a: number }): boolean => ({ ...x }) === x; // @expect no-constant-binary-expression

export function assignInCondition(input: string): string {
  let match = ""; // @expect no-useless-assignment
  if ((match = input)) { // @expect no-cond-assign @typescript-eslint/strict-boolean-expressions
    return match;
  }
  return match;
}

export const template = (): string => "Hello ${name}"; // @expect no-template-curly-in-string

export function onlyOnce(items: readonly number[]): number {
  for (const item of items) { // @expect no-unreachable-loop
    return item;
  }
  return 0;
}

export function reassigned(): number {
  let fixed = 1; // @expect prefer-const
  return fixed;
}

export function legacy(): number {
  var old = 1; // @expect no-var
  return old;
}

export const label = (count: number): string => `${count} items`;
export const flag = (on: boolean): string => `${on}`; // @expect @typescript-eslint/restrict-template-expressions
