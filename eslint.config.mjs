// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Глобальные игнорирования (должны быть первыми)
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'node_modules/**',
      // Игнорируем всю папку uploads и все её содержимое
      'uploads/**',
      '**/uploads/**',
      // Игнорируем .ts файлы в uploads (сегменты видео)
      'uploads/**/*.ts',
      '**/uploads/**/*.ts',
      // Игнорируем все файлы в uploads независимо от расширения
      'uploads/**/*',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
);
