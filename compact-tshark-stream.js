#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ZonedDateTime, DateTimeFormatter } = require('@js-joda/core');

const WWW_ROOT = process.env.WWW_ROOT || "";

let packets = [];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

function isLocalIp(ip) {
    return ip && ip.startsWith('192.168.2.');
}

function truncateProtocols(protocols) {
    return protocols && protocols.split(':')[2]
}

rl.on('line', function(line){
    const [
        frameLen,
        frameProtocols,
        ipSrc,
        ipDst,
        tcpSrcport,
        tcpDstport,
        udpSrcport,
        udpDstport,
    ] = line.split('\t');

    packets.push({
        frameLen: parseInt(frameLen, 10),
        frameProtocols,
        ipSrc,
        ipDst,
        ipSrcPort: tcpSrcport || udpSrcport,
        ipDstPort: tcpDstport || udpDstport,
    });
});

function compact() {
    const map = {};
    for (const packet of packets) {
        const isUpload = isLocalIp(packet.ipSrc);
        const localIp = isUpload ? packet.ipSrc : packet.ipDst;
        const remoteIp = isUpload ? packet.ipDst : packet.ipSrc;
        const remotePort = isUpload ? packet.ipDstPort : packet.ipSrcPort;
        const protocol = packet.frameProtocols && packet.frameProtocols.split(':').slice(2, 8).join(':');
        const key = `${localIp}:${remoteIp}:${remotePort}:${protocol}`;
        if (!map[key]) {
            map[key] = {
                localIp,
                remoteIp,
                remotePort,
                protocol,
                download: 0,
                upload: 0,
            }
        }

        if (isUpload) {
            map[key].upload += packet.frameLen;
        } else {
            map[key].download += packet.frameLen;
        }
    }
    packets = [];
    return map;
}

function printHeader() {
    console.log('time\tlocal_ip\tremote_ip\tremote_port\tprotocol\tdownload\tupload\t');
}

printHeader();

function reportRaw(map, zonedDateTime) {
    for (const key of Object.keys(map)) {
        let line = '';
        const entry = map[key];
        line += `${zonedDateTime.toInstant().toString()}\t`;
        line += `${entry.localIp}\t`;
        line += `${entry.remoteIp}\t`;
        line += `${entry.remotePort}\t`;
        line += `${entry.protocol}\t`;
        line += `${entry.download}\t`;
        line += `${entry.upload}\t`;
        console.log(line);
    }
}

function readJsonFromFile(fileName) {
    if (fs.existsSync(fileName)) {
        const jsonData = fs.readFileSync(fileName, 'utf8');
        return JSON.parse(jsonData);
    }
    return {
        local: {},
        remote: {},
    };
}

function writeJsonToFile(fileName, jsonData) {
    fs.writeFileSync(fileName, jsonData, 'utf8');
}

function reportTimeFrane(map, timeFrame) {
    const fileName = path.join(WWW_ROOT, `${timeFrame}.json`);
    const data = readJsonFromFile(fileName);
    for (const key of Object.keys(map)) {
        const entry = map[key];
        if (!data.local[entry.localIp]) {
            data.local[entry.localIp] = {
                download: 0,
                upload: 0,
            }
        }
        data.local[entry.localIp] = {
            download: data.local[entry.localIp].download + entry.download,
            upload: data.local[entry.localIp].upload + entry.upload,
        };

        if (!data.remote[entry.remoteIp]) {
            data.remote[entry.remoteIp] = {
                download: 0,
                upload: 0,
            }
        }
        data.remote[entry.remoteIp] = {
            download: data.remote[entry.remoteIp].download + entry.download,
            upload: data.remote[entry.remoteIp].upload + entry.upload,
        };
    }
    writeJsonToFile(fileName, JSON.stringify(data));
}

const HOUR_FORMAT = DateTimeFormatter.ofPattern('uuuu-MM-dd-HH');
const DAY_FORMAT = DateTimeFormatter.ofPattern('uuuu-MM-dd');
const MONTH_FORMAT = DateTimeFormatter.ofPattern('uuuu-MM');


function report() {
    const map = compact();
    const zonedDateTime = ZonedDateTime.now();
    reportRaw(map, zonedDateTime);
    reportTimeFrane(map, zonedDateTime.format(HOUR_FORMAT));
    reportTimeFrane(map, zonedDateTime.format(DAY_FORMAT));
    reportTimeFrane(map, zonedDateTime.format(MONTH_FORMAT));
}

setInterval(report, 1000);

