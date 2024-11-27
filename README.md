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

const dialogue = new Dialogue({
    adapter: new FirebaseAdapter(firebase_config),
    renderer: new Terminal(term),
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
