import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, useSquadStore } from '../store/useSquadStore';
import { Star, CheckCircle, X, Loader2, Trophy, Footprints, AlertCircle, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, setDoc, collection, getDocs, runTransaction, increment } from 'firebase/firestore';

interface RatingConsoleProps {
  eventId: string;
  onClose: () => void;
}

interface PlayerStats {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number;
}

export const RatingConsole: React.FC<RatingConsoleProps> = ({ eventId, onClose }) => {
  const { roster, events } = useSquadStore();
  const event = events.find(e => e.id === eventId);
  const [playerStats, setPlayerStats] = useState<Record<string, PlayerStats>>({});
  const [loading, setLoading] = useState(false);

  const participantIds = [
    ...Object.values(event?.pitchAssignments || {}),
    ...(event?.benchAssignments || [])
  ];
  
  const participants = roster.filter(u => participantIds.includes(u.uid));

  useEffect(() => {
    // Initialize stats for each participant
    const initialStats: Record<string, PlayerStats> = {};
    participants.forEach(p => {
      initialStats[p.uid] = { goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: 5 };
    });
    setPlayerStats(initialStats);
  }, []);

  const updateStat = (userId: string, stat: keyof PlayerStats, delta: number) => {
    setPlayerStats(prev => {
      const current = prev[userId] || { goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: 5 };
      let newVal = (current[stat] as number) + delta;
      
      // Constraints
      if (stat === 'rating') {
        newVal = Math.max(1, Math.min(10, newVal));
      } else {
        newVal = Math.max(0, newVal);
      }

      return {
        ...prev,
        [userId]: { ...current, [stat]: newVal }
      };
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Mark event as completed and save match stats
        const eventRef = doc(db, 'events', eventId);
        transaction.update(eventRef, { 
          isCompleted: true,
          matchStats: playerStats
        });

        // 2. Update each player profile
        for (const [userId, stats] of Object.entries(playerStats)) {
          const userRef = doc(db, 'users', userId);
          const userSnap = roster.find(u => u.uid === userId);
          
          if (userSnap) {
            const count = (userSnap.matchCount || 0) + 1;
            const currentTotalRating = (userSnap.avgRating || 0) * (userSnap.matchCount || 0);
            const newAvgRating = (currentTotalRating + stats.rating) / count;

            transaction.update(userRef, { 
              avgRating: newAvgRating, 
              matchCount: count,
              goals: (userSnap.goals || 0) + stats.goals,
              assists: (userSnap.assists || 0) + stats.assists,
              yellowCards: (userSnap.yellowCards || 0) + stats.yellowCards,
              redCards: (userSnap.redCards || 0) + stats.redCards
            });
          }
        }
      });
      onClose();
    } catch (error) {
      console.error('Rating Submission Error:', error);
      alert("Échec de la finalisation du match. Erreur tactique rencontrée.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#12141D] w-full max-w-2xl rounded-[2.5rem] border border-white/5 p-8 shadow-3xl flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-start mb-6">
           <div>
              <h2 className="text-2xl font-bold font-headline uppercase tracking-tight">Rapport de Match</h2>
              <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest mt-1">
                Saisir les performances pour {event?.opponent || 'Entraînement'}
              </p>
           </div>
           <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
              <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-6">
           {participants.length === 0 ? (
             <div className="text-center py-12 opacity-40 uppercase text-xs font-bold tracking-widest">No operatives assigned to this op</div>
           ) : (
             participants.map((player) => (
               <div key={player.uid} className="bg-white/5 rounded-3xl p-5 space-y-4 border border-white/5 hover:bg-white-[0.07] transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 shadow-lg group-hover:border-primary transition-all">
                          <img src={player.avatarUrl} className="w-full h-full object-cover" alt={player.lastName} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-xs font-black uppercase tracking-tight">{player.firstName} {player.lastName}</span>
                          <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">Pos: {player.position || 'N/A'} • Jersey: {player.jerseyNumber || '-'}</span>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-black text-white/30 uppercase tracking-widest mr-2">Performance Rating</span>
                      <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 px-3">
                         <button onClick={() => updateStat(player.uid, 'rating', -1)} className="text-white/40 hover:text-white transition-colors">-</button>
                         <span className="w-6 text-center text-xs font-black text-primary">{playerStats[player.uid]?.rating || 5}</span>
                         <button onClick={() => updateStat(player.uid, 'rating', 1)} className="text-white/40 hover:text-white transition-colors">+</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                     <StatControl 
                        icon={<Trophy size={14} className="text-[#FFD700]" />} 
                        label="Buts" 
                        value={playerStats[player.uid]?.goals || 0}
                        onInc={() => updateStat(player.uid, 'goals', 1)}
                        onDec={() => updateStat(player.uid, 'goals', -1)}
                     />
                     <StatControl 
                        icon={<Footprints size={14} className="text-[#00E5FF]" />} 
                        label="Passes" 
                        value={playerStats[player.uid]?.assists || 0}
                        onInc={() => updateStat(player.uid, 'assists', 1)}
                        onDec={() => updateStat(player.uid, 'assists', -1)}
                     />
                     <StatControl 
                        icon={<AlertCircle size={14} className="text-[#FFCC00]" />} 
                        label="Jaunes" 
                        value={playerStats[player.uid]?.yellowCards || 0}
                        onInc={() => updateStat(player.uid, 'yellowCards', 1)}
                        onDec={() => updateStat(player.uid, 'yellowCards', -1)}
                     />
                     <StatControl 
                        icon={<ShieldAlert size={14} className="text-red-500" />} 
                        label="Rouges" 
                        value={playerStats[player.uid]?.redCards || 0}
                        onInc={() => updateStat(player.uid, 'redCards', 1)}
                        onDec={() => updateStat(player.uid, 'redCards', -1)}
                     />
                  </div>
               </div>
             ))
           )}
        </div>

        <div className="mt-8 flex gap-4">
           <button 
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-14 rounded-2xl bg-white/5 text-on-surface-variant font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
           >Annuler</button>
           <button 
            onClick={handleSubmit}
            disabled={loading || participants.length === 0}
            className="flex-1 h-14 rounded-2xl bg-primary text-black font-bold font-headline text-sm uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
           >
              {loading && <Loader2 className="animate-spin" size={18} />}
              {loading ? 'Finalisation...' : 'Enregistrer le Rapport'}
           </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

function StatControl({ icon, label, value, onInc, onDec }: any) {
   return (
      <div className="bg-black/20 rounded-2xl p-2.5 flex flex-col gap-1 border border-white/5 group hover:border-white/10 transition-all">
         <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-white/30">
            {icon}
            {label}
         </div>
         <div className="flex items-center justify-between mt-1">
            <button 
               onClick={onDec}
               className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-90"
            >-</button>
            <span className="text-sm font-black text-white tabular-nums">{value}</span>
            <button 
               onClick={onInc}
               className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-90"
            >+</button>
         </div>
      </div>
   )
}
