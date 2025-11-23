# Deploying FlowGuard to Render

This guide walks you through deploying FlowGuard to Render using Docker.

## Prerequisites

- A GitHub account with the FlowGuard repository
- A Render account (sign up at [render.com](https://render.com))
- Your repository pushed to GitHub

## Quick Start

### Option 1: Using Render Blueprint (Recommended)

1. **Push your code to GitHub** (if not already done)
   ```bash
   git push origin main
   ```

2. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Click "New +" → "Blueprint"

3. **Connect your repository**
   - Select your GitHub account
   - Choose the `flow-guard` repository
   - Render will detect the `render.yaml` file

4. **Review and deploy**
   - Render will show you the services it will create (backend and frontend)
   - Review the configuration
   - Click "Apply" to deploy

5. **Set environment variables** (if needed)
   - After deployment, you may need to update `VITE_API_URL` in the frontend service
   - Go to the frontend service → Environment → Update `VITE_API_URL` to match your backend URL
   - Format: `https://flowguard-backend.onrender.com/api`

### Option 2: Manual Deployment

#### Deploy Backend

1. **Create a new Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure the service**
   - **Name**: `flowguard-backend`
   - **Region**: Choose closest to your users (e.g., Oregon)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `./backend`

3. **Set environment variables**
   ```
   NODE_ENV=production
   PORT=3001
   BCH_NETWORK=chipnet
   DATABASE_PATH=/opt/data/flowguard.db
   ```

4. **Add persistent disk**
   - Go to "Disks" tab
   - Click "Add Disk"
   - **Name**: `flowguard-data`
   - **Mount Path**: `/opt/data`
   - **Size**: 1 GB (can increase later)

5. **Set health check**
   - **Health Check Path**: `/health`

6. **Deploy**
   - Click "Create Web Service"
   - Wait for build and deployment to complete
   - Note the service URL (e.g., `https://flowguard-backend.onrender.com`)

#### Deploy Frontend

1. **Create a new Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure the service**
   - **Name**: `flowguard-frontend`
   - **Region**: Same as backend (e.g., Oregon)
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `./frontend`

3. **Set environment variables**
   ```
   FRONTEND_PORT=80
   VITE_API_URL=https://flowguard-backend.onrender.com/api
   VITE_BCH_NETWORK=chipnet
   ```
   **Important**: Replace `flowguard-backend` with your actual backend service name.

4. **Set health check**
   - **Health Check Path**: `/`

5. **Deploy**
   - Click "Create Web Service"
   - Wait for build and deployment to complete

## Post-Deployment

### Update Frontend API URL

After the backend is deployed, you need to update the frontend's `VITE_API_URL`:

1. Go to the frontend service in Render Dashboard
2. Navigate to "Environment"
3. Update `VITE_API_URL` to: `https://YOUR-BACKEND-SERVICE.onrender.com/api`
4. Save and redeploy (or wait for auto-deploy)

### Verify Deployment

1. **Check backend health**
   - Visit: `https://YOUR-BACKEND-SERVICE.onrender.com/health`
   - Should return: `{"status":"ok"}`

2. **Check frontend**
   - Visit: `https://YOUR-FRONTEND-SERVICE.onrender.com`
   - Should load the FlowGuard interface

3. **Test wallet connection**
   - Try connecting a wallet
   - Create a test vault on chipnet

## Environment Variables Reference

### Backend Service

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Server port | `3001` |
| `BCH_NETWORK` | Bitcoin Cash network | `chipnet` |
| `DATABASE_PATH` | SQLite database path | `/opt/data/flowguard.db` |

### Frontend Service

| Variable | Description | Default |
|----------|-------------|---------|
| `FRONTEND_PORT` | Nginx port | `80` |
| `VITE_API_URL` | Backend API URL | Must be set to backend URL |
| `VITE_BCH_NETWORK` | Bitcoin Cash network | `chipnet` |

## Persistent Storage

The backend uses a persistent disk mounted at `/opt/data` to store the SQLite database. This ensures your data persists across deployments and restarts.

**Important**: The disk is only attached to the backend service. Make sure it's properly configured.

## Auto-Deploy

By default, Render will auto-deploy when you push to the `main` branch. You can:

- **Disable auto-deploy**: Go to service settings → "Auto-Deploy" → Toggle off
- **Manual deploy**: Click "Manual Deploy" → Select branch/commit

## Custom Domains

You can add custom domains to your services:

1. Go to service settings → "Custom Domains"
2. Add your domain
3. Follow DNS configuration instructions
4. Render provides free SSL certificates

## Monitoring

Render provides built-in monitoring:

- **Logs**: View real-time logs in the service dashboard
- **Metrics**: CPU, memory, and request metrics
- **Alerts**: Set up alerts for service health

## Troubleshooting

### Backend won't start

- Check logs in Render Dashboard
- Verify environment variables are set correctly
- Ensure persistent disk is mounted at `/opt/data`
- Check that `DATABASE_PATH` matches the disk mount path

### Frontend can't connect to backend

- Verify `VITE_API_URL` is set correctly (must be full URL with `/api`)
- Check backend is running and healthy
- Verify CORS settings in backend allow your frontend domain
- Check backend logs for connection errors

### Build fails

- Check Dockerfile syntax
- Verify all dependencies are in `package.json`
- Check build logs for specific errors
- Ensure `pnpm-lock.yaml` is committed

### Database issues

- Verify persistent disk is attached and mounted
- Check disk has enough space
- Ensure `DATABASE_PATH` is writable
- Check backend logs for database errors

## Cost Considerations

Render's free tier includes:
- 750 hours/month of service time
- 100 GB bandwidth/month
- 1 GB persistent disk

For production use, consider upgrading to a paid plan for:
- Better performance
- More resources
- No sleep on inactivity (free tier services sleep after 15 min inactivity)

## Next Steps

After deployment:
1. Test all functionality on chipnet
2. Set up monitoring and alerts
3. Configure custom domains (optional)
4. Set up CI/CD for automated deployments
5. Plan for mainnet deployment when ready

