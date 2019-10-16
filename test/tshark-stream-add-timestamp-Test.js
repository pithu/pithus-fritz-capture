const { expect } = require('chai');
const { Instant } = require('@js-joda/core');
const { spawn } = require('child_process');

const addTimestampScript = './tshark-stream-add-timestamp.js';

describe('tshark-stream-add-timestamp', () => {
    const callAddTimestampScript = (lines) => {
        return new Promise(resolve => {
            const dataOut = [];

            const ts = spawn(addTimestampScript);
            ts.stdout.on('data', (data) => {
                dataOut.push(data.toString());
            });
            ts.on('close', (code) => {
                resolve(dataOut)
            });

            for (line of lines) {
                ts.stdin.write(`${line}\n`, 'utf-8');
            }

            ts.stdin.end();
        })
    };

    const isBeforeOrEqual = (instantA, instantB) =>
        instantA.isBefore(instantB) || instantA.equals(instantB);
    const isAfterOrEqual = (instantA, instantB) =>
        instantA.isAfter(instantB) || instantA.equals(instantB);

    it('should prefix lines with the current timestamp', async () => {
        const data = ["foo", "bar"];

        const instantBefore = Instant.now();
        const lines = await callAddTimestampScript(data);
        const instantAfter = Instant.now();

        expect(lines).to.have.lengthOf(2);

        const [i1, l1] = lines[0].split("\t");
        expect(isBeforeOrEqual(instantBefore,Instant.parse(i1)));
        expect(isAfterOrEqual(instantAfter, Instant.parse(i1)));
        expect(l1).to.eql("foo\n");

        const [i2, l2] = lines[1].split("\t");
        expect(isBeforeOrEqual(instantBefore,Instant.parse(i2)));
        expect(isAfterOrEqual(instantAfter, Instant.parse(i2)));
        expect(l2).to.eql("bar\n");
    })
});
