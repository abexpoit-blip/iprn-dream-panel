FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG VITE_SELF_HOSTED=true
ARG VITE_API_URL=https://panel.nexus-x.site/api
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
ENV VITE_API_URL=$VITE_API_URL
# Run build and verify output directory
RUN npm run build && ls -R .output/server

FROM node:20-alpine
WORKDIR /app
# TanStack Start / Nitro typically outputs to .output
COPY --from=build /app/.output ./.output
COPY --from=build /app/package*.json ./
# No need to reinstall everything in the final image if using standalone output
# but keeping it simple for now to ensure all deps are there
RUN npm install --production --legacy-peer-deps
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Entry point for Nitro/TanStack Start is usually .output/server/index.mjs
CMD ["node", ".output/server/index.mjs"]
