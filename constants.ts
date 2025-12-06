
import { Category, FileMetadata } from './types';

export const CATEGORIES: Category[] = [
  { id: '1', en: 'Animals', id_lang: 'Hewan' },
  { id: '2', en: 'Buildings and Architecture', id_lang: 'Bangunan & Arsitektur' },
  { id: '3', en: 'Business', id_lang: 'Bisnis' },
  { id: '4', en: 'Drinks', id_lang: 'Minuman' },
  { id: '5', en: 'The Environment', id_lang: 'Lingkungan' },
  { id: '6', en: 'States of Mind', id_lang: 'Perasaan & Emosi' },
  { id: '7', en: 'Food', id_lang: 'Makanan' },
  { id: '8', en: 'Graphic Resources', id_lang: 'Sumber Grafis' },
  { id: '9', en: 'Hobbies and Leisure', id_lang: 'Hobi & Liburan' },
  { id: '10', en: 'Industry', id_lang: 'Industri' },
  { id: '11', en: 'Landscapes', id_lang: 'Pemandangan' },
  { id: '12', en: 'Lifestyle', id_lang: 'Gaya Hidup' },
  { id: '13', en: 'People', id_lang: 'Orang' },
  { id: '14', en: 'Plants and Flowers', id_lang: 'Tanaman & Bunga' },
  { id: '15', en: 'Culture and Religion', id_lang: 'Budaya & Agama' },
  { id: '16', en: 'Science', id_lang: 'Sains' },
  { id: '17', en: 'Social Issues', id_lang: 'Isu Sosial' },
  { id: '18', en: 'Sports', id_lang: 'Olahraga' },
  { id: '19', en: 'Technology', id_lang: 'Teknologi' },
  { id: '20', en: 'Transport', id_lang: 'Transportasi' },
  { id: '21', en: 'Travel', id_lang: 'Wisata' },
];

export const INITIAL_METADATA: FileMetadata = {
  en: { title: '', keywords: '' },
  ind: { title: '', keywords: '' },
  category: '',
};

export const DEFAULT_PROMPT_TEMPLATE = `
You are an expert Adobe Stock contributor assistant. Your task is to generate metadata in TWO LANGUAGES (English and Indonesian).

STRICT RULES FOR TITLE:
1.  **Format:** [Subject] + [Action/Context] + [Environment/Style].
2.  **Buyer Focused:** Describe exactly what is seen. No emotions, no opinions.
3.  **Forbidden:** Do NOT use brand names, public figures, or tech specs (4K, HD).
4.  **Style:** Concise, professional (Max 100 chars).

STRICT RULES FOR KEYWORDS:
1.  **Hierarchy:** The first 10 keywords MUST be the most relevant.
2.  **Quantity:** Generate at least 25 keywords.
3.  **Content:** Specific visual elements, themes, and style.

STRICT RULES FOR CATEGORY:
1.  Select the MOST relevant category ID from the provided list.

IMPORTANT:
- Generate "en" (English) version first.
- Generate "ind" (Indonesian) version which is a professional translation of the English version.

JSON OUTPUT FORMAT ONLY:
{
  "en": {
    "title": "String (English)",
    "keywords": "String (English, comma separated)"
  },
  "ind": {
    "title": "String (Bahasa Indonesia)",
    "keywords": "String (Bahasa Indonesia, comma separated)"
  },
  "category": "String (ID only)"
}
`;
