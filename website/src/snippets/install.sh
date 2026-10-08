curl -O https://raw.githubusercontent.com/arnaud-ritti/skrum/main/compose.production.yaml
curl -o .env https://raw.githubusercontent.com/arnaud-ritti/skrum/main/.env.production.example
docker run --rm --entrypoint php ghcr.io/arnaud-ritti/skrum:0.0.2 artisan key:generate --show
docker compose -f compose.production.yaml up -d
