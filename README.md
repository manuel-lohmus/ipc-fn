# ipc-fn: a Node.js Inter Process Communication library

'ipc-fn' *Inter Process Communication* is a simple to use.
Allows you to easily run part of the code as a background process. 

Applications:
-	Existing code and you want to run part of it as a background process
-	Non-blocking web server
-	Multithreading app


## Table of Contents

- [Installing](#installing)
- [Usage examples](#usage-examples)
  - [Child process](#child-process)
  - [Net (TCP servce and clients)](#net-tcp-servce-and-clients)
  - [Worker](#worker)
  - [Broadcast Channel](#broadcast-channel)
  - [Non-blocking web server](#non-blocking-web-server)
- [License](#license)

## Installing

```
npm install ipc-fn
```

## Usage examples

### Child process

child.js
```js
'use strict';
var ipc = require('ipc-fn');

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
```

test_child.js
```js
'use strict';
var ipc = require('ipc-fn');
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
```

### Net (TCP servce and clients)

```js
'use strict';
var wt = require('worker_threads');
var ipc = require('ipc-fn');
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
```

### Worker

```js
'use strict';
var wt = require('worker_threads');
var ipc = require('ipc-fn');
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
```

### Broadcast Channel

```js
'use strict';
var wt = require('worker_threads');
var ipc = require('ipc-fn');
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
```

### Non-blocking web server

```js
'use strict';
//require('log-report');
var http = require('http');
var Url = require('url');
var port = 8080;
var ipc = require('ipc-fn');
var Worker = require('worker_threads').Worker;

// Opens the URL in the default browser.
function openBrowser(nr) {

    var url = 'http://localhost:8080/?nr=' + nr;
    var start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
    require('child_process').exec(start + ' ' + url);
}

exports.isPrime = function isPrime(number, callback) {
    let startTime = new Date();
    let endTime = new Date();
    let isPrime = true;
    for (let i = 3; i < number; i++) {
        //it is not a prime break the loop,
        // see how long it took
        if (number % i === 0) {
            endTime = new Date();
            isPrime = false;
            break;
        }
    }

    if (isPrime) endTime = new Date();

    callback({
        "number": number,
        "isPrime": isPrime,
        "time": endTime.getTime() - startTime.getTime()
    });

}
exports.shutdown = function shutdown() { process.exit(); }

var code = `
    var ipc = require('ipc-fn');
    exports.isPrime = ${exports.isPrime};
    exports.shutdown = ${exports.shutdown};
    ipc.workerBackground(exports);
`;
function isPrime_Worker(nr, callback) {

    var worker = new Worker(code, { eval: true });
    var fns = ipc.workerInterface(exports, worker);
    fns.isPrime(nr, function (response) { callback(response); });
    fns.shutdown();
}

http.createServer(function (req, res) {

    var url = Url.parse(req.url, true);

    isPrime_Worker(url.query.nr, function (response) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(JSON.stringify(response, null, 2));
    });
}).listen(port);

openBrowser(2367949); //(16 ms)
openBrowser(93686687); //(500 ms)
openBrowser(936868033); //(4 seconds)
```

## License

[MIT](LICENSE)

Copyright (c) 2021 Manuel L&otilde;hmus <manuel@hauss.ee>


