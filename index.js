/**IPC functions. @preserve Copyright (c) 2021 Manuel Lõhmus.*/
'use strict';

var isDebug = Boolean(process.execArgv.find(function (i) { return i.includes('--inspect'); }));
var net = require('net');
var callbacks = {}, count = 1;

function argArrMap(argArr) {

    return argArr.map(function (arg) {

        if (typeof arg === 'function') {

            var k = "fn" + count++;
            callbacks[k] = arg;

            return k;
        }

        else { return arg; }
    });
}

//#region Net
/**
 * @param {any} methods
 * @param {number} ipcPort
 * @param {number} hostname Default: 'localhost'.
 * @returns {net.Server}
 */
function netBackground(methods, ipcPort, hostname = 'localhost') {

    var fns = methods;

    return net
        .createServer(function (client) {
            client.on('data', function (msg) {

                var isCallback = false;
                var msgObj = JSON.parse(msg);
                var method = fns[msgObj.key];

                if (!method) {

                    method = callbacks[msgObj.key];
                    if (method) { delete callbacks[msgObj.key]; }
                }

                if (typeof method === 'function') {

                    msgObj.argArr = msgObj.argArr.map(function (arg) {

                        if (typeof arg === 'string' && arg.startsWith('fn')) {

                            isCallback = true;

                            return function () {

                                var argArr = Array.from(arguments);
                                argArr = argArrMap(argArr, callbacks);
                                client.write(JSON.stringify({ argArr: [[arg, argArr]] }));
                            };
                        }

                        else { return arg; }
                    });

                    var result = method.apply(null, msgObj.argArr);
                    if (result) { client.write(JSON.stringify({ result: result })); }
                    else if (!isCallback) { client.end(); }
                }

                else { throw new Error("The '" + msgObj.key + "' is undefined."); }
            });
            client.on('close', function (isErr) { console.log('Close connection. IsErr:' + isErr); });
        })
        .listen(ipcPort, hostname, function () {

            if (isDebug) { console.log("IPC service hostname:" + hostname + " port:" + ipcPort + " pid:" + process.pid); }
        });
}
exports.netBackground = netBackground;
/**
 * @param {any} methods
 * @param {number} ipcPort
 * @param {number} hostname Default: 'localhost'.
 * @returns {any} Methods interface.
 */
function netInterface(methods, ipcPort, hostname = 'localhost') {

    var fns = {};
    Object.keys(methods).forEach(function (key) {

        if (typeof methods[key] === 'function') {

            fns[key] = function () {

                var argArr = Array.from(arguments);
                var client = net.connect(
                    { port: ipcPort, host: hostname },
                    function () {

                        client.on('data', function (msg) {

                            var msgObj = JSON.parse(msg);

                            if (msgObj.result) {
                                client.end();
                                return msgObj.result;
                            }

                            if (Array.isArray(msgObj.argArr)) {

                                msgObj.argArr.forEach(function (arg) {

                                    if (typeof callbacks[arg[0]] === 'function') {

                                        arg[1] = arg[1].map(function (a) {

                                            if (typeof a === 'string' && a.startsWith('fn')) {

                                                return function () {

                                                    var args = argArrMap(Array.from(arguments));
                                                    client.write(JSON.stringify({ key: a, argArr: args }));
                                                };
                                            }

                                            else { return a; }
                                        });

                                        callbacks[arg[0]].apply(null, arg[1]);

                                        delete callbacks[arg[0]];
                                    }
                                });
                            }
                        });

                        argArr = argArrMap(argArr);
                        client.write(JSON.stringify({ key: key, argArr: argArr }));

                        if (!Object.keys(callbacks).length) { client.end(); }
                    }
                );
            };
        }
    });

    return fns;
}
exports.netInterface = netInterface;
//#endregion

//#region Child
/**
 * @param {any} methods
 * @returns {void}
 */
function childBackground(methods) {

    if (process.send) {

        var fns = methods;

        process.on("message", function (msg) {

            var msgObj = JSON.parse(msg);
            var method = fns[msgObj.key];

            if (!method) {

                method = callbacks[msgObj.key];
                if (method) { delete callbacks[msgObj.key]; }
            }

            if (typeof method === 'function') {

                msgObj.argArr = msgObj.argArr.map(function (arg) {

                    if (typeof arg === 'string' && arg.startsWith('fn')) {

                        return function () {

                            var argArr = Array.from(arguments);
                            argArr = argArrMap(argArr, callbacks);
                            process.send(JSON.stringify({ argArr: [[arg, argArr]] }));
                        };
                    }

                    else { return arg; }
                });

                var result = method.apply(null, msgObj.argArr);
                if (result) { process.send(JSON.stringify({ result: result })); }
            }

            else { throw new Error("The '" + msgObj.key + "' is undefined."); }
        });
    }
}
exports.childBackground = childBackground;
/**
 * @param {any} methods
 * @param {any} childProcess
 * @returns {any} Methods interface.
 */
