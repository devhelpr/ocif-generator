import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z, ZodTypeAny } from 'zod';
import { OCIFSchemaDefinition } from '../schemas/schema';

interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
}

interface APIConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}

interface GenerateStructuredOutputParams<T extends ZodTypeAny> {
  schema: T;
  request: string;
  temperature?: number;
}

export function getCurrentAPIConfig(): APIConfig {
  const savedSettings = localStorage.getItem('llmSettings');
  if (savedSettings) {
    const { apis, selectedAPI } = JSON.parse(savedSettings);
    const selectedConfig = apis.find((api: APIConfig) => api.name === selectedAPI);
    if (selectedConfig) {
      return selectedConfig;
    }
  }
  
  // Fallback to default OpenAI config
  return {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  };
}

export async function generateStructuredOutput<T extends ZodTypeAny>({
  schema,
  request,
  temperature = 1.5
}: GenerateStructuredOutputParams<T>, apiKey = ""): Promise<z.infer<T>> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    apiKey: apiKey,
    temperature,
  });
  const schemaObj = schema as unknown as Record<string, unknown>;
  removeAdditionalProperties(schemaObj);
  const structuredLlm = model.withStructuredOutput(schema, {
    strict: false
  });
  return await structuredLlm.invoke(request);
}

function removeAdditionalProperties(schema: Record<string, unknown>): void {
  if (schema && typeof schema === 'object') {
    delete schema.additionalProperties;
    Object.values(schema).forEach(value => {
      if (typeof value === 'object' && value !== null) {
        removeAdditionalProperties(value as Record<string, unknown>);
      }
    });
  }
}

export async function callLLMAPI(
  prompt: string,
  systemMessage: string,
  apiConfig: APIConfig,
  jsonSchema?: Record<string, unknown>
): Promise<string> {
  if (!apiConfig.apiKey) {
    throw new Error(`${apiConfig.name} API key is not set. Please configure it in the settings.`);
  }

  if (apiConfig.name === 'Gemini') {
    const responseSchema = await generateStructuredOutput({
      schema: OCIFSchemaDefinition,
      request: prompt
    }, apiConfig.apiKey);
    
    try {
      const parsedJson = responseSchema;
      if (!parsedJson.ocif || parsedJson.ocif !== "https://canvasprotocol.org/ocif/0.4") {
        parsedJson.ocif = "https://canvasprotocol.org/ocif/0.4";
        return JSON.stringify(parsedJson, null, 2);
      }
      return "{}";
    } catch {
      throw new Error('The response from Gemini is not valid JSON');
    }
  } else {
    const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.name === 'OpenAI' ? 'gpt-4o' : 
               apiConfig.name === 'Anthropic' ? 'claude-3-7-sonnet-20250219' :
               apiConfig.name === 'Mistral' ? 'mistral-large' : 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        response_format: jsonSchema
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`${apiConfig.name} API error: ${errorData.error?.message || response.statusText}`);
    }

    const data: LLMResponse = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content returned from API');
    }

    try {
      const parsedJson = JSON.parse(content);
      if (!parsedJson.ocif || parsedJson.ocif !== "https://canvasprotocol.org/ocif/0.4") {
        parsedJson.ocif = "https://canvasprotocol.org/ocif/0.4";
        return JSON.stringify(parsedJson, null, 2);
      }
      return content;
    } catch {
      throw new Error('The response is not valid JSON');
    }
  }
} 