import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import '../assets/script-format.js';

export const format = globalThis.KR_SCRIPT;
export const root = path.resolve(import.meta.dirname, '..');
export async function readLibrary(target = path.join(root, 'library')){
  const files = [];
  async function walk(entry){
    if ((await stat(entry)).isDirectory()){
      for (const child of (await readdir(entry)).sort()) await walk(path.join(entry, child));
    } else if (entry.endsWith('.md') && path.basename(entry) !== 'AGENTS.md') files.push(entry);
  }
  await walk(path.resolve(target));
  const ids = new Set(), scripts = [];
  for (const file of files){
    const source = await readFile(file, 'utf8'), parsed = format.parse(source);
    if (!parsed.structured) parsed.errors.push('메타데이터가 없습니다.');
    const { meta, errors } = parsed;
    if (meta.category && path.basename(path.dirname(file)) !== meta.category) errors.push('폴더와 category가 다릅니다.');
    if (meta.id && path.basename(file, '.md') !== meta.id) errors.push('파일명과 id가 다릅니다.');
    if (meta.id && ids.has(meta.id)) errors.push(`id 중복: ${meta.id}`);
    ids.add(meta.id);
    scripts.push({ file, source, ...parsed });
  }
  return scripts;
}
