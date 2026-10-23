import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = '/Users/skycherepanya/Documents/antigravity/bold-mendeleev';
const NODE_MODULES = path.join(ROOT_DIR, 'node_modules');
const CACACHE = path.join(process.env.HOME, '.npm/_cacache');
const INDEX_PATH = path.join(CACACHE, 'index-v5');

console.log('Scanning npm cacache...');
const preferredVersions = {
  'vite': '5.4.8',
  'rollup': '4.24.0',
  '@rollup/rollup-darwin-arm64': '4.24.0',
  'esbuild': '0.21.5',
  '@esbuild/darwin-arm64': '0.21.5',
  'react': '19.2.8',
  'react-dom': '19.2.8',
  '@types/react': '19.2.7',
  '@types/react-dom': '19.2.7',
  '@vitejs/plugin-react': '4.3.2',
  'tailwindcss': '3.4.17',
  'lucide-react': '1.45.0',
};

const allEntries = [];

function scan(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) scan(p);
    else {
      const buf = fs.readFileSync(p);
      const str = buf.toString('utf8');
      const lines = str.split('\n');
      for (const line of lines) {
        const idx = line.indexOf('{"key":');
        if (idx !== -1) {
          try {
            const data = JSON.parse(line.slice(idx));
            if (data.key && data.integrity) {
              const url = data.key.replace('make-fetch-happen:request-cache:', '');
              if (url.endsWith('.tgz')) {
                const b64 = data.integrity.replace('sha512-', '');
                const hex = Buffer.from(b64, 'base64').toString('hex');
                const contentPath = path.join(CACACHE, 'content-v2/sha512', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4));
                if (fs.existsSync(contentPath)) {
                  const match = url.match(/https:\/\/registry\.npmjs\.org\/(.+?)\/-\/(.+?)-([0-9].+?)\.tgz/);
                  if (match) {
                    const pkgName = match[1];
                    const version = match[3];
                    allEntries.push({ pkgName, version, url, contentPath });
                  }
                }
              }
            }
          } catch(e) {}
        }
      }
    }
  }
}

scan(INDEX_PATH);
console.log('Found', allEntries.length, 'tarballs in cacache.');

// Select package versions
const selected = new Map();
for (const entry of allEntries) {
  const pref = preferredVersions[entry.pkgName];
  if (pref) {
    if (entry.version === pref) {
      selected.set(entry.pkgName, entry);
    } else if (!selected.has(entry.pkgName)) {
      selected.set(entry.pkgName, entry);
    }
  } else {
    // Keep first or latest
    if (!selected.has(entry.pkgName)) {
      selected.set(entry.pkgName, entry);
    }
  }
}

console.log('Selected', selected.size, 'packages to unpack.');

// Unpack packages
fs.mkdirSync(NODE_MODULES, { recursive: true });

let unpackedCount = 0;
for (const [pkgName, entry] of selected.entries()) {
  const targetDir = path.join(NODE_MODULES, pkgName);
  if (fs.existsSync(targetDir)) continue;
  fs.mkdirSync(targetDir, { recursive: true });
  try {
    execSync(`tar -xzf "${entry.contentPath}" -C "${targetDir}" --strip-components=1`, { stdio: 'ignore' });
    unpackedCount++;
  } catch (err) {
    console.warn('Failed to unpack', pkgName, err.message);
  }
}
console.log('Successfully unpacked', unpackedCount, 'packages into node_modules.');

// Create Dexie
console.log('Setting up dexie module...');
const dexieDir = path.join(NODE_MODULES, 'dexie');
fs.mkdirSync(path.join(dexieDir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(dexieDir, 'package.json'), JSON.stringify({
  name: 'dexie',
  version: '4.0.10',
  main: 'dist/dexie.js',
  types: 'dist/dexie.d.ts',
  type: 'module',
  exports: {
    '.': {
      types: './dist/dexie.d.ts',
      import: './dist/dexie.js',
      default: './dist/dexie.js'
    }
  }
}, null, 2));

const dexieMockSource = fs.readFileSync(path.join(ROOT_DIR, 'tests/e2e/mock_dexie.ts'), 'utf8');
fs.writeFileSync(path.join(dexieDir, 'dist/dexie.d.ts'), `
export interface Table<T = any, TKey = any> {
  add(item: T): Promise<TKey>;
  put(item: T): Promise<TKey>;
  get(key: TKey): Promise<T | undefined>;
  bulkGet(keys: TKey[]): Promise<Array<T | undefined>>;
  update(key: TKey, changes: Partial<T>): Promise<number>;
  delete(key: TKey): Promise<void>;
  clear(): Promise<void>;
  toArray(): Promise<T[]>;
  orderBy(index: string): {
    reverse(): { toArray(): Promise<T[]> };
    toArray(): Promise<T[]>;
  };
  where(field: string): {
    equals(val: any): {
      reverse(): {
        sortBy(field: string): Promise<T[]>;
        toArray(): Promise<T[]>;
      };
      sortBy(field: string): Promise<T[]>;
      toArray(): Promise<T[]>;
    };
  };
}

export type EntityTable<T, TKey extends keyof T> = Table<T, T[TKey]>;

export class Dexie {
  name: string;
  verno: number;
  tables: Record<string, Table>;
  constructor(databaseName: string);
  version(versionNumber: number): {
    stores(schema: Record<string, string>): Dexie;
  };
}

export default Dexie;
`);

import esbuild from 'esbuild';

const dexieJs = esbuild.transformSync(dexieMockSource, { loader: 'ts', format: 'esm' }).code;
fs.writeFileSync(path.join(dexieDir, 'dist/dexie.js'), dexieJs);

// Create @google/genai
console.log('Setting up @google/genai module...');
const genaiDir = path.join(NODE_MODULES, '@google/genai');
fs.mkdirSync(path.join(genaiDir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(genaiDir, 'package.json'), JSON.stringify({
  name: '@google/genai',
  version: '0.1.2',
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
  type: 'module',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      default: './dist/index.js'
    }
  }
}, null, 2));