function childInterface(methods, childProcess) {

    childProcess.on("message", function (msg) {

        var msgObj = JSON.parse(msg);

        if (msgObj.result) { return msgObj.result; }

        if (Array.isArray(msgObj.argArr)) {

            msgObj.argArr.forEach(function (arg) {

                if (typeof callbacks[arg[0]] === 'function') {

                    arg[1] = arg[1].map(function (a) {

                        if (typeof a === 'string' && a.startsWith('fn')) {

                            return function () {

                                var args = argArrMap(Array.from(arguments));
                                childProcess.send(JSON.stringify({ key: a, argArr: args }));
                            };
                        }

                        else { return a; }
                    });

                    callbacks[arg[0]].apply(null, arg[1]);

                    delete callbacks[arg[0]];
                }
            });
        }
    });

    var fns = {};
    Object.keys(methods).forEach(function (key) {

        if (typeof methods[key] === 'function') {

            fns[key] = function () {

                var argArr = Array.from(arguments);
                argArr = argArrMap(argArr);
                childProcess.send(JSON.stringify({ key: key, argArr: argArr }));
            };
        }
    });

    return fns;
}
exports.childInterface = childInterface;
//#endregion

//#region Worker
/**
 * @param {any} methods
 * @param {Worker} worker
 * @returns {void}
 */
function workerBackground(methods) {

    var parentPort = require('worker_threads').parentPort;

    if (parentPort && typeof parentPort.on === 'function') {

        var fns = methods;

        parentPort.on("message", function (msg) {

            var msgObj = JSON.parse(msg);
            var method = fns[msgObj.key];

            if (!method) {

                method = callbacks[msgObj.key];
                if (method) { delete callbacks[msgObj.key]; }
            }

            if (typeof method === 'function') {

                msgObj.argArr = msgObj.argArr.map(function (arg) {

                    if (typeof arg === 'string' && arg.startsWith('fn')) {

                        return function () {

                            var argArr = Array.from(arguments);
                            argArr = argArrMap(argArr, callbacks);
                            parentPort.postMessage(JSON.stringify({ argArr: [[arg, argArr]] }));
                        };
                    }

                    else { return arg; }
                });

                var result = method.apply(null, msgObj.argArr);
                if (result) { parentPort.postMessage(JSON.stringify({ result: result })); }
            }

            else { throw new Error("The '" + msgObj.key + "' is undefined."); }
        });
    }
}
exports.workerBackground = workerBackground;
/**
 * @param {any} methods
 * @param {Worker} worker
 * @returns {any} Methods interface.
 */
function workerInterface(methods, worker) {

    if (worker && typeof worker.on === 'function') {

        worker.on("message", function (msg) {

            var msgObj = JSON.parse(msg);

            if (msgObj.result) { return msgObj.result; }

            if (Array.isArray(msgObj.argArr)) {

                msgObj.argArr.forEach(function (arg) {

                    if (typeof callbacks[arg[0]] === 'function') {

                        arg[1] = arg[1].map(function (a) {

                            if (typeof a === 'string' && a.startsWith('fn')) {

                                return function () {

                                    var args = argArrMap(Array.from(arguments));
                                    worker.postMessage(JSON.stringify({ key: a, argArr: args }));
                                };
                            }

                            else { return a; }
                        });

                        callbacks[arg[0]].apply(null, arg[1]);

                        delete callbacks[arg[0]];
                    }
                });
            }
        });

        var fns = {};
        Object.keys(methods).forEach(function (key) {

            if (typeof methods[key] === 'function') {

                fns[key] = function () {

                    var argArr = Array.from(arguments);
                    argArr = argArrMap(argArr);
                    worker.postMessage(JSON.stringify({ key: key, argArr: argArr }));
                };
            }
        });
    }
    return fns;
}
exports.workerInterface = workerInterface;
//#endregion

//#region Broadcast
// BroadcastChannel
var nodeVersion = process.versions.node.split(/[.]/);
if (nodeVersion[0] > 14 && nodeVersion[1] > 3) {

    /**
     * @param {any} methods
     * @param {any} name The name of the channel to connect to. Any JavaScript value that can be converted to a string using ${name} is permitted.
     * @returns {any} Methods interface.
     */
    function broadcast(methods, name) {

        var fns = {};
        var wt = require('worker_threads');
        var bc = new wt.BroadcastChannel(name);

        if (bc) {

            fns = methods;

            bc.onmessage = function (event) {

                var msgObj = JSON.parse(event.data);
                var method = fns[msgObj.key];

                if (!method) {

                    method = callbacks[msgObj.key];
                    if (method) { delete callbacks[msgObj.key]; }
                }

                if (typeof method === 'function') {

                    msgObj.argArr = msgObj.argArr.map(function (arg) {

                        if (typeof arg === 'string' && arg.startsWith('fn')) {

                            return function () {

                                var argArr = Array.from(arguments);
                                argArr = argArrMap(argArr, callbacks);
                                event.postMessage(JSON.stringify({ argArr: [[arg, argArr]] }));
                            };
                        }

                        else { return arg; }
                    });

                    var result = method.apply(null, msgObj.argArr);
                    if (result) { event.postMessage(JSON.stringify({ result: result })); }
                }

                else { throw new Error("The '" + msgObj.key + "' is undefined."); }
            };

            var methodsInterface = {};
            Object.keys(methods).forEach(function (key) {

                if (typeof methods[key] === 'function') {

                    methodsInterface[key] = function () {

                        var argArr = Array.from(arguments);
                        argArr = argArrMap(argArr);
                        bc.postMessage(JSON.stringify({ key: key, argArr: argArr }));
                    };
                }
            });

            return methodsInterface;
        }
    }
    exports.broadcast = broadcast;
}
//#endregion