import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import vaultsRouter from './api/vaults.js';
import proposalsRouter from './api/proposals.js';
import cyclesRouter from './api/cycles.js';
import deploymentRouter from './api/deployment.js';
import transactionsRouter from './api/transactions.js';
import walletRouter from './api/wallet.js';
import budgetPlansRouter from './api/budgetPlans.js';
import streamsRouter from './api/streams.js';
import paymentsRouter from './api/payments.js';
import airdropsRouter from './api/airdrops.js';
import governanceRouter from './api/governance.js';
import explorerRouter from './api/explorer.js';
import explorerAdvancedRouter from './api/explorer-advanced.js';
import adminRouter from './api/admin.js';
import { startBlockchainMonitor, stopBlockchainMonitor } from './services/blockchain-monitor.js';
import { startCycleUnlockScheduler, stopCycleUnlockScheduler } from './services/cycle-unlock-scheduler.js';
import { startTransactionMonitor, stopTransactionMonitor } from './services/TransactionMonitor.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter, strictLimiter, queryLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS configuration - Allow all Vercel deployments
app.use(cors({
  origin: true, // Allow all origins for now (can restrict later)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-address', 'x-signer-public-key'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Apply rate limiting globally
app.use('/api', generalLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'flowguard-backend', blockchain: 'connected' });
});

// API routes
// Apply strict rate limiting only to expensive creation/build endpoints
app.post('/api/vaults', strictLimiter);
app.post('/api/streams/create', strictLimiter);
app.post('/api/treasuries/:vaultId/batch-create', strictLimiter);
app.post('/api/payments/create', strictLimiter);
app.post('/api/airdrops/create', strictLimiter);
app.post('/api/airdrops/:id/generate-merkle', strictLimiter);
app.post('/api/vaults/:vaultId/budget-plans', strictLimiter);
// Apply query rate limiting to read-only endpoints
app.use('/api/explorer', queryLimiter);

app.use('/api/vaults', vaultsRouter);
app.use('/api', budgetPlansRouter); // Register BEFORE proposals to avoid route conflicts
app.use('/api', cyclesRouter);
app.use('/api/deployment', deploymentRouter);
app.use('/api', transactionsRouter);
app.use('/api/wallet', walletRouter);
app.use('/api', streamsRouter); // Vesting streams
app.use('/api', paymentsRouter); // Recurring payments
app.use('/api', airdropsRouter); // Mass distributions
app.use('/api', governanceRouter); // Treasury governance
app.use('/api', explorerRouter); // Public activity explorer
app.use('/api', explorerAdvancedRouter); // Advanced explorer features
app.use('/api', adminRouter); // Admin/operator endpoints
app.use('/api', proposalsRouter); // LAST - has catch-all /:id routes

app.get('/api', (req, res) => {
  res.json({ message: 'FlowGuard API', version: '0.1.0', network: 'chipnet' });
});

// Error handler middleware (MUST be last)
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FlowGuard backend running on port ${PORT}`);
  console.log(`📡 Network: ${process.env.BCH_NETWORK || 'chipnet'}`);

  // Start blockchain monitoring (check every 30 seconds)
  console.log('🔗 Starting blockchain monitor...');
  startBlockchainMonitor(30000);

  // Start cycle unlock scheduler (check every 1 minute)
  console.log('⏰ Starting cycle unlock scheduler...');
  startCycleUnlockScheduler(60000);

  // Start transaction monitor (check every 30 seconds)
  console.log('📊 Starting transaction monitor...');
  startTransactionMonitor(30000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  stopBlockchainMonitor();
  stopCycleUnlockScheduler();
  stopTransactionMonitor();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  stopBlockchainMonitor();
  stopCycleUnlockScheduler();
  stopTransactionMonitor();
  process.exit(0);
});
