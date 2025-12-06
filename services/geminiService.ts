
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
            mimeType: file.type,
          },
        });
      } else {
        reject(new Error("Failed to read file"));
      }
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

    // 3. Apply User Settings Overrides
    if (settings.customTitle) {
      systemInstruction += `\n\nIMPORTANT OVERRIDE: The English title MUST include: "${settings.customTitle}"`;
    }
    if (settings.customKeyword) {
      systemInstruction += `\n\nIMPORTANT OVERRIDE: The English keywords MUST include: "${settings.customKeyword}"`;
    }

    if (settings.slideTitle > 0) {
      systemInstruction += `\n- STRICT CONSTRAINT: Title length MUST be approximately ${settings.slideTitle} characters.`;
    }
    
    if (settings.slideKeyword > 0) {
      systemInstruction += `\n- STRICT CONSTRAINT: Generate exactly or close to ${settings.slideKeyword} keywords.`;
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
    } else {
      const mediaPart = await fileToPart(fileItem.file);
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
