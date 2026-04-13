import OpenAI from 'openai';

let client: OpenAI;

export function initEigenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LOCUS_LLM_KEY || 'dummy';
  if (apiKey === 'dummy') {
    console.warn('[LLM] No API key configured — credit scoring will use algorithmic fallback.');
  }
  client = new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  });
  return client;
}

export function getEigenAI(): OpenAI {
  if (!client) throw new Error('LLM not initialized — call initEigenAI() first');
  return client;
}

export interface DeterministicInferenceResult {
  content: string;
  requestId: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number };
}

export async function deterministicInference(
  systemPrompt: string,
  userPrompt: string,
  options: { model?: string; temperature?: number; seed?: number; maxTokens?: number } = {}
): Promise<DeterministicInferenceResult> {
  const ai = getEigenAI();

  const response = await ai.chat.completions.create({
    model: options.model || process.env.LLM_MODEL || 'gpt-4o-mini',
    temperature: options.temperature ?? 0,
    seed: options.seed ?? 42,
    max_tokens: options.maxTokens ?? 2048,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const choice = response.choices[0];

  return {
    content: choice.message.content || '{}',
    requestId: response.id,
    model: response.model,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}
