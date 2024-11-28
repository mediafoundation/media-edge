#!/bin/sh

# Start Caddy in the background
/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile &

# Wait for Caddy to start
sleep 5

# Change permissions of the /var/log/caddy directory
chmod -R 0644 /var/log/caddy

# Wait for Caddy to exit
wait.