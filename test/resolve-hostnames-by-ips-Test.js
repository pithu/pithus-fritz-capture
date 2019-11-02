const os = require('os');
const path = require('path');

const { expect } = require('chai');
const { Resolver } = require('dns');
const rimraf = require('rimraf');

const ResolveHostNamesByIps = require('../src/resolve-hostnames-by-ip');

const TEST_DIR = path.join(os.tmpdir(), 'TEST_DATA');
const HOSTNAME_STORE_FILENAME = 'store.json';

describe('resolveHostNamesByIp', () => {
    const cleanUpDataDir = () => {
        rimraf.sync(TEST_DIR);
    };

    beforeEach(() => {
        cleanUpDataDir();
    });

    after(() => {
        cleanUpDataDir();
    });

    it('should resolve an ip', async () => {
        const dnsServers = new Resolver().getServers();
        const { resolveIp } = await ResolveHostNamesByIps({ dnsServer: dnsServers[0] });

        const hostName = await resolveIp(dnsServers[0]);

        expect(hostName).to.have.lengthOf.above(0);
    });

    it('should not resolve an unresolvable ip', async () => {
        const dnsServers = new Resolver().getServers();
        const { resolveIp } = await ResolveHostNamesByIps({ dnsServer: dnsServers[0] });

        const hostName = await resolveIp('192.168.2.256');

        expect(hostName).to.eql(
            'unresolved',
        );
    });

    it('should resolve ips', async () => {
        const dnsServers = new Resolver().getServers();
        const { resolveIps } = await ResolveHostNamesByIps({ dnsServer: dnsServers[0] });

        const hostNames = await resolveIps(['8.8.8.8', '128.65.210.180']);

        expect(hostNames).to.have.lengthOf(2);
        expect(hostNames[0]).to.have.lengthOf.above(0);
        expect(hostNames[1]).to.have.lengthOf.above(0);
    });

    it('should persists resolved ips', async () => {
        const dnsServers = new Resolver().getServers();
        const { resolveIps } = await ResolveHostNamesByIps({
            dnsServer: dnsServers[0],
            storeFileName: HOSTNAME_STORE_FILENAME,
        });
        await resolveIps(['8.8.8.8', '128.65.210.180']);

        // create a new instance
        const { getHostName } = await ResolveHostNamesByIps({
            dnsServer: dnsServers[0],
            storeFileName: HOSTNAME_STORE_FILENAME,
        });

        expect(getHostName('8.8.8.8')).to.have.lengthOf.above(0);
        expect(getHostName('8.8.8.8')).to.not.eql('unknown');
        expect(getHostName('128.65.210.180')).to.have.lengthOf.above(0);
        expect(getHostName('128.65.210.180')).to.not.eql('unknown');

        expect(getHostName('192.192.192.192')).to.eql('unknown');
    });
});
