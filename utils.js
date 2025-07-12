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
exports.determinePayloadStartIndex = exports.sendReply = exports.parseDestination = void 0;
const net = __importStar(require("net"));
const parseDestination = (data) => {
    const addressType = data[3]; // Address type is the 4th byte
    let host;
    let port;
    let addressEnd;
    switch (addressType) {
        case 0x01: // IPv4
            host = `${data[4]}.${data[5]}.${data[6]}.${data[7]}`;
            addressEnd = 8;
            break;
        case 0x03: // Domain name
            const domainLength = data[4];
            host = data.slice(5, 5 + domainLength).toString();
            addressEnd = 5 + domainLength;
            if (addressEnd + 2 > data.length) {
                throw new Error('Buffer does not contain enough data for address and port');
            }
            break;
        case 0x04: // IPv6
            const ipv6 = data.slice(4, 20).toString('hex').match(/.{1,4}/g);
            if (!ipv6 || data.length < 20) {
                throw new Error('Invalid IPv6 address');
            }
            host = ipv6.join(':');
            addressEnd = 20;
            break;
        default:
            throw new Error('Unsupported address type');
    }
    port = data.readUInt16BE(addressEnd); // Port is 2 bytes, big-endian
    return { host, port };
};
exports.parseDestination = parseDestination;
const sendReply = (socket, replyCode, bindAddress = '0.0.0.0', bindPort = 0) => {
    let response;
    let addressBuffer;
    if (net.isIPv4(bindAddress)) {
        // IPv4 Address
        response = Buffer.alloc(10); // IPv4 response size
        response[3] = 0x01; // Address type IPv4
        addressBuffer = Buffer.from(bindAddress.split('.').map(Number));
    }
    else if (net.isIPv6(bindAddress)) {
        // IPv6 Address
        response = Buffer.alloc(22); // IPv6 response size
        response[3] = 0x04; // Address type IPv6
        const ipv6Parts = bindAddress.split(':');
        const ipv6BufferArray = ipv6Parts.flatMap(part => {
            if (part === '') {
                // Fill the gap in a shorthand IPv6 address with zeros
                return Array(16 - ipv6Parts.length + 1).fill(0).map(() => 0);
            }
            const partMatches = part.match(/.{1,2}/g) || [];
            return partMatches.map(byte => parseInt(byte, 16));
        });
        addressBuffer = Buffer.from(ipv6BufferArray);
    }
    else {
        // Domain Name
        const domainNameBuffer = Buffer.from(bindAddress);
        response = Buffer.alloc(7 + domainNameBuffer.length); // Domain name response size
        response[3] = 0x03; // Address type Domain Name
        response[4] = domainNameBuffer.length; // Domain name length
        addressBuffer = domainNameBuffer;
    }
    response[0] = 0x05; // SOCKS version
    response[1] = replyCode; // Reply code
    response[2] = 0x00; // Reserved
    // Copy address and port to the response buffer
    addressBuffer.copy(response, response[3] === 0x03 ? 5 : 4); // Offset depends on address type
    response.writeUInt16BE(bindPort, response.length - 2);
    socket.write(response);
};
exports.sendReply = sendReply;
const determinePayloadStartIndex = (msg) => {
    // The address type is specified in the 4th byte of the message
    const addressType = msg[3];
    let headerLength;
    switch (addressType) {
        case 0x01: // IPv4 Address
            headerLength = 4 + 4; // 4 bytes for address type, IPv4 address
            break;
        case 0x03: // Domain Name
            const domainNameLength = msg[4]; // The length of the domain name
            headerLength = 4 + 1 + domainNameLength; // 4 bytes for address type, 1 byte for length, domain name
            break;
        case 0x04: // IPv6 Address
            headerLength = 4 + 16; // 4 bytes for address type, IPv6 address
            break;
        default:
            throw new Error('Unsupported address type');
    }
    // Adding 2 bytes for the port number at the end of the header
    return headerLength + 2; // Total header length including the port
};
exports.determinePayloadStartIndex = determinePayloadStartIndex;
