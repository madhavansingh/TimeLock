export default [
  {
    ignores: [".next/**", "node_modules/**", "dist/**", "out/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    rules: {
      "no-console": "off",
    },
  },
];
