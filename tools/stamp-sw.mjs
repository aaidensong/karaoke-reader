import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const workerURL = new URL('sw.js', root);
const versionPattern = /^const APP_VERSION = '[^'\r\n]+';$/gm;

async function main(){
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')){
    throw new Error('사용법: node tools/stamp-sw.mjs [--check]');
  }
  const check = args[0] === '--check';
  const source = await readFile(workerURL, 'utf8');
  if ([...source.matchAll(versionPattern)].length !== 1){
    throw new Error('sw.js에 APP_VERSION 선언이 하나 있어야 합니다.');
  }
  // sw.js is the only file list. Keep APP_FILES as a JSON-compatible string array.
  const list = source.match(/^const APP_FILES = (\[[\s\S]*?\n\]);$/m);
  if (!list) throw new Error('sw.js의 APP_FILES 배열을 찾지 못했습니다.');
  const files = JSON.parse(list[1]);
  if (!Array.isArray(files) || !files.length || files.some(file =>
    typeof file !== 'string' || (file !== './' &&
      (!/^[a-z0-9][a-z0-9._/-]*$/i.test(file) || file.split('/').includes('..'))))){
    throw new Error('APP_FILES에는 저장소 안의 상대 파일 경로만 지정합니다.');
  }
  const hash = createHash('sha256');
  // Hash worker logic too, replacing its generated value to avoid a circular hash.
  hash.update(source.replace(versionPattern, "const APP_VERSION = '<content-hash>';"));
  for (const file of files){
    const content = await readFile(new URL(file === './' ? 'index.html' : file, root));
    // Include paths and byte lengths so different file boundaries cannot yield the same input.
    hash.update(JSON.stringify([file, content.length]) + '\n');
    hash.update(content);
  }
  const version = hash.digest('hex');
  const stamped = source.replace(versionPattern, `const APP_VERSION = '${version}';`);
  if (check){
    if (source !== stamped){
      throw new Error('APP_VERSION이 현재 앱 파일과 다릅니다. npm run stamp:sw를 실행하고 sw.js를 커밋하세요.');
    }
    console.log(`APP_VERSION 일치: ${version}`);
  } else if (source !== stamped){
    await writeFile(workerURL, stamped);
    console.log(`APP_VERSION 기록: ${version}`);
  } else {
    console.log(`APP_VERSION 변경 없음: ${version}`);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
