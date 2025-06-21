#!/bin/bash

echo "🚀 Starting deployment process..."

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET is not set"
    exit 1
fi

echo "✅ Environment variables check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Build the application
echo "🏗️ Building application..."
npm run build

echo "✅ Deployment process completed successfully!"
