import { OCIFSchema } from "../types/schema";
import { z, ZodTypeAny } from "zod";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { callLLMAPI, getCurrentAPIConfig } from "./llm-api";

interface GenerateStructuredOutputParams<T extends ZodTypeAny> {
  schema: T;
  request: string;
  temperature?: number;
}

export async function generateStructuredOutput<T extends ZodTypeAny>(
  { schema, request, temperature = 1.5 }: GenerateStructuredOutputParams<T>,
  apiKey = ""
): Promise<z.infer<T>> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    apiKey: apiKey,
    temperature,
  });
  removeAdditionalProperties(schema);
  const structuredLlm = model.withStructuredOutput(schema, {
    strict: false,
  });
  return await structuredLlm.invoke(request);
}

function removeAdditionalProperties(schema: any): any {
  if (schema && typeof schema === "object") {
    delete schema.additionalProperties; // Remove from current level
    Object.values(schema).forEach((value) => {
      if (typeof value === "object") {
        removeAdditionalProperties(value); // Apply recursively to nested objects
      }
    });
  }
}

// interface APIConfig {
//   name: string;
//   baseUrl: string;
//   apiKey: string;
// }

// export function getCurrentAPIConfig(): APIConfig {
//   const savedSettings = localStorage.getItem('llmSettings');
//   if (savedSettings) {
//     const { apis, selectedAPI } = JSON.parse(savedSettings);
//     const selectedConfig = apis.find((api: APIConfig) => api.name === selectedAPI);
//     if (selectedConfig) {
//       return selectedConfig;
//     }
//   }

//   // Fallback to default OpenAI config
//   return {
//     name: 'OpenAI',
//     baseUrl: 'https://api.openai.com/v1',
//     apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
//   };
// }

export async function generateOCIFFromPrompt(
  prompt: string,
  schema: OCIFSchema
): Promise<string> {
  const apiConfig = getCurrentAPIConfig();

  // Create a system message that instructs the model to generate valid OCIF JSON
  const systemMessage = `You are an expert in generating flow diagram and flowcharts in  Open Component Interconnect Format (OCIF) JSON files.
Your task is to generate a valid OCIF JSON file based on the user's prompt.
The JSON must strictly follow this schema:
${JSON.stringify(schema, null, 2)}

Important rules:
1. The output must be valid JSON that conforms to the schema.
2. Include all required fields from the schema.
3. Generate realistic and useful data based on the user's prompt.
4. Do not include any explanations or markdown formatting in your response, only the JSON.
5. Ensure all IDs are unique and properly referenced.
6. For relations between nodes:
   - Add a 'source' and 'target' field to each relation to specify connected nodes
   - Use node IDs to reference the connected nodes
   - Create meaningful connections based on the component relationships
   - Include at least one relation for each node to ensure proper layout
   - Create a logical hierarchy of components with parent-child relationships
7. For node positions:
   - You can optionally specify initial positions using the 'position' field
   - If not specified, positions will be automatically calculated using d3-force
   - Positions should be specified as [x, y] coordinates
8. For node sizes:
   - Specify realistic sizes for components using the 'size' field
   - Sizes should be specified as [width, height]
   - Use appropriate sizes based on the component type
   - Larger components should have larger sizes (e.g., main containers: [300, 200], buttons: [100, 40])
   - Make sure to leave enough space between nodes for arrows (use smaller sizes)
9. For connections between nodes:
   - When the prompt describes connections or relationships between components, create arrow nodes to visualize these connections
   - For each connection, create:
     a) An arrow node with type "@ocif/node/arrow" in the nodes array
     b) A relation with type "@ocif/rel/edge" in the relations array that references the arrow node
   - The arrow node should have:
     - A unique ID (e.g., "arrow-1", "arrow-2")
     - A data array with a single object containing:
       - type: "@ocif/node/arrow"
       - strokeColor: A color for the arrow (e.g., "#000000")
       - start: The starting point [x, y] (will be updated by the layout algorithm)
       - end: The ending point [x, y] (will be updated by the layout algorithm)
       - startMarker: "none"
       - endMarker: "arrowhead"
       - relation: The ID of the corresponding relation
   - The relation should have:
     - A unique ID (e.g., "relation-1", "relation-2")
     - A data array with a single object containing:
       - type: "@ocif/rel/edge"
       - start: The ID of the source node
       - end: The ID of the target node
       - rel: A semantic relationship URI (e.g., "https://www.wikidata.org/wiki/Property:P1376")
       - node: The ID of the arrow node
10. For node titles and labels:
    - Create a resource for each node with a text/plain representation
    - The resource should have:
      - A unique ID (e.g., "node1-res", "node2-res")
      - A representations array with at least one object containing:
        - mime-type: "text/plain"
        - content: A descriptive title for the node based on its purpose
    - Reference this resource in the node's "resource" field
    - Example:
      {
        "id": "node1",
        "position": [100, 100],
        "size": [80, 40],
        "resource": "node1-res",
        "data": [...]
      },
      {
        "id": "node1-res",
        "representations": [
          { "mime-type": "text/plain", "content": "Login Form" }
        ]
      }
11. For node shapes:
    - Every node that represents a shape (not an arrow) MUST have a "data" property with an array containing at least one object
    - The first object in the data array MUST have a "type" property that specifies the shape type
    - For rectangular shapes, use:
      {
        "type": "@ocif/node/rect",
        "strokeWidth": 3,
        "strokeColor": "#000000",
        "fillColor": "#00FF00"
      }
    - For oval/circular shapes, use:
      {
        "type": "@ocif/node/oval",
        "strokeWidth": 5,
        "strokeColor": "#FF0000",
        "fillColor": "#FFFFFF"
      }
    - If the prompt specifies colors or stroke widths, use those values instead of the defaults
    - Choose the appropriate shape type based on the context (e.g., use oval for countries, cities, or organic shapes)
12. IMPORTANT: The generated OCIF file MUST include the "ocif" property with the value "https://canvasprotocol.org/ocif/0.4" as the first property in the JSON object.
13. For groups: include a group relation between the group and the nodes it contains.
      {
        "id":"group-1",
        "data" : [{
          "type": "@ocif/rel/group",
          "members": ["node-id", "node-id", "node-id"],
        }]
      }
`;

  try {
    return await callLLMAPI(prompt, systemMessage, apiConfig);
  } catch (error) {
    console.error("Error calling API:", error);
    throw error;
  }
}
