import type { TextCodec } from './codepages';
import type { XdrReader, XdrWriter, BlrWriter } from './serialize';
import type { NumericMode, RecordCounts } from '../types';
type NumericDecodeOptions = {
    numericMode?: NumericMode;
};
export declare function getFirebirdCharsetWidth(charset?: string): number;
/**
 * Resolve the Node.js Buffer encoding to use when decoding text from a
 * Firebird response buffer.
 *
 * @param {object|null} options  Connection options object (may be falsy).
 * @returns {string}             A Node.js-compatible encoding string.
 */
export declare function resolveTextEncoding(options?: any): BufferEncoding;
/**
 * Codec for the CONNECTION charset when it is a codepage Node cannot
 * handle natively (WIN1251, ISO8859_7, KOI8R, …); null on the native
 * path (UTF8/latin1/ascii) and for unknown charsets. With a codec
 * connection charset the server transliterates all text to that
 * codepage, so every text column, parameter, SQL string and text blob
 * goes through the codec (issues #319/#301).
 */
export declare function resolveTextCodec(options?: any): TextCodec | null;
interface TextState {
    key: string | undefined;
    codec: TextCodec | null;
    enc: BufferEncoding;
    width: number;
}
/**
 * Per-connection text handling, resolved once and memoized on the
 * long-lived options object: the decode loop calls this per CELL, and
 * recomputing uppercased names + map lookups a million times per large
 * fetch is pure waste. Invalidated if options.encoding ever changes.
 */
export declare function resolveTextState(options?: any): TextState;
/**
 * Encode text in the CONNECTION charset — the byte form the server
 * expects for parameters, SQL statement text and text-blob content.
 */
export declare function encodeConnectionText(options: any, value: string): Buffer;
/**
 * Decode connection-charset bytes to text (the read counterpart of
 * encodeConnectionText — used for text blobs).
 */
export declare function decodeConnectionText(options: any, buffer: Buffer): string;
/**
 * Common shape of all SQLVar descriptor objects.  The metadata properties
 * are populated externally (in connection.ts) from the op_prepare_statement
 * describe response before decode()/calcBlr() are called.
 */
export declare abstract class SQLVarBase {
    type: number;
    subType: number;
    scale: number;
    length: number;
    nullable: boolean;
    field?: string;
    relation?: string;
    relationSchema?: string;
    alias?: string;
    relationAlias?: string;
    owner?: string;
    charSetId?: number;
    collationId?: number;
    /** Original declared byte length when scaleOutputLengths widened
     *  `length` for the fetch capacity check (issue #422). */
    nativeLength?: number;
    abstract decode(data: XdrReader, lowerV13: boolean, options?: any): any;
    abstract calcBlr(blr: BlrWriter): void;
}
/** Effective object-row key(s) of one output column (see computeColumnKeys). */
export interface ColumnKey {
    /** Top-level table key when nestTables === true; undefined otherwise. */
    table?: string;
    /** Property key: the column alias, or 'table<sep>alias' in separator mode. */
    key: string;
}
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
export declare function computeColumnKeys(output: SQLVarBase[], nestTables: boolean | string | undefined, lowercaseKeys: boolean | undefined, transform?: (key: string) => string): ColumnKey[];
/** transformKeys option value: the built-in 'camel', or a custom mapper. */
export type KeyTransform = 'camel' | ((key: string) => string);
/** FIRST_NAME → firstName (the transformKeys: 'camel' built-in). */
export declare function camelizeKey(key: string): string;
/**
 * Resolve the effective transformKeys value (per-query wins over the
 * connection option) into a callable mapper, or undefined when off.
 * A custom mapper is guarded like the typeCast hook: a throw inside the
 * row-decode loop would be mistaken for an incomplete packet and desync
 * the response queue, so failures fall back to the untransformed key.
 */
export declare function resolveKeyTransform(queryOptions: {
    transformKeys?: KeyTransform;
} | undefined, connectionOptions: {
    transformKeys?: KeyTransform;
} | undefined): ((key: string) => string) | undefined;
/**
 * Resolve the effective nestTables value: the per-query option wins over
 * the connection option. The decoder and fetchBlobSyncRow both use this —
 * they must agree on whether nesting is active or blob cells are looked
 * up in the wrong place.
 */
export declare function resolveNestTables(queryOptions: {
    nestTables?: boolean | string;
} | undefined, connectionOptions: {
    nestTables?: boolean | string;
} | undefined): boolean | string | undefined;
/**
 * The object a column's value lives in: the row itself, or — when the
 * column carries a nestTables table qualifier — the row's per-table
 * sub-object, created on first use. Every site that reads or writes a
 * cell by ColumnKey must resolve it through here.
 */
export declare function nestCell(row: any, table: string | undefined): any;
/** Human-readable names for the SQL_* wire type codes. */
export declare const SQL_TYPE_NAMES: Record<number, string>;
/**
 * Public column-metadata shape for one output descriptor: the vocabulary
 * both the typeCast hook and withMeta `fields` deliver. Keep the two in
 * lockstep by building both through here.
 */
