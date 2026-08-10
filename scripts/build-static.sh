#!/usr/bin/env bash
# Assembles the static half for Netlify.
#
# "No build step" in the PRD means no bundler and no transpiler — the client is
# plain ES modules, served exactly as authored. This is a file copy, so that the
# deploy contains the site and not node_modules, the test suite, the task graph
# and the PRD.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist
cp index.html host.html dist/
mkdir -p dist/src
cp -R src/client dist/src/client
cp -R src/core dist/src/core

# The static site and the game server live on different hosts, so the client has
# to be told where the server is. Written as a plain script tag rather than
# bundled in, so there is still no compile stage between source and browser.
# Empty is fine: the room path then degrades to "that room isn't running", and
# solo — the journey almost everyone takes — never needed a server at all.
cat > dist/config.js <<CONFIG
window.__SOUP_SERVER__ = "${SOUP_SERVER_URL:-}";
CONFIG

echo "dist/ assembled:"
find dist -type f | sort | sed 's/^/  /'
