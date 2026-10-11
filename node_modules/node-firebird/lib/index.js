"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isc_dpb_interp = exports.isc_dpb_sys_user_name_enc = exports.isc_dpb_password_enc = exports.isc_dpb_password = exports.isc_dpb_user_name = exports.isc_dpb_no_reserve = exports.isc_dpb_quit_log = exports.isc_dpb_begin_log = exports.isc_dpb_force_write = exports.isc_dpb_delete_shadow = exports.isc_dpb_sweep_interval = exports.isc_dpb_activate_shadow = exports.isc_dpb_encrypt_key = exports.isc_dpb_sys_user_name = exports.isc_dpb_license = exports.isc_dpb_damaged = exports.isc_dpb_no_garbage_collect = exports.isc_dpb_trace = exports.isc_dpb_number_of_users = exports.isc_dpb_dbkey_scope = exports.isc_dpb_disable_journal = exports.isc_dpb_enable_journal = exports.isc_dpb_sweep = exports.isc_dpb_verify = exports.isc_dpb_garbage_collect = exports.isc_dpb_debug = exports.isc_dpb_buffer_length = exports.isc_dpb_num_buffers = exports.isc_dpb_page_size = exports.isc_dpb_journal = exports.isc_dpb_allocation = exports.isc_dpb_cdd_pathname = exports.isc_dpb_version2 = exports.isc_dpb_version1 = exports.ISOLATION_READ_COMMITTED_READ_ONLY = exports.ISOLATION_SERIALIZABLE = exports.ISOLATION_REPEATABLE_READ = exports.ISOLATION_READ_COMMITTED = exports.ISOLATION_READ_UNCOMMITTED = exports.NUMERIC_MODE_STRING = exports.NUMERIC_MODE_SAFE = exports.NUMERIC_MODE_LOSSY = exports.WIRE_CRYPT_ENABLE = exports.WIRE_CRYPT_DISABLE = exports.AUTH_PLUGIN_SRP512 = exports.AUTH_PLUGIN_SRP384 = exports.AUTH_PLUGIN_SRP256 = exports.AUTH_PLUGIN_SRP = exports.AUTH_PLUGIN_LEGACY = exports.GDSCode = void 0;
exports.isc_dpb_reset_icu = exports.isc_dpb_nolinger = exports.isc_dpb_config = exports.isc_dpb_auth_plugin_name = exports.isc_dpb_auth_plugin_list = exports.isc_dpb_specific_auth_data = exports.isc_dpb_os_user = exports.isc_dpb_host_name = exports.isc_dpb_remote_protocol = exports.isc_dpb_client_version = exports.isc_dpb_auth_block = exports.isc_dpb_ext_call_depth = exports.isc_dpb_utf8_filename = exports.isc_dpb_org_filename = exports.isc_dpb_trusted_role = exports.isc_dpb_process_name = exports.isc_dpb_trusted_auth = exports.isc_dpb_no_db_triggers = exports.isc_dpb_process_id = exports.isc_dpb_address_path = exports.isc_dpb_gsec_attach = exports.isc_dpb_set_db_charset = exports.isc_dpb_gstat_attach = exports.isc_dpb_gfix_attach = exports.isc_dpb_set_db_sql_dialect = exports.isc_dpb_set_db_readonly = exports.isc_dpb_sql_dialect = exports.isc_dpb_working_directory = exports.isc_dpb_set_page_buffers = exports.isc_dpb_sql_role_name = exports.isc_dpb_gbak_attach = exports.isc_dpb_dummy_packet_interval = exports.isc_dpb_connect_timeout = exports.isc_dpb_sec_attach = exports.isc_dpb_overwrite = exports.isc_dpb_reserved = exports.isc_dpb_shutdown_delay = exports.isc_dpb_online = exports.isc_dpb_shutdown = exports.isc_dpb_cache_manager = exports.isc_dpb_lc_ctype = exports.isc_dpb_lc_messages = exports.isc_dpb_old_dump_id = exports.isc_dpb_old_start_file = exports.isc_dpb_old_start_seqno = exports.isc_dpb_old_start_page = exports.isc_dpb_old_file = exports.isc_dpb_old_num_files = exports.isc_dpb_old_file_size = exports.isc_dpb_online_dump = void 0;
exports.parseNamedPlaceholders = exports.parseConnectionString = exports.parseConnectionUri = exports.connection = exports.SQL_TYPES = exports.escape = exports.isc_dpb_search_path = exports.isc_dpb_max_inline_blob_size = exports.isc_dpb_max_blob_cache_size = exports.isc_dpb_owner = exports.isc_dpb_worker_attach = exports.isc_dpb_parallel_workers = exports.isc_dpb_upgrade_db = exports.isc_dpb_clear_map = exports.isc_dpb_decfloat_traps = exports.isc_dpb_decfloat_round = exports.isc_dpb_set_bind = exports.isc_dpb_set_db_replica = exports.isc_dpb_session_time_zone = exports.isc_dpb_map_attach = void 0;
exports.attach = attach;
exports.drop = drop;
exports.create = create;
exports.attachOrCreate = attachOrCreate;
exports.pool = pool;
exports.poolCluster = poolCluster;
exports.attachAsync = attachAsync;
exports.createAsync = createAsync;
exports.attachOrCreateAsync = attachOrCreateAsync;
exports.dropAsync = dropAsync;
const const_1 = __importDefault(require("./wire/const"));
const callback_1 = require("./callback");
const connection_1 = __importDefault(require("./wire/connection"));
const pool_1 = __importDefault(require("./pool"));
const pool_cluster_1 = __importDefault(require("./pool-cluster"));
const utils_1 = require("./utils");
const uri_1 = require("./uri");
Object.defineProperty(exports, "parseConnectionUri", { enumerable: true, get: function () { return uri_1.parseConnectionUri; } });
Object.defineProperty(exports, "parseConnectionString", { enumerable: true, get: function () { return uri_1.parseConnectionString; } });
__exportStar(require("./types"), exports);
var gdscodes_1 = require("./gdscodes");
Object.defineProperty(exports, "GDSCode", { enumerable: true, get: function () { return gdscodes_1.GDSCode; } });
if (typeof (setImmediate) === 'undefined') {
    global.setImmediate = function (cb) {
        process.nextTick(cb);
    };
}
exports.AUTH_PLUGIN_LEGACY = const_1.default.AUTH_PLUGIN_LEGACY;
exports.AUTH_PLUGIN_SRP = const_1.default.AUTH_PLUGIN_SRP;
exports.AUTH_PLUGIN_SRP256 = const_1.default.AUTH_PLUGIN_SRP256;
exports.AUTH_PLUGIN_SRP384 = const_1.default.AUTH_PLUGIN_SRP384;
exports.AUTH_PLUGIN_SRP512 = const_1.default.AUTH_PLUGIN_SRP512;
exports.WIRE_CRYPT_DISABLE = const_1.default.WIRE_CRYPT_DISABLE;
exports.WIRE_CRYPT_ENABLE = const_1.default.WIRE_CRYPT_ENABLE;
/** Decode through JavaScript Number where applicable; unsafe coefficients may lose precision. */
exports.NUMERIC_MODE_LOSSY = const_1.default.NUMERIC_MODE_LOSSY;
/** Return safe INT64/INT128 coefficients as numbers and unsafe ones as exact strings. */
exports.NUMERIC_MODE_SAFE = const_1.default.NUMERIC_MODE_SAFE;
/** Return every INT64/INT128-backed fixed-point value as an exact string. */
exports.NUMERIC_MODE_STRING = const_1.default.NUMERIC_MODE_STRING;
/** A transaction sees changes done by uncommitted transactions. */
exports.ISOLATION_READ_UNCOMMITTED = const_1.default.ISOLATION_READ_UNCOMMITTED;
/** A transaction sees only data committed before the statement has been executed. */
exports.ISOLATION_READ_COMMITTED = const_1.default.ISOLATION_READ_COMMITTED;
/** A transaction sees during its lifetime only data committed before the transaction has been started. */
exports.ISOLATION_REPEATABLE_READ = const_1.default.ISOLATION_REPEATABLE_READ;
/**
 * This is the strictest isolation level, which enforces transaction serialization.
 * Data accessed in the context of a serializable transaction cannot be accessed by any other transaction.
 */
