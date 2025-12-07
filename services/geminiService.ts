
import { GoogleGenAI, Type } from "@google/genai";
import { AppSettings, FileItem, FileMetadata, FileType, Language } from "../types";
import { DEFAULT_PROMPT_TEMPLATE, CATEGORIES } from "../constants";
import { extractVideoFrames } from "../utils/helpers";

// Helper to convert file to base64
const fileToPart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        const base64String = (reader.result as string).split(',')[1];
        resolve({
          inlineData: {
            data: base64String,
            mimeType: file.type || 'application/octet-stream', // Fallback for AI/EPS
          },
        });
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.readAsDataURL(file);
  });
};

// Helper to convert SVG to JPEG with WHITE BACKGROUND
// This "tricks" the AI into seeing a solid image instead of transparency
const convertSvgToWhiteBgJpeg = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Canvas context failed"));
          return;
        }

        // 1. Fill with WHITE background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw SVG on top
        ctx.drawImage(img, 0, 0);

        // 3. Export as JPEG (no transparency)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64String = dataUrl.split(',')[1];
        
        resolve({
          inlineData: {
            data: base64String,
            mimeType: 'image/jpeg', 
          },
        });
      };
      img.onerror = () => reject(new Error("Failed to load SVG image"));
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// Define return type to include thumbnail
interface GenerationResult {
  metadata: FileMetadata;
  thumbnail?: string;
}

