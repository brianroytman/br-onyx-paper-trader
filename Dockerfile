FROM node:24-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY client/package*.json ./client/
RUN npm ci --prefix client

COPY . .
RUN npm run build --prefix client \
 && npm run build

ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
