"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const callback_1 = require("../callback");
const named_params_1 = require("../named-params");
const utils_1 = require("../utils");
const const_1 = __importDefault(require("./const"));
const sql_template_1 = require("../sql-template");
const xsqlvar_1 = require("./xsqlvar");
const query_stream_1 = __importDefault(require("./query-stream"));
const batch_stream_1 = __importDefault(require("./batch-stream"));
/***************************************
 *
 *   Transaction
 *
 ***************************************/
/** The error delivered when options.signal was already aborted on entry. */
function abortError(signal) {
    if (signal && signal.reason instanceof Error)
        return signal.reason;
    var err = new Error('The operation was aborted');
    err.name = 'AbortError';
    err.code = 'ABORT_ERR';
    return err;
}
/**
 * Wire an AbortSignal to a running statement: on abort, send an out-of-band
 * op_cancel so the server fails the executing operation with isc_cancelled
 * (surfaced through the statement's own callback as err.gdscode ===
 * GDSCode.CANCELLED). Returns the wrapped callback that detaches the
 * listener once the operation settles.
 */
function hookAbortSignal(connection, signal, callback) {
    var settled = false;
    var onAbort = function () {
        if (!settled)
            connection.cancelOperation(const_1.default.fb_cancel_raise);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    return function (err, result, meta, isSelect) {
        settled = true;
        signal.removeEventListener('abort', onAbort);
        if (callback)
            callback(err, result, meta, isSelect);
    };
}
class Transaction {
    constructor(connection) {
        /** Current savepoint nesting depth (names savepoints, see savepoint()). */
        this._savepointDepth = 0;
        this.connection = connection;
        this.db = connection.db;
    }
    /**
     * Tagged-template query API: tx.sql`SELECT ... ${value}` (see README).
     * Built lazily — transactions are created per-query internally, and
     * those throwaway instances must not pay for the tag. The compiled text
     * is positional-only, so the namedPlaceholders rewriter is disabled:
     * any `:token` in the template is PSQL (EXECUTE BLOCK), not a
     * placeholder.
     */
    get sql() {
        return this._sql || (this._sql = (0, sql_template_1.makeSqlTag)((text, params, options) => this.queryAsync(text, params, { ...options, namedPlaceholders: false })));
    }
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
    async savepoint(work) {
        if (typeof work !== 'function') {
            throw new Error('savepoint(work) expects a function');
        }
        // named by nesting depth, not a global counter: sequential
        // savepoints at the same depth reuse the same three SQL strings, so
        // the statement cache serves them instead of accumulating
        // single-use entries (redefining a released savepoint name is legal)
        const name = 'NF_SP_' + (++this._savepointDepth);
        try {
            await this.queryAsync('SAVEPOINT ' + name);
            let result;
            try {
                result = await work(this);
            }
            catch (err) {
                // only a work() failure rolls back to the savepoint — a
                // RELEASE failure below must NOT undo work's successful
                // changes
                try {
                    await this.queryAsync('ROLLBACK TO SAVEPOINT ' + name);
                }
                catch (rollbackErr) {
                    // the original failure matters more; keep the rollback
                    // failure attached for diagnosis
                    if (err && typeof err === 'object') {
                        err.savepointRollbackError = rollbackErr;
                    }
                }
                throw err;
            }
            await this.queryAsync('RELEASE SAVEPOINT ' + name);
            return result;
        }
        finally {
            this._savepointDepth--;
        }
    }
    /** Per-call options.namedPlaceholders overrides the connection option. */
    namedPlaceholdersEnabled(options) {
        if (options && options.namedPlaceholders !== undefined)
            return !!options.namedPlaceholders;
        return !!(this.connection.options && this.connection.options.namedPlaceholders);
    }
    newStatement(query, callback, options) {
        var cnx = this.connection;
        var self = this;
        // the public strict callback shape and the internal optional-args
        // shape only differ in optionality; treat it as the internal one
        var cb = callback;
        // With namedPlaceholders on, prepare the positional rewrite and
        // remember the name order on the statement so statement.execute can
        // accept a values-by-name object. The rewritten SQL is the cache key.
        var names = null;
        if (this.namedPlaceholdersEnabled(options)) {
            var parsed = (0, named_params_1.parseNamedPlaceholders)(query);
            if (parsed.names) {
                query = parsed.sql;
                names = parsed.names;
            }
        }
        var deliver = function (err, statement) {
            if (statement)
                statement.namedParams = names;
            cb(err, statement);
        };
        var query_cache = cnx.takeCachedStatement(query);
        if (query_cache) {
            deliver(null, query_cache);
        }
        else {
            cnx.prepare(self, query, false, deliver);
        }
    }
    execute(query, params, callback, options) {
        if (params instanceof Function) {
            options = callback;
            callback = params;
            params = undefined;
        }
        var signal = options && options.signal;
        if (signal) {
            if (signal.aborted) {
                (0, callback_1.doError)(abortError(signal), callback);
                return;
            }
            callback = hookAbortSignal(this.connection, signal, callback);
        }
        var self = this;
        this.newStatement(query, function (err, statement) {
            if (err || !statement) {
                (0, callback_1.doError)(err, callback);
                return;
            }
            function dropError(err) {
                // do not put a statement that just failed back into the cache
                // (statement is guaranteed by the guard above; hoisting keeps
                // the narrowing from reaching this function declaration)
                statement._failed = true;
                statement.release();
                (0, callback_1.doCallback)(err, callback);
            }
            statement.execute(self, params, function (err, ret) {
                if (err) {
                    dropError(err);
                    return;
                }
                // withMeta applies to query/execute only: in streaming mode
                // (sequentially/queryStream, which spread user options) rows
                // bypass fetchAll's array, so a result object here would
                // carry rows: [] and a meaningless affectedRows
                var withMeta = Boolean(options && typeof options === 'object' &&
                    options.withMeta && !options.asStream);
                // Deliver the historic result shape, or — when options.withMeta
                // is set — request the per-verb DML row counts while the
                // statement handle is still open and wrap everything in a
                // { rows, fields, affectedRows, recordCounts, warnings } object.
                function deliver(rows, isSelect, plainDml) {
                    if (!withMeta) {
                        statement.release();
                        if (callback) {
                            if (plainDml) {
                                // plain DML historically calls back with no args
                                callback();
                            }
                            else {
                                callback(undefined, rows, statement.output, isSelect);
                            }
                        }
                        return;
                    }
                    var execWarnings = (ret && ret.warnings) || [];
                    var finalize = function (counts) {
                        statement.release();
                        if (!callback) {
                            return;
                        }
                        // DML: what the server actually changed; SELECT: rows
                        // returned (pg's rowCount convention)
                        var affectedRows = counts
                            ? counts.insertCount + counts.updateCount + counts.deleteCount
                            : (Array.isArray(rows) ? rows.length : (rows !== undefined ? 1 : 0));
                        callback(undefined, {
                            rows: rows,
                            fields: (0, xsqlvar_1.describeFields)(statement.output),
                            affectedRows: affectedRows,
                            recordCounts: counts,
                            warnings: execWarnings,
                        }, statement.output, isSelect);
                    };
                    var t = statement.type;
                    var isDml = t === const_1.default.isc_info_sql_stmt_insert ||
                        t === const_1.default.isc_info_sql_stmt_update ||
                        t === const_1.default.isc_info_sql_stmt_delete ||
                        t === const_1.default.isc_info_sql_stmt_exec_procedure;
                    if (!isDml) {
                        finalize();
                        return;
                    }
                    self.connection.statementInfo(statement, const_1.default.RECORDS_INFO, function (err, info) {
                        if (err) {
                            dropError(err);
                            return;
                        }
                        finalize((0, xsqlvar_1.parseRecordCounts)(info && info.buffer));
                    });
                }
                switch (statement.type) {
                    case const_1.default.isc_info_sql_stmt_select:
                        statement.fetchAll(self, function (err, r) {
                            if (err) {
                                dropError(err);
                                return;
                            }
                            deliver(r, true);
                        });
                        break;
                    case const_1.default.isc_info_sql_stmt_exec_procedure:
                        if (ret && ret.data && ret.data.length > 0) {
                            // singleton op_execute2 rows never pass through
                            // fetchAll, so their blobAsText fetches must be
                            // resolved here (issue #305: EXECUTE PROCEDURE
                            // returned text blobs as unresolved functions)
                            self.connection.resolveTextBlobs(self, ret, function (blobErr) {
                                if (blobErr) {
                                    dropError(blobErr);
                                    return;
                                }
                                deliver(ret.data[0], true);
                            });
                            break;
                        }
                        else if (statement.output.length) {
                            statement.fetch(self, 1, function (err, fret) {
                                if (err) {
                                    dropError(err);
                                    return;
                                }
                                self.connection.resolveTextBlobs(self, fret, function (blobErr) {
                                    if (blobErr) {
                                        dropError(blobErr);
                                        return;
                                    }
                                    deliver(fret.data[0], false);
                                });
                            });
                            break;
                        }
                    // Fall through is normal
                    default:
                        deliver(undefined, false, true);
                        break;
                }
            }, options);
        }, options);
    }
    sequentially(query, params, on, callback, options = {}) {
        if (params instanceof Function) {
            options = callback;
            callback = on;
            on = params;
            params = undefined;
        }
        if (on === undefined) {
            throw new Error('Expected "on" delegate.');
        }
        if (callback instanceof Boolean) {
            options = callback;
            callback = undefined;
        }
        var self = this;
        var _on = function (row, i, meta, next) {
            var done = false;
            var finish = function (err) {
                if (done) {
                    return;
                }
                done = true;
                next(err);
            };
            try {
                var ret;
                if (on.length >= 3) {
                    ret = on(row, i, finish);
                }
                else {
                    ret = on(row, i);
                }
                if (ret && typeof ret.then === 'function') {
                    ret.then(function () {
                        finish();
                    }).catch(finish);
                }
                else if (on.length < 3) {
                    finish();
                }
            }
            catch (err) {
                finish(err);
            }
        };
        // back compatibility - options parameter is a boolean
        if (typeof options === 'boolean') {
            options = { asObject: !options, asStream: true, on: _on };
        }
        else {
            options = {
                asStream: true,
                asObject: true,
                on: _on,
                ...options,
            };
        }
        self.execute(query, params, callback, options);
        return self;
    }
    /**
     * Run `query` inside this transaction and return an object-mode
     * Readable emitting one row per chunk, with real backpressure (see
     * Database.queryStream). The transaction is NOT committed when the
     * stream ends — commit or roll back yourself.
     */
    queryStream(query, params, options) {
        return (0, query_stream_1.default)(this, query, params, options);
    }
    /**
     * Bulk-insert Writable running inside this transaction (see
     * Database.batchStream). The transaction is NOT committed or rolled
     * back by the stream — settle it yourself after 'finish'/'error'.
     */
    batchStream(query, options) {
        return (0, batch_stream_1.default)(this, query, options, false);
    }
    query(query, params, callback, options = {}) {
        if (params instanceof Function) {
            callback = params;
            params = undefined;
        }
        if (callback === undefined)
            callback = utils_1.noop;
        options = {
            asObject: true,
            asStream: callback === undefined || callback === null,
            ...options,
        };
        this.execute(query, params, callback, options);
    }
    /**
     * Execute `query` once per row in `rows` using the Firebird 4 batch API
     * (protocol 16+, single network flush). The callback receives a
     * completion object: { recordCount, updateCounts, errors:
     * [{recordNumber, error}], errorRecordNumbers, success }. Per-record
     * failures do NOT roll anything back here — inspect the completion and
     * commit or roll back yourself (or use db.executeBatch for
     * all-or-nothing semantics).
     */
    executeBatch(query, rows, callback, options) {
        var self = this;
        this.newStatement(query, function (err, statement) {
            if (err || !statement) {
                (0, callback_1.doError)(err, callback);
                return;
            }
            statement.executeBatch(self, rows, function (err, result) {
                if (err)
                    statement._failed = true;
                statement.release();
                if (callback)
                    callback(err, result);
            }, options);
        }, options);
    }
    executeBatchAsync(query, rows, options) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.executeBatch(query, rows, cb, options); });
    }
    commit(callback) {
        this.connection.commit(this, callback);
    }
    rollback(callback) {
        this.connection.rollback(this, callback);
    }
    commitRetaining(callback) {
        this.connection.commitRetaining(this, callback);
    }
    rollbackRetaining(callback) {
        this.connection.rollbackRetaining(this, callback);
    }
    /* Promise / async-await API — wrappers over the callback methods above. */
    queryAsync(query, params, options) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.query(query, params, cb, options); });
    }
    executeAsync(query, params, options) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.execute(query, params, cb, options); });
    }
    sequentiallyAsync(query, params, on, options) {
        if (params instanceof Function) {
            options = on;
            on = params;
            params = undefined;
        }
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.sequentially(query, params, on, cb, options); });
    }
    newStatementAsync(query) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.newStatement(query, cb); });
    }
    commitAsync() {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.commit(cb); });
    }
    rollbackAsync() {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.rollback(cb); });
    }
    commitRetainingAsync() {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.commitRetaining(cb); });
    }
    rollbackRetainingAsync() {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.rollbackRetaining(cb); });
    }
}
module.exports = Transaction;
