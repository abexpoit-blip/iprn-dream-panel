#!/bin/bash

echo "--- Stopping all Nexus services ---"
if [ -d "deployment" ]; then
    cd deployment && docker-compose down --rmi all --volumes --remove-orphans
    cd ..
fi

echo "--- Cleaning up project directory ---"
# We keep the script itself for a moment to finish execution, or just delete everything else
find . -mindepth 1 -not -name 'cleanup_nexus.sh' -delete

echo "--- Cleanup complete ---"
echo "All files and containers have been removed. You can now delete this script and the /opt/nexus directory if desired."
