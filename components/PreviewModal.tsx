
import React from 'react';
import { X } from 'lucide-react';
import { FileItem, FileType } from '../types';

interface Props {
  item: FileItem | null;
  onClose: () => void;
}

const PreviewModal: React.FC<Props> = ({ item, onClose }) => {
  if (!item) return null;

  const isVector = item.type === FileType.Vector;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      {/* 
        Changes:
        - Used inline-flex flex-col to wrap tight around the image.
        - max-w-[90vw] to ensure it fits screen.
        - Image determines width.
      */}
      <div 
        className="relative bg-white rounded-lg shadow-2xl p-3 max-h-[90vh] max-w-[90vw] inline-flex flex-col items-center gap-2 animate-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        
        <button 
          onClick={onClose} 
          className="absolute -top-3 -right-3 md:-top-4 md:-right-4 z-10 p-2 bg-white rounded-full text-gray-800 shadow-md hover:bg-gray-100 transition-colors border border-gray-200"
        >
          <X size={20} />
        </button>

        <div className="overflow-hidden rounded flex items-center justify-center shrink-0">
           {item.file.type.startsWith('video') ? (
             <video 
               src={item.previewUrl} 
               controls 
               className="max-h-[30vh] max-w-full object-contain"
             />
           ) : (
            <img 
              src={item.previewUrl} 
              alt={item.file.name} 
              className={`max-h-[30vh] max-w-full object-contain ${isVector ? 'bg-white' : ''}`} 
            />
           )}
        </div>

        {/* 
          Changes: 
          - w-0 min-w-full hack to force text to match parent width (which matches image).
          - Truncate ensures it cuts off if too long.
        */}
        <div className="text-center border-t border-gray-100 pt-2 w-0 min-w-full">
           <h3 className="text-base font-medium text-gray-700 truncate px-2">{item.file.name}</h3>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
