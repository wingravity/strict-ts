export function duplicateCase(n: number): string {
  switch (n) {
    case 1:
      return "one";
    case 1: // @expect no-duplicate-case
      return "uno";
    default:
      return "other";
  }
}

export function duplicateCondition(n: number): string {
  if (n > 1) {
    return "big";
  } else if (n > 1) { // @expect no-dupe-else-if
    return "also big";
  }
  return "small";
}

export const isNotANumber = (n: number): boolean => n === Number.NaN; // @expect use-isnan

export function selfAssign(): number {
  let total = 1;
  total = total; // @expect no-self-assign
  return total;
}

export const unsafeChain = (obj?: { run: () => number }): number => (obj?.run)(); // @expect no-unsafe-optional-chaining TS2722

export const sparse = [1, , 3]; // @expect no-sparse-arrays

export const negativeZero = (n: number): boolean => n === -0; // @expect no-compare-neg-zero

export function emptyBlock(flag: boolean): void {
  if (flag) {} // @expect no-empty
}

export const defaulted = (name: string | undefined): string => (name ? name : "anonymous"); // @expect no-unneeded-ternary @typescript-eslint/strict-boolean-expressions

export const constructed = new RegExp("abc"); // @expect no-restricted-syntax prefer-regex-literals
