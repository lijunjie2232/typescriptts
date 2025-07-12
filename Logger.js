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
exports.Logger = exports.LogOutput = exports.LogLevel = void 0;
const fs = __importStar(require("fs"));
var LogLevel;
(function (LogLevel) {
    LogLevel["Debug"] = "debug";
    LogLevel["Info"] = "info";
    LogLevel["Warn"] = "warn";
    LogLevel["Error"] = "error";
    LogLevel["None"] = "none";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var LogOutput;
(function (LogOutput) {
    LogOutput["Console"] = "console";
    LogOutput["File"] = "file";
    LogOutput["Both"] = "both";
})(LogOutput || (exports.LogOutput = LogOutput = {}));
class Logger {
    constructor(level, output, logFilePath) {
        this.level = level;
        this.output = output;
        this.logFilePath = logFilePath;
    }
    shouldLog(level) {
        if (this.level === LogLevel.None) {
            return false;
        }
        const levels = [LogLevel.Debug, LogLevel.Info, LogLevel.Warn, LogLevel.Error];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }
    logToFile(message) {
        fs.appendFile(this.logFilePath, message + '\n', err => {
            if (err) {
                console.error('Error writing to log file:', err);
            }
        });
    }
    logMessage(level, message, ...optionalParams) {
        const formattedMessage = `[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`;
        if (this.output === LogOutput.Console || this.output === LogOutput.Both) {
            console.log(formattedMessage, ...optionalParams);
        }
        if (this.output === LogOutput.File || this.output === LogOutput.Both) {
            this.logToFile(formattedMessage + ' ' + optionalParams.join(' '));
        }
    }
    debug(message, ...optionalParams) {
        if (this.shouldLog(LogLevel.Debug)) {
            this.logMessage(LogLevel.Debug, message, ...optionalParams);
        }
    }
    info(message, ...optionalParams) {
        if (this.shouldLog(LogLevel.Info)) {
            this.logMessage(LogLevel.Info, message, ...optionalParams);
        }
    }
    warn(message, ...optionalParams) {
        if (this.shouldLog(LogLevel.Warn)) {
            this.logMessage(LogLevel.Warn, message, ...optionalParams);
        }
    }
    error(message, ...optionalParams) {
        if (this.shouldLog(LogLevel.Error)) {
            this.logMessage(LogLevel.Error, message, ...optionalParams);
        }
    }
}
exports.Logger = Logger;
