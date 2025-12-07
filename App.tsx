
import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, Wand2, UploadCloud, FolderOutput, FilePlus, CheckCircle, AlertCircle, Circle, Database, Activity, Coffee, FolderPlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import ApiKeyPanel from './components/ApiKeyPanel';
import MetadataSettings from './components/MetadataSettings';
import FileCard from './components/FileCard';
import PreviewModal from './components/PreviewModal';
import { generateMetadataForFile, translateMetadataContent } from './services/geminiService';
import { downloadCSV } from './utils/helpers';
import { AppSettings, FileItem, FileType, ProcessingStatus, Language, FileMetadata } from './types';
import { INITIAL_METADATA } from './constants';

interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const App: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<'metadata' | 'logs'>('metadata');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    customTitle: '',
    customKeyword: '',
    slideTitle: 50, 
    slideKeyword: 40,
    selectedFileType: FileType.Image,
    csvFilename: '',
  });
  
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  
  const [fileLanguages, setFileLanguages] = useState<Record<string, Language>>({});

  // Refs for processing logic
  const processingRef = useRef(false);
  const activeWorkersRef = useRef(0);
  const queueRef = useRef<string[]>([]);
  
  // LOGIC UPDATE: Track active keys to prevent double usage
  const activeKeysRef = useRef<Set<string>>(new Set());
  
  // LOGIC UPDATE: Cooldown map instead of Dead Keys
  // Map<ApiKey, TimestampWhenAvailable>
  const cooldownKeysRef = useRef<Map<string, number>>(new Map());
  
  // LOGIC UPDATE: Global Rotation Index for Round-Robin
  const nextKeyIdxRef = useRef(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);

  // Clock Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Clear cooldowns if user updates the key list
  useEffect(() => {
    cooldownKeysRef.current.clear();
    nextKeyIdxRef.current = 0;
  }, [apiKeys]);

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Logging Helper
  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setLogs(prev => [...prev, {
      id: uuidv4(),
      time: timeString,
      message,
      type
    }]);
  };

  // Wrapper for updating API keys to add logging
  const handleSetApiKeys = (keys: string[]) => {
    setApiKeys(keys);
    if (keys.length > 0) {
      addLog(`User inputs API Keys. Total loaded: ${keys.length}`, 'info');
    }
  };

  // Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    processFiles(e.target.files);
    e.target.value = ''; // Reset input
  };

  // Instant Process Files (No extraction here, just UI setup)
  const processFiles = (fileList: FileList) => {
    const count = fileList.length;
    addLog(`Uploaded ${count} ${settings.selectedFileType} files. Filtering...`, 'info');

    const newFiles: FileItem[] = Array.from(fileList)
      .filter(file => {
        if (settings.selectedFileType === FileType.Image) return file.type.startsWith('image/');
        if (settings.selectedFileType === FileType.Video) return file.type.startsWith('video/');
        if (settings.selectedFileType === FileType.Vector) {
          return file.type.startsWith('image/') || file.name.endsWith('.eps') || file.name.endsWith('.ai') || file.type === 'application/pdf';
        }
        return false;
      })
      .map((file: File) => ({
        id: uuidv4(),
        file,
        previewUrl: URL.createObjectURL(file), // Full file preview URL
        type: settings.selectedFileType,
        status: ProcessingStatus.Pending,
        metadata: JSON.parse(JSON.stringify(INITIAL_METADATA)), // Deep copy
      }));
      
    if (newFiles.length < count) {
       addLog(`Filtered out ${count - newFiles.length} invalid files.`, 'warning');
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleClearAll = () => {
    const count = files.length;
    files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    setIsProcessing(false);
    processingRef.current = false;
    addLog(`Cleared all ${count} files.`, 'warning');
  };

  const handleDelete = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file) {
      URL.revokeObjectURL(file.previewUrl);
      addLog(`Deleted file: ${file.file.name}`, 'warning');
    }
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // --- DUAL LANGUAGE SYNC UPDATE LOGIC ---
  const handleUpdateMetadata = async (id: string, field: 'title' | 'keywords' | 'category', value: string, language: Language) => {
    
    // 1. Immediate Local Update (Optimistic UI)
    setFiles(prev => prev.map(f => {
      if (f.id !== id) return f;
      
      const newMeta = { ...f.metadata };
      
      if (field === 'category') {
         newMeta.category = value; // Category is shared/global ID
      } else {
         // Update specific language slot
         if (language === 'ENG') {
           newMeta.en = { ...newMeta.en, [field]: value };
         } else {
           newMeta.ind = { ...newMeta.ind, [field]: value };
         }
      }
      return { ...f, metadata: newMeta };
    }));

    // 2. Background Sync (Translation)
    if (field === 'title' || field === 'keywords') {
      const file = files.find(f => f.id === id);
      if (!file || apiKeys.length === 0) return;

      const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

      try {
        const currentSourceMeta = language === 'ENG' 
          ? { ...file.metadata.en, [field]: value } 
          : { ...file.metadata.ind, [field]: value };

        const translated = await translateMetadataContent(currentSourceMeta, language, apiKey);

        setFiles(prev => prev.map(f => {
          if (f.id !== id) return f;
          const newMeta = { ...f.metadata };
          
          if (language === 'ENG') {
            newMeta.ind = translated;
          } else {
            newMeta.en = translated;
          }
          return { ...f, metadata: newMeta };
        }));
        
        addLog(`Synced edit: ${language} → ${language === 'ENG' ? 'IND' : 'ENG'} for ${file.file.name}`, 'info');

      } catch (error) {
        console.error("Sync translation failed", error);
      }
    }
  };

  const handleToggleLanguage = (id: string) => {
    setFileLanguages(prev => ({
      ...prev,
      [id]: prev[id] === 'IND' ? 'ENG' : 'IND'
    }));
  };

  const handleDownloadCSV = () => {
    const filename = downloadCSV(files, settings.csvFilename);
    addLog(`Downloaded CSV: ${filename}`, 'success');
  };

  const getLanguage = (id: string): Language => fileLanguages[id] || 'ENG';

  // --- IMPROVED WORKER LOGIC (Round Robin + Smart Concurrency) ---

  const startProcessing = () => {
    if (apiKeys.length === 0) {
      alert("Please enter at least one API Key.");
      addLog('Failed to start: No API Key provided.', 'error');
      return;
    }
    
    // Identify targets: Pending OR Failed
    const targetFiles = files.filter(f => f.status === ProcessingStatus.Pending || f.status === ProcessingStatus.Failed);
    
    if (targetFiles.length === 0) {
      return;
    }

    // Set Failed back to Pending visually immediately
    setFiles(prev => prev.map(f => f.status === ProcessingStatus.Failed ? { ...f, status: ProcessingStatus.Pending, error: undefined } : f));

    // UI Locking & State Init
    setIsProcessing(true);
    processingRef.current = true;
    
    // Reset Logic State
    activeWorkersRef.current = 0;
    queueRef.current = targetFiles.map(f => f.id); 
    activeKeysRef.current.clear();
    
    addLog(`Starting Queue: ${queueRef.current.length} files.`, 'info');

    // SMART CONCURRENCY: 
    // If you have 1 key, run 2 workers. If 10 keys, run 20 workers. Cap at 20 to prevent browser lag.
    const maxConcurrency = Math.min(20, Math.max(2, apiKeys.length * 2));

    addLog(`Spawning ${maxConcurrency} workers (Round Robin Strategy)...`, 'info');

    for (let i = 0; i < maxConcurrency; i++) {
      spawnWorker(i + 1);
    }
  };

  const spawnWorker = async (workerId: number) => {
    if (!processingRef.current) return;

    // Get next file from FRONT of queue
    const fileId = queueRef.current.shift();
    if (!fileId) {
      // No files left? Check if we are truly done
      checkCompletion();
      return;
    }

    activeWorkersRef.current++;

    // --- KEY SELECTION (ROUND ROBIN) ---
    // We iterate through the keys starting from the global rotation pointer.
    // We look for a key that is NOT active AND NOT in cooldown.
    
    let selectedKey: string | null = null;
    const totalKeys = apiKeys.length;
    const now = Date.now();

    // Clean up expired cooldowns
    for (const [key, expiry] of cooldownKeysRef.current.entries()) {
      if (now > expiry) {
        cooldownKeysRef.current.delete(key);
      }
    }

    // Try to find a key by iterating through the list
    for (let i = 0; i < totalKeys; i++) {
      // Get key at current rotation index
      const idx = (nextKeyIdxRef.current + i) % totalKeys;
      const keyCandidate = apiKeys[idx];

      const isBusy = activeKeysRef.current.has(keyCandidate);
      const isCooling = cooldownKeysRef.current.has(keyCandidate);

      if (!isBusy && !isCooling) {
        selectedKey = keyCandidate;
        // Move the global pointer forward so the next worker picks the NEXT key (Backup logic)
        nextKeyIdxRef.current = (idx + 1) % totalKeys;
        break;
      }
    }

    // If no key found (All busy or cooling)
    if (!selectedKey) {
      // Put file back at the FRONT (since we didn't even try it)
      queueRef.current.unshift(fileId);
      activeWorkersRef.current--;
      
      // Wait a bit and retry (Throttle)
      setTimeout(() => spawnWorker(workerId), 1000);
      return;
    }

    // Mark key as active
    activeKeysRef.current.add(selectedKey);
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: ProcessingStatus.Processing } : f));

    let fileItem = files.find(f => f.id === fileId);
    
    // Determine Key Number for Logs (1-based index)
    const keyIndex = apiKeys.indexOf(selectedKey) + 1;

    try {
      if (!fileItem) throw new Error("File not found in state");

      const { metadata, thumbnail } = await generateMetadataForFile(fileItem, settings, selectedKey);

      setFiles(prev => prev.map(f => f.id === fileId ? { 
        ...f, 
        status: ProcessingStatus.Completed, 
        metadata,
        thumbnail
      } : f));
      
      addLog(`Key ${keyIndex} [Success] ${fileItem.file.name}`, 'success');

      // Release key
      activeKeysRef.current.delete(selectedKey);

    } catch (error: any) {
      activeKeysRef.current.delete(selectedKey!); // Release logic handle
      
      const errorMsg = String(error).toLowerCase();
      const isKeyError = errorMsg.includes('429') || 
                         errorMsg.includes('403') || 
                         errorMsg.includes('quota') || 
                         errorMsg.includes('timeout') ||
                         errorMsg.includes('fetch failed') ||
                         errorMsg.includes('overloaded');

      if (isKeyError) {
        // --- QUEUE LOGIC UPDATE (Point 2) ---
        // Push to BACK of queue
        queueRef.current.push(fileId);
        
        // --- COOLDOWN LOGIC (Point 3) ---
        // Add to cooldown for 30 seconds
        cooldownKeysRef.current.set(selectedKey!, Date.now() + 30000);
        
        addLog(`Key ${keyIndex} Limited/Error. Cooling down 30s. File moved to end of queue.`, 'warning');
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: ProcessingStatus.Pending } : f));

      } else {
        // Non-key error (File corrupt, etc) -> Fail permanently
        console.error(error);
        setFiles(prev => prev.map(f => f.id === fileId ? { 
          ...f, 
          status: ProcessingStatus.Failed, 
          error: String(error) 
        } : f));
        addLog(`Key ${keyIndex} [Failed] ${fileItem?.file.name}: ${errorMsg}`, 'error');
      }
    }

    activeWorkersRef.current--;
    
    // Process next file
    spawnWorker(workerId);
  };

  const checkCompletion = () => {
    // Only finish if no workers are active AND queue is empty
    if (activeWorkersRef.current === 0) {
      setTimeout(() => {
        if (queueRef.current.length === 0 && activeWorkersRef.current === 0) {
            setIsProcessing(false);
            processingRef.current = false;
            addLog('All workers finished.', 'success');
        }
      }, 1000);
    }
  };

  // Helper values
  const totalFiles = files.length;
  const completedCount = files.filter(f => f.status === ProcessingStatus.Completed).length;
  const failedCount = files.filter(f => f.status === ProcessingStatus.Failed).length;
  const pendingCount = files.filter(f => f.status === ProcessingStatus.Pending).length;
  
  const canGenerate = !isProcessing && (pendingCount > 0 || failedCount > 0);

  const getInputAccept = () => {
    switch (settings.selectedFileType) {
      case FileType.Video: return "video/*";
      case FileType.Vector: return ".svg,.eps,.ai,.pdf";
      case FileType.Image: default: return "image/*";
    }
  };

  return (
    <div className="flex flex-col min-h-screen md:h-screen bg-gray-50 overflow-x-hidden">
      
      {/* Header */}
      <header className="fixed top-0 left-0 w-full bg-white border-b border-gray-200 px-6 h-16 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center">
          <h1 className="text-5xl font-share-tech font-bold bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent tracking-tighter leading-none select-none">IsaProMe</h1>
        </div>
        <div className="flex flex-col items-end justify-center text-gray-800">
           <span className="text-2xl leading-none tracking-tight tabular-nums">
             {formatTime(currentTime)}
           </span>
           <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-0.5 tabular-nums">
             {formatDate(currentTime)}
           </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row md:overflow-hidden relative pt-16">
        
        {/* Sidebar */}
        <aside className="w-full md:w-96 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col shrink-0 z-20 shadow-sm md:shadow-none order-1 h-auto md:h-full">
          
          <div className="flex p-2 bg-white border-b border-gray-200 gap-2 shrink-0">
             <button onClick={() => setActiveTab('metadata')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all border ${activeTab === 'metadata' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
               <Database className="w-4 h-4" /> Metadata
             </button>
             <button onClick={() => setActiveTab('logs')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all border ${activeTab === 'logs' ? 'bg-violet-50 text-violet-700 border-violet-300' : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50'}`}>
               <Activity className="w-4 h-4" /> Logs
             </button>
             <a href="https://lynk.id/isaproject/0581ez0729vx" target="_blank" rel="noopener noreferrer" className="flex-1 py-2 px-3 rounded-lg text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all bg-white text-orange-700 hover:bg-orange-50 border border-orange-200">
               <Coffee className="w-4 h-4 text-orange-600" /> Support
             </a>
          </div>

          <div ref={sidebarContentRef} className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
            
            {activeTab === 'metadata' && (
              <div className="p-4 flex flex-col gap-4 animate-in slide-in-from-left-2 duration-300 flex-1 overflow-y-auto">
                <ApiKeyPanel apiKeys={apiKeys} setApiKeys={handleSetApiKeys} isProcessing={isProcessing} />
                <MetadataSettings settings={settings} setSettings={setSettings} isProcessing={isProcessing} />

                <div className="flex flex-col gap-3">
                  <input ref={fileInputRef} type="file" multiple accept={getInputAccept()} onChange={handleFileUpload} className="hidden" disabled={isProcessing} />
                  <input ref={folderInputRef} type="file" multiple {...({ webkitdirectory: "", directory: "" } as any)} onChange={handleFileUpload} className="hidden" disabled={isProcessing} />

                  <div className="flex gap-2">
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className={`flex-1 py-3 rounded-lg font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${isProcessing ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
                       <FilePlus size={18} /> Files
                    </button>
                    <button onClick={() => folderInputRef.current?.click()} disabled={isProcessing} className={`flex-1 py-3 rounded-lg font-bold shadow-sm transition-all flex items-center justify-center gap-2 ${isProcessing ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
                       <FolderPlus size={18} /> Folder
                    </button>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm flex flex-col gap-2">
                     <div className="flex items-center justify-between text-sm font-medium text-gray-600">
                        <div className="flex items-center gap-1.5"><Circle className="w-3.5 h-3.5 text-blue-500" /> <span>Selected: <span className="text-gray-900">{totalFiles}</span></span></div>
                        <div className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> <span>Completed: <span className="text-green-600">{completedCount}</span></span></div>
                        <div className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-red-500" /> <span>Failed: <span className="text-red-500">{failedCount}</span></span></div>
                     </div>
                     <button onClick={handleClearAll} disabled={totalFiles === 0 || isProcessing} className="w-full mt-1 flex items-center justify-center gap-2 py-2 text-sm font-bold uppercase tracking-wide rounded border transition-colors bg-red-50 text-red-600 border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50">
                        <Trash2 size={14} /> Clear All
                     </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="p-4 h-full flex flex-col animate-in slide-in-from-right-2 duration-300 overflow-hidden">
                 <div className="bg-white text-gray-800 rounded-lg p-4 h-[600px] md:h-full text-sm overflow-y-auto shadow-sm border border-gray-200 relative">
                   {logs.length === 0 ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40 gap-2 text-gray-400">
                       <Activity size={32} /> <p>No activity yet.</p>
                     </div>
                   ) : (
                     <div className="flex flex-col gap-2">
                       {logs.map(log => (
                         <div key={log.id} className="flex gap-2 items-start break-all border-b border-gray-50 pb-1 last:border-0">
                           <span className="text-gray-400 shrink-0 font-medium">[{log.time}]</span>
                           <span className={log.type === 'error' ? 'text-red-600 font-bold' : log.type === 'success' ? 'text-green-600 font-semibold' : log.type === 'warning' ? 'text-orange-600 font-semibold' : 'text-gray-700'}>
                             {log.message}
                           </span>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
              </div>
            )}

          </div>

          <div className="p-4 bg-white border-t border-gray-200 flex flex-col gap-3 sticky bottom-0 md:static shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:shadow-none z-30">
             {isProcessing ? (
               <div className="w-full py-3 bg-gray-100 border border-gray-200 text-gray-500 font-medium rounded-lg flex items-center justify-center gap-3">
                 <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                 Processing... {completedCount}/{totalFiles}
               </div>
             ) : (
               <button 
                 onClick={startProcessing}
                 disabled={!canGenerate}
                 className={`w-full py-3 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2 ${
                    canGenerate ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
                 }`}
               >
                 <Wand2 size={18} /> Generate Metadata
               </button>
             )}

             <button 
               onClick={handleDownloadCSV}
               disabled={totalFiles === 0 || completedCount === 0 || isProcessing}
               className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2"
             >
               <Download size={18} /> Download CSV
             </button>
          </div>
        </aside>

        {/* Right Content */}
        <section className="flex-1 flex flex-col md:overflow-hidden relative order-2 min-h-0 bg-gray-100">
          <div className="p-4 bg-white border-b border-gray-200 shrink-0 flex items-center justify-between sticky top-0 md:static z-10 shadow-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <FolderOutput className="w-5 h-5 text-blue-500" />
              <h2 className="font-bold text-xl tracking-tight">OUTPUT RESULT</h2>
            </div>
          </div>

          <div className="flex-1 p-4 md:overflow-y-auto min-h-[50vh] md:min-h-0">
            {files.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-[300px]">
                <UploadCloud size={64} className="mb-4 opacity-20" />
                <p className="font-medium text-base">No files uploaded yet.</p>
                <p className="text-sm mt-1">Select {settings.selectedFileType}s from the sidebar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20 md:pb-0">
                {files.map(file => (
                  <FileCard 
                    key={file.id} 
                    item={file} 
                    onDelete={handleDelete}
                    onUpdate={handleUpdateMetadata}
                    onRetry={(id) => {
                       setFiles(prev => prev.map(f => f.id === id ? { ...f, status: ProcessingStatus.Pending } : f));
                    }}
                    onPreview={setPreviewItem}
                    language={getLanguage(file.id)}
                    onToggleLanguage={handleToggleLanguage}
                    disabled={isProcessing}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="w-full bg-white border-t border-gray-200 py-3 shrink-0 z-50 flex items-center justify-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <p className="text-sm font-medium text-gray-400">
          © 2025 Isa Rahmat Sobirin. All rights reserved.
        </p>
      </footer>

      <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
};

export default App;
