import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const isCi = process.env.CI === 'true'
const isProdLike = process.env.NODE_ENV === 'production' || isCi

const noConsoleRule = isProdLike
  ? ['error', { allow: ['warn', 'error'] }]
  : ['warn', { allow: ['log', 'info', 'warn', 'error'] }]

const unusedVarsRule = [
  'warn',
  {
    args: 'all',
    argsIgnorePattern: '^_',
    caughtErrors: 'all',
    caughtErrorsIgnorePattern: '^_',
    destructuredArrayIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    ignoreRestSiblings: true,
  },
]

const strictUnusedVarsRule = ['error', unusedVarsRule[1]]

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': unusedVarsRule,
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/purity': 'off',
      'react/no-unescaped-entities': 'off',
      'no-console': noConsoleRule,
      '@typescript-eslint/no-require-imports': 'off',
      // Avoid duplicate reports with the TS-aware rule.
      'no-unused-vars': 'off',
    },
  },
  {
    files: [
      'src/actions/**/*.ts',
      'src/app/api/**/*.ts',
      'src/lib/billing/**/*.ts',
      'src/lib/db/contracts.ts',
      'src/lib/security/**/*.ts',
      'src/lib/observability/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': strictUnusedVarsRule,
    },
  },
  {
    files: ['tests/**/*.{js,ts}', 'scripts/**/*.{js,ts}', '*.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': unusedVarsRule,
      '@typescript-eslint/no-require-imports': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.vercel/output/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'examples/**',
      'skills/**',
    ],
  },
]

export default config
