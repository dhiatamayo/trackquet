# Trackquet — Deployment Plan

---

## Current Stack

| Layer | Technology |
|---|---|
| Backend | Go + Gin + GORM |
| Database | SQLite (file-based, single-user) |
| Frontend | React + Vite (static files) |
| Auth | None (single-user local app) |

> **Key constraint:** SQLite cannot serve multiple concurrent users. It has no concurrent write support and lives on the filesystem. Migrating to PostgreSQL is the prerequisite for any deployment.

---

## Rollout Roadmap

```
Now             Phase 1              Phase 2              Phase 3
────────────────────────────────────────────────────────────────►
SQLite          Postgres + Render    Multi-user auth      Autoscale
local only      free tier            ~$14/mo              ~$30–44/mo
                (demo / pitch)       (beta users)         (real growth)
```

---

## Phase 1 — Free Tier (Solo Demo)

**Goal:** Get a live URL at zero cost to demo and pitch.

### Architecture

```
Browser
  └─► Render.com  ─── Static Site  (React frontend)
  └─► Render.com  ─── Web Service  (Go backend)
                          └─► Render.com PostgreSQL (free, 256 MB)
```

### Required Code Changes

#### 1. Swap SQLite → PostgreSQL

GORM makes this a one-line driver swap in `backend/database/db.go`:

```go
import "gorm.io/driver/postgres"

dsn := os.Getenv("DATABASE_URL") // injected by Render automatically
db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
```

```bash
go get gorm.io/driver/postgres
# remove: go get gorm.io/driver/sqlite
```

#### 2. Read config from environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Full Postgres connection string (injected by host) |
| `PORT` | HTTP listen port (injected by host) |
| `ALLOWED_ORIGINS` | Frontend URL, used for CORS |

#### 3. Dockerfile (backend)

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o trackquet-server .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/trackquet-server .
EXPOSE 8080
CMD ["./trackquet-server"]
```

#### 4. Frontend — point API to deployed backend

Update `vite.config.ts` so the API base URL is read from an env variable at build time, instead of the hard-coded `localhost:8080` proxy.

### Hosting — Render.com Free Tier

| Service | Limits | Cost |
|---|---|---|
| Web Service (Go backend) | 512 MB RAM, **spins down after 15 min idle** | **$0** |
| Static Site (React frontend) | Unlimited bandwidth | **$0** |
| PostgreSQL | 256 MB storage, **expires after 90 days** | **$0** |
| **Total** | | **$0 / month** |

### Free Tier Limitations

- **Cold starts** — backend takes ~30 seconds to wake up after 15 min of no traffic
- **PostgreSQL 90-day expiry** — you must recreate (or upgrade) the DB instance every 90 days
- **No custom domain** — URL will be `trackquet.onrender.com`

---

## Phase 2 — Small Beta (10–50 Users)

**Goal:** Onboard real users after pitching. Needs multi-user accounts and an always-on backend.

### New Features Required

#### Multi-user authentication

| What | Detail |
|---|---|
| `users` table | `id`, `email`, `password_hash`, `created_at` |
| JWT middleware | Protect all `/api` routes |
| Ownership | Add `user_id` foreign key to `racquets` — every racquet belongs to one user |
| Frontend pages | Login and Register screens |

#### Architecture

```
Browser
  └─► Cloudflare  (free CDN + SSL)
        └─► Render Starter  ─── Go backend  (always-on, 512 MB RAM)
                                  └─► Render PostgreSQL Starter  (1 GB, persistent)
```

### Cost Breakdown

| Service | Plan | Cost |
|---|---|---|
| Go backend | Render Starter (always-on) | $7 / mo |
| PostgreSQL | Render Starter (1 GB, no expiry) | $7 / mo |
| Frontend | Render Static / Cloudflare Pages | $0 |
| SSL + CDN | Cloudflare free tier | $0 |
| **Total** | | **~$14 / month** |

### Docker Compose (local dev with Postgres)

```yaml
version: '3.9'
services:

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: trackquet
      POSTGRES_USER: trackquet
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://trackquet:secret@db:5432/trackquet
      PORT: 8080
    ports:
      - "8080:8080"
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

---

## Phase 3 — Growth (50–500+ Users)

**Goal:** Production-grade setup with autoscaling, backups, and monitoring.

### Architecture

```
Browser
  └─► Cloudflare  (CDN, WAF, DDoS protection)
        └─► Railway / Fly.io / DigitalOcean App Platform
              ├─► Go backend  (2+ replicas, autoscale on CPU/memory)
              └─► PostgreSQL managed  (daily backups, PgBouncer connection pooling)
```

### Cost Breakdown

| Service | Railway | DigitalOcean |
|---|---|---|
| Backend (2 replicas) | ~$20 / mo | ~$24 / mo |
| PostgreSQL managed | ~$10 / mo | ~$15 / mo |
| Object storage (exports, avatars) | ~$0–5 / mo | ~$5 / mo |
| Monitoring (Sentry + Grafana Cloud) | $0 | $0 |
| **Total** | **~$30 / mo** | **~$44 / mo** |

### Additional Engineering Work at This Stage

| Task | Why |
|---|---|
| **Database migrations** (golang-migrate or Atlas) | GORM `AutoMigrate` is safe for dev, risky in production |
| **Rate limiting** | Gin middleware — protect `/api/sessions` from spam/abuse |
| **Structured logging** (zerolog or zap) | Searchable logs for debugging production issues |
| `GET /health` endpoint | Required by all container orchestrators and load balancers |
| **Backup strategy** | `pg_dump` cron, or use managed DB automatic backups |
| **CI/CD pipeline** (GitHub Actions) | Auto-build and deploy on push to `main` |

---

## Immediate Next Steps (to unlock Phase 1)

1. [ ] `go get gorm.io/driver/postgres` — add the Postgres driver
2. [ ] Swap the DB driver in `backend/database/db.go`
3. [ ] Read `DATABASE_URL` and `PORT` from environment variables
4. [ ] Write `backend/Dockerfile`
5. [ ] Update frontend API base URL to use an env variable
6. [ ] Create a Render account, deploy:
   - Frontend → **Static Site**
   - Backend → **Web Service** (point to `backend/Dockerfile`)
   - Database → **PostgreSQL** (free, attach to backend)
7. [ ] Share the live `trackquet.onrender.com` URL when pitching
