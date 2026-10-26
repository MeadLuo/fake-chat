// Remove the previous build from the repo root before building again.
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
rmSync(join(root, 'assets'), { recursive: true, force: true });
rmSync(join(root, 'index.html'), { force: true });
