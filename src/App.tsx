import { useState, useEffect } from 'react';
import {
  Shirt,
  Sparkles,
  Settings as SettingsIcon,
  Plus,
  Smartphone,
} from 'lucide-react';
import { requestPersistentStorage } from './db/db';
import { useWardrobe } from './hooks/useWardrobe';
import { WardrobeGrid } from './components/wardrobe/WardrobeGrid';
import { DailyFitDashboard } from './components/dashboard/DailyFitDashboard';
import { CameraUploadModal } from './components/camera/CameraUploadModal';
import { SettingsModal } from './components/settings/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'wardrobe' | 'dailyfit' | 'settings'>('wardrobe');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  const {
    items,
    cleanItems,
    isLoading,
    addItem,
    toggleClean,
    deleteItem,
    markOutfitWorn,
    markAllClean,
  } = useWardrobe();

  useEffect(() => {
    // Check iOS standalone mode
    const checkStandalone = () => {
      const standaloneQuery = window.matchMedia('(display-mode: standalone)').matches;
      const navigatorStandalone = Boolean(
        (navigator as unknown as { standalone?: boolean }).standalone
      );
      setIsStandalone(standaloneQuery || navigatorStandalone);
    };
    checkStandalone();

    // Check storage persistence
    const checkStorage = async () => {
      if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
        try {
          const persisted = await navigator.storage.persisted();
          setIsPersisted(persisted);
        } catch {
          setIsPersisted(false);
        }
      }
    };
    checkStorage();
  }, []);

  const handleRequestStorage = async () => {
    try {
      const granted = await requestPersistentStorage();
      setIsPersisted(granted);
    } catch {
      setIsPersisted(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800">
      {/* Top Header with iOS Safe Area Spacing */}
      <header className="sticky top-0 z-40 ios-glass border-b border-zinc-800/80 px-4 pt-safe-top pb-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-700/60 shadow-inner">
              <Shirt className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-white leading-tight">
                Sardrobe
              </h1>
              <p className="text-[10px] text-zinc-400">AI Wardrobe Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                isStandalone
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              {isStandalone ? 'iOS Standalone' : 'Browser Mode'}
            </span>

            <button
              onClick={() => {
                setActiveTab('settings');
                setIsSettingsOpen(true);
              }}
              className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
              title="Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 pb-28 space-y-4">
        {isLoading ? (
          <div className="py-20 text-center text-xs text-zinc-500">
            Loading your wardrobe...
          </div>
        ) : activeTab === 'dailyfit' ? (
          <DailyFitDashboard
            cleanItems={cleanItems}
            allItems={items}
            onMarkWorn={markOutfitWorn}
            onOpenSettings={() => {
              setActiveTab('settings');
              setIsSettingsOpen(true);
            }}
            onOpenAddModal={() => setIsCameraOpen(true)}
          />
        ) : (
          <WardrobeGrid
            items={items}
            onToggleClean={toggleClean}
            onDelete={deleteItem}
            onOpenAddModal={() => setIsCameraOpen(true)}
            onMarkAllClean={markAllClean}
          />
        )}
      </main>

      {/* iOS Translucent Glass Bottom Navigation + Central Camera FAB */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 ios-glass border-t border-zinc-800/80 px-6 pt-2 pb-safe-bottom">
        <div className="max-w-md mx-auto flex items-center justify-around relative py-1">
          {/* Tab 1: Wardrobe Closet */}
          <button
            onClick={() => setActiveTab('wardrobe')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'wardrobe' ? 'text-sky-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Shirt className="w-5 h-5" />
            <span className="text-[10px] font-medium">Closet ({items.length})</span>
          </button>

          {/* Central Floating Camera Action Button */}
          <div className="relative -top-5">
            <button
              onClick={() => setIsCameraOpen(true)}
              className="w-13 h-13 rounded-full bg-gradient-to-tr from-sky-500 to-sky-400 text-zinc-950 flex items-center justify-center shadow-lg shadow-sky-500/30 hover:scale-105 active:scale-95 transition-transform"
              title="Add clothing item"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* Tab 2: Daily Fit */}
          <button
            onClick={() => setActiveTab('dailyfit')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'dailyfit' ? 'text-sky-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-medium">Daily Fit</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <CameraUploadModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSaved={addItem}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          if (activeTab === 'settings') setActiveTab('wardrobe');
        }}
        isStandalone={isStandalone}
        isPersisted={isPersisted}
        onRefreshPersistence={handleRequestStorage}
      />
    </div>
  );
}
