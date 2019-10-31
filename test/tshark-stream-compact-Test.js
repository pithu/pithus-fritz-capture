const fs = require('fs');
const os = require('os');
const path = require('path');

const { describe, after, it, beforeEach } = require('mocha');
const { expect } = require('chai');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

const _pipe2script = require('./pipe-to-script');

const tsharkStreamCompactScript = './src/tshark-stream-compact.js';

const TEST_DIR = path.join(os.tmpdir(), 'TEST_DATA');
const DATA_DIR = path.join(TEST_DIR, 'data');

describe('tshark-stream-compact-Test', () => {
    const cleanUpDataDir = () => {
        rimraf.sync(TEST_DIR);
        mkdirp.sync(DATA_DIR);
    };

    const buildDataLine = ({
        timestamp, frame_len, frame_protocols, ip_src, ip_dst, tcp_srcport, tcp_dstport, udp_srcport, udp_dstport
    }) =>
        [timestamp, frame_len, frame_protocols, ip_src, ip_dst, tcp_srcport, tcp_dstport, udp_srcport, udp_dstport]
            .join("\t");

    const tcpDownload = (timestamp, frame_len, ip_dst) =>
        buildDataLine({
            timestamp, frame_len, ip_dst,
            frame_protocols: 'tcp',
            ip_src: '128.65.210.180',
            tcp_srcport: '234439',
            tcp_dstport: '443',
        });

    const tcpUpload = (timestamp, frame_len, ip_src) =>
        buildDataLine({
            timestamp, frame_len, ip_src,
            frame_protocols: 'tcp',
            ip_dst: '128.65.210.180',
            tcp_srcport: '234439',
            tcp_dstport: '443',
        });

    const pipe2script = (dataLines, debug = false) =>
        _pipe2script(
            tsharkStreamCompactScript,
            dataLines, {
                env: {
                    'WWW_ROOT': TEST_DIR,
                },
                debug,
            },
        );

    const readJSONFile = fileName =>
        JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), 'utf8'));

    beforeEach(() => {
        cleanUpDataDir();
    });

    after(() => {
        cleanUpDataDir();
    });

    it('should write one hourly report', async () => {
        const dataLines = [
            tcpDownload('2019-10-27T13:40:00.001Z', 1003, '192.168.2.100'),
            tcpUpload('2019-10-27T13:40:01.001Z', 10, '192.168.2.100'),
            tcpDownload('2019-10-27T13:40:02.001Z', 3000, '192.168.2.101'),
            // trigger write, one hour later
            tcpDownload('2019-10-27T14:40:00.000Z', 1001, '192.168.2.100'),
        ];

        await pipe2script(dataLines);

        const hourReport = readJSONFile('2019-10-27T13.json');
        expect(hourReport).to.eql({
            local: {
                '192.168.2.100': { download: 1003, upload: 10 },
                '192.168.2.101': { download: 3000, upload: 0 },
             },
            remote: {
                '128.65.210.180': { download: 4003, upload: 10 }
            },
         })
    })

    it('should write one daily report', async () => {
        const dataLines = [
            tcpDownload('2019-10-27T03:40:00.001Z', 2003, '192.168.2.100'),
            tcpUpload('2019-10-27T14:40:01.001Z', 20, '192.168.2.100'),
            tcpDownload('2019-10-27T14:40:01.101Z', 207, '192.168.2.100'),
            tcpDownload('2019-10-27T23:40:02.001Z', 4000, '192.168.2.101'),
            // trigger write, one day later
            tcpDownload('2019-10-28T14:40:00.000Z', 2001, '192.168.2.100'),
        ];

        await pipe2script(dataLines, false);

        const dailyReport = readJSONFile('2019-10-27.json');
        expect(dailyReport).to.eql({
            local: {
                '192.168.2.100': { download: 2210, upload: 20 },
                '192.168.2.101': { download: 4000, upload: 0 },
             },
            remote: {
                '128.65.210.180': { download: 6210, upload: 20 }
            },
         })
    })
});
