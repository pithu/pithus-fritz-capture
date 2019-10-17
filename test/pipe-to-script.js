const { spawn } = require('child_process');

const pipe2Script = (scriptFilename, lines) => {
    return new Promise(resolve => {
        const dataOut = [];

        const ts = spawn(scriptFilename);
        ts.stdout.on('data', (data) => {
            dataOut.push(data.toString().replace(/\n$/, ""));
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

module.exports = pipe2Script;

