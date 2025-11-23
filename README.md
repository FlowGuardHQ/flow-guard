# FlowGuard 🛡️

<p align="center">
  <strong>Safe, automated, on-chain treasury management for Bitcoin Cash</strong>
</p>

<p align="center">
  FlowGuard enables recurring budget releases, role-based approval, and spending guardrails — all enforced on-chain — without making teams surrender custody of their funds.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#local-development">Local Development</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#architecture">Architecture</a>
</p>

---

## 🎯 Mission

We're building a treasury management system for Bitcoin Cash teams that actually makes sense. No custodial risk, no manual spreadsheets, no trust required. Just on-chain rules that execute automatically.

Think of it like a smart multisig wallet that can handle recurring payments, spending limits, and multi-party approvals - all enforced by Bitcoin Cash covenants.

## ✨ Features

### 🔄 Recurring Unlock Schedules
Automated periodic fund releases using Loop covenants. Set up monthly, weekly, or custom unlock cycles that execute automatically on-chain.

### 👥 Multi-Signature Approval
Configurable M-of-N signer thresholds (2-of-3, 3-of-5, etc.) ensure no single party can unilaterally drain the treasury. All proposals require approval from multiple authorized signers.

### 🔒 Spending Guardrails
On-chain rules prevent treasury misuse. Set spending caps per proposal, per period, or per recipient to enforce budget discipline.

### 👁️ Complete Transparency
All treasury operations are visible and auditable on the Bitcoin Cash blockchain. Every vault, proposal, approval, and payout is recorded immutably.

### 🔐 Non-Custodial Security
You maintain full control of your private keys. FlowGuard never takes custody of funds — everything is enforced by on-chain covenants.

### ⚡ Powered by Layla CHIPs
Built for Bitcoin Cash's advanced covenant technology:
- **Loops**: Automated recurring execution
- **P2S**: Direct covenant enforcement
- **Bitwise**: Efficient state encoding
- **Functions**: Modular contract logic

**Current Status**: We've got a working version on chipnet right now. The basic multisig contract is deployed and handling real transactions. The advanced contracts using all four Layla CHIPs are written and tested, but they're waiting for the CHIPs to activate on chipnet (November 2025).

---

## 🚀 Getting Started

### Prerequisites

Before you begin, make sure you have the following installed:

**For Docker Compose (Easiest Option):**
1. **Docker** - [Download from docker.com](https://docs.docker.com/get-docker/)
   ```bash
   # Verify installation
   docker --version
   docker-compose --version
   ```
   If you have Docker, you can skip Node.js and pnpm - Docker handles everything!

**For Development Mode (Options B & C):**
1. **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)
   ```bash
   # Verify installation
   node --version  # Should show v18.0.0 or higher
   ```

2. **pnpm** - Package manager (we use pnpm, not npm)
   ```bash
   # Install pnpm globally
   npm install -g pnpm
   
   # Verify installation
   pnpm --version  # Should show 8.0.0 or higher
   ```

