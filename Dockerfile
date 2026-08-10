# The realtime server only. The static half is built separately and served by
# Netlify, so this image carries no client build stage.
FROM oven/bun:1.3-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY index.html host.html config.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["bun", "run", "src/server/index.js"]
