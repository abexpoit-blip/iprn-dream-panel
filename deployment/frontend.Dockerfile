FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
# Clean install to avoid cache issues
RUN npm install --legacy-peer-deps
COPY . .
ARG VITE_SELF_HOSTED=true
ARG VITE_API_URL=https://panel.nexus-x.site/api
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine
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
