"use strict";
/***************************************
 *
 *   queryStream — object-mode Readable over sequentially()
 *
 ***************************************/
const stream_1 = require("stream");
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
function makeQueryStream(target, query, params, options) {
    options = options || {};
    const streamOptions = { objectMode: true };
    if (options.highWaterMark !== undefined) {
        streamOptions.highWaterMark = options.highWaterMark;
    }
    // forwarded to sequentially(); these keys would break its plumbing
    const queryOptions = { ...options };
    delete queryOptions.on;
    delete queryOptions.asStream;
    delete queryOptions.highWaterMark;
    // sentinel used to stop the row loop on early destroy; recognized by
    // identity in the completion callback and never surfaced to the user
    const abortError = new Error('queryStream destroyed');
    let pendingNext = null;
    const resume = (err) => {
        if (pendingNext) {
            const next = pendingNext;
            pendingNext = null;
            next(err);
        }
    };
    const stream = new stream_1.Readable({
        ...streamOptions,
        read() {
            resume();
        },
        destroy(err, cb) {
            // if the row loop is paused waiting for us, abort it so the
            // statement is released instead of leaking mid-fetch
            resume(abortError);
            cb(err);
        },
    });
    target.sequentially(query, params, function (row, _index, next) {
        if (stream.destroyed) {
            next(abortError);
            return;
        }
        if (stream.push(row)) {
            next();
        }
        else {
            pendingNext = next;
        }
    }, function (err) {
        if (err && err !== abortError) {
            stream.destroy(err);
        }
        else if (!stream.destroyed) {
            stream.push(null);
        }
    }, queryOptions);
    return stream;
}
module.exports = makeQueryStream;
