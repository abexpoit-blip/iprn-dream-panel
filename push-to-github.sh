#!/bin/bash
# Commands to push your local changes to the new GitHub repo

git remote add origin https://github.com/abexpoit-blip/my-awesome-panel.git
git branch -M main
git add .
git commit -m "Migration to self-hosted VPS architecture"
git push -u origin main
