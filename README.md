# wacrm — Multi-Tenant WhatsApp CRM v2

> Self-hostable CRM for WhatsApp® — shared inbox, contacts, sales pipelines, broadcasts, and no-code automations. Built with Next.js 16, Supabase, and Meta Cloud API.

<p align="center">
  <a href="https://www.hostinger.com/web-apps-hosting?REFERRALCODE=WACRMHOST">
    <img src="./.github/assets/hostinger-deploy.png" alt="Ship your Node.js app in one click — Deploy to Hostinger" width="900">
  </a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](./LICENSE)
[![CI](https://github.com/premmobilitysum/wacrmv2/actions/workflows/ci.yml/badge.svg)](https://github.com/premmobilitysum/wacrmv2/actions/workflows/ci.yml)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ecf8e?logo=supabase)](https://supabase.com)

---

## 📋 Features Out of the Box

- **Shared Inbox**: Official WhatsApp Business API integration — multiple agents, one number, per-conversation assignment, status, and internal notes.
- **Multi-Tenant & Account Scoped**: Support for multiple organizations/tenants with isolated data, custom roles, and team permissions.
- **Contacts & CRM Management**: Tags, custom fields, CSV bulk import, and deduplication.
- **Sales Pipelines**: Interactive Kanban boards with deals linked directly to customer conversations.
- **Broadcasts**: Send Meta-approved template broadcasts with delivery & read tracking, plus dynamic variable substitution.
- **No-Code Automations**: Visual workflow builder triggered by inbound messages, keywords, contacts, or schedules.
- **AI Reply Assistant**: Integrated OpenAI / Anthropic key support (stored encrypted with AES-256-GCM), hybrid knowledge base search, and automated replies with human handoff.
- **Public REST API & MCP Server**: Comprehensive REST API (`/api/v1`) and Model Context Protocol (MCP) server for Claude / Cursor integrations.

---

## ⚡ Quick Start (Local Development)

```bash
# 1. Clone repository
git clone https://github.com/premmobilitysum/wacrmv2.git
cd wacrmv2

# 2. Install dependencies
npm install

# 3. Setup environment configuration
cp .env.local.example .env.local
# Edit .env.local and fill in your Supabase and Meta WhatsApp credentials

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Step-by-Step Deployment on Hostinger

Hostinger provides an excellent environment to host this application. You can deploy it using either **Hostinger Managed Node.js (Web Hosting/Cloud)** or **Hostinger VPS (Ubuntu)**.

### Approach 1: Hostinger Managed Node.js (hPanel)

If you have Hostinger Business, Cloud, or Node.js hosting:

#### Step 1: Push Repository to GitHub
Make sure this repository is pushed to your GitHub account (`https://github.com/premmobilitysum/wacrmv2`).

#### Step 2: Create Node.js Application in hPanel
1. Log into your **Hostinger hPanel**.
2. Navigate to **Websites** → **Create or Add Website**.
3. Select **Node.js** as your environment.
4. Set your domain or subdomain (e.g., `crm.yourdomain.com`).

#### Step 3: Connect Git Repository
1. In the application settings, select **Git Repository Deployment**.
2. Connect your GitHub account and select repository: `premmobilitysum/wacrmv2`.
3. Set the deployment branch to `main`.
4. Enable **Automatic Deployment** so changes pushed to `main` deploy automatically.

#### Step 4: Configure Node.js Runtime & Build Settings
- **Node.js Version**: Select `20.x` or `22.x` (LTS recommended).
- **Application Root Directory**: `/` (root).
- **Build Command**: `npm run build`
- **Start Command / Script**: `npm start` (or `node .next/standalone/server.js`).

#### Step 5: Configure Environment Variables in hPanel
In your Hostinger Node.js Application dashboard, go to the **Environment Variables** section and add the following keys:

| Variable Name | Description | Example / Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key | Found in Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret | Server-only secret key |
| `ENCRYPTION_KEY` | 32-byte hexadecimal key (64 chars) | Generate with `openssl rand -hex 32` |
| `META_APP_SECRET` | Secret from Meta App Dashboard | App Settings → Basic → App Secret |
| `NEXT_PUBLIC_SITE_URL` | Your live production URL | `https://crm.yourdomain.com` |
| `AUTOMATION_CRON_SECRET` | Secret to secure cron endpoints | Random 32+ char secret string |

#### Step 6: Deploy & Verify SSL
1. Click **Deploy** / **Install Dependencies**.
2. Ensure **SSL** is turned ON under hPanel → SSL (Hostinger provides free automatic Let's Encrypt SSL certificates).
3. Test your domain in browser: `https://crm.yourdomain.com`.

#### Step 7: Configure Meta WhatsApp Webhook
1. Go to **Meta for Developers** → Your WhatsApp App → **WhatsApp** → **Configuration**.
2. Set **Callback URL** to:
   ```text
   https://crm.yourdomain.com/api/whatsapp/webhook
   ```
3. Set your **Verify Token** (configured in your WhatsApp settings inside the CRM).
4. Subscribe to the `messages` webhook field.

---

## 🐧 Step-by-Step Deployment on Ubuntu Server / Hostinger VPS

For dedicated VPS installations (Ubuntu 22.04 or 24.04 LTS), you have three production deployment methods:
- **Option 1: Automated CI/CD Pipeline via GitHub Actions (Recommended)**
- **Option 2: Native Setup with PM2, Nginx & Let's Encrypt SSL**
- **Option 3: Containerized Setup with Docker & Docker Compose**

---

### Option 1: Automated CI/CD Pipeline (GitHub Actions)

This repository includes a pre-configured GitHub Actions workflow in [`.github/workflows/deploy-ubuntu.yml`](./.github/workflows/deploy-ubuntu.yml). When you push code to `main`, GitHub Actions automatically connects to your Ubuntu server via SSH, pulls the latest changes, builds the app, and reloads PM2 with zero downtime.

#### Step 1: Prepare Destination Directory on Ubuntu
SSH into your Ubuntu server and run:
```bash
sudo mkdir -p /var/www/wacrm
sudo chown -R $USER:$USER /var/www/wacrm

# Clone repository initially
git clone https://github.com/premmobilitysum/wacrmv2.git /var/www/wacrm
cd /var/www/wacrm

# Create and configure .env.local
cp .env.local.example .env.local
nano .env.local
```

#### Step 2: Configure GitHub Repository Secrets
In your GitHub repository (`premmobilitysum/wacrmv2`):
1. Navigate to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add the following secrets:

| Secret Name | Value |
|---|---|
| `UBUNTU_SERVER_HOST` | Your server's public IP address (e.g. `194.164.72.10`) |
| `UBUNTU_SERVER_USER` | Your SSH user (e.g. `ubuntu` or `root`) |
| `UBUNTU_SSH_PRIVATE_KEY` | Your private SSH key content (`cat ~/.ssh/id_rsa` or `id_ed25519`) |
| `UBUNTU_SSH_PORT` | SSH port (usually `22`) |
| `UBUNTU_DEPLOY_PATH` | Deployment path on server (e.g. `/var/www/wacrm`) |

#### Step 3: Trigger Deployment
Whenever you run `git push origin main`, the GitHub Actions workflow will automatically run, build, and deploy the updated code to your server!

---

### Option 2: Native Production Setup (PM2 + Nginx + Certbot SSL)

#### Step 1: Update Server & Install Node.js 20 LTS
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v
npm -v

# Install PM2 globally
sudo npm install -g pm2
```

#### Step 2: Clone and Setup Application
```bash
sudo mkdir -p /var/www/wacrm
sudo chown -R $USER:$USER /var/www/wacrm
git clone https://github.com/premmobilitysum/wacrmv2.git /var/www/wacrm
cd /var/www/wacrm

# Setup environment variables
cp .env.local.example .env.local
nano .env.local
```

#### Step 3: Install Dependencies & Build
```bash
npm ci
npm run build
```

#### Step 4: Run Application with PM2
```bash
# Start Next.js using PM2
pm2 start npm --name "wacrm" -- start

# Configure PM2 to start automatically on system reboot
pm2 startup
# (Run the generated sudo command shown in terminal output)
pm2 save
```

#### Step 5: Configure Nginx as Reverse Proxy
Create an Nginx server block:
```bash
sudo nano /etc/nginx/sites-available/wacrm
```

Paste the following configuration (replace `crm.yourdomain.com` with your domain):
```nginx
server {
    listen 80;
    server_name crm.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site configuration and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/wacrm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 6: Install Free SSL Certificate (Let's Encrypt / Certbot)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d crm.yourdomain.com
```

#### Step 7: Configure Firewall
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

### Option 3: Docker & Docker Compose Deployment

If you prefer containerized deployment:

```bash
# 1. Clone repository
git clone https://github.com/premmobilitysum/wacrmv2.git
cd wacrmv2

# 2. Copy and configure environment variables
cp .env.local.example .env.local
nano .env.local

# 3. Build and launch container in background
docker compose --env-file .env.local up -d --build
```

The application will be running on port `3000`. You can proxy domain traffic through Nginx or Cloudflare Tunnel.

---

## 🔒 Mandatory Environment Variables Reference

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API endpoint (e.g. `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key with elevated access |
| `ENCRYPTION_KEY` | 64-hex-character string used to encrypt WhatsApp and AI credentials |
| `META_APP_SECRET` | App secret from Meta Developer console |
| `NEXT_PUBLIC_SITE_URL` | Canonical domain of the application (e.g. `https://crm.yourdomain.com`) |
| `NEXT_PUBLIC_APP_LOCALE` | Default language (`en`, `ko`, `pt`, or `es`) |
| `AUTOMATION_CRON_SECRET` | Secret token to authenticate automation cron jobs |

Generate a secure 64-char encryption key anytime using:
```bash
openssl rand -hex 32
```

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, Lucide Icons, Shadcn UI
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security, Auth, Storage)
- **API**: Meta Cloud API (Official WhatsApp Business API)
- **Deployment**: Hostinger (Managed Node.js / VPS), Ubuntu, Docker

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
