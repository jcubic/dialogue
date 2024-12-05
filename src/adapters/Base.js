import { random_string, in_focus } from '../utils';
import EventEmitter from '../EventEmitter';

class BaseAdapter extends EventEmitter {
    constructor() {
        super();
        this._rnd = random_string();
        this._unread_messages = 0;
        this._focus = true;
        this._now = Date.now();
        this.on('message', (message) => {
            if (this.is_new_message(message)) {
                this._unread_messages++;
                this.emit('messages-count', this._unread_messages);
                this.emit('new-message', message);
            }
        });
        this._visibility_handler = () => {
            this._focus = in_focus();
            this.emit('visiblity', this._focus);
            if (!this._focus) {
                this.clear_unread();
            }
        };
        document.addEventListener("visibilitychange", this._visibility_handler);
    }
    is_new_message(message) {
        if (this._now > message.datetime) {
            return false;
        }
        return message.rnd !== this.random_id() && !in_focus();
    }
    clear_unread() {
        this._unread_messages = 0;
        this.emit('messages-count', 0);
    }
    unread_messages() {
        return this._unread_messages;
    }
    random_id() {
        return this._rnd;
    }
    async users() {
        return [];
    }
    uid() {
        return null;
    }
    utc_now() {
        return utc_now();
    }
    logout() { }
    get_user() {
        return null;
    }
    async set_nick(username) { }
    async auth(provider_name) { }
    quit() {
        document.removeEventListener("visibilitychange", this._visibility_handler);
        this.off('message');
    }
    async rooms() {
        return [];
    }
    join(room) { }
    send(username, datetime, message) { }
    set({ render }) { }
}

export default BaseAdapter;
