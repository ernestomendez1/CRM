import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  target: 'node24',
  // Bundle workspace packages (@crm/*) into the output so the deployed
  // bundle doesn't need to resolve their TypeScript sources at runtime.
  noExternal: [/^@crm\//],
});
