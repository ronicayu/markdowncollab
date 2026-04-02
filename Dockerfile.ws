FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ws-server.mjs server/ws-server.mjs

ENV HOST=0.0.0.0
ENV PORT=8080
ENV YPERSISTENCE=/data/yjs

EXPOSE 8080

CMD ["node", "server/ws-server.mjs"]
