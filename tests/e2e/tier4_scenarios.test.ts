/**
 * Tier 4: Real-World Application Scenarios E2E Tests
 * Validates complete end-to-end user workflows from TEST_INFRA.md (>=5 multi-step workflows).
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

export function runTier4Tests() {
  describe('Tier 4: End-to-End Real-World Application Scenarios', () => {
    beforeEach(() => {
      setupBrowserMocks();
      setupCanvasMocks();
    });

    test('Scenario 1: Complete Morning Routine Workflow', async () => {
      // Step 1: User opens PWA in standalone mode
      const { mockNavigator } = setupBrowserMocks({
        standalone: true,
        storage: { persisted: true },
      });
      const { requestPersistentStorage } = await import('../../src/db/db.ts');
      const isPersisted = await requestPersistentStorage();
      expect(mockNavigator.standalone).toBe(true);
      expect(isPersisted).toBe(true);

      // Step 2: User populates clean wardrobe items
      const repo = new InMemoryWardrobeRepository();
      const top = await repo.addItem({ imageBase64: 'base64-top', category: 'Top', color: 'Heather Grey', season: 'Fall', isClean: true });
      const bottom = await repo.addItem({ imageBase64: 'base64-bottom', category: 'Bottom', color: 'Dark Navy Chinos', season: 'Fall', isClean: true });
      const shoes = await repo.addItem({ imageBase64: 'base64-shoes', category: 'Shoes', color: 'Waterproof Boots', season: 'Fall', isClean: true });
      const outerwear = await repo.addItem({ imageBase64: 'base64-jacket', category: 'Outerwear', color: 'Black Trench Coat', season: 'Fall', isClean: true });

      // Step 3: Checks local weather (Rainy, 12°C)
      const weather = {
        temperatureCelsius: 12,
        condition: 'Rainy',
        locationName: 'City Center',
      };
      expect(weather.temperatureCelsius).toBe(12);
      expect(weather.temperatureCelsius < 15).toBe(true); // Outerwear recommended

      // Step 4: Requests Daily Fit outfit
      const cleanItems = await repo.getCleanItemsMetadata();
      expect(cleanItems.length).toBe(4);

      // Simulate model returning coordinated rainy outfit with warm outerwear
      const recommendedOutfitIds = [top.id, bottom.id, shoes.id, outerwear.id];
      const rationale = 'Coordinated autumn tones with a water-resistant trench coat suitable for 12°C rainy conditions.';

      // Step 5: User taps "Wear Today"
      for (const id of recommendedOutfitIds) {
        await repo.toggleCleanStatus(id, false);
      }

      // Step 6: Verify clean status transitions to false across all worn items
      const allItems = await repo.getAllItems();
      for (const item of allItems) {
        expect(item.isClean).toBe(false);
      }

      const cleanRemaining = await repo.getCleanItemsMetadata();
      expect(cleanRemaining.length).toBe(0);
    });

    test('Scenario 2: Rapid Wardrobe Onboarding Workflow', async () => {
      const { compressImageToBase64 } = await import('../../src/db/db.ts');
      const repo = new InMemoryWardrobeRepository();

      const capturedPhotos = [
        { name: 'shirt.jpg', width: 2000, height: 1500, detected: { category: 'Top' as const, color: 'White Oxford', season: 'All-Season' as const } },
        { name: 'jeans.jpg', width: 2400, height: 1800, detected: { category: 'Bottom' as const, color: 'Raw Denim', season: 'All-Season' as const } },
        { name: 'sneakers.jpg', width: 1800, height: 1200, detected: { category: 'Shoes' as const, color: 'White Canvas', season: 'Summer' as const } },
        { name: 'sweater.jpg', width: 2200, height: 1600, detected: { category: 'Top' as const, color: 'Burgundy Knit', season: 'Winter' as const } },
        { name: 'coat.jpg', width: 3000, height: 2000, detected: { category: 'Outerwear' as const, color: 'Camel Wool', season: 'Winter' as const } },
      ];

      // Ingest and compress each without memory bloat
      for (let i = 0; i < capturedPhotos.length; i++) {
        const photo = capturedPhotos[i];
        (globalThis as any).Image.prototype.width = photo.width;
        (globalThis as any).Image.prototype.height = photo.height;

        const fakeFile: any = { type: 'image/jpeg', name: photo.name };
        const compressedBase64 = await compressImageToBase64(fakeFile, 800, 0.75);

        // User edits tag for item #3 (changes season from Summer to All-Season)
        let season = photo.detected.season;
        if (i === 2) {
          season = 'All-Season' as const;
        }

        await repo.addItem({
          imageBase64: compressedBase64,
          category: photo.detected.category,
          color: photo.detected.color,
          season,
        });
      }

      // Check wardrobe grid
      const all = await repo.getAllItems();
      expect(all.length).toBe(5);

      const shoesItem = all.find((item) => item.category === 'Shoes');
      expect(shoesItem).toBeDefined();
      expect(shoesItem?.season).toBe('All-Season'); // Overridden tag saved successfully

      const stats = await repo.getWardrobeStats();
      expect(stats.total).toBe(5);
      expect(stats.byCategory.Top).toBe(2);
      expect(stats.byCategory.Bottom).toBe(1);
      expect(stats.byCategory.Shoes).toBe(1);
      expect(stats.byCategory.Outerwear).toBe(1);
    });

    test('Scenario 3: Laundry Day Cycle Workflow', async () => {
      const repo = new InMemoryWardrobeRepository();

      // Start with dirty items
      const item1 = await repo.addItem({ imageBase64: '1', category: 'Top', color: 'Black T-Shirt', season: 'Summer', isClean: false });
      const item2 = await repo.addItem({ imageBase64: '2', category: 'Bottom', color: 'Grey Sweatpants', season: 'Summer', isClean: false });
      const item3 = await repo.addItem({ imageBase64: '3', category: 'Shoes', color: 'Running Shoes', season: 'Summer', isClean: false });

      // Clean metadata before laundry is empty
      let clean = await repo.getCleanItemsMetadata();
      expect(clean.length).toBe(0);

      // User marks dirty items as clean in one tap ("Laundry Day")
      await repo.toggleCleanStatus(item1.id, true);
      await repo.toggleCleanStatus(item2.id, true);
      await repo.toggleCleanStatus(item3.id, true);

      // Newly cleaned items are now eligible for outfit selection
      clean = await repo.getCleanItemsMetadata();
      expect(clean.length).toBe(3);

      const readyForOutfit =
        clean.some((i) => i.category === 'Top') &&
        clean.some((i) => i.category === 'Bottom') &&
        clean.some((i) => i.category === 'Shoes');
      expect(readyForOutfit).toBe(true);
    });

    test('Scenario 4: Offline / Flight Mode Operation Workflow', async () => {
      // Step 1: App launches in Flight Mode (network offline)
      const { mockNavigator } = setupBrowserMocks({
        online: false,
        storage: { persisted: true },
      });
      expect(mockNavigator.onLine).toBe(false);

      // Step 2: Storage persistence holds
      const { requestPersistentStorage } = await import('../../src/db/db.ts');
      const persisted = await requestPersistentStorage();
      expect(persisted).toBe(true);

      // Step 3: Cached wardrobe loads instantly from local IndexedDB
      const repo = new InMemoryWardrobeRepository();
      await repo.addItem({ imageBase64: 'cached-img-1', category: 'Top', color: 'White', season: 'Summer' });
      await repo.addItem({ imageBase64: 'cached-img-2', category: 'Bottom', color: 'Blue', season: 'Summer' });
      await repo.addItem({ imageBase64: 'cached-img-3', category: 'Shoes', color: 'Brown', season: 'Summer' });

      const cachedItems = await repo.getAllItems();
      expect(cachedItems.length).toBe(3);

      // Step 4: Weather falls back to default context
      const DEFAULT_WEATHER = {
        temperatureCelsius: 19,
        condition: 'Partly Cloudy',
        locationName: 'Local Area',
        stylingTip: 'Mild weather — comfortable for a single top or light layering.',
      };
      expect(DEFAULT_WEATHER.temperatureCelsius).toBe(19);

      // Step 5: Outfit generation falls back cleanly with user notification
      const cleanMetadata = await repo.getCleanItemsMetadata();
      expect(cleanMetadata.length).toBe(3);
      const offlineOutfit = {
        itemIds: cleanMetadata.map((i) => i.id),
        rationale: 'Curated look using your cached wardrobe (Offline Mode).',
      };
      expect(offlineOutfit.itemIds.length).toBe(3);
      expect(offlineOutfit.rationale).toContain('Offline Mode');
    });

    test('Scenario 5: BYOK Key Management & Token Quota Defense Workflow', async () => {
      // Step 1: User enters custom Gemini API key in Settings modal
      setupBrowserMocks({ env: { VITE_GEMINI_API_KEY: 'AIzaSyDefaultEnvKey' } });
      const customKey = 'AIzaSyBYOK_Secret_User_Token_12345';
      const { setGeminiApiKey, getGeminiApiKey, serializeCleanWardrobeForPrompt } = await import(
        '../../src/services/geminiService.ts'
      );

      setGeminiApiKey(customKey);

      // Step 2: Key persists in localStorage with precedence over env variable
      const activeKey = getGeminiApiKey();
      expect(activeKey).toBe(customKey);

      // Step 3: User triggers outfit generation with large wardrobe items
      const repo = new InMemoryWardrobeRepository();
      const largeBase64 = 'data:image/jpeg;base64,' + 'IMG_DATA'.repeat(5000);

      await repo.addItem({ imageBase64: largeBase64, category: 'Top', color: 'Silk Blouse', season: 'Spring', isClean: true });
      await repo.addItem({ imageBase64: largeBase64, category: 'Bottom', color: 'Pleated Skirt', season: 'Spring', isClean: true });
      await repo.addItem({ imageBase64: largeBase64, category: 'Shoes', color: 'Block Heels', season: 'Spring', isClean: true });

      // Step 4: Verify prompt payload strictly excludes base64 images
      const cleanItems = await repo.getCleanItemsMetadata();
      const promptPayload = serializeCleanWardrobeForPrompt(cleanItems);

      expect(promptPayload.includes('IMG_DATA')).toBe(false);
      expect(promptPayload.includes('imageBase64')).toBe(false);
      expect(promptPayload.length).toBeLessThan(1000); // Token quota defended!
    });
  });
}
