# Cloudflare D1 Integration Guide for Student Report Card SaaS

This project has been upgraded with **Cloudflare D1 (Serverless SQL Database)** support for fast, global, zero-maintenance data persistence.

---

## 🚀 Quick Setup Instructions

### Step 1: Install Wrangler CLI (if not already installed)
```bash
npm install -D wrangler
```

### Step 2: Authenticate with Cloudflare
```bash
npx wrangler login
```

### Step 3: Create a Cloudflare D1 Database
Run the following command to create your D1 database:
```bash
npx wrangler d1 create report-card-d1
```
*Take note of the `database_id` output by Wrangler.*

---

## 🗄️ Executing the SQL Schema

### Local Testing (Emulated D1):
```bash
npx wrangler d1 execute report-card-d1 --local --file=./schema.sql
```

### Production Remote Database:
```bash
npx wrangler d1 execute report-card-d1 --remote --file=./schema.sql
```

---

## ⚙️ Configuration

1. **`wrangler.json`**:
   Replace `"REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID"` with your actual D1 `database_id`.

2. **`.env`**:
   Copy `.env.example` to `.env` and fill in:
   ```env
   CLOUDFLARE_ACCOUNT_ID="your_account_id"
   CLOUDFLARE_D1_DATABASE_ID="your_d1_database_id"
   CLOUDFLARE_API_TOKEN="your_api_token"
   ```

---

## 🏃 Running the Application

### Development Server:
```bash
npm run dev
```
Visit `http://localhost:3000/api/d1/health` in your browser to verify D1 connection status!

### Deploying to Cloudflare Workers / Pages:
```bash
npx wrangler deploy
```

---

## 📊 Database Structure

* **`schools`**: School profiles, branding JSON, grading rules.
* **`students`**: Student records, class & section details.
* **`student_grades`**: Marks, subject scores, teacher & AI remarks.
* **`school_sync_data`**: Fast JSON document backup for cross-device state synchronization.
* **`users`**: System administrators, teachers, and parent roles.
