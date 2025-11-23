# Deploying FlowGuard to Render

This guide walks you through deploying FlowGuard to Render using Docker. Render is a cloud platform that makes deploying applications easy - perfect for beginners!

## Table of Contents

- [What is Render?](#what-is-render)
- [Prerequisites](#prerequisites)
- [Quick Start (Recommended)](#quick-start-recommended)
- [Manual Deployment](#manual-deployment)
- [Post-Deployment Setup](#post-deployment-setup)
- [Updating Your Deployment](#updating-your-deployment)
- [Troubleshooting](#troubleshooting)
- [Cost Considerations](#cost-considerations)

---

## What is Render?

Render is a cloud platform (like Heroku) that:
- Automatically builds and deploys your code from GitHub
- Provides free SSL certificates
- Handles Docker containers
- Offers persistent storage for databases
- Has a free tier to get started

**Why Render?**
- ✅ Easy to use (great for beginners)
- ✅ Free tier available
- ✅ Automatic deployments from GitHub
- ✅ Built-in Docker support
- ✅ Persistent storage for SQLite

---

## Prerequisites

Before you start, make sure you have:

1. **GitHub Account** - [Sign up at github.com](https://github.com)
2. **Render Account** - [Sign up at render.com](https://render.com) (free)
3. **Your Code on GitHub** - FlowGuard repository pushed to GitHub

### Step 0: Push Code to GitHub

If you haven't already:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Create a repository on GitHub, then:
git remote add origin https://github.com/yourusername/flowguard.git
git branch -M main
git push -u origin main
```

---

## Quick Start (Recommended)

This is the easiest way to deploy FlowGuard. Render will automatically detect your `render.yaml` file and set everything up.

### Step 1: Go to Render Dashboard

1. Visit [dashboard.render.com](https://dashboard.render.com)
2. Sign in (or create an account if you don't have one)
3. Click the **"New +"** button in the top right
4. Select **"Blueprint"** from the dropdown

### Step 2: Connect Your Repository

1. Click **"Connect account"** if you haven't connected GitHub yet
2. Authorize Render to access your GitHub repositories
3. Select your GitHub account
4. Find and select the **`flowguard`** repository
5. Click **"Connect"**

### Step 3: Review Configuration

Render will automatically detect the `render.yaml` file in your repository and show you:

- **Backend Service** (`flowguard-backend`)
- **Frontend Service** (`flowguard-frontend`)

Review the configuration:
- **Region**: Choose closest to your users (e.g., Oregon, Frankfurt)
- **Plan**: Free tier is fine to start
- **Environment Variables**: Will be set from `render.yaml`

### Step 4: Deploy

1. Click **"Apply"** at the bottom
2. Render will start building both services
3. This takes 5-10 minutes the first time
4. You'll see build logs in real-time

### Step 5: Wait for Deployment

You'll see two services being created:
1. **flowguard-backend** - Building Docker image, starting server
2. **flowguard-frontend** - Building Docker image, starting nginx

**What's happening:**
- Render is building Docker images from your Dockerfiles
- Installing dependencies
- Building the applications
- Starting the services

**Expected time:** 5-10 minutes for first deployment

### Step 6: Get Your URLs

Once deployment completes, you'll see:
- **Backend URL**: `https://flowguard-backend.onrender.com`
- **Frontend URL**: `https://flowguard-frontend.onrender.com`

**Important:** Note these URLs down - you'll need them!

### Step 7: Update Frontend API URL

The frontend needs to know where the backend is:

1. Go to Render Dashboard
2. Click on **"flowguard-frontend"** service
3. Go to **"Environment"** tab
4. Find `VITE_API_URL` variable
5. Update it to: `https://flowguard-backend.onrender.com/api`
   - Replace `flowguard-backend` with your actual backend service name
6. Click **"Save Changes"**
7. Render will automatically redeploy the frontend

### Step 8: Verify Deployment

**Check Backend:**
```bash
# Visit in browser or use curl:
curl https://flowguard-backend.onrender.com/health
```

Expected response:
```json
{"status":"ok","service":"flowguard-backend","blockchain":"connected"}
```

**Check Frontend:**
- Visit `https://flowguard-frontend.onrender.com` in your browser
- You should see the FlowGuard dashboard
- Try connecting a wallet (make sure it's on chipnet!)

**That's it!** Your app is now live on Render! 🎉

---

## Manual Deployment

If you prefer to set up services manually (or if Blueprint doesn't work), follow these steps:

### Deploy Backend

#### Step 1: Create Web Service

1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository (if not already connected)
3. Select the **`flowguard`** repository

#### Step 2: Configure Backend Service

Fill in the following:

- **Name**: `flowguard-backend`
- **Region**: Choose closest to your users (e.g., Oregon)
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend` (important!)
- **Runtime**: `Docker`
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `./backend`

#### Step 3: Set Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `BCH_NETWORK` | `chipnet` |
| `DATABASE_PATH` | `/opt/data/flowguard.db` |

#### Step 4: Add Persistent Disk

1. Scroll down to **"Disks"** section
2. Click **"Add Disk"**
3. Configure:
   - **Name**: `flowguard-data`
   - **Mount Path**: `/opt/data`
   - **Size**: `1 GB` (can increase later)

This disk stores your SQLite database and persists across deployments.

#### Step 5: Set Health Check

- **Health Check Path**: `/health`

This helps Render know when your service is ready.

#### Step 6: Deploy

1. Click **"Create Web Service"**
2. Wait for build to complete (5-10 minutes)
3. Note the service URL (e.g., `https://flowguard-backend.onrender.com`)

### Deploy Frontend

#### Step 1: Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Select the same **`flowguard`** repository

#### Step 2: Configure Frontend Service

Fill in:

- **Name**: `flowguard-frontend`
- **Region**: Same as backend (e.g., Oregon)
- **Branch**: `main`
- **Root Directory**: `frontend` (important!)
- **Runtime**: `Docker`
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `./frontend`

#### Step 3: Set Environment Variables

Add these variables:

| Key | Value |
|-----|-------|
| `FRONTEND_PORT` | `80` |
| `VITE_API_URL` | `https://flowguard-backend.onrender.com/api` |
| `VITE_BCH_NETWORK` | `chipnet` |

**Important:** Replace `flowguard-backend` with your actual backend service name!

#### Step 4: Set Health Check

- **Health Check Path**: `/`

#### Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for build to complete
3. Note the frontend URL

---

## Post-Deployment Setup

### Update Frontend API URL

After backend is deployed, update frontend:

1. Go to **flowguard-frontend** service
2. **Environment** tab
3. Update `VITE_API_URL` to your backend URL
4. Save (frontend will auto-redeploy)

### Verify Everything Works

1. **Backend Health**: Visit `https://your-backend.onrender.com/health`
2. **Frontend**: Visit `https://your-frontend.onrender.com`
3. **Test Wallet Connection**: Connect a chipnet wallet
4. **Test Vault Creation**: Create a test vault

### Set Up Custom Domain (Optional)

1. Go to service → **"Settings"** → **"Custom Domains"**
2. Add your domain (e.g., `flowguard.example.com`)
3. Follow DNS configuration instructions
4. Render provides free SSL certificates automatically

---

## Updating Your Deployment

### Automatic Updates

By default, Render auto-deploys when you push to the `main` branch:

```bash
# Make changes
git add .
git commit -m "Update: description of changes"
git push origin main

# Render will automatically:
# 1. Detect the push
# 2. Build new Docker images
# 3. Deploy the updates
```

### Manual Deploy

To deploy a specific branch or commit:

1. Go to service in Render Dashboard
2. Click **"Manual Deploy"**
3. Select branch or commit
4. Click **"Deploy"**

### Disable Auto-Deploy

If you want to deploy manually:

1. Go to service → **"Settings"**
2. Find **"Auto-Deploy"** section
3. Toggle off **"Auto-Deploy"**

---

## Troubleshooting

### Backend Won't Start

**Symptoms**: Backend service shows "Failed" or keeps restarting

**Solutions**:

1. **Check Logs**:
   - Go to service → **"Logs"** tab
   - Look for error messages
   - Common issues:
     - Database path incorrect
     - Missing environment variables
     - Port conflicts

2. **Verify Environment Variables**:
   - Go to **"Environment"** tab
   - Make sure all required variables are set:
     - `PORT=3001`
     - `BCH_NETWORK=chipnet`
     - `DATABASE_PATH=/opt/data/flowguard.db`

3. **Check Persistent Disk**:
   - Go to **"Disks"** tab
   - Verify disk is mounted at `/opt/data`
   - Check disk has space

4. **Verify Health Check**:
   - Make sure `/health` endpoint works
   - Check health check path is set correctly

### Frontend Can't Connect to Backend

**Symptoms**: Frontend loads but shows API errors, wallet connection fails

**Solutions**:

1. **Check VITE_API_URL**:
   - Go to frontend service → **"Environment"**
   - Verify `VITE_API_URL` is set to: `https://your-backend.onrender.com/api`
   - Must include `/api` at the end!
   - Must use `https://` (not `http://`)

2. **Verify Backend is Running**:
   ```bash
   curl https://your-backend.onrender.com/health
   ```
   Should return: `{"status":"ok",...}`

3. **Check CORS**:
   - Backend should allow all origins (check `backend/src/index.ts`)
   - If CORS errors in browser console, backend CORS config might be wrong

4. **Check Browser Console**:
   - Open browser DevTools (F12)
   - Go to **Console** tab
   - Look for specific error messages
   - Common: Network errors, CORS errors, 404 errors

### Build Fails

**Symptoms**: Build shows errors in Render logs

**Solutions**:

1. **Check Dockerfile**:
   - Verify Dockerfile exists in correct location
   - Check Dockerfile syntax
   - Make sure Dockerfile path is correct in service settings

2. **Check Dependencies**:
   - Verify `package.json` has all dependencies
   - Check `pnpm-lock.yaml` is committed
   - Try building locally: `cd backend && docker build -t test .`

3. **Check Build Logs**:
   - Go to service → **"Logs"** tab
   - Look for specific error messages
   - Common issues:
     - Missing dependencies
     - TypeScript errors
     - Build command failures

4. **Verify Root Directory**:
   - Backend: Should be `backend`
   - Frontend: Should be `frontend`

### Database Issues

**Symptoms**: Database errors, data not persisting

**Solutions**:

1. **Check Persistent Disk**:
   - Go to service → **"Disks"** tab
   - Verify disk exists and is mounted
   - Check mount path matches `DATABASE_PATH` (`/opt/data`)

2. **Verify DATABASE_PATH**:
   - Should be `/opt/data/flowguard.db`
   - Must match disk mount path

3. **Check Disk Space**:
   - Go to **"Metrics"** tab
   - Check disk usage
   - Free tier has 1 GB limit

4. **Reset Database** (⚠️ loses data):
   - Delete the persistent disk
   - Create a new one
   - Redeploy service

### Service Sleeps After Inactivity

**Symptoms**: Service works but goes to sleep after 15 minutes of inactivity

**Cause**: Free tier services sleep after 15 minutes of inactivity

**Solutions**:

1. **Upgrade to Paid Plan**: Paid plans don't sleep
2. **Use Uptime Monitoring**: Set up external monitoring to ping your service
3. **Accept the Delay**: First request after sleep takes ~30 seconds to wake up

### Slow Performance

**Symptoms**: Requests are slow, especially first request

**Solutions**:

1. **Free Tier Limitations**: Free tier has limited resources
   - Consider upgrading to paid plan
2. **Check Service Status**: Go to **"Metrics"** tab
   - Check CPU and memory usage
3. **Database Optimization**: SQLite can be slow with many records
   - Consider PostgreSQL for production (requires migration)

---

## Cost Considerations

### Free Tier

Render's free tier includes:
- ✅ 750 hours/month of service time
- ✅ 100 GB bandwidth/month
- ✅ 1 GB persistent disk
- ✅ Free SSL certificates
- ⚠️ Services sleep after 15 min inactivity
- ⚠️ Limited CPU and memory

**Good for**: Development, testing, low-traffic demos

### Paid Plans

Paid plans offer:
- ✅ No sleep on inactivity
- ✅ More CPU and memory
- ✅ Larger persistent disks
- ✅ Better performance
- ✅ Priority support

**Good for**: Production applications, high traffic

### Cost Estimate

- **Starter Plan**: ~$7/month per service
- **Standard Plan**: ~$25/month per service
- **Pro Plan**: ~$85/month per service

For FlowGuard, you'd need:
- 1 backend service (Starter: $7/month)
- 1 frontend service (Starter: $7/month)
- **Total**: ~$14/month for starter plans

---

## Next Steps

After successful deployment:

1. ✅ **Test all functionality** on chipnet
2. ✅ **Set up monitoring** (Render has built-in metrics)
3. ✅ **Configure custom domain** (optional)
4. ✅ **Set up backups** (export database regularly)
5. ✅ **Plan for mainnet** when ready

---

## Additional Resources

- [Render Documentation](https://render.com/docs) - Official Render docs
- [Docker Documentation](https://docs.docker.com/) - Learn Docker
- [FlowGuard Deployment Guide](./DEPLOYMENT.md) - Other deployment options

---

## Quick Reference

**Backend Service:**
- Name: `flowguard-backend`
- Root Directory: `backend`
- Runtime: Docker
- Health Check: `/health`
- Disk: `/opt/data` (1 GB)

**Frontend Service:**
- Name: `flowguard-frontend`
- Root Directory: `frontend`
- Runtime: Docker
- Health Check: `/`
- Environment: `VITE_API_URL` must point to backend

**Common Commands:**
- View logs: Service → Logs tab
- Update env vars: Service → Environment tab
- Manual deploy: Service → Manual Deploy
- Check status: Service → Metrics tab

---

**Need Help?** Check the [Troubleshooting](#troubleshooting) section or open an issue on GitHub!
