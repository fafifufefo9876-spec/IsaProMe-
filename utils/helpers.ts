import { Category, FileItem } from "../types";
import { CATEGORIES } from "../constants";

export const generateProjectName = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `Project_${hour}.${minute}_${day}-${month}-${year}`;
};

export const getCategoryName = (id: string, lang: 'ENG' | 'IND'): string => {
  const cat = CATEGORIES.find(c => c.id === id);
  if (!cat) return id;
  return lang === 'ENG' ? cat.en : cat.id_lang;
};

// CSV Export always uses English categories AND English metadata
export const downloadCSV = (files: FileItem[], customFilename?: string): string => {
  const header = ['filename', 'title', 'keywords', 'category'];
  
  const rows = files.map(f => {
    // Escape quotes for CSV
    // CRITICAL: Always use f.metadata.en for CSV output
    const title = `"${f.metadata.en.title.replace(/"/g, '""')}"`;
    const keywords = `"${f.metadata.en.keywords.replace(/"/g, '""')}"`;
    const categoryName = getCategoryName(f.metadata.category, 'ENG'); // Always English
    
    return [
      f.file.name,
      title,
      keywords,
      categoryName
    ].join(',');
  });

  const csvContent = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Default to IsaProMe.csv if empty
  const fileName = customFilename && customFilename.trim() !== '' 
    ? `${customFilename.trim()}.csv` 
    : `IsaProMe.csv`;
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  return fileName;
};

// Helper to extract 3 frames from a video file
export const extractVideoFrames = async (videoFile: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frames: string[] = [];
    const timestamps = [0.1, 0.5, 0.9]; // 10%, 50%, 90%
    let currentStep = 0;

    // Use a temporary URL
    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    // When metadata loads, we know duration
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      // Start seeking for the first frame
      video.currentTime = video.duration * timestamps[0];
    };

    video.onseeked = () => {
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context failed"));
        return;
      }

      // Draw current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Get base64 (jpeg for compression)
      frames.push(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);

      currentStep++;
      if (currentStep < timestamps.length) {
        // Seek next
        video.currentTime = video.duration * timestamps[currentStep];
      } else {
        // Done
        URL.revokeObjectURL(url);
        resolve(frames);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Error loading video"));
    };
  });
};