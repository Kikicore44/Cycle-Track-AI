# 🚴 Cycle Track AI

A full-stack AI-powered menstrual cycle tracking web application built with React, TypeScript, Express, and Google Gemini AI.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript (tsx) |
| Database | SQLite (default) or MySQL |
| AI | Google Gemini API (`@google/genai`) |

---

## ⚡ Quick Setup (Run Locally)

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A Google Gemini API Key → get one free at [aistudio.google.com](https://aistudio.google.com/app/apikey)
- *(Optional)* XAMPP if you want to use MySQL instead of SQLite

---

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Configure environment variables
Create a file named `.env.local` in the root folder with the following content:

```env
# Required: Your Gemini AI API key
GEMINI_API_KEY="your_gemini_api_key_here"

# App URL (use localhost for local development)
APP_URL="http://localhost:3000"

# Database: use "sqlite" (no setup needed) or "mysql"
DB_PROVIDER="sqlite"

# --- Only needed if DB_PROVIDER="mysql" ---
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3306"
MYSQL_USER="root"
MYSQL_PASSWORD=""
MYSQL_DATABASE="cycle_track_ai"
```

> **Tip:** Copy `.env.example` and rename it to `.env.local`, then fill in your API key.

### Step 3 — Run the app
```bash
npm run dev
```

### Step 4 — Open in browser
```
http://localhost:3000
```

---

## 🗄️ Database Options

### Option A: SQLite (Recommended for local use — zero setup)
In `.env.local`, set:
```
DB_PROVIDER="sqlite"
```
The database file (`database.sqlite`) will be auto-created in the project root on first run.

### Option B: MySQL (via XAMPP)
1. Start XAMPP → Start **Apache** and **MySQL**
2. Open [phpMyAdmin](http://localhost/phpmyadmin)
3. Create a new database called `cycle_track_ai`
4. In `.env.local`, set:
```
DB_PROVIDER="mysql"
MYSQL_USER="root"
MYSQL_PASSWORD=""
MYSQL_DATABASE="cycle_track_ai"
```

---

## 📁 Project Structure

```
cycle-track-ai/
├── src/
│   ├── App.tsx              # Main customer-facing app
│   ├── AppContext.tsx        # Global state management
│   ├── CalendarView.tsx     # Calendar component
│   ├── ChatView.tsx         # AI chat interface
│   ├── translations.ts      # Multi-language support
│   ├── main.tsx             # App entry point
│   ├── index.css            # Global styles
│   ├── admin/
│   │   ├── AdminApp.tsx     # Admin dashboard
│   │   ├── adminApi.ts      # Admin API calls
│   │   ├── adminStorage.ts  # Admin auth storage
│   │   └── useAdminRouter.ts
│   └── services/
│       └── geminiService.ts # Gemini AI integration
├── server.ts                # Express backend (all API routes)
├── index.html               # App shell
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.local               # ← You create this (not committed to git)
```

---

## 🔐 Admin Panel

Access the admin dashboard at:
```
http://localhost:3000/admin
```

The first admin account is created during initial setup via an invite code configured in `.env.local` with `ADMIN_INVITE_CODE`.

---

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Type-check with TypeScript |

---

## 🌐 Features

- 📅 Menstrual cycle tracking with calendar view
- 🤖 AI-powered insights via Google Gemini
- 🌙 Dark/light theme support
- 🌍 Multi-language support (English & Nepali)
- 👤 User authentication
- 🛡️ Admin dashboard for user management
- 📊 Cycle data analytics
- 📄 PDF export
- 🔔 Push notifications
