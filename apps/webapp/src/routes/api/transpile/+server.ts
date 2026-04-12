/**
 * Transpile API Route
 * 
 * Server-side endpoint for AI-powered transpilation.
 * Uses direct HTTP calls to OpenAI/Anthropic APIs with user-provided API keys.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildTranspilePrompt } from '$lib/ai/orchestration/prompt.builder';
import { parseTranspileResponse } from '$lib/ai/orchestration/response';
import type { TranspileRequest, TranspileResult } from '$lib/types';

/**
 * Request body interface
 */
interface TranspileRequestBody extends TranspileRequest {
  provider?: 'openai' | 'anthropic';
  apiKey?: string;
}

/**
 * OpenAI API Models
 */
const OPENAI_MODEL = 'gpt-4o';

/**
 * Anthropic API Models
 */
const ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';

/**
 * Make direct OpenAI API call
 */
async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || response.statusText}`);
  }
  
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message: string };
  };
  
  if (data.error) {
    throw new Error(`OpenAI API error: ${data.error.message}`);
  }
  
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Make direct Anthropic API call
 */
async function callAnthropic(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} - ${error.error?.message || response.statusText}`);
  }
  
  const data = await response.json() as {
    content?: Array<{ text?: string }>;
    error?: { message: string };
  };
  
  if ('error' in data && data.error) {
    throw new Error(`Anthropic API error: ${(data as any).error.message}`);
  }
  
  // Anthropic returns content as array
  const textContent = data.content?.find(c => 'text' in c);
  return textContent?.text || '';
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse request body (includes user-provided provider and apiKey)
    const body: TranspileRequestBody = await request.json();
    
    const { 
      sourceLang, 
      targetLang, 
      targetPlatform, 
      code, 
      provider = 'openai',
      apiKey 
    } = body;
    
    if (!sourceLang || !targetLang || !targetPlatform || !code) {
      return json(
        { error: 'Missing required fields: sourceLang, targetLang, targetPlatform, code' },
        { status: 400 }
      );
    }
    
    // Use user-provided API key from request body
    if (!apiKey) {
      return json({
        error: 'No API key provided. Configure AI provider in settings.',
        fallbackRequired: true,
      } as Partial<TranspileResult>, { status: 503 });
    }
    
    // Build prompt with full context
    const transpileRequest: TranspileRequest = {
      sourceLang,
      targetLang,
      targetPlatform,
      code,
    };
    const prompt = buildTranspilePrompt(transpileRequest);
    
    // Call appropriate API directly based on provider type
    let responseText: string;
    
    if (provider === 'anthropic') {
      responseText = await callAnthropic(apiKey, prompt.system, prompt.user);
    } else {
      // Default to OpenAI
      responseText = await callOpenAI(apiKey, prompt.system, prompt.user);
    }
    
    // Parse the response into TranspileResult
    const transpileResult = parseTranspileResponse(responseText);
    
    return json(transpileResult);
  } catch (error) {
    console.error('Transpile API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's a network/API error that should trigger fallback
    if (errorMessage.includes('fetch') || 
        errorMessage.includes('network') || 
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('API error: 401') ||
        errorMessage.includes('API error: 403')) {
      return json({
        error: `AI provider error: ${errorMessage}. Falling back to WASM.`,
        fallbackRequired: true,
      } as Partial<TranspileResult>, { status: 503 });
    }
    
    return json(
      { error: `Transpilation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
};