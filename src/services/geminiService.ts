import { GoogleGenAI, Type } from '@google/genai';
import type {
  Season,
  WardrobeCategory,
  WardrobeItem,
  WardrobeItemMetadata,
} from '../db/db';

const MODEL_NAME = 'gemini-2.5-flash';
const API_KEY_STORAGE_KEY = 'sardrobe_gemini_api_key';

export interface AutoTagResult {
  category: WardrobeCategory;
  color: string;
  season: Season | string;
}

export interface WeatherContext {
  temperatureCelsius: number;
  condition: string; // e.g., "Rainy", "Clear", "Chilly wind"
  locationName?: string;
}

/**
 * Resolves the Gemini API key from localStorage (BYOK pattern for zero-backend PWAs)
 * or falls back to the Vite environment variable `VITE_GEMINI_API_KEY`.
 */
export function getGeminiApiKey(): string {
  const storedKey =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(API_KEY_STORAGE_KEY)
      : null;
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const apiKey = storedKey?.trim() || envKey?.trim();

  if (!apiKey) {
    throw new Error(
      'Missing Gemini API Key. Set VITE_GEMINI_API_KEY in .env.local or configure your key in Settings.'
    );
  }
  return apiKey;
}

export function setGeminiApiKey(apiKey: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
  }
}

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

/**
 * Strips an optional `data:image/...;base64,` prefix and extracts the MIME type and raw base64 payload.
 */
function parseBase64DataUrl(imageBase64: string): {
  mimeType: string;
  data: string;
} {
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }
  return {
    mimeType: 'image/jpeg',
    data: imageBase64,
  };
}

/**
 * Safely parses JSON even if a model wraps output in markdown code fences.
 */
function parseJsonSafely<T>(rawText: string): T {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

/**
 * 1. Auto-Tagging Function
 * Analyzes a base64-encoded clothing image using `gemini-2.5-flash` and returns
 * `{ category, color, season }`.
 */
export async function analyzeClothingImage(
  imageBase64: string
): Promise<AutoTagResult> {
  const ai = getGenAIClient();
  const { mimeType, data } = parseBase64DataUrl(imageBase64);

  const prompt =
    'Analyze this clothing item. Return ONLY a valid JSON object: { category: string, color: string, season: string }.';

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessory'],
            description: 'Primary wardrobe category of the clothing item.',
          },
          color: {
            type: Type.STRING,
            description: 'Dominant color(s) of the item (e.g., Navy Blue, Olive Green).',
          },
          season: {
            type: Type.STRING,
            enum: ['Spring', 'Summer', 'Fall', 'Winter', 'All-Season'],
            description: 'Best suited season for wearing this item.',
          },
        },
        required: ['category', 'color', 'season'],
      },
      temperature: 0.1,
    },
  });

  if (!response.text) {
    throw new Error('Gemini returned an empty response while analyzing the clothing image.');
  }

  return parseJsonSafely<AutoTagResult>(response.text);
}

/**
 * Helper to sanitize a JSON string or array of clean wardrobe items so `imageBase64`
 * is never sent to Gemini's text context window.
 */
export function serializeCleanWardrobeForPrompt(
  cleanItems: Array<WardrobeItem | WardrobeItemMetadata>
): string {
  const lightweightItems = cleanItems.map((item) => ({
    id: item.id,
    category: item.category,
    color: item.color,
    season: item.season,
  }));
  return JSON.stringify(lightweightItems);
}

/**
 * 2. Outfit Generator Function
 * Takes a JSON string of all `isClean == true` items (and optional weather context)
 * and returns an array of selected item IDs (1 Top, 1 Bottom, 1 Shoes, optional Outerwear).
 */
export async function generateDailyOutfit(
  cleanWardrobeJson: string,
  weather?: WeatherContext
): Promise<string[]> {
  const ai = getGenAIClient();

  // Defensive check: if caller passed raw WardrobeItem[] JSON containing `imageBase64`, strip it first
  let sanitizedJson = cleanWardrobeJson;
  try {
    const parsed = JSON.parse(cleanWardrobeJson);
    if (Array.isArray(parsed)) {
      sanitizedJson = serializeCleanWardrobeForPrompt(parsed);
    }
  } catch {
    // Keep original string if not valid JSON array
  }

  const weatherClause = weather
    ? ` Current local weather: ${weather.temperatureCelsius}°C, ${weather.condition}${
        weather.locationName ? ` in ${weather.locationName}` : ''
      }.`
    : '';

  const prompt = `Here is my wardrobe: ${sanitizedJson}. Suggest a coordinated outfit for today.${weatherClause} Return ONLY a valid JSON array of item IDs (1 Top, 1 Bottom, 1 Shoes, optional Outerwear).`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        description:
          'Array of wardrobe item UUIDs forming a coordinated outfit (1 Top, 1 Bottom, 1 Shoes, optional Outerwear).',
        items: {
          type: Type.STRING,
        },
      },
      temperature: 0.4,
    },
  });

  if (!response.text) {
    throw new Error('Gemini returned an empty response while generating an outfit.');
  }

  const itemIds = parseJsonSafely<string[]>(response.text);
  if (!Array.isArray(itemIds)) {
    throw new Error('Invalid outfit format returned by Gemini: expected a JSON array of IDs.');
  }

  return itemIds;
}
