// Runs vitest with the Windows drive letter of the cwd upper-cased.
//
// When the cwd is `c:\...` (Git Bash, some VS Code terminals), vitest's own
// files load from file:///c:/... while test files resolve `vitest` to
// file:///C:/..., so Node keeps two copies and every suite fails with
// "Vitest failed to find the runner". The cwd must be fixed before the vitest
// process starts; changing it from vitest.config is too late.
// See https://github.com/vitest-dev/vitest/issues/5251
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());
const require = createRequire(path.join(cwd, 'package.json'));
const vitestBin = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

const result = spawnSync(process.execPath, [vitestBin, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
