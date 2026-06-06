#!/bin/bash

echo "--- Stopping all Nexus services ---"
cd /opt/nexus/deployment 2>/dev/null && docker-compose down --rmi all --volumes --remove-orphans

echo "--- Cleaning up project directory ---"
rm -rf /opt/nexus/*
rm -rf /opt/nexus/.* 2>/dev/null

echo "--- Cleanup complete ---"
echo "All files and containers have been removed. We are ready for a fresh start when you have your new domain."
