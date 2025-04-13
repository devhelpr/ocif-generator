import { useState } from 'react';
import Ajv2020 from "ajv/dist/2020"
import { OCIFSchema } from '../../types/schema';
import { generateOCIFFromPrompt } from '../../services/llm';
import { applyD3ForceLayout } from '../../services/d3Layout';
import { Settings } from './Settings';
import { evaluateAndRerunIfNeeded } from '../../services/prompt-eval';
import { getCurrentAPIConfig } from '../../services/llm-api';
import { generateSVG } from '../../services/svg-service';
import { OCIFJson, OCIFNode } from '../../services/svg-ocif-types/ocif';

// Define the evaluation result type
interface EvaluationResult {
  matchesPrompt: boolean;
  matchesSystemPrompt: boolean;
  missingElements: string[];
  suggestedHints: string[];
  score: number;
  reasoning: string;
}

// Define view modes
type ViewMode = 'json' | 'svg';

// Import the schema
import schemaJson from '../../../schema.json';
const schema = schemaJson as OCIFSchema;

// Initialize Ajv
const ajv = new Ajv2020();
const validate = ajv.compile(schema);

export function OCIFGenerator() {
  const [prompt, setPrompt] = useState('');
  const [generatedOCIF, setGeneratedOCIF] = useState('');
  const [parsedOCIF, setParsedOCIF] = useState<OCIFJson | null>(null);
  const [svgContent, setSvgContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('json');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    setError(null);
    setEvaluation(null);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    
    // If switching to SVG view and we have parsed OCIF but no SVG content yet, generate it
    if (mode === 'svg' && parsedOCIF && !svgContent) {
      try {
        const svg = generateSVG(parsedOCIF);
        setSvgContent(svg);
      } catch (err) {
        console.error('Error generating SVG:', err);
        setError('Failed to generate SVG visualization.');
      }
    }
  };
  
  // Create an SVG-compatible OCIF object from D3 layout data
  const createSvgCompatibleOcif = (layoutedData: unknown): OCIFJson => {
    // Create a base OCIFJson object with required fields
    const ocifForSvg: OCIFJson = {
      version: '1.0',
      nodes: {},
      relations: [],
      resources: []
    };
    
    try {
      // Get typed data with a safer approach
      const data = layoutedData as {
        ocif: string;
        nodes?: Array<{ id: string; position?: number[]; [key: string]: unknown }>;
        relations?: unknown[];
        resources?: unknown[];
      };
      
      // Set version if available
      if (data.ocif) {
        ocifForSvg.version = data.ocif;
      }
      
      // Process nodes if available
      if (data.nodes && Array.isArray(data.nodes)) {
        data.nodes.forEach(node => {
          if (node && node.id) {
            // Create a deep copy to avoid reference issues
            const nodeForSvg: OCIFNode = {
              ...node,
              // Ensure position is correctly formatted if it exists
              position: Array.isArray(node.position) && node.position.length >= 2 
                ? [node.position[0], node.position[1]] 
                : undefined
            };
            
            ocifForSvg.nodes![node.id] = nodeForSvg;
          }
        });
      }
      
      // Process relations if available with forced casting
      if (data.relations && Array.isArray(data.relations)) {
        ocifForSvg.relations = data.relations as OCIFJson['relations'];
      }
      
      // Process resources if available with forced casting
      if (data.resources && Array.isArray(data.resources)) {
        ocifForSvg.resources = data.resources as OCIFJson['resources'];
      }
    } catch (error) {
      console.error('Error creating SVG-compatible OCIF', error);
    }
    
    return ocifForSvg;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvaluation(null);
    setSvgContent('');
    setParsedOCIF(null);

    try {
      // Call the LLM API to generate the OCIF file
      const response = await generateOCIFFromPrompt(prompt, schema);
      
      // Try to parse the response as JSON
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(response);
      } catch {
        setError('Failed to parse the generated JSON. Please try again.');
        setGeneratedOCIF(response);
        setIsLoading(false);
        return;
      }

      // Apply d3-force layout to the nodes
      const layoutedResponse = applyD3ForceLayout(parsedResponse);

      // Validate against the schema
      const valid = validate(layoutedResponse);
      
      if (!valid) {
        setError(`Validation failed: ${ajv.errorsText(validate.errors)}`);
      }

      // Store string version
      setGeneratedOCIF(JSON.stringify(layoutedResponse, null, 2));
      
      // Create SVG-compatible JSON
      const ocifForSvg = createSvgCompatibleOcif(layoutedResponse);
      setParsedOCIF(ocifForSvg);
      
      // Generate SVG if in SVG view mode
      if (viewMode === 'svg') {
        try {
          const svg = generateSVG(ocifForSvg);
          setSvgContent(svg);
        } catch (svgError) {
          console.error('Error generating SVG:', svgError);
          setError('Failed to generate SVG visualization.');
        }
      }
    } catch (err) {
      setError('An error occurred while generating the OCIF file.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateAndRerun = async () => {
    if (!generatedOCIF) {
      setError('Generate OCIF content first before evaluating');
      return;
    }

    setIsEvaluating(true);
    setError(null);

    try {
      // Create a system message - same as used for generation
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

      const apiConfig = getCurrentAPIConfig();
      
      // Evaluate the output and rerun if needed
      const result = await evaluateAndRerunIfNeeded(
        prompt,
        systemMessage,
        generatedOCIF,
        apiConfig
      );
      
      setEvaluation(result.evaluation);
      
      // If the prompt was rerun and improved output was generated
      if (result.wasRerun && result.improvedOutput) {
        try {
          // Parse and validate the improved output
          const improvedJson = JSON.parse(result.improvedOutput);
          const layoutedImproved = applyD3ForceLayout(improvedJson);
          
          // Set the improved output
          setGeneratedOCIF(JSON.stringify(layoutedImproved, null, 2));

          // Create SVG-compatible JSON
          const ocifForSvgImproved = createSvgCompatibleOcif(layoutedImproved);
          setParsedOCIF(ocifForSvgImproved);
          
          // Update SVG if we're in SVG view mode
          if (viewMode === 'svg') {
            try {
              const svg = generateSVG(ocifForSvgImproved);
              setSvgContent(svg);
            } catch (svgError) {
              console.error('Error generating SVG:', svgError);
            }
          }
        } catch (parseError) {
          console.error('Error parsing improved output:', parseError);
          // Keep original output if parsing fails
        }
      }
    } catch (err) {
      setError('An error occurred during evaluation.');
      console.error(err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (viewMode === 'json') {
      navigator.clipboard.writeText(generatedOCIF);
    } else {
      navigator.clipboard.writeText(svgContent);
    }
  };

  const handleDownload = () => {
    let blob;
    let filename;
    
    if (viewMode === 'json') {
      blob = new Blob([generatedOCIF], { type: 'application/json' });
      filename = 'ocif-file.json';
    } else {
      blob = new Blob([svgContent], { type: 'image/svg+xml' });
      filename = 'ocif-diagram.svg';
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-zinc-900">Generate OCIF</h2>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="inline-flex items-center px-3 py-2 border border-zinc-300 shadow-sm text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Settings
        </button>
      </div>

      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-zinc-700 mb-2">
          Enter your prompt to generate an OCIF file
        </label>
        <p className="text-sm text-zinc-500 mb-2">
          Describe the components and their relationships. The layout will be automatically generated using d3-force.
          When you describe connections between components, arrows will be automatically created to visualize these relationships.
          Each node will have a descriptive title based on your prompt. You can specify shapes (rectangles or ovals) and colors in your prompt.
        </p>
        <textarea
          id="prompt"
          rows={4}
          className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Example: Create a diagram showing Berlin (green rectangle) as the capital of Germany (red oval), with an arrow connecting them. Include descriptive titles for each node."
          value={prompt}
          onChange={handlePromptChange}
        />
        <div className="mt-2 flex justify-end space-x-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? 'Generating...' : 'Generate OCIF'}
          </button>
          
          {generatedOCIF && (
            <button
              type="button"
              onClick={handleEvaluateAndRerun}
              disabled={isEvaluating}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isEvaluating ? 'Evaluating...' : 'Evaluate & Improve'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {evaluation && (
        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex">
            <div className="ml-3 w-full">
              <h3 className="text-sm font-medium text-blue-800">Evaluation Results</h3>
              <div className="mt-2 text-sm text-blue-700 space-y-2">
                <div className="flex justify-between">
                  <span>Matches Prompt:</span>
                  <span>{evaluation.matchesPrompt ? '✓' : '✗'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Matches System Prompt:</span>
                  <span>{evaluation.matchesSystemPrompt ? '✓' : '✗'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Score:</span>
                  <span>{evaluation.score}/10</span>
                </div>
                {evaluation.missingElements.length > 0 && (
                  <div>
                    <span className="font-medium">Missing Elements:</span>
                    <ul className="list-disc pl-4 mt-1">
                      {evaluation.missingElements.map((element: string, index: number) => (
                        <li key={index}>{element}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {evaluation.reasoning && (
                  <div>
                    <span className="font-medium">Reasoning:</span>
                    <p className="mt-1">{evaluation.reasoning}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {(generatedOCIF || svgContent) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-medium text-zinc-900">
                {viewMode === 'json' ? 'Generated OCIF' : 'OCIF Diagram'}
              </h3>
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => handleViewModeChange('json')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-md ${
                    viewMode === 'json' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } border border-gray-300 focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10`}
                >
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('svg')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-md ${
                    viewMode === 'svg' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } border border-gray-300 focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:z-10`}
                >
                  SVG
                </button>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleCopyToClipboard}
                className="inline-flex items-center px-3 py-2 border border-zinc-300 shadow-sm text-sm font-medium rounded-md text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Download
              </button>
            </div>
          </div>

          {viewMode === 'json' ? (
            <pre className="bg-zinc-50 p-4 rounded-lg overflow-auto max-h-96 text-sm">
              {generatedOCIF}
            </pre>
          ) : (
            <div className="bg-white p-4 rounded-lg overflow-auto max-h-[500px] border border-zinc-300">
              {svgContent ? (
                <div dangerouslySetInnerHTML={{ __html: svgContent }} />
              ) : (
                <div className="flex items-center justify-center h-64 text-zinc-400">
                  <p>
                    {parsedOCIF 
                      ? 'Generating SVG visualization...' 
                      : 'Generate OCIF content first to view SVG visualization'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
} 
