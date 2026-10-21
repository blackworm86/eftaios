#!/bin/sh
# usage: tools/marconi8.sh tag skillJSON [games] — 8 hard players on Marconi (the table of the game the user reported)
cd "$(dirname "$0")/.."
tag=$1; skill=$2; games=${3:-32}
node tools/sim.js "tools/rounds/m8-$tag.json" --games "$games" --maps marconi --players 8 --levels hard --skill "$skill" > "tools/rounds/m8-$tag.log" 2>&1
{ echo "$tag skill $skill"; node tools/report.js "tools/rounds/m8-$tag.json"; } > "tools/rounds/m8-$tag.report.txt"
