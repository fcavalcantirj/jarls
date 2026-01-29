#!/bin/bash
# Usage: ./ralph-simple.sh <iterations>

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

echo "Claude processes running:"
ps aux | grep -i claude | grep -v grep | awk '{print "  PID:", $2, "CMD:", substr($0, index($0,$11))}'
echo ""

for ((i=1; i<=$1; i++)); do
  echo "Iteration: $i"
  echo "---------------------------------------"
  result=$(claude --dangerously-skip-permissions --no-session-persistence -p "@CLAUDE.md @specs/prd-v1.json @specs/progress.txt \
1. Read CLAUDE.md for project guidelines (GOLDEN RULE: no file over 800 lines). \
2. Find the highest-priority feature to work on and work only on that feature. \
3. Check that the tests pass via pnpm test. \
4. Update the PRD (prd-v1.json) with passes = TRUE for the completed feature. \
5. Append your progress to the progress.txt file. \
6. Commit and push. \
ONLY WORK ON A SINGLE FEATURE. Ensure no file exceeds 800 lines - split if needed. \
If, while implementing the feature, you notice the PRD is complete, output <promise>COMPLETE</promise>. \
")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD COMPLETE"
    exit 0
  fi
done
