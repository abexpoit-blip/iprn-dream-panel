FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Use npm install to get dependencies
RUN npm install
COPY . .
# Add required packages for ESM support with ts-node
RUN npm install -g ts-node typescript @types/node
EXPOSE 3005
# Use node --loader to handle ESM TypeScript
CMD ["node", "--loader", "ts-node/esm", "index.ts"]