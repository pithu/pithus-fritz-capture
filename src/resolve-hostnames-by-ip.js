const fs = require('fs').promises;
const { Resolver } = require('dns').promises;

const ResolveHostNamesByIps = async ({ storeFileName, dnsServer }) => {
    const resolver = new Resolver();
    const _dnsServer = dnsServer || process.env.DNS_SERVER;
    if (_dnsServer) {
        resolver.setServers([_dnsServer]);
    }
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

    const reverse = async ip => {
        try {
            return await resolver.reverse(ip);
        } catch (err) {
            return ['unresolved'];
        }
    };

    const resolveIp = async ip => {
        let updated = false;

        if (!ipToHostNameMap.has(ip)) {
            updated = true;
            const hostNames = await reverse(ip);
            ipToHostNameMap.set(ip, hostNames.slice(-1)[0])
        }

        if (updated && storeFileName) {
            await writeIpToHostNameData(ipToHostNameMap);
        }

        return ipToHostNameMap.get(ip);
    };

    const resolveIps = async ips => {
        const hostNames = [];
        for (const ip of ips) {
            hostNames.push(await resolveIp(ip));
        }
        return hostNames;
    };

    const getHostName = ip => ipToHostNameMap.get(ip) || 'unknown';

    return {
        getHostName,
        resolveIp,
        resolveIps,
    }
};

module.exports = ResolveHostNamesByIps;
