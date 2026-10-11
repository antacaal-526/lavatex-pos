"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLParamBool = exports.SQLParamDate = exports.SQLParamQuad = exports.SQLParamBuffer = exports.SQLParamString = exports.SQLParamDouble = exports.SQLParamDecFloat34 = exports.SQLParamDecFloat16 = exports.SQLParamInt128 = exports.SQLParamInt64 = exports.SQLParamInt = exports.SQLVarBoolean = exports.SQLVarTimeStampTzEx = exports.SQLVarTimeStampTz = exports.SQLVarTimeTzEx = exports.SQLVarTimeTz = exports.SQLVarTimeStamp = exports.SQLVarTime = exports.SQLVarDate = exports.SQLVarDouble = exports.SQLVarFloat = exports.SQLVarDecFloat34 = exports.SQLVarDecFloat16 = exports.SQLVarInt128 = exports.SQLVarInt64 = exports.SQLVarShort = exports.SQLVarInt = exports.SQLVarArray = exports.SQLVarBlob = exports.SQLVarQuad = exports.SQLVarString = exports.SQLVarNull = exports.SQLVarText = exports.SQL_TYPE_NAMES = exports.SQLVarBase = void 0;
exports.getFirebirdCharsetWidth = getFirebirdCharsetWidth;
exports.resolveTextEncoding = resolveTextEncoding;
exports.resolveTextCodec = resolveTextCodec;
exports.resolveTextState = resolveTextState;
exports.encodeConnectionText = encodeConnectionText;
exports.decodeConnectionText = decodeConnectionText;
exports.computeColumnKeys = computeColumnKeys;
exports.camelizeKey = camelizeKey;
exports.resolveKeyTransform = resolveKeyTransform;
exports.resolveNestTables = resolveNestTables;
exports.nestCell = nestCell;
exports.describeField = describeField;
exports.describeFields = describeFields;
exports.parseRecordCounts = parseRecordCounts;
exports.toScaledInteger = toScaledInteger;
exports.encodeDateTimeParts = encodeDateTimeParts;
const const_1 = __importDefault(require("./const"));
const serialize_1 = require("./serialize");
const codepages_1 = require("./codepages");
/***************************************
 *
 *   SQLVar
 *
 ***************************************/
const DateOffset = 40587, TimeCoeff = 86400000, MsPerMinute = 60000;
const EMPTY_BUFFER = Buffer.alloc(0);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
/**
 * Apply a Firebird numeric scale to a value already narrowed to a JS number.
 *
 * This replaces the former lookup table of divisors, which only held
 * 10^0..10^15: any larger scale indexed past its end and yielded NaN. That is
 * reachable for INT64 (NUMERIC(18,18)) and routine for INT128, where the scale
 * runs to 38. Math.pow(10, n) returns the identical double for every exponent
 * the table did cover, so in-range results are unchanged.
 *
 * Positive scales multiply, matching decodeExactNumeric and formatScaledBigInt;
 * the table path divided by them, which was the wrong direction.
 */
function applyScale(value, scale) {
    if (!scale)
        return value;
    return scale < 0
        ? value / Math.pow(10, -scale)
        : value * Math.pow(10, scale);
}
/** Format a signed Firebird integer coefficient without passing through Number. */
function formatScaledBigInt(value, scale) {
    const negative = value < 0n;
    let digits = (negative ? -value : value).toString();
    const sign = negative ? '-' : '';
    if (scale === 0)
        return sign + digits;
    if (scale > 0)
        return sign + digits + '0'.repeat(scale);
    const places = -scale;
    if (digits.length <= places)
        digits = digits.padStart(places + 1, '0');
    return sign + digits.slice(0, -places) + '.' + digits.slice(-places);
}
function decodeExactNumeric(value, scale, mode) {
    if (mode === 'string' || value > MAX_SAFE_BIGINT || value < MIN_SAFE_BIGINT) {
        return formatScaledBigInt(value, scale);
    }
    return scale < 0
        ? Number(value) / Math.pow(10, -scale)
        : Number(value) * Math.pow(10, scale);
}
/** Decode INT128 using the mixed number/string policy of lossy mode. */
function decodeLossyInt128(value, scale) {
    // Both bounds matter, as in decodeExactNumeric. While this path read the
    // coefficient unsigned, every negative arrived as a huge positive and so
    // always took the exact-string branch, which masked the missing lower
    // bound. Now that the reader is signed, a large negative would otherwise
    // fall through to Number() and lose precision while its positive twin
    // stayed exact.
    if (value > MAX_SAFE_BIGINT || value < MIN_SAFE_BIGINT) {
        return formatScaledBigInt(value, scale);
    }
    return applyScale(Number(value), scale);
}
/**
 * Maps Firebird character-set names (upper-case) to the Node.js Buffer
 * encoding string used by Buffer.toString() / Buffer.from().
 *
 * Firebird stores CHAR/VARCHAR data in the on-wire character set of the
 * column (or the connection character set for NONE/unspecified columns).
 * We must decode raw bytes with the matching Node.js encoding so that
 * characters outside ASCII are reproduced correctly.
 *
 * Other recognized single-byte character sets are handled by the ICU-backed
 * codec path. Only unknown character-set names fall back to the
 * connection-level DEFAULT_ENCODING, typically UTF-8.
 */
