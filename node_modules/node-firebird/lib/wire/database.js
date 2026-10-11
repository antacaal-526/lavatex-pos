"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const events_1 = __importDefault(require("events"));
const callback_1 = require("../callback");
const utils_1 = require("../utils");
const const_1 = __importDefault(require("./const"));
const sql_template_1 = require("../sql-template");
const xsqlvar_1 = require("./xsqlvar");
const eventConnection_1 = __importDefault(require("./eventConnection"));
const fbEventManager_1 = __importDefault(require("./fbEventManager"));
const query_stream_1 = __importDefault(require("./query-stream"));
const batch_stream_1 = __importDefault(require("./batch-stream"));
/***************************************
 *
 *   Database
 *
 * Driver events (emitted on the Database instance itself)
 * --------------------------------------------------------
 * These are synchronous notifications from the driver about connection-level
 * operations. Subscribe with db.on(eventName, handler).
 *
 *   'attach'      – fired synchronously after the user callback returns,
 *                   once the database is attached.
 *   'detach'      – fired when the database connection is detached.
 *   'reconnect'   – fired after the driver successfully reconnects a dropped socket.
 *   'error'       – fired for connection-level errors (socket errors, closed
 *                   connection attempts, etc.).
 *   'transaction' – fired when a transaction is started (before server response),
 *                   with the resolved transaction options object as the argument.
 *   'commit'      – fired when a transaction commit is sent (before server response).
 *   'rollback'    – fired when a transaction rollback is sent (before server response).
 *   'query'       – fired with the SQL string when a statement is prepared.
 *   'row'         – fired with each individual row as it is decoded.
 *   'result'      – fired with the full rows array once all rows are fetched.
 *
 * Firebird database events (POST_EVENT)
 * ----------------------------------------
 * Real Firebird asynchronous notifications triggered by POST_EVENT inside
 * PSQL triggers or stored procedures are handled through a separate channel:
 *   1. Call db.attachEvent(callback) to obtain a FbEventManager instance.
 *   2. Call evtmgr.registerEvent(names, callback) to subscribe to event names.
 *   3. Listen for evtmgr.on('post_event', (name, count) => {}) to receive them.
 *   4. Call evtmgr.unregisterEvent(names, callback) to cancel a subscription.
 *   5. Call evtmgr.close(callback) when done to release the aux connection.
 *
 ***************************************/
