# 🎾 Trackquet — Tennis Racquet Usage Tracker

Track the usage of your tennis racquets, log sessions, monitor string wear, and get restringing recommendations.

---

## Project Structure

```
trackquet/
├── backend/          # Go + Gin + GORM + SQLite
│   ├── main.go
│   ├── go.mod
│   ├── models/
│   │   ├── racquet.go
│   │   └── session.go
│   ├── database/
│   │   └── db.go
│   └── handlers/
│       ├── racquet.go
│       └── session.go
└── frontend/         # React + TypeScript + Vite + Tailwind CSS
    ├── src/
    │   ├── App.tsx
    │   ├── pages/
    │   │   ├── Dashboard.tsx
    │   │   └── RacquetDetail.tsx
    │   ├── components/
    │   │   ├── Layout.tsx
    │   │   ├── RacquetCard.tsx
    │   │   ├── UsageBar.tsx
    │   │   ├── AddRacquetModal.tsx
    │   │   └── LogSessionModal.tsx
    │   ├── api/
    │   │   └── client.ts
    │   └── types/
    │       └── index.ts
```

---

## Prerequisites

- **Go** 1.22+
- **Node.js** 18+ with npm

---

## Getting Started

### 1. Backend

```bash
cd backend
go mod tidy      # Download dependencies (first time only)
go run main.go   # Start server on :8080
```

The SQLite database (`trackquet.db`) will be auto-created in the `backend/` folder.

### 2. Frontend

```bash
cd frontend
npm install      # Install dependencies (first time only)
npm run dev      # Start dev server on :5173
```

### Quick start (Windows)

Double-click `start-backend.bat` and `start-frontend.bat` in separate windows.

Open **http://localhost:5173** in your browser.

---

## API Reference

### Racquets

| Method | Endpoint                       | Description                        |
|--------|--------------------------------|------------------------------------|
| GET    | `/api/racquets`                | List all racquets                  |
| POST   | `/api/racquets`                | Create a new racquet               |
| GET    | `/api/racquets/:id`            | Get a racquet with sessions        |
| PUT    | `/api/racquets/:id`            | Update racquet details             |
| DELETE | `/api/racquets/:id`            | Delete a racquet                   |
| POST   | `/api/racquets/:id/restring`   | Reset usage counter (restrung)     |

### Sessions

| Method | Endpoint                                    | Description          |
|--------|---------------------------------------------|----------------------|
| GET    | `/api/racquets/:id/sessions`                | List sessions        |
| POST   | `/api/racquets/:id/sessions`                | Log a new session    |
| DELETE | `/api/racquets/:id/sessions/:sessionID`     | Delete a session     |

### String Presets

| Method | Endpoint               | Description                       |
|--------|------------------------|-----------------------------------|
| GET    | `/api/string-presets`  | List all string presets + thresholds |

---

## Features

- 🎾 **Multiple Racquets** — register and manage as many racquets as you want
- ⏱️ **Session Logging** — log matches and training sessions with duration and notes
- 🪢 **String Tracking** — track string name, tension, and usage hours
- 📊 **Usage Bar** — visual progress bar showing string wear
- ⚠️ **Restring Recommendation** — automatic alerts when strings reach their threshold
- 🔄 **Restring Reset** — reset the counter after restringing
- 🗂️ **10 Built-in String Presets** — popular strings with recommended thresholds

---

## Restring Logic

| Usage %       | Status              |
|---------------|---------------------|
| 0–59%         | ✅ Strings good     |
| 60–84%        | 🟡 Moderate wear    |
| 85–99%        | 🔔 Consider restringing |
| 100%+         | ⚠️ Restring now!   |

Default threshold is **20 hours** for polyester strings (Luxilon, Babolat RPM, etc.) and **30–40 hours** for multifilament/synthetic strings. You can override the threshold per racquet.
