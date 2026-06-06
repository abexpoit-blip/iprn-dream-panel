FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG VITE_SELF_HOSTED=true
ARG VITE_API_URL=https://panel.nexus-x.site/api
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
ENV VITE_API_URL=$VITE_API_URL
# Run build and list directories to debug exactly where files are going
RUN npm run build && ls -la && ls -la .output || echo ".output not found" && ls -la dist || echo "dist not found"

FROM node:20-alpine
WORKDIR /app
# Based on common TanStack Start / Nitro patterns, it might be in .output or dist
# We will copy the most likely candidate and use a fallback if needed
COPY --from=build /app/dist ./dist
# If .output exists, we want that instead for Nitro
# COPY --from=build /app/.output ./.output
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Fallback to dist/server if .output is missing
CMD ["node", "dist/server/index.mjs"]
