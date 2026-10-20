#!/bin/sh
# usage: tools/ladder.sh tag 'hard:1,easy:5' ['hard:1,normal:5' ...] — mixed-table batches into tools/rounds/<tag>-N.json + report
cd "$(dirname "$0")/.."
tag=$1; shift; i=0
for mix in "$@"; do
  i=$((i+1))
  node tools/sim.js "tools/rounds/$tag-$i.json" --games 8 --mix "$mix" > "tools/rounds/$tag-$i.log" 2>&1
  { echo "mix $mix"; node tools/report.js "tools/rounds/$tag-$i.json"; } > "tools/rounds/$tag-$i.report.txt"
done
