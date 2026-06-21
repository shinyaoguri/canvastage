// ESLint v9 フラットコンフィグ。型情報なしの recommended ルールで軽量に回す。
// フォーマットは Prettier に任せ、eslint-config-prettier で競合ルールを無効化する。
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // dist/node_modules と、p5 のグローバル前提で書かれた信頼済みサンプル
  // スケッチ（src/samples/**）はリント対象外にする。
  { ignores: ["dist", "node_modules", "src/samples/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
      },
    },
  },
  prettier
);
