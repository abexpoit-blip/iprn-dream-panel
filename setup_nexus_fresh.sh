#!/bin/bash

# Configuration
DOMAIN="X.nexus-x.site"
PROJECT_DIR="/opt/nexus"
EMAIL="admin@nexus-x.site"

echo "--- 1. Creating Project Structure ---"
mkdir -p $PROJECT_DIR/deployment/nginx/conf.d
mkdir -p $PROJECT_DIR/deployment/certbot/www

echo "--- 2. Setting Up Nginx Config ---"
cat << 'NGINX_EOF' > $PROJECT_DIR/deployment/nginx/conf.d/default.conf
server {
    listen 80;
    server_name X.nexus-x.site;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name X.nexus-x.site;

    ssl_certificate /etc/letsencrypt/live/X.nexus-x.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/X.nexus-x.site/privkey.pem;

    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://api:3005/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_EOF

echo "--- 3. Obtaining SSL Certificate ---"
# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: docker is not installed. Please install docker and docker-compose first."
    exit 1
fi

docker run -it --rm --name certbot \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -v "$PROJECT_DIR/deployment/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email

echo "--- Setup Complete ---"
echo "The VPS is now prepared for the new domain: $DOMAIN"
echo "Please upload the project files to $PROJECT_DIR and run 'cd $PROJECT_DIR/deployment && docker-compose up -d --build'"
