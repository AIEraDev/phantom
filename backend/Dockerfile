FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm install typescript tsx --save-dev && npx tsc

# Expose port
EXPOSE 3001

# Run migrations and start
CMD ["sh", "-c", "npx tsx src/db/migrate.ts && node dist/index.js"]
