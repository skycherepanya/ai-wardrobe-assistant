/**
 * Convenient entry point: node tests/e2e/runner.js
 * Automatically registers the module loader and runs the full test suite.
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Register the custom mock loader for bare specifiers (dexie, @google/genai)
register('./loader.mjs', import.meta.url);

// Execute main TypeScript runner
await import('./runner.ts');
