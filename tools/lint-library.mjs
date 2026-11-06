import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readLibrary, root, format } from './library-utils.mjs';

// Metadata allows Hangul, ASCII English/digits/spaces, ASCII punctuation,
// and common Korean/English typographic punctuation. Other scripts stay errors.
const invalidMetadataChar = /[^\p{Script_Extensions=Hangul}A-Za-z0-9 !"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~·‘’“”–—…]/gu;
const nonEnglishBodyChar = /[\p{Script_Extensions=Hangul}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Han}]/gu;
const matches = (text, pattern) => [...new Set(text.match(pattern) || [])].join(' ');

try {
  if (process.argv.length > 3) throw new Error('사용법: npm run lint:library -- [폴더 또는 파일]');
  const scripts = await readLibrary(process.argv[2]);
  const dictionary = JSON.parse(await readFile(path.join(root, 'data/ipa-en-us.json'), 'utf8'));
  const banned = (await readFile(new URL('banned-words.txt', import.meta.url), 'utf8'))
    .split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(s => s && !s.startsWith('#'));
  const warnings = [];
  function grams(script){
    return new Set(script.paragraphs.filter(p => !p.heading).flatMap(p => format.sentences(p.text).flatMap(sentence => {
      const words = format.words(sentence);
      return words.slice(3).map((_, i) => words.slice(i, i + 4).join(' '));
    })));
  }
  const allGrams = scripts.map(grams);
  scripts.forEach((script, index) => {
    const label = path.relative(root, script.file), words = format.words(script.source);
    for (const key of ['title', 'situation']){
      const invalid = matches(script.meta[key] || '', invalidMetadataChar);
      if (invalid) script.errors.push(`${key}: 허용되지 않은 문자: ${invalid}`);
    }
    // Parsed paragraphs include ## questions and both dialogue roles, but exclude notices.
    for (const p of script.paragraphs){
      const invalid = matches(p.text, nonEnglishBodyChar);
      if (invalid) script.errors.push(`${p.number}행: 영어 본문에 한글·가나·한자 포함: ${invalid}`);
    }
    const normalized = ` ${words.join(' ')} `;
    for (const term of banned){
      if (normalized.includes(` ${format.words(term).join(' ')} `)) script.errors.push(`금지어 포함: ${term}`);
    }
    for (const p of script.paragraphs.filter(p => !p.heading)){
      for (const sentence of format.sentences(p.text)){
        if (format.words(sentence).length > 25) warnings.push(`${label}:${p.number}: 25단어 초과 문장: ${sentence}`);
      }
    }
    const missing = [...new Set(script.paragraphs.flatMap(p => format.words(p.text)))].filter(word => {
      const base = word.replace(/'s$/, '');
      return !(dictionary[word] || dictionary[base] || dictionary[word.replace(/'/g, '')] ||
        (word.includes('-') && word.split('-').every(part => dictionary[part])));
    });
    if (missing.length > 5) warnings.push(`${label}: 발음 사전에 없는 단어 ${missing.length}개: ${missing.join(', ')}`);
    const own = allGrams[index];
    scripts.forEach((other, j) => {
      if (index === j || !own.size) return;
      const ratio = [...own].filter(g => allGrams[j].has(g)).length / own.size;
      if (ratio > .3) warnings.push(`${label}: ${path.relative(root, other.file)}와 문장 내 단어 4-gram 중복 ${(ratio * 100).toFixed(1)}%`);
    });
  });
  for (const [key, values, label] of [['category', format.categories, '분야'], ['level', format.levels, '수준'], ['type', format.types, '유형']]){
    console.log(label + '별 대본 수');
    console.table(values.map(value => ({ [label]: value, 수: scripts.filter(s => s.meta[key] === value).length })));
  }
  let errors = 0;
  for (const script of scripts) for (const error of script.errors){
    console.error(`오류 ${path.relative(root, script.file)}: ${error}`); errors++;
  }
  for (const warning of warnings) console.warn(`경고 ${warning}`);
  console.log(`대본 ${scripts.length}개 · 오류 ${errors}개 · 경고 ${warnings.length}개`);
  if (errors) process.exitCode = 1;
} catch (error){ console.error(error.message); process.exitCode = 1; }