const FirebirdToNodeEncoding = Object.freeze({
    UTF8: 'utf8',
    UNICODE_FSS: 'utf8',
    ISO8859_1: 'latin1',
    LATIN1: 'latin1',
    ASCII: 'ascii',
    NONE: 'latin1', // unspecified charset – treat as binary-safe latin1
});
const FirebirdCharsetWidths = {
    'UTF8': 4,
    'UNICODE_FSS': 3,
    // real Firebird names — the bare 'SJIS'/'EUCJ' keys never matched a
    // valid encoding option and silently resolved to width 1
    'SJIS_0208': 2,
    'EUCJ_0208': 2,
    'KSC_5601': 2,
    'BIG_5': 2,
    'GB_2312': 2,
    'GBK': 2,
    'CP943C': 2,
    'GB18030': 4,
};
function getFirebirdCharsetWidth(charset) {
    if (!charset)
        return 4;
    const upper = charset.toUpperCase();
    return FirebirdCharsetWidths[upper] || 1;
}
/**
 * Resolve the Node.js Buffer encoding to use when decoding text from a
 * Firebird response buffer.
 *
 * @param {object|null} options  Connection options object (may be falsy).
 * @returns {string}             A Node.js-compatible encoding string.
 */
function resolveTextEncoding(options) {
    const encoding = (options && options.encoding)
        ? options.encoding.toUpperCase()
        : const_1.default.DEFAULT_ENCODING;
    return (FirebirdToNodeEncoding[encoding] || const_1.default.DEFAULT_ENCODING.toLowerCase());
}
/**
 * Codec for the CONNECTION charset when it is a codepage Node cannot
 * handle natively (WIN1251, ISO8859_7, KOI8R, …); null on the native
 * path (UTF8/latin1/ascii) and for unknown charsets. With a codec
 * connection charset the server transliterates all text to that
 * codepage, so every text column, parameter, SQL string and text blob
 * goes through the codec (issues #319/#301).
 */
function resolveTextCodec(options) {
    return resolveTextState(options).codec;
}
/**
 * Per-connection text handling, resolved once and memoized on the
 * long-lived options object: the decode loop calls this per CELL, and
 * recomputing uppercased names + map lookups a million times per large
 * fetch is pure waste. Invalidated if options.encoding ever changes.
 */
function resolveTextState(options) {
    const key = options && options.encoding;
    if (options && options.__textState && options.__textState.key === key) {
        return options.__textState;
    }
    const encoding = (key || const_1.default.DEFAULT_ENCODING).toUpperCase();
    const state = {
        key,
        codec: FirebirdToNodeEncoding[encoding] ? null : (0, codepages_1.getCodec)(encoding),
        enc: (FirebirdToNodeEncoding[encoding] || const_1.default.DEFAULT_ENCODING.toLowerCase()),
        width: getFirebirdCharsetWidth(encoding),
    };
    if (options) {
        options.__textState = state;
    }
    return state;
}
/**
 * Encode text in the CONNECTION charset — the byte form the server
 * expects for parameters, SQL statement text and text-blob content.
 */
function encodeConnectionText(options, value) {
    const state = resolveTextState(options);
    if (state.codec) {
        return state.codec.encode(value);
    }
    if (state.enc === 'ascii') {
        // Node's 'ascii' encoding masks high bits (0xE4 → 'd') — replace
        // non-ASCII with '?' instead, matching the codec policy
        value = value.replace(/[^\x00-\x7F]/g, '?');
    }
    return Buffer.from(value, state.enc);
}
/**
 * Decode connection-charset bytes to text (the read counterpart of
 * encodeConnectionText — used for text blobs).
 */
