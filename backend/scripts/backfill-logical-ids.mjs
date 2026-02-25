import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.resolve(__dirname, '../flowguard.db');
const dbPath = process.env.DATABASE_PATH || defaultDbPath;

const HEX_64_RE = /^[0-9a-f]{64}$/i;

function isLegacyHexId(value) {
  return typeof value === 'string' && HEX_64_RE.test(value.trim());
}

function padSequence(sequence) {
  return String(sequence).padStart(3, '0');
}

function parseExistingSequence(value, prefixPattern) {
  const match = value.match(prefixPattern);
  if (!match) return null;
  const seq = Number(match[1]);
  return Number.isFinite(seq) && seq > 0 ? seq : null;
}

function nextAvailableSequence(used) {
  let sequence = 1;
  while (used.has(sequence)) sequence += 1;
  return sequence;
}

function backfillAirdropIds(db) {
  const rows = db
    .prepare('SELECT id, campaign_id, created_at FROM airdrops ORDER BY created_at ASC, id ASC')
    .all();

  const used = new Set();
  for (const row of rows) {
    const parsed = typeof row.campaign_id === 'string'
      ? parseExistingSequence(row.campaign_id, /^#FG-DROP-(\d+)$/i)
      : null;
    if (parsed) used.add(parsed);
  }

  const update = db.prepare('UPDATE airdrops SET campaign_id = ? WHERE id = ?');
  let updated = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!isLegacyHexId(row.campaign_id)) continue;
      const sequence = nextAvailableSequence(used);
      used.add(sequence);
      const campaignId = `#FG-DROP-${padSequence(sequence)}`;
      update.run(campaignId, row.id);
      updated += 1;
    }
  });
  tx();
  return updated;
}

function backfillPaymentIds(db) {
  const rows = db
    .prepare('SELECT id, payment_id, created_at FROM payments ORDER BY created_at ASC, id ASC')
    .all();

  const used = new Set();
  for (const row of rows) {
    const parsed = typeof row.payment_id === 'string'
      ? parseExistingSequence(row.payment_id, /^#FG-PAY-(\d+)$/i)
      : null;
    if (parsed) used.add(parsed);
  }

  const update = db.prepare('UPDATE payments SET payment_id = ? WHERE id = ?');
  let updated = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!isLegacyHexId(row.payment_id)) continue;
      const sequence = nextAvailableSequence(used);
      used.add(sequence);
      const paymentId = `#FG-PAY-${padSequence(sequence)}`;
      update.run(paymentId, row.id);
      updated += 1;
    }
  });
  tx();
  return updated;
}

function backfillStreamIds(db) {
  const rows = db
    .prepare('SELECT id, stream_id, token_type, created_at FROM streams ORDER BY created_at ASC, id ASC')
    .all();

  const usedBch = new Set();
  const usedTok = new Set();

  for (const row of rows) {
    if (typeof row.stream_id !== 'string') continue;
    const isBch = row.token_type === 'BCH';
    const parsed = parseExistingSequence(
      row.stream_id,
      isBch ? /^#FG-BCH-(\d+)$/i : /^#FG-TOK-(\d+)$/i,
    );
    if (!parsed) continue;
    (isBch ? usedBch : usedTok).add(parsed);
  }

  const update = db.prepare('UPDATE streams SET stream_id = ? WHERE id = ?');
  let updated = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!isLegacyHexId(row.stream_id)) continue;

      const isBch = row.token_type === 'BCH';
      const used = isBch ? usedBch : usedTok;
      const sequence = nextAvailableSequence(used);
      used.add(sequence);
      const streamId = `${isBch ? '#FG-BCH-' : '#FG-TOK-'}${padSequence(sequence)}`;
      update.run(streamId, row.id);
      updated += 1;
    }
  });
  tx();
  return updated;
}

function main() {
  const db = new Database(dbPath);
  try {
    const airdropsUpdated = backfillAirdropIds(db);
    const paymentsUpdated = backfillPaymentIds(db);
    const streamsUpdated = backfillStreamIds(db);

    console.log('[backfill-logical-ids] Completed');
    console.log(`[backfill-logical-ids] DB: ${dbPath}`);
    console.log(`[backfill-logical-ids] Airdrops updated: ${airdropsUpdated}`);
    console.log(`[backfill-logical-ids] Payments updated: ${paymentsUpdated}`);
    console.log(`[backfill-logical-ids] Streams updated: ${streamsUpdated}`);
  } finally {
    db.close();
  }
}

main();
