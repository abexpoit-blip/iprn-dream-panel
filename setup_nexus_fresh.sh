#!/bin/bash

# Configuration
DOMAIN="X.nexus-x.site"
PROJECT_DIR="/opt/nexus"
EMAIL="admin@nexus-x.site"

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root"
  exit
fi

echo "--- 1. Creating Project Structure ---"
mkdir -p $PROJECT_DIR/deployment/nginx/conf.d
mkdir -p $PROJECT_DIR/deployment/certbot/www

echo "--- 2. Setting Up Nginx Config ---"
# Create temporary HTTP-only config for SSL challenge
cat << NGINX_EOF > $PROJECT_DIR/deployment/nginx/conf.d/default.conf
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
NGINX_EOF

echo "--- 3. Starting Nginx for SSL Challenge ---"
# Use a temporary nginx container to serve the challenge
docker run -d --name temp_nginx \
  -v "$PROJECT_DIR/deployment/nginx/conf.d:/etc/nginx/conf.d" \
  -v "$PROJECT_DIR/deployment/certbot/www:/var/www/certbot" \
  -p 80:80 \
  nginx:alpine

echo "--- 4. Obtaining SSL Certificate ---"
docker run -it --rm --name certbot \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -v "$PROJECT_DIR/deployment/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email --non-interactive

# Stop temporary nginx
docker stop temp_nginx
docker rm temp_nginx

echo "--- 5. Setting Up Final Nginx Config ---"
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

echo "--- Setup Complete ---"
echo "Next steps:"
echo "1. git clone https://github.com/abexpoit-blip/my-awesome-panel /opt/nexus"
echo "2. cp $PROJECT_DIR/deployment/.env.example $PROJECT_DIR/deployment/.env"
echo "3. cd $PROJECT_DIR/deployment && docker-compose up -d --build"
