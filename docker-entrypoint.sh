#!/bin/sh
set -eu

mkdir -p /app/public/uploads
chown -R nextjs:nodejs /app/public/uploads

echo "Starting MUBS M&E..."
exec su-exec nextjs node server.js
