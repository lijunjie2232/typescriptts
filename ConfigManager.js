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
exports.ConfigManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Hot-patching will only works on field that are dynamically checked
// Will not work on ports, ip address, credentials, auth method
// Should be used for persisting config (client Blacklist after failed auth notably)
// TO REFACTOR --> Make config attributes private, create getter method and use it in other class to access the ServerConfig attribute
// Update blacklist with setter method. This way ServerConfig are protected against unexpected modifications and only allow for update via specific setter methods
class ConfigManager {
    constructor(configPath) {
        this.configFilePath = configPath;
        this.config = this.loadConfig(configPath);
    }
    loadConfig(configPath) {
        const fullPath = path.resolve(configPath);
        const configData = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(configData);
    }
    persistConfig() {
        const fullPath = path.resolve(this.configFilePath);
        const configData = JSON.stringify(this.config, null, 4); // Beautify the JSON output
        fs.writeFileSync(fullPath, configData, 'utf8');
    }
    updateClientIpBlackList(clientBlacklistedIp) {
        this.config.clientIpFiltering.blacklist = clientBlacklistedIp;
    }
    updateClientIpWhitelist(clientWhiteListedIp) {
        this.config.clientIpFiltering.whitelist = clientWhiteListedIp;
    }
    updateServerIpBlackList(serverBlacklistedIp) {
        this.config.serverIpFiltering.blacklist = serverBlacklistedIp;
    }
    updateServerIpWhitelist(serverWhiteListedIp) {
        this.config.serverIpFiltering.whitelist = serverWhiteListedIp;
    }
    getClientIpBlackList() {
        return this.config.clientIpFiltering.blacklist;
    }
    getClientIpWhitelist() {
        return this.config.clientIpFiltering.whitelist;
    }
    getServerIpBlackList() {
        return this.config.serverIpFiltering.blacklist;
    }
    getServerIpWhitelist() {
        return this.config.serverIpFiltering.whitelist;
    }
}
exports.ConfigManager = ConfigManager;
