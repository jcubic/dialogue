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

export default random_joke;