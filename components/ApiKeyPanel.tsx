import React from 'react';
import { Key } from 'lucide-react';

interface Props {
  apiKeys: string[];
  setApiKeys: (keys: string[]) => void;
  isProcessing: boolean;
}

const ApiKeyPanel: React.FC<Props> = ({ apiKeys, setApiKeys, isProcessing }) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    // Split by newlines or commas and clean up
    const keys = text.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
    setApiKeys(keys);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <Key className="w-4 h-4 text-blue-500" />
        <h2 className="text-base font-semibold text-gray-700 uppercase tracking-wide">API Keys</h2>
      </div>
      <textarea
        className="w-full text-sm p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none bg-white"
        rows={3}
        placeholder="Enter API keys (one per line or comma separated)..."
        onChange={handleChange}
        disabled={isProcessing}
        defaultValue={apiKeys.join('\n')}
      />
      <div className="mt-1 text-sm text-gray-400 text-right">
        {apiKeys.length} keys loaded
      </div>
    </div>
  );
};

export default ApiKeyPanel;