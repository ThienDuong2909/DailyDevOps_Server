const apiKey = "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";

async function testFree() {
    console.log("Testing openrouter/free");
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openrouter/free",
                messages: [{ role: "user", content: "Repeat this word exactly: ANTIGRAVITY. Then write a 50 word poem." }]
            })
        });

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(err) {
        console.error(err);
    }
}
testFree();
