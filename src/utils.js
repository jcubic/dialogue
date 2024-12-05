export function trim(str) {
    return str.replace(/[\s\n]+$/, '').replace(/^\s+\n/, '');
}

export function all_include(items, list) {
    return items.every(item => list.includes(item));
}

export function is_function(object) {
    return typeof object === 'function';
}

export function utc_now() {
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

export function format_time(date) {
    return date.toLocaleString().replace(/.*,\s*/, '');
}

export function is_promise(object) {
    return object && typeof object.then === 'function';
}

export function unpromise(value, callback) {
    if (is_promise(value)) {
        return value.then(callback);
    }
    return callback(value);
}

export function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

// create random string of 10 digits in javascript
// https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
export function random_string(count = 10) {
    return Math.random().toString(36).substr(2, 2 + count);
}

export function in_focus() {
    return document.visibilityState === 'visible';
}

export function is_system_command(command) {
    return command.match(/^\s*\/[^\s]+/);
}
