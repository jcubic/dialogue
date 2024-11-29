function trim(str) {
    return str.replace(/[\s\n]+$/, '').replace(/^\s+\n/, '');
}

$.terminal.figlet = function(font, text, { color = null, ...options } = {}) {
    return function() {
        const cols = this.cols();
        let result = figlet.textSync(text, {
            font: font,
            width: cols,
            whitespaceBreak: true,
            ...options
        });
        result = trim(result);
        if (color === null) {
            return result;
        }
        return '[[;' + color + ';]' + result + ']';
    };
};

const fontpath = 'https://cdn.jsdelivr.net/npm/figlet/fonts';

function all_include(items, list) {
    return items.every(item => list.includes(item));
}

$.terminal.figlet.load = function(fonts, fontPath = fontpath) {
    const installed = [];
    if (all_include(fonts, installed)) {
        return Promise.resolve();
    }
    let last_path;
    return new Promise(resolve => {
        if (last_path !== fontPath) {
            last_path = fontPath;
            figlet.defaults({ fontPath });
        }
        figlet.preloadFonts(fonts, () => {
            installed.push(...fonts);
            resolve();
        });
    })
}

function is_system_command(command) {
    return command.match(/^\s*\/[^\s]+/);
}

function is_function(object) {
    return typeof object === 'function';
}

function utc_now() {
    const date = new Date();
    return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds()
    );
    return new Date(now_utc);
}

function format_time(date) {
    return date.toLocaleString().replace(/.*,\s*/, '');
}

function is_promise(object) {
    return object && typeof object.then === 'function';
}

function unpromise(value, callback) {
    if (is_promise(value)) {
        return value.then(callback);
    }
    return callback(value);
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

const color = (function() {
    const colors = {};
    return (username) => {
        const color = colors[username] = colors[username] || randomColor({
            luminosity: 'light'
        });
        return `[[;${color};]${username}]`;
    }
})();

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

// create random string of 10 digits in javascript
// https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function rand() {
    return Math.random().toString(36).substr(2, 10);
}

