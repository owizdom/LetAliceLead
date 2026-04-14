import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/core/**', 'src/constitution/**', 'src/wallets/**', 'src/locus/audit.ts', 'src/locus/pricing.ts'],
    },
  },
});
