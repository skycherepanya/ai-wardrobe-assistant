import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Camera, Image as ImageIcon, Loader2, X, Check, Sparkles } from 'lucide-react';
import {
  compressImageToBase64,
  type WardrobeCategory,
  type Season,
  type WardrobeItem,
} from '../../db/db';
import { analyzeClothingImage } from '../../services/geminiService';

interface CameraUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (item: Omit<WardrobeItem, 'id' | 'isClean' | 'createdAt'>) => Promise<unknown>;
}

const CATEGORIES: WardrobeCategory[] = ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessory'];
const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter', 'All-Season'];

export function CameraUploadModal({ isOpen, onClose, onSaved }: CameraUploadModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<WardrobeCategory>('Top');
  const [color, setColor] = useState('Black');
  const [season, setSeason] = useState<Season>('All-Season');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsAnalyzing(true);

    try {
      // 1. Client-side canvas compression to 800px max, 0.75 quality
      const compressed = await compressImageToBase64(file, 800, 0.75);
      setImagePreview(compressed);

      // 2. Call Gemini 2.5 Flash for auto-tagging
      const analysis = await analyzeClothingImage(compressed);
      if (analysis.category && CATEGORIES.includes(analysis.category)) {
        setCategory(analysis.category);
      }
      if (analysis.color) {
        setColor(analysis.color);
      }
      if (analysis.season) {
        setSeason((analysis.season as Season) || 'All-Season');
      }
    } catch (err: unknown) {
      console.warn('[CameraUploadModal] Auto-tagging warning:', err);
      const message = err instanceof Error ? err.message : 'Could not auto-tag with Gemini.';
      setError(`${message} You can set tags manually below.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!imagePreview) return;
    setIsSaving(true);
    try {
      await onSaved({
        imageBase64: imagePreview,
        category,
        color,
        season,
      });
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setImagePreview(null);
    setError(null);
    setIsAnalyzing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-sky-400" />
            <h2 className="font-semibold text-zinc-100 text-sm">Add New Clothing Item</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {!imagePreview ? (
            <div className="space-y-3">
              <div className="p-8 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Take or Upload a Photo</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Gemini 2.5 Flash will automatically identify category, color, and season.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-medium text-xs shadow-md transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs border border-zinc-700 transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  Photo Library
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image preview with analyzing badge */}
              <div className="relative rounded-2xl overflow-hidden aspect-square bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Clothing preview"
                  className="w-full h-full object-cover"
                />

                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-zinc-200">
                    <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                    <span className="text-xs font-medium flex items-center gap-1.5 text-sky-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      Gemini 2.5 Flash Analyzing...
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-300">
                  {error}
                </div>
              )}

              {/* Tag confirmation & editing */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          category === cat
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                            : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:bg-zinc-800'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                      Dominant Color
                    </label>
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                      Season
                    </label>
                    <select
                      value={season}
                      onChange={(e) => setSeason(e.target.value as Season)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                    >
                      {SEASONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isAnalyzing}
                  className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-sky-500/20"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save to Wardrobe
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
