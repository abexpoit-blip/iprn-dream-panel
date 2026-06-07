FROM node:22-alpine as build
WORKDIR /app

# Enable Nitro node-server preset
ENV NITRO_PRESET=node-server

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_SELF_HOSTED=true
ARG VITE_API_URL=https://x.nexus-x.site/api
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
ENV VITE_API_URL=$VITE_API_URL

# Build the app
RUN ./node_modules/.bin/vite build

# Verify Nitro output
RUN ls -la .output/server/index.mjs || (echo "Nitro output not found" && ls -R .output && exit 1)


FROM node:22-alpine
WORKDIR /app

# Copy the Nitro output
COPY --from=build /app/.output ./.output
COPY --from=build /app/package*.json ./

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Nitro node-server entry point
CMD ["node", ".output/server/index.mjs"]
