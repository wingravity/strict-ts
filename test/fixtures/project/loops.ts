export function whileLoop(n: number): number {
  let i = 0;
  while (i < n) { // @expect no-restricted-syntax
    i++;
  }
  return i;
}

export function doWhile(n: number): number {
  let i = 0;
  do { // @expect no-restricted-syntax
    i++;
  } while (i < n);
  return i;
}

export function forever(): void {
  for (;;) { // @expect no-restricted-syntax no-unreachable-loop
    break;
  }
}

export function* generator(): Generator<number> { // @expect no-restricted-syntax
  yield 1;
}

export const timer = setInterval(() => undefined, 1_000); // @expect no-restricted-globals

export function bounded(items: readonly number[]): number {
  let total = 0;
  for (const item of items) {
    total += item;
  }
  for (let i = 0; i < items.length; i++) {
    total += i;
  }
  return total + items.reduce((a, b) => a + b, 0);
}
