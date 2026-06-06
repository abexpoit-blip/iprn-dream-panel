#!/bin/bash
echo "--- SYSTEM INFO ---"
uname -a
docker --version
docker-compose --version

echo -e "\n--- DIRECTORY STRUCTURE ---"
pwd
ls -R /opt/nexus/deployment

echo -e "\n--- DOCKER STATUS ---"
docker ps -a

echo -e "\n--- RECENT CONTAINER LOGS ---"
docker-compose logs --tail=20 frontend
docker-compose logs --tail=20 nginx
docker-compose logs --tail=20 api

echo -e "\n--- NETWORK CONNECTIVITY (inside network) ---"
docker exec nexus_nginx ping -c 2 frontend || echo "Nginx cannot reach Frontend"
docker exec nexus_nginx ping -c 2 api || echo "Nginx cannot reach API"

echo -e "\n--- BUILD ARTIFACT CHECK ---"
docker exec nexus_frontend ls -la /app/.output/server/index.mjs || echo "Frontend server binary missing"
