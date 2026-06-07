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
COPY --from=build /app/init.sql ./init.sql

# To be safe, just install production ones
RUN npm install --omit=dev
EXPOSE 3005
CMD ["node", "dist/index.js"]
