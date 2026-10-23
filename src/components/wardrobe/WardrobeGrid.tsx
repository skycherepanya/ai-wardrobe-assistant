import { useState } from 'react';
import { Plus, Shirt, CheckCheck } from 'lucide-react';
import { WardrobeCard } from './WardrobeCard';
import type { WardrobeItem, WardrobeCategory } from '../../db/db';

interface WardrobeGridProps {
  items: WardrobeItem[];
  onToggleClean: (id: string, isClean: boolean) => void;
  onDelete: (id: string) => void;
  onOpenAddModal: () => void;
  onMarkAllClean: () => void;
}

const CATEGORIES: (WardrobeCategory | 'All')[] = [
  'All',
  'Top',
  'Bottom',
  'Shoes',
  'Outerwear',
  'Accessory',
];

export function WardrobeGrid({
  items,
  onToggleClean,
  onDelete,
  onOpenAddModal,
  onMarkAllClean,
}: WardrobeGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<WardrobeCategory | 'All'>('All');
  const [laundryFilter, setLaundryFilter] = useState<'all' | 'clean' | 'dirty'>('all');

  const filteredItems = items.filter((item) => {
    const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchLaundry =
      laundryFilter === 'all' ||
      (laundryFilter === 'clean' && item.isClean) ||
      (laundryFilter === 'dirty' && !item.isClean);
    return matchCategory && matchLaundry;
  });

  const dirtyCount = items.filter((i) => !i.isClean).length;

  return (
    <div className="space-y-4">
      {/* Category Filter Chips (horizontal scroll) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              selectedCategory === cat
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Laundry filter and Wash All */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setLaundryFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              laundryFilter === 'all' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-500'
            }`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setLaundryFilter('clean')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              laundryFilter === 'clean' ? 'bg-emerald-950/60 text-emerald-300 font-medium' : 'text-zinc-500'
            }`}
          >
            Clean ({items.length - dirtyCount})
          </button>
          <button
            onClick={() => setLaundryFilter('dirty')}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              laundryFilter === 'dirty' ? 'bg-amber-950/60 text-amber-300 font-medium' : 'text-zinc-500'
            }`}
          >
            Laundry ({dirtyCount})
          </button>
        </div>

        {dirtyCount > 0 && (
          <button
            onClick={onMarkAllClean}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-900/40 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Wash All
          </button>
        )}
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600">
            <Shirt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300">
              {items.length === 0 ? 'No items in your wardrobe yet' : 'No items match your filter'}
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              {items.length === 0
                ? 'Take a photo of your clothes to start generating outfits.'
                : 'Try changing category or laundry filters.'}
            </p>
          </div>
          {items.length === 0 && (
            <button
              onClick={onOpenAddModal}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-medium text-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Item
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((item) => (
            <WardrobeCard
              key={item.id}
              item={item}
              onToggleClean={onToggleClean}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
