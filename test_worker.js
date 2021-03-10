'use strict';

var wt = require('worker_threads');
//var ipc = require('ipc');
var ipc = require('./index.js');
var workerName = '';

//#region IPC functions 
function print(input) {

    console.log({
        workerName: workerName,
        isMainThread: wt.isMainThread,
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

    var worker = new wt.Worker('./test_worker.js');
    var methods = ipc.workerInterface(exports, worker);

    setTimeout(function () { methods.print("Main thread test. " + workerName); }, 100);
    setTimeout(function () { methods.shutdown(); }, 10000);
}
else {

    workerName = 'Worker ' + wt.threadId + '/' + process.pid;
    console.log('Start: ', {
        threadName: workerName,
        isMainThread: wt.isMainThread
    });

    ipc.workerBackground(exports);
}

process.on('exit', function () { console.log('Exit: ' + workerName); });