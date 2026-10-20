#!/bin/sh
# usage: tools/tune.sh param 'mix' level v1 v2 ...  — one mixed-table batch per value, the tuned level's skill overridden
cd "$(dirname "$0")/.."
param=$1; mix=$2; level=$3; shift 3
for v in "$@"; do
  tag="tune-$param-$v"
  node tools/sim.js "tools/rounds/$tag.json" --games 8 --mix "$mix" --skill "{\"$level\":{\"$param\":$v}}" > "tools/rounds/$tag.log" 2>&1
  { echo "$param=$v  mix $mix"; node tools/report.js "tools/rounds/$tag.json"; } > "tools/rounds/$tag.report.txt"
done
