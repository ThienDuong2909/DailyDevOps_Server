const { formatContentByGemini } = require('./src/modules/posts/posts.formatter');

async function run() {
    try {
        await formatContentByGemini("test");
    } catch(err) {
        console.log("CAUGHT EVENTUALLY:");
        console.log(err.constructor.name);
        console.log(err.message);
    }
}
run();
