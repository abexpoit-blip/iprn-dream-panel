FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Use a simple ts-node execution without the experimental loader for now
# We'll check the error log again if this fails
RUN npm install -g ts-node typescript @types/node
EXPOSE 3005
CMD ["ts-node", "--transpile-only", "index.ts"]