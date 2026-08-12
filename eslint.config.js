import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
    globalIgnores(['dist/']),

    // Build tooling: plain Node ESM. Kept out of the type-aware block below because
    // these files sit outside tsconfig.json's `include`.
    {
        files: ['scripts/**/*.mjs', 'eslint.config.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            globals: globals.node,
        },
    },

    // Userscript source: type-aware linting, using tsconfig.json for type information.
    {
        files: ['src/**/*.ts'],
        // Prefer `recommendedTypeChecked` then `strictTypeChecked`.
        extends: [
            js.configs.recommended,
            tseslint.configs.recommendedTypeChecked,
            tseslint.configs.stylisticTypeChecked,
        ],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Replaces tsconfig's noUnusedLocals/noUnusedParameters, which have no
            // escape hatch for intentionally unused bindings.
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
]);
