import BaseAdapter from './Base';

//import { initializeApp } from "firebase/app";
//import { getDatabase } from "firebase/database";

class FirebaseAdapter extends BaseAdapter {
    constructor(firebase_config) {
        super();
        const app = firebase.initializeApp(firebase_config);
        this._database = firebase.database();
        // TODO: make room higher level
        //       dialogue/<room>/messages
        //       dialogue/<room>/users
        this._messages = this._database.ref('dialogue/messages');
        this._users = this._database.ref('dialogue/users');
        this._auth = firebase.auth();
        this._rooms = {};
        this._current_room = null;
        this._logout = this._auth.onAuthStateChanged(user => {
            if (user) {
                this._login(user);
                let username = user.displayName;
                const ref = this._database.ref(`/dialogue/users/${user.uid}`);
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
    rooms() {
        return this._messages.once('value').then((snapshot) => {
            const keys = [];
            snapshot.forEach(function(child) {
                keys.push(child.key);
            });
            return keys;
        });
    }
    quit(room = null) {
        if (room === null) {
            for (const ref of Object.values(this._rooms)) {
                ref.off();
            }
            this._rooms = {};
        } else if (room in this._rooms) {
            this._rooms[room].off();
            delete this._rooms[room];
        }
    }
    join(room) {
        this._rooms[room] = this._messages.child(room);
        this._current_room = this._rooms[room];
        this._rooms[room].limitToLast(100).on('child_added', (snapshot) => {
            const { message, username, datetime, rnd } = snapshot.val();
            this.emit('message', {
                username,
                datetime,
                message,
                rnd
            });
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
}

export default FirebaseAdapter;
