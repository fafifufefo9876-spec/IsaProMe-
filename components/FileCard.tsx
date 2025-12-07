
import React, { useState, useEffect } from 'react';
import { Edit2, Check, RefreshCw, Eye, Trash2, Loader2, Video as VideoIcon, Image as ImageIcon, PenTool, Languages } from 'lucide-react';
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
  const isProcessing = item.status === ProcessingStatus.Processing;
  const isFailed = item.status === ProcessingStatus.Failed;

  // Styling constants
  const labelClass = "text-[10px] font-bold px-1.5 rounded border uppercase inline-flex items-center select-none tracking-wide h-6 w-[70px] justify-center shrink-0";
  const labelClassFull = "text-[10px] font-bold px-1.5 rounded border uppercase inline-flex items-center select-none tracking-wide h-6 w-full justify-center shrink-0";
  const textBaseClass = "w-full text-xs px-2 py-1.5 rounded border transition-colors leading-relaxed block";
  const viewClass = "border-transparent bg-transparent overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200";
  const editClass = "border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none";

  const FileTypeIcon = item.type === FileType.Video ? VideoIcon : item.type === FileType.Vector ? PenTool : ImageIcon;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden relative group hover:shadow-md transition-shadow">
      
      {/* 1. TOP TOOLBAR (Buttons) - EQUAL WIDTH GRID - HORIZONTAL LAYOUT */}
      <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 border-b border-gray-200">
        
        {/* Preview Button */}
        <button 
          onClick={() => onPreview(item)}
          className="flex flex-row items-center justify-center gap-2 py-1.5 rounded border bg-white border-gray-200 text-blue-600 hover:bg-blue-50 transition-colors"
          title="Preview File"
        >
          <Eye size={14} />
          <span className="text-[10px] font-bold uppercase tracking-tight truncate">Preview</span>
        </button>

        {/* Edit Button */}
        <button 
          onClick={toggleEdit} 
          disabled={disabled || !isCompleted}
          className={`flex flex-row items-center justify-center gap-2 py-1.5 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isEditing 
              ? 'bg-green-100 border-green-300 text-green-700' 
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
          title="Edit Metadata"
        >
          {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
          <span className="text-[10px] font-bold uppercase tracking-tight truncate">{isEditing ? 'Save' : 'Edit'}</span>
        </button>

        {/* Language Button */}
        <button 
           onClick={() => !isEditing && onToggleLanguage(item.id)} 
           disabled={isEditing || disabled || !isCompleted}
           className={`flex flex-row items-center justify-center gap-2 py-1.5 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
             language === 'ENG' 
               ? 'bg-blue-50 text-blue-600 border-blue-200' 
               : 'bg-emerald-50 text-emerald-600 border-emerald-200'
           } hover:brightness-95`}
           title="Toggle Language"
        >
           <Languages size={14} />
           <span className="text-[10px] font-bold uppercase tracking-tight truncate">{language}</span>
        </button>

        {/* Delete Button */}
        <button 
          onClick={() => onDelete(item.id)} 
          disabled={disabled}
          className="flex flex-row items-center justify-center gap-2 py-1.5 rounded border bg-white border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete File"
        >
          <Trash2 size={14} />
          <span className="text-[10px] font-bold uppercase tracking-tight truncate">Delete</span>
        </button>
      </div>

      {/* 2. Filename & Status Row - Increased Border Visibility */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-gray-200 mb-1">
         {/* Icon Status */}
         <div className="shrink-0">
            {isProcessing ? (
              <Loader2 className="animate-spin text-blue-500" size={16} />
            ) : isFailed ? (
              <button onClick={() => onRetry(item.id)} title="Retry" className="text-red-500 hover:text-red-700">
                <RefreshCw size={16} />
              </button>
            ) : (
              <FileTypeIcon size={16} className="text-gray-400" />
            )}
         </div>

         {/* Filename */}
         <div className="flex-1 min-w-0">
           <h3 className={`text-sm font-medium truncate ${isFailed ? 'text-red-600' : 'text-gray-700'}`} title={item.file.name}>
             {item.file.name}
           </h3>
         </div>
      </div>

      {/* 3. Metadata Content */}
      <div className="flex flex-col gap-1 px-3 pb-3 flex-1">
           
         {/* TITLE SECTION */}
         <div className="flex gap-2 items-start">
           <span className={`${labelClass} bg-blue-50 text-blue-600 border-blue-200`}>TITLE</span>
           
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
           <span className={`${labelClass} bg-green-50 text-green-600 border-green-200`}>CATEGORY</span>
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
            <div className="h-[5.5rem] w-full relative">
                {isEditing ? (
                  <textarea 
                    value={editKeywords}
                    onChange={(e) => setEditKeywords(e.target.value)}
                    className={`${textBaseClass} ${editClass} h-full`}
                    spellCheck={false}
                  />
                ) : (
                  <div className={`${textBaseClass} ${viewClass} h-full text-gray-500 whitespace-normal break-words`}>
                    {currentKeywords}
                  </div>
                )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default FileCard;
