'use strict';

//require('log-report');
var http = require('http');
var Url = require('url');
var port = 8080;
//var ipc = require('.ipc');
var ipc = require('./index.js');
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
    //var ipc = require('ipc');
    var ipc = require('./index.js');
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