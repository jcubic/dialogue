const firebase_config = {
    apiKey: 'AIzaSyA5zqBzylFJKfyahh0AStlss5mosqk75jw',
    authDomain: 'dialogue-bddd4.firebaseapp.com',
    projectId: 'dialogue-bddd4',
    storageBucket: 'dialogue-bddd4.appspot.com',
    messagingSenderId: '39616195119',
    appId: '1:39616195119:web:b872c371a915e3016574da'
};

async function random_joke() {
    const res = await fetch('https://v2.jokeapi.dev/joke/Programming');
    const data = await res.json();
    if (data.type == 'twopart') {
        return [
            `Q: ${data.setup}`,
            `A: ${data.delivery}`
        ].join('\n');
    } else  if (data.type === 'single') {
        return data.joke;
    }
}

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
