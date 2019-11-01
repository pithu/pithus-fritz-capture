const { expect } = require('chai');
const { Resolver } = require('dns');

const ResolveHostNamesByIps = require('../src/resolve-hostnames-by-ip');

describe('resolveHostNamesByIp', () => {
    it('should resolve an ip', async () => {
        const dnsServers = new Resolver().getServers();
        const reverseIp = await ResolveHostNamesByIps({ dnsServer: dnsServers[0] });

        const ip2HostNameMap = await reverseIp(dnsServers[0]);

        expect(ip2HostNameMap.size).to.eql(1);
        expect(ip2HostNameMap.get(dnsServers[0])).to.have.lengthOf.above(0);
    });

    it('should resolve ips', async () => {
        const dnsServers = new Resolver().getServers();
        const reverseIp = await ResolveHostNamesByIps({ dnsServer: dnsServers[0] });

        const ip2HostNameMap = await reverseIp(['8.8.8.8', '128.65.210.180']);

        expect(ip2HostNameMap.size).to.eql(2);
        expect(ip2HostNameMap.get('128.65.210.180')).to.have.lengthOf.above(0);
        expect(ip2HostNameMap.get('8.8.8.8')).to.have.lengthOf.above(0);
    });

    it('should not resolve an unresolvable ip', async () => {
        const dnsServers = new Resolver().getServers();
        const reverseIp = await ResolveHostNamesByIps({ dnsServer: dnsServers[0] });

        const ip2HostNameMap = await reverseIp('192.168.2.256');

        expect(ip2HostNameMap.size).to.eql(1);
        expect(ip2HostNameMap.get('192.168.2.256')).to.eql(
            'unresolved',
        )
    });
});
