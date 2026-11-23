#!/usr/bin/env node
// Static checks for ARTMO route guards. Run from the repository root.
// Checks source patterns only; use Jest (tests/api.test.ts) for request behavior.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

// 1. isAuthenticated always comes before requireAdmin on the same route line.
const routesDir = 'src/routes';
const routeFiles = existsSync(routesDir) ? readdirSync(routesDir).filter((f) => f.endsWith('.ts')) : [];
check('routes directory exists', routeFiles.length > 0, routesDir);
for (const file of routeFiles) {
  const src = read(join(routesDir, file));
  const usesRouterLevelAuth = /router\.use\(\s*isAuthenticated\s*\)/.test(src);
  const badLines = src
    .split('\n')
    .filter((line) => line.includes('requireAdmin') && !line.includes('router.use'))
    .filter((line) => !usesRouterLevelAuth && line.indexOf('isAuthenticated') === -1);
  check(`${file}: requireAdmin preceded by isAuthenticated`, badLines.length === 0, badLines.join(' | '));
  const misordered = src.split('\n').filter((l) => l.indexOf('requireAdmin') > -1 && l.indexOf('isAuthenticated') > l.indexOf('requireAdmin'));
  check(`${file}: no requireAdmin before isAuthenticated`, misordered.length === 0, misordered.join(' | '));
}

// 2. optionalAuth only on recommendation create/read.
const rec = read(join(routesDir, 'recommendations.routes.ts')) ?? '';
const optionalLines = routeFiles.flatMap((f) => read(join(routesDir, f)).split('\n').filter((l) => l.includes('optionalAuth(') || /,\s*optionalAuth\s*,/.test(l)));
check('optionalAuth limited to recommendations routes', optionalLines.every((l) => rec.includes(l)), optionalLines.join(' | '));
check('daily limit applied to POST /api/recommendations', /router\.post\(\s*["']\/["'][^)]*(dailyLimit|rateLimit)/.test(rec));

// 3. App wiring.
const app = read('src/app.ts') ?? '';
check('src/app.ts exists', app.length > 0);
const notFoundIdx = app.lastIndexOf('notFound');
const errorIdx = app.lastIndexOf('errorHandler');
const lastRouterIdx = app.lastIndexOf('app.use("/api') > -1 ? app.lastIndexOf('app.use("/api') : app.lastIndexOf("app.use('/api");
check('notFound then errorHandler mounted last', notFoundIdx > lastRouterIdx && errorIdx > notFoundIdx);
check('CORS credentials: false', /credentials:\s*false/.test(app));
check('CORS has no wildcard origin', !/origin:\s*["']\*["']/.test(app));
check('JSON body limit 100kb', /limit:\s*["']100kb["']/.test(app));

// 4. Acting user comes from req.auth, not from body/query.
const controllers = existsSync('src/controllers') ? readdirSync('src/controllers').map((f) => read(join('src/controllers', f))).join('\n') : '';
check('no user id taken from req.body/req.query', !/req\.(body|query)\.(userId|user_id)/.test(controllers));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : `\n      ${r.detail}`}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
