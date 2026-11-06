import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readLibrary, root } from './library-utils.mjs';

try {
  if (process.argv.length > 2) throw new Error('사용법: npm run build:library');
  const scripts = await readLibrary();
  const errors = scripts.flatMap(s => s.errors.map(e => `${path.relative(root, s.file)}: ${e}`));
  if (errors.length) throw new Error(errors.join('\n'));
  const index = scripts.map(s => ({ ...s.meta, path: path.relative(root, s.file).split(path.sep).join('/'),
    sha256: createHash('sha256').update(s.source).digest('hex') }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  await writeFile(path.join(root, 'library/index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`library/index.json 생성: ${index.length}개`);
} catch (error){ console.error(error.message); process.exitCode = 1; }
