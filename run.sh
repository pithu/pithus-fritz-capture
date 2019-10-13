#!/bin/bash

# start web server
service nginx start

# source capture logic
source ./fritz-capture.sh

# cracefully shutdown
trap stopCapture SIGTERM

# start capture
startCapture | ./tshark-stream-add-timestamp.js - | ./tshark-stream-compact.js - > $WWW_ROOT/data/fritz-capture.csv
