'use strict';

var wt = require('worker_threads');
//var ipc = require('ipc');
var ipc = require('./index.js');
var ipcPort = 8021;
var workerName = '';

//#region IPC functions 
function print(input) {

    console.log({
        workerName: workerName,
        isMainThread: wt.isMainThread,
        ipcPort: ipcPort,
        arguments: Array.from(arguments)
    });
}
exports.print = print;
function shutdown() { process.exit(); }
exports.shutdown = shutdown;
//#endregion

if (wt.isMainThread) {

    //require('log-report');
    workerName = 'MainThread ' + wt.threadId + '/' + process.pid;
    console.log('Start: ', {
        threadName: workerName,
        isMainThread: wt.isMainThread
    });

    var worker1 = new wt.Worker('./test_net.js', { workerData: 'server' });
    var worker2 = new wt.Worker('./test_net.js', { workerData: 'client' });
    var worker3 = new wt.Worker('./test_net.js', { workerData: 'client' });
    var fns = ipc.netInterface(exports, ipcPort);

    setTimeout(function () { fns.print("Main thread test. " + workerName); }, 100);
    setTimeout(function () { fns.shutdown(); }, 10000);
}
else {

    workerName = 'Worker ' + wt.threadId + '/' + process.pid;
    console.log('Start: ', {
        threadName: workerName,
        isMainThread: wt.isMainThread,
        workerData: wt.workerData,
        ipcPort: ipcPort
    });

    if (wt.workerData === 'server') {
        if (ipcPort) { ipc.netBackground(exports, ipcPort); }
    }
    if (wt.workerData === 'client') {
        if (ipcPort) {
            var fns = ipc.netInterface(exports, ipcPort);
            setTimeout(function () { fns.print("Client test. " + workerName); }, 100);
        }
    }
}

process.on('exit', function () { console.log('Exit: ' + workerName); });