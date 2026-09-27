import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

type FeedbackTone = 'success' | 'error' | 'info';

interface FeedbackToastProps {
  message: string;
  tone: FeedbackTone;
  onClose: () => void;
  duration?: number;
}

export const FeedbackToast: React.FC<FeedbackToastProps> = ({ message, tone, onClose, duration = 4200 }) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info;

  return (
    <div
      role="status"
      className={cn(
        'fixed right-4 top-4 z-[300] flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl',
        tone === 'success' && 'border-primary/30 bg-[#0d2418]/95 text-primary',
        tone === 'error' && 'border-red-400/30 bg-[#291619]/95 text-red-200',
        tone === 'info' && 'border-secondary/30 bg-[#10242a]/95 text-secondary'
      )}
    >
      <Icon size={20} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-semibold leading-snug text-white/90">{message}</p>
      <button onClick={onClose} aria-label="Fermer" className="shrink-0 rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white">
        <X size={16} />
      </button>
    </div>
  );
};