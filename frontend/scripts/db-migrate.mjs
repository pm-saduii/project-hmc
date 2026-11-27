/**
 * Run the SQL files in ../migrations on the Supabase database directly (no copy-paste into the SQL editor).
 *
 *   npm run db:status                         list every migration: ✓ applied · pending
 *   npm run db:migrate                        apply the pending ones, oldest first (each in a transaction)
 *   npm run db:baseline -- <file.sql>         record <file.sql> and everything before it as applied, without running
 *                                             (once, for the files that were already run by hand in the SQL editor)
 *   npm run db:sql -- <file.sql>              run one SQL file (not recorded)
 *
 * Needs DATABASE_URL in frontend/.env.local (Supabase → Connect → Session pooler). Applied files are recorded
 * in ops.schema_migrations with a checksum; an applied file must not be edited — add a new one instead.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
const [cmd = 'status', arg] = process.argv.slice(2);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in .env.local (repo root or frontend/) (Supabase → Connect → Session pooler).');
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
const sha = (s) => createHash('sha256').update(s).digest('hex');
// Files that manage their own transaction (BEGIN/COMMIT) or use CONCURRENTLY must not be wrapped in another one
const ownTransaction = (sql) => /^\s*(BEGIN|COMMIT)\s*;/im.test(sql) || /\bCONCURRENTLY\b/i.test(sql);

async function main() {
  await client.connect();
  await client.query(`
    create schema if not exists ops;
    create table if not exists ops.schema_migrations (
      name text primary key, checksum text not null, applied_at timestamptz not null default now(), baseline boolean not null default false
    );
    revoke all on schema ops from anon, authenticated;`);

  if (cmd === 'sql') {
    if (!arg) throw new Error('Usage: npm run db:sql -- <file.sql>');
    await client.query(await readFile(path.resolve(process.cwd(), arg), 'utf8'));
    console.log(`✓ ran ${arg}`);
    return;
  }

  const applied = new Map((await client.query('select name, checksum from ops.schema_migrations')).rows.map((r) => [r.name, r.checksum]));
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();

  if (cmd === 'baseline') {
    const upto = arg && path.basename(arg);
    if (!upto || !files.includes(upto)) throw new Error(`Usage: npm run db:baseline -- <file.sql>  (one of the files in migrations/)`);
    let n = 0;
    for (const f of files) {
      if (f > upto) break;
      if (applied.has(f)) continue;
      await client.query('insert into ops.schema_migrations (name, checksum, baseline) values ($1, $2, true)', [f, sha(await readFile(path.join(DIR, f), 'utf8'))]);
      n += 1;
    }
    console.log(`✓ recorded ${n} file(s) up to ${upto} as applied (not run)`);
    return;
  }

  let pending = 0;
  for (const f of files) {
    const sql = await readFile(path.join(DIR, f), 'utf8');
    const prev = applied.get(f);
    if (prev) {
      console.log(prev === sha(sql) ? `✓ ${f}` : `⚠ ${f}  (changed after it was applied — add a new migration instead)`);
      continue;
    }
    pending += 1;
    if (cmd !== 'up') { console.log(`· ${f}  (pending)`); continue; }

    process.stdout.write(`→ ${f} … `);
    const wrap = !ownTransaction(sql);
    try {
      if (wrap) await client.query('begin');
      await client.query(sql);
      await client.query('insert into ops.schema_migrations (name, checksum) values ($1, $2)', [f, sha(sql)]);
      if (wrap) await client.query('commit');
      console.log('done');
    } catch (err) {
      if (wrap) await client.query('rollback').catch(() => undefined);
      console.log('FAILED');
      throw new Error(`${f}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (cmd !== 'up') console.log(pending ? `\n${pending} pending — run: npm run db:migrate` : '\nUp to date.');
  else {
    await client.query("notify pgrst, 'reload schema'").catch(() => undefined);   // let the API see new columns at once
    console.log(pending ? `\n✓ applied ${pending} migration(s)` : 'Up to date.');
  }
}

main()
  .catch((err) => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; })
  .finally(() => client.end().catch(() => undefined));
