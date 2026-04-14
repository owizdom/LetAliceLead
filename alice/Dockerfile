FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --omit=optional

COPY src ./src

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
