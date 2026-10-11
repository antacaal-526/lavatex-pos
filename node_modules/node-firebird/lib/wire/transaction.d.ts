import { type Callback, type SimpleCallback } from '../callback';
import { type SqlTag } from '../sql-template';
import type Connection from './connection';
import type Database from './database';
import type Statement from './statement';
import type { BatchCb, StatementCb, InternalQueryOptions } from './wire-types';
import type { BatchOptions, BatchResult, QueryOptions, QueryParams, QueryStreamOptions, SequentialCallback } from '../types';
declare class Transaction {
    connection: Connection;
    db: Database;
    handle: number;
    private _sql?;
    constructor(connection: Connection);
    /**
     * Tagged-template query API: tx.sql`SELECT ... ${value}` (see README).
     * Built lazily — transactions are created per-query internally, and
     * those throwaway instances must not pay for the tag. The compiled text
     * is positional-only, so the namedPlaceholders rewriter is disabled:
     * any `:token` in the template is PSQL (EXECUTE BLOCK), not a
     * placeholder.
     */
    get sql(): SqlTag;
    /** Current savepoint nesting depth (names savepoints, see savepoint()). */
    private _savepointDepth;
    /**
     * Run `work` inside a savepoint (Firebird 1.5+): on resolve the
     * savepoint is released, on reject the transaction rolls back TO the
     * savepoint — undoing only work's changes — and the error is rethrown,
     * leaving the transaction itself usable. Nestable (each call generates
     * a fresh NF_SP_n name), mirroring db.withTransaction's style and
     * Postgres.js's sql.savepoint().
     *
     * Do NOT run sibling savepoints concurrently on one transaction
     * (Promise.all): Firebird's RELEASE SAVEPOINT also releases every
     * savepoint created after it, so interleaved siblings release each
     * other. Nested (awaited) savepoints are fine.
     */
    savepoint<T>(work: (transaction: this) => Promise<T> | T): Promise<T>;
    /** Per-call options.namedPlaceholders overrides the connection option. */
    private namedPlaceholdersEnabled;
    newStatement(query: string, callback: StatementCb, options?: InternalQueryOptions): void;
    execute(query: string, params?: QueryParams | Callback, callback?: any, options?: InternalQueryOptions): void;
    sequentially(query: string, params?: any, on?: any, callback?: any, options?: InternalQueryOptions | boolean): this;
    /**
     * Run `query` inside this transaction and return an object-mode
     * Readable emitting one row per chunk, with real backpressure (see
     * Database.queryStream). The transaction is NOT committed when the
     * stream ends — commit or roll back yourself.
     */
    queryStream(query: string, params?: QueryParams, options?: QueryStreamOptions): import("node:stream").Readable;
    /**
     * Bulk-insert Writable running inside this transaction (see
     * Database.batchStream). The transaction is NOT committed or rolled
     * back by the stream — settle it yourself after 'finish'/'error'.
     */
    batchStream(query: string, options?: any): import("node:stream").Writable;
    query(query: string, params?: QueryParams | Callback, callback?: any, options?: InternalQueryOptions): void;
    /**
     * Execute `query` once per row in `rows` using the Firebird 4 batch API
     * (protocol 16+, single network flush). The callback receives a
     * completion object: { recordCount, updateCounts, errors:
     * [{recordNumber, error}], errorRecordNumbers, success }. Per-record
     * failures do NOT roll anything back here — inspect the completion and
     * commit or roll back yourself (or use db.executeBatch for
     * all-or-nothing semantics).
     */
    executeBatch(query: string, rows: QueryParams[], callback?: BatchCb, options?: BatchOptions & QueryOptions): void;
    executeBatchAsync(query: string, rows: QueryParams[], options?: BatchOptions & QueryOptions): Promise<BatchResult>;
    commit(callback?: SimpleCallback): void;
    rollback(callback?: SimpleCallback): void;
    commitRetaining(callback?: SimpleCallback): void;
    rollbackRetaining(callback?: SimpleCallback): void;
    queryAsync(query: string, params?: QueryParams, options?: InternalQueryOptions): Promise<any[]>;
    executeAsync(query: string, params?: QueryParams, options?: InternalQueryOptions): Promise<any[]>;
    sequentiallyAsync(query: string, params?: any, on?: SequentialCallback, options?: InternalQueryOptions | boolean): Promise<void>;
    newStatementAsync(query: string): Promise<Statement>;
    commitAsync(): Promise<void>;
    rollbackAsync(): Promise<void>;
    commitRetainingAsync(): Promise<void>;
    rollbackRetainingAsync(): Promise<void>;
}
export = Transaction;
