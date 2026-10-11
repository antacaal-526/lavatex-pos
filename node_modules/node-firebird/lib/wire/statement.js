"use strict";
/***************************************
 *
 *   Statement
 *
 ***************************************/
const callback_1 = require("../callback");
const named_params_1 = require("../named-params");
class Statement {
    constructor(connection) {
        this.connection = connection;
    }
    close(callback) {
        this.connection.closeStatement(this, callback);
    }
    drop(callback) {
        this.connection.dropStatement(this, callback);
    }
    release(callback) {
        this.connection.releaseStatement(this, callback);
    }
    execute(transaction, params, callback, options) {
        if (params instanceof Function) {
            options = callback;
            callback = params;
            params = undefined;
        }
        if (this.namedParams && (0, named_params_1.isNamedParamsObject)(params)) {
            try {
                params = (0, named_params_1.bindNamedParams)(this.namedParams, params);
            }
            catch (err) {
                (0, callback_1.doError)(err, callback);
                return;
            }
        }
        this.options = options;
        this.connection.executeStatement(transaction, this, params, callback, options);
    }
    fetch(transaction, count, callback) {
        this.connection.fetch(this, transaction, count, callback);
    }
    fetchScroll(transaction, direction, offset, count, callback) {
        if (typeof count === 'function') {
            callback = count;
            count = undefined;
        }
        if (typeof offset === 'function') {
            callback = offset;
            offset = undefined;
            count = undefined;
        }
        this.connection.fetchScroll(this, transaction, direction, offset, count, callback);
    }
    fetchAll(transaction, callback) {
        this.connection.fetchAll(this, transaction, callback);
    }
    /**
     * Execute this statement once per row via the Firebird 4 batch API
     * (protocol 16+). `rows` is an array of parameter arrays — or, when the
     * statement was prepared with named placeholders, of values-by-name
     * objects (the two forms can be mixed).
     */
    executeBatch(transaction, rows, callback, options) {
        var names = this.namedParams;
        if (names && Array.isArray(rows)) {
            try {
                rows = rows.map(function (row) {
                    return (0, named_params_1.isNamedParamsObject)(row) ? (0, named_params_1.bindNamedParams)(names, row) : row;
                });
            }
            catch (err) {
                (0, callback_1.doError)(err, callback);
                return;
            }
        }
        this.connection.executeBatch(transaction, this, rows, callback, options);
    }
    /* Promise / async-await API — wrappers over the callback methods above. */
    executeAsync(transaction, params, options) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.execute(transaction, params, cb, options); });
    }
    executeBatchAsync(transaction, rows, options) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.executeBatch(transaction, rows, cb, options); });
    }
    fetchAsync(transaction, count) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.fetch(transaction, count, cb); });
    }
    fetchScrollAsync(transaction, direction, offset, count) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.fetchScroll(transaction, direction, offset, count, cb); });
    }
    fetchAllAsync(transaction) {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.fetchAll(transaction, cb); });
    }
    closeAsync() {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.close(cb); });
    }
    dropAsync() {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.drop(cb); });
    }
    releaseAsync() {
        var self = this;
        return (0, callback_1.fromCallback)(function (cb) { self.release(cb); });
    }
}
module.exports = Statement;
