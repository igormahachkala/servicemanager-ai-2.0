FROM node:20 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install \
  && chmod +x node_modules/.bin/*

COPY . .

ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN chmod +x node_modules/.bin/* \
  && npm run build

FROM nginx:1.24-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 4173
