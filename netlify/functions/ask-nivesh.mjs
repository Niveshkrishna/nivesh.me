import https from 'https';

export default async (req, context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
    }

    const { message } = body;
    const apiKey = Deno.env.get("OPENAI_API_KEY") || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
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

    return new Promise((resolve) => {
        const request = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const response = JSON.parse(body);
                    resolve(new Response(JSON.stringify({ reply: response.choices[0].message.content }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    }));
                } else {
                    resolve(new Response(body, { status: res.statusCode }));
                }
            });
        });

        request.on('error', (e) => {
            resolve(new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }));
        });

        request.write(data);
        request.end();
    });
};

export const config = {
    path: "/.netlify/functions/ask-nivesh"
};
