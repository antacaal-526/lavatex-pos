/***************************************
 *
 *   queryStream — object-mode Readable over sequentially()
 *
 ***************************************/
import { Readable } from 'stream';
/**
 * Build an object-mode Readable that emits one row per chunk, implemented
 * on top of `target.sequentially()`'s next()-based backpressure: fetching
 * pauses whenever the stream's internal buffer is full and resumes when
 * the consumer drains it. Shared by Database.queryStream and
 * Transaction.queryStream.
 *
 * Destroying the stream early (including a pipeline() teardown) aborts the
 * row loop, which releases the statement server-side.
 */
declare function makeQueryStream(target: any, query: string, params?: any, options?: any): Readable;
export = makeQueryStream;
