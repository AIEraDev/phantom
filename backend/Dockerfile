FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy tsconfig files first (cache bust)
COPY tsconfig.json tsconfig.build.json ./

# Copy source
COPY src ./src

# Build with relaxed config (no unused var errors)
RUN npx tsc -p tsconfig.build.json

# Expose port
EXPOSE 3001

# Run migrations, seed data, and start server
CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts && npx tsx src/db/seedSkillTree.ts && node dist/index.js"]
