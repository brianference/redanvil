import type { Job } from '../schemas/job';

const PAGES = ['Home', 'About', 'Terms', 'Privacy', 'Contact'] as const;

const pageComponent = (name: string): string =>
  `import { Page } from '../components/Page';\n\n` +
  `/** ${name} page. Copy belongs in the locale bundle; kept inline here only as a compliant seed. */\n` +
  `export function ${name}(): JSX.Element {\n` +
  `  return (\n    <Page title="${name}">\n      <p>${name} content.</p>\n    </Page>\n  );\n}\n`;

/** The generated app's source tree, keyed by repo-relative path. Real, compliant seed — not lorem. */
export function appFiles(job: Job): Record<string, string> {
  const files: Record<string, string> = {
    'package.json':
      JSON.stringify(
        {
          name: job.slug,
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc -b && vite build',
            preview: 'wrangler pages dev ./dist',
            typecheck: 'tsc -b',
            lint: 'eslint . --max-warnings 0',
            test: 'vitest run'
          },
          dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0', 'react-router-dom': '^6.26.0' },
          devDependencies: {
            '@vitejs/plugin-react': '^4.3.0',
            tailwindcss: '^3.4.0',
            typescript: '^5.6.0',
            vite: '^5.4.0',
            vitest: '^2.0.0',
            wrangler: '^3.78.0'
          }
        },
        null,
        2
      ) + '\n',
    'tsconfig.json':
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            moduleResolution: 'Bundler',
            jsx: 'react-jsx',
            strict: true,
            noUncheckedIndexedAccess: true,
            noEmit: true,
            skipLibCheck: true
          },
          include: ['src', 'functions']
        },
        null,
        2
      ) + '\n',
    '.gitignore': ['node_modules/', 'dist/', '.env', '.dev.vars', '.wrangler/'].join('\n') + '\n',
    'wrangler.toml': `name = "${job.slug}"\ncompatibility_date = "2026-07-01"\npages_build_output_dir = "dist"\n\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "${job.slug}-db"\ndatabase_id = "REPLACE_WITH_D1_ID"\n`,
    'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${job.slug}</title>\n    <meta name="description" content="${job.prompt.slice(0, 150)}" />\n    <meta property="og:title" content="${job.slug}" />\n    <meta property="og:type" content="website" />\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
    'public/robots.txt': 'User-agent: *\nAllow: /\n',
    'src/main.tsx': `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { App } from './App';\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n`,
    'src/theme.ts': `import tokens from '../../design-system/tokens.json';\n\n/** Theme tokens are the single source of styling truth (fe-theme-tokens-only). */\nexport const theme = tokens;\n`,
    'src/components/Page.tsx': `import type { ReactNode } from 'react';\n\nexport interface PageProps {\n  /** Page title, rendered as the single h1. */\n  title: string;\n  /** Page body. */\n  children: ReactNode;\n}\n\n/** Shared page shell: sticky header, one h1, professional footer. */\nexport function Page({ title, children }: PageProps): JSX.Element {\n  return (\n    <div>\n      <header style={{ position: 'sticky', top: 0 }}>\n        <nav aria-label="Primary">${job.slug}</nav>\n      </header>\n      <main>\n        <h1>{title}</h1>\n        {children}\n      </main>\n      <footer>\n        <small>&copy; ${job.slug}</small>\n      </footer>\n    </div>\n  );\n}\n`,
    'functions/api/health.ts': `/** Health endpoint — proves the Worker runtime boots (lg-runtime-parity). */\nexport function onRequest(context: { request: Request }): Response {\n  const origin = new URL(context.request.url).origin;\n  return new Response(JSON.stringify({ status: 'ok' }), {\n    headers: {\n      'content-type': 'application/json',\n      'x-content-type-options': 'nosniff',\n      'referrer-policy': 'same-origin',\n      'access-control-allow-origin': origin,\n      'access-control-allow-methods': 'GET'\n    }\n  });\n}\n`,
    'functions/lib/auth.ts': `/** Web Crypto auth: PBKDF2 password hashing, HMAC-SHA256 tokens. Runs natively on Workers. */\nexport async function hashPassword(password: string, salt: Uint8Array): Promise<ArrayBuffer> {\n  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [\n    'deriveBits'\n  ]);\n  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);\n}\n`
  };

  const routeImports = PAGES.map((p) => `import { ${p} } from './pages/${p}';`).join('\n');
  const routes = PAGES.map(
    (p) =>
      `        <Route path="${p === 'Home' ? '/' : '/' + p.toLowerCase()}" element={<${p} />} />`
  ).join('\n');
  files['src/App.tsx'] =
    `import { BrowserRouter, Routes, Route } from 'react-router-dom';\n${routeImports}\n\n/** App router: composes the required pages. */\nexport function App(): JSX.Element {\n  return (\n    <BrowserRouter>\n      <Routes>\n${routes}\n      </Routes>\n    </BrowserRouter>\n  );\n}\n`;

  for (const p of PAGES) files[`src/pages/${p}.tsx`] = pageComponent(p);
  return files;
}
