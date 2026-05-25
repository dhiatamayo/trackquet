# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

# CGO needed for sqlite (local dev fallback); disabled for postgres-only builds
# We keep CGO off since Render uses PostgreSQL exclusively.
ENV CGO_ENABLED=0 GOOS=linux

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o trackquet-server .

# ── Stage 2: minimal runtime ─────────────────────────────────────────────────
FROM alpine:3.20

WORKDIR /app
COPY --from=builder /app/trackquet-server .

EXPOSE 8080
CMD ["./trackquet-server"]
