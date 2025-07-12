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
exports.UserPassAuth = void 0;
/*// No Authentication
class NoAuth implements IAuthMethod {

    async authenticate(socket: net.Socket, data: Buffer): Promise<boolean> {
        // No authentication required, always return true
        return true;
    }
}*/
// Username/Password Authentication
class UserPassAuth {
    constructor(credentials) {
        this.validCredentials = new Map();
        this.loadCredentials(credentials);
    }
    loadCredentials(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            credentials.forEach(credential => {
                const { username, password } = credential;
                this.validCredentials.set(username, password);
            });
        });
    }
    authenticate(protocol, args) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (protocol) {
                case 'socks5':
                    return this.authenticateSocks5(args.socket, args.data);
                case 'http':
                    return this.authenticateHttp(args.headers);
                default:
                    return false;
            }
        });
    }
    authenticateSocks5(socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Extract username and password from the data buffer
            let result;
            const usernameLength = data[1]; // Username length at index 0
            const username = data.slice(2, 2 + usernameLength).toString(); // Start from index 1
            const passwordLength = data[2 + usernameLength]; // Password length
            const password = data.slice(3 + usernameLength, 3 + usernameLength + passwordLength).toString(); // Password
            // Check if the credentials are valid
            const storedPassword = this.validCredentials.get(username);
            if (!storedPassword) {
                return false;
            }
            return password === storedPassword;
        });
    }
    authenticateHttp(headers) {
        return __awaiter(this, void 0, void 0, function* () {
            const authHeader = headers['proxy-authorization'];
            if (!authHeader) {
                return false;
            }
            const encodedCreds = authHeader.split(' ')[1];
            const decodedCreds = Buffer.from(encodedCreds, 'base64').toString();
            const [username, password] = decodedCreds.split(':');
            const storedPassword = this.validCredentials.get(username);
            if (!storedPassword) {
                return false;
            }
            return password === storedPassword;
        });
    }
}
exports.UserPassAuth = UserPassAuth;
