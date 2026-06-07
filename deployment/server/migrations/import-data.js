// One-shot importer: reads migrations/data/*.json and inserts into VPS Postgres.
// Run inside the api container:
//   docker compose exec api node migrations/import-data.js
// Set IMPORT_OVERWRITE=1 to TRUNCATE tables first.

import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 4 });

// Order matters: FK dependencies first.
const ORDER = [
  'profiles',
  'clients',
  'bots',
  'bot_settings',
  'number_panels',
  'number_pool',
  'sms_ranges',
  'active_rates',
  'banned_keywords',
  'otp_audit_log',
  'sms_cdr',
  'sms_logs',
  'payouts',
];

async function tableColumns(table) {
  const rows = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  return new Set(rows.map(r => r.column_name));
}

async function ensureProfilePasswordDefault() {
  // Lovable profiles have no password_hash. Give every migrated profile
  // a temporary hash so the NOT NULL constraint passes. They must reset.
  const TEMP = await bcrypt.hash('ChangeMe123!', 10);
  return TEMP;
}

async function importTable(table, tempProfileHash) {
  const file = path.join(DATA_DIR, `${table}.json`);
  if (!fs.existsSync(file)) {
    console.log(`[skip] ${table} — no data file`);
    return;
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(raw) || raw.length === 0) {
    console.log(`[skip] ${table} — empty`);
    return;
  }

  const cols = await tableColumns(table);
  if (cols.size === 0) {
    console.log(`[skip] ${table} — table does not exist on VPS`);
    return;
  }

  if (process.env.IMPORT_OVERWRITE === '1') {
    console.log(`[wipe] ${table}`);
    await sql.unsafe(`TRUNCATE TABLE ${table} CASCADE`);
  }

  let ok = 0, skipped = 0;
  for (const row of raw) {
    // Per-table field remap (Lovable schema → VPS schema)
    if (table === 'sms_cdr') {
      if (row.number && !row.phone_number) row.phone_number = row.number;
      if (row.received_at && !row.created_at) row.created_at = row.received_at;
      if (row.payout != null && row.price_bdt == null) row.price_bdt = row.payout;
      if (row.message && !row.otp_code) {
        const m = String(row.message).match(/\b(\d{3,8})\b/);
        if (m) row.otp_code = m[1];
      }
    }

    // Drop columns the VPS schema doesn't have
    const filtered = {};
    for (const k of Object.keys(row)) {
      if (cols.has(k) && row[k] !== null && row[k] !== undefined) filtered[k] = row[k];
    }

    // Special handling per-table
    if (table === 'profiles' && cols.has('password_hash') && !filtered.password_hash) {
      filtered.password_hash = tempProfileHash;
    }


    try {
      await sql`INSERT INTO ${sql(table)} ${sql(filtered)} ON CONFLICT DO NOTHING`;
      ok++;
    } catch (e) {
      skipped++;
      console.warn(`  [warn] ${table} row failed: ${e.message}`);
    }
  }
  console.log(`[done] ${table}: inserted ${ok}, skipped ${skipped}`);
}

async function main() {
  console.log('=== Nexus Data Import ===');
  console.log(`Target: ${DATABASE_URL.split('@')[1] || 'unknown'}`);
  console.log(`Overwrite: ${process.env.IMPORT_OVERWRITE === '1' ? 'YES (TRUNCATE)' : 'no (skip duplicates)'}`);
  console.log('');

  const tempHash = await ensureProfilePasswordDefault();
  console.log('[info] Migrated profiles get temp password: ChangeMe123!');
  console.log('       Tell users to log in and reset it.');
  console.log('');

  for (const t of ORDER) {
    await importTable(t, tempHash);
  }

  console.log('');
  console.log('=== Import complete ===');
  await sql.end();
}

main().catch(err => {
  console.error('IMPORT FAILED:', err);
  process.exit(1);
});
