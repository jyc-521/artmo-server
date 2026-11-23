#!/usr/bin/env node
// Static checks for the ARTMO Gemini boundary. Run from the repository root.
// Checks source patterns only; use tests/ai.service.test.ts for behavior.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
      })
    : [];

const ai = read('src/services/ai.service.ts');
check('src/services/ai.service.ts exists', ai.length > 0);

// 1. Gemini SDK used only in ai.service.ts, config, and the collection script.
const allowed = new Set(['src/services/ai.service.ts', 'src/config/gemini.ts', 'scripts/collect-artworks.ts']);
const offenders = [...walk('src'), ...walk('scripts')].filter((p) => !allowed.has(p) && /@google\/genai/.test(read(p)));
check('Gemini SDK imported only in allowed files', offenders.length === 0, offenders.join(', '));

// 2. Structured output and separated instructions.
check('uses responseSchema', /responseSchema/.test(ai));
check('uses application/json responses', /responseMimeType:\s*["']application\/json["']/.test(ai));
check('uses systemInstruction separate from user content', /systemInstruction/.test(ai));
check('no user sentence concatenated into instruction text', !/systemInstruction[^\n]*(\+|\$\{)\s*(input|sentence|text)/i.test(ai));

// 3. Candidate-only selection and fallbacks.
check('checks artworkId against candidates', /candidate\w*\.(some|find|includes|has)\(/i.test(ai) || /candidateIds\.has\(/.test(ai));
check('has a timeout', /timeout|AbortSignal\.timeout|10_?000/.test(ai));
check('has a default interpretation fallback', /default(Interpretation|Description)|FALLBACK/i.test(ai));
check('limits interpretation length', /300/.test(ai));

// 4. Secrets and tools.
check('no tools or function calling given to Gemini', !/(tools|functionDeclarations)\s*:/.test(ai));
check('API key read from env, not hard-coded', !/AIza[0-9A-Za-z_-]{20,}/.test(ai + read('src/config/gemini.ts')));

// 5. Tests mock Gemini.
const test = read('tests/ai.service.test.ts');
check('tests/ai.service.test.ts exists', test.length > 0);
check('tests mock Gemini', /jest\.mock\(|jest\.fn\(|mockResolvedValue/.test(test));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : `\n      ${r.detail}`}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
