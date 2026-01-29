#!/bin/bash

claude --permission-mode acceptEdits "@specs/prd-v1.json @specs/progress.txt \
1. Read the PRD and progress file. \
2. Find the highest-priority feature to work on and work only on that feature.
be the one YOU decide has the highest priority - not necessarily the next incomplete task. \
3. Check that the types check via pnpm typecheck and that the tests pass via pnpm test.
the work that was done. \
4. Update progress.txt with what you did. \
5. Update @specs/prd-v1.json with passes = TRUE for the feature you completed. \
6. Commit your changes. \
7. Push your changes to the repository. \
ONLY DO ONE TASK AT A TIME."