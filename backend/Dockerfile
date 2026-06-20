FROM node:20-alpine

RUN npm install -g pnpm@11.8.0

WORKDIR /app

COPY . .

RUN pnpm install

RUN pnpm prisma generate

RUN pnpm run build

EXPOSE 5000

CMD ["pnpm", "start"]