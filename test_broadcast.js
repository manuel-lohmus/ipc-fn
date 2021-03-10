'use strict';

var wt = require('worker_threads');
//var ipc = require('ipc');
var ipc = require('./index.js');
var broadcastChannelName = 'test_broadcast';
var workerName = '';

//#region IPC functions 
function print(input) {

    console.log('Print: ', {
        workerName: workerName,
        isMainThread: wt.isMainThread,
        arguments: Array.from(arguments)
    });
}
exports.print = print;
function shutdown() {
    console.log('Shutdown: ' + workerName);
    process.exit();
}
exports.shutdown = shutdown;
//#endregion

if (wt.isMainThread) {

    //require('log-report');
    workerName = 'MainThread ' + wt.threadId + '/' + process.pid;
    console.log('Start: ', {
        threadName: workerName,
        isMainThread: wt.isMainThread
    });

    var bc = ipc.broadcast(exports, broadcastChannelName);

    var worker1 = new wt.Worker('./test_broadcast.js');
    var worker2 = new wt.Worker('./test_broadcast.js');

    setTimeout(function () { bc.print("Main thread test. " + workerName); }, 100);
    setTimeout(function () {
        bc.shutdown();
        setTimeout(function () { process.exit(); }, 100);
    }, 10000);
}
else {

    workerName = 'Worker ' + wt.threadId + '/' + process.pid;
    console.log('Start: ', {
        threadName: workerName,
        isMainThread: wt.isMainThread
    });

    var bc = ipc.broadcast(exports, broadcastChannelName);
    setTimeout(function () { bc.print("Client test. " + workerName); }, 100);
}

process.on('exit', function () { console.log('Exit: ' + workerName); });