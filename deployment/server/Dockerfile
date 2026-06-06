FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
# We need production dependencies only for smaller image but for now install all or just copy node_modules
# To be safe, just install production ones
RUN npm install --omit=dev
EXPOSE 3005
CMD ["node", "dist/index.js"]
