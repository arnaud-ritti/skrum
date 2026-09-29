# syntax=docker/dockerfile:1

ARG PHP_VERSION=8.4
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS node

FROM dunglas/frankenphp:1-php${PHP_VERSION}-bookworm AS base

ARG S6_OVERLAY_VERSION=3.2.1.0
ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libcap2-bin xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN install-php-extensions bcmath intl opcache pcntl pdo_pgsql zip \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

RUN case "${TARGETARCH}" in \
        amd64) s6_arch=x86_64 ;; \
        arm64) s6_arch=aarch64 ;; \
        *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" | tar -C / -Jxp \
    && curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${s6_arch}.tar.xz" | tar -C / -Jxp

WORKDIR /app

FROM base AS build

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --no-autoloader --prefer-dist

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN mkdir -p storage/app/private storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/testing storage/framework/views storage/logs \
    && composer dump-autoload --no-dev --optimize --classmap-authoritative \
    && npm run build \
    && cp vendor/laravel/octane/src/Commands/stubs/frankenphp-worker.php public/frankenphp-worker.php \
    && rm -rf node_modules resources/js/actions resources/js/routes resources/js/wayfinder storage/framework/views/*

FROM base AS runtime

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    SERVER_NAME=:80 \
    S6_BEHAVIOUR_IF_STAGE2_FAILS=2 \
    S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
    S6_KILL_GRACETIME=10000

COPY --from=build --chown=www-data:www-data /app /app
COPY docker/s6-rc.d /etc/s6-overlay/s6-rc.d
COPY docker/scripts /etc/s6-overlay/scripts
COPY docker/healthcheck /usr/local/bin/skrum-healthcheck

RUN chmod +x /etc/s6-overlay/scripts/* /etc/s6-overlay/s6-rc.d/*/run /usr/local/bin/skrum-healthcheck \
    && setcap CAP_NET_BIND_SERVICE=+eip /usr/local/bin/frankenphp \
    && mkdir -p /data/caddy /config/caddy \
    && chown -R www-data:www-data /data /config

EXPOSE 80 443 443/udp
VOLUME ["/data", "/config"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD ["skrum-healthcheck"]

ENTRYPOINT ["/init"]
CMD []
