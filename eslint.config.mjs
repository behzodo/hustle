import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Vendored from component registries (shadcn blocks, evilcharts, reui) and
    // patched only where this project's Radix components differ. Holding them
    // to our lint rules means re-fixing style on every registry update, for
    // code we did not write.
    ignores: [
      "**/generated/*",
      "src/components/evilcharts/**",
      "src/components/reui/**",
    ],
  },
];

export default eslintConfig;
