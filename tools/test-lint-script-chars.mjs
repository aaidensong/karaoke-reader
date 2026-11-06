import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const bodyError = '영어 본문에 한글·가나·한자 포함:';
const cases = [
  ['title', ['title: 허용되지 않은 문자: か な 漢 字 🙂 é']],
  ['situation', ['situation: 허용되지 않은 문자: 友 人 を 気 遣 う カ ナ ｶ ﾅ 𠮷 🙂 é']],
  ['monologue', [
    `12행: ${bodyError} 한 글 ㄱ ᄀ`,
    `14행: ${bodyError} ひ ら が な カ タ ナ ｶ ﾅ`,
    `16행: ${bodyError} 漢 字 𠮷`,
  ]],
  ['dialogue', [
    `12행: ${bodyError} 한 글`,
    `14행: ${bodyError} カ ナ`,
    `16행: ${bodyError} 漢 字`,
  ]],
  ['qa', [
    `12행: ${bodyError} 한 글`,
    `15행: ${bodyError} か な`,
    `18행: ${bodyError} 漢 字`,
    `22행: ${bodyError} 한 글 カ ナ 漢 字`,
  ]],
];

for (const [name, messages] of cases){
  test(`reject ${name} character violations`, () => {
    const fixture = `tools/fixtures/invalid-chars/01-daily/chars-${name}.md`;
    const result = spawnSync(process.execPath, [path.join(root, 'tools/lint-library.mjs'), fixture], {
      cwd: root, encoding: 'utf8',
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.deepEqual(result.stderr.trim().split(/\r?\n/), messages.map(message => `오류 ${fixture}: ${message}`));
  });
}
