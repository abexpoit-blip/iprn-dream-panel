FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm install -g ts-node typescript @types/node
EXPOSE 3005
CMD ["ts-node", "--commonjs", "index.ts"]