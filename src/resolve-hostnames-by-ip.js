const fs = require('fs').promises;
const { promisify } = require('util');
const { Resolver } = require('dns');

const ResolveHostNamesByIp = (_dnsServer) => {
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
};

const ResolveHostNamesByIps = async ({ storeFileName, dnsServer }) => {
    const resolveHostNamesByIp = ResolveHostNamesByIp(dnsServer);

    async function readIpToHostNameStore() {
        try {
            const jsonData = await fs.readFile(storeFileName, 'utf8');
            return new Map(JSON.parse(jsonData))
        } catch (err) {
            if (err.code === 'ENOENT') {
                return new Map()
            }
            throw err;
        }
    }

    async function writeIpToHostNameData(ipToHostNameMap) {
        await fs.writeFile(
            storeFileName, JSON.stringify([...ipToHostNameMap]), 'utf8'
        );
    }

    const ipToHostNameMap = storeFileName ?
        await readIpToHostNameStore() : new Map();

    return async (ips) => {
        const _ips = [].concat(ips);
        for (const ip of _ips) {
            if (!ipToHostNameMap.has(ip)) {
                const hostNames = await resolveHostNamesByIp(ip);
                ipToHostNameMap.set(ip, hostNames.slice(-1)[0])
            }
        }

        if (storeFileName) {
            await writeIpToHostNameData(ipToHostNameMap);
        }

        return ipToHostNameMap;
    };
};

module.exports = ResolveHostNamesByIps;
