import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X, Key, ShieldCheck, Check, Smartphone } from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey } from '../../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStandalone: boolean;
  isPersisted: boolean | null;
  onRefreshPersistence: () => Promise<void>;
}

export function SettingsModal({
  isOpen,
  onClose,
  isStandalone,
  isPersisted,
  onRefreshPersistence,
}: SettingsModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        setApiKeyInput(getGeminiApiKey());
      } catch {
        setApiKeyInput('');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveKey = (e: FormEvent) => {
    e.preventDefault();
    setGeminiApiKey(apiKeyInput.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-sky-400" />
            <h2 className="font-semibold text-zinc-100 text-sm">Settings & API Key</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Gemini API Key Section (BYOK) */}
          <form onSubmit={handleSaveKey} className="space-y-3">
            <div>
              <label className="text-zinc-300 font-medium block mb-1">
                Gemini API Key (BYOK)
              </label>
              <p className="text-zinc-500 text-[11px] mb-2 leading-relaxed">
                Stored purely in your device's browser/Homescreen localStorage. Never sent to any third-party server.
              </p>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {savedSuccess ? (
                <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                  <Check className="w-3.5 h-3.5" /> Key Saved!
                </span>
              ) : (
                <span className="text-zinc-500 text-[10px]">Model: gemini-2.5-flash</span>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-xs transition-colors"
              >
                Save Key
              </button>
            </div>
          </form>

          {/* Device & Storage Info */}
          <div className="space-y-2 pt-3 border-t border-zinc-800">
            <h3 className="text-zinc-300 font-semibold">Device & Storage Architecture</h3>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
                  PWA Mode
                </span>
                <span className="font-medium text-zinc-200">
                  {isStandalone ? 'iOS Standalone' : 'Browser Mode'}
                </span>
              </div>

              <div className="flex justify-between items-center text-zinc-400 pt-1.5 border-t border-zinc-800/60">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
                  WebKit Storage Eviction Defense
                </span>
                <span className="font-medium text-emerald-400">
                  {isPersisted ? 'Active' : 'Requested'}
                </span>
              </div>

              {!isPersisted && (
                <button
                  type="button"
                  onClick={onRefreshPersistence}
                  className="w-full mt-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors"
                >
                  Request WebKit Persistence
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
