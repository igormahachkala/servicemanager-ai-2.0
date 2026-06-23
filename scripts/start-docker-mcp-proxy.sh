#!/usr/bin/env bash
set -euo pipefail

# Read-only Docker API proxy for AI Developer MCP (observation mode).
# Blocks POST/EXEC/start/stop/restart/remove at the Docker socket layer.

CONTAINER_NAME="${DOCKER_MCP_PROXY_NAME:-sma_docker_mcp_proxy}"
HOST_PORT="${DOCKER_MCP_PROXY_PORT:-2375}"
IMAGE="${DOCKER_MCP_PROXY_IMAGE:-tecnativa/docker-socket-proxy:latest}"

if docker ps --format '{{.Names}}' | rg -qx "$CONTAINER_NAME"; then
  echo "OK: ${CONTAINER_NAME} already running on 127.0.0.1:${HOST_PORT}"
  exit 0
fi

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

docker run -d --name "$CONTAINER_NAME" --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -p "127.0.0.1:${HOST_PORT}:2375" \
  -e POST=0 \
  -e EXEC=0 \
  -e ALLOW_START=0 \
  -e ALLOW_STOP=0 \
  -e ALLOW_RESTARTS=0 \
  -e ALLOW_PAUSE=0 \
  -e ALLOW_UNPAUSE=0 \
  -e BUILD=0 \
  -e COMMIT=0 \
  -e AUTH=0 \
  -e SECRETS=0 \
  -e SWARM=0 \
  -e CONTAINERS=1 \
  -e IMAGES=1 \
  -e NETWORKS=1 \
  -e VOLUMES=1 \
  -e INFO=1 \
  -e EVENTS=1 \
  -e PING=1 \
  -e VERSION=1 \
  "$IMAGE" >/dev/null

echo "OK: ${CONTAINER_NAME} started (read-only) at tcp://127.0.0.1:${HOST_PORT}"
