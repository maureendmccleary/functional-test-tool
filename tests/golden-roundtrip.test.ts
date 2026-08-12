import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { normalizeEvaluation } from '../src/domain/migration.js';
import { loadFixture } from './helpers/fixtures.js';

/**
 * Golden-master test for the load -> save round trip.
 *
 * Loading runs a file through normalizeEvaluation; saving is
 * JSON.stringify(evaluation) (src/io/file-picker.ts). So the exact bytes a save
 * produces for a given input are a complete fingerprint of the in-memory state
 * shape -- key order included, and including keys nothing reads such as
 * `stepCount`.
 *
 * Regenerate deliberately, and review the diff, with:
 *     UPDATE_GOLDEN=1 npm test
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = path.join(HERE, 'golden');

/**
 * Goldens are stored pretty-printed. JSON.parse/stringify preserves key order,
 * so this still catches shape and ordering changes while producing a diff a
 * reviewer can read instead of one 30 KB line.
 */
function format(savedJson: string): string {
    return JSON.stringify(JSON.parse(savedJson), null, 2) + '\n';
}

function checkGolden(name: string): void {
    const saved = JSON.stringify(normalizeEvaluation(loadFixture(name)));
    const actual = format(saved);
    const goldenFile = path.join(GOLDEN_DIR, `${name}.json`);

    if (process.env.UPDATE_GOLDEN) {
        fs.mkdirSync(GOLDEN_DIR, { recursive: true });
        fs.writeFileSync(goldenFile, actual);
        return;
    }

    expect(actual, `Saved output for ${name} changed. If intentional, rerun with UPDATE_GOLDEN=1 and review the diff.`)
        .toBe(fs.readFileSync(goldenFile, 'utf8'));
}

test('saving evaluation-legacy.json after load matches the golden', () => {
    checkGolden('evaluation-legacy');
});

test('saving evaluation-with-runs.json after load matches the golden', () => {
    checkGolden('evaluation-with-runs');
});

describe('a second load/save cycle is stable', () => {
    // If normalization were not idempotent, migrateLegacyTestRun would keep
    // appending performances on every load.
    for (const name of ['evaluation-legacy', 'evaluation-with-runs']) {
        test(name, () => {
            const once = JSON.stringify(normalizeEvaluation(loadFixture(name)));
            const twice = JSON.stringify(normalizeEvaluation(JSON.parse(once)));
            expect(twice).toBe(once);
        });
    }
});
