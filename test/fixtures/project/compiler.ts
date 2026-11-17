const list: number[] = [1];
export const first: number = list[0]; // @expect TS2322

interface Options {
  name?: string;
}
export const options: Options = { name: undefined }; // @expect TS2375

const dict: Record<string, string> = {};
export const value = dict.key; // @expect TS4111

export function implicitReturn(flag: boolean): number | undefined { // @expect TS7030
  if (flag) {
    return 1;
  }
}

class Base {
  greet(): string {
    return "base";
  }
}
export class Child extends Base {
  greet(): string { // @expect TS4114
    return "child";
  }
}

export function fallthrough(n: 1 | 2): number {
  let total = 0;
  switch (n) {
    case 1: // @expect TS7029
      total += 1;
    case 2: // @expect no-fallthrough
      total += 2;
  }
  return total;
}

export function unusedParameter(used: number, unused: number): number { // @expect TS6133
  return used;
}

export function unreachable(): number {
  return 1;
  console.log("never"); // @expect TS7027
}
