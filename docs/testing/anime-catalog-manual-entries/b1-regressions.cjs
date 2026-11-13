// Every writing suite uses synthetic in-memory or external temporary SQLite fixtures.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const suites = [
  'anime-catalog-manual-entries/b1-verification.cjs',
  'universal-media-identity/section-1-verification.cjs',
  'universal-media-identity/section-2-sqlite-v4-verification.cjs',
  'universal-media-identity/section-3-persistence-verification.cjs',
  'universal-media-identity/section-4-backup-v5-verification.cjs',
  'universal-media-identity/section-5-runtime-consumers-verification.cjs',
  'expanded-media-domain/section-1-verification.cjs',
  'expanded-media-domain/section-2-verification.cjs',
  'expanded-media-domain/section-5-verification.cjs',
  'expanded-media-domain/section-5-ui-verification.cjs',
  'expanded-media-domain/section-8-verification.cjs',
  'library-backup-integrity/controlled-sqlite-failure.cjs',
  'personal-title-rating/section-2-verification.cjs',
  'personal-title-rating/section-2-integration-verification.cjs',
  'provider-abstraction/section-4-materialization-save-verification.cjs',
  'global-appearance-themes/section-2-verification.cjs',
  'global-appearance-themes/section-11-verification.cjs',
];
let failed = 0;
for (const suite of suites) {
  const file = `docs/testing/${suite}`;
  const result = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8' });
  console.log(`node ${file} => exit ${result.status}`);
  if (result.status !== 0) { failed++; console.error(result.error ?? '', result.stdout, result.stderr); }
}
console.log(`${suites.length - failed}/${suites.length} B1 suites passed.`);
process.exitCode = failed ? 1 : 0;
