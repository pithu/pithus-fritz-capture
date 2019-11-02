const os = require('os');
const path = require('path');

const { expect } = require('chai');
const { Resolver } = require('dns');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');

const ResolveHostNamesByIps = require('../src/resolve-hostnames-by-ip');

const TEST_DIR = path.join(os.tmpdir(), 'TEST_DATA');
const HOSTNAME_STORE_FILENAME = path.join(TEST_DIR, 'store.json');

describe('resolveHostNamesByIp', () => {
    const cleanUpDataDir = () => {
        rimraf.sync(TEST_DIR);
        mkdirp.sync(TEST_DIR);
    };

    const dummyResolver = () => {
        let i = 0;
        return {
            setServers: () => {
            },
            reverse: (ip) => {
                switch (ip) {
                    case '8.8.8.8':
                        return Promise.resolve(['dns.google']);
                    case '128.65.210.180':
                        return Promise.resolve(['www.spiegel1.de', 'www.spiegel.de']);
                    case '192.168.4.42':
                        if (i === 0) {
                            i = 1;
                            return Promise.resolve(['first1.de', 'first2.de']);
                        } else {
                            return Promise.resolve(['second1.de', 'second2.de']);
                        }
                    default:
                        return Promise.reject("failed");
                }
            }
        }
    };

    beforeEach(() => {
        cleanUpDataDir();
    });

    after(() => {
        cleanUpDataDir();
    });

    it('should resolve an ip', async () => {
        const dnsServers = new Resolver().getServers();
        const { resolveIp } = await ResolveHostNamesByIps({ resolver: dummyResolver() });

        const hostName = await resolveIp('8.8.8.8');

        expect(hostName).to.eql('dns.google');
    });

    it('should not resolve an unresolvable ip', async () => {
        const dnsServers = new Resolver().getServers();
        const { resolveIp } = await ResolveHostNamesByIps({ resolver: dummyResolver() });

        const hostName = await resolveIp('192.168.2.256');

        expect(hostName).to.eql(
            'unresolved',
        );
    });

    it('should resolve ips', async () => {
        const dnsServers = new Resolver().getServers();
        const { resolveIps } = await ResolveHostNamesByIps({ resolver: dummyResolver() });

        const hostNames = await resolveIps(['8.8.8.8', '128.65.210.180']);

        expect(hostNames).to.have.lengthOf(2);
        expect(hostNames[0]).to.eql('dns.google');
        expect(hostNames[1]).to.eql('www.spiegel.de');
    });

    it('should persists resolved ips', async () => {
        const dnsServers = new Resolver().getServers();
        const { resolveIps } = await ResolveHostNamesByIps({
            resolver: dummyResolver(),
            storeFileName: HOSTNAME_STORE_FILENAME,
        });
        await resolveIps(['8.8.8.8', '128.65.210.180']);

        // create a new instance
        const { getHostName } = await ResolveHostNamesByIps({
            resolver: dummyResolver(),
            storeFileName: HOSTNAME_STORE_FILENAME,
        });

        expect(getHostName('8.8.8.8')).to.eql('dns.google');
        expect(getHostName('128.65.210.180')).to.eql('www.spiegel.de');

        expect(getHostName('192.192.192.192')).to.eql('unknown');
    });

    it('should re-fetch resolved ips after lease time', async () => {
        const dnsServers = new Resolver().getServers();
        const { getHostName, resolveIps } = await ResolveHostNamesByIps({
            resolver: dummyResolver(),
            leaseTime: 0,
        });

        const hostNames1 = await resolveIps(['192.168.4.42']);
        expect(hostNames1[0]).to.eql('first2.de');
        expect(getHostName('192.168.4.42')).to.eql('first2.de');

        const hostNames2 = await resolveIps(['192.168.4.42']);
        expect(getHostName('192.168.4.42')).to.eql('second2.de');
        expect(hostNames2[0]).to.eql('second2.de');
    });

    it('should not re-fetch resolved ips if lease time is not reached', async () => {
        const dnsServers = new Resolver().getServers();
        const { getHostName, resolveIps } = await ResolveHostNamesByIps({
            resolver: dummyResolver(),
            leaseTime: 3600,
        });

        const hostNames1 = await resolveIps(['192.168.4.42']);
        expect(hostNames1[0]).to.eql('first2.de');
        expect(getHostName('192.168.4.42')).to.eql('first2.de');

        const hostNames2 = await resolveIps(['192.168.4.42']);
        expect(getHostName('192.168.4.42')).to.eql('first2.de');
        expect(hostNames2[0]).to.eql('first2.de');
    });
});
