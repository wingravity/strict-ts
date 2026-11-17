type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

export function area(shape: Shape): number {
  switch (shape.kind) { // @expect @typescript-eslint/switch-exhaustiveness-check
    case "circle":
      return shape.radius;
  }
  return 0;
}

export const greeting = (name: string): string => (name ? name : "anonymous"); // @expect @typescript-eslint/strict-boolean-expressions no-unneeded-ternary
export const count = (n: number): string => (n ? "some" : "none"); // @expect @typescript-eslint/strict-boolean-expressions
export const present = (user: { id: string } | undefined): boolean => (user ? true : false); // @expect no-unneeded-ternary

export const impossible = (n: number): boolean => n === undefined; // @expect @typescript-eslint/no-unnecessary-condition

const save = (): Promise<void> => Promise.resolve();

export function floating(): void {
  save(); // @expect @typescript-eslint/no-floating-promises
}

export function misused(ids: readonly string[]): void {
  ids.forEach(async () => { // @expect @typescript-eslint/no-misused-promises
    await save();
  });
}
