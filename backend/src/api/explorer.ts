import { Router } from 'express';
import db from '../database/schema.js';

const router = Router();

// Public activity feed — all FlowGuard activity across streams, payments, airdrops, vaults
router.get('/explorer/activity', (req, res) => {
  try {
    const { type, token, status, limit } = req.query;
    const pageLimit = Math.min(Number(limit) || 50, 200);

    const results: any[] = [];

    // Fetch streams
    if (!type || type === 'vesting') {
      let sql = `SELECT id, stream_id, sender, recipient, token_type, total_amount,
        vested_amount,
        CASE WHEN total_amount > 0 THEN ROUND(vested_amount * 100.0 / total_amount) ELSE 0 END as progress_percentage,
        stream_type, status, created_at, 'STREAM' as activity_type
        FROM streams_with_vested WHERE 1=1`;
      const params: any[] = [];
      if (token && token !== 'ALL') { sql += ' AND token_type = ?'; params.push(token); }
      if (status && status !== 'ALL') { sql += ' AND status = ?'; params.push(status); }
      sql += ` ORDER BY created_at DESC LIMIT ${pageLimit}`;
      const rows = db!.prepare(sql).all(...params) as any[];
      results.push(...rows.map(r => ({ ...r, created_at: Number(new Date(r.created_at)) / 1000 })));
    }

    // Fetch payments
    if (!type || type === 'payments') {
      let sql = `SELECT id, payment_id as stream_id, sender, recipient, token_type,
        amount_per_period as total_amount, total_paid as vested_amount,
        CASE WHEN status = 'COMPLETED' THEN 100 ELSE 0 END as progress_percentage,
        interval as stream_type, status, created_at, 'PAYMENT' as activity_type
        FROM payments WHERE 1=1`;
      const params: any[] = [];
      if (token && token !== 'ALL') { sql += ' AND token_type = ?'; params.push(token); }
      if (status && status !== 'ALL') { sql += ' AND status = ?'; params.push(status); }
      sql += ` ORDER BY created_at DESC LIMIT ${pageLimit}`;
      const rows = db!.prepare(sql).all(...params) as any[];
      results.push(...rows.map(r => ({ ...r, created_at: Number(new Date(r.created_at)) / 1000 })));
    }

    // Fetch airdrops
    if (!type || type === 'airdrops') {
      let sql = `SELECT id, campaign_id as stream_id, creator as sender,
        '' as recipient, token_type,
        total_amount, (claimed_count * amount_per_claim) as vested_amount,
        CASE WHEN total_amount > 0 THEN ROUND((claimed_count * amount_per_claim) * 100.0 / total_amount) ELSE 0 END as progress_percentage,
        campaign_type as stream_type, status, created_at, 'AIRDROP' as activity_type
        FROM airdrops WHERE 1=1`;
      const params: any[] = [];
      if (token && token !== 'ALL') { sql += ' AND token_type = ?'; params.push(token); }
      if (status && status !== 'ALL') { sql += ' AND status = ?'; params.push(status); }
      sql += ` ORDER BY created_at DESC LIMIT ${pageLimit}`;
      const rows = db!.prepare(sql).all(...params) as any[];
      results.push(...rows.map(r => ({ ...r, created_at: Number(new Date(r.created_at)) / 1000 })));
    }

    // Fetch treasury operations (proposals)
    if (!type || type === 'treasuries') {
      let sql = `SELECT p.id, p.vault_id as stream_id, '' as sender,
        p.recipient, 'BCH' as token_type,
        p.amount as total_amount,
        CASE WHEN p.status = 'EXECUTED' THEN p.amount ELSE 0 END as vested_amount,
        CASE WHEN p.status = 'EXECUTED' THEN 100 ELSE p.approval_count * 25 END as progress_percentage,
        'PROPOSAL' as stream_type, p.status, p.created_at, 'TREASURY' as activity_type
        FROM proposals p WHERE 1=1`;
      const params: any[] = [];
      if (status && status !== 'ALL') { sql += ' AND p.status = ?'; params.push(status); }
      sql += ` ORDER BY p.created_at DESC LIMIT ${pageLimit}`;
      const rows = db!.prepare(sql).all(...params) as any[];
      results.push(...rows.map(r => ({ ...r, created_at: Number(new Date(r.created_at)) / 1000 })));
    }

    // Sort all by created_at desc
    results.sort((a, b) => b.created_at - a.created_at);

    const totalVolume = results.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const activeCount = results.filter(r => r.status === 'ACTIVE').length;
    const completedCount = results.filter(r => r.status === 'COMPLETED').length;

    res.json({
      streams: results.slice(0, pageLimit),
      stats: {
        totalVolume,
        activeCount,
        completedCount,
        totalCount: results.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Comprehensive stats moved to explorer-advanced.ts

export default router;
