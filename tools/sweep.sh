#!/bin/sh
# usage: tools/sweep.sh name level skillJSON...  — one batch per value, reports in tools/rounds
cd "$(dirname "$0")/.."
name=$1; level=$2; shift 2
for v in "$@"; do
  tag="$name-$v"
  node tools/sim.js "tools/rounds/$tag.json" --games 8 --players 4,6 --levels $level --skill "{\"$level\":{\"$name\":$v}}" > "tools/rounds/$tag.log" 2>&1
  node tools/report.js "tools/rounds/$tag.json" > "tools/rounds/$tag.report.txt"
done
