const path = require('path');
const { spawn } = require('child_process');

const  promiseDelay = async (milliSeconds = 1) =>
    new Promise(resolve => setTimeout(() => resolve(), milliSeconds));

const pipe2Script = (scriptFilename, lines, { env, debug, delay } = {}) => {
    return new Promise(async (resolve, reject) => {
        const dataOut = [];

        const args = debug ?
            ['--inspect-brk=9228', path.resolve(scriptFilename)] : [path.resolve(scriptFilename)];

        const ts = spawn('node', args, {
            env: Object.assign({}, process.env, env),
        });
        ts.stdout.on('data', (data) => {
            dataOut.push(data.toString().replace(/\n$/, ""));
        });
        ts.on('close', (code) => {
            resolve(dataOut)
        });
        ts.on('error', (err) => {
            reject(err)
        });

        for (line of lines) {
            ts.stdin.write(`${line}\n`, 'utf-8');
            await promiseDelay(delay);
        }

        ts.stdin.end();
    })
};

module.exports = pipe2Script;

