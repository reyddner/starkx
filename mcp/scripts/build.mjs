import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
let commit = 'desconhecido';
try { commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch {}
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/server.ts', 'src/tools.ts'], outdir: 'dist', outExtension: { '.js': '.mjs' },
  bundle: true, define: { __STARKX_COMMIT__: JSON.stringify(commit) }, platform: 'node', format: 'esm', target: 'node22',
  // ExcelJS uses its own CommonJS package/assets; resolve the local dependency at runtime.
  external: ['exceljs'],
  // CommonJS dependencies (fontkit) require the Node bridge inside the ESM bundle.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  legalComments: 'eof', logLevel: 'info',
});
await copyFile('../memorial-engine/fonts/Roboto-Regular.ttf', 'dist/Roboto-Regular.ttf');
await mkdir('dist/assets',{recursive:true});
for (const name of ['logo_B_horizontal_transparente.png','simbolo_B_transparente.png']) await copyFile(`src/assets/${name}`,`dist/assets/${name}`);
