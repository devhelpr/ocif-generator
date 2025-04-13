import { callLLMAPI, getCurrentAPIConfig } from './llm-api';

// Define APIConfig interface since it's not exported from llm-api
export interface APIConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}

// Define Evaluation Result type directly instead of using Zod schema
export interface EvaluationResult {
  matchesPrompt: boolean;
  matchesSystemPrompt: boolean;
  missingElements: string[];
  suggestedHints: string[];
  score: number;
  reasoning: string;
}

/**
 * Creates an appropriate response format schema based on the API provider
 * @param apiConfig The API configuration
 * @returns A schema object that works with the specific API provider
 */
function createResponseSchema(apiConfig: APIConfig): Record<string, unknown> {
  switch (apiConfig.name) {
    case 'OpenAI':
      return { type: "json_object" };
    case 'Anthropic':
    case 'Mistral':
    case 'Gemini':
    default:
      // For other providers, return a more detailed schema
      return {
        type: "object",
        properties: {
          matchesPrompt: { type: "boolean" },
          matchesSystemPrompt: { type: "boolean" },
          missingElements: { 
            type: "array", 
            items: { type: "string" } 
          },
          suggestedHints: { 
            type: "array", 
            items: { type: "string" } 
          },
          score: { 
            type: "number",
            minimum: 0,
            maximum: 10
          },
          reasoning: { type: "string" }
        },
        required: ["matchesPrompt", "matchesSystemPrompt", "missingElements", "suggestedHints", "score", "reasoning"]
      };
  }
}

/**
 * Evaluates LLM output against the original prompt and system prompt
 * @param originalPrompt The user's original prompt
 * @param systemPrompt The system prompt used 
 * @param llmOutput The output generated by the LLM
 * @param apiConfig The API configuration to use
 * @returns Evaluation result with detailed analysis
 */
export async function evaluatePromptOutput(
  originalPrompt: string,
  systemPrompt: string,
  llmOutput: string,
  apiConfig: APIConfig
): Promise<EvaluationResult> {
  // Build evaluation prompt
  const evaluationPrompt = `
I need you to evaluate the quality and adherence of an LLM-generated output 
against both the original user prompt and the system prompt.

Here is the original user prompt:
"""
${originalPrompt}
"""

Here is the system prompt that was used:
"""
${systemPrompt}
"""

Here is the LLM-generated output:
"""
${llmOutput}
"""

Evaluate how well the output matches both the user's prompt requirements and 
the system prompt instructions. Identify any missing elements and provide 
specific hints for improvement.
`;

  try {
    const evaluationSystemPrompt = `
You are an expert evaluator of LLM outputs. Your task is to objectively assess 
how well an LLM-generated output matches both the user's original prompt and 
the system prompt instructions.

Return your evaluation as a JSON object with the following structure:
{
  "matchesPrompt": boolean, // Whether the output matches the user's prompt requirements
  "matchesSystemPrompt": boolean, // Whether the output matches the system prompt requirements
  "missingElements": string[], // List of elements missing from the output that were required
  "suggestedHints": string[], // Specific hints to improve the output in the next iteration
  "score": number, // Overall score of the output (0-10)
  "reasoning": string // Reasoning behind your evaluation
}

Your evaluation should be fair, detailed, and constructive. Focus on concrete issues
rather than stylistic preferences.`;

    // Get the appropriate response schema for this API provider
    const responseSchema = createResponseSchema(apiConfig);

    // Call the LLM API for evaluation with the appropriate response format
    const evaluationResponse = await callLLMAPI(
      evaluationPrompt,
      evaluationSystemPrompt,
      apiConfig,
      responseSchema
    );

    // Parse the response
    const evaluation = JSON.parse(evaluationResponse) as EvaluationResult;
    return evaluation;
    
  } catch (error) {
    console.error('Error evaluating prompt output:', error);
    // Return a default failed evaluation
    return {
      matchesPrompt: false,
      matchesSystemPrompt: false,
      missingElements: ['Error evaluating output'],
      suggestedHints: ['Try again with a more specific prompt'],
      score: 0,
      reasoning: `Error during evaluation: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Reruns a prompt with added hints if the original output was insufficient
 * @param originalPrompt The original user prompt
 * @param systemPrompt The system prompt
 * @param evaluation The evaluation result from the first run
 * @param apiConfig The API configuration to use
 * @returns Improved LLM output
 */
export async function rerunPromptWithHints(
  originalPrompt: string,
  systemPrompt: string,
  evaluation: EvaluationResult,
  apiConfig: APIConfig
): Promise<string> {
  // Only rerun if the score is below 7
  if (evaluation.score >= 7) {
    return ''; // Don't rerun if the score is good enough
  }

  // Build an enhanced prompt with hints
  const hintsSection = evaluation.suggestedHints.length > 0
    ? `\n\nThe previous attempt had these issues that need addressing:\n${evaluation.suggestedHints.map(hint => `- ${hint}`).join('\n')}`
    : '';
  
  const missingElementsSection = evaluation.missingElements.length > 0
    ? `\n\nMake sure to include these missing elements:\n${evaluation.missingElements.map(element => `- ${element}`).join('\n')}`
    : '';

  const enhancedPrompt = `${originalPrompt}${hintsSection}${missingElementsSection}`;

  try {
    // Call the LLM API with the enhanced prompt
    return await callLLMAPI(enhancedPrompt, systemPrompt, apiConfig);
  } catch (error) {
    console.error('Error rerunning prompt with hints:', error);
    throw error;
  }
}

/**
 * Evaluates the output and reruns the prompt with hints if needed
 * @param originalPrompt The original user prompt
 * @param systemPrompt The system prompt
 * @param llmOutput The initial LLM output
 * @param apiConfig The API configuration
 * @returns Object containing the evaluation, the improved output (if any), and whether it was rerun
 */
export async function evaluateAndRerunIfNeeded(
  originalPrompt: string,
  systemPrompt: string,
  llmOutput: string,
  apiConfig?: APIConfig
): Promise<{
  evaluation: EvaluationResult;
  improvedOutput: string;
  wasRerun: boolean;
}> {
  // Use provided apiConfig or get the current one
  const config = apiConfig || getCurrentAPIConfig();
  
  // First, evaluate the output
  const evaluation = await evaluatePromptOutput(
    originalPrompt,
    systemPrompt,
    llmOutput,
    config
  );
  
  // If the score is too low, rerun with hints
  if (evaluation.score < 7) {
    const improvedOutput = await rerunPromptWithHints(
      originalPrompt,
      systemPrompt,
      evaluation,
      config
    );
    
    return {
      evaluation,
      improvedOutput,
      wasRerun: true
    };
  }
  
  // Otherwise, return the original output
  return {
    evaluation,
    improvedOutput: '',
    wasRerun: false
  };
} 