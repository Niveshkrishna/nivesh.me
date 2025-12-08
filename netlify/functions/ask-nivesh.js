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
    // Access environment variables via Netlify global or standard process.env
    const apiKey = (typeof Netlify !== "undefined" && Netlify.env)
        ? Netlify.env.get("OPENAI_API_KEY")
        : process.env.OPENAI_API_KEY;

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

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return new Response(JSON.stringify({ error: data.error?.message || "OpenAI API Error" }), {
                status: response.status,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify({ reply: data.choices[0].message.content }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};


