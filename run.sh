#!/bin/bash

# start apache
service nginx start

# start capture
./fritz-capture.sh | ./tshark-stream-add-timestamp.js - | ./tshark-stream-compact.js - > $WWW_ROOT/fritz-capture.csv
