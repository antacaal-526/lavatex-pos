/***************************************
 *
 *   Single-byte codepage codecs (WIN125x, ISO8859_x, KOI8, DOS866)
 *
 *   Node's Buffer only decodes utf8/latin1/ascii natively. These
 *   codepages are decoded through the WHATWG TextDecoder (backed by
 *   ICU — present in every official Node build) and encoded through
 *   reverse tables built from the same decoder at first use, so the
 *   two directions can never disagree. Issues #319/#301/#422.
 *
 ***************************************/
export interface TextCodec {
    /** Firebird charset name (upper case). */
    name: string;
    decode(buffer: Buffer): string;
    encode(value: string): Buffer;
}
export declare function charsetWidthById(id: number | undefined): number;
/**
 * Codec for a Firebird charset name, or null when the charset is unknown or
 * natively handled by Buffer. A known codepage whose ICU table is unavailable
 * throws instead of silently falling back to UTF-8. Successful and unknown
 * lookups are cached; failures are not.
 */
export declare function getCodec(charsetName: string | undefined): TextCodec | null;
