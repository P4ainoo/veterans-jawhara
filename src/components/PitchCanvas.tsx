import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  DragEndEvent, 
  useDraggable, 
  useDroppable,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { useSquadStore, UserProfile } from '../store/useSquadStore';
import { getFormationCoordinates } from '../lib/formation-math';
import { cn } from '../lib/utils';
import { PlayerCard } from './PlayerCard';
import { Users, PlusCircle, CheckCircle2 } from 'lucide-react';
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
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rsvpUserIds, setRsvpUserIds] = useState<string[]>([]);
  const [lineupState, setLineupState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
    if (lineupState === 'saving') return;
    setLineupState('saving');
    try {
      const eventRef = doc(db, 'events', id);
      await updateDoc(eventRef, {
        pitchAssignments: lineup.pitch !== undefined ? lineup.pitch : pitchAssignments,
        benchAssignments: lineup.bench !== undefined ? lineup.bench : benchAssignments,
        formation: lineup.formation || formation
      });
      setLineupState('saved');
      window.setTimeout(() => setLineupState('idle'), 1200);
    } catch (error) {
      console.error('Update Lineup Error:', error);
      setLineupState('error');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const userId = active.id as string;
    const overId = over.id as string;

    const newPitch = { ...pitchAssignments };
    let newBench = [...benchAssignments];

    // Remove user from any other slot first
    Object.keys(newPitch).forEach(k => {
      if (newPitch[k] === userId) delete newPitch[k];
    });
    // Remove from bench
    newBench = newBench.filter(id => id !== userId);

    // Case 1: Dropped on a pitch slot
    if (overId.startsWith('slot-') || overId === 'gk') {
      const displacedUser = newPitch[overId];
      if (displacedUser) {
        newBench.push(displacedUser);
      }
      newPitch[overId] = userId;
    } 
    // Case 2: Dropped on bench
    else if (overId === 'bench-container') {
      if (!newBench.includes(userId)) newBench.push(userId);
    }
    // Case 3: Dropped on "Return to Roster" (the drawer zone)
    else if (overId === 'roster-drawer-zone') {
      // Already removed from pitch and bench by logic above
    }

    updateLineup(eventId, { pitch: newPitch, bench: newBench });
  };

  const availablePlayers = roster.filter(u => 
    rsvpUserIds.includes(u.uid) && 
    !Object.values(pitchAssignments).includes(u.uid) && 
    !benchAssignments.includes(u.uid)
  );

  return (
    <DndContext 
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-10">
        {!readOnly && (
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2" aria-label="Choisir une formation">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30 shrink-0">Formation</span>
            {lineupState === 'saving' && <span className="text-[9px] text-secondary shrink-0">Enregistrement...</span>}
            {lineupState === 'saved' && <span className="text-[9px] text-primary shrink-0">Enregistrée</span>}
            {lineupState === 'error' && <span className="text-[9px] text-red-400 shrink-0">Échec de l’enregistrement</span>}
            {['3-2-1', '2-3-1', '3-1-2', '2-2-2', '1-3-2'].map(f => (
              <button
                key={f}
                onClick={() => updateLineup(eventId, { formation: f })}
                disabled={lineupState === 'saving'}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 disabled:opacity-50",
                  formation === f 
                    ? "bg-primary text-black border-primary shadow-elite" 
                    : "bg-white/5 text-white/40 border-white/5 hover:border-white/20"
                )}
              >
                {f}
              </button>
            ))}
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
                />
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
           <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Remplaçants</h4>
              <span className="text-[9px] font-black text-secondary uppercase tracking-widest">{benchAssignments.length} joueur{benchAssignments.length > 1 ? 's' : ''}</span>
           </div>
           
           <BenchContainer 
            players={roster.filter(u => benchAssignments.includes(u.uid))}
            readOnly={readOnly}
            matchStats={matchStats}
           />
           
           {!readOnly && (
             <RosterDrawer 
              players={availablePlayers} 
              rsvpCount={rsvpUserIds.length} 
             />
           )}
        </div>
      </div>

      <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
        {activeId ? (
          <div className="scale-110 pointer-events-none">
             <PlayerCard player={roster.find(u => u.uid === activeId)!} size="tactical" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

function RosterDrawer({ players, rsvpCount }: { players: UserProfile[], rsvpCount: number }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'roster-drawer-zone',
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "glass-card rounded-[2.5rem] p-6 shadow-xl space-y-6 relative overflow-hidden transition-all duration-300",
        isOver && "bg-primary/10 border-primary/20 scale-[1.02]"
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      
      <div className="flex items-center justify-between relative z-10">
         <h5 className="text-[10px] font-black uppercase tracking-widest text-white/40">Joueurs disponibles ({players.length})</h5>
         <div className="flex items-center gap-1 text-[8px] font-black text-primary uppercase">
           <CheckCircle2 size={12} />
           Présences confirmées ({rsvpCount})
         </div>
      </div>
      
      <div className="flex flex-wrap gap-4 relative z-10">
         {players.length === 0 ? (
           <div className="w-full py-10 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-30">
              <span className="text-[10px] font-black uppercase tracking-widest">Aucun joueur disponible</span>
           </div>
         ) : (
           players.map(user => (
             <DraggablePlayer key={user.uid} user={user} />
           ))
         )}
      </div>
      
      {isOver && (
        <div className="absolute inset-0 bg-primary/5 backdrop-blur-sm flex items-center justify-center z-50 rounded-[2.5rem]">
           <span className="text-xs font-black uppercase tracking-[0.3em] text-primary animate-pulse">Relâcher pour retirer</span>
        </div>
      )}
    </div>
  );
}

function PitchSlot({ slot, assignedUser, readOnly, matchRating }: { slot: any, assignedUser?: UserProfile, readOnly: boolean, matchRating?: number }) {
  const { isOver, setNodeRef } = useDroppable({
    id: slot.id,
    disabled: readOnly
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all z-20",
        isOver && "scale-125"
      )}
      style={{ 
        left: `${slot.x}%`, 
        top: `${slot.y}%`,
        padding: '20px' // Increased hit area
      }}
    >
      <div className={cn(
        "w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center relative transition-all duration-300",
        assignedUser ? "border-transparent" : "bg-black/40",
        isOver && "border-primary/50 bg-primary/5"
      )}>
        {assignedUser ? (
          <DraggablePlayer user={assignedUser} readOnly={readOnly} matchRating={matchRating} />
        ) : (
          <span className="text-[8px] font-bold text-white/20 uppercase">{slot.label}</span>
        )}
      </div>
      {!assignedUser && <div className="mt-1 text-[6px] font-bold text-white/30 uppercase tracking-widest">{slot.label}</div>}
    </div>
  );
}

function BenchContainer({ players, readOnly, matchStats }: { players: UserProfile[], readOnly: boolean, matchStats?: Record<string, any> }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'bench-container',
    disabled: readOnly
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] bg-white/5 rounded-3xl p-6 border border-white/5 flex flex-wrap gap-4 transition-colors",
        isOver && "bg-[#00E5FF]/5 border-[#00E5FF]/20"
      )}
    >
      {players.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center opacity-20 py-4">
           <PlusCircle size={24} className="mb-2" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Glisser les joueurs ici</span>
        </div>
      ) : (
        players.map((p) => (
          <DraggablePlayer key={p.uid} user={p} readOnly={readOnly} matchRating={matchStats?.[p.uid]?.rating} />
        ))
      )}
    </div>
  );
}

function DraggablePlayer({ user, readOnly = false, matchRating }: { user: UserProfile, readOnly?: boolean, matchRating?: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: user.uid,
    disabled: readOnly
  });

  // When dragging with an overlay, we don't want to transform the source element
  // instead we can just dim it or hide it.
  const style = {
    opacity: isDragging ? 0.3 : 1,
    cursor: readOnly ? 'default' : 'grab',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...(readOnly ? {} : { ...listeners, ...attributes })}
      className={cn(
        "transition-transform",
        !readOnly && "hover:scale-110"
      )}
    >
      <PlayerCard player={user} size="tactical" matchRating={matchRating} />
    </div>
  );
}
