import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    // Build output, deps, and generated data files are not source.
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "data/**",
      "public/**",
      ".vercel/**",
      ".vite/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Unused code is what this repo actually needed the linter for. Error,
      // not warn, so it fails CI — but allow a leading _ to mark a binding
      // that is deliberately kept (destructuring rest, unused route params).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default config;
