# 🛡️ FamilyKYCManager - Launch & Deployment Guide

> **Zero-Knowledge Household Document Sentinel & Expiry Alert Vault**

FamilyKYCManager is a production-ready Progressive Web Application (PWA) designed to protect families from identity mismatches, document expiries, and KYC freezes.

---

## ⚡ Quick Start (Instant Local Test)

You can launch and test the app immediately on your machine without installing any complex servers!

1. Open `index.html` in your web browser.
2. Or run a simple local web server:
   ```bash
   npx serve .
   ```
3. Open `http://localhost:3000` in your browser.

---

## 🚀 How to Launch Live on Vercel ($0 Cost)

### Option A: Command Line Launch (Recommended)
Run the following command in this directory:
```bash
npx vercel
```
- Sign in or create a free account at [Vercel](https://vercel.com).
- Vercel will build and assign you a free HTTPS URL (e.g., `https://familysafevault.vercel.app`).

### Option B: Vercel Web Dashboard (Drag & Drop)
1. Go to [vercel.com/new](https://vercel.com/new).
2. Drag and drop this project folder into the browser window.
3. Click **Deploy**. Your app will be live in 10 seconds!

---

## ☁️ Connecting Supabase Cloud Database ($0 Free Tier)

FamilyKYCManager is local-first and works out of the box using browser `localStorage` and `IndexedDB`. To enable multi-device sync, follow these steps:

1. **Create a Free Supabase Project**:
   - Register at [supabase.com](https://supabase.com) (Free Tier).
   - Click **New Project** and select a database password.

2. **Run the Database Schema**:
   - Go to **SQL Editor** in your Supabase Dashboard.
   - Open `supabase-schema.sql` from this folder, copy its contents, and click **Run**.

3. **Link Supabase to your Web App**:
   - Open `supabase-config.js` and set your `SUPABASE_URL` and `SUPABASE_ANON_KEY`:
     ```javascript
     const SUPABASE_URL = "https://your-project-id.supabase.co";
     const SUPABASE_ANON_KEY = "your-anon-key-here";
     ```
   - Re-deploy to Vercel or test locally!

---

## ✨ Built-in Features Included

- **🔒 Client-Side WebCrypto Encryption**: Metadata encrypted before cloud sync.
- **🔍 Client-Side Tesseract OCR**: Drag-and-drop identity document scanning directly in browser.
- **📱 PWA Mobile Installable**: Installable on iPhone/Android via "Add to Home Screen".
- **🌐 Offline-First Capability**: ServiceWorker caching ensures full offline access.
