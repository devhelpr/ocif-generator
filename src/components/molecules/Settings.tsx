import { useState, useEffect } from 'react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface APIConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}

const defaultAPIs: APIConfig[] = [
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  },
  {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  },
  {
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKey: import.meta.env.VITE_MISTRAL_API_KEY || '',
  },
  {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=',
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  },
];

export function Settings({ isOpen, onClose }: SettingsProps) {
  const [selectedAPI, setSelectedAPI] = useState<string>(defaultAPIs[0].name);
  const [apiKey, setApiKey] = useState<string>(defaultAPIs[0].apiKey);
  const [apis, setApis] = useState<APIConfig[]>(defaultAPIs);

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('llmSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setApis(parsed.apis);
      setSelectedAPI(parsed.selectedAPI);
      setApiKey(parsed.apis.find((api: APIConfig) => api.name === parsed.selectedAPI)?.apiKey || '');
    }
  }, []);

  const handleSave = () => {
    const updatedApis = apis.map(api => 
      api.name === selectedAPI ? { ...api, apiKey } : api
    );
    
    const settings = {
      apis: updatedApis,
      selectedAPI,
    };
    
    localStorage.setItem('llmSettings', JSON.stringify(settings));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="api-select" className="block text-sm font-medium text-zinc-700 mb-1">
              Select API Provider
            </label>
            <select
              id="api-select"
              value={selectedAPI}
              onChange={(e) => {
                setSelectedAPI(e.target.value);
                const selectedApiConfig = apis.find(api => api.name === e.target.value);
                setApiKey(selectedApiConfig?.apiKey || '');
              }}
              className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {apis.map((api) => (
                <option key={api.name} value={api.name}>
                  {api.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="api-key" className="block text-sm font-medium text-zinc-700 mb-1">
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your API key"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
} 