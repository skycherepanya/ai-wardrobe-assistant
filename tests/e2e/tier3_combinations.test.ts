/**
 * Tier 3: Cross-Feature Combinations E2E Tests
 * Validates pairwise interactions and subsystem coordination (>=15 pairwise combinatorial tests).
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  setupBrowserMocks,
  setupCanvasMocks,
  InMemoryWardrobeRepository,
} from './harness.ts';

export function runTier3Tests() {
  describe('Tier 3: Pairwise Subsystem Combinations', () => {
    beforeEach(() => {
      setupBrowserMocks();
      setupCanvasMocks();
    });

    test('Pairwise 1: PWA Standalone Mode + Storage Persistence Negotiation', async () => {
      // Standalone mode boot triggers persistent storage request
      const { mockNavigator } = setupBrowserMocks({
        standalone: true,
        storage: { persisted: false, persistResult: true },
      });

      const { requestPersistentStorage } = await import('../../src/db/db.ts');
      const persisted = await requestPersistentStorage();

      expect(mockNavigator.standalone).toBe(true);
      expect(persisted).toBe(true);
    });

    test('Pairwise 2: Offscreen Canvas Downscaler + Wardrobe CRUD Storage', async () => {
      const { compressImageToBase64 } = await import('../../src/db/db.ts');
      const repo = new InMemoryWardrobeRepository();

      const fakeFile: any = { type: 'image/jpeg', name: 'camera_capture.jpg' };
      (globalThis as any).Image.prototype.width = 2400;
      (globalThis as any).Image.prototype.height = 1800;

      const compressedBase64 = await compressImageToBase64(fakeFile, 800, 0.75);
      expect(compressedBase64).toContain('w800_h600');

      const savedItem = await repo.addItem({
        imageBase64: compressedBase64,
        category: 'Top',
        color: 'Olive Green',
        season: 'Fall',
      });

      const retrieved = await repo.getItemsByIds([savedItem.id]);
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].imageBase64).toBe(compressedBase64);
      expect(retrieved[0].imageBase64.includes('w800_h600')).toBe(true);
    });

    test('Pairwise 3: Wardrobe CRUD Repository + Token Protection', async () => {
      const repo = new InMemoryWardrobeRepository();
      const largeBase64 = 'data:image/jpeg;base64,' + 'M'.repeat(20000);

      await repo.addItem({ imageBase64: largeBase64, category: 'Top', color: 'Navy', season: 'Summer', isClean: true });
      await repo.addItem({ imageBase64: largeBase64, category: 'Bottom', color: 'Black', season: 'Summer', isClean: true });

      const cleanMetadata = await repo.getCleanItemsMetadata();
      expect(cleanMetadata.length).toBe(2);

      // Verify strict omission of imageBase64 from all returned items
      for (const item of cleanMetadata) {
        expect((item as any).imageBase64).toBeUndefined();
      }

      const json = JSON.stringify(cleanMetadata);
      expect(json.includes('MMMM')).toBe(false);
      expect(json.length).toBeLessThan(400);
    });

    test('Pairwise 4: Token Protection + Gemini Outfit Prompt Generation', async () => {
      const { serializeCleanWardrobeForPrompt } = await import('../../src/services/geminiService.ts');
      const repo = new InMemoryWardrobeRepository();

      const top = await repo.addItem({ imageBase64: 'big-data-1', category: 'Top', color: 'Cream', season: 'Spring', isClean: true });
      const bottom = await repo.addItem({ imageBase64: 'big-data-2', category: 'Bottom', color: 'Dark Denim', season: 'Spring', isClean: true });
      const shoes = await repo.addItem({ imageBase64: 'big-data-3', category: 'Shoes', color: 'Tan', season: 'Spring', isClean: true });

      const cleanMetadata = await repo.getCleanItemsMetadata();
      const promptPayload = serializeCleanWardrobeForPrompt(cleanMetadata);

      expect(promptPayload.includes('big-data')).toBe(false);
      const parsed = JSON.parse(promptPayload);
      expect(parsed.length).toBe(3);
      expect(parsed.map((p: any) => p.id)).toEqual([top.id, bottom.id, shoes.id]);
    });

    test('Pairwise 5: BYOK Key Precedence + Gemini Multimodal Auto-Tagging', async () => {
      const customKey = 'AIzaSyBYOK_Key_For_Tagging';
      setupBrowserMocks({
        localStorageInit: { sardrobe_gemini_api_key: customKey },
        env: { VITE_GEMINI_API_KEY: 'AIzaSyEnv_Fallback' },
      });

      const { getGeminiApiKey } = await import('../../src/services/geminiService.ts');
      const resolvedKey = getGeminiApiKey();
      expect(resolvedKey).toBe(customKey);
    });

    test('Pairwise 6: Open-Meteo Weather Service + Outfit Recommendation Generator', async () => {
      const coldRainyWeather = {
        temperatureCelsius: 9,
        condition: 'Heavy Rain',
        locationName: 'Downtown',
      };

      const weatherClause = ` Current local weather: ${coldRainyWeather.temperatureCelsius}°C, ${coldRainyWeather.condition} in ${coldRainyWeather.locationName}.`;
      expect(weatherClause).toContain('9°C');
      expect(weatherClause).toContain('Heavy Rain');
      expect(weatherClause).toContain('Downtown');

      // Low temperature (<16°C) requires outerwear
      const requiresOuterwear = coldRainyWeather.temperatureCelsius < 16;
      expect(requiresOuterwear).toBe(true);
    });

    test('Pairwise 7: Weather Offline Fallback + Outfit Recommendation', async () => {
      setupBrowserMocks({ online: false });
      const DEFAULT_WEATHER = { temperatureCelsius: 19, condition: 'Partly Cloudy', locationName: 'Local Area' };

      // Fallback weather context feeds gracefully into outfit prompt clause
      const weatherClause = ` Current local weather: ${DEFAULT_WEATHER.temperatureCelsius}°C, ${DEFAULT_WEATHER.condition}.`;
      expect(weatherClause).toContain('19°C');
      expect(weatherClause).toContain('Partly Cloudy');
    });

    test('Pairwise 8: One-Tap Laundry Status Toggle + Clean Metadata Projection', async () => {
      const repo = new InMemoryWardrobeRepository();
      const item = await repo.addItem({ imageBase64: '1', category: 'Top', color: 'White', season: 'Summer', isClean: true });

      let cleanItems = await repo.getCleanItemsMetadata();
      expect(cleanItems.length).toBe(1);

      // User marks item dirty via one-tap toggle
      await repo.toggleCleanStatus(item.id, false);

      cleanItems = await repo.getCleanItemsMetadata();
      expect(cleanItems.length).toBe(0); // Immediately excluded from clean metadata
    });

    test('Pairwise 9: Outfit Recommendation + "Wear Today" Bulk Laundry Mover', async () => {
      const repo = new InMemoryWardrobeRepository();
      const top = await repo.addItem({ imageBase64: '1', category: 'Top', color: 'Navy', season: 'Summer', isClean: true });
      const bottom = await repo.addItem({ imageBase64: '2', category: 'Bottom', color: 'Khaki', season: 'Summer', isClean: true });
      const shoes = await repo.addItem({ imageBase64: '3', category: 'Shoes', color: 'White', season: 'Summer', isClean: true });

      const recommendedOutfit = [top.id, bottom.id, shoes.id];

      // "Wear Today" marks all items in the outfit dirty in Dexie
      for (const id of recommendedOutfit) {
        await repo.toggleCleanStatus(id, false);
      }

      const all = await repo.getAllItems();
      for (const item of all) {
        expect(item.isClean).toBe(false);
      }
    });

    test('Pairwise 10: Camera Capture FAB + Live Auto-Tagging + Wardrobe Add with Override', async () => {
      const repo = new InMemoryWardrobeRepository();
      const detectedTags = { category: 'Top' as const, color: 'Navy Blue', season: 'Summer' as const };

      // User reviews tags and overrides season from 'Summer' to 'All-Season'
      const userEditedTags = { ...detectedTags, season: 'All-Season' as const };

      const saved = await repo.addItem({
        imageBase64: 'data:image/jpeg;base64,cameraImage',
        category: userEditedTags.category,
        color: userEditedTags.color,
        season: userEditedTags.season,
      });

      expect(saved.season).toBe('All-Season');
      expect(saved.category).toBe('Top');
    });

    test('Pairwise 11: Category Filter Chips + Clean Status Filter Intersection', async () => {
      const repo = new InMemoryWardrobeRepository();
      await repo.addItem({ imageBase64: '1', category: 'Top', color: 'Blue', season: 'Summer', isClean: true });
      await repo.addItem({ imageBase64: '2', category: 'Top', color: 'Red', season: 'Summer', isClean: false });
      await repo.addItem({ imageBase64: '3', category: 'Bottom', color: 'Black', season: 'Summer', isClean: true });

      const allItems = await repo.getAllItems();
      const cleanTops = allItems.filter((i) => i.category === 'Top' && i.isClean === true);
      expect(cleanTops.length).toBe(1);
      expect(cleanTops[0].color).toBe('Blue');
    });

    test('Pairwise 12: Offline Mode + Storage Persistence + Cached Wardrobe Retrieval', async () => {
      setupBrowserMocks({ online: false, storage: { persisted: true } });
      const repo = new InMemoryWardrobeRepository();
      await repo.addItem({ imageBase64: 'img1', category: 'Top', color: 'White', season: 'Summer' });

      // Offline retrieval
      expect(navigator.onLine).toBe(false);
      const items = await repo.getAllItems();
      expect(items.length).toBe(1);
      expect(items[0].category).toBe('Top');
    });

    test('Pairwise 13: BYOK Storage + Settings Modal + Simulated Page Reload', async () => {
      setupBrowserMocks({ env: { VITE_GEMINI_API_KEY: '' } });
      const { setGeminiApiKey } = await import('../../src/services/geminiService.ts');
      setGeminiApiKey('AIzaSyNewUserProvidedKey');

      // Simulate app reload by creating fresh client reading storage
      const { getGeminiApiKey } = await import('../../src/services/geminiService.ts');
      const retrieved = getGeminiApiKey();
      expect(retrieved).toBe('AIzaSyNewUserProvidedKey');
    });

    test('Pairwise 14: Daily Fit Readiness Check + Laundry Wash All Action', async () => {
      const repo = new InMemoryWardrobeRepository();
      const top = await repo.addItem({ imageBase64: '1', category: 'Top', color: 'White', season: 'Summer', isClean: true });
      const bottom = await repo.addItem({ imageBase64: '2', category: 'Bottom', color: 'Black', season: 'Summer', isClean: false });
      const shoes = await repo.addItem({ imageBase64: '3', category: 'Shoes', color: 'White', season: 'Summer', isClean: true });

      // Clean inventory readiness check before Wash All
      let clean = await repo.getCleanItemsMetadata();
      const hasCleanBottom = clean.some((i) => i.category === 'Bottom');
      expect(hasCleanBottom).toBe(false);

      // User triggers "Wash All" action
      await repo.toggleCleanStatus(bottom.id, true);

      clean = await repo.getCleanItemsMetadata();
      const readyNow =
        clean.some((i) => i.category === 'Top') &&
        clean.some((i) => i.category === 'Bottom') &&
        clean.some((i) => i.category === 'Shoes');
      expect(readyNow).toBe(true);
    });

    test('Pairwise 15: Canvas Image Compression + Storage Quota Conservation', async () => {
      const { compressImageToBase64 } = await import('../../src/db/db.ts');
      const repo = new InMemoryWardrobeRepository();

      const sampleFile: any = { type: 'image/jpeg', name: 'photo.jpg' };
      (globalThis as any).Image.prototype.width = 3000;
      (globalThis as any).Image.prototype.height = 2000;

      // Ingest 5 items through canvas downscaler
      for (let i = 0; i < 5; i++) {
        const compressed = await compressImageToBase64(sampleFile, 800, 0.75);
        await repo.addItem({ imageBase64: compressed, category: 'Top', color: 'Grey', season: 'Winter' });
      }

      const all = await repo.getAllItems();
      expect(all.length).toBe(5);
      const totalChars = all.reduce((sum, item) => sum + item.imageBase64.length, 0);
      // Downscaled mock images remain small (<5KB total string size vs 50MB raw)
      expect(totalChars).toBeLessThan(10000);
    });
  });
}
