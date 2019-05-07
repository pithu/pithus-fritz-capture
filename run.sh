#!/bin/bash

# start apache
service apache2 start

# start capture
./fritz-capture.sh | ./compact-json-stream.js > /var/www/html/fritz-dump.csv