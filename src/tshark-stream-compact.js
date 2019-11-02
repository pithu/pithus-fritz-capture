#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const {
    ChronoUnit, Instant, LocalDateTime, ZoneId, DateTimeFormatter,
} = require('@js-joda/core');
const { Semaphore } = require('await-semaphore');

const ResolveHostNamesByIps = require('./resolve-hostnames-by-ip');

const DATA_DIR = path.join(process.env.WWW_ROOT || "./", "data");

const IP_TO_HOSTNAME_STORE_FILENAME = path.join(DATA_DIR, "ipToHostNameMap.json");

// interval how often data is written to log files
const REPORT_INTERVAL = process.env.REPORT_INTERVAL || 60; // seconds

// file name pattern
const HOUR_FORMAT = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH");
const DAY_FORMAT = DateTimeFormatter.ofPattern('uuuu-MM-dd');
const MONTH_FORMAT = DateTimeFormatter.ofPattern('uuuu-MM');

// helper functions
const isLocalIp = (ip) => {
    if (!ip) return false;
    const parts = ip.split('.');
    return parts[0] === '10' ||
        (parts[0] === '192' && parts[1] === '168') ||
        (parts[0] === '172' && (parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31));
}

const fsExists = async (fileName) => {
    try {
        await fs.access(fileName);
        return true
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false
        }
        throw err;
    }
};

async function readJsonFromFile(fileName) {
    if (await fsExists(fileName)) {
        return JSON.parse(
            await fs.readFile(fileName, 'utf8')
        );
    }
    return null;
}

async function writeJsonToFile(fileName, jsonData) {
    await fs.writeFile(fileName, jsonData, 'utf8');
}

const writeCsvHeader = async (fileName) => {
    if (!await fsExists(fileName)) {
        await fs.appendFile(
            fileName,
            'time\tlocal_ip\tremote_ip\tremote_port\tprotocol\tdownload\tupload\n',
            'utf8'
        );
    }
};

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
async function reportCompact(map, timeFrame) {
    const fileName = path.join(DATA_DIR, `fritz-capture-${timeFrame}.csv`);
    await writeCsvHeader(fileName);

    // sort by timestamp
    const entries = Object.values(map);
    entries.sort((a, b) => a.instant.compareTo(b.instant));

    for (const entry of entries) {
        let line = '';
        line += `${entry.instant.toString()}\t`;
        line += `${entry.localIp}\t`;
        line += `${entry.remoteIp}\t`;
        line += `${entry.remotePort}\t`;
        line += `${entry.protocol}\t`;
        line += `${entry.download}\t`;
        line += `${entry.upload}\n`;
        await fs.appendFile(fileName, line, 'utf8');
    }
}

// report per time frame
async function reportTimeFrame(map, timeFrame) {
    // read file that might already exist for that time frame
    const fileName = path.join(DATA_DIR, `${timeFrame}.json`);
    const data = (await readJsonFromFile(fileName)) || {
        local: {},
        remote: {},
    };

    // add and write data
    for (const entry of Object.values(map)) {
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
    await writeJsonToFile(fileName, JSON.stringify(data));
}

// report
async function report(packets, resolveIps) {
    if (packets.length === 0){
        return;
    }
    // report to timeStamp of first packet
    const firstTimeStamp = LocalDateTime.ofInstant(packets[0].instant, ZoneId.UTC);

    const map = compact(packets);
    await resolveIps(Object.values(map).map(entry => entry.localIp));
    await reportCompact(map, firstTimeStamp.format(MONTH_FORMAT));
    await reportTimeFrame(map, firstTimeStamp.format(HOUR_FORMAT));
    await reportTimeFrame(map, firstTimeStamp.format(DAY_FORMAT));
    await reportTimeFrame(map, firstTimeStamp.format(MONTH_FORMAT));
}

// collect input

function compactProtocols(protocols) {
    return protocols && protocols.split(':').slice(2, 8).join(':')
}

const LineConsumer = async () => {
    const semaphore = new Semaphore(1);
    const { resolveIps } = await ResolveHostNamesByIps({
        storeFileName: IP_TO_HOSTNAME_STORE_FILENAME,
    });

    let lastReportTimestamp;
    let packets = [];

    // truncate to full minutes to prevent overlaps to next hour/ day or month
    const truncate = temporal => temporal.truncatedTo(ChronoUnit.MINUTES);

    const isReportIntervalReached = (timestamp) => {
        if (!lastReportTimestamp) {
            lastReportTimestamp = truncate(timestamp);
            return false
        }
        if (timestamp.epochSecond() - lastReportTimestamp.epochSecond() > REPORT_INTERVAL) {
            lastReportTimestamp = truncate(timestamp);
            return true;
        }
        return false;
    };

    async function flushReport(packet) {
        const _packets = packets.slice(0);
        packets = packet ? [packet] : [];
        const release = await semaphore.acquire();
        try {
            await report(_packets, resolveIps);
        } finally {
            release();
        }
    }

    async function performReport(packet) {
        if (isReportIntervalReached(packet.instant)) {
            await flushReport(packet);
        } else {
            packets.push(packet)
        }
    }

    async function consumeLine(line) {
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

        // filter ip6 packets
        if (!ipSrc || !ipDst) {
            return;
        }

        // in some cases (e.g. ip tunnel) there is more then one ip reported by tshark,
        // we take the last one in that case
        const ipSrcFixed = ipSrc.split(",").slice(-1)[0];
        const ipDstFixed = ipDst.split(",").slice(-1)[0];

        const instant = Instant.parse(timestamp);
        const isUpload = isLocalIp(ipSrcFixed);
        const localIp = isUpload ? ipSrcFixed : ipDstFixed;
        const remoteIp = isUpload ? ipDstFixed : ipSrcFixed;
        const remotePort = isUpload ? (tcpDstPort || udpDstPort) : (tcpSrcPort || udpSrcPort);
        const protocol = compactProtocols(frameProtocols);
        const frameLen = parseInt(frameLength, 10) || 0;

        await performReport({
            instant,
            isUpload,
            localIp,
            remoteIp,
            remotePort,
            frameLen,
            protocol,
        })
     }

    return {
        consumeLine,
        flushReport,
    }
};

async function capture() {
    const lineConsumer = await LineConsumer();

    await fs.mkdir(DATA_DIR,{ recursive: true });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', async function (line) {
        try {
            await lineConsumer.consumeLine(line);
        } catch (err) {
            //  log and swallow all errors
            console.log('unexpected error: ', err)
        }
    });

    rl.on('close', async function () {
        try {
            await lineConsumer.flushReport();
        } catch (err) {
            //  log and swallow all errors
            console.log('unexpected error: ', err)
        }
    });
}

capture();
