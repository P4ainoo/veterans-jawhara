import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="w-full h-14 rounded-2xl bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-all flex items-center justify-center gap-3 font-headline text-sm uppercase tracking-widest"
      >
        <Download size={18} />
        Download Tactical App
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="w-full h-14 rounded-2xl bg-white/5 text-white/60 border border-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-3 font-headline text-sm uppercase tracking-widest"
        >
          <Smartphone size={18} />
          Install on iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
            <div className="w-full max-w-sm rounded-[2.5rem] bg-[#12141D] border border-white/10 p-8 shadow-3xl relative">
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Smartphone className="text-primary" size={32} />
                </div>
                
                <h3 className="text-xl font-headline text-white uppercase tracking-tight mb-2">Tactical Deployment</h3>
                <p className="text-sm text-white/40 mb-8 leading-relaxed">
                  Follow these protocols to install Jawhara Hub on your home screen:
                </p>

                <div className="w-full space-y-4 text-left">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-black shrink-0">1</div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      Tap the <span className="text-primary font-bold">Share</span> icon in the Safari toolbar.
                    </p>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-black shrink-0">2</div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      Scroll down and select <span className="text-primary font-bold">Add to Home Screen</span>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="mt-10 w-full h-14 rounded-2xl bg-white/5 text-white/60 font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback if PWA is not auto-detectable but likely supported (like Desktop Chrome without prompt yet)
  return (
    <button
      onClick={() => alert("To install this app, please use the 'Install' icon in your browser's address bar or the 'Add to Home Screen' option in your browser menu.")}
      className="w-full h-14 rounded-2xl bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-3 font-headline text-sm uppercase tracking-widest"
    >
      <Smartphone size={18} />
      Installation Manual
    </button>
  );
};
