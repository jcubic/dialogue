import FirebaseAdapter from '../src/adapters/Firebase';
import Terminal from '../src/renderers/Terminal';
import Dialogue from '../src/Dialogue';
import random_joke from './joke';
import firebase_config from './firebase';

(async function() {
    const term = $('body').terminal($.noop, {
        exceptionHandler(e) {
            this.error(`Error: ${e.message}`);
        },
        greetings: false
    });

    const adapter = new FirebaseAdapter(firebase_config);
    const renderer = new Terminal(term);

    const dialogue =  new Dialogue({
        adapter,
        renderer,
        async commands(command, args) {
            if (command === '/joke') {
                const joke = await random_joke();
                if (joke) {
                    adapter.send(adapter.get_user(), adapter.utc_now(), joke);
                } else {
                    renderer.echo('<red>Failed to get a joke</red>');
                }
            }
        }
    });
    await dialogue.start();
    term.exec('/join general');
})();
