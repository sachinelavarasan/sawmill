#!/usr/bin/env node
/**
 * `npm run ui:add -- <component…>` — shadcn/ui `add`, plus a fix-up.
 *
 * The shadcn CLI can't resolve our "@/lib/utils" alias (we don't use the deprecated
 * tsconfig baseUrl), so it rewrites components to import `cn` from an unrelated npm
 * package called "cn" and installs it. This puts the import back and removes that package.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: npm run ui:add -- <component> [component…]');
  process.exit(1);
}
execSync(`npx --yes shadcn@3.5.0 add ${args.join(' ')} --yes`, { stdio: 'inherit' });

const dir = join(import.meta.dirname, '..', 'src', 'components', 'ui');
let fixed = 0;
for (const f of readdirSync(dir)) {
  const p = join(dir, f);
  const s = readFileSync(p, 'utf8');
  const out = s.replace(/from ["']cn["']/g, 'from "@/lib/utils"');
  if (out !== s) {
    writeFileSync(p, out);
    fixed++;
  }
}
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'));
if (pkg.dependencies?.cn) execSync('npm uninstall cn', { stdio: 'inherit', cwd: join(import.meta.dirname, '..') });
console.log(`ui:add: fixed the cn import in ${fixed} file(s)`);
