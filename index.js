#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const SocksServer_1 = require("./socks5Proxy/SocksServer");
const HttpProxy_1 = require("./httpProxy/HttpProxy");
const path = __importStar(require("path"));
const Logger_1 = require("./Logger");
/*const PORT = 1080; // Default SOCKS5 port
const CONFIG_PATH = "/home/ubuntu/ts_socks/socks-server-config.json"; // path to config file
*/
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const configPathIndex = process.argv.indexOf('--config_path');
            const configPath = configPathIndex > -1 ? process.argv[configPathIndex + 1] : path.join(__dirname, "./server-config.json");
            const logLevelArgIndex = process.argv.indexOf('--log_level');
            const logLevelArg = logLevelArgIndex > -1 && logLevelArgIndex + 1 < process.argv.length ? process.argv[logLevelArgIndex + 1] : null;
            const logFilePathArgIndex = process.argv.indexOf('--log_file_path');
            const logFilePath = logFilePathArgIndex > -1 && logFilePathArgIndex + 1 < process.argv.length ? process.argv[logFilePathArgIndex + 1] : path.join(__dirname, '../../server.log');
            const logOutputArgIndex = process.argv.indexOf('--log_output');
            const logOutputArg = logOutputArgIndex > -1 && logOutputArgIndex + 1 < process.argv.length ? process.argv[logOutputArgIndex + 1] : null;
            const httpSupport = process.argv.includes('--http');
            const logLevel = logLevelArg && Logger_1.LogLevel[logLevelArg] ? Logger_1.LogLevel[logLevelArg] : Logger_1.LogLevel.Info;
            const logOutput = logOutputArg && Logger_1.LogOutput[logOutputArg] ? Logger_1.LogOutput[logOutputArg] : Logger_1.LogOutput.Console;
            const logger = new Logger_1.Logger(logLevel, logOutput, logFilePath);
            const socksServer = new SocksServer_1.SocksServer(configPath, logger);
            let httpProxy;
            logger.debug(`Server Process PID : ${process.pid.toString()}`);
            console.log('Proxy server is starting...');
            // Start the server and listen for connections
            yield socksServer.start();
            if (httpSupport) {
                //httpProxy = new HttpProxy(config, logger); // Corrected class name
                httpProxy = new HttpProxy_1.HttpProxy(configPath, logger);
                yield httpProxy.start();
            }
            ;
            // Handle graceful shutdown
            const gracefulShutdown = () => __awaiter(this, void 0, void 0, function* () {
                console.log('Shutting down the server...');
                yield socksServer.close();
                if (httpSupport) {
                    yield httpProxy.close();
                }
            });
            // Listen for shutdown signals
            process.on('SIGINT', gracefulShutdown);
            process.on('SIGTERM', gracefulShutdown);
        }
        catch (error) {
            console.error('Failed to start the server:', error);
            process.exit(1); // Exit with error code
        }
    });
}
main();