**Required for All Options:**
3. **Git** - [Download from git-scm.com](https://git-scm.com/)
   ```bash
   # Verify installation
   git --version
   ```

4. **BCH Wallet Extension** (for testing):
   - [Paytaca Wallet](https://www.paytaca.com/) (recommended)
   - [Badger Wallet](https://badger.bitcoin.com/)
   
   Install one of these browser extensions to interact with FlowGuard.

5. **Chipnet BCH** (testnet funds):
   - Get testnet BCH from the [Chipnet Faucet](https://tbch.googol.cash/)
   - You'll need this to create vaults and test transactions

### Installation

Follow these steps to get FlowGuard running on your local machine:

#### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/flowguard.git

# Navigate into the project directory
cd flowguard
```

#### Step 2: Install Dependencies

> **Skip this step if using Docker Compose** - Docker will handle dependencies automatically when building images.

FlowGuard uses a monorepo structure with workspaces. Install all dependencies at once:

```bash
# From the root directory, install all workspace dependencies
pnpm install
```

This command will:
- Install dependencies for the root workspace
- Install dependencies for `backend/`
- Install dependencies for `frontend/`
- Install dependencies for `contracts/`

**Expected output**: You should see installation progress for all three workspaces. This may take 2-3 minutes.

#### Step 3: Set Up Environment Variables

**For Docker Compose (Option A):**
Create a single `.env` file at the root of the project:

```bash
# From the root directory, copy the example file
cp env.example .env

# Edit .env with your preferred editor (or leave defaults for local development)
# The defaults work fine for local testing:
# - BACKEND_PORT=3001
# - FRONTEND_PORT=80
# - BCH_NETWORK=chipnet
# - VITE_API_URL=http://localhost:3001/api
```

Docker Compose will automatically use this `.env` file for both services.

**For Development Mode (Options B & C):**
Create environment variable files for both backend and frontend:

**Backend environment file** (`backend/.env`):
```bash
# Navigate to backend directory
cd backend

# Create .env file (copy from example)
cp ../env.example .env

# Edit .env with your preferred editor
# Minimum required variables:
PORT=3001
BCH_NETWORK=chipnet
DATABASE_PATH=./database/flowguard.db
```

**Frontend environment file** (`frontend/.env`):
```bash
# Navigate to frontend directory
cd ../frontend

# Create .env file
cat > .env << EOF
VITE_API_URL=http://localhost:3001/api
VITE_BCH_NETWORK=chipnet
EOF
```

> **Note**: The frontend `.env` file is optional for local development. The Vite dev server will use the proxy configuration by default.

#### Step 4: Start the Development Servers

You have three options for running the app:

**Option A: Docker Compose (Easiest - Recommended for Beginners)**

This is the simplest way to run FlowGuard. Docker handles everything for you:

```bash
# Make sure Docker is installed and running
# Check Docker: docker --version

# Copy environment file (if not already done)
cp env.example .env

# Start all services with Docker Compose
docker-compose up -d

# View logs (optional)
docker-compose logs -f

# Stop services when done
docker-compose down
```

This will:
- Build Docker images for both frontend and backend
- Start the backend on `http://localhost:3001`
- Start the frontend on `http://localhost:80` (or `http://localhost`)
- Create persistent storage for the database
- Run everything in isolated containers

**Access the app:**
- Frontend: `http://localhost` or `http://localhost:80`
- Backend: `http://localhost:3001`
- Backend Health: `http://localhost:3001/health`

**Useful Docker commands:**
```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f          # All services
docker-compose logs -f backend   # Just backend
docker-compose logs -f frontend  # Just frontend

# Stop services
docker-compose down

# Stop and remove volumes (⚠️ deletes database)
docker-compose down -v

# Rebuild and restart (after code changes)
docker-compose up -d --build
```

> **Note**: Docker Compose runs in production mode. For development with hot reload, use Option B or C below.

**Option B: Run Everything Together (Development Mode)**

From the root directory:
```bash
# Start both backend and frontend simultaneously
pnpm dev
```

This will:
- Start the backend on `http://localhost:3001`
- Start the frontend on `http://localhost:5173`
- Both servers will watch for file changes and auto-reload
- Perfect for active development

**Option C: Run Separately**

**Terminal 1 - Backend:**
```bash
cd backend
pnpm dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
pnpm dev
```

This gives you separate control over each service and separate log outputs.

#### Step 5: Verify Everything is Working

**If using Docker Compose (Option A):**
1. **Check Backend Health**:
   - Open your browser and visit: `http://localhost:3001/health`
   - You should see: `{"status":"ok","service":"flowguard-backend","blockchain":"connected"}`

2. **Check Frontend**:
   - Open your browser and visit: `http://localhost` or `http://localhost:80`
   - You should see the FlowGuard dashboard

3. **Check API**:
   - Visit: `http://localhost:3001/api`
   - You should see: `{"message":"FlowGuard API","version":"0.1.0","network":"chipnet"}`

**If using Development Mode (Options B & C):**
1. **Check Backend Health**:
   - Open your browser and visit: `http://localhost:3001/health`
   - You should see: `{"status":"ok","service":"flowguard-backend","blockchain":"connected"}`

2. **Check Frontend**:
   - Open your browser and visit: `http://localhost:5173`
   - You should see the FlowGuard dashboard

3. **Check API**:
   - Visit: `http://localhost:3001/api`
   - You should see: `{"message":"FlowGuard API","version":"0.1.0","network":"chipnet"}`

#### Step 6: Connect Your Wallet

1. Open the frontend in your browser:
   - **Docker Compose**: `http://localhost` or `http://localhost:80`
   - **Development Mode**: `http://localhost:5173`
2. Click the "Connect Wallet" button (usually in the top right)
3. Select your BCH wallet extension (Paytaca or Badger)
4. Approve the connection request
5. Make sure your wallet is connected to **Chipnet** (testnet), not mainnet

> **Important**: FlowGuard is currently deployed on chipnet (testnet). Make sure your wallet is set to chipnet mode.

#### Step 7: Create Your First Vault

1. Navigate to "Create Vault" in the dashboard
2. Fill in the vault details:
   - **Name**: Give your vault a descriptive name
   - **Deposit Amount**: Amount of BCH to deposit (use small amounts for testing)
   - **Unlock Schedule**: Choose how often funds unlock (monthly, weekly, etc.)
   - **Signers**: Add wallet addresses that can approve proposals
   - **Approval Threshold**: How many signers must approve (e.g., 2-of-3)
3. Review and sign the transaction with your wallet
4. Wait for confirmation (usually takes a few seconds on chipnet)
5. Your vault is now live on-chain!

---

## 🏗️ Architecture

FlowGuard is a full-stack application consisting of three layers:

```
┌─────────────────────────────────────────┐
│         Frontend (React + TS)           │
│  Wallet connection, UI, tx signing      │
│  Port: 5173                             │
└──────────────┬──────────────────────────┘
               │ HTTP API calls
┌──────────────▼──────────────────────────┐
│     Backend API (Node.js + SQLite)      │
│  Indexing, query APIs, state mirroring  │
│  Port: 3001                             │
└──────────────┬──────────────────────────┘
               │ Blockchain queries
┌──────────────▼──────────────────────────┐
│   On-Chain (CashScript Covenants)       │
│  Treasury rules, enforcement, custody   │
│  Network: Bitcoin Cash Chipnet          │
└─────────────────────────────────────────┘
```

### Project Structure

```
flowguard/
├── contracts/              # CashScript smart contracts
│   ├── FlowGuardEnhanced.cash  # Main contract
│   └── tests/              # Contract tests
│
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   │   ├── auth/       # Authentication components
│   │   │   ├── layout/     # Layout components (Header, Sidebar, etc.)
│   │   │   ├── ui/         # Reusable UI components
│   │   │   └── vaults/     # Vault-specific components
│   │   ├── pages/          # Page components (Home, Vaults, Proposals, etc.)
│   │   ├── hooks/          # React hooks (wallet, transactions)
│   │   ├── services/       # Wallet connectors, API clients
│   │   ├── utils/          # Utilities and helpers
│   │   └── styles/          # Global styles
│   ├── public/             # Static assets
│   ├── Dockerfile          # Production Docker image
│   └── vite.config.ts      # Vite configuration
│
├── backend/                # Express.js + SQLite backend
│   ├── src/
│   │   ├── api/            # API route handlers
│   │   │   ├── vaults.ts   # Vault endpoints
│   │   │   ├── proposals.ts # Proposal endpoints
│   │   │   ├── cycles.ts   # Cycle endpoints
│   │   │   ├── transactions.ts # Transaction endpoints
│   │   │   └── deployment.ts # Contract deployment endpoints
│   │   ├── database/       # Database schema and setup
│   │   ├── models/         # Data models
│   │   ├── services/       # Business logic services
│   │   │   ├── blockchain-monitor.ts # Monitors blockchain state
│   │   │   ├── cycle-unlock-scheduler.ts # Schedules cycle unlocks
│   │   │   ├── contract-service.ts # Contract interactions
│   │   │   └── vaultService.ts # Vault management
│   │   └── index.ts        # Express server entry point
│   ├── database/           # SQLite database files (created at runtime)
│   ├── Dockerfile          # Production Docker image
│   └── package.json        # Backend dependencies
│
├── docs/                   # Documentation
│   └── PRD.md             # Product Requirements Document
│
├── docker-compose.yml      # Docker Compose configuration
├── render.yaml            # Render deployment configuration
├── package.json           # Root workspace configuration
└── README.md              # This file
```

### How It Works

1. **Frontend**: React app that connects to BCH wallets and displays the UI
2. **Backend**: Express API that:
   - Monitors the blockchain for vault state changes (every 30 seconds)
   - Schedules cycle unlocks (checks every 1 minute)
   - Provides REST APIs for vaults, proposals, cycles, and transactions
   - Stores indexed data in SQLite for fast queries
3. **Smart Contracts**: CashScript contracts deployed on-chain that enforce treasury rules

---

## 🛠️ Local Development

### Running the Full Stack

The easiest way to run everything:

```bash
# From root directory
pnpm dev
```

This runs both frontend and backend in parallel using pnpm workspaces.

### Running Components Separately

**Backend only:**
```bash
cd backend
pnpm dev
# Backend runs on http://localhost:3001
```

**Frontend only:**
```bash
cd frontend
pnpm dev
# Frontend runs on http://localhost:5173
# Note: API calls will fail unless backend is running
```

### Available Scripts

**Root level:**
- `pnpm dev` - Start all services in development mode
- `pnpm build` - Build all workspaces
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all code

**Backend:**
- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Compile TypeScript to JavaScript
- `pnpm start` - Run production build
- `pnpm deploy:chipnet` - Deploy contract to chipnet

**Frontend:**
- `pnpm dev` - Start Vite dev server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build locally

### Development Tips

1. **Hot Reload**: Both frontend and backend support hot reload. Changes to code will automatically refresh.

2. **Database**: The SQLite database is created automatically in `backend/database/flowguard.db` on first run.

3. **API Proxy**: In development, the frontend Vite server proxies `/api/*` requests to `http://localhost:3001`. No CORS issues!

4. **Blockchain Monitoring**: The backend automatically monitors the blockchain every 30 seconds and updates vault balances.

5. **Cycle Scheduler**: The backend checks for cycle unlocks every 1 minute.

---

## 📦 Deployment

FlowGuard can be deployed in several ways:

### Option 1: Docker Compose (Local/Server)

Best for: Running on your own server or local machine

```bash
# Copy environment file
cp env.example .env

# Edit .env with your settings
# Then start everything:
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop everything
docker-compose down
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Option 2: Render (Recommended for Beginners)

Best for: Easy cloud deployment with minimal configuration

Render can deploy both frontend and backend using Docker. It's the simplest option for beginners.

**Quick Start:**
1. Push your code to GitHub
2. Go to [dashboard.render.com](https://dashboard.render.com)
3. Click "New +" → "Blueprint"
4. Connect your repository
5. Render will detect `render.yaml` and deploy both services

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for the complete step-by-step guide.

### Option 3: Split Deployment (Advanced)

Best for: Production deployments with separate scaling

- **Frontend**: Deploy to Vercel (static site)
- **Backend**: Deploy to Fly.io (Express server)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full instructions.

---

## 🔧 Environment Variables

### Backend Environment Variables

Create `backend/.env`:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development  # or 'production'

# Database Configuration
DATABASE_PATH=./database/flowguard.db

# Bitcoin Cash Network
BCH_NETWORK=chipnet  # Options: chipnet, mainnet, testnet3, testnet4
```

### Frontend Environment Variables

Create `frontend/.env`:

```bash
# Backend API URL
# Development: Use proxy (leave empty or use http://localhost:3001/api)
# Production: Use your deployed backend URL
VITE_API_URL=http://localhost:3001/api

# Bitcoin Cash Network
VITE_BCH_NETWORK=chipnet
```

> **Note**: Environment variables starting with `VITE_` are exposed to the browser. Never put secrets here!

### Docker Environment Variables

For Docker deployments, see `env.example` for all available variables.

---

## 🧪 Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Lucide Icons** - Icon library
- **Zustand** - State management

### Backend
- **Node.js 18+** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **SQLite** / **better-sqlite3** - Database
- **CashScript** - Smart contract language
- **mainnet-js** - Bitcoin Cash library

### Smart Contracts
- **CashScript** - Contract language
- **FlowGuardEnhanced.cash** - Working multisig treasury (deployed on chipnet)
- **Layla CHIPs** - Advanced contracts ready (loops.cash, FlowGuard.cash, bitwise.cash, functions.cash)

### Infrastructure
- **Docker** - Containerization
- **Render** - Cloud hosting (recommended)
- **Fly.io** - Alternative backend hosting
- **Vercel** - Alternative frontend hosting

---

## 🐛 Troubleshooting

### Backend won't start

**Problem**: Backend fails to start or crashes immediately.

**Solutions**:
1. Check Node.js version: `node --version` (must be 18+)
2. Check if port 3001 is already in use:
   ```bash
   lsof -i :3001
   # If something is using it, kill it or change PORT in .env
   ```
3. Check database directory exists:
   ```bash
   mkdir -p backend/database
   ```
4. Check environment variables are set correctly
5. Check logs for specific error messages

### Frontend can't connect to backend

**Problem**: Frontend shows errors when trying to call API.

**Solutions**:
1. Verify backend is running: Visit `http://localhost:3001/health`
2. Check `VITE_API_URL` in `frontend/.env` (should be `http://localhost:3001/api`)
3. Check Vite proxy configuration in `frontend/vite.config.ts`
4. Check browser console for CORS errors (shouldn't happen in dev)
5. Make sure both servers are running

### Wallet connection issues

**Problem**: Can't connect wallet or transactions fail.

**Solutions**:
1. Make sure wallet extension is installed and enabled
2. Check wallet is connected to **Chipnet** (testnet), not mainnet
3. Refresh the page and try connecting again
4. Check browser console for wallet errors
5. Make sure you have chipnet BCH (get from faucet)

### Database errors

**Problem**: Database-related errors in backend logs.

**Solutions**:
1. Check `DATABASE_PATH` in `backend/.env` is correct
2. Make sure the database directory exists and is writable:
   ```bash
   mkdir -p backend/database
   chmod 755 backend/database
   ```
3. Delete `backend/database/flowguard.db` to reset (⚠️ loses data)
4. Check disk space: `df -h`

### Build errors

**Problem**: `pnpm build` or `pnpm install` fails.

**Solutions**:
1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules */node_modules
   pnpm install
   ```
2. Clear pnpm cache:
   ```bash
   pnpm store prune
   ```
3. Check Node.js and pnpm versions match requirements
4. Check for TypeScript errors: `pnpm --filter backend build`

### Docker issues

**Problem**: Docker containers won't start or crash.

**Solutions**:
1. Check Docker is running: `docker ps`
2. Check logs: `docker-compose logs`
3. Rebuild images: `docker-compose build --no-cache`
4. Check environment variables in `.env` file
5. Check port conflicts (3001, 80)

---

## 📖 Documentation

- [**Product Requirements Document**](./docs/PRD.md) - Product requirements and roadmap
- [**Render Deployment Guide**](./RENDER_DEPLOYMENT.md) - Deploy to Render using Docker (recommended for beginners)
- [**Deployment Guide**](./DEPLOYMENT.md) - Alternative deployment options (Docker, Fly.io, Vercel)
- [**User Documentation**](./frontend/src/pages/DocsPage.tsx) - In-app user guides

---

## 🤝 Use Cases

### DAOs & Communities
Manage community treasuries with transparent governance and recurring contributor payments.

### Open Source Projects
Automate bug bounty funds and development grants with maintainer approval requirements.

### Crypto Startups
Handle payroll and operational expenses with board approval and spending caps.

---

## 🔐 Security

### Non-Custodial Design
FlowGuard never takes custody of funds. All BCH is locked in on-chain covenants that only you and your signers control.

### Multi-Signature Approval
Proposals require M-of-N approvals, preventing single-point-of-failure attacks. Even if one key is compromised, funds remain safe.

### On-Chain Enforcement
All treasury rules are enforced by Bitcoin Cash consensus, not by backend services or trust assumptions.

### Open Source
All contract code is open source and auditable. No black boxes, no hidden logic.

⚠️ **Testnet Notice**: FlowGuard is currently deployed on Bitcoin Cash chipnet (testnet). Do not use real funds. Contracts have not been formally audited.

---

## 🏆 Chipnet Track & Layla CHIPs

We're participating in the Chipnet Track and have implemented all four Layla CHIPs:

### 📅 CHIP Activation Timeline
All Layla CHIPs activate on:
- **Chipnet**: November 15, 2025
- **Mainnet**: May 15, 2026

### What's Live Right Now

**FlowGuardEnhanced.cash** - Our working multisig treasury contract
- Deployed on BCH chipnet and handling real transactions
- Multi-signature approvals (you can configure 2-of-3, 3-of-3, etc.)
- Full workflow: create vault → make proposals → get approvals → execute payouts
- Automatic balance tracking (checks every 30 seconds)
- Transaction history with links to blockchain explorers
- Wallet integration with Paytaca, Badger, and mainnet.cash

You can actually use this right now on chipnet. It's not just a demo - it's a real working system.

### The Advanced Contracts (Ready to Deploy)

We've written contracts that use all four Layla CHIPs. They're tested and ready, but waiting for the CHIPs to activate.

**Loops** (`loops.cash`) - For automated recurring unlocks
- Uses OP_BEGIN / OP_UNTIL to handle time-based cycles
- Calculates which unlock cycle we're in automatically
- No manual triggers needed - it just works on schedule

**Bitwise** (`bitwise.cash`) - For efficient state management  
- Uses bitwise operations to pack state into smaller transactions
- Tracks cycles, proposals, and approvals in a compact format
- Saves on transaction fees by reducing data size

**P2S** (`FlowGuard.cash`) - Direct covenant addressing
- No P2SH wrapper needed - direct locking bytecode
- More secure and flexible than traditional P2SH
- Supports larger token commitments if needed

**Functions** (`functions.cash`) - Modular contract logic
- Reusable functions for common operations
- Cleaner code, easier to audit
- Functions like `hasApproval()`, `isSigner()`, `isAllowedSpending()`

Once the CHIPs activate, we'll deploy these and they'll make the system more efficient and powerful. But the current version works great for now.

---

## 🛣️ Roadmap

### What We've Built So Far

We've got a working MVP on chipnet right now. You can create vaults, make proposals, get approvals, and execute payouts - all on-chain. The basic multisig contract is deployed and handling real transactions.

**What's Working:**
- Multi-signature vault creation with on-chain deployment
- Real-time balance monitoring every 30 seconds
- Proposal workflow (create → approve → execute)
- Wallet integration with Paytaca, Badger, and mainnet.cash
- Transaction confirmation modals for better UX
- Full transaction history with explorer links
- Deposit flow with automatic balance updates

**The Advanced Contracts:**
We've written contracts that use all four Layla CHIPs (Loops, Bitwise, P2S, Functions), but they're waiting for the CHIPs to activate on chipnet. Once that happens in November 2025, we'll deploy them and migrate existing vaults.

### What's Next

**Before CHIP Activation (Now - Nov 2025):**
- Polish the UI/UX based on user feedback
- Add more wallet options (mobile wallets, hardware wallets)
- Improve error handling and edge cases
- Write better documentation for end users
- Maybe add some analytics so teams can track their spending

**After CHIP Activation (Nov 2025 - May 2026):**
- Deploy the advanced contracts that use Loops, Bitwise, P2S, and Functions
- Migrate existing vaults to the new contracts (we'll make this seamless)
- Enable true automated recurring unlocks (right now it's manual triggers)
- Optimize transaction sizes with bitwise state compression
- Test everything thoroughly on chipnet before mainnet

**Mainnet Launch (May 2026+):**
- Get a proper security audit (this is important for real money)
- Deploy to mainnet once CHIPs activate there
- Build out mobile support
- Add more advanced features like spending categories, budgets, etc.
- Maybe integrate with other BCH tools in the ecosystem

**Long Term:**
- Governance features for DAOs
- Integration with other DeFi protocols on BCH
- Multi-currency support (if tokens become a thing)
- Whatever the community asks for

We're building this in the open, so if you have ideas or want to contribute, jump in! The roadmap is flexible and we're always open to feedback.

---

## 🤝 Contributing

We'd love your help! This is a community project and we're always looking for contributors.

Here's how to get started:
1. Fork the repo and clone it
2. Create a branch for your changes: `git checkout -b feature/your-feature-name`
3. Make your changes (and test them!)
4. Commit your changes: `git commit -m "Add: your feature description"`
5. Push to your fork: `git push origin feature/your-feature-name`
6. Open a pull request with a clear description

We're especially interested in:
- Bug fixes and improvements
- UI/UX enhancements
- Documentation improvements
- Testing and edge case handling
- New features that make sense for treasury management

If you're not sure where to start, check the issues or just ask. We're friendly!

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🔗 Links

- **Website**: [Coming Soon]
- **Documentation**: [/docs](https://flowguard.app/docs)
- **GitHub**: [flowguard](https://github.com/yourusername/flowguard)
- **Twitter**: [@FlowGuardBCH](https://twitter.com/FlowGuardBCH)

---

## 🙏 Acknowledgments

- **Design Inspiration**: [Loop Crypto](https://www.loopcrypto.xyz/) and [Safe.global](https://safe.global/)
- **Technology**: Bitcoin Cash community and Layla CHIPs developers
- **Wallets**: Paytaca and Badger Wallet teams

---

<p align="center">
  Built for the Bitcoin Cash ecosystem
</p>
