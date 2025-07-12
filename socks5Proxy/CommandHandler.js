"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHandler = void 0;
class CommandHandler {
    constructor(clientSocket, data, configManager, logger) {
        this.clientSocket = clientSocket;
        this.data = data;
        this.configManager = configManager;
        this.logger = logger;
    }
    //abstract relayData(data: Buffer, rinfo?: dgram.RemoteInfo): void;
    // Common cleanup method for all handlers
    cleanup() {
        // Close the client socket if it's still open
        if (this.clientSocket && !this.clientSocket.destroyed) {
            this.clientSocket.end();
        }
    }
}
exports.CommandHandler = CommandHandler;
