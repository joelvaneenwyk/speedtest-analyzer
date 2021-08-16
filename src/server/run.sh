#!/usr/bin/env bash

echo "[run.sh] Initializing system."

_script="${BASH_SOURCE[0]}"
_script_path="$(realpath "$_script")"
_script_home="$(cd "$(dirname "$_script_path")" &>/dev/null && cd ../ && pwd)"
echo "Speedtest root: '$_script_home'"
echo "NGINX web root: '$NGINX_WEB_ROOT'"

# Create a default configuration override if one does not exist
if [ ! -f "$_script_home/data/config.js" ]; then
    cp -f "$_script_home/js/config.template.js" "$_script_home/data/config.js"
fi

_crontab="$HOME/.config/crontab"
mkdir -p "$(dirname "$_crontab")"
echo "${CRONJOB_ITERATION:-15} * * * * $_script_home/scripts/runSpeedtest.py>/dev/stdout 2>&1" >"$_crontab"
crontab "$_crontab"

echo "Starting Cronjob..."
crond -l 2 -f &

echo "Starting nginx..."

/docker-entrypoint.sh nginx -g "daemon off;"

echo "Speedtest has started and server is running."
exit 0
