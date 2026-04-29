#!/bin/sh
set -eu

secret_file="${AUTH_SECRET_FILE:-/data/auth-secret}"

if [ -z "${AUTH_SECRET:-}" ] || [ "${AUTH_SECRET}" = "change-me-in-production" ]; then
	mkdir -p "$(dirname "$secret_file")"

	if [ ! -s "$secret_file" ]; then
		node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" > "$secret_file"
	fi

	export AUTH_SECRET="$(cat "$secret_file")"
fi

exec "$@"
