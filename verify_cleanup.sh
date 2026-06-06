#!/bin/bash

echo "--- 1. Checking Project Directory ---"
if [ -d "/opt/nexus" ]; then
    echo "Directory /opt/nexus still exists. Contents:"
    ls -la /opt/nexus
else
    echo "Directory /opt/nexus is deleted."
fi

echo -e "\n--- 2. Checking Docker Containers ---"
DOCKER_CONTAINERS=$(docker ps -a -q)
if [ -z "$DOCKER_CONTAINERS" ]; then
    echo "No Docker containers found."
else
    echo "Remaining containers:"
    docker ps -a
fi

echo -e "\n--- 3. Checking Docker Images ---"
DOCKER_IMAGES=$(docker images -q)
if [ -z "$DOCKER_IMAGES" ]; then
    echo "No Docker images found."
else
    echo "Remaining images:"
    docker images
fi

echo -e "\n--- 4. Checking Docker Volumes ---"
DOCKER_VOLUMES=$(docker volume ls -q)
if [ -z "$DOCKER_VOLUMES" ]; then
    echo "No Docker volumes found."
else
    echo "Remaining volumes:"
    docker volume ls
fi

echo -e "\n--- 5. Checking SSL Certificates ---"
if [ -d "/etc/letsencrypt/live" ]; then
    echo "Remaining SSL certificates:"
    ls /etc/letsencrypt/live
else
    echo "No SSL certificates found in /etc/letsencrypt/live."
fi