exports.ISOLATION_SERIALIZABLE = const_1.default.ISOLATION_SERIALIZABLE;
exports.ISOLATION_READ_COMMITTED_READ_ONLY = const_1.default.ISOLATION_READ_COMMITTED_READ_ONLY;
// Database Parameter Buffer (DPB) constants
exports.isc_dpb_version1 = const_1.default.isc_dpb_version1;
exports.isc_dpb_version2 = const_1.default.isc_dpb_version2;
exports.isc_dpb_cdd_pathname = const_1.default.isc_dpb_cdd_pathname;
exports.isc_dpb_allocation = const_1.default.isc_dpb_allocation;
exports.isc_dpb_journal = const_1.default.isc_dpb_journal;
exports.isc_dpb_page_size = const_1.default.isc_dpb_page_size;
exports.isc_dpb_num_buffers = const_1.default.isc_dpb_num_buffers;
exports.isc_dpb_buffer_length = const_1.default.isc_dpb_buffer_length;
exports.isc_dpb_debug = const_1.default.isc_dpb_debug;
exports.isc_dpb_garbage_collect = const_1.default.isc_dpb_garbage_collect;
exports.isc_dpb_verify = const_1.default.isc_dpb_verify;
exports.isc_dpb_sweep = const_1.default.isc_dpb_sweep;
exports.isc_dpb_enable_journal = const_1.default.isc_dpb_enable_journal;
exports.isc_dpb_disable_journal = const_1.default.isc_dpb_disable_journal;
exports.isc_dpb_dbkey_scope = const_1.default.isc_dpb_dbkey_scope;
exports.isc_dpb_number_of_users = const_1.default.isc_dpb_number_of_users;
exports.isc_dpb_trace = const_1.default.isc_dpb_trace;
exports.isc_dpb_no_garbage_collect = const_1.default.isc_dpb_no_garbage_collect;
exports.isc_dpb_damaged = const_1.default.isc_dpb_damaged;
exports.isc_dpb_license = const_1.default.isc_dpb_license;
exports.isc_dpb_sys_user_name = const_1.default.isc_dpb_sys_user_name;
exports.isc_dpb_encrypt_key = const_1.default.isc_dpb_encrypt_key;
exports.isc_dpb_activate_shadow = const_1.default.isc_dpb_activate_shadow;
exports.isc_dpb_sweep_interval = const_1.default.isc_dpb_sweep_interval;
exports.isc_dpb_delete_shadow = const_1.default.isc_dpb_delete_shadow;
exports.isc_dpb_force_write = const_1.default.isc_dpb_force_write;
exports.isc_dpb_begin_log = const_1.default.isc_dpb_begin_log;
exports.isc_dpb_quit_log = const_1.default.isc_dpb_quit_log;
exports.isc_dpb_no_reserve = const_1.default.isc_dpb_no_reserve;
exports.isc_dpb_user_name = const_1.default.isc_dpb_user_name;
exports.isc_dpb_password = const_1.default.isc_dpb_password;
exports.isc_dpb_password_enc = const_1.default.isc_dpb_password_enc;
exports.isc_dpb_sys_user_name_enc = const_1.default.isc_dpb_sys_user_name_enc;
exports.isc_dpb_interp = const_1.default.isc_dpb_interp;
exports.isc_dpb_online_dump = const_1.default.isc_dpb_online_dump;
exports.isc_dpb_old_file_size = const_1.default.isc_dpb_old_file_size;
exports.isc_dpb_old_num_files = const_1.default.isc_dpb_old_num_files;
exports.isc_dpb_old_file = const_1.default.isc_dpb_old_file;
exports.isc_dpb_old_start_page = const_1.default.isc_dpb_old_start_page;
exports.isc_dpb_old_start_seqno = const_1.default.isc_dpb_old_start_seqno;
exports.isc_dpb_old_start_file = const_1.default.isc_dpb_old_start_file;
exports.isc_dpb_old_dump_id = const_1.default.isc_dpb_old_dump_id;
exports.isc_dpb_lc_messages = const_1.default.isc_dpb_lc_messages;
exports.isc_dpb_lc_ctype = const_1.default.isc_dpb_lc_ctype;
exports.isc_dpb_cache_manager = const_1.default.isc_dpb_cache_manager;
exports.isc_dpb_shutdown = const_1.default.isc_dpb_shutdown;
exports.isc_dpb_online = const_1.default.isc_dpb_online;
exports.isc_dpb_shutdown_delay = const_1.default.isc_dpb_shutdown_delay;
exports.isc_dpb_reserved = const_1.default.isc_dpb_reserved;
exports.isc_dpb_overwrite = const_1.default.isc_dpb_overwrite;
exports.isc_dpb_sec_attach = const_1.default.isc_dpb_sec_attach;
exports.isc_dpb_connect_timeout = const_1.default.isc_dpb_connect_timeout;
exports.isc_dpb_dummy_packet_interval = const_1.default.isc_dpb_dummy_packet_interval;
exports.isc_dpb_gbak_attach = const_1.default.isc_dpb_gbak_attach;
exports.isc_dpb_sql_role_name = const_1.default.isc_dpb_sql_role_name;
exports.isc_dpb_set_page_buffers = const_1.default.isc_dpb_set_page_buffers;
exports.isc_dpb_working_directory = const_1.default.isc_dpb_working_directory;
exports.isc_dpb_sql_dialect = const_1.default.isc_dpb_sql_dialect;
exports.isc_dpb_set_db_readonly = const_1.default.isc_dpb_set_db_readonly;
exports.isc_dpb_set_db_sql_dialect = const_1.default.isc_dpb_set_db_sql_dialect;
exports.isc_dpb_gfix_attach = const_1.default.isc_dpb_gfix_attach;
exports.isc_dpb_gstat_attach = const_1.default.isc_dpb_gstat_attach;
exports.isc_dpb_set_db_charset = const_1.default.isc_dpb_set_db_charset;
exports.isc_dpb_gsec_attach = const_1.default.isc_dpb_gsec_attach;
exports.isc_dpb_address_path = const_1.default.isc_dpb_address_path;
exports.isc_dpb_process_id = const_1.default.isc_dpb_process_id;
exports.isc_dpb_no_db_triggers = const_1.default.isc_dpb_no_db_triggers;
exports.isc_dpb_trusted_auth = const_1.default.isc_dpb_trusted_auth;
exports.isc_dpb_process_name = const_1.default.isc_dpb_process_name;
exports.isc_dpb_trusted_role = const_1.default.isc_dpb_trusted_role;
exports.isc_dpb_org_filename = const_1.default.isc_dpb_org_filename;
exports.isc_dpb_utf8_filename = const_1.default.isc_dpb_utf8_filename;
exports.isc_dpb_ext_call_depth = const_1.default.isc_dpb_ext_call_depth;
exports.isc_dpb_auth_block = const_1.default.isc_dpb_auth_block;
exports.isc_dpb_client_version = const_1.default.isc_dpb_client_version;
exports.isc_dpb_remote_protocol = const_1.default.isc_dpb_remote_protocol;
exports.isc_dpb_host_name = const_1.default.isc_dpb_host_name;
exports.isc_dpb_os_user = const_1.default.isc_dpb_os_user;
exports.isc_dpb_specific_auth_data = const_1.default.isc_dpb_specific_auth_data;
exports.isc_dpb_auth_plugin_list = const_1.default.isc_dpb_auth_plugin_list;
exports.isc_dpb_auth_plugin_name = const_1.default.isc_dpb_auth_plugin_name;
exports.isc_dpb_config = const_1.default.isc_dpb_config;
exports.isc_dpb_nolinger = const_1.default.isc_dpb_nolinger;
exports.isc_dpb_reset_icu = const_1.default.isc_dpb_reset_icu;
exports.isc_dpb_map_attach = const_1.default.isc_dpb_map_attach;
exports.isc_dpb_session_time_zone = const_1.default.isc_dpb_session_time_zone;
exports.isc_dpb_set_db_replica = const_1.default.isc_dpb_set_db_replica;
exports.isc_dpb_set_bind = const_1.default.isc_dpb_set_bind;
exports.isc_dpb_decfloat_round = const_1.default.isc_dpb_decfloat_round;
exports.isc_dpb_decfloat_traps = const_1.default.isc_dpb_decfloat_traps;
exports.isc_dpb_clear_map = const_1.default.isc_dpb_clear_map;
exports.isc_dpb_upgrade_db = const_1.default.isc_dpb_upgrade_db;
exports.isc_dpb_parallel_workers = const_1.default.isc_dpb_parallel_workers;
exports.isc_dpb_worker_attach = const_1.default.isc_dpb_worker_attach;
exports.isc_dpb_owner = const_1.default.isc_dpb_owner;
exports.isc_dpb_max_blob_cache_size = const_1.default.isc_dpb_max_blob_cache_size;
exports.isc_dpb_max_inline_blob_size = const_1.default.isc_dpb_max_inline_blob_size;
exports.isc_dpb_search_path = const_1.default.isc_dpb_search_path;
exports.escape = utils_1.escape;
/**
 * Firebird SQL type codes, as seen in `column.type` inside a `typeCast`
 * hook (each code also has a friendly `column.typeName`).
 */
