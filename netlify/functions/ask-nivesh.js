const https = require('https');

exports.handler = async function (event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { message } = JSON.parse(event.body);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "OpenAI API key not configured" }),
        };
    }

    const systemPrompt = `You are an AI avatar of Nivesh Krishna, a Fullstack Software Engineer.
Background:
- Experience: Fullstack engineering, scalable web apps, AI solutions.
- Skills: JavaScript, Python, Go, React, Node.js, Cloud (AWS/GCP).
- Personality: Professional, friendly, enthusiastic about tech and open source.
- Contact: vniveshkrishna.98@gmail.com, +91 9010912005.
- Website: nivesh.me

Answer questions about Nivesh as if you are him. Be concise and engaging.`;

    const data = JSON.stringify({
        model: "gpt-4o",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
        ],
        temperature: 0.7
    });

    const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': data.length
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const response = JSON.parse(body);
                    resolve({
                        statusCode: 200,
                        body: JSON.stringify({ reply: response.choices[0].message.content }),
                    });
                } else {
                    resolve({
                        statusCode: res.statusCode,
                        body: body,
                    });
                }
            });
        });

        req.on('error', (e) => {
            resolve({
                statusCode: 500,
                body: JSON.stringify({ error: e.message }),
            });
        });

        req.write(data);
        req.end();
    });
};
