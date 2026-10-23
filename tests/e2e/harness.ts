/**
 * E2E Test Harness & Execution Engine for AI Wardrobe Assistant PWA
 * Provides assertion library, test suite runner, browser/DOM shims, and structured reporting.
 */

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: Error;
}

export interface SuiteSummary {
  name: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  tests: TestResult[];
}

type TestFn = () => void | Promise<void>;
type HookFn = () => void | Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
  beforeEachHooks: HookFn[];
  afterEachHooks: HookFn[];
  beforeAllHooks: HookFn[];
  afterAllHooks: HookFn[];
}

class TestRegistry {
  suites: TestSuite[] = [];
  currentSuite: TestSuite | null = null;

  describe(name: string, fn: () => void): void {
    const suite: TestSuite = {
      name,
      tests: [],
      beforeEachHooks: [],
      afterEachHooks: [],
      beforeAllHooks: [],
      afterAllHooks: [],
    };
    const prev = this.currentSuite;
    this.currentSuite = suite;
    this.suites.push(suite);
    try {
      fn();
    } finally {
      this.currentSuite = prev;
    }
  }

  test(name: string, fn: TestFn): void {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => {
        this.currentSuite!.tests.push({ name, fn });
      });
      return;
    }
    this.currentSuite.tests.push({ name, fn });
  }

  beforeEach(fn: HookFn): void {
    if (this.currentSuite) this.currentSuite.beforeEachHooks.push(fn);
  }

  afterEach(fn: HookFn): void {
    if (this.currentSuite) this.currentSuite.afterEachHooks.push(fn);
  }

  beforeAll(fn: HookFn): void {
    if (this.currentSuite) this.currentSuite.beforeAllHooks.push(fn);
  }

  afterAll(fn: HookFn): void {
    if (this.currentSuite) this.currentSuite.afterAllHooks.push(fn);
  }

  async runSuite(suite: TestSuite): Promise<SuiteSummary> {
    const summary: SuiteSummary = {
      name: suite.name,
      total: suite.tests.length,
      passed: 0,
      failed: 0,
      durationMs: 0,
      tests: [],
    };

    const suiteStart = Date.now();

    for (const hook of suite.beforeAllHooks) {
      await hook();
    }

    for (const testCase of suite.tests) {
      const start = Date.now();
      let passed = false;
      let caughtError: Error | undefined;

      try {
        for (const hook of suite.beforeEachHooks) {
          await hook();
        }
        await testCase.fn();
        passed = true;
      } catch (err: any) {
        passed = false;
        caughtError = err instanceof Error ? err : new Error(String(err));
      } finally {
        for (const hook of suite.afterEachHooks) {
          try {
            await hook();
          } catch (hookErr) {
            if (passed) {
              passed = false;
              caughtError = hookErr instanceof Error ? hookErr : new Error(String(hookErr));
            }
          }
        }
      }

      const durationMs = Date.now() - start;
      if (passed) {
        summary.passed += 1;
      } else {
        summary.failed += 1;
      }

      summary.tests.push({
        suite: suite.name,
        name: testCase.name,
        passed,
        durationMs,
        error: caughtError,
      });
    }

    for (const hook of suite.afterAllHooks) {
      await hook();
    }

    summary.durationMs = Date.now() - suiteStart;
    return summary;
  }

  async runAll(): Promise<SuiteSummary[]> {
    const results: SuiteSummary[] = [];
    for (const suite of this.suites) {
      const summary = await this.runSuite(suite);
      results.push(summary);
    }
    return results;
  }

  clear(): void {
    this.suites = [];
    this.currentSuite = null;
  }
}

export const registry = new TestRegistry();
export const describe = (name: string, fn: () => void) => registry.describe(name, fn);
export const test = (name: string, fn: TestFn) => registry.test(name, fn);
export const it = test;
export const beforeEach = (fn: HookFn) => registry.beforeEach(fn);
export const afterEach = (fn: HookFn) => registry.afterEach(fn);
export const beforeAll = (fn: HookFn) => registry.beforeAll(fn);
export const afterAll = (fn: HookFn) => registry.afterAll(fn);

// ---------------------------------------------------------------------------
// Assertion Library
// ---------------------------------------------------------------------------

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

class Expectation<T = any> {
  private isNot = false;
  private actual: T;

  constructor(actual: T) {
    this.actual = actual;
  }

  get not(): Expectation<T> {
    const negated = new Expectation(this.actual);
    negated.isNot = !this.isNot;
    return negated;
  }