function readblob(blob, callback) {
    if (blob === undefined || blob === null) {
        callback(null, blob);
        return;
    }
    if (typeof blob !== 'function') {
        callback(null, blob);
        return;
    }
    blob(function (err, name, e) {
        if (err) {
            callback(err);
            return;
        }
        if (!e) {
            callback(null, null);
            return;
        }
        const chunks = [];
        let chunksLength = 0;
        e.on('data', function (chunk) {
            chunksLength += chunk.length;
            chunks.push(chunk);
        });
        e.on('end', function () {
            callback(null, Buffer.concat(chunks, chunksLength));
        });
        e.on('error', function (streamErr) {
            callback(streamErr);
        });
    });
}
function fetchBlobSyncRow(row, meta, nestTables, lowercaseKeys, transform, callback) {
    if (!row || !meta || !meta.length || !meta.some((m) => m && m.type === const_1.default.SQL_BLOB)) {
        callback(null, row);
        return;
    }
    // locate blob cells by the same key computation the fetch decoder used,
    // rather than assuming Object.keys(row) is index-aligned with meta —
    // duplicate JOIN column names (and nested rows) break that alignment.
    // Array rows (sequentially's legacy boolean form) are keyed by index.
    const isArrayRow = Array.isArray(row);
    const keys = isArrayRow ? null : (0, xsqlvar_1.computeColumnKeys)(meta, nestTables, lowercaseKeys, transform);
    const blobCells = [];
    for (let i = 0; i < meta.length; i++) {
        if (!meta[i] || meta[i].type !== const_1.default.SQL_BLOB) {
            continue;
        }
        const target = keys ? (0, xsqlvar_1.nestCell)(row, keys[i].table) : row;
        const key = keys ? keys[i].key : i;
        // duplicate aliases collapse onto one cell — read it only once
        if (typeof target[key] === 'function' &&
            !blobCells.some((cell) => cell.target === target && cell.key === key)) {
            blobCells.push({ target, key });
        }
    }
    if (!blobCells.length) {
        callback(null, row);
        return;
    }
    let pending = blobCells.length;
    let blobErr;
    blobCells.forEach(function (cell) {
        readblob(cell.target[cell.key], function (err, data) {
            if (err && !blobErr) {
                blobErr = err;
            }
            cell.target[cell.key] = data;
            pending--;
            if (pending === 0) {
                callback(blobErr, row);
            }
        });
    });
}
class Database extends events_1.default.EventEmitter {
    constructor(connection) {
        super();
        this.connection = connection;
        connection.db = this;
        this.eventid = 1;
    }
    /**
     * Tagged-template query API: db.sql`SELECT ... ${value}` (see README).
     * Built lazily on first access; the compiled text is positional-only,
     * so the namedPlaceholders rewriter is disabled — any `:token` in the
     * template is PSQL (EXECUTE BLOCK), not a placeholder.
     */
    get sql() {
        return this._sql || (this._sql = (0, sql_template_1.makeSqlTag)((text, params, options) => this.queryAsync(text, params, { ...options, namedPlaceholders: false })));
    }
    escape(value) {
        return (0, utils_1.escape)(value, this.connection.accept.protocolVersion);
    }
    detach(callback, force) {
        var self = this;
        if (!force && self.connection._pending.length > 0) {
            self.connection._detachAuto = true;
            self.connection._detachCallback = callback;
            return self;
        }
        if (self.connection._pooled === false) {
            self.connection.detach(function (err, obj) {
                self.connection.disconnect();
                self.emit('detach', false);
                if (callback)
                    callback(err, obj);
            });
        }
        else {
            self.emit('detach', false);
            if (callback)
                callback();
        }
        return self;
    }
    transaction(options, callback) {
        return this.startTransaction(options, callback);
    }
    startTransaction(options, callback) {
        this.connection.startTransaction(options, callback);
        return this;
    }
    newStatement(query, callback) {
        // the public strict callback shape and the internal optional-args
        // shape only differ in optionality; treat it as the internal one
        const cb = callback;
        this.startTransaction(function (err, transaction) {
            if (err || !transaction) {
                cb(err);
                return;
            }
            transaction.newStatement(query, function (err, statement) {
                if (err) {
                    cb(err);
                    return;
                }
                transaction.commit(function (err) {
                    cb(err, statement);
                });
            });
        });
        return this;
    }
    execute(query, params, callback, options) {
        if (params instanceof Function) {
            options = callback;
            callback = params;
            params = undefined;
        }
        var self = this;
        self.connection.startTransaction(function (err, transaction) {
            if (err || !transaction) {
                (0, callback_1.doError)(err, callback);
                return;
            }
            transaction.execute(query, params, function (err, result, meta, isSelect) {
                if (err) {
                    transaction.rollback(function () {
                        (0, callback_1.doError)(err, callback);
                    });
                    return;
                }
                transaction.commit(function (err) {
                    if (callback)
                        callback(err, result, meta, isSelect);
                });
            }, options);
        });
        return self;
    }
    /**
     * Bulk-execute `query` once per row via the Firebird 4 batch API
     * (protocol 16+) with all-or-nothing semantics: the batch runs in its
     * own transaction, committed only when every record succeeded and
     * rolled back otherwise. On failure the error of the first failed
     * record is reported, with the full completion attached as
     * err.batchCompletion. Use transaction.executeBatch for partial-success
     * handling.
     */
    executeBatch(query, rows, callback, options) {
        var self = this;
        self.connection.startTransaction(function (err, transaction) {
            if (err || !transaction) {
                (0, callback_1.doError)(err, callback);
                return;
            }
            transaction.executeBatch(query, rows, function (err, result) {
                if (err || !result) {
                    transaction.rollback(function () {
                        (0, callback_1.doError)(err, callback);
                    });
                    return;
                }
                if (!result.success) {
                    transaction.rollback(function () {
                        (0, callback_1.doError)((0, utils_1.batchResultToError)(result), callback);
                    });
                    return;
                }
                transaction.commit(function (err) {
                    if (callback)
                        callback(err, result);
                });
            }, options);
        });
        return self;
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
        var keyResolutionDone = false;
        var resolvedNest;
        var resolvedTransform;
        var _on = function (row, i, meta, next) {
            var done = false;
            var finish = function (err) {
                if (done) {
                    return;
                }
                done = true;
                next(err);
            };
            // options is read at call time, after the normalization below;
            // both values are query-invariant, so resolve them once on the
            // first row instead of allocating per row
            if (!keyResolutionDone) {
                resolvedNest = (0, xsqlvar_1.resolveNestTables)(options, self.connection.options);
                resolvedTransform = (0, xsqlvar_1.resolveKeyTransform)(options, self.connection.options);
                keyResolutionDone = true;
            }
            fetchBlobSyncRow(row, meta, resolvedNest, self.connection._lowercase_keys, resolvedTransform, function (blobErr) {
                if (blobErr) {
                    finish(blobErr);
                    return;
                }
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
            });
        };
        // back compatibility - options parameter is a boolean
        if (typeof options === 'boolean') {
            options = { asObject: !options, asStream: true, on: _on };
        }
        else {
            options = {
                asObject: true,
                asStream: true,
                on: _on,
                ...options,
            };
        }
        self.execute(query, params, callback, options);
        return self;
    }
    /**
     * Run `query` and return an object-mode Readable emitting one row per
     * chunk (what pg-query-stream / mysql2 .stream() return), with real
     * backpressure: fetching pauses while the stream buffer is full. Runs
     * in its own transaction, like db.query. Destroying the stream early
     * (e.g. a pipeline() teardown) aborts the fetch and releases the
     * statement. Rows go through the regular decode path, so typeCast,
     * blobAsText and jsonAsObject all apply.
     */
    queryStream(query, params, options) {
        return (0, query_stream_1.default)(this, query, params, options);
    }
    /**
     * Bulk-insert Writable (the COPY FROM analogue, Firebird 4.0+): write
     * parameter-array rows, they are flushed in chunks through the batch
     * API on one prepared statement. Runs its own transaction — committed
     * on finish, rolled back on error/destroy (all-or-nothing for the
     * whole stream). BLOB columns accept Buffers/strings. After 'finish',
     * stream.recordCount / stream.affectedRows carry the totals.
     */
    batchStream(query, options) {
        return (0, batch_stream_1.default)(this, query, options, true);
    }
    query(query, params, callback, options = {}) {
        if (params instanceof Function) {
            options = callback || {};
            callback = params;
            params = undefined;
        }
        options = {
            asObject: true,
            asStream: callback === undefined || callback === null,
            ...options
        };
        var self = this;
        self.execute(query, params, callback, options);
        return self;
    }
    drop(callback) {
        return this.connection.dropDatabase(callback);
    }
    /**
     * Cancel the operation currently executing on this connection by sending
     * an out-of-band op_cancel (Firebird 2.5+ / protocol 12+). The cancelled
     * operation fails through its own callback with err.gdscode ===
     * GDSCode.CANCELLED. `kind` defaults to fb_cancel_raise; cancellation is
     * per-attachment, not per-statement.
     */
    cancel(kind, callback) {
        if (typeof kind === 'function') {
            callback = kind;
            kind = undefined;
        }
        this.connection.cancelOperation(kind, callback);
        return this;
    }
    attachEvent(callback) {
        var self = this;
        const eventid = self.eventid++;
        let completed = false;
        const complete = function (err, manager) {
            if (completed)
                return;
            completed = true;
            callback(err, manager);
        };
        if (process.env.FIREBIRD_DEBUG) {
            console.log('[fb-debug] Database.attachEvent: calling auxConnection, eventid=%d queue=%d', eventid, self.connection._queue.length);
        }
        this.connection.auxConnection(eventid, function (err, socket_info) {
            if (err) {
                if (process.env.FIREBIRD_DEBUG) {
                    console.log('[fb-debug] Database.attachEvent: auxConnection error:', err.message);
                }
                (0, callback_1.doError)(err, complete);
                return;
            }
            if (process.env.FIREBIRD_DEBUG) {
                console.log('[fb-debug] Database.attachEvent: auxConnection ok, connecting to aux port %s:%d', socket_info.host, socket_info.port);
            }
            const host = (0, utils_1.resolveEventHost)(self.connection.options, socket_info.host);
            const eventConnection = new eventConnection_1.default(host, socket_info.port, function (err) {
                if (err) {
                    if (process.env.FIREBIRD_DEBUG) {
                        console.log('[fb-debug] Database.attachEvent: EventConnection error:', err.message);
                    }
                    (0, callback_1.doError)(err, complete);
                    return;
                }
                if (process.env.FIREBIRD_DEBUG) {
                    console.log('[fb-debug] Database.attachEvent: EventConnection connected, creating FbEventManager eventid=%d', eventid);
                }
                const evt = new fbEventManager_1.default(self, eventConnection, eventid, function (err) {
                    if (err) {
                        (0, callback_1.doError)(err, complete);
                        return;
                    }
                    if (process.env.FIREBIRD_DEBUG) {
                        console.log('[fb-debug] Database.attachEvent: FbEventManager ready, eventid=%d', evt.eventid);
                    }
                    complete(err, evt);
                });
            }, self);
        });
        return this;
    }
    /**
     * Create a physical tablespace.
     * Supported in Firebird 6.0+ (Protocol 20+).
     *
     * @param {string} name - The name of the tablespace.
     * @param {string} filePath - The physical file path for the tablespace.
     * @param {function} [callback] - Asynchronous completion callback.
     * @returns {Database}
     */
    createTablespace(name, filePath, callback) {
        const sql = `CREATE TABLESPACE ${name} FILE '${filePath}'`;
        return this.execute(sql, [], callback);
    }
    /**
     * Alter an existing tablespace physical location.
     * Supported in Firebird 6.0+ (Protocol 20+).
     *
     * @param {string} name - The name of the tablespace.
     * @param {string} filePath - The new physical file path.
     * @param {function} [callback] - Asynchronous completion callback.
     * @returns {Database}
     */
    alterTablespace(name, filePath, callback) {
        const sql = `ALTER TABLESPACE ${name} SET FILE TO '${filePath}'`;
        return this.execute(sql, [], callback);
    }
    /**
     * Drop a tablespace.
     * Supported in Firebird 6.0+ (Protocol 20+).
     *
     * @param {string} name - The name of the tablespace.
     * @param {function} [callback] - Asynchronous completion callback.
     * @returns {Database}
     */
    dropTablespace(name, callback) {
        const sql = `DROP TABLESPACE ${name}`;
        return this.execute(sql, [], callback);
    }
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
    createSchema(schemaName, tablespaceName, callback) {
        if (typeof tablespaceName === 'function') {
            callback = tablespaceName;
            tablespaceName = undefined;
        }
        let sql = `CREATE SCHEMA ${schemaName}`;
        if (tablespaceName) {
            sql += ` TABLESPACE ${tablespaceName}`;
        }
        return this.execute(sql, [], callback);
    }
    /*
     * Promise / async-await API.
     * Each *Async method wraps its callback counterpart; the callback API
     * stays untouched. The promises resolve with the rows alone unless
     * { withMeta: true } is passed, which resolves the full
     * { rows, fields, affectedRows, recordCounts, warnings } result.
     */
    queryAsync(query, params, options) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.query(query, params, cb, options); });
    }
    executeAsync(query, params, options) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.execute(query, params, cb, options); });
    }
    executeBatchAsync(query, rows, options) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.executeBatch(query, rows, cb, options); });
    }
    /** `on` may hold the options when the params argument is the row callback
     *  (public overload: sequentiallyAsync(query, rowCallback, options)). */
    sequentiallyAsync(query, params, on, options) {
        if (params instanceof Function) {
            options = on;
            on = params;
            params = undefined;
        }
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.sequentially(query, params, on, cb, options); });
    }
    transactionAsync(options) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.startTransaction(options, cb); });
    }
    startTransactionAsync(options) {
        return this.transactionAsync(options);
    }
    newStatementAsync(query) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.newStatement(query, cb); });
    }
    detachAsync(force) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.detach(cb, force); });
    }
    dropAsync() {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.drop(cb); });
    }
    attachEventAsync() {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.attachEvent(cb); });
    }
    cancelAsync(kind) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.cancel(kind, cb); });
    }
    /**
     * Run `work` inside a transaction: commits when the returned promise
     * resolves, rolls back when it rejects (the original error is rethrown,
     * even if the rollback itself fails).
     */
    async withTransaction(work, options) {
        const transaction = await this.transactionAsync(options);
        try {
            const result = await work(transaction);
            await (0, callback_1.fromCallback)(function (cb) { transaction.commit(cb); });
            return result;
        }
        catch (err) {
            try {
                await (0, callback_1.fromCallback)(function (cb) { transaction.rollback(cb); });
            }
            catch { /* surface the original error, not the rollback failure */ }
            throw err;
        }
    }
}
module.exports = Database;
