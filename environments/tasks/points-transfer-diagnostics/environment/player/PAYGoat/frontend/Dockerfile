FROM node:22-bookworm@sha256:e13726ca604184d7a91fcacab1fc09eefd642dc28e79ac34e85540dd93b78cfb AS assets
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps --no-save ajv@8.17.1
COPY . .
RUN npm run build
FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
COPY --from=assets /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
