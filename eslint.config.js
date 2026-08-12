import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist/**', 'node_modules/**', 'font-awesome-4.7.0/**'] },

    js.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: { ...globals.browser, docx: 'readonly' }
        },
        rules: {
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
    }
);
