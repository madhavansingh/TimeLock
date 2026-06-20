FROM node:20-alpine
RUN npm install -g pnpm@11.8.0

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

# Copy source code
COPY . .

# Build the Next.js app
ENV NEXT_PUBLIC_API_URL=http://localhost:5000/v1
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"]
