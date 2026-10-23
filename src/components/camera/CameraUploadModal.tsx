import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  X,
  Check,
  Sparkles,
  Wand2,
  ExternalLink,
  RotateCcw,
  Globe,
  Tag,
} from 'lucide-react';
import {
  compressImageToBase64,
  type WardrobeCategory,
  type Season,
  type WardrobeItem,
} from '../../db/db';
import { analyzeClothingImage } from '../../services/geminiService';
import { processStudioCutout } from '../../utils/backgroundRemoval';

interface CameraUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (item: Omit<WardrobeItem, 'id' | 'isClean' | 'createdAt'>) => Promise<unknown>;
}

const CATEGORIES: WardrobeCategory[] = ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessory'];
const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter', 'All-Season'];

export function CameraUploadModal({ isOpen, onClose, onSaved }: CameraUploadModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalSnap, setOriginalSnap] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCuttingOut, setIsCuttingOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<WardrobeCategory>('Top');
  const [color, setColor] = useState('Black');
  const [season, setSeason] = useState<Season>('All-Season');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCutoutApplied, setIsCutoutApplied] = useState(false);

  // Web catalog URL paste drawer
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [catalogUrl, setCatalogUrl] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsAnalyzing(true);
    setIsCutoutApplied(false);

    try {
      // 1. Client-side canvas compression to 800px max, 0.75 quality
      const compressed = await compressImageToBase64(file, 800, 0.75);
      setImagePreview(compressed);
      setOriginalSnap(compressed);

      // 2. Call Gemini 2.5 Flash for deep auto-tagging & product identification
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
      if (analysis.name) {
        setName(analysis.name);
      }
      if (analysis.brand) {
        setBrand(analysis.brand);
      }
      if (analysis.searchQuery) {
        setSearchQuery(analysis.searchQuery);
      } else {
        setSearchQuery(`${analysis.brand || ''} ${analysis.name || ''} ${analysis.color || ''} product photo`.trim());
      }
    } catch (err: unknown) {
      console.warn('[CameraUploadModal] Auto-tagging warning:', err);
      const message = err instanceof Error ? err.message : 'Could not auto-tag with Gemini.';
      setError(`${message} You can set tags manually below.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Magic Background Cutout Handler
  const handleMagicCutout = async () => {
    if (!imagePreview) return;
    setIsCuttingOut(true);
    try {
      const sourceImage = originalSnap || imagePreview;
      const cutout = await processStudioCutout(sourceImage, {
        sensitivity: 35,
        studioBackground: 'studio-white',
      });
      setImagePreview(cutout);
      setIsCutoutApplied(true);
    } catch (err: unknown) {
      console.warn('[CameraUploadModal] Cutout error:', err);
      setError('Could not remove background automatically. Keeping current image.');
    } finally {
      setIsCuttingOut(false);
    }
  };

  const handleRevertCutout = () => {
    if (originalSnap) {
      setImagePreview(originalSnap);
      setIsCutoutApplied(false);
    }
  };

  // Open Google Image Search in new tab
  const handleOpenWebSearch = () => {
    const query = searchQuery || `${brand} ${name} ${color} ${category} product photo`;
    const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  };

  // Fetch image from URL and convert to base64
  const handleApplyCatalogUrl = async () => {
    if (!catalogUrl.trim()) return;
    setIsLoadingUrl(true);
    setError(null);
    try {
      const response = await fetch(catalogUrl.trim());
      if (!response.ok) throw new Error('Could not download image from the provided URL.');
      const blob = await response.blob();
      const file = new File([blob], 'catalog_image.jpg', { type: blob.type });
      const compressed = await compressImageToBase64(file, 800, 0.85);
      setImagePreview(compressed);
      setShowUrlInput(false);
      setCatalogUrl('');
    } catch (err: unknown) {
      console.warn('[CameraUploadModal] URL fetch error:', err);
      setError('CORS or network error loading image from URL. You can download it to Photos and upload instead.');
    } finally {
      setIsLoadingUrl(false);
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
        name: name.trim() || undefined,
        brand: brand.trim() || undefined,
        isCutout: isCutoutApplied,
        searchQuery: searchQuery.trim() || undefined,
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
    setOriginalSnap(null);
    setError(null);
    setIsAnalyzing(false);
    setIsCutoutApplied(false);
    setName('');
    setBrand('');
    setSearchQuery('');
    setShowUrlInput(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-sky-400" />
            <h2 className="font-semibold text-zinc-100 text-sm">Add & Standardize Item</h2>
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
                  <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                    Snap clothing on your bed/floor — AI will auto-tag, clean the background, or match catalog photos.
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
              <div className="relative rounded-2xl overflow-hidden aspect-square bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-inner">
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
                      Gemini 2.5 Flash Identifying...
                    </span>
                  </div>
                )}

                {isCuttingOut && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-zinc-200">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    <span className="text-xs font-medium flex items-center gap-1.5 text-purple-300">
                      <Wand2 className="w-3.5 h-3.5" />
                      Cleaning Background to Studio Look...
                    </span>
                  </div>
                )}

                {/* Cutout badge */}
                {isCutoutApplied && !isCuttingOut && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-950/80 border border-purple-700 text-purple-300 backdrop-blur-md">
                    ✨ Studio Cleaned
                  </span>
                )}
              </div>

              {/* Photo Standardization Action Toolbar */}
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    Standardization Tools
                  </span>
                  {isCutoutApplied ? (
                    <button
                      type="button"
                      onClick={handleRevertCutout}
                      className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Revert
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleMagicCutout}
                    disabled={isCuttingOut || isAnalyzing}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800/60 text-purple-300 text-[11px] font-medium transition-colors"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Clean Background
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenWebSearch}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors"
                    title="Search product on Google Images"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                    Find Catalog Photo
                  </button>
                </div>

                {/* Paste Catalog URL Option */}
                <div className="pt-1">
                  {!showUrlInput ? (
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(true)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                    >
                      <Globe className="w-3 h-3" /> Or paste direct image link from brand website
                    </button>
                  ) : (
                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="url"
                        placeholder="Paste image URL (https://...)"
                        value={catalogUrl}
                        onChange={(e) => setCatalogUrl(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-[11px] text-zinc-200 focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCatalogUrl}
                        disabled={isLoadingUrl}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-500 text-zinc-950 font-medium text-[11px] hover:bg-sky-400 transition-colors"
                      >
                        {isLoadingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(false)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-300">
                  {error}
                </div>
              )}

              {/* Tag confirmation & editing */}
              <div className="space-y-3 pt-1">
                {/* Brand & Item Name */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400 block mb-1 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Brand / Maker
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Uniqlo, Zara"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                      Item Name / Style
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Heavyweight Tee"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

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
