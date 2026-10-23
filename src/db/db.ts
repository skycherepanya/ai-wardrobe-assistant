import Dexie, { type EntityTable } from 'dexie';

export type WardrobeCategory =
  | 'Top'
  | 'Bottom'
  | 'Shoes'
  | 'Outerwear'
  | 'Accessory';

export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter' | 'All-Season';

export interface WardrobeItem {
  id: string; // UUID (crypto.randomUUID())
  imageBase64: string; // Compressed data URL (e.g., data:image/jpeg;base64,...)
  category: WardrobeCategory;
  color: string;
  season: Season | string;
  isClean: boolean; // Note: IndexedDB booleans are not natively indexable in all engines, handled via helper queries or 1/0 if needed
  createdAt: number; // Unix epoch timestamp (Date.now())
}

/**
 * Lightweight projection omitting `imageBase64` so we never serialize megabytes
 * of image strings into the Gemini Outfit Generator text prompt.
 */
export type WardrobeItemMetadata = Omit<WardrobeItem, 'imageBase64'>;

export class SardrobeDB extends Dexie {
  wardrobeItems!: EntityTable<WardrobeItem, 'id'>;

  constructor() {
    super('SardrobeDatabase');

    // Define schema and indexed columns.
    // Never index `imageBase64` (large binary/string payload).
    this.version(1).stores({
      wardrobeItems: 'id, category, color, season, isClean, createdAt',
    });
  }
}

export const db = new SardrobeDB();

/**
 * Request persistent storage on iOS Safari / Standalone PWA so WebKit does not
 * evict IndexedDB data under storage pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return true;
    return navigator.storage.persist();
  }
  return false;
}

/**
 * Compress an image File/Blob on an offscreen HTML5 Canvas before storing in IndexedDB.
 * Prevents 12MP+ iOS camera captures from bloating IndexedDB or crashing Safari memory.
 */
export async function compressImageToBase64(
  file: File,
  maxDimension = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height >= width && height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Database helper actions for Wardrobe CRUD operations.
 */
export const wardrobeRepo = {
  async addItem(
    item: Omit<WardrobeItem, 'id' | 'isClean' | 'createdAt'> & {
      isClean?: boolean;
    }
  ): Promise<WardrobeItem> {
    const newItem: WardrobeItem = {
      id: crypto.randomUUID(),
      imageBase64: item.imageBase64,
      category: item.category,
      color: item.color,
      season: item.season,
      isClean: item.isClean ?? true,
      createdAt: Date.now(),
    };
    await db.wardrobeItems.add(newItem);
    return newItem;
  },

  async toggleCleanStatus(id: string, isClean: boolean): Promise<void> {
    await db.wardrobeItems.update(id, { isClean });
  },

  async deleteItem(id: string): Promise<void> {
    await db.wardrobeItems.delete(id);
  },

  async getAllItems(): Promise<WardrobeItem[]> {
    return db.wardrobeItems.orderBy('createdAt').reverse().toArray();
  },

  /**
   * Returns all clean items stripped of `imageBase64` for fast, token-efficient AI prompting.
   */
  async getCleanItemsMetadata(): Promise<WardrobeItemMetadata[]> {
    const allItems = await db.wardrobeItems.toArray();
    return allItems
      .filter((item) => item.isClean === true)
      .map(({ imageBase64: _ignored, ...metadata }) => metadata);
  },

  async getItemsByIds(ids: string[]): Promise<WardrobeItem[]> {
    const items = await db.wardrobeItems.bulkGet(ids);
    return items.filter((item): item is WardrobeItem => item !== undefined);
  },
};
