FROM node:20-alpine
RUN npm install -g pnpm@11.8.0

WORKDIR /app

# Copy monorepo configuration
COPY pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY blockchain/package.json ./blockchain/

# Copy the dependency workspaces
COPY blockchain/ ./blockchain/
COPY backend/ ./backend/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
WORKDIR /app/backend
RUN pnpm prisma generate

# Build the typescript files
RUN pnpm run build

EXPOSE 5000

CMD ["pnpm", "start"]