export declare function describeField(meta: Partial<SQLVarBase>): {
    type: number;
    typeName: string;
    subType: number | undefined;
    scale: number | undefined;
    length: number | undefined;
    nullable: boolean | undefined;
    field: string | undefined;
    relation: string | undefined;
    relationAlias: string | undefined;
    relationSchema: string | undefined;
    alias: string | undefined;
};
/**
 * Map a statement's output descriptors to the column-metadata array
 * delivered in withMeta results ({ rows, fields, ... }).
 */
export declare function describeFields(output: SQLVarBase[]): {
    type: number;
    typeName: string;
    subType: number | undefined;
    scale: number | undefined;
    length: number | undefined;
    nullable: boolean | undefined;
    field: string | undefined;
    relation: string | undefined;
    relationAlias: string | undefined;
    relationSchema: string | undefined;
    alias: string | undefined;
}[];
/**
 * Parse the op_info_sql response buffer of a Const.RECORDS_INFO request
 * into per-verb row counts. The buffer holds an isc_info_sql_records
 * cluster (2-byte total length, then nested isc_info_req_*_count items,
 * each 2-byte length + little-endian integer) terminated by isc_info_end.
 */
export declare function parseRecordCounts(buffer: Buffer | undefined): RecordCounts;
export declare class SQLVarText extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean, options?: any): string | Buffer<ArrayBufferLike> | null | undefined;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarNull extends SQLVarText {
}
export declare class SQLVarString extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean, options?: any): string | Buffer<ArrayBufferLike> | null | undefined;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarQuad extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): {
        low: number;
        high: number;
    } | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarBlob extends SQLVarQuad {
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarArray extends SQLVarQuad {
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarInt extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): number | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarShort extends SQLVarInt {
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarInt64 extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean, options?: NumericDecodeOptions): string | number | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarInt128 extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean, options?: NumericDecodeOptions): string | number | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarDecFloat16 extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): string | number | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarDecFloat34 extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): string | number | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarFloat extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): number | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarDouble extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): number | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarDate extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): Date | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarTime extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): Date | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarTimeStamp extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): Date | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarTimeTz extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): Date | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarTimeTzEx extends SQLVarTimeTz {
    decode(data: XdrReader, lowerV13: boolean): Date | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarTimeStampTz extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): Date | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarTimeStampTzEx extends SQLVarTimeStampTz {
    decode(data: XdrReader, lowerV13: boolean): Date | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLVarBoolean extends SQLVarBase {
    decode(data: XdrReader, lowerV13: boolean): boolean | null;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLParamInt {
    value: any;
    constructor(value: any);
    calcBlr(blr: BlrWriter): void;
    encode(data: XdrWriter): void;
}
export declare class SQLParamInt64 {
    value: any;
    constructor(value: any);
    calcBlr(blr: BlrWriter): void;
    encode(data: XdrWriter): void;
}
export declare class SQLParamInt128 {
    value: any;
    constructor(value: any);
    calcBlr(blr: BlrWriter): void;
    encode(data: XdrWriter): void;
}
/**
 * Convert a decimal input to the signed integer coefficient used by a
 * Firebird fixed-point wire type. Numbers are interpreted through their
 * canonical decimal string; strings and bigints never pass through Number.
 * Digits discarded by the target scale are rounded to nearest, ties away
 * from zero, matching Firebird's conversion of decimal parameter text.
 */
export declare function toScaledInteger(value: number | string | bigint, scale: number, bits: 16 | 32 | 64 | 128): bigint;
export declare class SQLParamDecFloat16 {
    value: any;
    constructor(value: any);
    calcBlr(blr: BlrWriter): void;
    encode(data: XdrWriter): void;
}
export declare class SQLParamDecFloat34 {
    value: any;
    constructor(value: any);
    calcBlr(blr: BlrWriter): void;
    encode(data: XdrWriter): void;
}
export declare class SQLParamDouble {
    value: any;
    constructor(value: any);
    encode(data: XdrWriter): void;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLParamString {
    value: any;
    constructor(value: any);
    encode(data: XdrWriter): void;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLParamBuffer {
    value: any;
    constructor(value: any);
    encode(data: XdrWriter): void;
    calcBlr(blr: BlrWriter): void;
}
/**
 * Split a JS Date into the Firebird wire representation used by
 * TIMESTAMP/DATE/TIME columns: `date` is the modified-Julian day number and
 * `time` the count of 100-microsecond units since midnight (local time).
 */
export declare function encodeDateTimeParts(value: Date): {
    date: number;
    time: number;
};
export declare class SQLParamQuad {
    value: any;
    constructor(value: any);
    encode(data: XdrWriter): void;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLParamDate {
    value: any;
    constructor(value: any);
    encode(data: XdrWriter): void;
    calcBlr(blr: BlrWriter): void;
}
export declare class SQLParamBool {
    value: any;
    /**
     * Encode as a real BOOLEAN (blr_bool + xdr opaque byte) instead of the
     * legacy blr_short 0/1. Set when the DESCRIBED parameter type is
     * SQL_BOOLEAN: Firebird refuses smallint→BOOLEAN conversion
     * ("conversion error from string", issue #122), and conversely BOOLEAN
     * does not convert to numbers — so smallint targets keep the legacy
     * form for compatibility.
     */
    asBoolean: boolean;
    constructor(value: any, asBoolean?: boolean);
    encode(data: XdrWriter): void;
    calcBlr(blr: BlrWriter): void;
}
export {};
