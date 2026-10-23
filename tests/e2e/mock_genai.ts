/**
 * Genuine In-Memory Mock of @google/genai SDK for E2E Testing Track
 * Provides Type enum and GoogleGenAI client with structured JSON inference.
 */

export const Type = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
} as const;

export class GoogleGenAI {
  apiKey: string;

  constructor(options: { apiKey?: string }) {
    if (!options?.apiKey) {
      throw new Error('API key required to initialize GoogleGenAI');
    }
    this.apiKey = options.apiKey;
  }

  models = {
    generateContent: async (params: {
      model: string;
      contents: any;
      config?: any;
    }): Promise<{ text: string }> => {
      const contentsStr = JSON.stringify(params.contents);

      // 1. Auto-Tagging Request
      if (contentsStr.includes('Analyze this clothing item') || contentsStr.includes('category: string')) {
        return {
          text: JSON.stringify({
            category: 'Top',
            color: 'Navy Blue',
            season: 'Summer',
          }),
        };
      }

      // 2. Outfit Generation Request
      if (contentsStr.includes('Here is my wardrobe') || contentsStr.includes('Suggest a coordinated outfit')) {
        // Extract wardrobe JSON if present to return real matching IDs
        const match = contentsStr.match(/Here is my wardrobe:\s*(\[.*?\])/);
        if (match) {
          try {
            const unescaped = match[1].replace(/\\"/g, '"');
            const items = JSON.parse(unescaped);
            if (Array.isArray(items) && items.length > 0) {
              const top = items.find((i) => i.category === 'Top');
              const bottom = items.find((i) => i.category === 'Bottom');
              const shoes = items.find((i) => i.category === 'Shoes');
              const outerwear = items.find((i) => i.category === 'Outerwear');

              const selectedIds: string[] = [];
              if (top) selectedIds.push(top.id);
              if (bottom) selectedIds.push(bottom.id);
              if (shoes) selectedIds.push(shoes.id);
              if (outerwear && contentsStr.includes('weather')) selectedIds.push(outerwear.id);

              return {
                text: JSON.stringify(selectedIds.length > 0 ? selectedIds : items.slice(0, 3).map((i) => i.id)),
              };
            }
          } catch {
            // fallback
          }
        }

        return {
          text: JSON.stringify(['id-top-1', 'id-bottom-1', 'id-shoes-1']),
        };
      }

      return {
        text: JSON.stringify({}),
      };
    },
  };
}

export default {
  Type,
  GoogleGenAI,
};
