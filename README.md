# Dialogue

[Chat JavaScript Open Source library](https://jcubic.github.io/dialogue/)

## Usage

### Terminal and Firebase

```javascript
import { Dialogue, FirebaseAdapter, Terminal } from "https://esm.sh/dialogue";

const term = $('body').terminal($.noop, {
    exceptionHandler(e) {
        this.error(`Error: ${e.message}`);
    },
    greetings: false
});

const firebase_config = {
    /* your firebase config */
};

const adapter = new FirebaseAdapter(firebase_config);
const renderer = new Terminal(term);

// example of using Joke API with Programming jokes
async function random_joke() {
    const res = await fetch('https://v2.jokeapi.dev/joke/Programming');
    const data = await res.json();
    if (data.type == 'twopart') {
        return [
            `Q: ${data.setup}`
            `A: ${data.delivery}`
        ].join('\n');
    } else  if (data.type === 'single') {
        return data.joke;
    }
}

const dialogue = new Dialogue({
    adapter,
    renderer,
    commands(command, args) {
        // custom system command
        if (command === '/joke') {
            const joke = await random_joke();
            if (joke) {
                adapter.send(adapter.get_user(), adapter.utc_now(), joke);
            } else {
                renderer.echo('<red>Failed to get joke</red>');
            }
        }
    },
    ready: () => {
        term.exec('/join general');
    }
});
```

## Firebase rules

To protect the data in your firebase real time database you can use thes rules:

```
{
  "rules": {
    "messages": {
      ".read": true,
      ".write": "auth != null",
      "$messageId": {
        ".write": "auth != null && auth.uid === data.child('userId').val()"
      }
    },
    "users": {
      ".read": true,
      ".write": "auth != null",
"$userId": {
        ".write": "auth != null && auth.uid === $userId"
      }
    },
    ".write": false,
    ".read": false
  }
}
```

## Todo
- [ ] Notifications
- [ ] Sound Notifications
- [ ] Online users per room
- [ ] UI
  - [ ] React
  - [ ] Terminal
    - [ ] chat command
- [ ] Adapters
  - [ ] Server-Sent Events
  - [ ] Web Sockets
- [ ] Add a way to obtain a commerial License

## License
Copyright (c) 2024 [Jakub T. Jankiewicz](https://jakub.jankiewicz.org/)<br/>
Released under [AGPL v3 license](https://github.com/jcubic/dialogue/blob/master/LICENSE)
