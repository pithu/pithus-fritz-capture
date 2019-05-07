#!/usr/bin/env node

const readline = require('readline');

let packets = []

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

setInterval(() => {
    const map = compact();
    const timestamp = new Date().getTime();

    for (const key of Object.keys(map)) {
        let line = '';
        const entry = map[key];
        line += `${timestamp}\t`;
        line += `${entry.localIp}\t`;
        line += `${entry.remoteIp}\t`;
        line += `${entry.remotePort}\t`;
        line += `${entry.protocol}\t`;
        line += `${entry.download}\t`;
        line += `${entry.upload}\t`;
        console.log(line);
    }
}, 10000);

