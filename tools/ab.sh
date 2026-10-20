#!/bin/sh
# usage: tools/ab.sh tag 'mix' 'skillJSON' [games]  — a bigger mixed-table batch for a decisive A/B comparison
cd "$(dirname "$0")/.."
tag=$1; mix=$2; skill=$3; games=${4:-32}
node tools/sim.js "tools/rounds/ab-$tag.json" --games "$games" --mix "$mix" --skill "$skill" > "tools/rounds/ab-$tag.log" 2>&1
{ echo "$tag  mix $mix  skill $skill"; node tools/report.js "tools/rounds/ab-$tag.json"; } > "tools/rounds/ab-$tag.report.txt"
