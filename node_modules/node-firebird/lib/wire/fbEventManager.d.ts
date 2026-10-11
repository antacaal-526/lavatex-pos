import Events from 'events';
declare class FbEventManager extends Events.EventEmitter {
    db: any;
    eventconnection: any;
    events: Record<string, number>;
    eventid: number;
    _subscriptionVersion: number;
    _activeSubscriptionVersion: number;
    _hasActiveSubscription: boolean;
    _baselinePending: boolean;
    _eventBaseline: boolean;
    _baselineChangeInProgress: boolean;
    _baselineCallbacks: Array<(err: any, ret?: any) => void>;
    _hasQueuedBaseline: boolean;
    _retiredEventIdLimit: number;
    _baselineCloseRequested: boolean;
    _baselineCloseCallbacks: Array<(err?: any) => void>;
    _readySettled: boolean;
    _terminalErrorReported: boolean;
    _readyCallback: (err: any, ret?: any) => void;
    constructor(db: any, eventconnection: any, eventid: number, callback: (err: any, ret?: any) => void);
    on(event: 'baseline', listener: (counts: Readonly<Record<string, number>>) => void): this;
    on(event: 'post_event', listener: (name: string, count: number) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    once(event: 'baseline', listener: (counts: Readonly<Record<string, number>>) => void): this;
    once(event: 'post_event', listener: (name: string, count: number) => void): this;
    once(event: 'error', listener: (error: Error) => void): this;
    _finishReady(err?: Error): void;
    _handleAsyncError(err: any): void;
    /**
     * Returns a snapshot of the current state for debugging.
     * Useful for tracing the state machine during development.
     *
     * Stable states: 'IDLE', 'SUBSCRIBED', 'CLOSED'.
     * Transient states (SUBSCRIBING, CANCELLING, CLOSING) occur while waiting
     * for op_response on the main connection or for the socket to close; they
     * are not tracked with dedicated flags to keep the implementation simple,
     * but they can be inferred: if the socket is open and _hasActiveSubscription
     * disagrees with what the caller expects, a transitional operation is in
     * progress.
     *
     * @returns {{
     *   state: string,
     *   hasActiveSubscription: boolean,
     *   registeredEvents: Object,
     *   eventId: number,
     *   isEventConnectionOpen: boolean,
     *   isDatabaseConnectionClosed: boolean
     * }}
     */
    getState(): {
        state: string;
        hasActiveSubscription: boolean;
        registeredEvents: Record<string, number>;
        eventId: number;
        isEventConnectionOpen: boolean;
        isDatabaseConnectionClosed: boolean;
    };
    _createEventLoop(): void;
    _changeEvent(callback: (err: any, ret?: any) => void): void;
    _isRetiredEventId(eventId: number): boolean;
    _changeEventWithBaseline(callback: (err: any, ret?: any) => void): void;
    registerEvent(events: string[], callback: (err: any, ret?: any) => void): any;
    unregisterEvent(events: string[], callback: (err: any, ret?: any) => void): any;
    close(callback?: (err?: any) => void): void;
}
export = FbEventManager;