class BaseAdapter extends EventEmitter {
    constructor() {
        super();
        this._rnd = rand();
        this._unread_messages = 0;
        this._focus = true;
        this._now = Date.now();
        this.on('message', (message) => {
            console.log({ new: this.is_new_message(message) });
            if (this.is_new_message(message)) {
                this._unread_messages++;
                this.emit('messages-count', this._unread_messages);
                this.emit('new-message', message);
            }
        });
        document.addEventListener("visibilitychange", () => {
            this._focus = in_focus();
            this.emit('visiblity', this._focus);
            if (!this._focus) {
                this.clear_unread();
            }
        });
    }
    is_new_message(message) {
        if (this._now > message.datetime) {
            return false;
        }
        console.log({ rnd: message.rnd, random_id: this.random_id(), focus: in_focus() });
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
    logout() { }
    get_user() {
        return null;
    }
    async set_nick(username) { }
    async auth(provider_name) { }
    quit(room) { }
    async rooms() {
        return [];
    }
    join(room) { }
    send(username, datetime, message) { }
    set({ render }) { }
}

class FirebaseAdapter extends BaseAdapter {
    constructor(firebase_config) {
        super();
        firebase.initializeApp(firebase_config);
        this._database = firebase.database();
        this._messages = this._database.ref('messages');
        this._users = this._database.ref('users');
        this._auth = firebase.auth();
        this._rooms = {};
        this._current_room;
        this._logout = this._auth.onAuthStateChanged(user => {
            if (user) {
                this._login(user);
                let username = user.displayName;
                const ref = this._database.ref(`/users/${user.uid}`);
                ref.once('value').then(snapshot => {
                    const payload = { };
                    if (!snapshot.exists()) {
                        payload.username = username;
                        payload.counter = 1;
                        ref.update(payload);
                    } else {
                        username = snapshot.val().username;
                        this._username = username;
                        ref.child('counter').transaction(prev => {
                            return (prev || 0) + 1;
                        });
                    }
                    ref.onDisconnect().set({
                        'counter': firebase.database.ServerValue.increment(-1),
                        username: this.get_user()
                    });
                    this.emit('auth', this.get_user());
                });
            }
        });
    }
    users() {
        return this._users.once('value').then(snapshot => {
            const users = Object.values(snapshot.val());

            return users.filter(user => {
                return user.counter > 0;
            }).map(user => {
                return user.username;
            });
        });
    }
    uid() {
        if (!this._user) {
            return null;
        }
        return this._user.uid;
    }
    _login(user) {
        this._user = user;
    }
    is_valid_name(username) {
        return this._users.once('value').then(snapshot => {
            const users = snapshot.val();

            const uid = this.uid();
            return !Object.entries(users).find(([key, user]) => {
                return user.username === username && key !== uid;
            });
        });
    }
    logout() {
        this._logout();
    }
    get_user() {
        if (!this._user) {
            throw new Error(`you're not authenticated`);
        }
        return this._username || this._user.displayName;
    }
    async set_nick(username) {
        username = username.trim();
        if (!username) {
            throw new Error(`Nick can't be empty`);
        }
        if (await this.is_valid_name(username)) {
            this._users.child(this.uid()).update({
                username
            });
            this._username = username;
            this.emit('nick', this.get_user());
        } else {
            throw new Error(`name ${username} is already taken`);
        }
    }
    get_auth_provider(name) {
        switch(name) {
            case 'google':
                return new firebase.auth.GoogleAuthProvider();
            case 'twitter':
                return new firebase.auth.TwitterAuthProvider();
            case 'github':
                return new firebase.auth.GithubAuthProvider();
            case 'facebook':
                return new firebase.auth.FacebookAuthProvider();
            default:
                throw new Error('Unknown provider');
        }
    }
    is_suppoted_provider(name) {
        return name.match(/^(google|twitter|github|facebook)$/)
    }
    async auth(provider_name) {
        if (this.is_suppoted_provider(provider_name)) {
            const provider = this.get_auth_provider(provider_name);
            const result = await this._auth.signInWithPopup(provider);
            if (result) {
                var credential = result.credential;
                //token = credential.accessToken;
                this._login(result.user);
            }
        }
    }
    quit(room = null) {
        if (room === null) {
            for (const ref of this._rooms) {
                ref.off();
            }
            this._rooms = {};
        } else {
            this._rooms[room].off();
            delete this._rooms[room];
        }
    }
    rooms() {
        return this._messages.once('value').then((snapshot) => {
            const keys = [];
            snapshot.forEach(function(child) {
                keys.push(child.key);
            });
            return keys;
        });
    }
    join(room) {
        this._rooms[room] = this._messages.child(room);
        this._current_room = this._rooms[room];
        this._rooms[room].limitToLast(100).on('child_added', (snapshot) => {
            const data = snapshot.val();
            const { message, username, datetime, rnd } = data;
            if (this._render) {
                const date = new Date(datetime);
                this.emit('message', {
                    username,
                    datetime,
                    message,
                    rnd
                });
                this._render(username, date, message);
            }
        });
        return () => {
            this._rooms[room].off();
        }
    }
    send(username, datetime, message) {
        const payload = {
            username,
            message,
            datetime,
            uuid: this.uid(),
            rnd: this.random_id()
        };
        this._current_room.push(payload);
    }
    set({ render }) {
        this._render = render;
    }
}

class BaseRenderer {
    init(adapter) { }
    on_join(room) { }
    on_quit() { }
    render({ username, datetime, message }) {
        console.log({ username, datetime, message });
    }
    in_focus() {
        return true;
    }
    error(e) {
        console.error(e.message);
        console.error(e.stack);
    }
}

class Terminal extends BaseRenderer {
    constructor(terminal) {
        super();
        this._term = terminal;
    }
    async init({ adapter, system: system_command, greetings, prompt: user_prompt } = {}) {
        this._adapter = adapter;
        this._term.pause();
        const term = this._term;

        this._view = term.export_view();

        const formatter = new Intl.ListFormat('en', {
            style: 'long',
            type: 'conjunction',
        });

        adapter.on('auth', username => {
            this.log(`You're authenticated as ${username}`);
        })
        adapter.on('nick', username => {
            this.log(`You're now known as ${username}`);
        });

        async function rooms() {
            const rooms = await adapter.rooms();
            const formatted = rooms.map(room => `<white class="room">${room}</white>`);
            return formatter.format(formatted);
        }

        this._users = async function users() {
            const users = await adapter.users();
            if (users.length) {
                return formatter.format(users);
            }
            return '';
        }

        const prompt = user_prompt ?? '[[;#3AB4DB;]dialogue]> ';
        const color = '#D58315';
        const font = 'ANSI Shadow';

        function render_greetings() {
            term.echo($.terminal.figlet(font, 'dialogue', { color }), {
                ansi: true
            });
            term.echo(`[[b;#4889F1;]Web-Terminal Chat v.${Dialogue.version}]\n`);
            term.echo(async () => `Available rooms: ${await rooms()}`);
        }

        this._greetings = () => {
            if (greetings) {
                if (is_function(greetings)) {
                    return greetings.call(term);
                } else {
                    term.echo(greetings);
                }
            } else if (greetings === undefined) {
                // new FIGLET API
                return $.terminal.figlet.load([font]).then(render_greetings);
            }
        };
        await this._greetings();
        function send_message(message) {
            const username = adapter.get_user();
            if (username) {
                const date = utc_now();
                adapter.send(username, date, message);
            } else {
                this.enter(message).error('Auth required');
            }
        }
        const commands = ['/figlet', '/image'];
        term.set_interpreter(function(command) {
            const echo_command = this.option('echoCommand');
            this.option('echoCommand', false);
            if (is_system_command(command)) {
                if (!echo_command) {
                    this.enter(command);
                }
                const { name, args } = $.terminal.parse_command(command);
                if (commands.includes(name)) {
                    send_message(`##COMMAND:${command}`);
                } else {
                    return system_command(name, args);
                }
            } else {
                send_message(command);
            }
        });
        term.set_prompt(prompt);
        term.resume();
        term.on('click', '.room', function () {
            const room = $(this).text();
            term.exec(`/join ${room}`);
        });
    }
    async join(room) {
        this.log(`Welcome to ${room} room`);
        const users = await this._users();
        if (users) {
            this.log(`Users online: ${users}`);
        }
    }
    echo(message) {
        this._term.echo(message);
    }
    quit() { }
    render({ username, datetime, message }) {
        function format(message) {
            const time = format_time(datetime);
            const prefix = `[${time}]<${color(username)}> `;
            message = message.replace(/```(.*)\n([\s\S]+)```/g, function(_, language, code) {
                return $.terminal.prism(language, code);
            });
            const lines = message.split('\n');
            if (lines.length == 1) {
                return prefix + message;
            } else {
                const space = ' '.repeat($.terminal.length(prefix));
                return lines.map((line, i) => {
                    if (i === 0) {
                        return prefix + line;
                    } else {
                        return space + line;
                    }
                }).join('\n');
            }
        }
        if (typeof message === 'function') {
            this.echo(function() {
                return format(message.call(this));
            });
        } else if (message.startsWith('##COMMAND:')) {
            const command = message.replace(/##COMMAND:/, '');
            const { name, args } = $.terminal.parse_command(command);
            switch(name) {
                case '/image':
                    const { src, alt } = $.terminal.parse_options(args);
                    this.render({ username, datetime, message: `<img src="${src}" alt="${alt}"/>` });
                    break;
                case '/figlet':
                    const {
                        _: fig_args,
                        font = 'Standard',
                        color
                    } = $.terminal.parse_options(args);
                    this.echo(() => {
                        return $.terminal.figlet.load([font]).then(() => {
                            const ascii = $.terminal.figlet(font, fig_args.join(' '), { color });
                            return format(ascii.call(this._term));
                        });
                    });
                    break;
                default:
                    console.warn(`Invalid command: ${command} SKIP`);
            }
        } else {
            this.echo(format(message));
        }
    }
    log(message) {
        this.echo(`[[i;#A528B9;]${message}]`);
    }
}

function in_focus() {
    return document.visibilityState === 'visible';
}

class Dialogue {
    static version = '0.1.0';
    constructor({ adapter, renderer, ready, ...args }) {
        if (!(adapter instanceof BaseAdapter)) {
            renderer.error(new Error('Adapter needs to be instance of BaseAdapter'));
            return;
        }
        if (!(renderer instanceof BaseRenderer)) {
            renderer.error(new Error('Renderer needs to be instance of BaseRenderer'));
            return;
        }

        const self = this;

        function render_message(username, datetime, message) {
            renderer.render({ username, datetime, message });
        }

        const favicon = new Favico({
            animation: 'none'
        });

        adapter.on('messages-count', (count) => {
            if (count === 0) {
                favicon.reset();
            } else {
                favicon.badge(count);
            }
        });

        this._notify = Notification.permission === 'granted';

        adapter.on('new-message', ({ username, message }) => {
            if (this._notify) {
                const notification = this.notify(`${username}: ${message}`);
                adapter.on('visiblity', (focus) => {
                    if (focus) {
                        notification.close();
                    }
                });
            }
        });

        adapter.set({ render: render_message });

        let room;

        unpromise(renderer.init({ adapter, system, ...args }), ready);

        async function system(command, args) {
            switch(command) {
                case '/login':
                    if (args.length === 0) {
                        renderer.echo('<red>error: Auth argument missing, supported auth: google</red>');
                    } else {
                        const [provider] = args;
                        await adapter.auth(provider);
                    }
                    break;
                case '/notify':
                    if (Notification.permission === 'granted') {
                        self._notify = true;
                    } else {
                        Notification.requestPermission().then((result) => {
                            self._notify = result === 'granted';
                        });
                    }
                    break;
                case '/nick':
                    const [nick] = args;
                    return adapter.set_nick(nick);
                    break;
                case '/join':
                    [room] = args;
                    if (room) {
                        await adapter.join(room);
                        await renderer.join(room);
                    }
                    break;
                case '/quit':
                    if (room) {
                        await renderer.quit(room);
                        await adapter.quit(room);
                        room = null;
                    }
                    break;
                case '/help':
                    renderer.echo('Yet to be implemented');
                    break;
                default:
                    // implement bots fetch

                    // server needs to return name of the bot
                    // { result: { message, name } }
            }
        }
    }
    notify(text) {
        const img = './assets/favicon.svg';
        return new Notification('Dialogue', { body: text, icon: img });
    }
}

// -----------------------------------------------------------------------------
// PUBLIC API

//import { Dialogue, FirebaseAdapter, Terminal } from "https://esm.sh/dialogue";

const firebase_config = {
    apiKey: 'AIzaSyA5zqBzylFJKfyahh0AStlss5mosqk75jw',
    authDomain: 'dialogue-bddd4.firebaseapp.com',
    projectId: 'dialogue-bddd4',
    storageBucket: 'dialogue-bddd4.appspot.com',
    messagingSenderId: '39616195119',
    appId: '1:39616195119:web:b872c371a915e3016574da'
};

(function() {
    const term = $('body').terminal($.noop, {
        exceptionHandler(e) {
            this.error(`Error: ${e.message}`);
        },
        greetings: false
    });

    const dialogue = window.dialogue = new Dialogue({
        adapter: new FirebaseAdapter(firebase_config),
        renderer: new Terminal(term),
        ready() {
            term.exec('/join general');
        }
    });
})();
