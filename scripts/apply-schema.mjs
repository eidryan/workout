/**
 * Apply supabase/schema.sql to the Supabase Postgres database.
 *
 * Reads the connection string from the environment (.env.local, provisioned by
 * the Vercel Supabase integration). Uses the NON-POOLING url because pooled
 * connections don't reliably support DDL / multi-statement transactions.
 *
 * Usage: node scripts/apply-schema.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

// Minimal .env.local loader (avoids adding a dotenv dependency).
function loadEnv(file) {
  try {
    for (const line of readFileSync(resolve(root, file), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      let v = m[2].trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch {
    // file optional
  }
}

loadEnv('.env.local')

const conn = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!conn) {
  console.error('No POSTGRES_URL_NON_POOLING / POSTGRES_URL in environment.')
  process.exit(1)
}

const sql = readFileSync(resolve(root, 'supabase/schema.sql'), 'utf8')

// Strip `sslmode` from the URL: when present, pg treats it as `verify-full`
// and ignores the ssl option below, which fails on Supabase's cert chain.
const cleanConn = conn.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, p1, p2) =>
  p2 === '&' ? p1 : '',
)

const client = new pg.Client({
  connectionString: cleanConn,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query(sql)
  const { rows } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  )
  console.log('Schema applied. Public tables:')
  for (const r of rows) console.log('  -', r.table_name)

  const { rows: rls } = await client.query(
    `select tablename, rowsecurity from pg_tables
      where schemaname = 'public' order by tablename`,
  )
  console.log('RLS enabled:')
  for (const r of rls) console.log(`  - ${r.tablename}: ${r.rowsecurity}`)
} catch (err) {
  console.error('FAILED:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
