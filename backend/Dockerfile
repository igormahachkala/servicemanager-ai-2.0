FROM node:20

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl openssl \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt \
  SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

COPY docker-entrypoint.sh /usr/local/bin/sma-backend-entrypoint
RUN chmod +x /usr/local/bin/sma-backend-entrypoint

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

ENTRYPOINT ["sma-backend-entrypoint"]
CMD ["npm", "run", "start:prod"]
