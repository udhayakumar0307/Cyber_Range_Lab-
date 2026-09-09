import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const problems = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    if (entry.name.includes('.before_')) continue;

    const rel = path.relative(process.cwd(), full);
    const text = fs.readFileSync(full, 'utf8');

    if (rel !== 'src/lib/api.ts' && /\bfetch\s*\(/.test(text)) {
      problems.push(`${rel}: native fetch() bypasses unified API client`);
    }

    if (rel !== 'src/lib/api.ts' && text.includes('VITE_API_URL')) {
      problems.push(`${rel}: owns VITE_API_URL outside canonical API client`);
    }

    if (/href\s*=\s*\{\s*[`'"]\/api\//.test(text)) {
      problems.push(`${rel}: raw /api href`);
    }

    if (/(?:src|iframeUrl)\s*=\s*[`'"]\/api\//.test(text)) {
      problems.push(`${rel}: raw /api browser URL`);
    }

    if (
      /\bnew WebSocket\s*\(/.test(text) &&
      /\/api\//.test(text) &&
      !text.includes('apiWebSocketUrl')
    ) {
      problems.push(`${rel}: API WebSocket bypasses apiWebSocketUrl()`);
    }
  }
}

walk(root);

if (problems.length) {
  console.error('API routing guard: FAIL');
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log('API routing guard: PASS');
