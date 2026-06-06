FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm install -g ts-node typescript @types/node
EXPOSE 3005
# Use ts-node but we need to check if we can just run it without --commonjs if it's not actually ESM
CMD ["ts-node", "index.ts"]