  toBe(expected: any): void {
    const pass = this.actual === expected;
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to be' : 'to be'} ${JSON.stringify(expected)}`
      );
    }
  }

  toEqual(expected: any): void {
    const pass = deepEqual(this.actual, expected);
    if (this.isNot ? pass : !pass) {
      throw new Error(
        `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to deeply equal' : 'to deeply equal'} ${JSON.stringify(expected)}`
      );
    }
  }

  toBeTruthy(): void {
    const pass = Boolean(this.actual);
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to be' : 'to be'} truthy`);
    }
  }

  toBeFalsy(): void {
    const pass = !Boolean(this.actual);
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT to be' : 'to be'} falsy`);
    }
  }

  toBeNull(): void {
    this.toBe(null);
  }

  toBeUndefined(): void {
    this.toBe(undefined);
  }

  toBeDefined(): void {
    const pass = this.actual !== undefined;
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected value ${this.isNot ? 'NOT to be' : 'to be'} defined`);
    }
  }

  toContain(item: any): void {
    let pass = false;
    if (typeof this.actual === 'string') {
      pass = this.actual.includes(String(item));
    } else if (Array.isArray(this.actual)) {
      pass = this.actual.some((el) => deepEqual(el, item));
    } else if (this.actual instanceof Set) {
      pass = this.actual.has(item);
    }
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected collection ${this.isNot ? 'NOT to contain' : 'to contain'} ${JSON.stringify(item)}`);
    }
  }

  toHaveLength(length: number): void {
    const actualLen = (this.actual as any)?.length;
    const pass = actualLen === length;
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected length ${actualLen} ${this.isNot ? 'NOT to be' : 'to be'} ${length}`);
    }
  }

  toBeGreaterThan(value: number): void {
    const pass = Number(this.actual) > value;
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected ${this.actual} ${this.isNot ? 'NOT to be >' : 'to be >'} ${value}`);
    }
  }

  toBeGreaterThanOrEqual(value: number): void {
    const pass = Number(this.actual) >= value;
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected ${this.actual} ${this.isNot ? 'NOT to be >=' : 'to be >='} ${value}`);
    }
  }

  toBeLessThan(value: number): void {
    const pass = Number(this.actual) < value;
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected ${this.actual} ${this.isNot ? 'NOT to be <' : 'to be <'} ${value}`);
    }
  }

  toBeLessThanOrEqual(value: number): void {
    const pass = Number(this.actual) <= value;
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected ${this.actual} ${this.isNot ? 'NOT to be <=' : 'to be <='} ${value}`);
    }
  }

  toMatch(regex: RegExp | string): void {
    const r = typeof regex === 'string' ? new RegExp(regex) : regex;
    const pass = r.test(String(this.actual));
    if (this.isNot ? pass : !pass) {
      throw new Error(`Expected "${this.actual}" ${this.isNot ? 'NOT to match' : 'to match'} ${r}`);
    }
  }

  toThrow(expectedMessage?: string | RegExp): void {
    if (typeof this.actual !== 'function') {
      throw new Error('toThrow requires a function target');
    }
    let threw = false;
    let thrownError: any;
    try {
      (this.actual as any)();
    } catch (e: any) {
      threw = true;
      thrownError = e;
    }

    if (this.isNot) {
      if (threw) {
        throw new Error(`Expected function NOT to throw, but threw: ${thrownError?.message || thrownError}`);
      }
      return;
    }

    if (!threw) {
      throw new Error('Expected function to throw an error, but it did not throw.');
    }

    if (expectedMessage) {
      const msg = thrownError?.message || String(thrownError);
      if (typeof expectedMessage === 'string') {
        if (!msg.includes(expectedMessage)) {
          throw new Error(`Expected error message to contain "${expectedMessage}", but got "${msg}"`);
        }
      } else {
        if (!expectedMessage.test(msg)) {
          throw new Error(`Expected error message to match ${expectedMessage}, but got "${msg}"`);
        }
      }
    }
  }

  get rejects(): {
    toThrow: (expectedMessage?: string | RegExp) => Promise<void>;
  } {
    return {
      toThrow: async (expectedMessage?: string | RegExp) => {
        let threw = false;
        let thrownError: any;
        try {
          await this.actual;
        } catch (e: any) {
          threw = true;
          thrownError = e;
        }

        if (this.isNot) {
          if (threw) {
            throw new Error(`Expected promise NOT to reject, but rejected with: ${thrownError?.message || thrownError}`);
          }
          return;
        }

        if (!threw) {
          throw new Error('Expected promise to reject, but it resolved.');
        }

        if (expectedMessage) {
          const msg = thrownError?.message || String(thrownError);
          if (typeof expectedMessage === 'string') {
            if (!msg.includes(expectedMessage)) {
              throw new Error(`Expected rejection message to contain "${expectedMessage}", but got "${msg}"`);
            }
          } else {
            if (!expectedMessage.test(msg)) {
              throw new Error(`Expected rejection message to match ${expectedMessage}, but got "${msg}"`);
            }
          }
        }
      },
    };
  }
}

export function expect<T>(actual: T): Expectation<T> {
  return new Expectation(actual);
}

// ---------------------------------------------------------------------------
// Browser & DOM Shims for Progressive Testability
// ---------------------------------------------------------------------------

export interface MockStorageOptions {
  persisted?: boolean;
  persistResult?: boolean;
  quota?: number;
  usage?: number;
  throwOnPersist?: boolean;
}

export function setupBrowserMocks(options?: {
  storage?: MockStorageOptions;
  standalone?: boolean;
  online?: boolean;
  localStorageInit?: Record<string, string>;
  env?: Record<string, string>;
}) {
  (globalThis as any).__VITE_ENV__ = options?.env || { VITE_GEMINI_API_KEY: '' };
  // 1. Mock LocalStorage
  const storageMap = new Map<string, string>(Object.entries(options?.localStorageInit || {}));
  const mockLocalStorage: Storage = {
    getItem: (key: string) => (storageMap.has(key) ? storageMap.get(key)! : null),
    setItem: (key: string, value: string) => {
      storageMap.set(key, String(value));
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
    clear: () => {
      storageMap.clear();
    },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    get length() {
      return storageMap.size;
    },
  };

  // 2. Mock Navigator
  const storageOpts = options?.storage || {};
  let isPersistedState = storageOpts.persisted ?? false;

  const mockNavigator: any = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    standalone: options?.standalone ?? false,
    onLine: options?.online ?? true,
    storage: {
      persisted: async () => isPersistedState,
      persist: async () => {
        if (storageOpts.throwOnPersist) {
          throw new Error('SecurityError: The operation is insecure in this context');
        }
        if (storageOpts.persistResult !== undefined) {
          isPersistedState = storageOpts.persistResult;
          return storageOpts.persistResult;
        }
        isPersistedState = true;
        return true;
      },
      estimate: async () => ({
        quota: storageOpts.quota ?? 1024 * 1024 * 500, // 500MB
        usage: storageOpts.usage ?? 1024 * 1024 * 15,  // 15MB
      }),
    },
    geolocation: {
      getCurrentPosition: (success: any, error: any) => {
        if (!options?.online) {
          if (error) error({ code: 2, message: 'Position unavailable' });
          return;
        }
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.006,
            accuracy: 10,
          },
        });
      },
    },
  };

  // 3. Mock window
  const mockWindow: any = {
    localStorage: mockLocalStorage,
    navigator: mockNavigator,
    matchMedia: (query: string) => ({
      matches: query.includes('display-mode: standalone') ? Boolean(options?.standalone) : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  };

  try {
    Object.defineProperty(globalThis, 'window', { value: mockWindow, configurable: true, writable: true });
  } catch {
    (globalThis as any).window = mockWindow;
  }
  try {
    Object.defineProperty(globalThis, 'navigator', { value: mockNavigator, configurable: true, writable: true });
  } catch {
    (globalThis as any).navigator = mockNavigator;
  }
  try {
    Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, configurable: true, writable: true });
  } catch {
    (globalThis as any).localStorage = mockLocalStorage;
  }

  return {
    mockLocalStorage,
    mockNavigator,
    mockWindow,
    setPersisted: (val: boolean) => {
      isPersistedState = val;
    },
  };
}

// ---------------------------------------------------------------------------
// Canvas & Image Mocking for Offscreen Compression Testing
// ---------------------------------------------------------------------------

export function setupCanvasMocks() {
  const objectUrlMap = new Map<string, Blob | File>();
  let urlCounter = 0;

  (globalThis as any).URL = {
    createObjectURL: (blob: Blob | File) => {
      const id = `blob:mock-url-${++urlCounter}`;
      objectUrlMap.set(id, blob);
      return id;
    },
    revokeObjectURL: (url: string) => {
      objectUrlMap.delete(url);
    },
  };

  // Mock FileReader
  class MockFileReader {
    onload: any = null;
    onerror: any = null;
    result: string | ArrayBuffer | null = null;

    readAsDataURL(blob: Blob | File) {
      setTimeout(() => {
        if ((blob as any).name?.includes('corrupted') || (blob as any).failRead) {
          if (this.onerror) this.onerror(new Error('Read failure'));
        } else {
          this.result = `data:${blob.type || 'image/jpeg'};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
          if (this.onload) this.onload();
        }
      }, 0);
    }
  }
  (globalThis as any).FileReader = MockFileReader;

  // Mock Image
  class MockImage {
    static defaultWidth = 800;
    static defaultHeight = 600;
    width: number;
    height: number;
    private _src = '';
    onload: any = null;
    onerror: any = null;

    constructor() {
      this.width = (MockImage.prototype as any).width ?? MockImage.defaultWidth;
      this.height = (MockImage.prototype as any).height ?? MockImage.defaultHeight;
    }

    get src(): string {
      return this._src;
    }

    set src(v: string) {
      this._src = v;
      setTimeout(() => {
        if (v.includes('invalid') || v.includes('corrupted')) {
          if (this.onerror) this.onerror(new Error('Image decode error'));
        } else {
          if (this.onload) this.onload();
        }
      }, 0);
    }
  }

  (globalThis as any).Image = MockImage;

  // Mock document & canvas
  const canvasInstances: any[] = [];
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const canvas: any = {
          width: 0,
          height: 0,
          getContext: (type: string) => {
            if (type === '2d') {
              return {
                fillStyle: '#000000',
                fillRect: () => {},
                drawImage: (img: any, x: number, y: number, w: number, h: number) => {
                  canvas._drawn = { img, x, y, w, h };
                },
              };
            }
            return null;
          },
          toDataURL: (mime = 'image/jpeg', quality = 0.75) => {
            canvas._exportedMime = mime;
            canvas._exportedQuality = quality;
            return `data:${mime};base64,mockCompressedImageData_w${canvas.width}_h${canvas.height}_q${quality}`;
          },
        };
        canvasInstances.push(canvas);
        return canvas;
      }
      return {};
    },
    getElementById: (id: string) => null,
  };

  return {
    canvasInstances,
    objectUrlMap,
  };
}

