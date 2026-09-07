#!/bin/sh
set -eu

mkdir -p /app/public/uploads
# Standalone image may leave /app/public owned by root; nextjs must read fonts/assets.
chown -R nextjs:nodejs /app/public

echo "Starting MUBS M&E..."
exec su-exec nextjs node server.js
