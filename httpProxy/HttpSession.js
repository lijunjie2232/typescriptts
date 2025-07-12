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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpsSession = exports.HttpSession = void 0;
const http = __importStar(require("http"));
const net = __importStar(require("net"));
class HttpSession {
    constructor(req, res, logger, configManager) {
        this.req = req;
        this.res = res;
        this.logger = logger;
        this.configManager = configManager;
    }
    processRequest() {
        if (this.isWebSocketRequest()) {
            this.handleWebSocketUpgrade();
        }
        else {
            this.handleHttpRequest();
        }
    }
    getHostnameFromURL(url) {
        const hostname = new URL(url).hostname;
        return hostname;
    }
    isWebSocketRequest() {
        const upgradeHeader = this.req.headers['upgrade'];
        return (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') || false;
    }
    handleWebSocketUpgrade() {
        const targetUrl = new URL(this.req.url);
        const targetPort = targetUrl.port ? parseInt(targetUrl.port) : (targetUrl.protocol === 'https:' ? 443 : 80);
        const serverSocket = net.createConnection({
            port: targetPort,
            host: targetUrl.hostname
        }, () => {
            this.res.writeHead(101, Object.assign({ 'Upgrade': 'websocket', 'Connection': 'Upgrade' }, this.req.headers));
            serverSocket.write(this.req.rawHeaders.join('\r\n') + '\r\n\r\n');
        });
        this.req.on('data', chunk => serverSocket.write(chunk));
        serverSocket.on('data', chunk => this.req.socket.write(chunk));
        this.req.on('end', () => serverSocket.end());
        serverSocket.on('end', () => this.req.socket.end());
        this.req.on('error', (err) => this.logger.error('Request error:', err));
        serverSocket.on('error', (err) => this.logger.error('Server socket error:', err));
    }
    handleHttpRequest() {
        const requestOptions = {
            hostname: this.getHostnameFromURL(this.req.url),
            port: parseInt(new URL(this.req.url).port) || 80,
            path: new URL(this.req.url).pathname + new URL(this.req.url).search,
            method: this.req.method,
            headers: this.req.headers,
        };
        const proxyReq = http.request(requestOptions, (proxyRes) => {
            this.res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(this.res, { end: true });
        });
        proxyReq.on('error', (e) => {
            this.logger.error(`HTTP request error: ${e}`);
            this.res.writeHead(500);
            this.res.end('Internal Server Error');
        });
        this.req.on('error', (e) => {
            this.logger.error(`Client request error: ${e.message}`);
        });
        this.req.pipe(proxyReq, { end: true });
    }
}
exports.HttpSession = HttpSession;
class HttpsSession {
    constructor(req, socket, head, logger, configManager) {
        this.req = req;
        this.socket = socket;
        this.head = head;
        this.logger = logger;
        this.configManager = configManager;
    }
    processRequest() {
        if (this.isWebSocketRequest()) {
            this.handleWebSocketUpgrade();
        }
        else {
            this.handleHttpsRequest();
        }
    }
    isWebSocketRequest() {
        const upgradeHeader = this.req.headers['upgrade'];
        return (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') || false;
    }
    handleWebSocketUpgrade() {
        const targetUrl = new URL(this.req.url);
        const targetPort = targetUrl.port ? parseInt(targetUrl.port) : 443;
        const serverSocket = net.createConnection({
            port: targetPort,
            host: targetUrl.hostname
        }, () => {
            this.socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
            serverSocket.write(this.head);
        });
        this.socket.on('data', chunk => serverSocket.write(chunk));
        serverSocket.on('data', chunk => this.socket.write(chunk));
        this.socket.on('end', () => serverSocket.end());
        serverSocket.on('end', () => this.socket.end());
        this.socket.on('error', (err) => this.logger.error('Client socket error:', err));
        serverSocket.on('error', (err) => this.logger.error('Server socket error:', err));
    }
    handleHttpsRequest() {
        // Extract the hostname and port from the URL
        const { hostname, port } = this.parseHostAndPort(this.req.url);
        const serverSocket = net.connect({
            port: port,
            host: hostname
        }, () => {
            this.socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            serverSocket.write(this.head);
            serverSocket.pipe(this.socket);
            this.socket.pipe(serverSocket);
        });
        serverSocket.on('error', (err) => {
            this.logger.error(`HTTPS tunneling error: ${err.message}`);
            this.socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
            this.socket.destroy();
        });
        this.socket.on('error', (err) => {
            this.logger.error(`Client socket error: ${err.message}`);
        });
    }
    parseHostAndPort(url) {
        if (!url) {
            throw new Error('URL is undefined');
        }
        const match = url.match(/^\[?([^\]]+)]?:(\d+)$/);
        if (match) {
            return { hostname: match[1], port: parseInt(match[2], 10) };
        }
        else {
            throw new Error(`Invalid URL format: ${url}`);
        }
    }
}
exports.HttpsSession = HttpsSession;
