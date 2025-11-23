/**
 * Transactions API endpoints
 * Provides endpoints for transaction history
 */

import { Router } from 'express';
import { TransactionService } from '../services/transactionService.js';

const router = Router();

/**
 * GET /api/vaults/:id/transactions
 * Get all transactions for a vault
 */
router.get('/vaults/:id/transactions', (req, res) => {
  try {
    const { id } = req.params;
    const transactions = TransactionService.getVaultTransactions(id);
    res.json({ transactions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transactions/:txHash
 * Get transaction by hash
 */
router.get('/transactions/:txHash', (req, res) => {
  try {
    const { txHash } = req.params;
    const transaction = TransactionService.getTransactionByHash(txHash);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json({ transaction });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transactions/pending
 * Get all pending transactions
 */
router.get('/transactions/pending', (req, res) => {
  try {
    const transactions = TransactionService.getPendingTransactions();
    res.json({ transactions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

