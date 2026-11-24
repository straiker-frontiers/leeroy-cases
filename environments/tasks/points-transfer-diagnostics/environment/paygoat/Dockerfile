FROM node:22-bookworm@sha256:e13726ca604184d7a91fcacab1fc09eefd642dc28e79ac34e85540dd93b78cfb
WORKDIR /app
COPY player/PAYGoat/backend/package.json ./
RUN npm install --omit=dev
COPY player/PAYGoat/backend/ ./
COPY paygoat/live.db ./database/paygoat.db
RUN chown -R node:node /app
USER node
CMD ["node", "server.js"]
