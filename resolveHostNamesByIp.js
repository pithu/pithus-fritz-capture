const { promisify } = require('util');
const { Resolver } = require('dns');

const resolver = new Resolver();
const DNS_SERVER = process.env.DNS_SERVER || '192.168.2.1';
resolver.setServers([DNS_SERVER]);
const ipToHost = (ip, cb) => resolver.reverse(ip, cb);
const reverseAsync = promisify(ipToHost);
const resolveHostNamesByIp = async (ip) => {
    try {
        return await reverseAsync(ip);
    } catch (err) {
        return ['unresolved'];
    }
};

module.exports = resolveHostNamesByIp;
