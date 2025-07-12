"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionMonitor = void 0;
class SessionMonitor {
    constructor(clientSocket) {
        this.clientSocket = clientSocket;
        this.bytesRead = 0;
        this.bytesWritten = 0;
        this.lastCheckedReadBytes = 0;
        this.lastCheckedWrittenBytes = 0;
        this.lastCheckedTime = Date.now();
        const originalWrite = this.clientSocket.write.bind(this.clientSocket);
        this.clientSocket.write = (data, ...args) => {
            //console.log('Overridden write called');
            this.bytesWritten += data instanceof Buffer ? data.length : Buffer.byteLength(data);
            //console.log('Updated bytesWritten:', this.bytesWritten);
            return originalWrite(data, ...args);
        };
        // Handle 'data' event for bytesRead
        this.clientSocket.on('data', (data) => {
            this.bytesRead += data.length;
        });
    }
    getCurrentNetworkSpeed() {
        const currentTime = Date.now();
        const timeElapsed = (currentTime - this.lastCheckedTime) / 1000; // Convert to seconds
        const bytesReadSinceLastCheck = this.bytesRead - this.lastCheckedReadBytes;
        const bytesWrittenSinceLastCheck = this.bytesWritten - this.lastCheckedWrittenBytes;
        const readSpeed = bytesReadSinceLastCheck / timeElapsed; // Bytes per second
        const writeSpeed = bytesWrittenSinceLastCheck / timeElapsed; // Bytes per second
        // Update for next check
        this.lastCheckedTime = currentTime;
        this.lastCheckedReadBytes = this.bytesRead;
        this.lastCheckedWrittenBytes = this.bytesWritten;
        return { readSpeed, writeSpeed };
    }
    getTotalSessionBandwidth() {
        return {
            totalRead: this.bytesRead,
            totalWritten: this.bytesWritten
        };
    }
    getBytesRead() {
        return this.bytesRead;
    }
    getBytesWritten() {
        return this.bytesWritten;
    }
}
exports.SessionMonitor = SessionMonitor;
