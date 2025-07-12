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
exports.HttpProxy = void 0;
const http = __importStar(require("http"));
const Auth_1 = require("../Auth");
const SessionMonitor_1 = require("../SessionMonitor");
const HttpSession_1 = require("./HttpSession");
const ConfigManager_1 = require("../ConfigManager");
class HttpProxy {
    constructor(configPath, logger) {
        this.configManager = new ConfigManager_1.ConfigManager(configPath);
        this.logger = logger;
        this.failedAuthAttempts = new Map();
        this.activeConnections = new Map();
        if (this.configManager.config.authentication.method === 'password') {
            this.authHandler = new Auth_1.UserPassAuth(this.configManager.config.credentials);
        }
        else {
            this.authHandler = null;
        }
        this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));
        this.httpServer.on('connect', (req, socket, head) => this.handleHttpsRequest(req, socket, head));
        // Listener for the 'connection' event to manage the active connections
        this.httpServer.on('connection', (socket) => {
            if (this.activeConnections.size >= this.configManager.config.server.maxConcurrentConnections) {
                this.logger.info(`Maximum concurrent sessions reached (${this.configManager.config.server.maxConcurrentConnections}). Rejecting new connection.`);
                socket.destroy();
            }
            else {
                this.logger.info(`New connection from ${socket.remoteAddress}:${socket.remotePort}`);
                const sessionMonitor = new SessionMonitor_1.SessionMonitor(socket); // Create a new SessionMonitor for this connection
                this.activeConnections.set(socket, sessionMonitor); // Store the socket and its SessionMonitor
                socket.on('close', () => {
                    this.logger.info(`Closing connection for ${socket.remoteAddress}:${socket.remotePort}`);
                    this.activeConnections.delete(socket); // Remove from the map when the socket closes
                });
            }
        });
    }
    handleHttpRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.debug(`Receveid HTTP request`);
            this.logger.debug(`Remote server ${req.url}`);
            console.log(this.configManager.config.clientIpFiltering.whitelist);
            console.log(this.configManager.config.clientIpFiltering.blacklist);
            console.log(this.configManager.config.serverIpFiltering.whitelist);
            console.log(this.configManager.config.serverIpFiltering.blacklist);
            try {
                if (!req.url) {
                    this.logger.error('Malformed HTTP request: Missing URL');
                    res.writeHead(400, 'Bad Request');
                    res.end('Bad Request: Missing URL');
                    return;
                }
                const targetHost = new URL(req.url).hostname;
                if (!targetHost) {
                    this.logger.error(`Malformed HTTP request: Invalid URL - ${req.url}`);
                    res.writeHead(400, 'Bad Request');
                    res.end('Bad Request: Invalid URL');
                    return;
                }
                if (this.isBlockedIP(req.socket.remoteAddress)) {
                    this.logger.info(`Rejected blacklisted IP: ${req.socket.remoteAddress}`);
                    res.writeHead(403);
                    res.end('Access Denied');
                    return;
                }
                if (!this.isWhitelistedIP(req.socket.remoteAddress)) {
                    this.logger.info(`IP not whitelisted: ${req.socket.remoteAddress}`);
                    res.writeHead(403);
                    res.end('Access Denied');
                    return;
                }
                if (!(yield this.authenticate(req))) {
                    res.writeHead(401);
                    res.end('Unauthorized');
                    return;
                }
                if (yield this.isBlockedServer(targetHost)) {
                    res.writeHead(403);
                    res.end('Access to the requested URL is blocked');
                    this.logger.info(`Rejected target IP: ${targetHost}`);
                    return;
                }
                if (yield !this.isWhitelistedServer(targetHost)) {
                    res.writeHead(403);
                    res.end('Access to the requested URL is not allowed');
                    this.logger.info(`Rejected target IP: ${targetHost}`);
                    return;
                }
                this.logger.debug(`Is Blocked : ${yield this.isBlockedServer(targetHost)}`);
                const httpSession = new HttpSession_1.HttpSession(req, res, this.logger, this.configManager);
                this.logger.debug(`No error in instantiation of httpSession`);
                httpSession.processRequest();
            }
            catch (error) {
                this.logger.error(`Error handling HTTP request: ${error}`);
                res.writeHead(500, 'Internal Server Error');
                res.end('Internal Server Error');
            }
        });
    }
    handleHttpsRequest(req, socket, head) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.debug(`Received HTTPS request`);
            this.logger.debug(`Received HTTPS header: ${head}`);
            this.logger.debug(`Remote server URL: ${req.url}`);
            try {
                if (!req.url) {
                    this.logger.error('Malformed HTTPS request: Missing URL');
                    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                    socket.destroy();
                    return;
                }
                let targetHost, targetPort;
                [targetHost, targetPort] = req.url.split(':');
                targetPort = targetPort || '443';
                if (!targetHost) {
                    this.logger.error(`Malformed HTTPS request: Invalid URL - ${req.url}`);
                    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                    socket.destroy();
                    return;
                }
                this.logger.info(`Parsed target host: ${targetHost}, Port: ${targetPort}`);
                if (this.isBlockedIP(socket.remoteAddress)) {
                    this.logger.info(`Rejected blacklisted IP: ${socket.remoteAddress}`);
                    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    socket.destroy();
                    return;
                }
                if (!(yield this.authenticate(req))) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }
                if (yield this.isBlockedServer(targetHost)) {
                    this.logger.info(`Access to the requested URL is blocked: ${targetHost}`);
                    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    socket.destroy();
                    return;
                }
                const httpsSession = new HttpSession_1.HttpsSession(req, socket, head, this.logger, this.configManager);
                httpsSession.processRequest();
            }
            catch (error) {
                this.logger.error(`Error handling HTTPS request: ${error}`);
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
            }
        });
    }
    isBlockedServer(hostname) {
        return this.configManager.config.serverIpFiltering.blacklist.includes(hostname.replace(/[\[\]]/g, '').replace(/^www\./, ''));
    }
    isWhitelistedServer(hostname) {
        const whitelist = this.configManager.config.serverIpFiltering.whitelist;
        if (!whitelist || whitelist.length === 0) {
            return true;
        }
        return whitelist.includes(hostname);
    }
    isBlockedIP(ip) {
        return this.configManager.config.clientIpFiltering.blacklist.includes(ip || '');
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
    authenticate(req) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clientIP = req.socket.remoteAddress || '';
                let isAuthenticated = false;
                if (this.authHandler) {
                    isAuthenticated = yield this.authHandler.authenticate('http', { headers: req.headers });
                    if (!isAuthenticated) {
                        this.incrementAuthFailure(clientIP);
                    }
                }
                else {
                    isAuthenticated = true;
                }
                return isAuthenticated;
            }
            catch (error) {
                this.logger.error(`Authentication error: ${error}`);
                return false;
            }
        });
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
                this.httpServer.listen(this.configManager.config.server.http.port, this.configManager.config.server.http.serverIP, () => {
                    this.logger.info(`HTTP/HTTPS proxy server listening on ${this.configManager.config.server.http.serverIP}:${this.configManager.config.server.http.port}`);
                    resolve();
                });
                // Handle potential errors
                this.httpServer.on('error', (error) => {
                    this.logger.error(`Error starting HTTP/HTTPS proxy server: ${error}`);
                    reject(error);
                });
            });
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                // Ensure all connections are terminated
                this.activeConnections.forEach((sessionMonitor, socket) => {
                    socket.destroy();
                });
                this.activeConnections.clear();
                this.logger.info(`Closed active connections`);
                // Close the HTTP server
                this.httpServer.close((error) => {
                    if (error) {
                        this.logger.error(`Error closing HTTP/HTTPS proxy server: ${error}`);
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
exports.HttpProxy = HttpProxy;
