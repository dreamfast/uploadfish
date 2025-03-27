#!/bin/bash
set -e

echo "🐟 UploadFish Deployment"
echo "======================="
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Stop any existing container
echo "🛑 Stopping existing containers..."
docker compose down 2>/dev/null || true

# Pull latest changes if this is a git repo
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull origin master
fi

# Build and start the containers
echo "🔄 Building and starting containers..."
docker compose build --no-cache
docker compose up -d

# Check if the container is running
if [ "$(docker ps -q -f name=uploadfish)" ]; then
    echo "✅ UploadFish is now running!"
    echo
    echo "🔗 Access your UploadFish instance at: http://localhost:8085"
    echo
    echo "📊 Container health:"
    docker-compose ps
    echo
    echo "📝 To view logs: docker-compose logs -f"
    echo "⏹️  To stop: docker-compose down"
else
    echo "❌ Failed to start UploadFish container."
    echo "📋 Checking logs:"
    docker-compose logs uploadfish
    exit 1
fi
