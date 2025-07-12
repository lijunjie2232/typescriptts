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
exports.UdpAssociateHandler = void 0;
const net = __importStar(require("net"));
const dgram = __importStar(require("dgram"));
const CommandHandler_1 = require("./CommandHandler");
const utils_1 = require("../utils");
;
class UdpAssociateHandler extends CommandHandler_1.CommandHandler {
    constructor(clientSocket, data, configManager, udpPort, logger) {
        super(clientSocket, data, configManager, logger);
        this.isSocketClosed = false;
        this.udpPort = udpPort;
        this.udpSocket = dgram.createSocket('udp4');
        this.clientSessions = new Map();
        this.listenForUdpDatagrams();
        this.processCommand();
        this.clientSocket.on('close', () => {
            this.cleanup();
        });
    }
    processCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.sendUdpAssociateResponse(this.udpPort);
            }
            catch (error) {
                this.logger.error('Error processing UDP associate command:', error);
            }
        });
    }
    sendUdpAssociateResponse(port) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = this.createUdpAssociateResponse(port);
            this.clientSocket.write(response, (err) => {
                if (err) {
                    this.logger.error('Error sending UDP associate response:', err);
                }
            });
        });
    }
    createUdpAssociateResponse(port) {
        const serverIp = this.configManager.config.server.socks5.serverIP;
        const ipBuffer = Buffer.from(serverIp.split('.').map(Number));
        const response = Buffer.alloc(10);
        response[0] = 0x05; // SOCKS version
        response[1] = 0x00; // Success
        response[2] = 0x00; // Reserved
        response[3] = 0x01; // Address type (IPv4)
        ipBuffer.copy(response, 4); // Server IP
        response.writeUInt16BE(port, 8); // Server Port
        return response;
    }
    listenForUdpDatagrams() {
        this.udpSocket.bind({ port: this.udpPort, address: this.configManager.config.server.socks5.serverIP }, () => {
            this.logger.info(`UDP socket bound to ${this.configManager.config.server.socks5.serverIP} and listening on port ${this.udpPort}`);
        });
        this.udpSocket.on('message', (msg, rinfo) => {
            this.logger.debug(`Received UDP message from ${rinfo.address}:${rinfo.port}: ${msg.toString('hex')}`);
            this.handleUdpDatagram(msg, rinfo);
        });
        this.udpSocket.on('error', (err) => {
            this.logger.error('UDP socket error:', err);
            this.cleanup();
        });
        this.udpSocket.on('close', () => {
            this.logger.info('UDP socket closed');
            this.cleanup();
        });
    }
    handleUdpDatagram(msg, rinfo) {
        if (rinfo) {
            try {
                this.logger.debug("Msg :", msg);
                this.logger.debug("Rinfo :", rinfo);
                const clientKey = `${rinfo.address}:${rinfo.port}`;
                let session = this.clientSessions.get(clientKey);
                this.logger.debug("Sessions:", this.clientSessions);
                this.logger.debug("clientKey:", clientKey);
                this.logger.debug("session:", session);
                if (!session && this.isSocks5Message(msg)) {
                    // It's a new session from the client
                    const { host, port } = (0, utils_1.parseDestination)(msg);
                    session = { clientAddress: rinfo.address, clientPort: rinfo.port, destinationAddress: host, destinationPort: port };
                    this.clientSessions.set(clientKey, session);
                }
                else {
                    session = this.findSessionByDestination(rinfo.address, rinfo.port);
                }
                if (session) {
                    this.logger.debug("rinfo address:", rinfo.address);
                    this.logger.debug("rinfo port:", rinfo.port);
                    this.logger.debug("session.clientAddress:", session.clientAddress);
                    this.logger.debug("session.clientPort:", session.clientPort);
                    this.logger.debug("session.destinationAddress:", session.destinationAddress);
                    this.logger.debug("session.destinationPort:", session.destinationPort);
                    if (rinfo.address === session.clientAddress && rinfo.port === session.clientPort) {
                        this.logger.debug('Message above is from client');
                        // Message is from the client
                        if (this.isSocks5Message(msg)) {
                            // If it's a SOCKS5 message, forward it to the remote server
                            this.sendToRemoteServer(msg, session);
                            this.logger.debug('Message above forwarded to remote server');
                        }
                    }
                    else if (session.destinationAddress === rinfo.address && session.destinationPort === rinfo.port) {
                        this.logger.debug('Message above is from remote server');
                        // Message is from the remote server, forward it to the client
                        this.sendToClient(msg, session);
                        this.logger.debug('Message above forwarded to client');
                    }
                }
            }
            catch (error) {
                this.logger.error('Error processing UDP associate command:', error);
            }
        }
        else {
            this.logger.error('Error processing UDP associate command: rinfo not provided');
        }
    }
    isSocks5Message(msg) {
        // Check if the message has a minimum length and a valid SOCKS5 header
        return msg.length > 10 && (msg[3] === 0x01 || msg[3] === 0x03 || msg[3] === 0x04); // Checks for IPv4, Domain, and IPv6
    }
    findSessionByDestination(address, port) {
        for (let [key, session] of this.clientSessions.entries()) {
            if (session.destinationAddress === address && session.destinationPort === port) {
                return session;
            }
        }
        return undefined;
    }
    sendToRemoteServer(msg, session) {
        const payloadStartIndex = (0, utils_1.determinePayloadStartIndex)(msg);
        const payload = msg.slice(payloadStartIndex);
        if (session.destinationAddress && session.destinationPort) {
            this.udpSocket.send(payload, session.destinationPort, session.destinationAddress, (err) => {
                if (err) {
                    this.logger.error('Error sending to remote server:', err);
                }
                this.logger.info(`Send to remote server at ${session.destinationAddress}:${session.destinationPort}`);
            });
        }
    }
    sendToClient(msg, session) {
        if (session && session.clientAddress && session.clientPort) {
            const response = this.constructSocks5Response(msg, session.clientAddress, session.clientPort);
            this.udpSocket.send(response, session.clientPort, session.clientAddress, (err) => {
                if (err) {
                    this.logger.error('Error sending to client:', err);
                }
                this.logger.info(`Send to client at ${session.clientAddress}:${session.clientPort}`);
            });
        }
    }
    constructSocks5Response(msg, clientAddress, clientPort) {
        const reserved = Buffer.alloc(2); // Reserved bytes set to zero
        const fragmentNumber = Buffer.from([0x00]); // Fragment number
        const addressType = net.isIPv6(clientAddress) ? 0x04 : 0x01; // Address type (IPv4 or IPv6)
        const addressBuffer = net.isIPv6(clientAddress) ? this.convertIPv6Address(clientAddress) : Buffer.from(clientAddress.split('.').map(Number));
        const portBuffer = Buffer.alloc(2);
        portBuffer.writeUInt16BE(clientPort, 0);
        return Buffer.concat([
            reserved,
            fragmentNumber,
            Buffer.from([addressType]),
            addressBuffer,
            portBuffer,
            msg
        ]);
    }
    convertIPv6Address(address) {
        return Buffer.from(address.split(':').flatMap(part => {
            if (part.length === 0) {
                return Array(4).fill(0);
            }
            else {
                const matches = part.match(/.{1,2}/g) || []; // Fallback to empty array if null
                return matches.map(byte => parseInt(byte, 16));
            }
        }));
    }
    cleanup() {
        this.logger.info('Cleaning UDP command handler');
        if (this.isSocketClosed)
            return;
        this.isSocketClosed = true;
        this.udpSocket.removeAllListeners();
        this.udpSocket.close(() => {
            this.logger.info('UDP socket closed.');
        });
        super.cleanup(); // Clean up any resources allocated by the parent class
    }
}
exports.UdpAssociateHandler = UdpAssociateHandler;
