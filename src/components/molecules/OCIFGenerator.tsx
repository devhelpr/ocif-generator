import { useState } from "react";
import Ajv2020 from "ajv/dist/2020";
import { OCIFSchema } from "../../types/schema";
import { generateOCIFFromPrompt } from "../../services/llm";
import { applyCytoscapeLayout } from "../../services/cytoscapeLayout";
import { Settings } from "./Settings";
import { evaluateAndRerunIfNeeded } from "../../services/prompt-eval";
import { getCurrentAPIConfig } from "../../services/llm-api";
import { generateSVG } from "../../services/svg-service";
import { OCIFJson, OCIFNode } from "../../services/svg-ocif-types/ocif";
import { ReactFlowView } from "./ReactFlowView";
import { LayoutOptions, LayoutType } from "./LayoutOptions";

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
type ViewMode = "json" | "svg" | "flow";

// Import the schema
import schemaJson from "../../../schema.json";
import { getSystemPrompt } from "../../prompt-library/system-prompt";
const schema = schemaJson as OCIFSchema;

// Initialize Ajv
const ajv = new Ajv2020();
const validate = ajv.compile(schema);

export function OCIFGenerator() {
  const [prompt, setPrompt] = useState("");
  const [generatedOCIF, setGeneratedOCIF] = useState("");
  const [parsedOCIF, setParsedOCIF] = useState<OCIFJson | null>(null);
  const [svgContent, setSvgContent] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("json");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [layout, setLayout] = useState<LayoutType>("grid");

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    setError(null);
    setEvaluation(null);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);

    // If switching to SVG view and we have parsed OCIF but no SVG content yet, generate it
    if (mode === "svg" && parsedOCIF && !svgContent) {
      try {
        const svg = generateSVG(parsedOCIF);
        setSvgContent(svg);
      } catch (err) {
        console.error("Error generating SVG:", err);
        setError("Failed to generate SVG visualization.");
      }
    }
  };

  // Create an SVG-compatible OCIF object from D3 layout data
  const createSvgCompatibleOcif = (layoutedData: unknown): OCIFJson => {
    // Create a base OCIFJson object with required fields
    const ocifForSvg: OCIFJson = {
      version: "1.0",
      nodes: {},
      relations: [],
      resources: [],
    };

    try {
      // Get typed data with a safer approach
      const data = layoutedData as {
        ocif: string;
        nodes?: Array<{
          id: string;
          position?: number[];
          [key: string]: unknown;
        }>;
        relations?: unknown[];
        resources?: unknown[];
      };

      // Set version if available
      if (data.ocif) {
        ocifForSvg.version = data.ocif;
      }

      // Process nodes if available
      if (data.nodes && Array.isArray(data.nodes)) {
        data.nodes.forEach((node) => {
          if (node && node.id) {
            // Create a deep copy to avoid reference issues
            const nodeForSvg: OCIFNode = {
              ...node,
              // Ensure position is correctly formatted if it exists
              position:
                Array.isArray(node.position) && node.position.length >= 2
                  ? [node.position[0], node.position[1]]
                  : undefined,
            };

            ocifForSvg.nodes![node.id] = nodeForSvg;
          }
        });
      }

      // Process relations if available with forced casting
      if (data.relations && Array.isArray(data.relations)) {
        ocifForSvg.relations = data.relations as OCIFJson["relations"];
      }

      // Process resources if available with forced casting
      if (data.resources && Array.isArray(data.resources)) {
        ocifForSvg.resources = data.resources as OCIFJson["resources"];
      }
    } catch (error) {
      console.error("Error creating SVG-compatible OCIF", error);
    }

    return ocifForSvg;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvaluation(null);
    setSvgContent("");
    setParsedOCIF(null);

    try {
      // Check if API key is set
      const apiConfig = getCurrentAPIConfig();
      if (!apiConfig.apiKey && !apiConfig.systemKey) {
        setError(
          `No API key set for ${apiConfig.name}. Please configure it in the Settings.`
        );
        setIsLoading(false);
        return;
      }

      // Call the LLM API to generate the OCIF file
      const response = await generateOCIFFromPrompt(prompt, schema);

      // Try to parse the response as JSON
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(response);
      } catch {
        setError("Failed to parse the generated JSON. Please try again.");
        setGeneratedOCIF(response);
        setIsLoading(false);
        return;
      }

      // Apply Cytoscape layout to the nodes
      const layoutedResponse = applyCytoscapeLayout(parsedResponse);

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
      if (viewMode === "svg") {
        try {
          const svg = generateSVG(ocifForSvg);
          setSvgContent(svg);
        } catch (svgError) {
          console.error("Error generating SVG:", svgError);
          setError("Failed to generate SVG visualization.");
        }
      }
    } catch (err) {
      setError("An error occurred while generating the OCIF file.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluateAndRerun = async () => {
    if (!generatedOCIF) {
      setError("Generate OCIF content first before evaluating");
      return;
    }

    setIsEvaluating(true);
    setError(null);

    try {
      // Create a system message - same as used for generation
      const systemMessage = getSystemPrompt(schema);

      const apiConfig = getCurrentAPIConfig();

      // Check if API key is set
      if (!apiConfig.apiKey) {
        setError(
          `No API key set for ${apiConfig.name}. Please configure it in the Settings.`
        );
        setIsEvaluating(false);
        return;
      }

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
          const layoutedImproved = applyCytoscapeLayout(improvedJson);

          // Set the improved output
          setGeneratedOCIF(JSON.stringify(layoutedImproved, null, 2));

          // Create SVG-compatible JSON
          const ocifForSvgImproved = createSvgCompatibleOcif(layoutedImproved);
          setParsedOCIF(ocifForSvgImproved);

          // Update SVG if we're in SVG view mode
          if (viewMode === "svg") {
            try {
              const svg = generateSVG(ocifForSvgImproved);
              setSvgContent(svg);
            } catch (svgError) {
              console.error("Error generating SVG:", svgError);
            }
          }
        } catch (parseError) {
          console.error("Error parsing improved output:", parseError);
          // Keep original output if parsing fails
        }
      }
    } catch (err) {
      setError("An error occurred during evaluation.");
      console.error(err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (viewMode === "json") {
      navigator.clipboard.writeText(generatedOCIF);
    } else {
      navigator.clipboard.writeText(svgContent);
    }
  };

  const handleDownload = () => {
    let blob;
    let filename;

    if (viewMode === "json") {
      blob = new Blob([generatedOCIF], { type: "application/json" });
      filename = "ocif-file.json";
    } else {
      blob = new Blob([svgContent], { type: "image/svg+xml" });
      filename = "ocif-diagram.svg";
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
        <label
          htmlFor="prompt"
          className="block text-sm font-medium text-zinc-700 mb-2"
        >
          Enter your prompt to generate an OCIF file
        </label>
        <p className="text-sm text-zinc-500 mb-4">
          Describe the components and their relationships. The layout will be
          automatically generated using Cytoscape. When you describe connections
          between components, arrows will be automatically created to visualize
          these relationships. Each node will have a descriptive title based on
          your prompt. You can specify shapes (rectangles or ovals) and colors
          in your prompt.
        </p>
        <textarea
          id="prompt"
          rows={5}
          className="w-full rounded-lg border border-zinc-200 shadow-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 p-4 mt-2 text-base"
          placeholder="Example: Create a diagram showing Berlin (green rectangle) as the capital of Germany (red oval), with an arrow connecting them. Include descriptive titles for each node."
          value={prompt}
          onChange={handlePromptChange}
        />
        <div className="mt-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? "Generating..." : "Generate OCIF"}
          </button>

          {generatedOCIF && (
            <button
              type="button"
              onClick={handleEvaluateAndRerun}
              disabled={isEvaluating}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isEvaluating ? "Evaluating..." : "Evaluate & Improve"}
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
              <h3 className="text-sm font-medium text-blue-800">
                Evaluation Results
              </h3>
              <div className="mt-2 text-sm text-blue-700 space-y-2">
                <div className="flex justify-between">
                  <span>Matches Prompt:</span>
                  <span>{evaluation.matchesPrompt ? "✓" : "✗"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Matches System Prompt:</span>
                  <span>{evaluation.matchesSystemPrompt ? "✓" : "✗"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Score:</span>
                  <span>{evaluation.score}/10</span>
                </div>
                {evaluation.missingElements.length > 0 && (
                  <div>
                    <span className="font-medium">Missing Elements:</span>
                    <ul className="list-disc pl-4 mt-1">
                      {evaluation.missingElements.map(
                        (element: string, index: number) => (
                          <li key={index}>{element}</li>
                        )
                      )}
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
                {viewMode === "json"
                  ? "Generated OCIF"
                  : viewMode === "svg"
                  ? "OCIF Diagram"
                  : viewMode === "flow"
                  ? "Flow View"
                  : ""}
              </h3>
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => handleViewModeChange("json")}
                  className={`px-4 py-2 rounded ${
                    viewMode === "json"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  JSON
                </button>
                <button
                  onClick={() => handleViewModeChange("svg")}
                  className={`px-4 py-2 rounded ${
                    viewMode === "svg"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  SVG
                </button>
                <button
                  onClick={() => handleViewModeChange("flow")}
                  className={`px-4 py-2 rounded ${
                    viewMode === "flow"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  Flow
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

          <div className="border rounded-lg p-4 min-h-[500px]">
            {viewMode === "json" && (
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
                {generatedOCIF}
              </pre>
            )}
            {viewMode === "svg" && svgContent && (
              <div
                className="bg-white p-4 rounded-lg overflow-auto"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            )}
            {viewMode === "flow" && parsedOCIF && (
              <div className="w-full h-[500px]">
                <ReactFlowView ocifData={parsedOCIF} layout={layout} />
              </div>
            )}
          </div>

          {viewMode === "flow" && (
            <div className="flex justify-center">
              <LayoutOptions layout={layout} onLayoutChange={setLayout} />
            </div>
          )}
        </div>
      )}

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
