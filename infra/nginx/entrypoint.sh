#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# MesPapiers — NGINX entrypoint
#
# If mkcert certificates exist in /etc/nginx/certs/, use them (green padlock).
# Otherwise, generate self-signed certs with openssl so that
# `docker compose up` works out of the box for every developer and evaluator.
# ─────────────────────────────────────────────────────────────────────────────

CERT_DIR="/etc/nginx/certs"
CERT_FILE="$CERT_DIR/selfsigned.pem"
KEY_FILE="$CERT_DIR/selfsigned-key.pem"

# If mkcert certs are mounted, symlink them to the names nginx.conf expects
if [ -f "$CERT_DIR/mespapiers.local+1.pem" ] && [ -f "$CERT_DIR/mespapiers.local+1-key.pem" ]; then
    echo "[nginx-entrypoint] mkcert certificates found — using them (green padlock)"
    ln -sf "$CERT_DIR/mespapiers.local+1.pem"     "$CERT_FILE"
    ln -sf "$CERT_DIR/mespapiers.local+1-key.pem"  "$KEY_FILE"
elif [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "[nginx-entrypoint] No certificates found — generating self-signed certs"
    apk add --no-cache openssl > /dev/null 2>&1
    openssl req -x509 -nodes -days 365 \
        -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/CN=mespapiers.local" \
        -addext "subjectAltName=DNS:mespapiers.local,DNS:localhost"
    echo "[nginx-entrypoint] Self-signed certificates generated"
else
    echo "[nginx-entrypoint] Self-signed certificates already exist — reusing"
fi

exec nginx -g "daemon off;"
