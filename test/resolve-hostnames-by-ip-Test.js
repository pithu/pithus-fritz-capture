const { expect } = require('chai');
const { Resolver } = require('dns');

const resolveHostNamesByIp = require('../src/resolve-hostnames-by-ip');

describe('resolveHostNamesByIp', () => {
    it('should resolve an ip', async () => {
        const dnsServers = new Resolver().getServers();
        reverseIp = resolveHostNamesByIp(dnsServers[0]);

        const hostNames = await reverseIp(dnsServers[0]);

        expect(hostNames).to.have.lengthOf.above(0);
    });

    it('should not resolve an unresolvable ip', async () => {
        const dnsServers = new Resolver().getServers();
        reverseIp = resolveHostNamesByIp(dnsServers[0]);

        const hostNames = await reverseIp('192.168.2.256');

        expect(hostNames).to.eql(
            ['unresolved']
        )
    });
});
