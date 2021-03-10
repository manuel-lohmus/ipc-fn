'use strict';

var ipc = require('./index.js');

function print(input) {

    console.log({
        script: __filename,
        command: 'print',
        pid: process.pid,
        arguments: Array.from(arguments)
    });
}
exports.print = print;
function shutdown() { process.exit(); }
exports.shutdown = shutdown;

ipc.childBackground(exports);

process.on('exit', function () { console.log('Exit: ' + workerName); });