FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
# Use bun or npm? The project has bun.lockb but package.json has npm scripts.
RUN npm install --legacy-peer-deps
COPY . .
# Set build-time env vars
ARG VITE_SELF_HOSTED=true
ARG VITE_API_URL=https://panel.nexus-x.site/api
ENV VITE_SELF_HOSTED=$VITE_SELF_HOSTED
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/client /usr/share/nginx/html
COPY ./deployment/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
