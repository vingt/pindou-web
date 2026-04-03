import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "android/**",
      "native-android/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
);
