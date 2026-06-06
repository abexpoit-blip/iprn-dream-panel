FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Compile if needed, or run index.ts directly with ts-node/bun
# We'll use ts-node for simplicity in node environment
RUN npm install -g ts-node
EXPOSE 3000
CMD ["ts-node", "index.ts"]
