'use strict';

require('log-report');
//var ipc = require('ipc');
var ipc = require('./index.js');
var cp = require("child_process");
var fork = cp.fork('./child.js');
var child = ipc.childInterface(require('./child.js'), fork);

console.log({
    script: __filename,
    pid: process.pid,
    arguments: Array.from(arguments)
});

child.print('Test1');
setTimeout(function () { child.shutdown(); }, 10000);