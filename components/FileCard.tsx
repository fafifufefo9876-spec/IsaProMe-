
import React, { useState, useEffect } from 'react';
import { X, Edit2, Check, RefreshCw, FileText, Eye, Video as VideoIcon } from 'lucide-react';
import { FileItem, Language, ProcessingStatus, FileType } from '../types';
import { CATEGORIES } from '../constants';
import { getCategoryName } from '../utils/helpers';

interface Props {
  item: FileItem;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: 'title' | 'keywords' | 'category', value: string, language: Language) => void; 
  onRetry: (id: string) => void;
  onPreview: (item: FileItem) => void;
  language: Language;
  onToggleLanguage: (id: string) => void; 
  disabled: boolean;
}

const FileCard: React.FC<Props> = ({ 
  item, 
  onDelete, 
  onUpdate, 
  onRetry,
  onPreview,
  language,
  onToggleLanguage,
  disabled 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Local state for editing fields
  const [editTitle, setEditTitle] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editCategory, setEditCategory] = useState('');
  
  // Derive current display values based on active Language
  const currentTitle = language === 'ENG' ? item.metadata.en.title : item.metadata.ind.title;
  const currentKeywords = language === 'ENG' ? item.metadata.en.keywords : item.metadata.ind.keywords;
  const currentCategory = item.metadata.category;

  // Sync local state when entering edit mode or when item/language changes
  useEffect(() => {
    setEditTitle(currentTitle);
    setEditKeywords(currentKeywords);
    setEditCategory(currentCategory);
  }, [item.metadata, language, isEditing]);

  const toggleEdit = () => {
    if (isEditing) {
      // SAVE Logic
      // Trigger update even if no visual change if user wants to force sync/validation logic
      if (editTitle !== currentTitle) {
        onUpdate(item.id, 'title', editTitle, language);
      }
      if (editKeywords !== currentKeywords) {
        onUpdate(item.id, 'keywords', editKeywords, language);
      }
      if (editCategory !== currentCategory) {
        onUpdate(item.id, 'category', editCategory, language);
      }
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const isCompleted = item.status === ProcessingStatus.Completed;
  const isRenderable = !item.file.name.match(/\.(eps|ai|pdf)$/i);

  // Styling constants
  // Label: Fixed width for alignment
  const labelClass = "text-[10px] font-bold px-1.5 rounded border uppercase inline-flex items-center select-none tracking-wide h-6 w-[70px] justify-center shrink-0";
  
  // Custom full width label for keywords
  const labelClassFull = "text-[10px] font-bold px-1.5 rounded border uppercase inline-flex items-center select-none tracking-wide h-6 w-full justify-center shrink-0";

  // Shared text styles for input and display to ensure ZERO movement
  const textBaseClass = "w-full text-xs px-2 py-1.5 rounded border transition-colors leading-relaxed block";
  const viewClass = "border-transparent bg-transparent overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200";
  const editClass = "border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none";

  const buttonClass = "h-7 flex items-center justify-center rounded border transition-colors";

  // LOGIC FOR LIGHTWEIGHT DISPLAY:
  // If we have a 'thumbnail' (extracted frame), use <img> instead of <video>.
  // This saves massive memory/GPU when listing many videos.
  const useImageProxy = !!item.thumbnail || item.type !== FileType.Video;
  const displayUrl = item.thumbnail || item.previewUrl;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden relative group hover:shadow-md transition-shadow">
      
      {/* 16:9 Container */}
      <div className="relative w-full aspect-video bg-gray-100 overflow-hidden border-b border-gray-100 flex items-center justify-center cursor-pointer" onClick={() => onPreview(item)}>
        
        {/* MEDIA RENDERER */}
        {!useImageProxy ? (
           // HEAVY FALLBACK: Only used before processing is done if no thumbnail yet
          <video 
            src={item.previewUrl} 
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata" // Attempt to be lazy
            onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
            onMouseOut={(e) => {
              const video = e.target as HTMLVideoElement;
              video.pause();
              video.currentTime = 0;
            }}
          />
        ) : isRenderable && !imageError ? (
           // LIGHTWEIGHT PROXY: Image tag used for Videos (after processing) and Images
          <img 
            src={displayUrl} 
            alt={item.file.name} 
            className={`w-full h-full object-cover ${item.type === FileType.Vector ? 'bg-white p-4 object-contain' : ''}`}
            onError={() => setImageError(true)}
          />
        ) : (
           // NON-RENDERABLE FALLBACK
          <div className="flex flex-col items-center justify-center text-gray-400 gap-1 p-4">
            <FileText size={32} />
            <span className="text-xs font-mono text-center break-all px-2">{item.file.name.split('.').pop()?.toUpperCase()} FILE</span>
          </div>
        )}

        {/* Video Indicator Overlay (So user knows it is a video even if showing an image) */}
        {item.type === FileType.Video && (
           <div className="absolute bottom-2 right-2 bg-black/60 px-1.5 py-1 rounded flex items-center gap-1 z-10 pointer-events-none">
             <VideoIcon size={10} className="text-white" />
             <span className="text-[10px] font-bold text-white uppercase tracking-wider">Video</span>
           </div>
        )}

        {/* Eye Icon for Preview (All types) */}
        <div className="absolute top-2 left-2 bg-black/60 p-2 rounded-lg pointer-events-none backdrop-blur-sm">
          <Eye className="w-4 h-4 text-white" />
        </div>
        
        {/* Status Overlay */}
        {item.status === ProcessingStatus.Processing && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 pointer-events-none">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
        {item.status === ProcessingStatus.Failed && (
           <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center z-10 pointer-events-none">
             <span className="text-red-600 font-bold text-sm bg-white px-2 py-1 rounded">Failed</span>
           </div>
        )}

        {/* Action Buttons (Delete) */}
        {!disabled && (
          <div className="absolute top-2 right-2 flex gap-1 z-10" onClick={e => e.stopPropagation()}>
            <button onClick={() => onDelete(item.id)} className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 shadow-sm transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col relative pt-1"> 
        
        {/* Header: Filename + Buttons */}
        <div className="px-3 flex items-end gap-2 pt-1 mb-1 min-h-[30px]">
           
           {/* Left Column: Filename & Divider Line */}
           <div className="flex-1 min-w-0 flex flex-col gap-0.5">
             <div className="flex items-center gap-1.5">
               <h3 className="text-sm font-medium text-gray-700 truncate" title={item.file.name}>{item.file.name}</h3>
               {item.status === ProcessingStatus.Failed && !disabled && (
                 <button onClick={() => onRetry(item.id)} className="text-blue-500 hover:text-blue-700 shrink-0">
                   <RefreshCw size={14} />
                 </button>
               )}
             </div>
             {/* Divider stops here */}
             <div className="h-px bg-gray-200 w-full mt-0.5"></div>
           </div>

           {/* Right Column: Buttons (Lang then Edit) */}
           {isCompleted && !disabled && (
            <div className="flex items-center gap-1 shrink-0 mb-0.5">
               <button 
                  onClick={() => !isEditing && onToggleLanguage(item.id)} 
                  disabled={isEditing}
                  className={`${buttonClass} w-9 text-[10px] font-bold uppercase ${
                    language === 'ENG' 
                      ? 'bg-blue-50 text-blue-600 border-blue-200' 
                      : 'bg-green-50 text-green-600 border-green-200'
                  } ${isEditing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
               >
                 {language}
               </button>

               <button 
                 onClick={toggleEdit} 
                 className={`${buttonClass} w-9 bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100`}
                 title="Edit"
               >
                 {isEditing ? <Check size={14} className="text-green-600" /> : <Edit2 size={14} />}
               </button>
            </div>
           )}
        </div>

        {/* Rigid Layout Container - Minimal gaps */}
        <div className="flex flex-col gap-1 px-3 pb-3 flex-1">
           
           {/* TITLE SECTION */}
           <div className="flex gap-2 items-start">
             <span className={`${labelClass} bg-blue-50 text-blue-600 border-blue-200`}>TITLE</span>
             
             {/* Fixed height to prevent layout shift, scrollable if long */}
             <div className="h-8 w-full relative">
                {isEditing ? (
                   <textarea 
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={`${textBaseClass} ${editClass} h-full`}
                      spellCheck={false}
                   />
                ) : (
                   <div className={`${textBaseClass} ${viewClass} h-full font-medium text-gray-800`}>
                     {currentTitle}
                   </div>
                )}
             </div>
           </div>
           
           {/* CATEGORY SECTION */}
           <div className="flex gap-2 items-center">
             <span className={`${labelClass} bg-green-50 text-green-600 border-green-200`}>CAT</span>
             <div className="h-6 w-full relative">
                {isEditing ? (
                   <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className={`${textBaseClass} ${editClass} h-full py-0 pl-1`}
                   >
                     <option value="" disabled></option>
                     {CATEGORIES.map(cat => (
                       <option key={cat.id} value={cat.id}>
                         {language === 'ENG' ? cat.en : cat.id_lang}
                       </option>
                     ))}
                   </select>
                ) : (
                   <div className={`${textBaseClass} ${viewClass} h-full flex items-center text-gray-600 !py-0`}>
                     {item.metadata.category ? getCategoryName(item.metadata.category, language) : ""}
                   </div>
                )}
             </div>
           </div>

           {/* KEYWORDS SECTION */}
           <div className="flex flex-col gap-1 flex-1">
              <span className={`${labelClassFull} bg-violet-50 text-violet-600 border-violet-200`}>KEYWORDS</span>
              {/* Increased height to h-[5.5rem] (h-22 equiv) */}
              <div className="h-[5.5rem] w-full relative">
                  {isEditing ? (
                    <textarea 
                      value={editKeywords}
                      onChange={(e) => setEditKeywords(e.target.value)}
                      className={`${textBaseClass} ${editClass} h-full`}
                      spellCheck={false}
                    />
                  ) : (
                    <div className={`${textBaseClass} ${viewClass} h-full text-gray-500`}>
                      {currentKeywords}
                    </div>
                  )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default FileCard;
