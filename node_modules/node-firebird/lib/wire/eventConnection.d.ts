import net from 'net';
import { XdrReader } from './serialize';
declare class EventConnection {
    db: any;
    emgr: any;
    _isClosed: boolean;
    _isOpened: boolean;
    _socket: net.Socket;
    _xdr?: XdrReader;
    error: any;
    eventcallback: ((err: any, ret?: any) => void) | null;
    _connectSettled: boolean;
    _terminalErrorReported: boolean;
    _intentionalClose: boolean;
    constructor(host: string, port: number, callback: ((err?: Error) => void) | undefined, db: any);
    _bind_events(host: string, port: number, callback?: (err?: Error) => void): void;
    throwClosed(callback?: (err: any) => void): this;
}
export = EventConnection;
