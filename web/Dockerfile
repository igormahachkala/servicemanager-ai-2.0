FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install \
  && chmod +x node_modules/.bin/*

COPY . .

ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN chmod +x node_modules/.bin/* \
  && npm run build

EXPOSE 4173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
