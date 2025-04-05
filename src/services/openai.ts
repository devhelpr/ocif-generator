import { OCIFSchema } from '../types/schema';
import {OCIFSchemaDefinition} from '../schemas/schema';
import { zodResponseFormat } from "openai/helpers/zod";
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
12. IMPORTANT: The generated OCIF file MUST include the "ocif" property with the value "https://canvasprotocol.org/ocif/0.4" as the first property in the JSON object.`;

  try {
    // Use a try-catch block to handle potential response format validation errors
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
          response_format: zodResponseFormat(OCIFSchemaDefinition, "open_canvas_interchange_format")
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
        const parsedJson = JSON.parse(content);
        
        // Ensure the ocif property is set correctly
        if (!parsedJson.ocif || parsedJson.ocif !== "https://canvasprotocol.org/ocif/0.4") {
          parsedJson.ocif = "https://canvasprotocol.org/ocif/0.4";
          return JSON.stringify(parsedJson, null, 2);
        }
        
        return content;
      } catch {
        throw new Error('The response from OpenAI is not valid JSON');
      }
    } catch (formatError) {
      // If there's an error with the response format validation, fall back to the standard approach
      console.warn('Response format validation failed, falling back to standard approach:', formatError);
      
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
        const parsedJson = JSON.parse(content);
        
        // Ensure the ocif property is set correctly
        if (!parsedJson.ocif || parsedJson.ocif !== "https://canvasprotocol.org/ocif/0.4") {
          parsedJson.ocif = "https://canvasprotocol.org/ocif/0.4";
        }
        
        // Ensure nodes have the correct data structure
        if (parsedJson.nodes) {
          parsedJson.nodes.forEach((node: { data?: Array<{ type?: string }> }) => {
            if (node.data && Array.isArray(node.data)) {
              node.data.forEach((dataItem: { type?: string }) => {
                if (!dataItem.type) {
                  dataItem.type = "@ocif/node/rect"; // Default type
                }
              });
            }
          });
        }
        
        // Ensure relations have the correct data structure
        if (parsedJson.relations) {
          parsedJson.relations.forEach((relation: { data?: Array<{ type?: string }> }) => {
            if (relation.data && Array.isArray(relation.data)) {
              relation.data.forEach((dataItem: { type?: string }) => {
                if (!dataItem.type) {
                  dataItem.type = "@ocif/rel/edge"; // Default type
                }
              });
            }
          });
        }
        
        return JSON.stringify(parsedJson, null, 2);
      } catch {
        throw new Error('The response from OpenAI is not valid JSON');
      }
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
} 