#!/bin/bash

export LANGUAGE=en_US.UTF-8
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# start web server
service nginx start

# source capture logic
source ./fritz-capture.sh

# cracefully shutdown
trap "stopCapture; exit 0;" SIGTERM

# stop capturing, might still running
stopCapture

# start capture
startCapture | ./src/tshark-stream-add-timestamp.js - | ./src/tshark-stream-compact.js -
