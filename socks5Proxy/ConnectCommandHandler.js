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
exports.ConnectCommandHandler = void 0;
const net = __importStar(require("net"));
const utils_1 = require("../utils");
const CommandHandler_1 = require("./CommandHandler");
class ConnectCommandHandler extends CommandHandler_1.CommandHandler {
    constructor(clientSocket, data, configManager, logger) {
        super(clientSocket, data, configManager, logger);
        this.destinationSocket = null;
        this.processCommand();
    }
    processCommand() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.debug("Processing CONNECT command");
            const version = this.data[0];
            const command = this.data[1];
            const reserved = this.data[2];
            if (version !== 0x05 || command !== 0x01 || reserved !== 0x00) {
                this.logger.error("Invalid CONNECT command or version");
                (0, utils_1.sendReply)(this.clientSocket, 0x01); // General SOCKS server failure
                this.cleanup();
                return;
            }
            try {
                const destination = (0, utils_1.parseDestination)(this.data);
                this.logger.info(`Attempting to connect to ${destination.host}:${destination.port}`);
                this.destinationSocket = net.createConnection({
                    host: destination.host,
                    port: destination.port
                }, () => {
                    this.logger.info("Connection to remote server established");
                    (0, utils_1.sendReply)(this.clientSocket, 0x00); // Success
                    this.setupDataRelay();
                });
                this.destinationSocket.on('error', (err) => {
                    this.logger.error("Remote connection error: ", err);
                    (0, utils_1.sendReply)(this.clientSocket, 0x01); // General SOCKS server failure
                    this.cleanup();
                });
            }
            catch (error) {
                this.logger.error("Error processing CONNECT command: ", error);
                (0, utils_1.sendReply)(this.clientSocket, 0x01); // General SOCKS server failure
                this.cleanup();
            }
        });
    }
    setupDataRelay() {
        if (!this.destinationSocket)
            return;
        // Relay from client to destination
        this.clientSocket.on('data', (data) => {
            var _a;
            this.logger.debug("Relaying data to remote server...", data);
            (_a = this.destinationSocket) === null || _a === void 0 ? void 0 : _a.write(data);
        });
        // Relay from destination back to client
        this.destinationSocket.on('data', (data) => {
            this.logger.debug("Relaying data back to client...", data);
            this.clientSocket.write(data);
        });
        // Cleanup on client socket end
        this.clientSocket.on('end', () => this.cleanup());
        this.clientSocket.on('error', (err) => {
            this.logger.debug('Error from client socket:', err);
            this.cleanup();
        });
    }
    relayData(data) {
        // This method might not be necessary if all data relay is handled within processCommand
    }
    cleanup() {
        this.logger.info("Cleaning up CONNECT command handler");
        if (this.destinationSocket && !this.destinationSocket.destroyed) {
            this.destinationSocket.destroy();
            this.destinationSocket = null;
        }
        if (!this.clientSocket.destroyed) {
            this.clientSocket.destroy();
        }
        super.cleanup();
    }
}
exports.ConnectCommandHandler = ConnectCommandHandler;
