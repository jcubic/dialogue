class EventEmitter {
    constructor() {
        this._events = {};
    }
    emit(event, ...args) {
        if (this._events[event]) {
            this._events[event].forEach(handler => {
                handler(...args);
            });
        }
    }
    once(event, handler) {
        const wrapper = (...args) => {
            handler(...args);
            this.off(event, wrapper);
        }
        this.on(event, wrapper);
    }
    on(event, handler) {
        this._events[event] ??= [];
        this._events[event].push(handler);
    }
    off(event, handler = null) {
        if (handler) {
            this._events[event] = this._events[event].filter(h => h !== handler);
        } else {
            delete this._events[event];
        }
    }
}

export default EventEmitter;
