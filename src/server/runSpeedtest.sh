#!/usr/bin/env bash

_speedtest_root="$(cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")" &>/dev/null && cd ../../ && pwd)"
python3 "$_speedtest_root/src/server/runSpeedtest.py"
