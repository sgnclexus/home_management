module.exports = {
  extends: [
    '../../.eslintrc.js',
    'next/core-web-vitals',
  ],
  env: {
    browser: true,
    es2020: true,
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};