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
exports.BindCommandHandler = void 0;
const net = __importStar(require("net"));
const CommandHandler_1 = require("./CommandHandler");
const utils_1 = require("../utils");
class BindCommandHandler extends CommandHandler_1.CommandHandler {
    constructor(clientSocket, data, configManager, logger) {
        super(clientSocket, data, configManager, logger);
        this.listeningSocket = null;
        this.remoteSocket = null;
        this.isClosed = false;
        this.handleConnection = (socket) => {
            this.remoteSocket = socket;
            if (!socket.remoteAddress || !socket.remotePort) {
                this.logger.error('BIND command: No remote address or port');
                (0, utils_1.sendReply)(this.clientSocket, 0x01);
                this.cleanup();
                return;
            }
            const remoteAddress = socket.remoteAddress;
            const remotePort = socket.remotePort;
            (0, utils_1.sendReply)(this.clientSocket, 0x00, remoteAddress, remotePort);
            this.setupDataRelay(socket);
        };
        this.processCommand();
    }
    processCommand() {
        this.listeningSocket = new net.Server();
        this.listeningSocket.on('error', (err) => {
            this.logger.error('BIND listening socket error:', err);
            (0, utils_1.sendReply)(this.clientSocket, 0x01); // General SOCKS server failure
            this.cleanup();
        });
        this.listeningSocket.listen(0, this.configManager.config.server.socks5.serverIP, () => {
            var _a, _b;
            const address = (_a = this.listeningSocket) === null || _a === void 0 ? void 0 : _a.address();
            //this.logger.info(`BIND listening socket at ${this.listeningSocket?.address().address}:${this.listeningSocket?.address().port}`);
            (0, utils_1.sendReply)(this.clientSocket, 0x00, this.configManager.config.server.socks5.serverIP, address.port);
            (_b = this.listeningSocket) === null || _b === void 0 ? void 0 : _b.once('connection', this.handleConnection);
        });
    }
    setupDataRelay(socket) {
        socket.on('data', (data) => {
            this.logger.debug('Relaying data back to client...');
            this.clientSocket.write(data);
        });
        this.clientSocket.on('data', (data) => {
            this.logger.debug('Relaying data to remote server...');
            socket.write(data);
        });
        socket.on('close', () => {
            this.logger.info('BIND remote socket closed');
            this.cleanup();
        });
        socket.on('error', (err) => {
            this.logger.error('BIND remote socket error:', err);
            this.cleanup();
        });
    }
    relayData(data) {
        if (this.remoteSocket && !this.remoteSocket.destroyed) {
            this.remoteSocket.write(data);
        }
    }
    cleanup() {
        if (this.isClosed)
            return;
        this.isClosed = true;
        if (this.remoteSocket && !this.remoteSocket.destroyed) {
            this.remoteSocket.destroy();
            this.remoteSocket = null;
        }
        if (this.listeningSocket) {
            this.listeningSocket.close(() => {
                this.logger.info('BIND listening socket closed.');
            });
            this.listeningSocket = null;
        }
        super.cleanup();
    }
}
exports.BindCommandHandler = BindCommandHandler;
