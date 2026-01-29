#!/bin/bash

total=$(grep -c '"passes":' specs/prd-v1.json)
done=$(grep -c '"passes": true' specs/prd-v1.json)
percent=$((done * 100 / total))

echo "$done/$total tasks complete ($percent%)"
