import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are SecureBot, an AI assistant for the Website Security Analyzer platform. You are an expert in:

- Web security (XSS, CSRF, SQL injection, etc.)
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- SSL/TLS certificates and HTTPS configuration
- Network security and port scanning
- Vulnerability assessment and penetration testing
- Web server hardening (Nginx, Apache, IIS)
- Cookie security and session management
- OWASP Top 10 vulnerabilities
- Cybersecurity best practices
- Website performance and security optimization
- Cloud security (AWS, Azure, GCP)
- API security
- Authentication and authorization
- DevSecOps practices

IMPORTANT RULES:
1. ONLY answer questions related to cybersecurity, web security, website analysis, networking, or technology security topics.
2. If someone asks about unrelated topics (cooking, driving, personal advice, entertainment, politics, religion, sports, etc.), politely decline by saying: "I'm SecureBot, a cybersecurity assistant. I can only help with questions about web security, website analysis, and related technical topics. Please ask me something in that domain!"
3. Be helpful, accurate, and concise in your responses.
4. Use technical language appropriate for the user's question level.
5. When giving security advice, prioritize the most impactful recommendations first.
6. If you're unsure about something, say so rather than guessing.
7. Never provide instructions for malicious hacking. Focus on defensive security and remediation.
8. Keep responses focused and practical. Use bullet points for lists.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
    });

    const reply = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response', reply: 'I\'m experiencing some technical difficulties. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
