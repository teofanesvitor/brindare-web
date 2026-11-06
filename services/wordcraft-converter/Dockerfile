FROM node:22-bookworm-slim

ARG WORDCRAFT_VERSION=0.16.0
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl fonts-liberation fonts-noto-core \
    && curl -fsSL "https://github.com/storytold/wordcraft/releases/download/v${WORDCRAFT_VERSION}/wordcraft-${WORDCRAFT_VERSION}-linux-x86_64.deb" -o /tmp/wordcraft.deb \
    && apt-get install -y /tmp/wordcraft.deb \
    && rm -f /tmp/wordcraft.deb && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.mjs ./server.mjs
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.mjs"]
