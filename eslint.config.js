import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist/**', 'node_modules/**'] },

    js.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: { ...globals.browser, docx: 'readonly' }
        },
        rules: {
            // Nothing in this app should build DOM from a string. Everything a
            // page shows can come out of a saved evaluation file, and those are
            // passed between testers, so text goes in as text.
            'no-restricted-properties': ['error',
                { property: 'innerHTML', message: 'Use textContent: file contents must never be parsed as HTML.' },
                { property: 'outerHTML', message: 'Use textContent: file contents must never be parsed as HTML.' },
                { property: 'insertAdjacentHTML', message: 'Build elements instead; file contents must never be parsed as HTML.' }
            ],

            eqeqeq: ['error', 'always'],
            'prefer-const': 'error',
            'no-var': 'error',
            curly: 'error',

            // The layering rule. ui/ may use anything; domain/ is pure and must
            // not reach into the DOM, application state, or I/O.
            'no-restricted-imports': ['error', {
                patterns: [
                    {
                        group: ['**/ui/*', '**/state/*', '**/io/*'],
                        message: 'domain/ and config/ must not depend on ui/, state/ or io/.'
                    }
                ]
            }]
        }
    },

    {
        // ui/ and io/ sit above domain/ and legitimately import from it.
        files: ['src/ui/**/*.ts', 'src/io/**/*.ts', 'src/main.ts'],
        rules: { 'no-restricted-imports': 'off' }
    },

    {
        files: ['tests/**/*.ts'],
        languageOptions: { globals: { ...globals.node } },
        rules: {
            // Fixtures are deliberately cast from loosely typed JSON.
            '@typescript-eslint/no-explicit-any': 'off'
        }
    },

    {
        files: ['*.config.ts', '*.config.js'],
        languageOptions: { globals: { ...globals.node } }
    },

    {
        // Build scripts run in Node, not in the browser the rest of this is
        // written for. They are linted like everything else; only the globals
        // available to them differ.
        files: ['scripts/**/*.mjs'],
        languageOptions: { globals: { ...globals.node } }
    }
);
