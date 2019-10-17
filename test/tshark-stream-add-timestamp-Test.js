const { expect } = require('chai');
const { Instant } = require('@js-joda/core');
const pipe2script = require('./pipe-to-script');
require('./inject-temporal');

const addTimestampScript = './src/tshark-stream-add-timestamp.js';

describe('tshark-stream-add-timestamp', () => {
    it('should prefix lines with the current timestamp', async () => {
        const data = ["foo", "bar"];

        const instantBefore = Instant.now();
        const lines = await pipe2script(addTimestampScript, data);
        const instantAfter = Instant.now();

        expect(lines).to.have.lengthOf(2);

        const [i1, l1] = lines[0].split("\t");
        expect(instantBefore.isBeforeOrEqual(Instant.parse(i1))).to.be.true;
        expect(instantAfter.isAfterOrEqual(Instant.parse(i1))).to.be.true;
        expect(l1).to.eql("foo");

        const [i2, l2] = lines[1].split("\t");
        expect(instantBefore.isBeforeOrEqual(Instant.parse(i2))).to.be.true;
        expect(instantAfter.isAfterOrEqual(Instant.parse(i2))).to.be.true;
        expect(l2).to.eql("bar");
    })
});
