import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Relative asset URLs. The app is served from a project sub-path on GitHub
    // Pages (https://<user>.github.io/<repo>/), where Vite's default base of
    // '/' produces absolute URLs like /assets/index-*.js that 404. Relative
    // URLs resolve correctly there and under `vite preview` alike.
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node'
    }
});
