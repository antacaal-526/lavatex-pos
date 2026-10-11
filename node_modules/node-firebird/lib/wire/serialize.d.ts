export declare class BlrWriter {
    buffer: Buffer;
    pos: number;
    constructor(size?: number);
    ensure(len: number): void;
    addByte(b: number): void;
    addShort(b: number): void;
    addSmall(b: number): void;
    addWord(b: number): void;
    addInt32(b: number): void;
    addByteInt32(c: number, b: number): void;
    addNumeric(c: number, v: number): void;
    addBytes(b: number[] | Buffer): void;
    addString(c: number, s: string, encoding: BufferEncoding): void;
    addBuffer(b: Buffer): void;
    addString2(c: number, s: string, encoding: BufferEncoding): void;
    addMultiblockPart(c: number, s: string, encoding: BufferEncoding): void;
}
/***************************************
 *
 *   BLR Reader
 *
 ***************************************/
export declare class BlrReader {
    buffer: Buffer;
    pos: number;
    constructor(buffer: Buffer);
    readByteCode(): number;
    readInt32(): number;
    readInt(): number | undefined;
    readString(encoding?: BufferEncoding): string;
    readSegment(): Buffer;
}
/***************************************
 *
 *   XDR Writer
 *
 ***************************************/
export declare class XdrWriter {
    buffer: Buffer;
    pos: number;
    constructor(size?: number);
    ensure(len: number): void;
    addInt(value: number): void;
    addInt64(value: number | bigint): void;
    addInt128(value: number | bigint | string): void;
    addDecFloat16(value: number | string | bigint): void;
    addDecFloat34(value: number | string | bigint): void;
    addUInt(value: number): void;
    addString(s: string, encoding: BufferEncoding): void;
    /** addString for pre-encoded bytes (codepage connection charsets). */
    addStringBuffer(b: Buffer): void;
    addText(s: string, encoding: BufferEncoding): void;
    addParamBuffer(b: Buffer): void;
    addBlr(blr: BlrWriter): void;
    getData(): Buffer;
    addDouble(value: number): void;
    addFloat(value: number): void;
    addQuad(quad: {
        low: number;
        high: number;
    }): void;
    addBuffer(buffer: Buffer): void;
    addAlignment(len: number): void;
}
/***************************************
 *
 *   XDR Reader
 *
 ***************************************/
export declare class XdrReader {
    buffer: Buffer;
    pos: number;
    /** opcode carried over for a resumed decode (vestigial, see connection.ts) */
    r?: number | null;
    /** partial fetch-op flag (vestigial) */
    fop?: boolean;
    /** fetch status of the current row batch (100 = end of cursor) */
    fstatus?: number;
    /** rows remaining in the current packet */
    fcount?: number;
    /** column index the row decode stopped at */
    fcolumn?: number;
    /** row currently being decoded (object or array) */
    frow?: any;
    /** rows decoded so far in this call */
    frows?: any[];
    /** cached object-row keys (column aliases, qualified when nestTables is set) */
    fcols?: string[];
    /** cached per-column table keys when nestTables === true */
    ftables?: string[];
    constructor(buffer: Buffer);
    readInt(): number;
    readUInt(): number;
    readInt64(): number;
    readInt64BigInt(): bigint;
    readInt128(): bigint;
    readInt128Signed(): bigint;
    readDecFloat16(): string | number;
    readDecFloat34(): string | number;
    readShort(): number;
    readQuad(): {
        low: number;
        high: number;
    };
    readFloat(): number;
    readDouble(): number;
    readArray(): Buffer<ArrayBuffer> | undefined;
    readBuffer(len?: number, toAlign?: boolean): Buffer | undefined;
    readString(encoding: BufferEncoding): string;
    readText(len: number, encoding: BufferEncoding): string;
}
export declare class BitSet {
    data: number[];
    constructor(buffer?: Buffer);
    scale(index: number): void;
    set(index: number, value?: boolean | number): void;
    get(index: number): number;
    toBuffer(): Buffer;
}
