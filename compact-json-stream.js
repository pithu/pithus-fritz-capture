#!/usr/bin/env node

const JSONStream = require('JSONStream');
const es = require('event-stream');

let packets = [];

function isLocalIp(ip) {
    return ip && ip.startsWith('192.168.2.');
}

function parseSrcPort(layers) {
    if (layers.tcp) return layers.tcp['tcp.srcport'];
    if (layers.udp) return layers.udp['udp.srcport'];
}

function parseDstPort(layers) {
    if (layers.tcp) return layers.tcp['tcp.dstport'];
    if (layers.udp) return layers.udp['udp.dstport'];
}

function parseBytes(layers) {
    // if (layers.tcp) return parseInt(layers.tcp['tcp.len'], 10);
    // if (layers.udp) return parseInt(layers.udp['udp.length'], 10);
    return parseInt(layers.frame['frame.len'], 10);
}

function truncateProtocols(protocols) {
    return protocols && protocols.split(':').slice(0, 8).join(':')
}

process.stdin
    .pipe(JSONStream.parse('*..layers'))
    .pipe(es.mapSync(function (layers) {
        if (!layers.ip) {
            // console.error('unknown packet', layers);
            return
        }
        const packet = {
           frame_number: layers.frame['frame.number'],
           frame_protocols: layers.frame['frame.protocols'],
           frame_time_epoch: layers.frame['frame.time_epoch'],
           bytes: parseBytes(layers),
           ip_src: layers.ip['ip.src'],
           ip_dst: layers.ip['ip.dst'],
           ip_src_port: parseSrcPort(layers),
           ip_dst_port: parseDstPort(layers),
        };
        packets.push(packet);
    }));

function compact() {
    const map = {};
    for (const packet of packets) {
        const isUpload = isLocalIp(packet.ip_src);
        const localIp = isUpload ? packet.ip_src : packet.ip_dst;
        const remoteIp = isUpload ? packet.ip_dst : packet.ip_src;
        const remotePort = isUpload ? packet.ip_dst_port : packet.ip_src_port;
        const protocol = truncateProtocols(packet.frame_protocols);
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
            map[key].upload += packet.bytes;
        } else {
            map[key].download += packet.bytes;
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

