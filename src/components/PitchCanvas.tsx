import React, { useState, useEffect } from 'react';
import { useSquadStore, UserProfile } from '../store/useSquadStore';
import { getFormationCoordinates } from '../lib/formation-math';
import { cn } from '../lib/utils';
import { PlayerCard } from './PlayerCard';
import { Users, PlusCircle, CheckCircle2, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';

interface PitchCanvasProps {
  eventId: string;
  readOnly?: boolean;
  matchStats?: Record<string, {
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    rating: number;
  }>;
}

export const PitchCanvas: React.FC<PitchCanvasProps> = ({ eventId, readOnly = false, matchStats }) => {
  const { events, roster } = useSquadStore();
  const event = events.find(e => e.id === eventId);
  const formation = event?.formation || '3-2-1';
  const slots = getFormationCoordinates(formation);
  
  const pitchAssignments = event?.pitchAssignments || {};
  const benchAssignments = event?.benchAssignments || [];
  
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [rsvpUserIds, setRsvpUserIds] = useState<string[]>([]);

  // Fetch RSVPs for this event
  useEffect(() => {
    if (!eventId) return;
    const rsvpRef = collection(db, 'events', eventId, 'rsvps');
    return onSnapshot(rsvpRef, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.id);
      setRsvpUserIds(ids);
    });
  }, [eventId]);

  const updateLineup = async (id: string, lineup: any) => {
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, {
        pitchAssignments: lineup.pitch !== undefined ? lineup.pitch : pitchAssignments,
        benchAssignments: lineup.bench !== undefined ? lineup.bench : benchAssignments,
        formation: lineup.formation || formation
      });
    } catch (error) {
      console.error('Update Lineup Error:', error);
    }
  };

  const handleSlotClick = (slotId: string) => {
    if (readOnly) return;

    if (selectedPlayerId) {
      // Move selected player to this slot
      const newPitch = { ...pitchAssignments };
      let newBench = [...benchAssignments];

      // Remove from everywhere else
      Object.keys(newPitch).forEach(k => {
        if (newPitch[k] === selectedPlayerId) delete newPitch[k];
      });
      newBench = newBench.filter(id => id !== selectedPlayerId);

      // If slot was occupied, move displaced player to bench
      const displacedUser = newPitch[slotId];
      if (displacedUser && displacedUser !== selectedPlayerId) {
        newBench.push(displacedUser);
      }

      newPitch[slotId] = selectedPlayerId;
      updateLineup(eventId, { pitch: newPitch, bench: newBench });
      setSelectedPlayerId(null);
    } else {
      // If clicking an occupied slot with no selection, select that player
      const occupantId = pitchAssignments[slotId];
      if (occupantId) {
        setSelectedPlayerId(occupantId);
      }
    }
  };

  const handleBenchClick = () => {
    if (readOnly || !selectedPlayerId) return;

    const newPitch = { ...pitchAssignments };
    let newBench = [...benchAssignments];

    // Remove from pitch if they were there
    Object.keys(newPitch).forEach(k => {
      if (newPitch[k] === selectedPlayerId) delete newPitch[k];
    });

    // Add to bench if not already there
    if (!newBench.includes(selectedPlayerId)) {
      newBench.push(selectedPlayerId);
    }

    updateLineup(eventId, { pitch: newPitch, bench: newBench });
    setSelectedPlayerId(null);
  };

  const handleRosterClick = (userId: string) => {
    if (readOnly) return;
    
    if (selectedPlayerId === userId) {
      setSelectedPlayerId(null);
    } else {
      setSelectedPlayerId(userId);
    }
  };

  const handleRemoveFromLineup = (userId: string) => {
    if (readOnly) return;

    const newPitch = { ...pitchAssignments };
    let newBench = [...benchAssignments];

    Object.keys(newPitch).forEach(k => {
      if (newPitch[k] === userId) delete newPitch[k];
    });
    newBench = newBench.filter(id => id !== userId);

    updateLineup(eventId, { pitch: newPitch, bench: newBench });
    if (selectedPlayerId === userId) setSelectedPlayerId(null);
  };

  const availablePlayers = roster.filter(u => 
    rsvpUserIds.includes(u.uid) && 
    !Object.values(pitchAssignments).includes(u.uid) && 
    !benchAssignments.includes(u.uid)
  );

  return (
    <div className="flex flex-col gap-10">
      {!readOnly && (
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
             {['3-2-1', '2-3-1', '3-1-2', '2-2-2', '1-3-2'].map(f => (
               <button
                 key={f}
                 onClick={() => updateLineup(eventId, { formation: f })}
                 className={cn(
                   "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0",
                   formation === f 
                     ? "bg-primary text-black border-primary shadow-elite" 
                     : "bg-white/5 text-white/40 border-white/5 hover:border-white/20"
                 )}
               >
                 {f}
               </button>
             ))}
           </div>
           {selectedPlayerId && (
             <button 
              onClick={() => setSelectedPlayerId(null)}
              className="bg-red-500/10 text-red-500 px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-2"
             >
                <X size={12} /> Annuler Sélection
             </button>
           )}
        </div>
      )}

      <div className="relative w-full aspect-[4/5.2] rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 bg-[#05110B]">
        <div className="absolute inset-0 z-0">
           <div className="absolute inset-0 bg-gradient-to-b from-[#0A2318] to-[#05110B]" />
           <div className="absolute inset-6 border-2 border-primary/20 rounded-2xl pointer-events-none">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-24 border-t-2 border-x-2 border-primary/10" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 border-b-2 border-x-2 border-primary/10" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-primary/10 rounded-full" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/10" />
           </div>
           <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
        </div>

        <div className="relative z-10 w-full h-full p-8">
          {slots.map(slot => {
            const userId = pitchAssignments[slot.id];
            const player = roster.find(u => u.uid === userId);
            const stats = userId && matchStats ? matchStats[userId] : undefined;
            
            return (
              <PitchSlot 
                key={slot.id} 
                slot={slot} 
                assignedUser={player}
                readOnly={readOnly}
                matchRating={stats?.rating}
                isSelected={selectedPlayerId === userId}
                onSelect={() => handleSlotClick(slot.id)}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
         <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Remplaçants & Réserves</h4>
            <span className="text-[9px] font-black text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-0.5 rounded-lg border border-secondary/20">Capacité Illimitée</span>
         </div>
         
         <BenchContainer 
          players={roster.filter(u => benchAssignments.includes(u.uid))}
          readOnly={readOnly}
          matchStats={matchStats}
          selectedPlayerId={selectedPlayerId}
          onBenchClick={handleBenchClick}
          onPlayerClick={(uid: string) => {
            if (selectedPlayerId) {
               // Move selected player to bench (already there or swap)
               handleBenchClick();
            } else {
               setSelectedPlayerId(uid);
            }
          }}
         />
         
         {!readOnly && (
           <RosterDrawer 
            players={availablePlayers} 
            rsvpCount={rsvpUserIds.length} 
            selectedPlayerId={selectedPlayerId}
            onPlayerClick={handleRosterClick}
            onRemovePlayer={handleRemoveFromLineup}
           />
         )}
      </div>
    </div>
  );
};

interface RosterDrawerProps {
  players: UserProfile[];
  rsvpCount: number;
  selectedPlayerId: string | null;
  onPlayerClick: (uid: string) => void;
  onRemovePlayer: (uid: string) => void;
}

function RosterDrawer({ players, rsvpCount, selectedPlayerId, onPlayerClick }: RosterDrawerProps) {
  return (
    <div className="glass-card rounded-[2.5rem] p-6 shadow-xl space-y-6 relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      
      <div className="flex items-center justify-between relative z-10">
         <h5 className="text-[10px] font-black uppercase tracking-widest text-white/40">Joueurs Disponibles ({players.length})</h5>
         <div className="flex items-center gap-1 text-[8px] font-black text-primary uppercase">
           <CheckCircle2 size={12} />
           Présence Confirmée ({rsvpCount})
         </div>
      </div>
      
      <div className="flex flex-wrap gap-4 relative z-10">
         {players.length === 0 ? (
           <div className="w-full py-10 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-30">
              <span className="text-[10px] font-black uppercase tracking-widest">Aucun joueur disponible</span>
           </div>
         ) : (
           players.map((user: UserProfile) => (
             <div 
              key={user.uid} 
              onClick={() => onPlayerClick(user.uid)}
              className={cn(
                "cursor-pointer transition-all",
                selectedPlayerId === user.uid ? "scale-110 drop-shadow-[0_0_15px_rgba(0,255,102,0.4)]" : "hover:scale-105"
              )}
             >
                <PlayerCard player={user} size="tactical" className={selectedPlayerId === user.uid ? "border-primary" : ""} />
             </div>
           ))
         )}
      </div>
    </div>
  );
}

interface PitchSlotProps {
  slot: any;
  assignedUser?: UserProfile;
  readOnly: boolean;
  matchRating?: number;
  isSelected: boolean;
  onSelect: () => void;
}

function PitchSlot({ slot, assignedUser, matchRating, isSelected, onSelect }: PitchSlotProps) {
  return (
    <div 
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all z-20 cursor-pointer",
        isSelected && "scale-125"
      )}
      style={{ 
        left: `${slot.x}%`, 
        top: `${slot.y}%`,
        padding: '20px'
      }}
      onClick={onSelect}
    >
      <div className={cn(
        "w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center relative transition-all duration-300",
        assignedUser ? "border-transparent" : "bg-black/40",
        isSelected && "border-primary shadow-[0_0_15px_rgba(0,255,102,0.4)]"
      )}>
        {assignedUser ? (
          <PlayerCard player={assignedUser} size="tactical" matchRating={matchRating} />
        ) : (
          <span className="text-[8px] font-bold text-white/20 uppercase">{slot.label}</span>
        )}
      </div>
      {!assignedUser && <div className="mt-1 text-[6px] font-bold text-white/30 uppercase tracking-widest">{slot.label}</div>}
    </div>
  );
}

interface BenchContainerProps {
  players: UserProfile[];
  readOnly: boolean;
  matchStats?: Record<string, any>;
  selectedPlayerId: string | null;
  onBenchClick: () => void;
  onPlayerClick: (uid: string) => void;
}

function BenchContainer({ players, matchStats, selectedPlayerId, onBenchClick, onPlayerClick }: BenchContainerProps) {
  return (
    <div 
      onClick={onBenchClick}
      className={cn(
        "min-h-[120px] bg-white/5 rounded-3xl p-6 border border-white/5 flex flex-wrap gap-4 transition-colors cursor-pointer",
        selectedPlayerId && "hover:bg-primary/5 hover:border-primary/20"
      )}
    >
      {players.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center opacity-20 py-4">
           <PlusCircle size={24} className="mb-2" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Cliquez pour ajouter ici</span>
        </div>
      ) : (
        players.map((p: UserProfile) => (
          <div 
            key={p.uid} 
            onClick={(e) => {
              e.stopPropagation();
              onPlayerClick(p.uid);
            }}
            className={cn(
              "transition-all cursor-pointer",
              selectedPlayerId === p.uid ? "scale-110 drop-shadow-[0_0_15px_rgba(0,255,102,0.4)]" : "hover:scale-105"
            )}
          >
            <PlayerCard player={p} size="tactical" matchRating={matchStats?.[p.uid]?.rating} />
          </div>
        ))
      )}
    </div>
  );
}
