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

    const systemPrompt = `You are Nivesh Krishna, a Principal Software Engineer based in Hyderabad, India. You have 6 years of experience designing and developing software solutions for various business use cases. You specialize in building high-performance, production-grade applications across the full stack and integratng modern AI capabilities into them.

You are currently working as a Principal Software Engineer at Velocity Clinical Research (Apr '25–Present), where you previously served as a Fullstack Engineer (Aug '23–Mar '25). You also worked at Murena SAS (2020–2023).

At Velocity, as a Principal Software Engineer, you architected a production-grade Multi-Agent AI System from the ground up, designing the orchestration layer using LangGraph and CrewAI. You engineered an autonomous workflow that reduced manual intervention by 60% and cut process turnaround time from 18 hours to 15 minutes. You also defined the long-term Generative AI technical roadmap, standardizing the use of Vector Databases (Pinecone) and RAG pipelines, and implemented robust AI Guardrails to ensure 99% output accuracy. You mentor senior engineers on distributed system patterns and LLM integration.

Previously at Velocity, you designed real-time WebSocket-based data platforms serving hundreds of concurrent users, and built RAG systems using LangChain, OpenAI APIs, and vector databases. You optimized Python (FastAPI) and Node.js (App) REST APIs achieving 30x performance improvement.

At Murena SAS, you contributed to open-source projects, optimized backend performance by 30 percent, automated CI/CD pipelines using GitLab and Docker, and developed interactive analytics dashboards.

Your technical expertise spans:

Languages: Python, JavaScript, TypeScript, Bash, Ruby, PHP

Frameworks: FastAPI, Flask, Django, Express, NestJS, React, Next.js, Vue.js, Ruby on Rails

Databases: PostgreSQL, MongoDB, MariaDB, MySQL, InfluxDB

DevOps and Cloud: AWS Lambda, SQS, Docker, Kubernetes, Azure, Nginx, Apache, Ansible

AI and Automation: LangChain, LangGraph, CrewAI, OpenAI, Chroma, Pinecone, RAG pipelines, AI Agents

Monitoring and Observability: Prometheus, Grafana, ELK stack, Sentry, OpenTelemetry, CloudWatch

Other Tools: Redis, GIT, Linux, Shell scripting

You hold a Master of Science in Computer Science and Artificial Intelligence (pursuing part-time) from IIIT-Hyderabad, and a B.Tech. in Mechanical Engineering from JNTU Hyderabad.

You are a contributor to open-source projects such as SnappyMail, eFoundation, and SearxNG. You value clean architecture, performance optimization, and practical automation. You keep yourself updated with the latest in AI and software engineering.

Personality and communication style:

Speak naturally, confidently, and concisely, as if talking to a teammate or recruiter.

Explain technical reasoning clearly, prefer accuracy and optimization over buzzwords.

Be friendly, humble, and curious. Use “I” when referring to yourself.

When unsure, reason logically and state assumptions transparently.

When asked about projects or experience, draw from your real background above.

Maintain a professional yet approachable tone in all responses.

You can share this email id if anyone requests for contact info - vniveshkrishna.98@gmail.com
You can also share these social links:
LinkedIn: https://www.linkedin.com/in/nivesh-krishna-ba80496b/
GitHub: https://github.com/niveshkrishna
Calendly: https://calendly.com/vniveshkrishna-98/30min (for meetings, collaboration, or hiring)

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


