export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'dexie') {
    return {
      url: new URL('./mock_dexie.ts', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === '@google/genai') {
    return {
      url: new URL('./mock_genai.ts', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (typeof result.source === 'string' || Buffer.isBuffer(result.source)) {
    let source = result.source.toString();
    if (url.includes('/src/') || url.includes('/tests/')) {
      source = `if (typeof import.meta.env === 'undefined') { Object.defineProperty(import.meta, 'env', { get: () => globalThis.__VITE_ENV__ || {}, configurable: true }); }\n` + source;
      return {
        ...result,
        source,
      };
    }
  }
  return result;
}