function decodeConnectionText(options, buffer) {
    const codec = resolveTextCodec(options);
    if (codec) {
        return codec.decode(buffer);
    }
    return buffer.toString(resolveTextEncoding(options));
}
//------------------------------------------------------
/**
 * Common shape of all SQLVar descriptor objects.  The metadata properties
 * are populated externally (in connection.ts) from the op_prepare_statement
 * describe response before decode()/calcBlr() are called.
 */
class SQLVarBase {
}
exports.SQLVarBase = SQLVarBase;
/**
 * Compute the object-row property keys for a statement's output columns,
 * honouring the nestTables and lowercase_keys options. The table qualifier
 * is the query's relation alias when one is used (relationAlias, requested
 * via isc_info_sql_relation_alias), the relation name otherwise, so
 * self-joins nest under their query aliases. Expression columns (no source
 * relation) qualify as '' exactly like mysql2: they nest under the '' key,
 * and in separator mode become '<sep>alias' — always prefixing keeps
 * qualified keys collision-free (a bare expression alias could otherwise
 * collide with a real column's 'table<sep>column' key). Used by the fetch
 * decoder and by fetchBlobSyncRow, which must agree on where each column
 * landed in the row.
 */
function computeColumnKeys(output, nestTables, lowercaseKeys, transform) {
    return output.map((column) => {
        let key = column.alias || '';
        if (lowercaseKeys) {
            key = key.toLowerCase();
        }
        if (transform) {
            key = transform(key);
        }
        if (nestTables !== true && typeof nestTables !== 'string') {
            return { key };
        }
        let table = column.relationAlias || column.relation || '';
        if (lowercaseKeys) {
            table = table.toLowerCase();
        }
        if (transform) {
            table = transform(table);
        }
        if (nestTables === true) {
            return { table, key };
        }
        return { key: table + nestTables + key };
    });
}
/** FIRST_NAME → firstName (the transformKeys: 'camel' built-in). */
function camelizeKey(key) {
    const parts = String(key).toLowerCase().split('_');
    let out = parts[0] || '';
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part) {
            out += part.charAt(0).toUpperCase() + part.slice(1);
        }
    }
    return out;
}
/**
 * Resolve the effective transformKeys value (per-query wins over the
 * connection option) into a callable mapper, or undefined when off.
 * A custom mapper is guarded like the typeCast hook: a throw inside the
 * row-decode loop would be mistaken for an incomplete packet and desync
 * the response queue, so failures fall back to the untransformed key.
 */
function resolveKeyTransform(queryOptions, connectionOptions) {
    const value = resolveQueryOption('transformKeys', queryOptions, connectionOptions);
    if (value === 'camel') {
        return camelizeKey;
    }
    if (typeof value !== 'function') {
        return undefined;
    }
    return (key) => {
        try {
            return String(value(key));
        }
        catch (err) {
            console.warn('[node-firebird] transformKeys mapper threw for key "%s": %s — using the untransformed key', key, err && err.message);
            return key;
        }
    };
}
/**
 * Shared precedence rule for per-query-overridable connection options:
 * the per-query value wins whenever it is present (even if falsy), the
 * connection option applies otherwise.
 */
function resolveQueryOption(name, queryOptions, connectionOptions) {
    if (queryOptions && queryOptions[name] !== undefined) {
        return queryOptions[name];
    }
    return connectionOptions ? connectionOptions[name] : undefined;
}
/**
 * Resolve the effective nestTables value: the per-query option wins over
 * the connection option. The decoder and fetchBlobSyncRow both use this —
 * they must agree on whether nesting is active or blob cells are looked
 * up in the wrong place.
 */
function resolveNestTables(queryOptions, connectionOptions) {
    return resolveQueryOption('nestTables', queryOptions, connectionOptions);
}
/**
 * The object a column's value lives in: the row itself, or — when the
 * column carries a nestTables table qualifier — the row's per-table
 * sub-object, created on first use. Every site that reads or writes a
 * cell by ColumnKey must resolve it through here.
 */
