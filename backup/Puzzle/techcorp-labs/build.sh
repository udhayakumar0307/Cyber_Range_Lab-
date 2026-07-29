#!/bin/bash
set -e

echo "=== Building TechCorp Sysadmin Labs Docker Image ==="

# Build image (provision.sh runs inside Dockerfile now)
docker build -t techcorp-sysadmin-labs:latest .

echo "Image built successfully!"
docker images | grep techcorp

echo "Build complete!"