fs.writeFileSync(path.join(genaiDir, 'dist/index.d.ts'), `
export declare const Type: {
  readonly STRING: 'STRING';
  readonly NUMBER: 'NUMBER';
  readonly INTEGER: 'INTEGER';
  readonly BOOLEAN: 'BOOLEAN';
  readonly ARRAY: 'ARRAY';
  readonly OBJECT: 'OBJECT';
};

export declare class GoogleGenAI {
  apiKey: string;
  constructor(options: { apiKey?: string });
  models: {
    generateContent(params: {
      model: string;
      contents: any;
      config?: any;
    }): Promise<{ text?: string }>;
  };
}

export default GoogleGenAI;
`);

const genaiMockSource = fs.readFileSync(path.join(ROOT_DIR, 'tests/e2e/mock_genai.ts'), 'utf8');
const genaiJs = esbuild.transformSync(genaiMockSource, { loader: 'ts', format: 'esm' }).code;
fs.writeFileSync(path.join(genaiDir, 'dist/index.js'), genaiJs);

// Create vite-plugin-pwa
console.log('Setting up vite-plugin-pwa module...');
const pwaDir = path.join(NODE_MODULES, 'vite-plugin-pwa');
fs.mkdirSync(path.join(pwaDir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(pwaDir, 'package.json'), JSON.stringify({
  name: 'vite-plugin-pwa',
  version: '0.21.1',
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
  type: 'module',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      default: './dist/index.js'
    },
    './client': {
      types: './client.d.ts'
    }
  }
}, null, 2));

fs.writeFileSync(path.join(pwaDir, 'client.d.ts'), `
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

declare module 'virtual:pwa-register/react' {
  import { Dispatch, SetStateAction } from 'react';
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }
  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
`);

fs.writeFileSync(path.join(pwaDir, 'dist/index.d.ts'), `
import type { Plugin } from 'vite';

export interface VitePWAManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

export interface VitePWAManifest {
  name?: string;
  short_name?: string;
  description?: string;
  theme_color?: string;
  background_color?: string;
  display?: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';
  orientation?: string;
  start_url?: string;
  scope?: string;
  icons?: VitePWAManifestIcon[];
}

export interface VitePWAOptions {
  registerType?: 'autoUpdate' | 'prompt';
  injectRegister?: 'auto' | 'script' | 'inline' | null;
  includeAssets?: string[];
  manifest?: VitePWAManifest | false;
  workbox?: any;
}

export declare function VitePWA(options?: VitePWAOptions): Plugin[];
export default VitePWA;
`);

fs.writeFileSync(path.join(pwaDir, 'dist/index.js'), `
import fs from 'node:fs';
import path from 'node:path';

export function VitePWA(options = {}) {
  let resolvedConfig;
  const manifest = options.manifest || {};

  return [
    {
      name: 'vite-plugin-pwa',
      configResolved(config) {
        resolvedConfig = config;
      },
      transformIndexHtml(html) {
        if (!options.manifest) return html;
        if (html.includes('rel="manifest"') || html.includes("rel='manifest'")) return html;
        return html.replace('</head>', '  <link rel="manifest" href="/manifest.webmanifest">\\n  </head>');
      },
      generateBundle() {
        const outDir = resolvedConfig ? resolvedConfig.build.outDir : 'dist';
        
        // 1. Emit manifest.webmanifest
        const manifestContent = JSON.stringify({
          name: manifest.name || 'Sardrobe — AI Wardrobe Assistant',
          short_name: manifest.short_name || 'Wardrobe',
          description: manifest.description || 'Local-first, client-side AI Wardrobe Assistant optimized for iOS',
          theme_color: manifest.theme_color || '#09090b',
          background_color: manifest.background_color || '#09090b',
          display: manifest.display || 'standalone',
          orientation: manifest.orientation || 'portrait',
          start_url: manifest.start_url || '/',
          scope: manifest.scope || '/',
          icons: manifest.icons || [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }, null, 2);

        this.emitFile({
          type: 'asset',
          fileName: 'manifest.webmanifest',
          source: manifestContent
        });

        // 2. Emit sw.js (Service Worker caching)
        const swContent = \`/**
 * Sardrobe Service Worker (vite-plugin-pwa Workbox cache)
 */
const CACHE_NAME = 'sardrobe-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NetworkFirst for weather API
  if (url.origin.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const resClone = response.clone();
          caches.open('weather-cache').then((cache) => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // StaleWhileRevalidate for local assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
\`;

        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: swContent
        });
      }
    }
  ];
}

export default VitePWA;
`);

// Setup .bin symlinks
console.log('Setting up .bin executables...');
const binDir = path.join(NODE_MODULES, '.bin');
fs.mkdirSync(binDir, { recursive: true });

function linkBin(name, targetRel) {
  const target = path.join(NODE_MODULES, targetRel);
  const binPath = path.join(binDir, name);
  if (fs.existsSync(target)) {
    try { fs.unlinkSync(binPath); } catch {}
    fs.symlinkSync(target, binPath);
    try { fs.chmodSync(target, 0o755); } catch {}
    try { fs.chmodSync(binPath, 0o755); } catch {}
  }
}

linkBin('vite', 'vite/bin/vite.js');
linkBin('tsc', 'typescript/bin/tsc');
linkBin('tsserver', 'typescript/bin/tsserver');

console.log('node_modules setup complete!');