function nestCell(row, table) {
    if (table === undefined) {
        return row;
    }
    return row[table] || (row[table] = {});
}
//------------------------------------------------------
/** Human-readable names for the SQL_* wire type codes. */
exports.SQL_TYPE_NAMES = {
    [const_1.default.SQL_TEXT]: 'TEXT',
    [const_1.default.SQL_VARYING]: 'VARYING',
    [const_1.default.SQL_SHORT]: 'SHORT',
    [const_1.default.SQL_LONG]: 'LONG',
    [const_1.default.SQL_FLOAT]: 'FLOAT',
    [const_1.default.SQL_DOUBLE]: 'DOUBLE',
    [const_1.default.SQL_D_FLOAT]: 'D_FLOAT',
    [const_1.default.SQL_TIMESTAMP]: 'TIMESTAMP',
    [const_1.default.SQL_BLOB]: 'BLOB',
    [const_1.default.SQL_ARRAY]: 'ARRAY',
    [const_1.default.SQL_QUAD]: 'QUAD',
    [const_1.default.SQL_TYPE_TIME]: 'TIME',
    [const_1.default.SQL_TYPE_DATE]: 'DATE',
    [const_1.default.SQL_INT64]: 'INT64',
    [const_1.default.SQL_INT128]: 'INT128',
    [const_1.default.SQL_TIMESTAMP_TZ]: 'TIMESTAMP_TZ',
    [const_1.default.SQL_TIMESTAMP_TZ_EX]: 'TIMESTAMP_TZ_EX',
    [const_1.default.SQL_TIME_TZ]: 'TIME_TZ',
    [const_1.default.SQL_TIME_TZ_EX]: 'TIME_TZ_EX',
    [const_1.default.SQL_DEC16]: 'DEC16',
    [const_1.default.SQL_DEC34]: 'DEC34',
    [const_1.default.SQL_BOOLEAN]: 'BOOLEAN',
    [const_1.default.SQL_NULL]: 'NULL',
};
/**
 * Public column-metadata shape for one output descriptor: the vocabulary
 * both the typeCast hook and withMeta `fields` deliver. Keep the two in
 * lockstep by building both through here.
 */
function describeField(meta) {
    return {
        type: meta.type,
        typeName: exports.SQL_TYPE_NAMES[meta.type] || 'UNKNOWN',
        subType: meta.subType,
        scale: meta.scale,
        // report the column's true declared length, not the widened fetch
        // buffer (see scaleOutputLengths)
        length: meta.nativeLength !== undefined ? meta.nativeLength : meta.length,
        nullable: meta.nullable,
        field: meta.field,
        relation: meta.relation,
        relationAlias: meta.relationAlias,
        relationSchema: meta.relationSchema,
        alias: meta.alias,
    };
}
/**
 * Map a statement's output descriptors to the column-metadata array
 * delivered in withMeta results ({ rows, fields, ... }).
 */
function describeFields(output) {
    return (output || []).map(describeField);
}
/**
 * Parse the op_info_sql response buffer of a Const.RECORDS_INFO request
 * into per-verb row counts. The buffer holds an isc_info_sql_records
 * cluster (2-byte total length, then nested isc_info_req_*_count items,
 * each 2-byte length + little-endian integer) terminated by isc_info_end.
 */
