import { useState } from 'react';
import Ajv2020 from "ajv/dist/2020"
import { IconButton } from '../atoms/IconButton';
import { OCIFSchema } from '../../types/schema';
import { generateOCIFFromPrompt } from '../../services/openai';
import { applyD3ForceLayout } from '../../services/d3Layout';

// Import the schema
import schemaJson from '../../../schema.json';
const schema = schemaJson as OCIFSchema;

// Initialize Ajv
const ajv = new Ajv2020();
const validate = ajv.compile(schema);

export function OCIFGenerator() {
  const [prompt, setPrompt] = useState('');
  const [generatedOCIF, setGeneratedOCIF] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    setError(null);
    setIsValid(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsValid(null);

    try {
      // Call the OpenAI API to generate the OCIF file
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
      setIsValid(valid);
      
      if (!valid) {
        setError(`Validation failed: ${ajv.errorsText(validate.errors)}`);
      }

      setGeneratedOCIF(JSON.stringify(layoutedResponse, null, 2));
    } catch (err) {
      setError('An error occurred while generating the OCIF file.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedOCIF);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedOCIF], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocif-file.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-zinc-700 mb-2">
          Enter your prompt to generate an OCIF file
        </label>
        <p className="text-sm text-zinc-500 mb-2">
          Describe the components and their relationships. The layout will be automatically generated using d3-force.
          When you describe connections between components, arrows will be automatically created to visualize these relationships.
          Each node will have a descriptive title based on your prompt.
        </p>
        <textarea
          id="prompt"
          rows={4}
          className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Example: Create a diagram showing Berlin as the capital of Germany, with an arrow connecting them. Include descriptive titles for each node."
          value={prompt}
          onChange={handlePromptChange}
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? 'Generating...' : 'Generate OCIF'}
          </button>
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

      {generatedOCIF && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium text-zinc-900">Generated OCIF</h3>
            <div className="flex space-x-2">
              <IconButton
                onClick={handleCopyToClipboard}
                icon="📋"
                variant="subtle"
              >
                Copy
              </IconButton>
              <IconButton
                onClick={handleDownload}
                icon="⬇️"
                variant="subtle"
              >
                Download
              </IconButton>
            </div>
          </div>
          <div className="relative">
            <pre className="bg-zinc-50 p-4 rounded-lg overflow-auto max-h-96 text-sm">
              <code>{generatedOCIF}</code>
            </pre>
            {isValid !== null && (
              <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isValid ? 'Valid OCIF' : 'Invalid OCIF'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 