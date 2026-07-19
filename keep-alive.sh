#!/bin/bash
# Keep-alive script for Render free tier.
# Pings the backend health endpoint every 5 minutes to prevent spin-down.
# Run with: bash keep-alive.sh &
# Or deploy as a cron job / GitHub Actions scheduled workflow.

URL="https://trackquet-backend.onrender.com/health"
INTERVAL=300  # 5 minutes in seconds

echo "🏓 Keep-alive started — pinging $URL every ${INTERVAL}s"

while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null)
  echo "$(date '+%Y-%m-%d %H:%M:%S') — ping: HTTP $STATUS"
  sleep $INTERVAL
done
