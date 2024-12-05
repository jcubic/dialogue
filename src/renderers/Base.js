class BaseRenderer {
    constructor(adapter) { }
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

export default BaseRenderer;
