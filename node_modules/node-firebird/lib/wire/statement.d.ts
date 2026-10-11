/***************************************
 *
 *   Statement
 *
 ***************************************/
import { type Callback, type SimpleCallback } from '../callback';
import type Connection from './connection';
import type Transaction from './transaction';
import type { SQLVarBase } from './xsqlvar';
import type { QueryOptions, QueryParams } from '../types';
declare class Statement {
    connection: Connection;
    query: string;
    type: number;
    output: SQLVarBase[];
    input: SQLVarBase[];
    /** per-execute query options (asObject/asStream/timeout/...) */
    options: (QueryOptions & {
        [key: string]: any;
    }) | undefined;
    handle: number;
    plan: string;
    /**
     * Placeholder names in positional order when this statement was
     * prepared from SQL with named placeholders (namedPlaceholders on),
     * null/undefined otherwise. Set by Transaction.newStatement.
     */
    namedParams?: string[] | null;
    /** set when an execute/fetch on this statement errored — the statement
     *  is dropped on release instead of going back into the cache */
    _failed?: boolean;
    /** rows fetched so far by the current cursor (decodeResponse) */
    nbrowsfetched?: number;
    constructor(connection: Connection);
    close(callback?: SimpleCallback): void;
    drop(callback?: SimpleCallback): void;
    release(callback?: SimpleCallback): void;
    execute(transaction: Transaction, params?: any, callback?: any, options?: any): void;
    fetch(transaction: Transaction, count: number | string, callback: Callback): void;
    fetchScroll(transaction: Transaction, direction: string | number, offset?: any, count?: any, callback?: any): void;
    fetchAll(transaction: Transaction, callback: Callback): void;
    /**
     * Execute this statement once per row via the Firebird 4 batch API
     * (protocol 16+). `rows` is an array of parameter arrays — or, when the
     * statement was prepared with named placeholders, of values-by-name
     * objects (the two forms can be mixed).
     */
    executeBatch(transaction: Transaction, rows: QueryParams[], callback?: any, options?: any): void;
    executeAsync(transaction: Transaction, params?: any, options?: any): Promise<any>;
    executeBatchAsync(transaction: Transaction, rows: QueryParams[], options?: any): Promise<any>;
    fetchAsync(transaction: Transaction, count: number | string): Promise<any>;
    fetchScrollAsync(transaction: Transaction, direction: string | number, offset?: any, count?: any): Promise<any>;
    fetchAllAsync(transaction: Transaction): Promise<any>;
    closeAsync(): Promise<void>;
    dropAsync(): Promise<void>;
    releaseAsync(): Promise<void>;
}
export = Statement;
