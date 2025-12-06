import React from 'react';
import { Settings, Image, Video, PenTool, FileText } from 'lucide-react';
import { AppSettings, FileType } from '../types';

interface Props {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  isProcessing: boolean;
}

const MetadataSettings: React.FC<Props> = ({ settings, setSettings, isProcessing }) => {
  
  const handleTypeChange = (type: FileType) => {
    if (isProcessing) return; // Prevent change during processing
    setSettings(prev => ({ ...prev, selectedFileType: type }));
  };

  const handleChange = (field: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field: 'slideTitle' | 'slideKeyword', value: string) => {
    let num = parseInt(value);
    if (isNaN(num)) num = 0;
    
    // Constraints
    if (field === 'slideTitle') {
      if (num > 100) num = 100; // Changed from 200 to 100
      if (num < 0) num = 0;
    } else if (field === 'slideKeyword') {
      if (num > 50) num = 50; 
      if (num < 0) num = 0;
    }
    
    setSettings(prev => ({ ...prev, [field]: num }));
  };

  const inputClass = "w-full text-base p-2 border border-gray-300 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400";

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-blue-500" />
        <h2 className="text-base font-semibold text-gray-700 uppercase tracking-wide">Metadata Settings</h2>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 -my-2"></div>

      {/* File Type Selector */}
      <div className="pt-2">
        <label className="block text-sm font-medium text-gray-500 mb-1">File Type</label>
        <div className={`flex gap-2 p-1 bg-gray-100 rounded-lg w-full ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}>
          {[FileType.Image, FileType.Video, FileType.Vector].map((type) => {
            const isActive = settings.selectedFileType === type;
            const Icon = type === FileType.Image ? Image : type === FileType.Video ? Video : PenTool;
            return (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                disabled={isProcessing}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-base font-medium rounded-md transition-all ${
                  isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'
                } ${isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Icon className="w-4 h-4" />
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Text Inputs */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Custom Title (Optional)</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Priority title..."
            value={settings.customTitle}
            onChange={(e) => handleChange('customTitle', e.target.value)}
            disabled={isProcessing}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Custom Keyword (Optional)</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Priority keyword..."
            value={settings.customKeyword}
            onChange={(e) => handleChange('customKeyword', e.target.value)}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Numeric Inputs Side-by-Side */}
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-500 mb-1">Title Length (Max. 100)</label>
          <input
            type="number"
            min="0"
            max="100"
            className={inputClass}
            value={settings.slideTitle}
            onChange={(e) => handleNumberChange('slideTitle', e.target.value)}
            disabled={isProcessing}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-500 mb-1">Keyword Count (Max. 50)</label>
          <input
            type="number"
            min="0"
            max="50"
            className={inputClass}
            value={settings.slideKeyword}
            onChange={(e) => handleNumberChange('slideKeyword', e.target.value)}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Custom CSV Filename - ALWAYS ENABLED */}
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2 mb-1">
           <FileText className="w-4 h-4 text-blue-500" />
           <label className="block text-sm font-medium text-gray-500">Custom CSV Filename</label>
        </div>
        <div className="relative flex items-center">
          <input
            type="text"
            className={`${inputClass} pr-12 !bg-white !text-gray-900`} 
            placeholder="IsaProMe"
            value={settings.csvFilename}
            onChange={(e) => handleChange('csvFilename', e.target.value)}
            disabled={false} 
          />
          <span className="absolute right-3 text-gray-400 font-medium select-none pointer-events-none">.csv</span>
        </div>
      </div>
    </div>
  );
};

export default MetadataSettings;