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
exports.SocksServer = void 0;
const net = __importStar(require("net"));
const SocksSession_1 = require("./SocksSession");
const ConfigManager_1 = require("../ConfigManager");
class SocksServer {
    constructor(configPath, logger) {
        this.configManager = new ConfigManager_1.ConfigManager(configPath);
        this.server = new net.Server();
        this.activeConnections = new Set();
        this.logger = logger;
        this.failedAuthAttempts = new Map();
        this.server.on('connection', this.handleConnection.bind(this));
        this.server.on('error', (err) => {
            this.logger.error(`Server error: ${err.message}`);
        });
    }
    handleConnection(socket) {
        ;
        const clientIP = socket.remoteAddress || '';
        this.logger.info(`New connection on server from socket : ${socket.remoteAddress}:${socket.remotePort}`);
        // Check if the server has reached its maximum number of concurrent connections
        if (this.activeConnections.size >= this.configManager.config.server.maxConcurrentConnections) {
            this.logger.info(`Connection limit reached. Rejecting new connection from ${clientIP}`);
            socket.destroy();
            return;
        }
        if (this.configManager.config.clientIpFiltering.blacklist.includes(clientIP)) {
            this.logger.info(`Rejected blacklisted IP: ${clientIP}`);
            socket.destroy();
            return;
        }
        if (!this.isWhitelistedIP(clientIP)) {
            this.logger.info(`Client not in the whitelist: ${clientIP}`);
            socket.destroy();
            return;
        }
        this.activeConnections.add(socket);
        socket.on('close', () => {
            this.logger.info(`Connection closed from socket : ${socket.remoteAddress}:${socket.remotePort}`);
            this.activeConnections.delete(socket);
        });
        new SocksSession_1.SocksSession(socket, this.configManager, this.logger, this.incrementAuthFailure.bind(this)); // Assuming this handles the individual connection
    }
    isWhitelistedIP(ip) {
        const whitelist = this.configManager.config.clientIpFiltering.whitelist;
        // If the whitelist is undefined or empty, return true
        if (!whitelist || whitelist.length === 0) {
            return true;
        }
        // Otherwise, check if the IP is in the whitelist
        return whitelist.includes(ip || '');
    }
    incrementAuthFailure(clientIP) {
        const attempts = (this.failedAuthAttempts.get(clientIP) || 0) + 1;
        this.failedAuthAttempts.set(clientIP, attempts);
        if (attempts >= this.configManager.config.authentication.maxFailedAttempts) {
            this.logger.info(`Blacklisting IP due to too many failed attempts: ${clientIP}`);
            this.configManager.config.clientIpFiltering.blacklist.push(clientIP);
        }
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.server.listen(this.configManager.config.server.socks5.port, this.configManager.config.server.socks5.serverIP, () => {
                    this.logger.info(`SOCKS5 server listening on ${this.configManager.config.server.socks5.serverIP}:${this.configManager.config.server.socks5.port}`);
                    resolve();
                });
                // Handle potential server start errors
                this.server.on('error', (error) => {
                    this.logger.error(`Error starting SOCKS5 server: ${error}`);
                    reject(error);
                });
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // Ensure all connections are terminated
                for (const socket of this.activeConnections) {
                    socket.destroy();
                }
                this.activeConnections.clear();
                this.logger.info(`Closed active connections`);
                // Close the server
                this.server.close((error) => {
                    if (error) {
                        this.logger.error(`Error closing SOCKS5 server: ${error}`);
                        reject(error);
                    }
                    else {
                        this.logger.info(`Closing the server...`);
                        resolve();
                    }
                });
            });
        });
    }
}
exports.SocksServer = SocksServer;
