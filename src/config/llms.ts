import { APIConfig } from "../interfaces/api-config";

export const llmAPIs: APIConfig[] = [
  {
    name: "OpenAI-system",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1",
    description: "OpenAI's gpt-4.1 model via ocif-generator",
    isChatCompletionCompatible: true,
    systemKey: "openai",
  },
  {
    name: "Gemini-2.5-experimental-system",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=",
    apiKey: "",
    model: "gemini-2.0-flash",
    description: "Google's gemini-2.0-flash model via ocif-generator",
    isChatCompletionCompatible: false,
    systemKey: "gemini",
  },
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1",
    description: "OpenAI's gpt-4.1 model (provide your own API key)",
    isChatCompletionCompatible: true,
  },
  {
    name: "Anthropic-v4",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    model: "claude-sonnet-4-20250514",
    description:
      "Anthropic's claude-sonnet-4-20250514 model (provide your own API key)",
    isChatCompletionCompatible: true,
  },
  {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    model: "claude-3-7-sonnet-20250219",
    description:
      "Anthropic's claude-3-7-sonnet-20250219 model (provide your own API key)",
    isChatCompletionCompatible: true,
  },
  {
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    apiKey: "",
    model: "mistral-large-latest",
    description:
      "Mistral's mistral-large-latest model (provide your own API key)",
    isChatCompletionCompatible: true,
  },
  {
    name: "Gemini",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=",
    apiKey: "",
    model: "gemini-2.0-flash",
    description: "Google's gemini-2.0-flash model (provide your own API key)",
    isChatCompletionCompatible: false,
  },
  // {
  //   name: "Gemini-2.5-experimental",
  //   baseUrl:
  //     "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-05-06:generateContent?key=",
  //   apiKey: "",
  //   model: "gemini-2.5-pro-preview-05-06",
  //   description:
  //     "Google's gemini-2.5-experimental model (provide your own API key)",
  //   isChatCompletionCompatible: false,
  // },
];
