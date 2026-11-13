// Offline aggregate: reuse existing regression coverage; each suite runs once.
// The B1 aggregate includes 17 suites. No live-provider/browser acceptance here.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const suites = [
  'anime-catalog-manual-entries/b1-regressions.cjs',
  'anime-catalog-manual-entries/b2-verification.cjs',
  'anime-catalog-manual-entries/b2-ui-verification.cjs',
  'anime-catalog-manual-entries/b3-contracts.cjs',
  'anime-catalog-manual-entries/b3-verification.cjs',
  'anime-catalog-manual-entries/b3-ui-verification.cjs',
  'provider-abstraction/section-2-tmdb-mapping-verification.cjs',
  'provider-abstraction/section-3-buscar-verification.cjs',
  'provider-abstraction/section-5-detail-verification.cjs',
  'expanded-media-domain/section-3-verification.cjs',
  'expanded-media-domain/section-3-ui-verification.cjs',
  'expanded-media-domain/section-4-verification.cjs',
  'expanded-media-domain/section-6-verification.cjs',
  'expanded-media-domain/section-8-ui-verification.cjs',
  'mangaupdates-cover-images/section-1-verification.cjs',
  'mangaupdates-cover-images/section-2-verification.cjs',
  'mangaupdates-cover-images/section-3-verification.cjs',
  'mangaupdates-cover-images/section-4-verification.cjs',
  'mangaupdates-cover-images/section-5-verification.cjs',
  'tmdb-user-credential/section-1-verification.cjs',
  'tmdb-user-credential/section-2-verification.cjs',
  'tmdb-user-credential/section-3-verification.cjs',
  'tmdb-user-credential/section-4-verification.cjs',
  'tmdb-user-credential/section-5-verification.cjs',
  'personal-title-rating/section-1-verification.cjs',
  'personal-title-rating/section-1-badge-verification.cjs',
  'personal-title-rating/section-3-verification.cjs',
  'personal-title-rating/section-4-verification.cjs',
  'personal-title-rating/section-5-verification.cjs',
  'personal-title-rating/section-6-verification.cjs',
  ...[1, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(n => `global-appearance-themes/section-${n}-verification.cjs`),
];
let failed = 0;
for (const suite of suites) {
  const file = `docs/testing/${suite}`;
  const result = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', timeout: 120000 });
  console.log(`node ${file} => exit ${result.status}`);
  if (suite.endsWith('b1-regressions.cjs') || result.status !== 0) process.stdout.write(result.stdout ?? '');
  if (result.status !== 0) { failed++; console.error(result.error ?? '', result.stderr); }
}
console.log(`${suites.length - failed}/${suites.length} B4 commands passed (${suites.length + 16} leaf suites).`);
process.exitCode = failed ? 1 : 0;
