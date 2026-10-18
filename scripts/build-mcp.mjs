import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!supabaseUrl || !publishableKey) throw new Error('MCP-Webbuild braucht die öffentliche Supabase-Konfiguration.')
if (!supabaseUrl.startsWith('https://')) throw new Error('MCP wird nur gegen einen HTTPS-Server veröffentlicht.')
await build({ entryPoints: ['server/worker.ts'], outfile: 'dist/_worker.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2023', minify: true,
  define: { __MCP_CONFIG__: JSON.stringify({ supabaseUrl, publishableKey, resourceUrl: 'https://prio-krischi.pages.dev/mcp', version }) } })
await writeFile('dist/_routes.json', JSON.stringify({ version: 1, include: ['/mcp', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/*', '/.well-known/oauth-authorization-server', '/oauth/authorize', '/oauth/register', '/oauth/token'], exclude: [] }))
