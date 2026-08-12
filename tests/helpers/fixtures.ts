import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(HERE, '..', 'fixtures');

/**
 * Parses a fixture fresh on every call, so a test that mutates one (the
 * migration functions all mutate in place) cannot affect another.
 */
export function loadFixture(name: string): unknown {
    return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf8'));
}
