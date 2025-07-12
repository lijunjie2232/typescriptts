"use strict";
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
exports.SocksSession = void 0;
const utils_1 = require("../utils");
const Auth_1 = require("../Auth");
const ConnectCommandHandler_1 = require("./ConnectCommandHandler");
const BindCommandHandler_1 = require("./BindCommandHandler");
const UDPAssociateCommandHandler_1 = require("./UDPAssociateCommandHandler");
const SessionMonitor_1 = require("../SessionMonitor");
var SocksSessionState;
(function (SocksSessionState) {
    SocksSessionState[SocksSessionState["AwaitingGreeting"] = 0] = "AwaitingGreeting";
    SocksSessionState[SocksSessionState["AwaitingAuthentication"] = 1] = "AwaitingAuthentication";
    SocksSessionState[SocksSessionState["AwaitingInitialCommand"] = 2] = "AwaitingInitialCommand";
    SocksSessionState[SocksSessionState["DataRelayMode"] = 3] = "DataRelayMode";
})(SocksSessionState || (SocksSessionState = {}));
class SocksSession {
    constructor(clientSocket, configManager, logger, incrementAuthFailure) {
        this.clientSocket = clientSocket;
        this.state = SocksSessionState.AwaitingGreeting;
        this.isGreetingHandled = false;
        this.handleData = (data) => __awaiter(this, void 0, void 0, function* () {
            this.logger.debug(`Received data : `, data);
            switch (this.state) {
                case SocksSessionState.AwaitingGreeting:
                    this.handleGreeting(data);
                    break;
                case SocksSessionState.AwaitingAuthentication:
                    yield this.handleAuth(data);
                    break;
                case SocksSessionState.AwaitingInitialCommand:
                    this.handleCommand(data);
                    break;
                case SocksSessionState.DataRelayMode:
                    break;
            }
        });
        this.configManager = configManager;
        this.logger = logger;
        this.incrementAuthFailure = incrementAuthFailure;
        this.monitor = new SessionMonitor_1.SessionMonitor(clientSocket);
        this.logger.info(`Initialize new session`);
        // Instantiate the appropriate authentication handler
        if (this.configManager.config.authentication.method === 'password') {
            this.authHandler = new Auth_1.UserPassAuth(this.configManager.config.credentials);
        }
        else {
            this.authHandler = null;
        }
        this.sessionCleanup = this.sessionCleanup.bind(this);
        this.clientSocket = clientSocket;
        this.udpPort = this.assignUdpPort();
        this.logger.info(`UDP port assigned : ${this.udpPort}`);
        this.clientSocket.on('data', this.handleData);
        this.clientSocket.on('close', this.sessionCleanup);
        this.clientSocket.on('error', this.sessionCleanup);
    }
    handleGreeting(data) {
        const version = data[0];
        const nMethods = data[1];
        const methods = data.slice(2, 2 + nMethods);
        if (version !== 0x05) {
            // Unsupported SOCKS protocol version
            this.clientSocket.end();
            return;
        }
        if (methods.includes(0x02) && this.authHandler instanceof Auth_1.UserPassAuth) { // user/pass auth
            this.clientSocket.write(Buffer.from([0x05, 0x02]));
            this.isGreetingHandled = true;
            this.logger.info(`Successfull greeting`);
        }
        else if (methods.includes(0x00 && this.authHandler === null)) { // No Authentication Required
            this.clientSocket.write(Buffer.from([0x05, 0x00]));
            this.isGreetingHandled = true;
            this.logger.info(`Successfull greeting`);
        }
        else {
            // No acceptable methods
            this.clientSocket.write(Buffer.from([0x05, 0xff]));
            this.clientSocket.end();
        }
        this.state = this.authHandler ? SocksSessionState.AwaitingAuthentication : SocksSessionState.AwaitingInitialCommand;
    }
    handleAuth(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const clientIP = this.clientSocket.remoteAddress || '';
            let isAuthenticated;
            if (this.authHandler) {
                isAuthenticated = yield this.authHandler.authenticate('socks5', { socket: this.clientSocket, data: data });
                if (isAuthenticated) {
                    this.logger.info(`Successful authentication`);
                    const response = Buffer.from([0x05, 0x00]); // Success
                    this.clientSocket.write(response);
                    this.authHandler = null; // Authentication complete, no longer needed
                }
                else {
                    this.incrementAuthFailure(clientIP);
                    const response = Buffer.from([0x05, 0x01]); // Failure
                    this.logger.info(`Failed authentication`);
                    this.clientSocket.write(response);
                    this.clientSocket.end(); // Close the connection on authentication failure
                }
            }
            else {
                isAuthenticated = true;
                const response = Buffer.from([0x05, 0x00]); // Success
                this.clientSocket.write(response);
            }
            // After successful authentication, transition to awaiting initial command state
            if (isAuthenticated) {
                this.state = SocksSessionState.AwaitingInitialCommand;
            }
        });
    }
    handleCommand(data) {
        const { host, port } = (0, utils_1.parseDestination)(data);
        this.filterAccess(host, () => {
            const command = data[1];
            switch (command) {
                case 0x01: // CONNECT
                    this.logger.info(`CONNECT command received`);
                    this.commandHandler = new ConnectCommandHandler_1.ConnectCommandHandler(this.clientSocket, data, this.configManager, this.logger);
                    this.state = SocksSessionState.DataRelayMode;
                    break;
                case 0x02: // BIND
                    this.logger.info(`BIND command received`);
                    this.commandHandler = new BindCommandHandler_1.BindCommandHandler(this.clientSocket, data, this.configManager, this.logger);
                    this.state = SocksSessionState.DataRelayMode;
                    break;
                case 0x03: // UDP ASSOCIATE
                    this.logger.info(`UDP ASSOCIATE command received`);
                    this.commandHandler = new UDPAssociateCommandHandler_1.UdpAssociateHandler(this.clientSocket, data, this.configManager, this.udpPort, this.logger);
                    this.state = SocksSessionState.DataRelayMode;
                    break;
            }
        });
    }
    filterAccess(host, onSuccess) {
        if (this.isBlockedIP(host)) {
            this.logger.info(`Access to IP ${host} blocked by server policy`);
            this.clientSocket.end();
            return;
        }
        if (!this.isWhitelistedIP(host)) {
            this.logger.info(`Access to IP ${host} not allowed by server policy`);
            this.clientSocket.end();
            return;
        }
        onSuccess();
    }
    isWhitelistedIP(hostname) {
        const whitelist = this.configManager.config.serverIpFiltering.whitelist;
        if (!whitelist || whitelist.length === 0) {
            return true;
        }
        return whitelist.includes(hostname);
    }
    isBlockedIP(ip) {
        return this.configManager.config.serverIpFiltering.blacklist.includes(ip);
    }
    assignUdpPort() {
        for (let port = this.configManager.config.server.socks5.udpPortRange.min; port <= this.configManager.config.server.socks5.udpPortRange.max; port++) {
            if (!SocksSession.usedUdpPorts.has(port)) {
                SocksSession.usedUdpPorts.add(port);
                return port;
            }
        }
        throw new Error('No available UDP ports');
    }
    sessionCleanup() {
        SocksSession.usedUdpPorts.delete(this.udpPort);
        // Other cleanup code
        if (this.clientSocket && !this.clientSocket.destroyed) {
            this.clientSocket.end();
        }
        this.logger.info(`Cleaned up session`);
    }
}
exports.SocksSession = SocksSession;
SocksSession.usedUdpPorts = new Set();
