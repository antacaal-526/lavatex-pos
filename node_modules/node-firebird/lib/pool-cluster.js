"use strict";
/***************************************
 *
 *   PoolCluster — multi-host pooling (primaries/replicas, failover)
 *
 *   The mysql2 PoolCluster model on top of this driver's Pool: named
 *   nodes, each backed by a regular connection pool (health checks,
 *   recycling and metrics included), selected by glob pattern +
 *   selector. Consecutive connection failures take a node offline
 *   (with optional timed restoration), and get() fails over to the
 *   next matching online node.
 *
 ***************************************/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const callback_1 = require("./callback");
const uri_1 = require("./uri");
const pool_1 = __importDefault(require("./pool"));
function patternToRegExp(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped + '$');
}
/**
 * Events: 'online' (name) — node restored; 'offline' (name) — node taken
 * out of rotation after too many connection failures; 'remove' (name) —
 * node removed via remove().
 */
class PoolCluster extends events_1.default.EventEmitter {
    constructor(attach, options) {
        super();
        this.nodes = new Map();
        this.rrIndex = new Map();
        this._destroyed = false;
        options = options || {};
        this.attach = attach;
        this.defaults = options.defaults || {};
        this.max = options.max && options.max > 0 ? options.max : 4;
        this.selector = options.selector || 'rr';
        this.removeNodeErrorCount = options.removeNodeErrorCount !== undefined ? options.removeNodeErrorCount : 5;
        this.restoreNodeTimeout = options.restoreNodeTimeout !== undefined ? options.restoreNodeTimeout : 30000;
        for (const [name, overrides] of Object.entries(options.nodes || {})) {
            this.add(name, overrides);
        }
    }
    /** Register a node; its pool is created lazily-safe right away. */
    add(name, overrides) {
        if (this._destroyed) {
            throw new Error('PoolCluster has been destroyed');
        }
        if (this.nodes.has(name)) {
            throw new Error('PoolCluster node already exists: ' + name);
        }
        // a connection-string override must be parsed, not object-spread
        // into character-indexed garbage
        if (typeof overrides === 'string') {
            overrides = (0, uri_1.parseConnectionString)(overrides);
        }
        const nodeOptions = { ...this.defaults, ...(overrides || {}) };
        this.nodes.set(name, {
            name,
            options: nodeOptions,
            pool: new pool_1.default(this.attach, nodeOptions.max || this.max, { ...nodeOptions, isPool: true }),
            online: true,
            errorCount: 0,
            restoreTimer: null,
        });
        return this;
    }
    /** Remove a node for good, destroying its pool. */
    remove(name, callback) {
        const node = this.nodes.get(name);
        if (!node) {
            if (callback)
                callback();
            return;
        }
        this.nodes.delete(name);
        if (node.restoreTimer) {
            clearTimeout(node.restoreTimer);
        }
        this.emit('remove', name);
        node.pool.destroy(callback);
    }
    /** Bring an offline node back into rotation immediately. */
    restore(name) {
        const node = this.nodes.get(name);
        if (!node || node.online) {
            return;
        }
        if (node.restoreTimer) {
            clearTimeout(node.restoreTimer);
            node.restoreTimer = null;
        }
        node.online = true;
        node.errorCount = 0;
        this.emit('online', name);
    }
    /** name → { online, errorCount, pool metrics } for every node. */
    status() {
        const out = {};
        for (const node of this.nodes.values()) {
            out[node.name] = {
                online: node.online,
                errorCount: node.errorCount,
                totalCount: node.pool.totalCount,
                idleCount: node.pool.idleCount,
                activeCount: node.pool.activeCount,
                waitingCount: node.pool.waitingCount,
            };
        }
        return out;
    }
    matching(pattern) {
        const re = patternToRegExp(pattern);
        const out = [];
        for (const node of this.nodes.values()) {
            if (re.test(node.name)) {
                out.push(node);
            }
        }
        return out;
    }
    pick(pattern, selector, exclude) {
        const candidates = this.matching(pattern).filter((n) => n.online && !exclude.has(n.name));
        if (!candidates.length) {
            return null;
        }
        if (selector === 'random') {
            return candidates[Math.floor(Math.random() * candidates.length)];
        }
        if (selector === 'order') {
            return candidates[0];
        }
        // round-robin per pattern; only the FIRST pick of a get() advances
        // the counter — failover re-picks reuse it, or a run of failovers
        // would skew the distribution toward nodes after the failing ones
        const index = this.rrIndex.get(pattern) || 0;
        if (exclude.size === 0) {
            this.rrIndex.set(pattern, index + 1);
        }
        return candidates[index % candidates.length];
    }
    noteFailure(node) {
        // a node removed while a get was in flight must not accumulate
        // counters, emit 'offline', or arm a restore timer nobody clears
        if (!this.nodes.has(node.name)) {
            return;
        }
        node.errorCount++;
        if (!this.removeNodeErrorCount || node.errorCount < this.removeNodeErrorCount || !node.online) {
            return;
        }
        node.online = false;
        this.emit('offline', node.name);
        if (this.restoreNodeTimeout > 0) {
            node.restoreTimer = setTimeout(() => {
                node.restoreTimer = null;
                this.restore(node.name);
            }, this.restoreNodeTimeout);
            if (node.restoreTimer.unref) {
                node.restoreTimer.unref();
            }
        }
    }
    /**
     * Acquire a connection from a node matching `pattern` (default '*').
     * Connection failures mark the node and FAIL OVER to the next
     * matching online node; only when every candidate has failed does the
     * callback receive the last error. Release connections with
     * db.detach(), exactly like a plain pool.
     */
    get(pattern, selector, callback) {
        if (typeof pattern === 'function') {
            callback = pattern;
            pattern = '*';
        }
        if (typeof selector === 'function') {
            callback = selector;
            selector = undefined;
        }
        if (this._destroyed) {
            callback(new Error('PoolCluster has been destroyed'), null);
            return;
        }
        const sel = selector || this.selector;
        const tried = new Set();
        const self = this;
        const attempt = (lastError) => {
            const node = self.pick(pattern, sel, tried);
            if (!node) {
                callback(lastError || new Error('PoolCluster: no online node matches pattern "' + pattern + '"'), null);
                return;
            }
            tried.add(node.name);
            node.pool.get((err, db) => {
                if (err) {
                    self.noteFailure(node);
                    attempt(err);
                    return;
                }
                node.errorCount = 0;
                callback(null, db);
            });
        };
        attempt();
    }
    getAsync(pattern, selector) {
        const self = this;
        return (0, callback_1.fromCallback)((cb) => self.get(pattern || '*', selector, cb));
    }
    /**
     * A pool-like facade bound to a pattern (mysql2's cluster.of):
     * { get, getAsync, withConnection } routed through the cluster's
     * selection and failover.
     */
    of(pattern, selector) {
        const self = this;
        return {
            get(callback) {
                self.get(pattern, selector, callback);
            },
            getAsync() {
                return self.getAsync(pattern, selector);
            },
            withConnection(work) {
                return self.withConnection(pattern, work, selector);
            },
        };
    }
    /** Run `work` with a connection from a matching node, always released. */
    withConnection(pattern, work, selector) {
        return (0, callback_1.withPooledConnection)(() => this.getAsync(pattern, selector), work);
    }
    /** Destroy every node's pool. */
    destroy(callback) {
        this._destroyed = true;
        const nodes = [...this.nodes.values()];
        this.nodes.clear();
        let remaining = nodes.length;
        if (!remaining) {
            if (callback)
                callback();
            return;
        }
        let firstError = null;
        for (const node of nodes) {
            if (node.restoreTimer) {
                clearTimeout(node.restoreTimer);
            }
            node.pool.destroy((err) => {
                if (err && !firstError)
                    firstError = err;
                if (--remaining === 0 && callback)
                    callback(firstError);
            });
        }
    }
    destroyAsync() {
        const self = this;
        return (0, callback_1.fromCallback)((cb) => self.destroy(cb));
    }
}
exports.default = PoolCluster;