function parseRecordCounts(buffer) {
    const counts = { selectCount: 0, insertCount: 0, updateCount: 0, deleteCount: 0 };
    if (!buffer || !buffer.length) {
        return counts;
    }
    // this runs inside a response callback — a malformed/truncated buffer
    // must yield partial counts, never a throw
    try {
        const br = new serialize_1.BlrReader(buffer);
        while (br.pos < br.buffer.length) {
            const item = br.readByteCode();
            if (item === const_1.default.isc_info_end || item === const_1.default.isc_info_truncated) {
                break;
            }
            if (item === const_1.default.isc_info_sql_records) {
                br.pos += 2; // skip the cluster's total length; nested items follow
                continue;
            }
            switch (item) {
                case const_1.default.isc_info_req_select_count:
                    counts.selectCount = br.readInt() || 0;
                    break;
                case const_1.default.isc_info_req_insert_count:
                    counts.insertCount = br.readInt() || 0;
                    break;
                case const_1.default.isc_info_req_update_count:
                    counts.updateCount = br.readInt() || 0;
                    break;
                case const_1.default.isc_info_req_delete_count:
                    counts.deleteCount = br.readInt() || 0;
                    break;
                default:
                    // unknown item: its 2-byte length prefix tells us how far to skip
                    br.pos += 2 + br.buffer.readUInt16LE(br.pos);
            }
        }
    }
    catch (e) {
        // fall through with whatever was parsed so far
    }
    return counts;
}
//------------------------------------------------------
class SQLVarText extends SQLVarBase {
    decode(data, lowerV13, options) {
        let ret;
        if (this.subType > 1 || this.subType === 0) {
            const state = resolveTextState(options);
            ret = state.codec
                ? state.codec.decode(data.readBuffer(this.length) || EMPTY_BUFFER)
                : data.readText(this.length, state.enc);
            const charLength = Math.floor(this.length / state.width);
            if (ret.length > charLength) {
                ret = ret.substring(0, charLength);
            }
        }
        else {
            ret = data.readBuffer(this.length);
        }
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_text);
        blr.addWord(this.length);
    }
}
exports.SQLVarText = SQLVarText;
//------------------------------------------------------
class SQLVarNull extends SQLVarText {
}
exports.SQLVarNull = SQLVarNull;
//------------------------------------------------------
class SQLVarString extends SQLVarBase {
    decode(data, lowerV13, options) {
        let ret;
        if (this.subType > 1 || this.subType === 0) {
            const state = resolveTextState(options);
            ret = state.codec
                ? state.codec.decode(data.readArray() || EMPTY_BUFFER)
                : data.readString(state.enc);
        }
        else {
            ret = data.readBuffer();
        }
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_varying);
        blr.addWord(this.length);
    }
}
exports.SQLVarString = SQLVarString;
//------------------------------------------------------
class SQLVarQuad extends SQLVarBase {
    decode(data, lowerV13) {
        var ret = data.readQuad();
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_quad);
        blr.addShort(this.scale);
    }
}
exports.SQLVarQuad = SQLVarQuad;
//------------------------------------------------------
class SQLVarBlob extends SQLVarQuad {
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_quad);
        blr.addShort(0);
    }
}
exports.SQLVarBlob = SQLVarBlob;
//------------------------------------------------------
class SQLVarArray extends SQLVarQuad {
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_quad);
        blr.addShort(0);
    }
}
exports.SQLVarArray = SQLVarArray;
//------------------------------------------------------
class SQLVarInt extends SQLVarBase {
    decode(data, lowerV13) {
        var ret = data.readInt();
        ret = applyScale(ret, this.scale);
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_long);
        blr.addShort(this.scale);
    }
}
exports.SQLVarInt = SQLVarInt;
//------------------------------------------------------
class SQLVarShort extends SQLVarInt {
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_short);
        blr.addShort(this.scale);
    }
}
exports.SQLVarShort = SQLVarShort;
//------------------------------------------------------
class SQLVarInt64 extends SQLVarBase {
    decode(data, lowerV13, options) {
        const mode = options?.numericMode || const_1.default.NUMERIC_MODE_LOSSY;
        let ret;
        if (mode === const_1.default.NUMERIC_MODE_LOSSY) {
            ret = data.readInt64();
            ret = applyScale(ret, this.scale);
        }
        else {
            ret = decodeExactNumeric(data.readInt64BigInt(), this.scale, mode);
        }
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_int64);
        blr.addShort(this.scale);
    }
}
exports.SQLVarInt64 = SQLVarInt64;
//------------------------------------------------------
class SQLVarInt128 extends SQLVarBase {
    decode(data, lowerV13, options) {
        const mode = options?.numericMode || const_1.default.NUMERIC_MODE_LOSSY;
        const ret = mode === const_1.default.NUMERIC_MODE_LOSSY
            ? decodeLossyInt128(data.readInt128Signed(), this.scale)
            : decodeExactNumeric(data.readInt128Signed(), this.scale, mode);
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_int128);
        blr.addShort(this.scale);
    }
}
exports.SQLVarInt128 = SQLVarInt128;
//------------------------------------------------------
class SQLVarDecFloat16 extends SQLVarBase {
    decode(data, lowerV13) {
        var ret = data.readDecFloat16();
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_dec64);
        blr.addShort(0);
    }
}
exports.SQLVarDecFloat16 = SQLVarDecFloat16;
//------------------------------------------------------
class SQLVarDecFloat34 extends SQLVarBase {
    decode(data, lowerV13) {
        var ret = data.readDecFloat34();
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_dec128);
        blr.addShort(0);
    }
}
exports.SQLVarDecFloat34 = SQLVarDecFloat34;
//------------------------------------------------------
class SQLVarFloat extends SQLVarBase {
    decode(data, lowerV13) {
        var ret = data.readFloat();
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_float);
    }
}
exports.SQLVarFloat = SQLVarFloat;
//------------------------------------------------------
class SQLVarDouble extends SQLVarBase {
    decode(data, lowerV13) {
        var ret = data.readDouble();
        if (!lowerV13 || !data.readInt()) {
            return ret;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_double);
    }
}
exports.SQLVarDouble = SQLVarDouble;
//------------------------------------------------------
class SQLVarDate extends SQLVarBase {
    decode(data, lowerV13) {
        var ret = data.readInt();
        if (!lowerV13 || !data.readInt()) {
            var d = new Date(0);
            d.setMilliseconds((ret - DateOffset) * TimeCoeff + d.getTimezoneOffset() * MsPerMinute);
            return d;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_sql_date);
    }
}
exports.SQLVarDate = SQLVarDate;
//------------------------------------------------------
class SQLVarTime extends SQLVarBase {
    decode(data, lowerV13) {
        var ret = data.readUInt();
        if (!lowerV13 || !data.readInt()) {
            var d = new Date(0);
            d.setMilliseconds(Math.floor(ret / 10) + d.getTimezoneOffset() * MsPerMinute);
            return d;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_sql_time);
    }
}
exports.SQLVarTime = SQLVarTime;
//------------------------------------------------------
class SQLVarTimeStamp extends SQLVarBase {
    decode(data, lowerV13) {
        var date = data.readInt();
        var time = data.readUInt();
        if (!lowerV13 || !data.readInt()) {
            var d = new Date(0);
            d.setMilliseconds((date - DateOffset) * TimeCoeff + Math.floor(time / 10) + d.getTimezoneOffset() * MsPerMinute);
            return d;
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_timestamp);
    }
}
exports.SQLVarTimeStamp = SQLVarTimeStamp;
//------------------------------------------------------
class SQLVarTimeTz extends SQLVarBase {
    decode(data, lowerV13) {
        var time = data.readUInt();
        data.readInt(); // skip timezone info
        if (!lowerV13 || !data.readInt()) {
            // The wire value is already a UTC instant. Construct from epoch milliseconds:
            // Date's constructor is UTC-based, whereas setMilliseconds() is a *local-time*
            // setter, so rolling forward from new Date(0) across a DST boundary shifts the
            // result by the DST delta (see the regression tests in test/timezone.js).
            return new Date(Math.floor(time / 10));
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_sql_time_tz);
    }
}
exports.SQLVarTimeTz = SQLVarTimeTz;
//------------------------------------------------------
class SQLVarTimeTzEx extends SQLVarTimeTz {
    decode(data, lowerV13) {
        var time = data.readUInt();
        data.readInt(); // skip timezone info
        data.readInt(); // skip ext_offset
        if (!lowerV13 || !data.readInt()) {
            // The wire value is already a UTC instant. Construct from epoch milliseconds:
            // Date's constructor is UTC-based, whereas setMilliseconds() is a *local-time*
            // setter, so rolling forward from new Date(0) across a DST boundary shifts the
            // result by the DST delta (see the regression tests in test/timezone.js).
            return new Date(Math.floor(time / 10));
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_ex_time_tz);
    }
}
exports.SQLVarTimeTzEx = SQLVarTimeTzEx;
//------------------------------------------------------
class SQLVarTimeStampTz extends SQLVarBase {
    decode(data, lowerV13) {
        var date = data.readInt();
        var time = data.readUInt();
        data.readInt(); // skip timezone info
        if (!lowerV13 || !data.readInt()) {
            // The wire value is already a UTC instant. Construct from epoch milliseconds:
            // Date's constructor is UTC-based, whereas setMilliseconds() is a *local-time*
            // setter, so rolling forward from new Date(0) across a DST boundary shifts the
            // result by the DST delta (see the regression tests in test/timezone.js).
            return new Date((date - DateOffset) * TimeCoeff + Math.floor(time / 10));
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_timestamp_tz);
    }
}
exports.SQLVarTimeStampTz = SQLVarTimeStampTz;
//------------------------------------------------------
class SQLVarTimeStampTzEx extends SQLVarTimeStampTz {
    decode(data, lowerV13) {
        var date = data.readInt();
        var time = data.readUInt();
        data.readInt(); // skip timezone info
        data.readInt(); // skip ext_offset
        if (!lowerV13 || !data.readInt()) {
            // The wire value is already a UTC instant. Construct from epoch milliseconds:
            // Date's constructor is UTC-based, whereas setMilliseconds() is a *local-time*
            // setter, so rolling forward from new Date(0) across a DST boundary shifts the
            // result by the DST delta (see the regression tests in test/timezone.js).
            return new Date((date - DateOffset) * TimeCoeff + Math.floor(time / 10));
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_ex_timestamp_tz);
    }
}
exports.SQLVarTimeStampTzEx = SQLVarTimeStampTzEx;
//------------------------------------------------------
class SQLVarBoolean extends SQLVarBase {
    decode(data, lowerV13) {
        var ret = data.readInt();
        if (!lowerV13 || !data.readInt()) {
            return Boolean(ret);
        }
        return null;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_bool);
    }
}
exports.SQLVarBoolean = SQLVarBoolean;
//------------------------------------------------------
class SQLParamInt {
    constructor(value) {
        this.value = value;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_long);
        blr.addShort(0);
    }
    encode(data) {
        if (this.value != null) {
            data.addInt(this.value);
        }
        else {
            data.addInt(0);
            data.addInt(1);
        }
    }
}
exports.SQLParamInt = SQLParamInt;
//------------------------------------------------------
class SQLParamInt64 {
    constructor(value) {
        this.value = value;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_int64);
        blr.addShort(0);
    }
    encode(data) {
        if (this.value != null) {
            data.addInt64(this.value);
        }
        else {
            data.addInt64(0);
            data.addInt(1);
        }
    }
}
exports.SQLParamInt64 = SQLParamInt64;
//------------------------------------------------------
class SQLParamInt128 {
    constructor(value) {
        this.value = value;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_int128);
        blr.addShort(0);
    }
    encode(data) {
        if (this.value != null) {
            data.addInt128(this.value);
        }
        else {
            data.addInt128(0);
            data.addInt(1);
        }
    }
}
exports.SQLParamInt128 = SQLParamInt128;
//------------------------------------------------------
const FIXED_POINT_RE = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;
/**
 * Convert a decimal input to the signed integer coefficient used by a
 * Firebird fixed-point wire type. Numbers are interpreted through their
 * canonical decimal string; strings and bigints never pass through Number.
 * Digits discarded by the target scale are rounded to nearest, ties away
 * from zero, matching Firebird's conversion of decimal parameter text.
 */
