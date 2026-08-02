import { readFileSync } from 'node:fs';

const c = readFileSync('az-planting-calendar/functions/lib/db.ts', 'utf8');
const SQL_CLAUSE =
  /(\bSELECT\b[\s\S]*?\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\b[\s\S]*?\bSET\b|\bDELETE\s+FROM\b)/i;

function safeSqlFragmentIdents(content) {
  const names = new Set();
  const litRe =
    /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])([\s\S]*?)\2\s*;/g;
  let m;
  while ((m = litRe.exec(content)) !== null) {
    const quote = m[2];
    const body = m[3] ?? '';
    if (quote === '`' && /\$\{/.test(body)) continue;
    names.add(m[1]);
  }
  const ternaryRe =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;?]+?\?\s*(['"`])([\s\S]*?)\2\s*:\s*(['"`])([\s\S]*?)\4\s*;/g;
  while ((m = ternaryRe.exec(content)) !== null) {
    names.add(m[1]);
    console.log('ternary hit', m[1], JSON.stringify(m[0].slice(0, 80)));
  }
  const phRe =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*?\.map\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*['"`]\?['"`]\s*\)\s*\.join\s*\(\s*['"`],['"`]\s*\)/g;
  while ((m = phRe.exec(content)) !== null) {
    names.add(m[1]);
    console.log('ph hit', m[1]);
  }
  return names;
}

const names = safeSqlFragmentIdents(c);
console.log('safe set:', [...names]);

const templateRe = /`(?:\\[\s\S]|[^\\`])*`/g;
let m;
while ((m = templateRe.exec(c)) !== null) {
  const lit = m[0];
  if (!/\$\{/.test(lit) || !SQL_CLAUSE.test(lit)) continue;
  const exprs = [...lit.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1].trim());
  console.log(
    'SQL+interp exprs=',
    exprs,
    'all safe=',
    exprs.every((e) => names.has(e)),
    'snippet=',
    lit.slice(0, 100).replace(/\s+/g, ' ')
  );
}
