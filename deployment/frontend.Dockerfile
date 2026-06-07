FROM node:22-alpine as build
WORKDIR /app

# Enable Nitro node-server preset
ENV NITRO_PRESET=node-server

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

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