// ---------------------------------------------------------------------------
// In-Memory Wardrobe Database Implementation
// ---------------------------------------------------------------------------

export type WardrobeCategory = 'Top' | 'Bottom' | 'Shoes' | 'Outerwear' | 'Accessory';
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter' | 'All-Season';

export interface WardrobeItem {
  id: string;
  imageBase64: string;
  category: WardrobeCategory;
  color: string;
  season: Season | string;
  isClean: boolean;
  createdAt: number;
}

export type WardrobeItemMetadata = Omit<WardrobeItem, 'imageBase64'>;

export class InMemoryWardrobeRepository {
  private items = new Map<string, WardrobeItem>();

  async addItem(item: Omit<WardrobeItem, 'id' | 'isClean' | 'createdAt'> & { isClean?: boolean }): Promise<WardrobeItem> {
    const newItem: WardrobeItem = {
      id: crypto.randomUUID(),
      imageBase64: item.imageBase64,
      category: item.category,
      color: item.color,
      season: item.season,
      isClean: item.isClean ?? true,
      createdAt: Date.now(),
    };
    this.items.set(newItem.id, newItem);
    return { ...newItem };
  }

  async toggleCleanStatus(id: string, isClean: boolean): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      item.isClean = isClean;
    }
  }

  async deleteItem(id: string): Promise<void> {
    this.items.delete(id);
  }

  async getAllItems(): Promise<WardrobeItem[]> {
    return Array.from(this.items.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async getItemsByCategory(category: WardrobeCategory): Promise<WardrobeItem[]> {
    return Array.from(this.items.values())
      .filter((i) => i.category === category)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async getCleanItemsMetadata(): Promise<WardrobeItemMetadata[]> {
    return Array.from(this.items.values())
      .filter((item) => item.isClean === true)
      .map(({ imageBase64: _ignored, ...metadata }) => metadata);
  }

  async getItemsByIds(ids: string[]): Promise<WardrobeItem[]> {
    return ids.map((id) => this.items.get(id)).filter((item): item is WardrobeItem => item !== undefined);
  }

  async clearAllItems(): Promise<void> {
    this.items.clear();
  }

  async getWardrobeStats(): Promise<{
    total: number;
    cleanCount: number;
    dirtyCount: number;
    byCategory: Record<WardrobeCategory, number>;
  }> {
    const all = Array.from(this.items.values());
    const byCategory: Record<WardrobeCategory, number> = {
      Top: 0,
      Bottom: 0,
      Shoes: 0,
      Outerwear: 0,
      Accessory: 0,
    };
    let cleanCount = 0;
    let dirtyCount = 0;

    for (const item of all) {
      if (item.isClean) cleanCount++;
      else dirtyCount++;
      if (byCategory[item.category] !== undefined) {
        byCategory[item.category]++;
      }
    }

    return {
      total: all.length,
      cleanCount,
      dirtyCount,
      byCategory,
    };
  }
}
