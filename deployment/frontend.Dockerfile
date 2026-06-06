FROM node:22-alpine as build
WORKDIR /app

# Enable Nitro node-server preset to ensure .output is created
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production

COPY package*.json ./
# Use npm install to generate local binaries
RUN npm install --legacy-peer-deps

COPY . .

# Ensure vite and other binaries are in the path
ENV PATH="/app/node_modules/.bin:${PATH}"

ARG VITE_SELF_HOSTED=true
ARG VITE_API_URL=https://X.nexus-x.site/api
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
ENV VITE_API_URL=$VITE_API_URL

# Run build and verify output
RUN npm run build && ls -la .output || (echo "Build failed to create .output directory" && ls -la && exit 1)

FROM node:22-alpine
WORKDIR /app

# Build output is in .output/ for TanStack Start
COPY --from=build /app/.output ./.output
COPY --from=build /app/package*.json ./

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# The server entry point is in .output/server/index.mjs
CMD ["node", ".output/server/index.mjs"]
