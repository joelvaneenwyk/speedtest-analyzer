#!/usr/bin/env bash

echo "[run.sh] Initializing system."

_speedtest_root="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" &>/dev/null && cd ../../ && pwd)"
echo "Speedtest root: '$_speedtest_root'"
echo "NGINX web root: '$NGINX_WEB_ROOT'"

python3 "$_speedtest_root/src/server/runSpeedtest.py" --initialize

# Create a default configuration override if one does not exist
if [ ! -f "$_speedtest_root/html/data/config.js" ]; then
    mkdir -p "$_speedtest_root/html/data"
    cp "$_speedtest_root/src/config/config.template.js" "$_speedtest_root/html/data/config.js"
fi

_crontab="$HOME/.config/crontab"
mkdir -p "$(dirname "$_crontab")"
echo "${CRONJOB_ITERATION:-15} * * * * $_speedtest_root/src/server/runSpeedtest.sh>/dev/stdout 2>&1" >"$_crontab"
crontab "$_crontab"

echo "Starting Cronjob..."
crond -l 2 -f &

echo "Starting nginx..."

/docker-entrypoint.sh nginx -g "daemon off;" "$@"
