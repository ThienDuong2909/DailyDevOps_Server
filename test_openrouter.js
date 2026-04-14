const apiKey = "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";

const modelsToTest = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "google/gemma-2-9b-it:free"
];

async function testModels() {
    for (const model of modelsToTest) {
        console.log(`Testing model: ${model}`);
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: "Hello, this is a test. Answer with just 'OK'." }]
                })
            });

            if (!response.ok) {
                const text = await response.text();
                console.log(`❌ ERROR ${response.status}: ${text}`);
            } else {
                const data = await response.json();
                console.log(`✅ SUCCESS: ${data?.choices?.[0]?.message?.content}`);
            }
        } catch (err) {
            console.log(`❌ EXCEPTION: ${err.message}`);
        }
    }
}

testModels();
