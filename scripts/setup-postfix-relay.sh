#!/usr/bin/env bash
# Configures Postfix as a local, loopback-only relay client that forwards
# outbound mail through a real SMTP smart host (Gmail, a transactional
# provider, whatever mailbox you set up on your real domain later).
#
# The app itself only ever talks to 127.0.0.1:25 (see src/services/mailer.js)
# — Postfix is the thing that actually authenticates and delivers outward,
# so swapping providers later is just re-running this script with new
# SMTP_RELAY_* values in .env, no app code changes.
#
# Usage: run on the droplet, as root, from the project root:
#   ./scripts/setup-postfix-relay.sh
#
# Requires SMTP_RELAY_HOST, SMTP_RELAY_PORT, SMTP_RELAY_USER, SMTP_RELAY_PASS
# to be set in .env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

if [ "$(id -u)" -ne 0 ]; then
  echo "Must be run as root." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo ".env not found at $ENV_FILE" >&2
  exit 1
fi

get_env() {
  grep "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-
}

SMTP_RELAY_HOST="$(get_env SMTP_RELAY_HOST)"
SMTP_RELAY_PORT="$(get_env SMTP_RELAY_PORT)"
SMTP_RELAY_USER="$(get_env SMTP_RELAY_USER)"
SMTP_RELAY_PASS="$(get_env SMTP_RELAY_PASS)"

if [ -z "$SMTP_RELAY_HOST" ] || [ -z "$SMTP_RELAY_USER" ] || [ -z "$SMTP_RELAY_PASS" ]; then
  echo "SMTP_RELAY_HOST, SMTP_RELAY_USER, and SMTP_RELAY_PASS must be set in .env" >&2
  exit 1
fi
SMTP_RELAY_PORT="${SMTP_RELAY_PORT:-587}"

echo "Installing postfix and mail utilities..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postfix libsasl2-modules mailutils >/dev/null

echo "Configuring Postfix as a loopback-only relay client..."
postconf -e "inet_interfaces = loopback-only"
postconf -e "relayhost = [${SMTP_RELAY_HOST}]:${SMTP_RELAY_PORT}"
postconf -e "smtp_sasl_auth_enable = yes"
postconf -e "smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd"
postconf -e "smtp_sasl_security_options = noanonymous"
postconf -e "smtp_tls_security_level = encrypt"
postconf -e "smtp_tls_wrappermode = no"
postconf -e "header_size_limit = 4096000"

echo "[${SMTP_RELAY_HOST}]:${SMTP_RELAY_PORT} ${SMTP_RELAY_USER}:${SMTP_RELAY_PASS}" > /etc/postfix/sasl_passwd
chmod 600 /etc/postfix/sasl_passwd
postmap /etc/postfix/sasl_passwd
rm -f /etc/postfix/sasl_passwd  # only the .db is needed at runtime

systemctl restart postfix
systemctl enable postfix

echo
echo "Done. Postfix is listening on 127.0.0.1:25 and will relay through ${SMTP_RELAY_HOST}:${SMTP_RELAY_PORT}."
echo "Test with: echo 'test body' | mail -s 'test subject' someone@example.com"
echo "Then check: tail -f /var/log/mail.log"
