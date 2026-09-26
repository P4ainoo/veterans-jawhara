import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, useSquadStore } from '../store/useSquadStore';
import { Star, CheckCircle, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { doc, updateDoc, setDoc, collection, getDocs, runTransaction } from 'firebase/firestore';

interface RatingConsoleProps {
  eventId: string;
  onClose: () => void;
}

export const RatingConsole: React.FC<RatingConsoleProps> = ({ eventId, onClose }) => {
  const { roster, events } = useSquadStore();
  const event = events.find(e => e.id === eventId);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Determine who participated (on pitch or on bench)
  const participantIds = [
    ...Object.values(event?.pitchAssignments || {}),
    ...(event?.benchAssignments || [])
  ];
  
  const participants = roster.filter(u => participantIds.includes(u.uid));

  const handleRate = (userId: string, score: number) => {
    setRatings(prev => ({ ...prev, [userId]: score }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Mark event as completed
        const eventRef = doc(db, 'events', eventId);
        transaction.update(eventRef, { isCompleted: true });

        // 2. Save ratings and update player profiles
        for (const userId of Object.keys(ratings)) {
          const score = ratings[userId];
          const ratingRef = doc(collection(db, 'events', eventId, 'ratings'), userId);
          transaction.set(ratingRef, {
            eventId,
            userId,
            score,
            coachId: auth.currentUser?.uid,
            timestamp: new Date().toISOString()
          });

          const userRef = doc(db, 'users', userId);
          const userSnap = roster.find(u => u.uid === userId);
          if (userSnap) {
            const count = (userSnap.matchCount || 0) + 1;
            const currentTotal = (userSnap.avgRating || 0) * (userSnap.matchCount || 0);
            const newAvg = (currentTotal + score) / count;
            transaction.update(userRef, { 
              avgRating: newAvg, 
              matchCount: count 
            });
          }
        }
      });
      onClose();
    } catch (error) {
      console.error('Rating Submission Error:', error);
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
        className="bg-[#12141D] w-full max-w-2xl rounded-[2.5rem] border border-white/5 p-8 shadow-3xl flex flex-col max-h-[85vh]"
      >
        <div className="flex justify-between items-start mb-8">
           <div>
              <h2 className="text-2xl font-bold font-headline uppercase tracking-tight">Post-Match Performance</h2>
              <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest mt-1">
                Event: {event?.opponent || 'Squad Practice'} • {event?.date}
              </p>
           </div>
           <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
              <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-4">
           {participants.length === 0 ? (
             <div className="text-center py-12 opacity-40 uppercase text-xs font-bold">No players assigned to this event</div>
           ) : (
             participants.map((player) => (
               <div key={player.uid} className="bg-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shadow-lg group-hover:border-[#00E5FF] transition-all">
                        <img src={player.avatarUrl} className="w-full h-full object-cover" alt={player.lastName} />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase">{player.firstName} {player.lastName}</span>
                        <span className="text-[8px] font-bold text-on-surface-variant uppercase">Current Avg: {player.avgRating?.toFixed(1) || '0.0'}</span>
                     </div>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2">
                     {[1,2,3,4,5,6,7,8,9,10].map(score => (
                        <button 
                          key={score}
                          disabled={loading}
                          onClick={() => handleRate(player.uid, score)}
                          className={cn(
                            "w-8 h-8 shrink-0 rounded-lg text-[10px] font-black transition-all flex items-center justify-center",
                            ratings[player.uid] === score 
                              ? "bg-[#00FF66] text-black shadow-[0_0_12px_#00FF66]" 
                              : "bg-white/5 text-on-surface-variant hover:bg-white/10 hover:text-white"
                          )}
                        >
                          {score}
                        </button>
                     ))}
                  </div>
               </div>
             ))
           )}
        </div>

        <div className="mt-8 flex gap-4">
           <button 
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-14 rounded-2xl bg-white/5 text-on-surface-variant font-bold text-xs uppercase tracking-widest"
           >Discard</button>
           <button 
            onClick={handleSubmit}
            disabled={loading || Object.keys(ratings).length === 0}
            className="flex-1 h-14 rounded-2xl bg-[#00FF66] text-black font-bold font-headline text-lg uppercase tracking-widest shadow-lg shadow-[#00FF66]/20 disabled:opacity-50 flex items-center justify-center gap-2"
           >
              {loading && <Loader2 className="animate-spin" size={20} />}
              {loading ? 'Submitting...' : 'Submit Ratings'}
           </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