export const generateMetadataForFile = async (
  fileItem: FileItem,
  settings: AppSettings,
  apiKey: string
): Promise<GenerationResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Construct Base Prompt from Template
    let systemInstruction = DEFAULT_PROMPT_TEMPLATE;

    // 2. Inject Category List to help the AI choose correctly
    const categoryListString = CATEGORIES.map(c => `ID: "${c.id}" = ${c.en}`).join('\n');
    systemInstruction += `\n\nAVAILABLE CATEGORIES (Pick one ID):\n${categoryListString}`;

    // 3. Apply User Settings Overrides with STRICT PRIORITY
    if (settings.customTitle) {
      systemInstruction += `\n\nCRITICAL PRIORITY: The English title MUST contain the phrase: "${settings.customTitle}". Ensure it is the main subject.`;
    }
    if (settings.customKeyword) {
      systemInstruction += `\n\nCRITICAL PRIORITY: The English keywords list MUST include: "${settings.customKeyword}" in the first 5 keywords.`;
    }

    if (settings.slideTitle > 0) {
      systemInstruction += `\n- STRICT CONSTRAINT: Title length MUST be EXACTLY or VERY CLOSE to ${settings.slideTitle} characters. Do not deviate significantly.`;
    }
    
    if (settings.slideKeyword > 0) {
      systemInstruction += `\n- STRICT CONSTRAINT: You MUST generate EXACTLY ${settings.slideKeyword} keywords. Count them carefully.`;
    }

    // --- VECTOR SPECIFIC LOGIC ---
    if (fileItem.type === FileType.Vector) {
       systemInstruction += `
       
       \n=== VECTOR/ILLUSTRATION SPECIFIC RULES ===
       Since this is a Vector/Illustration file, you MUST follow these specific analysis rules:

       1. VISUAL ANALYSIS:
          - Identify main shapes (icon, shape, pattern, silhouette, badge, ornament).
          - Analyze line details (thick, thin, stroke, outline).
          - Analyze dominant colors and color style.

       2. STYLE IDENTIFICATION:
          - Detect the design style: flat design, minimalist, outline, 3D vector, retro, geometric, cartoon, or isometric.
          - Context: business, education, environment, holiday, object, abstract, background, pattern, etc.

       3. NEGATIVE PROMPT (STRICTLY FORBIDDEN):
          - You are STRICTLY FORBIDDEN from using the following terms in Title or Keywords:
            "white background", "transparent background", "isolated", "png", "background white", "no shadow background", "watermark", "clipart".
          - Do NOT describe the file format (e.g., "vector file", "eps", "svg"), describe the visual content only.
          - Ignore the white background if seen; focus on the object.
       `;
    }

    // 4. Prepare contents
    let parts: any[] = [];
    let promptText = "Analyze this asset and generate commercial metadata in English and Indonesian.";
    let generatedThumbnail: string | undefined = undefined;

    if (fileItem.type === FileType.Video) {
      // THIS IS THE HEAVY LIFTING (Happens in Worker)
      const frames = await extractVideoFrames(fileItem.file);
      
      // Save the first frame as the thumbnail for the UI "Trick"
      // This allows us to replace the <video> tag with an <img> tag in the UI
      generatedThumbnail = `data:image/jpeg;base64,${frames[0]}`;

      promptText = "Analyze these 3 frames (Start, Middle, End) from a video footage. Describe the action and motion.";
      parts = [
        { inlineData: { mimeType: 'image/jpeg', data: frames[0] } },
        { inlineData: { mimeType: 'image/jpeg', data: frames[1] } },
        { inlineData: { mimeType: 'image/jpeg', data: frames[2] } },
        { text: promptText }
      ];
    } else if (fileItem.type === FileType.Vector && fileItem.file.type === 'image/svg+xml') {
      // SPECIAL HANDLING FOR SVG: Convert to JPEG with White Background
      const mediaPart = await convertSvgToWhiteBgJpeg(fileItem.file);
      
      promptText = "Analyze this Vector/Illustration. Focus on the concept, design style (flat, isometric, etc), and visual elements. Do NOT mention background details.";
      parts = [mediaPart, { text: promptText }];

    } else {
      // DEFAULT HANDLING (Images, PDF, or non-SVG Vectors like AI/EPS if browser allows upload)
      const mediaPart = await fileToPart(fileItem.file);
      
      if (fileItem.type === FileType.Vector) {
         promptText = "Analyze this Vector/Illustration. Focus on the concept, design style (flat, isometric, etc), and visual elements. Do NOT mention background details.";
      }

      parts = [mediaPart, { text: promptText }];
    }
    
    // 5. Call API with 2.5 Flash
    const apiCall = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            en: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                keywords: { type: Type.STRING }
              },
              required: ["title", "keywords"]
            },
            ind: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                keywords: { type: Type.STRING }
              },
              required: ["title", "keywords"]
            },
            category: { type: Type.STRING }
          },
          required: ["en", "ind", "category"]
        }
      }
    });

    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Request timed out (60s limit)")), 60000)
    );

    const response: any = await Promise.race([apiCall, timeout]);

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");

    const parsed = JSON.parse(jsonText);
    const validCategory = CATEGORIES.find(c => c.id === parsed.category) ? parsed.category : '8';

    return {
      metadata: {
        en: {
          title: parsed.en?.title || "",
          keywords: parsed.en?.keywords || ""
        },
        ind: {
          title: parsed.ind?.title || "",
          keywords: parsed.ind?.keywords || ""
        },
        category: validCategory,
      },
      thumbnail: generatedThumbnail
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

// --- SYNC TRANSLATION SERVICE ---
// Used when user edits one language, to sync the other.
export const translateMetadataContent = async (
  content: { title: string; keywords: string },
  sourceLang: Language, // 'ENG' or 'IND'
  apiKey: string
): Promise<{ title: string; keywords: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const targetLangFull = sourceLang === 'ENG' ? "Indonesian" : "English";
    const sourceLangFull = sourceLang === 'ENG' ? "English" : "Indonesian";

    const prompt = `
      Translate the following metadata from ${sourceLangFull} to ${targetLangFull}.
      Maintain professional stock photography metadata style.
      
      Title: ${content.title}
      Keywords: ${content.keywords}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            keywords: { type: Type.STRING }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    return {
      title: json.title || content.title, // Fallback to original if fail
      keywords: json.keywords || content.keywords
    };
  } catch (e) {
    console.error("Translation Sync Failed", e);
    return content; // Return original if error (fail safe)
  }
};
