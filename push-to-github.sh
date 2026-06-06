#!/bin/bash
# Commands to push your local changes to the new GitHub repo

git add .
git commit -m "Fix: Add legacy-peer-deps to frontend Dockerfile to resolve nitro version conflict"
git push origin main
