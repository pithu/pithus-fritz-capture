#!/usr/bin/env node

const readline = require('readline');
const { Instant } = require('@js-joda/core');

const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
});

rl.on('line', function(line){
    console.log(`${Instant.now().toString()}\t${line}`);
});

