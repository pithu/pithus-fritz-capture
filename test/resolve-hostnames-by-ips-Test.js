const { expect } = require('chai');
const { Resolver } = require('dns');

const ResolveHostNamesByIps = require('../src/resolve-hostnames-by-ip');

describe('resolveHostNamesByIp', () => {
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
});
