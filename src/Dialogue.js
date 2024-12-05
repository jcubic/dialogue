import package_version from './version';
import BaseAdapter from './adapters/Base';
import BaseRenderer from './renderers/Base';

class Dialogue {
    static version = package_version;
    constructor({ adapter, renderer, ready, commands = () => {}, ...args }) {
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

        //adapter.set({ render: render_message });

        const rooms = [];

        const self = this;
        this._adapter = adapter;
        this._renderer = renderer;
        this._ready = ready;

        this._system = async function system(command, args) {
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
                    const [room] = args;
                    if (room) {
                        await renderer.join(room);
                        await adapter.join(room);
                        rooms.push(room);
                    }
                    break;
                case '/quit':
                    if (rooms.length) {
                        for (const room of rooms) {
                            await renderer.quit(room);
                            await adapter.quit(room);
                        }
                        rooms.length = 0;
                    }
                    break;
                case '/help':
                    renderer.echo('Yet to be implemented');
                    break;
                default:
                    commands(command, args);
            }
        };
    }
    async start(args = {}) {
        const system = this._system;
        const adapter = this._adapter;
        await this._renderer.init({ adapter, system, ...args });
    }
    notify(text) {
        const img = './assets/favicon.svg';
        return new Notification('Dialogue', { body: text, icon: img });
    }
}

export default Dialogue;
