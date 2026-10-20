#!/bin/sh
# usage: tools/movesweep.sh param level v1 v2 ...  — Alien move quality (tools/moves.js) per value of a skill parameter
cd "$(dirname "$0")/.."
param=$1; level=$2; shift 2
for v in "$@"; do
  node tools/sim.js "tools/rounds/mv-$param-$v.json" --games 4 --players 6 --levels $level --skill "{\"$level\":{\"$param\":$v}}" > "tools/rounds/mv-$param-$v.log" 2>&1
  { echo "$param=$v"; node tools/moves.js "tools/rounds/mv-$param-$v.json"; } > "tools/rounds/mv-$param-$v.txt"
done
echo done > tools/rounds/mvsweep.done
