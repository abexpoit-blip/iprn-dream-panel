#!/bin/bash

# Configuration
DOMAIN="X.nexus-x.site"
PROJECT_DIR="/opt/nexus"

echo "--- Preparing Deployment for $DOMAIN ---"

# 1. Create directory if not exists
mkdir -p $PROJECT_DIR

# 2. Extract deployment files (assumes deployment.zip is in current dir or uploaded)
# Since I'm an AI, I'll instruct the user to use the provided zip or I can try to prepare one.
# For now, let's assume the user will run this on the VPS after getting files.

echo "--- Updating docker-compose and configs ---"
# (Files already updated in sandbox, need to be synced to VPS)

echo "--- SSL Certificate Setup ---"
echo "To get SSL certificates, run:"
echo "docker run -it --rm --name certbot \
  -v '/etc/letsencrypt:/etc/letsencrypt' \
  -v '/var/lib/letsencrypt:/var/lib/letsencrypt' \
  -v '$(pwd)/deployment/certbot/www:/var/www/certbot' \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d $DOMAIN --email your-email@example.com --agree-tos --no-eff-email"

echo "--- Building and Starting Services ---"
echo "cd deployment && docker-compose up -d --build"

