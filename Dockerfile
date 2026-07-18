FROM oven/bun:1-alpine

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application
COPY . .

# Build the production app
RUN bun run build

ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# Start the production server
CMD ["bun", "run", "start"]