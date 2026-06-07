#!/bin/bash

# Nexus Deployment & Health Check Script
# This script automates the update process and verifies service stability.

set -e # Exit on error

echo "🚀 Starting Nexus Update..."

# 1. Pull latest changes from GitHub
echo "📥 Pulling latest code..."
git pull origin main

# 2. Enter deployment directory
cd deployment

# 3. Rebuild and restart services
echo "🏗️ Rebuilding containers (this may take a minute)..."
docker compose up -d --build

# 4. Verification Loop
echo "🔍 Verifying service health..."
MAX_RETRIES=15
RETRY_COUNT=0
HEALTHY=false

until [ $RETRY_COUNT -ge $MAX_RETRIES ]
do
    echo "Checking status (Attempt $((RETRY_COUNT+1))/$MAX_RETRIES)..."
    
    # Check if any containers are 'Restarting' or 'Exited'
    STATUS=$(docker compose ps --format json | grep -v "running" | grep -v "starting" || true)
    
    if [ -z "$STATUS" ] || [ "$STATUS" == "[]" ]; then
        echo "✅ All services are UP and Running!"
        HEALTHY=true
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT+1))
    sleep 5
done

if [ "$HEALTHY" = false ]; then
    echo "❌ Some services failed to start correctly."
    docker compose ps
    echo "Showing logs for failing services..."
    docker compose logs --tail=20
    exit 1
fi

echo "✨ Update Complete! Site is live at: https://x.nexus-x.site"
