FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG VITE_SELF_HOSTED=true
ARG VITE_API_URL=https://panel.nexus-x.site/api
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
ENV VITE_API_URL=$VITE_API_URL
# The Lovable/TanStack Start build output is in dist/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
# Install only production dependencies if needed for the server
RUN npm install --production --legacy-peer-deps
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
# The standard entry point for TanStack Start SSR is usually dist/server/index.mjs
CMD ["node", "dist/server/index.mjs"]
