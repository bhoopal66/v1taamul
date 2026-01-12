#!/bin/sh
set -e

echo "🚀 Starting Sales Performance Tracker..."

# Start nginx in background
echo "📦 Starting nginx (frontend) on port 3000..."
nginx

# Start API server
echo "🔧 Starting API server on port 4000..."
cd /app/server
node dist/index.js
