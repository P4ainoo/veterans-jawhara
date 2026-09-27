import React from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../store/useSquadStore';
import { cn } from '../lib/utils';
import { Star } from 'lucide-react';

interface PlayerCardProps {
  player: UserProfile;
  size?: 'sm' | 'md' | 'lg' | 'tactical';
  className?: string;
  matchRating?: number;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, size = 'md', className, matchRating }) => {
  const isGold = (player.avgRating || 0) >= 9.0;
  const isPurple = (player.avgRating || 0) >= 8.5 && (player.avgRating || 0) < 9.0;

  if (size === 'tactical') {
    return (
      <div className={cn("flex flex-col items-center gap-1 group", className)}>
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 overflow-hidden shadow-2xl group-hover:border-primary transition-all">
            <img src={player.avatarUrl} className="w-full h-full object-cover" alt={player.lastName} />
          </div>
          {matchRating !== undefined && (
            <div className={cn(
              "absolute -top-1 -right-1 z-20 px-1.5 py-0.5 rounded-md text-[8px] font-black text-white shadow-lg",
              matchRating >= 8.5 ? "bg-secondary" : 
              matchRating >= 7.0 ? "bg-primary" : 
              "bg-orange-500"
            )}>
              {matchRating.toFixed(1)}
            </div>
          )}
        </div>
        <span className="text-[9px] font-black uppercase tracking-tighter text-white/90 drop-shadow-md truncate w-16 text-center">
          {player.lastName}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative aspect-[3/4.2] rounded-2xl overflow-hidden transition-all duration-500 group select-none",
      isGold ? "bg-gradient-to-b from-tertiary/40 to-surface p-[1px] shadow-tertiary/10" : 
      isPurple ? "bg-gradient-to-b from-secondary/40 to-surface p-[1px] shadow-secondary/10" : "bg-surface-raised border border-border-soft shadow-black/40",
      size === 'sm' ? "w-24" : "w-full",
      "hover:scale-[1.03] active:scale-95 shadow-2xl",
      className
    )}>
      {/* Match Rating Badge (Flashscore Style) */}
      {matchRating !== undefined && size === 'sm' && (
        <div className={cn(
          "absolute top-1 right-1 z-50 px-1.5 py-0.5 rounded-lg text-[10px] font-black text-white shadow-lg border border-white/20",
          matchRating >= 8.5 ? "bg-secondary" : 
          matchRating >= 7.0 ? "bg-primary" : 
          "bg-orange-500"
        )}>
          {matchRating.toFixed(1)}
        </div>
      )}

      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none opacity-20 z-20 group-hover:opacity-30 transition-opacity" />
      
      <div className="h-full w-full bg-surface-raised/90 backdrop-blur-md flex flex-col p-3 relative z-10 overflow-hidden">
         {/* Background holographic hint */}
         <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-tr from-transparent via-white/5 to-transparent rotate-45 pointer-events-none group-hover:translate-x-1/2 transition-transform duration-1000" />

         {/* Top HUD */}
         <div className="flex justify-between items-start mb-1 relative z-20">
            <div className="flex flex-col items-center">
               <span className={cn(
                 "text-2xl font-headline tabular-nums tracking-tighter",
                 isGold ? "text-tertiary" : isPurple ? "text-secondary" : "text-white"
               )}>
                 {player.avgRating ? player.avgRating.toFixed(0) : '80'}
               </span>
               <span className="text-[7px] font-black opacity-40 uppercase tracking-widest">{player.position || 'MID'}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
               {isGold && (
                 <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
                   <Star size={10} className="text-tertiary fill-tertiary" />
                 </motion.div>
               )}
               <div className={cn(
                  "w-1.5 h-1.5 rounded-full shadow-[0_0_8px]",
                  player.healthStatus === 'INJURED' ? "bg-red-500 shadow-red-500" :
                  player.healthStatus === 'RECOVERING' ? "bg-orange-500 shadow-orange-500" :
                  player.healthStatus === 'AWAY' ? "bg-blue-500 shadow-blue-500" :
                  "bg-primary shadow-primary"
               )} title={player.healthStatus || 'HEALTHY'} />
            </div>
         </div>

         {/* Avatar */}
         <div className="flex-1 flex items-center justify-center relative my-1 z-10">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/5 shadow-inner group-hover:border-primary/40 transition-all duration-500">
               <img src={player.avatarUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={player.lastName} />
            </div>
            <div className="absolute -bottom-1 bg-surface border border-white/10 px-2 py-0.5 rounded-lg text-[8px] font-black text-primary uppercase shadow-lg">
               #{player.jerseyNumber || '7'}
            </div>
         </div>

         {/* Name Banner */}
         <div className="bg-white/5 rounded-xl px-1 py-1.5 mt-auto text-center border border-white/5 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all relative z-20">
            <span className="text-[10px] font-black uppercase tracking-tighter block truncate text-white/90">
              {player.lastName}
            </span>
         </div>

         {/* Mini Stats */}
         <div className="grid grid-cols-3 gap-0.5 mt-2 text-center relative z-20">
            <StatMini label="MATCHS" val={player.matchCount || 0} />
            <StatMini label="BUTS" val={player.goals || 0} />
            <StatMini label="PASSES" val={player.assists || 0} />
         </div>
      </div>
    </div>
  );
};

function StatMini({ label, val }: { label: string, val: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[5px] font-black text-white/30 tracking-widest">{label}</span>
      <span className="text-[8px] font-bold text-white/60 tabular-nums">{val}</span>
    </div>
  );
}
