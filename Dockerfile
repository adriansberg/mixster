FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build app
RUN pnpm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "build"]