function toScaledInteger(value, scale, bits) {
    if (!Number.isSafeInteger(scale)) {
        throw new TypeError('Fixed-point scale must be an integer');
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new TypeError('Fixed-point value must be finite');
    }
    if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'bigint') {
        throw new TypeError('Fixed-point value must be a number, string, or bigint');
    }
    const text = String(value).trim();
    const match = FIXED_POINT_RE.exec(text);
    if (!match) {
        throw new TypeError('Invalid fixed-point value: ' + text);
    }
    const negative = match[1] === '-';
    const integer = match[2] || '0';
    const fraction = match[3] !== undefined ? match[3] : (match[4] || '');
    const exponent = match[5] === undefined ? 0 : Number(match[5]);
    if (!Number.isSafeInteger(exponent)) {
        throw new RangeError('Fixed-point exponent is outside the supported range: ' + match[5]);
    }
    let digits = (integer + fraction).replace(/^0+/, '') || '0';
    if (digits === '0')
        return 0n;
    const shift = exponent - fraction.length - scale;
    let coefficientDigits;
    let roundUp = false;
    if (shift >= 0) {
        // Every supported destination is at most 39 decimal digits. Avoid
        // constructing an arbitrarily large BigInt for inputs such as 1e999999.
        if (digits.length + shift > 40) {
            throw new RangeError('Fixed-point value is outside the signed ' + bits + '-bit range: ' + text);
        }
        coefficientDigits = digits + '0'.repeat(shift);
    }
    else {
        const discarded = -shift;
        if (discarded < digits.length) {
            const split = digits.length - discarded;
            coefficientDigits = digits.slice(0, split);
            roundUp = digits.charCodeAt(split) >= 0x35;
        }
        else {
            coefficientDigits = '0';
            // If discarded exceeds the number of significant digits, the
            // magnitude is below 0.1 coefficient and cannot round to one.
            roundUp = discarded === digits.length && digits.charCodeAt(0) >= 0x35;
        }
    }
    let coefficient = BigInt(coefficientDigits);
    if (roundUp)
        coefficient += 1n;
    if (negative)
        coefficient = -coefficient;
    const width = BigInt(bits);
    const min = -(1n << (width - 1n));
    const max = (1n << (width - 1n)) - 1n;
    if (coefficient < min || coefficient > max) {
        throw new RangeError('Fixed-point value is outside the signed ' + bits + '-bit range: ' + text);
    }
    return coefficient;
}
//------------------------------------------------------
class SQLParamDecFloat16 {
    constructor(value) {
        this.value = value;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_dec64);
        blr.addShort(0);
    }
    encode(data) {
        if (this.value != null) {
            data.addDecFloat16(this.value);
        }
        else {
            data.addDecFloat16(0);
            data.addInt(1);
        }
    }
}
exports.SQLParamDecFloat16 = SQLParamDecFloat16;
//------------------------------------------------------
class SQLParamDecFloat34 {
    constructor(value) {
        this.value = value;
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_dec128);
        blr.addShort(0);
    }
    encode(data) {
        if (this.value != null) {
            data.addDecFloat34(this.value);
        }
        else {
            data.addDecFloat34(0);
            data.addInt(1);
        }
    }
}
exports.SQLParamDecFloat34 = SQLParamDecFloat34;
//------------------------------------------------------
class SQLParamDouble {
    constructor(value) {
        this.value = value;
    }
    encode(data) {
        if (this.value != null) {
            data.addDouble(this.value);
        }
        else {
            data.addDouble(0);
            data.addInt(1);
        }
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_double);
    }
}
exports.SQLParamDouble = SQLParamDouble;
//------------------------------------------------------
class SQLParamString {
    constructor(value) {
        this.value = value;
    }
    encode(data) {
        if (this.value != null) {
            data.addText(this.value, const_1.default.DEFAULT_ENCODING);
        }
        else {
            data.addInt(1);
        }
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_text);
        var len = this.value ? Buffer.byteLength(this.value, const_1.default.DEFAULT_ENCODING) : 0;
        blr.addWord(len);
    }
}
exports.SQLParamString = SQLParamString;
//------------------------------------------------------
class SQLParamBuffer {
    constructor(value) {
        this.value = value;
    }
    encode(data) {
        if (this.value != null) {
            data.addParamBuffer(this.value);
        }
        else {
            data.addInt(1);
        }
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_text);
        var len = this.value ? this.value.length : 0;
        blr.addWord(len);
    }
}
exports.SQLParamBuffer = SQLParamBuffer;
//------------------------------------------------------
/**
 * Split a JS Date into the Firebird wire representation used by
 * TIMESTAMP/DATE/TIME columns: `date` is the modified-Julian day number and
 * `time` the count of 100-microsecond units since midnight (local time).
 */
