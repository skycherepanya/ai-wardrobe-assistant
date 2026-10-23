import { Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { WardrobeItem } from '../../db/db';

interface WardrobeCardProps {
  item: WardrobeItem;
  onToggleClean: (id: string, isClean: boolean) => void;
  onDelete: (id: string) => void;
}

export function WardrobeCard({ item, onToggleClean, onDelete }: WardrobeCardProps) {
  return (
    <div className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-sm transition-all hover:border-zinc-700">
      {/* Image Container */}
      <div className="relative aspect-[4/5] bg-zinc-950 overflow-hidden">
        <img
          src={item.imageBase64}
          alt={item.category}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Category & Season Pill */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 backdrop-blur-md text-zinc-200 border border-white/10">
            {item.category}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-normal bg-black/50 backdrop-blur-md text-zinc-300 border border-white/10">
            {item.season}
          </span>
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Delete this item from wardrobe?')) {
              onDelete(item.id);
            }
          }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-md text-zinc-400 hover:text-rose-400 hover:bg-black/70 border border-white/10 transition-colors"
          title="Delete item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Laundry Quick-Toggle Badge */}
        <div className="absolute bottom-2 left-2 right-2">
          <button
            onClick={() => onToggleClean(item.id, !item.isClean)}
            className={`w-full py-1.5 px-2.5 rounded-xl text-[11px] font-medium backdrop-blur-md border flex items-center justify-center gap-1.5 transition-all shadow-sm ${
              item.isClean
                ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-amber-950/70 border-amber-700/60 text-amber-300 hover:bg-amber-900/80'
            }`}
          >
            {item.isClean ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Clean</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>In Laundry</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Card Info footer */}
      <div className="p-2.5 flex flex-col gap-0.5 text-xs text-zinc-400">
        <div className="flex items-center justify-between">
          <span className="truncate font-medium text-zinc-200">
            {item.name || item.color}
          </span>
          {item.isCutout && (
            <span className="text-[10px] text-purple-400 font-medium">✨ Studio</span>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>{item.brand || item.color}</span>
          <span>{item.color !== item.name ? item.color : ''}</span>
        </div>
      </div>
    </div>
  );
}
