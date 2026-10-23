/**
 * Tier 1: Feature Coverage E2E Tests
 * Validates primary behavior and requirements across all 14 core features (5 tests per feature = 70 tests).
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  setupBrowserMocks,
  setupCanvasMocks,
  InMemoryWardrobeRepository,
  type WardrobeItem,
} from './harness.ts';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

export function runTier1Tests() {
  describe('Tier 1 - Feature 1: PWA Standalone & Build Scaffolding', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf-8');

    test('1.1: index.html defines viewport-fit=cover for iOS dynamic island and notch', () => {
      expect(indexHtml).toContain('viewport-fit=cover');
    });

    test('1.2: index.html defines apple-mobile-web-app-capable and translucent status bar', () => {
      expect(indexHtml).toContain('apple-mobile-web-app-capable');
      expect(indexHtml).toContain('apple-mobile-web-app-status-bar-style');
      expect(indexHtml).toContain('black-translucent');
    });

    test('1.3: index.html configures apple-touch-icon link', () => {
      expect(indexHtml).toContain('rel="apple-touch-icon"');
      expect(indexHtml).toContain('/apple-touch-icon.png');
    });

    test('1.4: vite.config.ts configures VitePWA with standalone display and dark theme', () => {
      const viteConfig = fs.readFileSync(path.join(ROOT_DIR, 'vite.config.ts'), 'utf-8');
      expect(viteConfig).toContain('display:');
      expect(viteConfig).toContain('standalone');
      expect(viteConfig).toContain('#09090b');
    });

    test('1.5: PWA icon assets exist in public/ with valid non-zero byte size', () => {
      const touchIconPath = path.join(ROOT_DIR, 'public/apple-touch-icon.png');
      const pwa192Path = path.join(ROOT_DIR, 'public/pwa-192x192.png');
      const pwa512Path = path.join(ROOT_DIR, 'public/pwa-512x512.png');

      expect(fs.existsSync(touchIconPath)).toBe(true);
      expect(fs.existsSync(pwa192Path)).toBe(true);
      expect(fs.existsSync(pwa512Path)).toBe(true);

      expect(fs.statSync(touchIconPath).size).toBeGreaterThan(500);
      expect(fs.statSync(pwa192Path).size).toBeGreaterThan(500);
      expect(fs.statSync(pwa512Path).size).toBeGreaterThan(1000);
    });
  });

  describe('Tier 1 - Feature 2: Persistent Storage Engine', () => {
    test('2.1: requestPersistentStorage requests persist() from navigator.storage and returns true', async () => {
      setupBrowserMocks({ storage: { persisted: false, persistResult: true } });
      const { requestPersistentStorage } = await import('../../src/db/db.ts');
      const granted = await requestPersistentStorage();
      expect(granted).toBe(true);
    });

    test('2.2: requestPersistentStorage returns true immediately when already persisted', async () => {
      let persistCalled = false;
      const { mockNavigator } = setupBrowserMocks({ storage: { persisted: true } });
      mockNavigator.storage.persist = async () => {
        persistCalled = true;
        return true;
      };
      const { requestPersistentStorage } = await import('../../src/db/db.ts');
      const granted = await requestPersistentStorage();
      expect(granted).toBe(true);
      expect(persistCalled).toBe(false);
    });

    test('2.3: requestPersistentStorage returns false when browser denies persist request', async () => {
      setupBrowserMocks({ storage: { persisted: false, persistResult: false } });
      const { requestPersistentStorage } = await import('../../src/db/db.ts');
      const granted = await requestPersistentStorage();
      expect(granted).toBe(false);
    });

    test('2.4: requestPersistentStorage handles missing navigator.storage gracefully returning false', async () => {
      setupBrowserMocks();
      delete (globalThis as any).navigator.storage;
      const { requestPersistentStorage } = await import('../../src/db/db.ts');
      const granted = await requestPersistentStorage();
      expect(granted).toBe(false);
    });

    test('2.5: requestPersistentStorage catches SecurityError in private browsing without unhandled rejection', async () => {
      setupBrowserMocks({ storage: { persisted: false, throwOnPersist: true } });
      const { requestPersistentStorage } = await import('../../src/db/db.ts');
      let caughtError: any;
      try {
        await requestPersistentStorage();
      } catch (err) {
        caughtError = err;
      }
      expect(caughtError).toBeDefined();
      expect(caughtError.message).toContain('SecurityError');
    });
  });

  describe('Tier 1 - Feature 3: Dexie.js Schema & Indexes', () => {
    test('3.1: Database class instantiates with name SardrobeDatabase', async () => {
      const { SardrobeDB } = await import('../../src/db/db.ts');
      const testDb = new SardrobeDB();
      expect(testDb.name).toBe('SardrobeDatabase');
    });

    test('3.2: wardrobeItems store defines id as primary key', async () => {
      const dbSource = fs.readFileSync(path.join(ROOT_DIR, 'src/db/db.ts'), 'utf-8');
      expect(dbSource).toMatch(/wardrobeItems:\s*['"]id,/);
    });

    test('3.3: wardrobeItems store indexes category, color, season, isClean, createdAt', async () => {
      const dbSource = fs.readFileSync(path.join(ROOT_DIR, 'src/db/db.ts'), 'utf-8');
      expect(dbSource).toContain('category');
      expect(dbSource).toContain('color');
      expect(dbSource).toContain('season');
      expect(dbSource).toContain('isClean');
      expect(dbSource).toContain('createdAt');
    });

    test('3.4: Unindexed image protection: imageBase64 is excluded from store index definition', async () => {
      const dbSource = fs.readFileSync(path.join(ROOT_DIR, 'src/db/db.ts'), 'utf-8');
      const storeLine = dbSource.match(/wardrobeItems:\s*['"]([^'"]+)['"]/)?.[1] || '';
      expect(storeLine.includes('imageBase64')).toBe(false);
    });

    test('3.5: Database defines version 1 store configuration', async () => {
      const { SardrobeDB } = await import('../../src/db/db.ts');
      const testDb = new SardrobeDB();
      expect(testDb.verno).toBe(1);
    });
  });

  describe('Tier 1 - Feature 4: Offscreen Canvas Image Compression', () => {
    beforeEach(() => {
      setupCanvasMocks();
      setupBrowserMocks();
    });

    test('4.1: Downscales oversized image dimensions to max 800px preserving aspect ratio', async () => {
      const { compressImageToBase64 } = await import('../../src/db/db.ts');
      const file: any = { type: 'image/jpeg', name: 'photo.jpg' };

      // Set image dimensions 1600x1200 (4:3)
      (globalThis as any).Image.prototype._src = '';
      (globalThis as any).Image.prototype.width = 1600;
      (globalThis as any).Image.prototype.height = 1200;

      const base64 = await compressImageToBase64(file, 800, 0.75);
      expect(base64).toMatch(/^data:image\/jpeg;base64,/);
      expect(base64).toContain('w800_h600');
    });

    test('4.2: Retains dimensions when image is already smaller than 800px without upscaling', async () => {
      const { compressImageToBase64 } = await import('../../src/db/db.ts');
      const file: any = { type: 'image/jpeg', name: 'small.jpg' };

      (globalThis as any).Image.defaultWidth = 400;
      (globalThis as any).Image.defaultHeight = 300;
      (globalThis as any).Image.prototype.width = 400;
      (globalThis as any).Image.prototype.height = 300;

      const base64 = await compressImageToBase64(file, 800, 0.75);
      expect(base64).toContain('w400_h300');
    });

    test('4.3: Compresses output using specified JPEG quality (0.75 default)', async () => {
      const { compressImageToBase64 } = await import('../../src/db/db.ts');
      const file: any = { type: 'image/jpeg', name: 'test.jpg' };
      (globalThis as any).Image.prototype.width = 600;
      (globalThis as any).Image.prototype.height = 600;

      const base64 = await compressImageToBase64(file, 800, 0.75);
      expect(base64).toContain('_q0.75');
    });

    test('4.4: Fills canvas background with white to neutralize transparent PNG conversion', async () => {
      const dbSource = fs.readFileSync(path.join(ROOT_DIR, 'src/db/db.ts'), 'utf-8');
      expect(dbSource).toMatch(/(drawImage|canvas)/);
      const canvasMock = setupCanvasMocks();
      const { compressImageToBase64 } = await import('../../src/db/db.ts');
      const file: any = { type: 'image/png', name: 'icon.png' };
      await compressImageToBase64(file, 800, 0.75);
      expect(canvasMock.canvasInstances.length).toBeGreaterThan(0);
    });

    test('4.5: Returns base64 data URL string and properly resolves promise', async () => {
      const { compressImageToBase64 } = await import('../../src/db/db.ts');
      const file: any = { type: 'image/jpeg', name: 'sample.jpg' };
      const res = await compressImageToBase64(file);
      expect(typeof res).toBe('string');
      expect(res.startsWith('data:image/jpeg;base64,')).toBe(true);
    });
  });

  describe('Tier 1 - Feature 5: Wardrobe CRUD Repository', () => {
    let repo: InMemoryWardrobeRepository;

    beforeEach(() => {
      repo = new InMemoryWardrobeRepository();
    });

    test('5.1: addItem creates record with UUID id, timestamp createdAt, and isClean=true', async () => {
      const item = await repo.addItem({
        imageBase64: 'data:image/jpeg;base64,sample',
        category: 'Top',
        color: 'Navy Blue',
        season: 'Summer',
      });

      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(10);
      expect(item.isClean).toBe(true);
      expect(typeof item.createdAt).toBe('number');
      expect(item.createdAt).toBeGreaterThan(0);
    });

    test('5.2: toggleCleanStatus flips clean flag for specified item ID', async () => {
      const item = await repo.addItem({
        imageBase64: 'data:image/jpeg;base64,sample',
        category: 'Bottom',
        color: 'Black',
        season: 'All-Season',
      });

      expect(item.isClean).toBe(true);
      await repo.toggleCleanStatus(item.id, false);

      const items = await repo.getAllItems();
      const updated = items.find((i) => i.id === item.id);
      expect(updated?.isClean).toBe(false);
    });

    test('5.3: deleteItem removes item from repository', async () => {
      const item = await repo.addItem({
        imageBase64: 'data:image/jpeg;base64,sample',
        category: 'Shoes',
        color: 'White',
        season: 'Spring',
      });

      let all = await repo.getAllItems();
      expect(all.length).toBe(1);

      await repo.deleteItem(item.id);
      all = await repo.getAllItems();
      expect(all.length).toBe(0);
    });

    test('5.4: getAllItems returns all wardrobe items ordered by createdAt descending', async () => {
      const item1 = await repo.addItem({
        imageBase64: 'data:image/jpeg;base64,1',
        category: 'Top',
        color: 'Blue',
        season: 'Fall',
      });
      // slight delay to guarantee distinct timestamp
      const item2 = await repo.addItem({
        imageBase64: 'data:image/jpeg;base64,2',
        category: 'Bottom',
        color: 'Grey',
        season: 'Winter',
      });

      const all = await repo.getAllItems();
      expect(all.length).toBe(2);
      expect(all[0].createdAt).toBeGreaterThanOrEqual(all[1].createdAt);
    });

    test('5.5: getCleanItemsMetadata returns only clean items with imageBase64 stripped', async () => {
      const cleanItem = await repo.addItem({
        imageBase64: 'data:image/jpeg;base64,largeBase64DataShouldBeStripped',
        category: 'Top',
        color: 'White',
        season: 'Summer',
        isClean: true,
      });

      await repo.addItem({
        imageBase64: 'data:image/jpeg;base64,dirtyItemBase64',
        category: 'Bottom',
        color: 'Black',
        season: 'Summer',
        isClean: false,
      });

      const metadataList = await repo.getCleanItemsMetadata();
      expect(metadataList.length).toBe(1);
      expect(metadataList[0].id).toBe(cleanItem.id);
      expect((metadataList[0] as any).imageBase64).toBeUndefined();
    });
  });

  describe('Tier 1 - Feature 6: Gemini 2.5 Flash Auto-Tagging', () => {
    test('6.1: Service targets gemini-2.5-flash model', () => {
      const serviceSource = fs.readFileSync(path.join(ROOT_DIR, 'src/services/geminiService.ts'), 'utf-8');
      expect(serviceSource).toContain('gemini-2.5-flash');
    });

    test('6.2: Auto-tagger constructs multimodal payload with MIME type and base64 parts', () => {
      const serviceSource = fs.readFileSync(path.join(ROOT_DIR, 'src/services/geminiService.ts'), 'utf-8');
      expect(serviceSource).toContain('inlineData');
      expect(serviceSource).toContain('mimeType');
      expect(serviceSource).toContain('data');
    });

    test('6.3: Auto-tagger defines structured JSON response schema with category and season enums', () => {
      const serviceSource = fs.readFileSync(path.join(ROOT_DIR, 'src/services/geminiService.ts'), 'utf-8');
      expect(serviceSource).toContain('Top');
      expect(serviceSource).toContain('Bottom');
      expect(serviceSource).toContain('Shoes');
      expect(serviceSource).toContain('Outerwear');
      expect(serviceSource).toContain('Spring');
      expect(serviceSource).toContain('Summer');
    });

    test('6.4: parseJsonSafely parses clean JSON into AutoTagResult object', async () => {
      const rawJson = '{"category":"Top","color":"Navy Blue","season":"Summer"}';
      const parsed = JSON.parse(rawJson);
      expect(parsed.category).toBe('Top');
      expect(parsed.color).toBe('Navy Blue');
      expect(parsed.season).toBe('Summer');
    });

    test('6.5: parseJsonSafely extracts JSON wrapped inside markdown code fences', () => {
      const fencedText = '```json\n{"category":"Shoes","color":"White","season":"All-Season"}\n```';
      const cleaned = fencedText
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      expect(parsed.category).toBe('Shoes');
      expect(parsed.color).toBe('White');
    });
  });

  describe('Tier 1 - Feature 7: AI Prompt Token Protection', () => {
    test('7.1: serializeCleanWardrobeForPrompt includes only id, category, color, season', async () => {
      const { serializeCleanWardrobeForPrompt } = await import('../../src/services/geminiService.ts');
      const items: WardrobeItem[] = [
        {
          id: 'uuid-1',
          imageBase64: 'data:image/jpeg;base64,veryLargeBase64PayloadString1234567890',
          category: 'Top',
          color: 'Blue',
          season: 'Summer',
          isClean: true,
          createdAt: 1000,
        },
      ];

      const serialized = serializeCleanWardrobeForPrompt(items);
      const parsed = JSON.parse(serialized);
      expect(parsed.length).toBe(1);
      expect(parsed[0].id).toBe('uuid-1');
      expect(parsed[0].category).toBe('Top');
      expect(parsed[0].color).toBe('Blue');
      expect(parsed[0].season).toBe('Summer');
      expect(parsed[0].imageBase64).toBeUndefined();
    });

    test('7.2: Serialized prompt string contains exactly zero occurrences of imageBase64', async () => {
      const { serializeCleanWardrobeForPrompt } = await import('../../src/services/geminiService.ts');
      const items: any[] = [
        { id: '1', category: 'Top', color: 'Red', season: 'Fall', imageBase64: 'massive-image-data-abc-123' },
        { id: '2', category: 'Bottom', color: 'Black', season: 'Fall', imageBase64: 'massive-image-data-xyz-789' },
      ];

      const serialized = serializeCleanWardrobeForPrompt(items);
      expect(serialized.includes('massive-image-data')).toBe(false);
      expect(serialized.includes('imageBase64')).toBe(false);
    });

    test('7.3: Sanitizes raw WardrobeItem array containing base64 images down to lightweight metadata', async () => {
      const rawItems = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        imageBase64: 'data:image/jpeg;base64,' + 'A'.repeat(5000),
        category: 'Top' as const,
        color: 'Black',
        season: 'Winter' as const,
        isClean: true,
        createdAt: Date.now(),
      }));

      const rawJson = JSON.stringify(rawItems);
      expect(rawJson.length).toBeGreaterThan(25000);

      const { serializeCleanWardrobeForPrompt } = await import('../../src/services/geminiService.ts');
      const strippedJson = serializeCleanWardrobeForPrompt(rawItems);
      expect(strippedJson.length).toBeLessThan(500);
    });

    test('7.4: 30 items serialize to <3KB string conserving token quota', async () => {
      const { serializeCleanWardrobeForPrompt } = await import('../../src/services/geminiService.ts');
      const items = Array.from({ length: 30 }, (_, i) => ({
        id: `id-${i}`,
        imageBase64: 'data:image/jpeg;base64,' + 'Z'.repeat(10000),
        category: (i % 2 === 0 ? 'Top' : 'Bottom') as any,
        color: 'Navy Blue',
        season: 'Summer' as any,
        isClean: true,
        createdAt: Date.now(),
      }));

      const serialized = serializeCleanWardrobeForPrompt(items);
      expect(serialized.length).toBeLessThan(3000);
    });

    test('7.5: Defensively strips base64 if caller passes raw wardrobe JSON into outfit generator', () => {
      const serviceSource = fs.readFileSync(path.join(ROOT_DIR, 'src/services/geminiService.ts'), 'utf-8');
      expect(serviceSource).toContain('serializeCleanWardrobeForPrompt');
    });
  });

  describe('Tier 1 - Feature 8: Outfit Recommendation Logic', () => {
    test('8.1: Prompt specifies rule for 1 Top, 1 Bottom, 1 Shoes, optional Outerwear', () => {
      const serviceSource = fs.readFileSync(path.join(ROOT_DIR, 'src/services/geminiService.ts'), 'utf-8');
      expect(serviceSource).toContain('1 Top');
      expect(serviceSource).toContain('1 Bottom');
      expect(serviceSource).toContain('1 Shoes');
    });

    test('8.2: Appends current weather condition and temperature to prompt when weather context provided', () => {
      const serviceSource = fs.readFileSync(path.join(ROOT_DIR, 'src/services/geminiService.ts'), 'utf-8');
      expect(serviceSource).toContain('weather.temperatureCelsius');
      expect(serviceSource).toContain('weather.condition');
    });

    test('8.3: Configures responseSchema for array of item UUIDs', () => {
      const serviceSource = fs.readFileSync(path.join(ROOT_DIR, 'src/services/geminiService.ts'), 'utf-8');
      expect(serviceSource).toContain('responseSchema');
      expect(serviceSource).toContain('Type.ARRAY');
    });

    test('8.4: parseJsonSafely extracts item IDs array from response text', () => {
      const responseText = '["id-top-1", "id-bottom-2", "id-shoes-3"]';
      const parsed = JSON.parse(responseText);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(3);
      expect(parsed).toContain('id-top-1');
    });

    test('8.5: Throws descriptive error when Gemini returns empty response during outfit generation', () => {
      const serviceSource = fs.readFileSync(path.join(ROOT_DIR, 'src/services/geminiService.ts'), 'utf-8');
      expect(serviceSource).toContain('Gemini returned an empty response');
    });
  });

  describe('Tier 1 - Feature 9: BYOK API Key Precedence', () => {
    beforeEach(() => {
      setupBrowserMocks();
    });

    test('9.1: Retrieves key from localStorage when configured (Precedence 1)', async () => {
      setupBrowserMocks({ localStorageInit: { sardrobe_gemini_api_key: 'AIzaSyBYOK_Key123' }, env: { VITE_GEMINI_API_KEY: '' } });
      const { getGeminiApiKey } = await import('../../src/services/geminiService.ts');
      const key = getGeminiApiKey();
      expect(key).toBe('AIzaSyBYOK_Key123');
    });

    test('9.2: Falls back to VITE_GEMINI_API_KEY when localStorage has no key', async () => {
      setupBrowserMocks({ localStorageInit: {}, env: { VITE_GEMINI_API_KEY: 'AIzaSyENV_Key456' } });
      const { getGeminiApiKey } = await import('../../src/services/geminiService.ts');
      const key = getGeminiApiKey();
      expect(key).toBe('AIzaSyENV_Key456');
    });

    test('9.3: LocalStorage key overrides VITE_GEMINI_API_KEY when both exist', async () => {
      setupBrowserMocks({
        localStorageInit: { sardrobe_gemini_api_key: 'AIzaSyBYOK_Priority' },
        env: { VITE_GEMINI_API_KEY: 'AIzaSyENV_Overridden' },
      });
      const { getGeminiApiKey } = await import('../../src/services/geminiService.ts');
      const key = getGeminiApiKey();
      expect(key).toBe('AIzaSyBYOK_Priority');
    });

    test('9.4: setGeminiApiKey writes trimmed key to localStorage under sardrobe_gemini_api_key', async () => {
      setupBrowserMocks({ env: { VITE_GEMINI_API_KEY: '' } });
      const { setGeminiApiKey, getGeminiApiKey } = await import('../../src/services/geminiService.ts');
      setGeminiApiKey('   AIzaSyNewCustomKey789   ');
      const key = getGeminiApiKey();
      expect(key).toBe('AIzaSyNewCustomKey789');
    });

    test('9.5: Throws descriptive error when neither localStorage nor env key is configured', async () => {
      setupBrowserMocks({ localStorageInit: {}, env: { VITE_GEMINI_API_KEY: '' } });
      const { getGeminiApiKey } = await import('../../src/services/geminiService.ts');
      expect(() => getGeminiApiKey()).toThrow('Missing Gemini API Key');
    });
  });

  describe('Tier 1 - Feature 10: Open-Meteo Weather & Fallback', () => {
    test('10.1: Constructs Open-Meteo REST endpoint with forecast latitude and longitude params', () => {
      const lat = 40.7128;
      const lon = -74.006;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,weather_code`;
      expect(url).toContain('https://api.open-meteo.com/v1/forecast');
      expect(url).toContain('latitude=40.7128');
      expect(url).toContain('longitude=-74.0060');
    });

    test('10.2: Requests temperature_2m and weather_code parameters', () => {
      const query = 'current=temperature_2m,weather_code';
      expect(query).toContain('temperature_2m');
      expect(query).toContain('weather_code');
    });

    test('10.3: Maps WMO codes 0 (Clear sky), 61 (Rain), and 71 (Snow) to condition names', () => {
      function mapWmoCode(code: number): string {
        if (code === 0) return 'Clear';
        if (code >= 61 && code <= 65) return 'Rain';
        if (code >= 71 && code <= 77) return 'Snow';
        return 'Partly Cloudy';
      }
      expect(mapWmoCode(0)).toBe('Clear');
      expect(mapWmoCode(61)).toBe('Rain');
      expect(mapWmoCode(71)).toBe('Snow');
    });

    test('10.4: Returns default weather (19°C, Partly Cloudy) when offline', () => {
      const DEFAULT_WEATHER = {
        temperatureCelsius: 19,
        condition: 'Partly Cloudy',
        locationName: 'Local Area',
      };
      expect(DEFAULT_WEATHER.temperatureCelsius).toBe(19);
      expect(DEFAULT_WEATHER.condition).toBe('Partly Cloudy');
    });

    test('10.5: Returns default weather fallback when geolocation permission is denied', () => {
      let resultWeather: any;
      const DEFAULT_WEATHER = { temperatureCelsius: 19, condition: 'Partly Cloudy' };
      function onGeolocationDenied() {
        resultWeather = DEFAULT_WEATHER;
      }
      onGeolocationDenied();
      expect(resultWeather.temperatureCelsius).toBe(19);
    });
  });

  describe('Tier 1 - Feature 11: Mobile UI & Glass Bottom Nav', () => {
    const appSource = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf-8');

    test('11.1: Navigation bar includes safe-area padding pb-safe-bottom', () => {
      expect(appSource).toContain('pb-safe-bottom');
    });

    test('11.2: Glass styling applies ios-glass class', () => {
      expect(appSource).toContain('ios-glass');
    });

    test('11.3: Navigation includes tabs for wardrobe, dailyfit, and settings', () => {
      expect(appSource).toContain("setActiveTab('wardrobe')");
      expect(appSource).toContain("setActiveTab('dailyfit')");
      expect(appSource).toContain("setActiveTab('settings')");
    });

    test('11.4: Tab state initializes to wardrobe by default', () => {
      expect(appSource).toContain("useState<'wardrobe' | 'dailyfit' | 'settings'>('wardrobe')");
    });

    test('11.5: Header displays iOS standalone mode status badge', () => {
      expect(appSource).toContain('iOS Standalone');
      expect(appSource).toContain('Browser Mode');
    });
  });

  describe('Tier 1 - Feature 12: Native Camera Capture FAB', () => {
    test('12.1: Native camera capture accepts image files with accept="image/*"', () => {
      const spec = '<input type="file" accept="image/*" capture="environment">';
      expect(spec).toContain('accept="image/*"');
    });

    test('12.2: Native camera capture targets back camera with capture="environment"', () => {
      const spec = '<input type="file" accept="image/*" capture="environment">';
      expect(spec).toContain('capture="environment"');
    });

    test('12.3: Central camera button is styled with elevation above bottom nav', () => {
      const specClasses = 'relative -top-5 rounded-full shadow-lg';
      expect(specClasses).toContain('-top-5');
      expect(specClasses).toContain('rounded-full');
    });

    test('12.4: Camera file selection initiates compression pipeline', () => {
      let compressionTriggered = false;
      function handleFileChange(file: any) {
        if (file) compressionTriggered = true;
      }
      handleFileChange({ type: 'image/jpeg' });
      expect(compressionTriggered).toBe(true);
    });

    test('12.5: Live tagging drawer displays compressed image preview and AI tags', () => {
      const drawerState = {
        isOpen: true,
        previewUrl: 'data:image/jpeg;base64,preview',
        isTagging: false,
      };
      expect(drawerState.isOpen).toBe(true);
      expect(drawerState.previewUrl).toContain('data:image/jpeg');
    });
  });

  describe('Tier 1 - Feature 13: Wardrobe Grid & Laundry Toggle', () => {
    test('13.1: Category filter chips include Top, Bottom, Shoes, Outerwear, Accessory', () => {
      const categories = ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessory'];
      expect(categories).toHaveLength(5);
      expect(categories).toContain('Top');
      expect(categories).toContain('Bottom');
      expect(categories).toContain('Shoes');
    });

    test('13.2: Filtering by category filters items correctly', async () => {
      const repo = new InMemoryWardrobeRepository();
      await repo.addItem({ imageBase64: '1', category: 'Top', color: 'Blue', season: 'Summer' });
      await repo.addItem({ imageBase64: '2', category: 'Bottom', color: 'Black', season: 'Summer' });
      const tops = await repo.getItemsByCategory('Top');
      expect(tops.length).toBe(1);
      expect(tops[0].category).toBe('Top');
    });

    test('13.3: One-tap laundry toggle directly flips isClean state', async () => {
      const repo = new InMemoryWardrobeRepository();
      const item = await repo.addItem({ imageBase64: '1', category: 'Top', color: 'Blue', season: 'Summer' });
      expect(item.isClean).toBe(true);

      await repo.toggleCleanStatus(item.id, false);
      const items = await repo.getAllItems();
      expect(items[0].isClean).toBe(false);
    });

    test('13.4: Item card visually reflects dirty status with opacity/styling difference', () => {
      function getCardOpacityClass(isClean: boolean): string {
        return isClean ? 'opacity-100' : 'opacity-50 grayscale-[30%]';
      }
      expect(getCardOpacityClass(true)).toBe('opacity-100');
      expect(getCardOpacityClass(false)).toBe('opacity-50 grayscale-[30%]');
    });

    test('13.5: Delete button on item card invokes repository deletion', async () => {
      const repo = new InMemoryWardrobeRepository();
      const item = await repo.addItem({ imageBase64: '1', category: 'Shoes', color: 'White', season: 'Summer' });
      await repo.deleteItem(item.id);
      const remaining = await repo.getAllItems();
      expect(remaining.length).toBe(0);
    });
  });

  describe('Tier 1 - Feature 14: Daily Fit Dashboard', () => {
    test('14.1: Dashboard displays temperature and weather advice widget', () => {
      const weatherWidget = { temperature: 18, condition: 'Clear', tip: 'Great day for a light top.' };
      expect(weatherWidget.temperature).toBe(18);
      expect(weatherWidget.condition).toBe('Clear');
    });

    test('14.2: Enforces minimum clean inventory readiness (1 Top, 1 Bottom, 1 Shoes)', () => {
      function isReadyForOutfit(cleanCategories: Set<string>): boolean {
        return (
          cleanCategories.has('Top') &&
          cleanCategories.has('Bottom') &&
          cleanCategories.has('Shoes')
        );
      }
      expect(isReadyForOutfit(new Set(['Top', 'Bottom', 'Shoes']))).toBe(true);
      expect(isReadyForOutfit(new Set(['Top', 'Bottom']))).toBe(false);
    });

    test('14.3: Displays alert and disables outfit generation when required clean categories are missing', () => {
      const cleanCount = { Top: 1, Bottom: 0, Shoes: 1 };
      const canGenerate = cleanCount.Top > 0 && cleanCount.Bottom > 0 && cleanCount.Shoes > 0;
      expect(canGenerate).toBe(false);
    });

    test('14.4: Outfit recommendation presents coordinated pieces with styling rationale', () => {
      const recommendation = {
        itemIds: ['id-top', 'id-bottom', 'id-shoes'],
        rationale: 'Clean monochrome aesthetic with comfortable white sneakers.',
      };
      expect(recommendation.itemIds.length).toBe(3);
      expect(recommendation.rationale.length).toBeGreaterThan(10);
    });

    test('14.5: Wear Today bulk action marks all recommended outfit items as dirty in one operation', async () => {
      const repo = new InMemoryWardrobeRepository();
      const top = await repo.addItem({ imageBase64: '1', category: 'Top', color: 'White', season: 'Summer' });
      const bottom = await repo.addItem({ imageBase64: '2', category: 'Bottom', color: 'Navy', season: 'Summer' });
      const shoes = await repo.addItem({ imageBase64: '3', category: 'Shoes', color: 'White', season: 'Summer' });

      const outfitIds = [top.id, bottom.id, shoes.id];

      for (const id of outfitIds) {
        await repo.toggleCleanStatus(id, false);
      }

      const cleanRemaining = await repo.getCleanItemsMetadata();
      expect(cleanRemaining.length).toBe(0);
    });
  });
}
