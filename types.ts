
export enum FileType {
  Image = 'Image',
  Video = 'Video',
  Vector = 'Vector',
}

export enum ProcessingStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export interface LocalizedContent {
  title: string;
  keywords: string;
}

export interface FileMetadata {
  en: LocalizedContent;
  ind: LocalizedContent;
  category: string; // ID of the category (Global)
}

export interface FileItem {
  id: string;
  file: File;
  previewUrl: string; // For images: blob url. For video: blob url of the middle frame.
  thumbnail?: string; // NEW: Lightweight base64 image for UI display (proxy for heavy video)
  extractedFrames?: string[]; // Specifically for video: [start, middle, end] base64 strings
  type: FileType;
  status: ProcessingStatus;
  metadata: FileMetadata;
  error?: string;
}

export interface Category {
  id: string;
  en: string;
  id_lang: string; // 'id' is reserved in some contexts, using id_lang for Indonesian label
}

export interface AppSettings {
  customTitle: string;
  customKeyword: string;
  slideTitle: number; // Target character length (0-200)
  slideKeyword: number; // Target keyword count (0-50)
  selectedFileType: FileType;
  csvFilename: string;
}

export type Language = 'ENG' | 'IND';
