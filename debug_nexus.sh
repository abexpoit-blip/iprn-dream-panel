#!/bin/bash
set -e

echo "--- 1. SYSTEM STATUS ---"
uname -a
free -m
df -h

echo -e "\n--- 2. DOCKER STATUS ---"
docker --version
docker-compose --version
docker ps -a

echo -e "\n--- 3. CLEANING OLD BUILDS ---"
cd /opt/nexus/deployment
docker-compose down --remove-orphans
docker system prune -f

echo -e "\n--- 4. ATTEMPTING DEPLOYMENT ---"
# Pull latest changes again just in case
git fetch origin
git reset --hard origin/main

# Build and start services
docker-compose up -d --build --force-recreate

echo -e "\n--- 5. CHECKING SERVICE HEALTH ---"
sleep 10
docker-compose ps
docker-compose logs --tail=50

echo -e "\n--- 6. NETWORK CHECKS ---"
# Check if services are listening inside the network
docker exec nexus_api wget -qO- http://localhost:3005/health || echo "API Internal Health Check Failed"
docker exec nexus_frontend wget -qO- http://localhost:3000/ || echo "Frontend Internal Health Check Failed"
