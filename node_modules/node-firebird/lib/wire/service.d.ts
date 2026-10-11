import Events from 'events';
import stream from 'stream';
import { BlrReader } from './serialize';
/***************************************
 *
 *   Service Manager
 *
 ***************************************/
declare class ServiceManager extends Events.EventEmitter {
    static ShutdownMode: {
        NORMAL: number;
        MULTI: number;
        SINGLE: number;
        FULL: number;
    };
    static ShutdownKind: {
        FORCED: number;
        DENY_TRANSACTION: number;
        DENY_ATTACHMENT: number;
    };
    connection: any;
    constructor(connection: any);
    _createOutputStream(optread: string | null | undefined, buffersize: number | null | undefined, callback: (err: any, stream?: stream.Readable) => void): void;
    _infosmapping: Record<string | number, string>;
    _processcapabilities(blr: BlrReader, res: any): void;
    _processdbinfo(blr: BlrReader, res: any): void;
    _processquery(buffer: Buffer, callback: (err: any, res?: any) => void): void;
    detach(callback?: (err?: any, obj?: any) => void, force?: boolean): this;
    backup(options: any, callback: (err: any, stream?: stream.Readable) => void): void;
    nbackup(options: any, callback: (err: any, stream?: stream.Readable) => void): void;
    restore(options: any, callback: (err: any, stream?: stream.Readable) => void): void;
    nrestore(options: any, callback: (err: any, stream?: stream.Readable) => void): void;
    _fixpropertie(options: any, callback: (err: any, stream?: stream.Readable) => void): void;
    setDialect(db: string, dialect: number, callback: any): void;
    setSweepinterval(db: string, sweepinterval: number, callback: any): void;
    setCachebuffer(db: string, nbpages: number, callback: any): void;
    BringOnline(db: string, callback: any): void;
    Shutdown(db: string, kind: number, delay: number, mode?: any, callback?: any): void;
    setShadow(db: string, val: boolean, callback: any): void;
    setForcewrite(db: string, val: boolean, callback: any): void;
    setReservespace(db: string, val: boolean, callback: any): void;
    setReadonlyMode(db: string, callback: any): void;
    setReadwriteMode(db: string, callback: any): void;
    validate(options: any, callback: (err: any, stream?: stream.Readable) => void): void;
    commit(db: string, transactid: number, callback: any): void;
    rollback(db: string, transactid: number, callback: any): void;
    recover(db: string, transactid: number, callback: any): void;
    getStats(options: any, callback: (err: any, stream?: stream.Readable) => void): void;
    getLog(options: any, callback: (err: any, stream?: stream.Readable) => void): void;
    getUsers(username: string | null, callback: any): void;
    addUser(username: string, password: string, options: any, callback: any): void;
    editUser(username: string, options: any, callback: any): void;
    removeUser(username: string, rolename: string | null, callback: any): void;
    getFbserverInfos(infos: any, options: any, callback: any): void;
    startTrace(options: any, callback: any): void;
    suspendTrace(options: any, callback: any): void;
    resumeTrace(options: any, callback: any): void;
    stopTrace(options: any, callback: any): void;
    getTraceList(options: any, callback: any): void;
    readline(options: any, callback: any): void;
    readeof(options: any, callback: any): void;
    hasRunningAction(options: any, callback: any): void;
    readusers(options: any, callback: any): void;
    readlimbo(options: any, callback: any): void;
    detachAsync(force?: boolean): Promise<void>;
    backupAsync(options: any): Promise<stream.Readable>;
    nbackupAsync(options: any): Promise<stream.Readable>;
    restoreAsync(options: any): Promise<stream.Readable>;
    nrestoreAsync(options: any): Promise<stream.Readable>;
    setDialectAsync(db: string, dialect: number): Promise<any>;
    setSweepintervalAsync(db: string, sweepinterval: number): Promise<any>;
    setCachebufferAsync(db: string, nbpages: number): Promise<any>;
    BringOnlineAsync(db: string): Promise<any>;
    ShutdownAsync(db: string, kind: number, delay: number, mode?: any): Promise<any>;
    setShadowAsync(db: string, val: boolean): Promise<any>;
    setForcewriteAsync(db: string, val: boolean): Promise<any>;
    setReservespaceAsync(db: string, val: boolean): Promise<any>;
    setReadonlyModeAsync(db: string): Promise<any>;
    setReadwriteModeAsync(db: string): Promise<any>;
    validateAsync(options: any): Promise<stream.Readable>;
    commitAsync(db: string, transactid: number): Promise<any>;
    rollbackAsync(db: string, transactid: number): Promise<any>;
    recoverAsync(db: string, transactid: number): Promise<any>;
    getStatsAsync(options: any): Promise<stream.Readable>;
    getLogAsync(options: any): Promise<stream.Readable>;
    getUsersAsync(username?: string | null): Promise<any>;
    addUserAsync(username: string, password: string, options?: any): Promise<any>;
    editUserAsync(username: string, options: any): Promise<any>;
    removeUserAsync(username: string, rolename?: string | null): Promise<any>;
    getFbserverInfosAsync(infos?: any, options?: any): Promise<any>;
    startTraceAsync(options: any): Promise<stream.Readable>;
    suspendTraceAsync(options: any): Promise<stream.Readable>;
    resumeTraceAsync(options: any): Promise<stream.Readable>;
    stopTraceAsync(options: any): Promise<stream.Readable>;
    getTraceListAsync(options?: any): Promise<stream.Readable>;
    readlineAsync(options?: any): Promise<{
        result: number;
        line: string;
    }>;
    readeofAsync(options?: any): Promise<{
        result: number;
        line: string;
    }>;
    hasRunningActionAsync(options?: any): Promise<any>;
    readusersAsync(options?: any): Promise<any>;
    readlimboAsync(options?: any): Promise<any>;
}
export = ServiceManager;
