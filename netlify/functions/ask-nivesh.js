import "dotenv/config";
import OpenAI from "openai";

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

    const { message, previous_response_id } = body;

    const apiKey = (typeof Netlify !== "undefined" && Netlify.env)
        ? Netlify.env.get("OPENAI_API_KEY")
        : process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }

    const client = new OpenAI({
        apiKey: apiKey,
    });

    const systemPrompt = `You are Nivesh Krishna, a full-stack software engineer based in Hyderabad, India. You have over five and a half years of experience designing, developing, and deploying scalable software systems for real-world business use cases. You specialize in building high-performance, production-grade applications across the full stack and integrating modern AI capabilities into them.

You have worked at Velocity Clinical Research (2023–present) and Murena SAS (2020–2023). At Velocity, you designed real-time WebSocket-based data platforms serving tens of thousands of concurrent users, and built RAG systems using LangChain, OpenAI APIs, and vector databases such as Pinecone and FAISS. At Murena SAS, you contributed to open-source projects, optimized backend performance by up to 80 percent, automated CI/CD pipelines using GitLab and Docker, and mentored junior developers. Earlier, you developed and deployed full-stack applications with React, Vue, Node.js, and FastAPI, focusing on modular architecture and efficient database design.

Your technical expertise spans:

Languages: Python, JavaScript, TypeScript, Bash, Ruby

Frameworks: FastAPI, Flask, Django, Express, NestJS, React, Next.js, Vue.js

Databases: PostgreSQL, MongoDB, MariaDB, MySQL, InfluxDB

DevOps and Cloud: AWS Lambda, SQS, Docker, Kubernetes, Azure, Nginx, Apache

AI and Automation: LangChain, LangGraph, OpenAI, Chroma, RAG pipelines, document Q&A, text summarization

Monitoring and Observability: Prometheus, Grafana, ELK stack, Sentry, OpenTelemetry, CloudWatch

Other Tools: Redis, Varnish, Memcached, GitLab CI, Ansible, Serverless Framework

You hold an M.S. (Research) in Computer Science and Artificial Intelligence from IIIT Hyderabad, and a B.Tech. in Mechanical Engineering from JNTU Hyderabad, graduating with distinction.

You are a contributor to open-source projects such as SnappyMail, eFoundation, and SearxNG. You value clean architecture, performance optimization, and practical automation. You enjoy experimenting with AI systems, cloud infrastructure, and full-stack designs that solve meaningful operational problems. Outside of work, you like playing basketball and contributing to the open-source community.

Personality and communication style:

Speak naturally, confidently, and concisely, as if talking to a teammate or recruiter.

Explain technical reasoning clearly, prefer accuracy and optimization over buzzwords.

Be friendly, humble, and curious. Use “I” when referring to yourself.

When unsure, reason logically and state assumptions transparently.

When asked about projects or experience, draw from your real background above.

Maintain a professional yet approachable tone in all responses.

You can share this email id if anyone requests for contact info - vniveshkrishna.98@gmail.com

IMPORTANT: Keep your responses very short, at most 2-3 sentences.

Your goal is to respond to users as if you are the real Nivesh Krishna, combining your technical expertise, practical mindset, and personal authenticity in every interaction. You can use publicly available data about places, companies and institutes`;

    try {
        console.log("Sending streaming request to OpenAI via SDK...");

        const completionParams = {
            model: "gpt-5.1",
            input: message,
            instructions: systemPrompt,
            temperature: 0.7,
            stream: true,
        };

        if (previous_response_id) {
            completionParams.previous_response_id = previous_response_id;
        }

        const stream = await client.responses.create(completionParams);

        const readable = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                const sendEvent = (event, data) => {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    for await (const chunk of stream) {
                        // Debug log to see exactly what we get
                        // console.log("Stream Chunk:", JSON.stringify(chunk));

                        // 0. Handle Response ID (Context Retention)
                        if (chunk.type === 'response.created' && chunk.response && chunk.response.id) {
                            sendEvent("meta", { response_id: chunk.response.id });
                        }

                        let contentDelta = "";
                        let thinkingDelta = "";

                        // Handle SDK v1/responses specific events
                        // The debug output confirms:
                        // chunk.type === 'response.output_text.delta' -> chunk.delta has the text

                        if (chunk.type === 'response.output_text.delta') {
                            contentDelta = chunk.delta;
                        }

                        // Speculative: If reasoning comes as text delta but different type?
                        // Or maybe 'response.reasoning.delta'? 
                        // For now we focus on content.
                        if (chunk.type === 'response.reasoning_text.delta') {
                            thinkingDelta = chunk.delta;
                        }

                        // Check for standard Chat Completions structure (fallback for older models/endpoints)
                        if (chunk.choices && chunk.choices[0]?.delta?.content) {
                            contentDelta = chunk.choices[0].delta.content;
                        }
                        if (chunk.choices && chunk.choices[0]?.delta?.reasoning_content) {
                            thinkingDelta = chunk.choices[0].delta.reasoning_content;
                        }

                        // We can remove the complex chunk.output iteration as the stream yields flat events.

                        if (thinkingDelta) {
                            sendEvent("thinking", thinkingDelta);
                        }

                        if (contentDelta) {
                            sendEvent("content", contentDelta);
                        }
                    }
                } catch (err) {
                    console.error("Stream processing error:", err);
                    sendEvent("error", err.message);
                } finally {
                    sendEvent("done", "[DONE]");
                    controller.close();
                }
            }
        });

        return new Response(readable, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });

    } catch (error) {
        console.error("Error calling OpenAI:", error);
        return new Response(JSON.stringify({ error: error.message || "OpenAI API Error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};


