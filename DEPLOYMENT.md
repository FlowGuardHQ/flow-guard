# FlowGuard Deployment Guide

This guide covers different ways to deploy FlowGuard, from simple Docker Compose to advanced split deployments.

## Table of Contents

- [Quick Start: Docker Compose](#quick-start-docker-compose)
- [Option 1: Docker Compose (Recommended for Beginners)](#option-1-docker-compose-recommended-for-beginners)
- [Option 2: Render (Cloud Deployment)](#option-2-render-cloud-deployment)
- [Option 3: Split Deployment (Advanced)](#option-3-split-deployment-advanced)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick Start: Docker Compose

The fastest way to get FlowGuard running locally or on a server:

```bash
# 1. Copy environment file
cp env.example .env

# 2. Edit .env if needed (defaults work for local development)
# 3. Start everything
docker-compose up -d

# 4. Check logs
docker-compose logs -f

# 5. Access the app
# Frontend: http://localhost
# Backend: http://localhost:3001
```

That's it! Both frontend and backend are now running.

---

## Option 1: Docker Compose (Recommended for Beginners)

Docker Compose is the easiest way to deploy FlowGuard. It runs both frontend and backend in containers with a single command.

### Prerequisites

1. **Docker** - [Install Docker](https://docs.docker.com/get-docker/)
   ```bash
   # Verify installation
   docker --version
   docker-compose --version
   ```

2. **Git** - To clone the repository

### Step-by-Step Deployment

#### Step 1: Clone and Prepare

```bash
# Clone the repository
git clone https://github.com/yourusername/flowguard.git
cd flowguard

# Copy environment file
cp env.example .env
```

#### Step 2: Configure Environment Variables

Edit `.env` file with your preferred text editor:

```bash
# Backend Configuration
BACKEND_PORT=3001
NODE_ENV=production

# Database Configuration
DATABASE_PATH=/app/data/flowguard.db

# Bitcoin Cash Network
BCH_NETWORK=chipnet  # or mainnet, testnet3, testnet4

# Frontend Configuration
FRONTEND_PORT=80
VITE_API_URL=http://localhost:3001/api
VITE_BCH_NETWORK=chipnet
```

**Important Notes:**
- For production, change `BCH_NETWORK` to `mainnet` when ready
- The `VITE_API_URL` should match your backend URL
- In Docker, use `http://backend:3001/api` for internal communication
- For external access, use your server's public IP or domain

#### Step 3: Build and Start

```bash
# Build Docker images (first time only, or after code changes)
docker-compose build

# Start all services
docker-compose up -d

# The -d flag runs in detached mode (background)
```

#### Step 4: Verify Deployment

**Check if containers are running:**
```bash
docker-compose ps
```

You should see:
- `flowguard-backend` - Status: Up
- `flowguard-frontend` - Status: Up

**Check backend health:**
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","service":"flowguard-backend","blockchain":"connected"}
```

**Check frontend:**
Open `http://localhost` (or `http://localhost:80`) in your browser.

**View logs:**
```bash
# All services
docker-compose logs -f

# Just backend
docker-compose logs -f backend

# Just frontend
docker-compose logs -f frontend
```

#### Step 5: Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes database)
docker-compose down -v
```

### Updating the Deployment

When you update the code:

```bash
# Pull latest code
git pull

# Rebuild images
docker-compose build

# Restart services
docker-compose restart

# Or rebuild and restart in one command
docker-compose up -d --build
```

### Persistent Data

The SQLite database is stored in a Docker volume named `flowguard_sqlite_data`. This ensures your data persists even if you stop the containers.

**To backup the database:**
```bash
# Find the volume
docker volume ls | grep flowguard

# Create a backup
docker run --rm -v flowguard_sqlite_data:/data -v $(pwd):/backup alpine tar czf /backup/flowguard-backup.tar.gz /data
```

**To restore from backup:**
```bash
# Stop services first
docker-compose down

# Restore
docker run --rm -v flowguard_sqlite_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/flowguard-backup.tar.gz"

# Start services
docker-compose up -d
```

---

## Option 2: Render (Cloud Deployment)

Render is a cloud platform that makes deploying Docker applications easy. It's great for beginners who want cloud hosting without managing servers.

**See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for the complete step-by-step guide.**

**Quick Summary:**
1. Push code to GitHub
2. Go to [dashboard.render.com](https://dashboard.render.com)
3. Click "New +" → "Blueprint"
4. Connect repository
5. Render auto-detects `render.yaml` and deploys

---

## Option 3: Split Deployment (Advanced)

This approach deploys frontend and backend separately, which allows for independent scaling and different hosting providers.

### Architecture Overview

```
┌─────────────────┐
│  Frontend       │  → Deployed to Vercel (static site)
│  (React + Vite) │
└────────┬────────┘
         │ HTTP API calls
┌────────▼────────┐
│  Backend        │  → Deployed to Fly.io (Express server)
│  (Express + DB) │
└─────────────────┘
```

### Why Split Deployment?

**Vercel Limitations:**
- ❌ Cannot run long-running Express servers
- ❌ No persistent file system (SQLite needs persistent storage)
- ❌ Serverless functions have execution time limits
- ❌ No background job support (blockchain monitor needs to run continuously)

**Fly.io Advantages:**
- ✅ Persistent processes (Express server runs continuously)
- ✅ Persistent volumes (SQLite database storage)
- ✅ Background jobs (cycle scheduler, blockchain monitor)
- ✅ Full Node.js runtime support

### Frontend Deployment (Vercel)

#### Prerequisites

1. **Vercel Account** - [Sign up at vercel.com](https://vercel.com)
2. **Vercel CLI** (optional, for command-line deployment):
   ```bash
   npm install -g vercel
   ```

#### Step 1: Prepare Frontend

```bash
cd frontend

# Create production .env file
cat > .env.production << EOF
VITE_API_URL=https://your-backend-url.fly.dev/api
VITE_BCH_NETWORK=chipnet
EOF
```

Replace `your-backend-url` with your actual Fly.io backend URL.

#### Step 2: Deploy to Vercel

**Option A: Using Vercel Dashboard (Recommended for Beginners)**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`
4. Add environment variables:
   - `VITE_API_URL`: `https://your-backend-url.fly.dev/api`
   - `VITE_BCH_NETWORK`: `chipnet`
5. Click "Deploy"

**Option B: Using Vercel CLI**

```bash
cd frontend
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: flowguard-frontend
# - Directory: ./
# - Override settings? No
```

#### Step 3: Verify Frontend

After deployment, Vercel will give you a URL like `https://flowguard-frontend.vercel.app`. Visit it and verify:
- Page loads correctly
- Wallet connection works
- API calls succeed (check browser console)

### Backend Deployment (Fly.io)

#### Prerequisites

1. **Fly.io Account** - [Sign up at fly.io](https://fly.io)
2. **Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   # Or on macOS:
   brew install flyctl
   ```

#### Step 1: Login to Fly.io

```bash
fly auth login
```

This will open a browser window for authentication.

#### Step 2: Initialize Fly.io App

```bash
cd backend

# Initialize (if not already done)
fly launch

# Follow prompts:
# - App name: flowguard-backend (or your choice)
# - Region: Choose closest to your users
# - PostgreSQL? No (we use SQLite)
# - Redis? No
```

#### Step 3: Configure Environment Variables

```bash
# Set environment variables
fly secrets set BCH_NETWORK=chipnet
fly secrets set PORT=3001
fly secrets set DATABASE_PATH=/data/flowguard.db
fly secrets set NODE_ENV=production
```

#### Step 4: Create Persistent Volume

SQLite needs persistent storage:

```bash
# Create a 1GB volume
fly volumes create flowguard_data --size 1 --region your-region

# Update fly.toml to mount the volume
# Add this to the [mounts] section:
# [[mounts]]
#   source = "flowguard_data"
#   destination = "/data"
```

Edit `backend/fly.toml` and add:

```toml
[mounts]
  source = "flowguard_data"
  destination = "/data"
```

#### Step 5: Deploy

```bash
# Build and deploy
fly deploy

# Watch logs
fly logs

# Check status
fly status
```

#### Step 6: Verify Backend

```bash
# Check health endpoint
curl https://your-app-name.fly.dev/health

# Should return:
# {"status":"ok","service":"flowguard-backend","blockchain":"connected"}
```

### Connecting Frontend to Backend

After both are deployed:

1. **Get your backend URL**: `https://your-app-name.fly.dev`
2. **Update frontend environment variable** in Vercel:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Update `VITE_API_URL` to: `https://your-app-name.fly.dev/api`
3. **Redeploy frontend** (or wait for auto-deploy)

### Updating Split Deployment

**Update Backend:**
```bash
cd backend
git pull
fly deploy
```

**Update Frontend:**
```bash
cd frontend
git pull
# Vercel will auto-deploy if connected to GitHub
# Or manually:
vercel --prod
```

---

## Environment Variables Reference

### Backend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3001` | No |
| `NODE_ENV` | Node environment | `development` | No |
| `BCH_NETWORK` | Bitcoin Cash network | `chipnet` | No |
| `DATABASE_PATH` | SQLite database path | `./database/flowguard.db` | No |

### Frontend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3001/api` | Yes (production) |
| `VITE_BCH_NETWORK` | Bitcoin Cash network | `chipnet` | No |

### Docker Environment Variables

See `env.example` for all Docker-related environment variables.

---

## Troubleshooting

### Docker Compose Issues

**Problem**: Containers won't start

**Solutions**:
1. Check Docker is running: `docker ps`
2. Check logs: `docker-compose logs`
3. Check port conflicts:
   ```bash
   lsof -i :3001  # Backend port
   lsof -i :80    # Frontend port
   ```
4. Rebuild images: `docker-compose build --no-cache`
5. Check `.env` file exists and has correct values

**Problem**: Database errors

**Solutions**:
1. Check volume is created: `docker volume ls | grep flowguard`
2. Check volume permissions
3. Delete and recreate volume:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

### Render Deployment Issues

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) troubleshooting section.

### Fly.io Deployment Issues

**Problem**: Backend won't start

**Solutions**:
1. Check logs: `fly logs`
2. Check secrets: `fly secrets list`
3. Check volume is mounted: `fly ssh console` then `ls /data`
4. Verify `fly.toml` configuration

**Problem**: Database not persisting

**Solutions**:
1. Verify volume exists: `fly volumes list`
2. Check volume is mounted in `fly.toml`
3. Verify `DATABASE_PATH` matches mount point

### Vercel Deployment Issues

**Problem**: Frontend can't connect to backend

**Solutions**:
1. Check `VITE_API_URL` is set correctly in Vercel dashboard
2. Verify backend is running: `curl https://your-backend.fly.dev/health`
3. Check CORS settings in backend (should allow Vercel domain)
4. Check browser console for specific errors

**Problem**: Build fails

**Solutions**:
1. Check build logs in Vercel dashboard
2. Verify `package.json` has correct build script
3. Check for TypeScript errors: `cd frontend && pnpm build`
4. Verify all dependencies are in `package.json`

### General Issues

**Problem**: Services can't communicate

**Solutions**:
1. Verify network configuration
2. Check firewall rules
3. Verify environment variables (especially URLs)
4. Check CORS configuration in backend
5. Verify ports are correct

**Problem**: Database locked errors

**Solutions**:
1. Only one instance should access SQLite at a time
2. For production, consider PostgreSQL instead of SQLite
3. Check for multiple backend instances running

---

## Next Steps

After successful deployment:

1. **Test all functionality** on chipnet before mainnet
2. **Set up monitoring** (logs, alerts, uptime checks)
3. **Configure custom domains** (optional)
4. **Set up backups** for database
5. **Plan for mainnet** deployment when ready

---

## Additional Resources

- [Render Deployment Guide](./RENDER_DEPLOYMENT.md) - Detailed Render instructions
- [Docker Documentation](https://docs.docker.com/) - Learn more about Docker
- [Fly.io Documentation](https://fly.io/docs/) - Fly.io guides
- [Vercel Documentation](https://vercel.com/docs) - Vercel guides
