import Events from 'events';
import { type Callback, type SimpleCallback } from '../callback';
import { type SqlTag } from '../sql-template';
import FbEventManager from './fbEventManager';
import type Connection from './connection';
import type Transaction from './transaction';
import type Statement from './statement';
import type { BatchCb, StatementCb, InternalQueryOptions } from './wire-types';
import type { BatchOptions, BatchResult, Isolation, QueryParams, QueryStreamOptions, TransactionCallback, TransactionOptions } from '../types';
/** Callback for startTransaction: the internal optional-args shape, or the
 *  public TransactionCallback (non-optional transaction) from types.ts. */
type TransactionCb = Callback<Transaction> | TransactionCallback;
/** startTransaction options: resolved options object, a bare isolation
 *  array, or omitted entirely (callback in the options position). */
type TransactionArg = TransactionOptions | Isolation | TransactionCb | undefined;
declare class Database extends Events.EventEmitter {
    connection: Connection;
    eventid: number;
    private _sql?;
    constructor(connection: Connection);
    /**
     * Tagged-template query API: db.sql`SELECT ... ${value}` (see README).
     * Built lazily on first access; the compiled text is positional-only,
     * so the namedPlaceholders rewriter is disabled — any `:token` in the
     * template is PSQL (EXECUTE BLOCK), not a placeholder.
     */
    get sql(): SqlTag;
    escape(value: any): string;
    detach(callback?: Callback, force?: boolean): this;
    transaction(options: TransactionArg, callback?: TransactionCb): this;
    startTransaction(options: TransactionArg, callback?: TransactionCb): this;
    newStatement(query: string, callback: StatementCb): this;
    execute(query: string, params?: QueryParams | Callback, callback?: any, options?: InternalQueryOptions): this;
    /**
     * Bulk-execute `query` once per row via the Firebird 4 batch API
     * (protocol 16+) with all-or-nothing semantics: the batch runs in its
     * own transaction, committed only when every record succeeded and
     * rolled back otherwise. On failure the error of the first failed
     * record is reported, with the full completion attached as
     * err.batchCompletion. Use transaction.executeBatch for partial-success
     * handling.
     */
    executeBatch(query: string, rows: QueryParams[], callback?: BatchCb, options?: BatchOptions): this;
    sequentially(query: string, params?: any, on?: any, callback?: any, options?: InternalQueryOptions | boolean): this;
    /**
     * Run `query` and return an object-mode Readable emitting one row per
     * chunk (what pg-query-stream / mysql2 .stream() return), with real
     * backpressure: fetching pauses while the stream buffer is full. Runs
     * in its own transaction, like db.query. Destroying the stream early
     * (e.g. a pipeline() teardown) aborts the fetch and releases the
     * statement. Rows go through the regular decode path, so typeCast,
     * blobAsText and jsonAsObject all apply.
     */
    queryStream(query: string, params?: QueryParams, options?: QueryStreamOptions): import("node:stream").Readable;
    /**
     * Bulk-insert Writable (the COPY FROM analogue, Firebird 4.0+): write
     * parameter-array rows, they are flushed in chunks through the batch
     * API on one prepared statement. Runs its own transaction — committed
     * on finish, rolled back on error/destroy (all-or-nothing for the
     * whole stream). BLOB columns accept Buffers/strings. After 'finish',
     * stream.recordCount / stream.affectedRows carry the totals.
     */
    batchStream(query: string, options?: any): import("node:stream").Writable;
    query(query: string, params?: QueryParams | Callback, callback?: any, options?: InternalQueryOptions): this;
    drop(callback?: SimpleCallback): void;
    /**
     * Cancel the operation currently executing on this connection by sending
     * an out-of-band op_cancel (Firebird 2.5+ / protocol 12+). The cancelled
     * operation fails through its own callback with err.gdscode ===
     * GDSCode.CANCELLED. `kind` defaults to fb_cancel_raise; cancellation is
     * per-attachment, not per-statement.
     */
    cancel(kind?: number | SimpleCallback, callback?: SimpleCallback): this;
    attachEvent(callback: Callback<FbEventManager>): this;
    /**
     * Create a physical tablespace.
     * Supported in Firebird 6.0+ (Protocol 20+).
     *
     * @param {string} name - The name of the tablespace.
     * @param {string} filePath - The physical file path for the tablespace.
     * @param {function} [callback] - Asynchronous completion callback.
     * @returns {Database}
     */
    createTablespace(name: string, filePath: string, callback?: Callback): this;
    /**
     * Alter an existing tablespace physical location.
     * Supported in Firebird 6.0+ (Protocol 20+).
     *
     * @param {string} name - The name of the tablespace.
     * @param {string} filePath - The new physical file path.
     * @param {function} [callback] - Asynchronous completion callback.
     * @returns {Database}
     */
    alterTablespace(name: string, filePath: string, callback?: Callback): this;
    /**
     * Drop a tablespace.
     * Supported in Firebird 6.0+ (Protocol 20+).
     *
     * @param {string} name - The name of the tablespace.
     * @param {function} [callback] - Asynchronous completion callback.
     * @returns {Database}
     */
    dropTablespace(name: string, callback?: Callback): this;
    /**
     * Create a schema/namespace. Can optionally partition/map the namespace
     * to a physical tablespace.
     * Supported in Firebird 6.0+ (Protocol 20+).
     *
     * @param {string} schemaName - The name of the schema.
     * @param {string} [tablespaceName] - Optional tablespace name to bind this schema namespace.
     * @param {function} [callback] - Asynchronous completion callback.
     * @returns {Database}
     */
    createSchema(schemaName: string, tablespaceName?: string | Callback, callback?: Callback): this;
    queryAsync(query: string, params?: QueryParams, options?: InternalQueryOptions): Promise<any[]>;
    executeAsync(query: string, params?: QueryParams, options?: InternalQueryOptions): Promise<any[]>;
    executeBatchAsync(query: string, rows: QueryParams[], options?: BatchOptions): Promise<BatchResult>;
    /** `on` may hold the options when the params argument is the row callback
     *  (public overload: sequentiallyAsync(query, rowCallback, options)). */
    sequentiallyAsync(query: string, params?: any, on?: any, options?: InternalQueryOptions | boolean): Promise<void>;
    transactionAsync(options?: TransactionOptions | Isolation): Promise<Transaction>;
    startTransactionAsync(options?: TransactionOptions | Isolation): Promise<Transaction>;
    newStatementAsync(query: string): Promise<Statement>;
    detachAsync(force?: boolean): Promise<void>;
    dropAsync(): Promise<void>;
    attachEventAsync(): Promise<FbEventManager>;
    cancelAsync(kind?: number): Promise<void>;
    /**
     * Run `work` inside a transaction: commits when the returned promise
     * resolves, rolls back when it rejects (the original error is rethrown,
     * even if the rollback itself fails).
     */
    withTransaction<T>(work: (transaction: Transaction) => Promise<T> | T, options?: TransactionOptions | Isolation): Promise<T>;
}
export = Database;
