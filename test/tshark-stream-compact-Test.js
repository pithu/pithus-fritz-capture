const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const { describe, after, it, beforeEach } = require('mocha');
const { expect } = require('chai');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

const _pipe2script = require('./pipe-to-script');
const ResolveHostNamesByIps = require('../src/resolve-hostnames-by-ip');

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

    const pipe2script = async (dataLines, debug = false) => {
        console.log(await _pipe2script(
            tsharkStreamCompactScript,
            dataLines, {
                env: {
                    'WWW_ROOT': TEST_DIR,
                    'DNS_SERVER': '127.0.0.1',
                },
                debug,
                delay: 10,
            },
        ));
    }

    const readJSONFile = async fileName =>
        JSON.parse(await fs.readFile(path.join(DATA_DIR, fileName), 'utf8'));

    const readFile = async fileName =>
        await fs.readFile(path.join(DATA_DIR, fileName), 'utf8');

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

        const hourReport = await readJSONFile('2019-10-27T13.json');
        expect(hourReport).to.eql({
            local: {
                '192.168.2.100': { download: 1003, upload: 10 },
                '192.168.2.101': { download: 3000, upload: 0 },
             },
            remote: {
                '128.65.210.180': { download: 4003, upload: 10 }
            },
         })
    });

    it('should write one daily report', async () => {
        const dataLines = [
            tcpDownload('2019-10-27T03:40:00.001Z', 2003, '192.168.2.100'),
            tcpUpload('2019-10-27T14:40:01.001Z', 20, '192.168.2.100'),
            tcpDownload('2019-10-27T14:40:01.101Z', 207, '192.168.2.100'),
            tcpDownload('2019-10-27T23:40:02.001Z', 4000, '192.168.2.101'),
            // trigger write, one day later
            tcpDownload('2019-10-28T14:40:00.000Z', 2001, '192.168.2.100'),
        ];

        await pipe2script(dataLines);

        const dailyReport = await readJSONFile('2019-10-27.json');
        expect(dailyReport).to.eql({
            local: {
                '192.168.2.100': { download: 2210, upload: 20 },
                '192.168.2.101': { download: 4000, upload: 0 },
             },
            remote: {
                '128.65.210.180': { download: 6210, upload: 20 }
            },
         })
    });

    it('should write one monthly report', async () => {
        const dataLines = [
            // one month before
            tcpDownload('2019-09-27T03:40:00.001Z', 2003, '192.168.2.101'),

            // this month
            tcpDownload('2019-10-27T03:40:00.001Z', 2003, '192.168.2.100'),
            tcpUpload('2019-10-27T14:40:01.001Z', 20, '192.168.2.100'),
            tcpDownload('2019-10-27T14:40:01.101Z', 207, '192.168.2.100'),
            tcpDownload('2019-10-27T23:40:02.001Z', 4000, '192.168.2.101'),
            tcpDownload('2019-10-28T23:40:02.001Z', 23, '192.168.2.100'),
            tcpUpload('2019-10-29T23:40:02.001Z', 29, '192.168.2.101'),
            tcpUpload('2019-10-29T23:40:02.002Z', 17, '192.168.2.100'),
            tcpDownload('2019-10-30T23:40:02.001Z', 4003, '192.168.2.101'),

            // trigger write, one month later
            tcpDownload('2019-11-28T14:40:00.000Z', 2001, '192.168.2.100'),
        ];

        await pipe2script(dataLines);

        const monthlyReport = await readJSONFile('2019-10.json');
        expect(monthlyReport).to.eql({
            local: {
                '192.168.2.100': { download: 2233, upload: 37 },
                '192.168.2.101': { download: 8003, upload: 29 },
             },
            remote: {
                '128.65.210.180': { download: 10236, upload: 66 }
            },
         })
    });

    it('should write one monthly csv file', async () => {
        const dataLines = [
            // one month before
            tcpDownload('2019-09-27T03:40:00.001Z', 2003, '192.168.2.101'),

            // this month
            tcpDownload('2019-10-27T03:40:00.001Z', 2003, '192.168.2.100'),
            tcpUpload('2019-10-27T14:40:01.001Z', 20, '192.168.2.100'),
            tcpDownload('2019-10-27T14:40:01.101Z', 207, '192.168.2.100'),
            tcpDownload('2019-10-28T23:40:02.001Z', 4000, '192.168.2.101'),
            tcpDownload('2019-10-28T23:40:02.002Z', 1000, '192.168.2.101'),
            tcpDownload('2019-10-28T23:40:02.002Z', 23, '192.168.2.100'),
            tcpDownload('2019-10-28T23:40:02.003Z', 29, '192.168.2.101'),
            tcpUpload('2019-10-28T23:40:02.004Z', 29, '192.168.2.101'),
            tcpUpload('2019-10-29T23:40:02.002Z', 17, '192.168.2.100'),
            tcpDownload('2019-10-30T23:40:02.001Z', 4003, '192.168.2.101'),

            // trigger write, one month later
            tcpDownload('2019-11-28T14:40:00.000Z', 2001, '192.168.2.100'),
        ];

        await pipe2script(dataLines);

        const monthlyCSVReport = (await readFile('fritz-capture-2019-10.csv'))
            .split("\n")
            .filter(line => line && line.length > 0);

        expect(monthlyCSVReport).to.have.lengthOf(9);
        expect(monthlyCSVReport[0]).to.eql('time\tlocal_ip\tremote_ip\tremote_port\tprotocol\tdownload\tupload');
        expect(monthlyCSVReport).to.include('2019-10-27T03:40:00.001Z\t192.168.2.100\t128.65.210.180\t234439\t\t2003\t0');
        expect(monthlyCSVReport).to.include('2019-10-27T14:40:01.001Z\t192.168.2.100\t128.65.210.180\t443\t\t0\t20');
        expect(monthlyCSVReport).to.include('2019-10-27T14:40:01.101Z\t192.168.2.100\t128.65.210.180\t234439\t\t207\t0');
        expect(monthlyCSVReport).to.include('2019-10-28T23:40:02.001Z\t192.168.2.101\t128.65.210.180\t234439\t\t5029\t0');
        expect(monthlyCSVReport).to.include('2019-10-28T23:40:02.002Z\t192.168.2.100\t128.65.210.180\t234439\t\t23\t0');
        expect(monthlyCSVReport).to.include('2019-10-28T23:40:02.004Z\t192.168.2.101\t128.65.210.180\t443\t\t0\t29');
        expect(monthlyCSVReport).to.include('2019-10-29T23:40:02.002Z\t192.168.2.100\t128.65.210.180\t443\t\t0\t17');
        expect(monthlyCSVReport).to.include('2019-10-30T23:40:02.001Z\t192.168.2.101\t128.65.210.180\t234439\t\t4003\t0');
    })


    it('should write ip to hostname file', async () => {
        const dataLines = [
            tcpDownload('2019-10-27T13:40:00.001Z', 1003, '192.168.2.100'),
            tcpUpload('2019-10-27T13:40:01.001Z', 10, '192.168.2.100'),
            tcpDownload('2019-10-27T13:40:02.001Z', 3000, '192.168.2.101'),
            // trigger write, one hour later
            tcpDownload('2019-10-27T14:40:00.000Z', 1001, '192.168.2.100'),
        ];

        await pipe2script(dataLines);

        const { getHostName } = await ResolveHostNamesByIps({
            storeFileName: path.join(DATA_DIR, 'ipToHostNameMap.json'),
        });

        expect(getHostName('192.168.2.100')).to.have.lengthOf.above(0);
        expect(getHostName('192.168.2.100')).to.not.eql('unknown');
        expect(getHostName('192.168.2.101')).to.have.lengthOf.above(0);
        expect(getHostName('192.168.2.101')).to.not.eql('unknown');

        expect(getHostName('192.192.192.192')).to.eql('unknown');
    });
});
