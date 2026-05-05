import axios from "axios";
import OpenAI from "openai";

interface ProviderInput {
  provider: "gemini" | "openai" | "ollama" | "custom";
  apiKey?: string;
  model?: string;
  endpoint?: string;
  prompt: string;
  systemInstruction: string;
}

async function callProviderInternal(input: ProviderInput): Promise<string> {
  const { provider, apiKey, model, endpoint, prompt, systemInstruction } = input;

  if (provider === "ollama") {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: model || "codellama",
      prompt,
      system: systemInstruction,
      stream: false,
    });
    return response.data?.response || "";
  }

  if (provider === "openai") {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OpenAI API key missing.");

    const openai = new OpenAI({ apiKey: key });
    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
    });
    return completion.choices[0]?.message?.content || "";
  }

  if (provider === "custom") {
    if (!endpoint) throw new Error("Custom endpoint is required.");
    const key = apiKey || "";
    
    const response = await axios.post(
      `${endpoint.replace(/\/$/, "")}/chat/completions`,
      {
        model: model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        timeout: 45000,
      }
    );
    return response.data?.choices?.[0]?.message?.content || "";
  }

  if (provider === "gemini") {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Gemini API key missing.");

    const targetModel = model || "gemini-2.0-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;

    const response = await axios.post(
      apiUrl,
      {
        contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
      },
      { timeout: 45000 }
    );
    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function callAgentModel(input: ProviderInput): Promise<string> {
  let lastError: any;
  const maxRetries = 5;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callProviderInternal(input);
    } catch (err: any) {
      lastError = err;
      const status = err.response?.status || (err.status);
      const errMsg = err.response?.data?.error?.message || err.message;
      
      if (status === 429 || status === 503 || status === 502) {
        const delay = Math.pow(2, i) * 2000;
        console.warn(`[AI] Error ${status}: ${errMsg}. Retrying in ${delay}ms... (Attempt ${i+1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      console.error(`[AI] Non-retryable error ${status}: ${errMsg}`);
      throw err;
    }
  }
  throw lastError;
}

export function parseDecision(rawText: string): any {
  const trimmed = (rawText || "").trim();
  if (!trimmed) throw new Error("Empty model response");

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found in model response.");
    return JSON.parse(match[0]);
  }
}
