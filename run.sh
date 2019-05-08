#!/bin/bash

# start apache
service nginx start

# start capture
./fritz-capture.sh | compact-tshark-stream.js > $WWW_ROOT/fritz-dump.csv