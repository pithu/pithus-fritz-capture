#!/bin/bash

# start apache
service apache2 start

# start capture
./fritz-capture.sh | compact-tshark-stream.js > /var/www/html/fritz-dump.csv