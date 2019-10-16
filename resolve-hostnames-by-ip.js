const { promisify } = require('util');
const { Resolver } = require('dns');

const resolveHostNamesByIp = (_dnsServer) => {
    const resolver = new Resolver();
    const dnsServer = _dnsServer || process.env.DNS_SERVER || '192.168.2.1';
    resolver.setServers([dnsServer]);

    const ipToHost = (ip, cb) => resolver.reverse(ip, cb);
    const reverseAsync = promisify(ipToHost);

    return async (ip) => {
        try {
            return await reverseAsync(ip);
        } catch (err) {
            return ['unresolved'];
        }
    };
}

module.exports = resolveHostNamesByIp;
