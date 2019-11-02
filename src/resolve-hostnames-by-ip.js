const fs = require('fs').promises;
const { Resolver } = require('dns').promises;
const { Instant } = require('@js-joda/core');

const LEASE_TIME = 3600; // seconds

const ResolveHostNamesByIps = async ({ storeFileName, resolver, leaseTime }) => {
    if (!resolver) {
        resolver = new Resolver();
        if (process.env.DNS_SERVER) {
            resolver.setServers([process.env.DNS_SERVER]);
        }
    }
    if (leaseTime == null) {
        leaseTime = LEASE_TIME;
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

    const hasValidEntry = ip => {
        if (!ipToHostNameMap.has(ip)) {
            return false;
        }

        const entry = ipToHostNameMap.get(ip);
        if (!entry || !entry.hostNames) {
            return false;
        }

        return Instant.now().epochSecond() - entry.timestamp < leaseTime;
    };

    const getHostName = ip => {
        const entry = ipToHostNameMap.get(ip);
        if (!entry) {
            return 'unknown';
        }
        if (entry && entry.hostNames) {
            return entry.hostNames.slice(-1)[0];
        }
        return entry;
    };

    const reverse = async ip => {
        try {
            return await resolver.reverse(ip);
        } catch (err) {
            return ['unresolved'];
        }
    };

    const resolveIp = async ip => {
        let updated = false;

        if (!hasValidEntry(ip)) {
            updated = true;
            const hostNames = await reverse(ip);
            ipToHostNameMap.set(ip, {
                hostNames,
                timestamp: Instant.now().epochSecond(),
            })
        }

        if (updated && storeFileName) {
            await writeIpToHostNameData(ipToHostNameMap);
        }

        return getHostName(ip);
    };

    const resolveIps = async ips => {
        const hostNames = [];
        for (const ip of ips) {
            await resolveIp(ip);
            hostNames.push(getHostName(ip));
        }
        return hostNames;
    };

    return {
        getHostName,
        resolveIp,
        resolveIps,
    }
};

module.exports = ResolveHostNamesByIps;
