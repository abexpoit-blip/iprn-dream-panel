FROM node:22-alpine as build
WORKDIR /app

# Enable Nitro node-server preset to ensure .output is created
ENV NITRO_PRESET=node-server
# NODE_ENV is set to production later for the runner stage

COPY package*.json ./
# Use npm install to generate local binaries
RUN npm install --legacy-peer-deps

COPY . .

# Ensure vite and other binaries are in the path
ENV PATH="/app/node_modules/.bin:${PATH}"

ARG VITE_SELF_HOSTED=true
ARG VITE_API_URL=https://x.nexus-x.site/api
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
ENV VITE_API_URL=$VITE_API_URL

# Run build and verify output
# TanStack Start with Nitro outputs to dist/server/index.mjs
RUN ./node_modules/.bin/vite build && ls -la dist/server/index.mjs || (echo "Build failed to create dist/server/index.mjs" && ls -la dist/server && exit 1)


FROM node:22-alpine
WORKDIR /app

# The built files are in dist/client and dist/server
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# For self-hosted TanStack Start without Nitro, we need to run the server entry point
# Based on the config, it builds to dist/server/server.js
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0

CMD ["node", "dist/server/index.mjs"]
