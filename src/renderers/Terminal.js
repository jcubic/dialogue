import {
    trim,
    is_function,
    utc_now,
    format_time,
    is_system_command,
    all_include
} from '../utils';

import BaseRenderer from './Base';
import version from '../version';

if (!$.terminal.figlet) {
    const $ = globalThis.$;
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

    $.terminal.figlet.load = (function() {
        const installed = [];
        return function(fonts, fontPath = fontpath) {
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
            });
        };
    })();
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

class Terminal extends BaseRenderer {
    constructor(terminal, options = {}) {
        super();
        this._options = options;
        this._term = terminal;
    }
    async init({ adapter, system: system_command, greetings, prompt: user_prompt } = {}) {
        this._adapter = adapter;
        this._term.pause();
        const term = this._term;

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

        async function get_rooms() {
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

        let first_greeting = true;
        function render_greetings() {
            // Hack to wait for the async echo function to finish, it fixes duplicated async echo
            // see https://github.com/jcubic/jquery.terminal/issues/987
            return new Promise(resolve => {
                term.echo($.terminal.figlet(font, 'dialogue', { color }), {
                    ansi: true
                });
                term.echo(`[[b;#4889F1;]Web-Terminal Chat v.${version}]\n`);
                term.echo(async () => {
                    const ret = `Available rooms: ${await get_rooms()}`;
                    if (first_greeting) {
                        first_greeting = false;
                        setTimeout(resolve, 0);
                    }
                    return ret;
                });
            });
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

        function intepreter(command) {
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
            } else if (command) {
                send_message(command);
            }
        }
        if (this._options.command) {
            // view with previous state of the terminal
            const view = this._term.export_view();
            term.push(intepreter, {
                name: 'dialogue',
                prompt,
                onExit: () => {
                    this.quit();
                    term.import_view(view);
                }
            });
            term.clear();
        } else {
            term.set_interpreter(intepreter);
            term.set_prompt(prompt);
        }
        await this._greetings();
        this._message_handler = (message) => {
            this.render(message);
        };
        this._adapter.on('message', this._message_handler);
        term.resume();
        // view after Dialogue is initialized
        this._view = term.export_view();
        term.off('click', '.room').on('click', '.room', function () {
            const room = $(this).text();
            term.exec(`/join ${room}`);
        });
    }
    leave(room) {
        this._adapter.quit(room);
    }
    async join(room) {
        if (this._current_room) {
            this.leave(this._current_room);
            this._term.import_view(this._view);
        }
        this._current_room = room;
        this.log(`Welcome to ${room} room`);
        const users = await this._users();
        if (users) {
            this.log(`Users online: ${users}`);
        }
    }
    echo(message) {
        this._term.echo(message);
    }
    quit() {
        this._adapter.off('nick');
        this._adapter.off('auth');
        this._adapter.quit();
        this._adapter.off('message', this._message_handler);
    }
    render({ username, datetime, message }) {
        const get_prefix = () => {
            let result = [];
            if (this._options.show_date) {
                const time = format_time(new Date(datetime));
                result.push(`[${time}]`);
            }
            result.push(`<${color(username)}> `);
            return result.join('');
        };
        function format(message) {
            const prefix = get_prefix();
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
        const time = format_time(new Date());
        const prefix = $.terminal.escape_brackets(`[${time}]`);
        this.echo(`[[i;#A528B9;]${prefix} ${message}]`);
    }
}

export default Terminal;