exports.SQL_TYPES = Object.freeze({
    SQL_TEXT: const_1.default.SQL_TEXT,
    SQL_VARYING: const_1.default.SQL_VARYING,
    SQL_SHORT: const_1.default.SQL_SHORT,
    SQL_LONG: const_1.default.SQL_LONG,
    SQL_FLOAT: const_1.default.SQL_FLOAT,
    SQL_DOUBLE: const_1.default.SQL_DOUBLE,
    SQL_D_FLOAT: const_1.default.SQL_D_FLOAT,
    SQL_TIMESTAMP: const_1.default.SQL_TIMESTAMP,
    SQL_BLOB: const_1.default.SQL_BLOB,
    SQL_ARRAY: const_1.default.SQL_ARRAY,
    SQL_QUAD: const_1.default.SQL_QUAD,
    SQL_TYPE_TIME: const_1.default.SQL_TYPE_TIME,
    SQL_TYPE_DATE: const_1.default.SQL_TYPE_DATE,
    SQL_INT64: const_1.default.SQL_INT64,
    SQL_INT128: const_1.default.SQL_INT128,
    SQL_TIMESTAMP_TZ: const_1.default.SQL_TIMESTAMP_TZ,
    SQL_TIMESTAMP_TZ_EX: const_1.default.SQL_TIMESTAMP_TZ_EX,
    SQL_TIME_TZ: const_1.default.SQL_TIME_TZ,
    SQL_TIME_TZ_EX: const_1.default.SQL_TIME_TZ_EX,
    SQL_DEC16: const_1.default.SQL_DEC16,
    SQL_DEC34: const_1.default.SQL_DEC34,
    SQL_BOOLEAN: const_1.default.SQL_BOOLEAN,
    SQL_NULL: const_1.default.SQL_NULL,
});
function attach(options, callback) {
    options = (0, uri_1.normalizeOptions)(options);
    var host = options.host || const_1.default.DEFAULT_HOST;
    var port = options.port || const_1.default.DEFAULT_PORT;
    var manager = options.manager || false;
    var cnx = exports.connection = new connection_1.default(host, port, function (err) {
        if (err) {
            (0, callback_1.doError)(err, callback);
            return;
        }
        cnx.connect(options, function (err) {
            if (err) {
                (0, callback_1.doError)(err, callback);
            }
            else {
                if (manager)
                    cnx.svcattach(options, callback);
                else
                    cnx.attach(options, callback);
            }
        });
    }, options);
}
function drop(options, callback) {
    attach((0, uri_1.normalizeOptions)(options), function (err, db) {
        if (err) {
            callback({ error: err, message: "Drop error" });
            return;
        }
        db.drop(callback);
    });
}
function create(options, callback) {
    options = (0, uri_1.normalizeOptions)(options);
    var host = options.host || const_1.default.DEFAULT_HOST;
    var port = options.port || const_1.default.DEFAULT_PORT;
    var cnx = exports.connection = new connection_1.default(host, port, function (err) {
        var self = cnx;
        if (err) {
            callback({ error: err, message: "Connect error" }, undefined);
            return;
        }
        cnx.connect(options, function (err) {
            if (err) {
                if (self.db)
                    self.db.emit('error', err);
                (0, callback_1.doError)(err, callback);
                return;
            }
            cnx.createDatabase(options, callback);
        });
    }, options);
}
function attachOrCreate(options, callback) {
    options = (0, uri_1.normalizeOptions)(options);
    var host = options.host || const_1.default.DEFAULT_HOST;
    var port = options.port || const_1.default.DEFAULT_PORT;
    var cnx = exports.connection = new connection_1.default(host, port, function (err) {
        var self = cnx;
        if (err) {
            callback({ error: err, message: "Connect error" }, undefined);
            return;
        }
        cnx.connect(options, function (err) {
            if (err) {
                (0, callback_1.doError)(err, callback);
                return;
            }
            cnx.attach(options, function (err, ret) {
                if (!err) {
                    if (self.db)
                        self.db.emit('connect', ret);
                    // DatabaseCallback stays permissive (db non-optional) for
                    // API users; internally the error path passes no db
                    (0, callback_1.doCallback)(ret, callback);
                    return;
                }
                cnx.createDatabase(options, callback);
            });
        });
    }, options);
}
// Pooling
function pool(max, options) {
    return new pool_1.default(attach, max, Object.assign({}, (0, uri_1.normalizeOptions)(options), { isPool: true }));
}
/**
 * Multi-host pooling (primaries/replicas, failover): named nodes, each
 * backed by a regular pool, selected by glob pattern + 'rr'/'random'/
 * 'order' selector, with connection-failure failover and error-based
 * node offlining. See README § Multi-host pooling.
 */
function poolCluster(options) {
    const normalized = { ...(options || {}) };
    normalized.defaults = (0, uri_1.normalizeOptions)(normalized.defaults || {});
    return new pool_cluster_1.default(attach, normalized);
}
var named_params_1 = require("./named-params");
Object.defineProperty(exports, "parseNamedPlaceholders", { enumerable: true, get: function () { return named_params_1.parseNamedPlaceholders; } });
function attachAsync(options) {
    return (0, callback_1.fromCallback)(function (cb) { attach(options, cb); });
}
function createAsync(options) {
    return (0, callback_1.fromCallback)(function (cb) { create(options, cb); });
}
function attachOrCreateAsync(options) {
    return (0, callback_1.fromCallback)(function (cb) { attachOrCreate(options, cb); });
}
function dropAsync(options) {
    return (0, callback_1.fromCallback)(function (cb) { drop(options, cb); });
}
