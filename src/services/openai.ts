import { OCIFSchema } from '../types/schema';

// Define the response type for the OpenAI API
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
}

/**
 * Sends a prompt to OpenAI's GPT-4o API to generate an OCIF JSON file
 * @param prompt The user's prompt describing the OCIF file to generate
 * @param schema The OCIF schema to validate against
 * @returns The generated OCIF JSON as a string
 */
export async function generateOCIFFromPrompt(
  prompt: string,
  schema: OCIFSchema
): Promise<string> {
  // Get the API key from environment variables
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is not set. Please set VITE_OPENAI_API_KEY in your environment variables.');
  }

  // Create a system message that instructs the model to generate valid OCIF JSON
  const systemMessage = `You are an expert in generating Open Component Interconnect Format (OCIF) JSON files.
Your task is to generate a valid OCIF JSON file based on the user's prompt.
The JSON must strictly follow this schema:
${JSON.stringify(schema, null, 2)}

Important rules:
1. The output must be valid JSON that conforms to the schema.
2. Include all required fields from the schema.
3. Generate realistic and useful data based on the user's prompt.
4. Do not include any explanations or markdown formatting in your response, only the JSON.
5. Ensure all IDs are unique and properly referenced.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2, // Lower temperature for more deterministic output
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data: OpenAIResponse = await response.json();
    
    // Extract the content from the response
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content returned from OpenAI API');
    }

    // Try to parse the content as JSON to ensure it's valid
    try {
      JSON.parse(content);
      return content;
    } catch (e) {
      throw new Error('The response from OpenAI is not valid JSON');
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
} 