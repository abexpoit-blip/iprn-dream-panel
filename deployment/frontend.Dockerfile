FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG VITE_SELF_HOSTED=true
ARG VITE_API_URL=https://panel.nexus-x.site/api
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
# We copy node_modules but for TanStack Start, we might need a production install instead
# to ensure all native modules match the runtime environment if any exist.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Add a check to see if the file exists before running
CMD ["sh", "-c", "if [ -f dist/server/index.mjs ]; then node dist/server/index.mjs; else echo 'Error: dist/server/index.mjs not found' && ls -R dist && exit 1; fi"]
