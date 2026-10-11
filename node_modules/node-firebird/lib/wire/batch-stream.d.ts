/***************************************
 *
 *   batchStream — object-mode Writable over the Firebird 4 batch API
 *
 *   The COPY FROM analogue: write parameter rows, they are flushed in
 *   chunks through statement.executeBatch (single prepared statement,
 *   protocol-level batching, BLOB values included). Backpressure is the
 *   Writable machinery itself: a write callback is held while a chunk
 *   is in flight.
 *
 ***************************************/
import { Writable } from 'stream';
/**
 * Build the Writable for Database.batchStream / Transaction.batchStream.
 * With `ownsTransaction` (the Database form) the stream runs its own
 * transaction: committed on finish, rolled back on error/destroy —
 * all-or-nothing for the whole stream. The Transaction form leaves
 * commit/rollback to the caller.
 *
 * Rows accumulate up to options.flushRows (default 1000) per
 * executeBatch flush; the remaining executeBatch options (chunkSize,
 * bufferSize, …) pass through. After 'finish', stream.recordCount and
 * stream.affectedRows carry the totals.
 */
declare function makeBatchStream(target: any, query: string, options: any, ownsTransaction: boolean): Writable;
export = makeBatchStream;
