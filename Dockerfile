FROM oven/bun:1-alpine

WORKDIR /app

# Copy dependency configs
COPY package.json bun.lock ./

# Install dependencies (frozen lockfile, with timeout to avoid hanging)
ENV BUN_CONFIG_NETWORK_TIMEOUT=60000
RUN bun install --frozen-lockfile

# Copy application files
COPY . .

# Set environment variables
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# Start Vite dev server
CMD ["bun", "run", "dev", "--port", "3000", "--host", "0.0.0.0"]