function encodeDateTimeParts(value) {
    var ms = value.getTime() - value.getTimezoneOffset() * MsPerMinute;
    var time = ms % TimeCoeff;
    var date = (ms - time) / TimeCoeff + DateOffset;
    time *= 10;
    // check overflow (dates before the epoch)
    if (time < 0) {
        date--;
        time = TimeCoeff * 10 + time;
    }
    return { date: date, time: time };
}
//------------------------------------------------------
class SQLParamQuad {
    constructor(value) {
        this.value = value;
    }
    encode(data) {
        if (this.value != null) {
            data.addInt(this.value.high);
            data.addInt(this.value.low);
        }
        else {
            data.addInt(0);
            data.addInt(0);
            data.addInt(1);
        }
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_quad);
        blr.addShort(0);
    }
}
exports.SQLParamQuad = SQLParamQuad;
//------------------------------------------------------
class SQLParamDate {
    constructor(value) {
        this.value = value;
    }
    encode(data) {
        if (this.value != null) {
            var parts = encodeDateTimeParts(this.value);
            data.addInt(parts.date);
            data.addUInt(parts.time);
        }
        else {
            data.addInt(0);
            data.addUInt(0);
            data.addInt(1);
        }
    }
    calcBlr(blr) {
        blr.addByte(const_1.default.blr_timestamp);
    }
}
exports.SQLParamDate = SQLParamDate;
//------------------------------------------------------
class SQLParamBool {
    constructor(value, asBoolean = false) {
        this.value = value;
        this.asBoolean = asBoolean;
    }
    encode(data) {
        if (this.asBoolean) {
            // xdr_datum sends booleans as 1 opaque value byte + 3 pad bytes
            // (NOT a big-endian int: the value byte comes FIRST — addInt(1)
            // would decode server-side as false). Matches the batch encoder.
            data.addBuffer(Buffer.from([this.value ? 1 : 0]));
            data.addAlignment(1);
            return;
        }
        if (this.value != null) {
            data.addInt(this.value ? 1 : 0);
        }
        else {
            data.addInt(0);
            data.addInt(1);
        }
    }
    calcBlr(blr) {
        if (this.asBoolean) {
            blr.addByte(const_1.default.blr_bool);
            return;
        }
        blr.addByte(const_1.default.blr_short);
        blr.addShort(0);
    }
}
exports.SQLParamBool = SQLParamBool;
