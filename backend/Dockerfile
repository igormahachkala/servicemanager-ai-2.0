FROM node:20

WORKDIR /app

ARG SMA_RELEASE_COMMIT_SHA=local
ARG SMA_RELEASE_ENVIRONMENT=local
ARG SMA_RELEASE_ENFORCE=false

RUN set -eu; \
  case "$SMA_RELEASE_ENFORCE" in true|false) ;; \
    *) echo "SMA_RELEASE_ENFORCE must be true or false" >&2; exit 1 ;; \
  esac; \
  if [ "$SMA_RELEASE_ENFORCE" = "true" ]; then \
    printf '%s' "$SMA_RELEASE_COMMIT_SHA" | grep -Eq '^[0-9a-fA-F]{40}$' \
      || { echo "SMA_RELEASE_COMMIT_SHA must be a full 40 character git SHA for enforced builds" >&2; exit 1; }; \
    case "$SMA_RELEASE_ENVIRONMENT" in beta|prod) ;; \
      *) echo "SMA_RELEASE_ENVIRONMENT must be beta or prod for enforced builds" >&2; exit 1 ;; \
    esac; \
  fi

# SMA-MAX-TLS-001: образ должен нести актуальный набор корневых сертификатов.
# Без него исходящие HTTPS-запросы (опрос MAX) падают с
# UNABLE_TO_GET_ISSUER_CERT_LOCALLY — "unable to get local issuer certificate".
# Блок восстановлен из release B: откат приложения снял его вместе с остальным релизом.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl openssl \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt \
  SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
  SMA_RELEASE_COMMIT_SHA=${SMA_RELEASE_COMMIT_SHA} \
  SMA_RELEASE_ENVIRONMENT=${SMA_RELEASE_ENVIRONMENT}

COPY docker-entrypoint.sh /usr/local/bin/sma-backend-entrypoint.sh
RUN chmod +x /usr/local/bin/sma-backend-entrypoint.sh

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

ENTRYPOINT ["sma-backend-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
