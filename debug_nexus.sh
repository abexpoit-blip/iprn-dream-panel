#!/bin/bash

echo "--- 1. SYSTEM STATUS ---"
uname -a
free -m
df -h

echo -e "\n--- 2. DOCKER STATUS ---"
docker --version
docker-compose --version
docker ps -a

echo -e "\n--- 3. CONTAINER LOGS (Last 50 lines) ---"
cd /opt/nexus/deployment
docker-compose logs --tail=50

echo -e "\n--- 4. NETWORK CHECKS ---"
curl -I http://localhost:3000 || echo "Frontend unreachable on port 3000"
curl -I http://localhost:3005/health || echo "API unreachable on port 3005"
netstat -tulpn | grep -E '80|443|3000|3005'

echo -e "\n--- 5. SSL / NGINX CHECKS ---"
ls -l /etc/letsencrypt/live/panel.nexus-x.site/
nginx -t 2>&1 || echo "Nginx config test failed (if running locally)"

echo -e "\n--- 6. DATABASE CONNECTIVITY ---"
docker exec nexus_db pg_isready -U nexus
