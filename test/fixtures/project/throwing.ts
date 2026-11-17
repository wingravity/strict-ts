export function thrower(): never {
  throw new Error("x"); // @expect no-restricted-syntax
}

export function catcher(): number {
  try { // @expect no-restricted-syntax
    return 1;
  } catch {
    return 0;
  }
}

export const rejected = (): Promise<never> => Promise.reject(new Error("x")); // @expect no-restricted-syntax

export const manual = new Promise<void>((resolve) => { // @expect no-restricted-syntax
  resolve();
});
