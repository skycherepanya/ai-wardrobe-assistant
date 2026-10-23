import { useState, useEffect } from 'react';
import {
  Sparkles,
  CloudSun,
  Loader2,
  Check,
  Shirt,
  AlertCircle,
} from 'lucide-react';
import type { WardrobeItem } from '../../db/db';
import {
  generateDailyOutfit,
  serializeCleanWardrobeForPrompt,
  type WeatherContext,
} from '../../services/geminiService';
import { fetchCurrentWeather } from '../../services/weatherService';

interface DailyFitDashboardProps {
  cleanItems: WardrobeItem[];
  allItems: WardrobeItem[];
  onMarkWorn: (ids: string[]) => Promise<void>;
  onOpenSettings: () => void;
  onOpenAddModal: () => void;
}

const CACHE_KEY = 'sardrobe_today_outfit_ids';

export function DailyFitDashboard({
  cleanItems,
  allItems,
  onMarkWorn,
  onOpenSettings,
  onOpenAddModal,
}: DailyFitDashboardProps) {
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [outfitIds, setOutfitIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wornSuccess, setWornSuccess] = useState(false);

  // Fetch weather on mount
  useEffect(() => {
    fetchCurrentWeather().then(setWeather);
  }, []);

  // Restore cached outfit from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setOutfitIds(JSON.parse(cached));
      }
    } catch {
      // Ignore cache parse error
    }
  }, []);

  const handleGenerate = async () => {
    if (cleanItems.length === 0) {
      setError('You have no clean items in your wardrobe! Add items or mark some as clean.');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setWornSuccess(false);

    try {
      // Serialize clean items without heavy imageBase64 strings
      const cleanJson = serializeCleanWardrobeForPrompt(cleanItems);
      const generatedIds = await generateDailyOutfit(cleanJson, weather ?? undefined);

      if (generatedIds.length === 0) {
        throw new Error('Gemini could not find a matching combination from clean clothes.');
      }

      setOutfitIds(generatedIds);
      localStorage.setItem(CACHE_KEY, JSON.stringify(generatedIds));
    } catch (err: unknown) {
      console.error('[DailyFitDashboard] Generation error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to generate outfit.';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWearOutfit = async () => {
    if (outfitIds.length === 0) return;
    try {
      await onMarkWorn(outfitIds);
      setWornSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark outfit as worn.');
    }
  };

  // Hydrate outfit item objects from allItems
  const outfitItems = outfitIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is WardrobeItem => item !== undefined);

  return (
    <div className="space-y-4">
      {/* Weather Header Widget */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CloudSun className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-200">
              {weather ? `${weather.temperatureCelsius}°C • ${weather.condition}` : 'Loading weather...'}
            </h3>
            <p className="text-[11px] text-zinc-400">
              Clean items available: <span className="text-emerald-400 font-medium">{cleanItems.length}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || cleanItems.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs transition-all shadow-md shadow-sky-500/15"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{outfitItems.length > 0 ? 'Re-roll' : 'Style Me'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          {error.includes('API Key') && (
            <button
              onClick={onOpenSettings}
              className="underline text-[11px] text-rose-200 font-medium shrink-0"
            >
              Add Key
            </button>
          )}
        </div>
      )}

      {/* Outfit Presentation */}
      {isGenerating ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
          <p className="text-xs font-medium text-zinc-300">
            Gemini 2.5 Flash is coordinating an outfit for today...
          </p>
        </div>
      ) : outfitItems.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Today's Recommended Outfit
            </h2>
            <span className="text-[11px] text-zinc-500">{outfitItems.length} Pieces</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {outfitItems.map((item) => (
              <div
                key={item.id}
                className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/90 shadow-sm"
              >
                <div className="aspect-square bg-zinc-950 overflow-hidden">
                  <img
                    src={item.imageBase64}
                    alt={item.category}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/70 backdrop-blur-md text-zinc-200 border border-white/10">
                      {item.category}
                    </span>
                  </div>
                </div>
                <div className="p-2 text-xs flex justify-between items-center text-zinc-400">
                  <span className="font-medium text-zinc-200">{item.color}</span>
                  <span className="text-[10px] text-zinc-500">{item.season}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Action to mark outfit as worn */}
          <div className="pt-2">
            {wornSuccess ? (
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>Outfit marked as worn & moved to laundry!</span>
              </div>
            ) : (
              <button
                onClick={handleWearOutfit}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Shirt className="w-4 h-4 text-sky-400" />
                Wear This Outfit Today (Move to Laundry)
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600">
            <Sparkles className="w-6 h-6 text-sky-400/60" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300">No outfit generated yet</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Tap "Style Me" to have Gemini create a coordinated look based on current weather and clean clothes.
            </p>
          </div>
          {cleanItems.length === 0 && (
            <button
              onClick={onOpenAddModal}
              className="mt-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs border border-zinc-700 transition-colors"
            >
              Add Clothes to Closet
            </button>
          )}
        </div>
      )}
    </div>
  );
}
