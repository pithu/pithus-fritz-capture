#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { promisify } = require('util');
const { Resolver } = require('dns');

const { Instant, ZonedDateTime, ZoneId, DateTimeFormatter } = require('@js-joda/core');

const WWW_ROOT = process.env.WWW_ROOT || "";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

// compact packets
function compact(packets) {
    const map = {};
    for (const packet of packets) {
        const {
            instant,
            isUpload,
            localIp,
            remoteIp,
            remotePort,
            frameLen,
            protocol,
        } = packet;

        const key = `${localIp}:${remoteIp}:${remotePort}:${protocol}`;
        if (!map[key]) {
            map[key] = {
                instant,
                localIp,
                remoteIp,
                remotePort,
                protocol,
                download: 0,
                upload: 0,
            }
        }

        if (isUpload) {
            map[key].upload += frameLen;
        } else {
            map[key].download += frameLen;
        }
    }
    return map;
}

// raw reporting
let isHeaderPrinted = false;
function printHeader() {
    if (!isHeaderPrinted) {
        isHeaderPrinted = true;
        console.log('time\tlocal_ip\tremote_ip\tremote_port\tprotocol\tdownload\tupload\t');
    }
}
function reportCompact(map) {
    printHeader();

    for (const entry of Object.values(map)) {
        let line = '';
        line += `${entry.instant.toString()}\t`;
        line += `${entry.localIp}\t`;
        line += `${entry.remoteIp}\t`;
        line += `${entry.remotePort}\t`;
        line += `${entry.protocol}\t`;
        line += `${entry.download}\t`;
        line += `${entry.upload}\t`;
        console.log(line);
    }
}

// report per time frame
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

function reportTimeFrame(map, formatter) {
    const entries = Object.values(map);
    if (!entries || entries.length === 0) {
        return;
    }

    // detect time frame by a random entry of the current interval
    const instant = entries[0].instant;
    const timeFrame = ZonedDateTime.ofInstant(instant, ZoneId.UTC).format(formatter);

    // read file that might already exist for that time frame
    const fileName = path.join(WWW_ROOT, `${timeFrame}.json`);
    const data = readJsonFromFile(fileName);

    // add and write data
    for (const entry of entries) {
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

const HOUR_FORMAT = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH");
const DAY_FORMAT = DateTimeFormatter.ofPattern('uuuu-MM-dd');
const MONTH_FORMAT = DateTimeFormatter.ofPattern('uuuu-MM');

// reverse lookup ips
const ipToHostNameDataFileName  = path.join(WWW_ROOT, "ipToHostNameMap.json");
function readIpToHostNameData() {
    if (fs.existsSync(ipToHostNameDataFileName)) {
        const jsonData = fs.readFileSync(ipToHostNameDataFileName, 'utf8');
        return  new Map(JSON.parse(jsonData))
    }
    return new Map()
}

function writeIpToHostNameData(ipToHostNameMap) {
    fs.writeFileSync(ipToHostNameDataFileName, JSON.stringify([...ipToHostNameMap]), 'utf8');
}

const resolver = new Resolver();
const DNS_SERVER = process.env.DNS_SERVER || '192.168.2.1';
resolver.setServers([DNS_SERVER]);
const ipToHost = (ip, cb) => resolver.reverse(ip, cb);
const reverseAsync = promisify(ipToHost);
async function resolveLocalHostNames(map) {
    const ipToHostNameMap = readIpToHostNameData();
    for (const entry of Object.values(map)) {
        if (!ipToHostNameMap.has(entry.localIp)) {
            try {
                const hostNames = await reverseAsync(entry.localIp);
                ipToHostNameMap.set(entry.localIp, hostNames[0]);
            } catch (err) {
                ipToHostNameMap.set(entry.localIp, 'unresolved');
            }
        }
    }
    writeIpToHostNameData(ipToHostNameMap);
}

// report
async function report(packets) {
    const map = compact(packets);
    await resolveLocalHostNames(map);
    reportCompact(map);
    reportTimeFrame(map, HOUR_FORMAT);
    reportTimeFrame(map, DAY_FORMAT);
    reportTimeFrame(map, MONTH_FORMAT);
}

// collect input
let lastTimestamp;
const LOG_INTERVAL = 10; // seconds
function isReportIntervalReached(timestamp) {
    if (!lastTimestamp) {
        lastTimestamp = timestamp;
        return false
    }
    if (timestamp.epochSecond() - lastTimestamp.epochSecond() > LOG_INTERVAL) {
        lastTimestamp = timestamp;
        return true;
    }
    return false;
}

function isLocalIp(ip) {
    if (!ip) return false;
    var parts = ip.split('.');
    return parts[0] === '10' ||
        (parts[0] === '192' && parts[1] === '168') ||
        (parts[0] === '172' && (parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31));
}

function compactProtocols(protocols) {
    return protocols && protocols.split(':').slice(2, 8).join(':')
}

let packets = [];
rl.on('line', async function(line){
    const [
        timestamp,
        frameLength,
        frameProtocols,
        ipSrc,
        ipDst,
        tcpSrcPort,
        tcpDstPort,
        udpSrcPort,
        udpDstPort,
    ] = line.split('\t');

    const instant = Instant.parse(timestamp);
    const isUpload = isLocalIp(ipSrc);
    let localIp = isUpload ? ipSrc : ipDst;
    let remoteIp = isUpload ? ipDst : ipSrc;
    const remotePort = isUpload ? (tcpDstPort || udpDstPort) : (tcpSrcPort || udpSrcPort);
    const protocol = compactProtocols(frameProtocols);
    const frameLen = parseInt(frameLength, 10) || 0;

    // filter ip6 packets
    if (!localIp || !remoteIp || !remotePort) {
        return;
    }

    // in some cases there is more then one ip reported by tshark, we take the last one in that case
    localIp = localIp.split(",").slice(-1)[0];
    remoteIp = remoteIp.split(",").slice(-1)[0];

    packets.push({
        instant,
        isUpload,
        localIp,
        remoteIp,
        remotePort,
        frameLen,
        protocol,
    });

    if (isReportIntervalReached(instant)) {
        await report(packets);
        packets = []
    }
});
