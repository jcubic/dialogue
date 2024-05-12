const font = 'ANSI Shadow';

function trim(str) {
    return str.replace(/[\s\n]+$/, '');
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
const fontpath = 'https://unpkg.com/figlet/fonts/';

function all_include(items, list) {
    return items.every(item => list.includes(item));
}

$.terminal.figlet.load = function(fonts, fontPath = fontpath) {
    const installed = [];
    let last_path;
    return (() => {
        if (all_include(fonts, installed)) {
            return Promise.resolve();
        }
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
    })();
}

function is_system_command(command) {
    return command.match(/^\s*\/[^\s]+/);
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

class BaseAdapter { }

class FirebaseAdapter extends BaseAdapter {
    constructor(firebase_config, ref = 'messages') {
        super();
        firebase.initializeApp(firebase_config);
        this._database = firebase.database();
        this._messages = this._database.ref(ref);
        this._auth = firebase.auth();
        this._rooms = {};
        this._current_room;
        this._logout = this._auth.onAuthStateChanged(user => {
            if (user) {
                this._login(user);
                this.trigger('auth', this.get_user());
            }
        });
        this._events = {};
    }
    _login(user) {
        this._user = user;
    }
    trigger(event, ...args) {
        if (this._events[event]) {
            this._events[event].forEach(handler => {
                handler(...args);
            });
        }
    }
    on(event, handler) {
        this._events[event] ??= [];
        this._events[event].push(handler);
    }
    logout() {
        this._logout();
    }
    get_user() {
        if (!this._user) {
            throw new Error(`you're not authenticated`);
        }
        return this._user.displayName;
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
            const { message, username, datetime } = data;
            if (this._render) {
                const date = new Date(datetime);
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
            datetime
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
    async init(adapter, system_command) {
        this._adapter = adapter;
        this._term.pause();
        const term = this._term;

        this._view = term.export_view();

        const formatter = new Intl.ListFormat('en', {
            style: 'long',
            type: 'conjunction',
        });

        adapter.on('auth', (username) => {
            this.log(`You're authenticated as ${username}`);
        })

        async function rooms() {
            const rooms = await adapter.rooms();
            const formatted = rooms.map(room => `<white class="room">${room}</white>`);
            return formatter.format(formatted);
        }

        const prompt = '[[;#3AB4DB;]dialogue]> ';
        const color = '#D58315';

        function render_greetings() {
            term.echo($.terminal.figlet(font, 'dialogue', { color }), {
                ansi: true
            });
            term.echo(`[[b;#4889F1;]Web-Terminal Chat v.${Dialogue.version}]\n`);
            term.echo(async () => `Available rooms: ${await rooms()}`);
        }

        this._greetings = () => {
            // new FIGLET API
            return $.terminal.figlet.load([font]).then(render_greetings);
        };
        await this._greetings();
        term.set_interpreter(function(command) {
            const echo_command = this.option('echoCommand');
            this.option('echoCommand', false);
            if (is_system_command(command)) {
                if (!echo_command) {
                    this.enter(command);
                }
                const { name, args } = $.terminal.parse_command(command);
                return system_command(name, args);
            } else {
                const username = adapter.get_user();
                if (username) {
                    const date = utc_now();
                    adapter.send(username, date, command);
                } else {
                    this.enter(command).error('Auth required');
                }
            }
        });
        term.set_prompt(prompt);
        term.resume();
        term.on('click', '.room', function () {
            const room = $(this).text();
            term.exec(`/join ${room}`);
        });
    }
    join(room) {
        this.log(`Welcome to ${room} room`);
    }
    quit() { }
    render({ username, datetime, message }) {
        const time = format_time(datetime);
        this._term.echo(`[${time}]<${color(username)}> ${message}`);
    }
    log(message) {
        this._term.echo(`[[i;#A528B9;]${message}]`);
    }
}

class Dialogue {
    static version = '0.1.0';
    constructor({ adapter, renderer, ready }) {
        if (!(adapter instanceof BaseAdapter)) {
            renderer.error(new Error('Adapter needs to be instance of BaseAdapter'));
            return;
        }
        if (!(renderer instanceof BaseRenderer)) {
            renderer.error(new Error('Renderer needs to be instance of BaseRenderer'));
            return;
        }
        function render_message(username, datetime, message) {
            renderer.render({ username, datetime, message });
        }

        adapter.set({ render: render_message });

        let room;

        unpromise(renderer.init(adapter, system), ready);

        async function system(command, args) {
            switch(command) {
                case '/login':
                    const [provider] = args;
                    await adapter.auth(provider);
                    break;
                case '/join':
                    [room] = args;
                    if (room) {
                        await renderer.join(room);
                        await adapter.join(room);
                    }
                    break;
                case '/quit':
                    if (room) {
                        await renderer.quit(room);
                        await adapter.quit(room);
                        room = null;
                    }
                    break;
                case '/notify':
                    break;

                default:
                    // implement bots fetch

                    // server needs to return name of the bot
                    // { result: { message, name } }
            }
        }
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
    const term = $('body').terminal(function(command) {
        const { name } = $.terminal.parse_command(command);
        if (name === 'chat') {
            chat.command(this, make_chat());
        }
    }, {
        greetings: false
    });

    const dialogue = new Dialogue({
        adapter: new FirebaseAdapter(firebase_config),
        renderer: new Terminal(term),
        ready: () => {
            term.exec('/join general');
        }
    });
})();
