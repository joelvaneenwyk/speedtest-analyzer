#!/usr/bin/env bash

_speedtest_root="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" &>/dev/null && cd ../ && pwd)"
_speedtest_script="$_speedtest_root/scripts/runSpeedtest.py"

printf "##[cmd] python '%s'\n" "$_speedtest_script"
python "$_speedtest_script"
