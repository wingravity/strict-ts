import { strictTs } from "./src/eslint/index.ts";

export default [
  { ignores: ["dist/**", "test/**", "eslint.config.js"] },
  ...strictTs({ boundary: ["src/result.ts", "src/safe/**"], tsconfigRootDir: import.meta.dirname }),
];
