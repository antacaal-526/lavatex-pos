import { XdrWriter, BlrWriter, XdrReader } from './serialize';
import { type Callback, type SimpleCallback } from '../callback';
import * as srp from '../srp';
import * as Xsql from './xsqlvar';
import ServiceManager from './service';
import Database from './database';
import Statement from './statement';
import Transaction from './transaction';
import Socket from './socket';
import type { QueueCallback, QueueEntry, WireResponse, InternalOptions, InternalQueryOptions, BatchCb, Quad, AcceptPacket } from './wire-types';
import type { BatchOptions, QueryParams } from '../types';
declare function parseValueIfJson(value: any, options: any): any;
/***************************************
 *
 *   Connection
 *
 ***************************************/
declare class Connection {
    static decodeResponse: typeof decodeResponse;
    static fetch_blob_async_transaction: typeof fetch_blob_async_transaction;
    static fetch_blob_async: typeof fetch_blob_async;
    static parseValueIfJson: typeof parseValueIfJson;
    static describe: typeof describe;
    db: Database;
    svc: ServiceManager | undefined;
    options: InternalOptions;
    /** protocol negotiation result (op_accept / op_cond_accept / op_accept_data);
     *  populated during the connect/attach handshake */
    accept: AcceptPacket;
    error: any;
    dbhandle: number | undefined;
    svchandle: number | undefined;
    clientKeys: srp.KeyPair | undefined;
    serverKeys: {
        salt: string;
        public: bigint;
        pluginName: string;
    } | undefined;
    _msg: XdrWriter;
    _blr: BlrWriter;
    /** response queue: one entry per expected server response (see wire-types) */
    _queue: QueueEntry[];
    _pending: string[];
    _socket: Socket;
    /** partially received packet buffered between 'data' events */
    _xdr: XdrReader | undefined;
    _isOpened: boolean;
    _isClosed: boolean;
    _isDetach: boolean;
    _isUsed: boolean;
    _pooled: boolean;
    _lowercase_keys: boolean | undefined;
    _detachTimeout: any;
    _detachCallback: any;
    _detachAuto: any;
    _retry_connection_id: any;
    _retry_connection_interval: number;
    _statementCacheSize: number;
    _statementCache: Map<string, Statement> | null;
    _messageFile: string;
    _authStartTime: number | undefined;
    _pendingAccept: any;
    _inlineBlobs: Map<string, Buffer> | undefined;
    constructor(host: string, port: number, callback: SimpleCallback | undefined, options: InternalOptions, db?: Database, svc?: ServiceManager);
    /**
     * Take an idle prepared statement for `query` out of the cache, or null.
     * The statement leaves the cache while in use, so concurrent callers of
     * the same query never share a server-side cursor — they simply prepare
     * a fresh statement and the spare is dropped when released.
     */
    takeCachedStatement(query: string): Statement | null;
    /**
     * Return a statement after use. With the statement cache enabled the
     * statement goes back into the cache as most-recently-used (closing its
     * cursor but keeping the prepared handle), evicting the least-recently
     * used statement over the limit. Failed statements, DDL and spares for
     * an already-cached query are dropped instead.
     */
    releaseStatement(statement: Statement, callback?: QueueCallback): void;
    _rejectPending(err: any): void;
    /**
     * Deliver a connection-level error to 'error' listeners — and ONLY to
     * listeners. Emitting an unlistened 'error' makes Node throw the error
     * object as an uncaught exception; for errors that originate in
     * background contexts (the reconnect timer, socket-level failures whose
     * operations are separately rejected via _rejectPending) that crashes
     * the process — or, under a test runner, fails whatever unrelated test
     * happens to be running. The failing operations themselves always
     * still receive their error through their own callbacks.
     */
    _emitError(err: any): void;
    _bind_events(host: string, port: number, callback: SimpleCallback | undefined): void;
    disconnect(): void;
    sendOpContAuth(authData: string, authDataEnc: BufferEncoding, pluginName: string): void;
    sendOpCrypt(encryptPlugin: string): void;
    sendOpCryptKeyCallback(pluginData: BlrWriter): void;
    /**
     * Send an out-of-band op_cancel packet (protocol 12+ / Firebird 2.5+).
     * The server reads it asynchronously while an operation is executing and
     * makes that operation fail with isc_cancelled (GDSCode.CANCELLED); the
     * op_cancel packet itself has no response, so nothing is queued here.
     */
    cancelOperation(kind?: number | SimpleCallback, callback?: SimpleCallback): this | undefined;
    /** Write a prebuilt packet and queue its response callback. */
    _queueEventBuffer(buffer: Buffer, callback: QueueCallback | undefined): void;
    _queueEvent(callback: QueueCallback | undefined, defer?: boolean): void;
    connect(options: InternalOptions, callback: Callback<AcceptPacket> | undefined): void;
    attach(options: InternalOptions, callback?: Callback<Database>, db?: Database): void;
    detach(callback: Callback | undefined): this | undefined;
    createDatabase(options: InternalOptions, callback: Callback<Database> | undefined): void;
    dropDatabase(callback: SimpleCallback | undefined): void;
    throwClosed(callback: ((err: Error, ...args: any[]) => void) | undefined): this;
    /** `options` is a resolved options object, a bare isolation array, or
     *  the callback itself when no options are given. */
    startTransaction(options: any, callback?: any): this | undefined;
    commit(transaction: Transaction, callback: QueueCallback | undefined): this | undefined;
    rollback(transaction: Transaction, callback: QueueCallback | undefined): this | undefined;
    commitRetaining(transaction: Transaction, callback: QueueCallback | undefined): this | undefined;
    rollbackRetaining(transaction: Transaction, callback: QueueCallback | undefined): this | undefined;
    allocateStatement(callback: QueueCallback): this | undefined;
    dropStatement(statement: Statement, callback: QueueCallback | undefined): this | undefined;
    closeStatement(statement: Statement, callback: QueueCallback | undefined): this | undefined;
    allocateAndPrepareStatement(transaction: Transaction, query: string, plan: boolean, callback: Callback<Statement>): void;
    prepare(transaction: Transaction, query: string, plan: boolean, callback: Callback<Statement>): void;
    /** `plan` may be the callback itself when no plan flag is given. */
    prepareStatement(transaction: Transaction, statement: Statement, query: string, plan: boolean | Callback<Statement>, callback?: Callback<Statement>): this | undefined;
    /**
     * Execute a statement once per row using the Firebird 4 batch API
     * (protocol 16+): op_batch_create + op_batch_msg(s) + op_batch_exec +
     * op_batch_rls, all pipelined in a single network flush. Every packet
     * gets an in-order response (op_batch_cs for exec), so the regular
     * response queue keeps everything in sync.
     *
     * rows: array of parameter arrays, one per record. BLOB columns accept
     * Buffers, strings, JSON-able objects or pre-created blob quad ids —
     * values are uploaded as transaction blobs first (all initiated
     * back-to-back so they pipeline) and the batch messages reference their
     * ids. ARRAY columns are not supported. The callback receives a
     * completion object: { recordCount, updateCounts, errors:
     * [{recordNumber, error}], errorRecordNumbers, success }.
     */
    executeBatch(transaction: Transaction, statement: Statement, rows: QueryParams[], callback: BatchCb | undefined, options?: BatchOptions): this | undefined;
    /** Encode and send the batch packets (rows are fully materialized:
     *  blob values already replaced by quad ids by executeBatch). */
    _executeBatchEncoded(transaction: Transaction, statement: Statement, rows: any[][], callback: BatchCb | undefined, options: BatchOptions): void;
    /** `params` may be the callback itself when the statement has no parameters. */
    executeStatement(transaction: Transaction, statement: Statement, params: any, callback?: QueueCallback, custom?: InternalQueryOptions): this | undefined;
    sendExecute(op: number, statement: Statement, transaction: Transaction, callback: QueueCallback | undefined, parameters?: any[]): void;
    /** `count` may be the callback itself when no fetch size is given. */
    fetch(statement: Statement, transaction: Transaction, count: any, callback?: QueueCallback): void;
    fetchScroll(statement: Statement, transaction: Transaction, direction: string | number, offset: any, count: any, callback?: QueueCallback): void;
    /**
     * Query runtime information about a prepared statement via op_info_sql
     * (e.g. Const.RECORDS_INFO for the per-verb DML row counts). The
     * response is a plain op_response whose buffer holds the info clusters.
     */
    statementInfo(statement: Statement, items: number[], callback?: QueueCallback): this | undefined;
    /**
     * Resolve the pending blobAsText fetches of a decoded row batch
     * (ret.arrBlob) and write the text back into ret.data. Reads run
     * sequentially to respect Firebird's per-connection open-blob-handle
     * limit (issue #387). Used by fetchAll for cursors and by
     * transaction.execute for op_execute2 singletons (EXECUTE PROCEDURE /
     * RETURNING — issue #305, whose blobs never resolved before).
     */
    resolveTextBlobs(transaction: Transaction, ret: any, callback: (err?: any) => void): void;
    fetchAll(statement: Statement, transaction: Transaction, callback: Callback<any[]>): void;
    openBlob(blob: Quad, transaction: Transaction, callback: QueueCallback): void;
    closeBlob(blob: any, callback?: QueueCallback, defer?: boolean): void;
    getSegment(blob: any, callback: QueueCallback): void;
    createBlob2(transaction: Transaction, callback: QueueCallback): void;
    batchSegments(blob: any, buffer: Buffer, callback: QueueCallback): void;
    /**
     * Create a transaction blob, upload `value` (Buffer, string, or a
     * JSON-able object) and deliver its quad id. executeBatch's blob
     * pre-pass uses this: batch messages reference pre-created transaction
     * blobs (the batch parameter buffer's default BLOB_NONE policy), just
     * like the classic execute path stores blob params.
     */
    uploadBlob(transaction: Transaction, value: any, callback: (err: any, oid?: any) => void): void;
    svcattach(options: InternalOptions, callback?: Callback<ServiceManager>, svc?: ServiceManager): void;
    svcstart(spbaction: BlrWriter, callback: QueueCallback | undefined): void;
    svcquery(spbquery: number[], resultbuffersize: number, timeout: number | undefined, callback: QueueCallback | undefined): void;
    svcdetach(callback: Callback | undefined): void;
    auxConnection(eventid: number | Callback, callback?: Callback): this | undefined;
    queEvents(events: Record<string, number>, eventid: number, callback: Callback): this | undefined;
    closeEvents(eventid: number, callback: Callback): this | undefined;
}
declare function decodeResponse(data: XdrReader, callback: QueueCallback | undefined, cnx: Connection, lowercase_keys: boolean | undefined, cb: (err?: any, obj?: any) => void): void | WireResponse | {
    error: Error;
};
declare function describe(buff: Buffer, statement: Statement): void;
declare function fetch_blob_async_transaction(statement: Statement, id: Quad, column: string | number, row: number, meta?: Xsql.SQLVarBase, table?: string): (transactionArg: any) => Promise<unknown>;
declare function fetch_blob_async(statement: Statement, id: Quad, name: string | number, row: number): (transaction: Transaction, callback: any) => void;
export = Connection;
