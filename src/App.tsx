import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Compass, 
  Trophy, 
  PlusCircle, 
  ChevronRight, 
  LogOut,
  Calendar,
  MapPin,
  Shield,
  LayoutGrid,
  User,
  Settings,
  Smartphone,
  Save,
  CheckCircle2,
  ArrowRight,
  Camera,
  Footprints,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { useSquadStore, SquadEvent, UserProfile } from './store/useSquadStore';
import { cn } from './lib/utils';
import { PitchCanvas } from './components/PitchCanvas';
import { PlayerCard } from './components/PlayerCard';
import { RatingConsole } from './components/RatingConsole';
import { FeedbackToast } from './components/FeedbackToast';
import { auth, db } from './lib/firebase';
import { 
  onSnapshot, 
  collection, 
  query, 
  doc, 
  updateDoc, 
  setDoc,
  addDoc,
  deleteDoc,
  getDocs,
  where
} from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';

type Tab = 'team' | 'matches' | 'standings' | 'profile';

export default function App() {
  const { currentUser, setCurrentUser, roster, setRoster, events, setEvents, activeEventId, setActiveEvent } = useSquadStore();
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [showEventCreator, setShowEventCreator] = useState(false);
  const [showRatingConsole, setShowRatingConsole] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [rsvpState, setRsvpState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);

  // Auth Session Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // If we have a firebase user but no profile in store, fetch it
        if (!currentUser || currentUser.uid !== firebaseUser.uid) {
          const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', firebaseUser.uid)));
          if (!userDoc.empty) {
            setCurrentUser(userDoc.docs[0].data() as UserProfile);
          }
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, [setCurrentUser, currentUser]);

  // Firestore Sync: Roster
  useEffect(() => {
    if (isAuthChecking || !auth.currentUser || !currentUser) return;
    const q = query(collection(db, 'users'));
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      setRoster(users);
    }, (error) => {
      console.error("Roster Listener Error:", error);
    });
  }, [currentUser, setRoster, isAuthChecking]);

  // Firestore Sync: Events
  useEffect(() => {
    if (isAuthChecking || !auth.currentUser || !currentUser) return;
    const q = query(collection(db, 'events'));
    return onSnapshot(q, (snapshot) => {
      const evts = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as SquadEvent))
        .sort((a, b) => {
          const createdOrder = (b.createdAt || '').localeCompare(a.createdAt || '');
          if (createdOrder !== 0) return createdOrder;
          return `${b.date || ''}T${b.time || ''}`.localeCompare(`${a.date || ''}T${a.time || ''}`);
        });
      setEvents(evts);
    }, (error) => {
      console.error("Events Listener Error:", error);
    });
  }, [currentUser, setEvents, isAuthChecking]);

  const [confirmedUsers, setConfirmedUsers] = useState<UserProfile[]>([]);

  // Fetch RSVPs for active event
  useEffect(() => {
    if (isAuthChecking || !auth.currentUser || !activeEventId) {
      setConfirmedUsers([]);
      return;
    }
    const rsvpRef = collection(db, 'events', activeEventId, 'rsvps');
    return onSnapshot(rsvpRef, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.id);
      const members = roster.filter(u => ids.includes(u.uid));
      setConfirmedUsers(members);
    }, (error) => {
      console.error("RSVP Listener Error:", error);
    });
  }, [activeEventId, roster, isAuthChecking]);

  useEffect(() => {
    setRsvpState('idle');
  }, [activeEventId]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#090A0F] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#00FF66]/20 border-t-[#00FF66] rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={setCurrentUser} />;
  }

  const activeEvent = events.find(e => e.id === activeEventId);
  const participantsCount = confirmedUsers.length;
  const today = new Date().toISOString().split('T')[0];
  const nextEvent = [...events]
    .filter(event => !event.isCompleted && (event.date || '') >= today)
    .sort((a, b) => `${a.date || ''}T${a.time || ''}`.localeCompare(`${b.date || ''}T${b.time || ''}`))[0];

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  const handleRsvp = async (eventId: string) => {
    if (rsvpState === 'saving' || confirmedUsers.some(user => user.uid === currentUser.uid)) return;
    setRsvpState('saving');
    try {
      const rsvpDoc = doc(db, 'events', eventId, 'rsvps', currentUser.uid);
      await setDoc(rsvpDoc, {
        userId: currentUser.uid,
        eventId,
        status: 'JOINED',
        timestamp: new Date().toISOString()
      });
      setRsvpState('saved');
      setToast({ tone: 'success', message: 'Votre présence est confirmée.' });
    } catch (error) {
      console.error('RSVP Error:', error);
      setRsvpState('error');
      setToast({ tone: 'error', message: 'La confirmation a échoué. Réessayez dans un instant.' });
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      // Ensure we use the correct document ID (which is the uid)
      await updateDoc(doc(db, 'users', currentUser.uid), data);
      setCurrentUser({ ...currentUser, ...data });
      setToast({ tone: 'success', message: data.avatarUrl ? 'Photo enregistrée.' : 'Profil mis à jour.' });
    } catch (error) {
      console.error('Profile Update Error:', error);
      setToast({ tone: 'error', message: 'La mise à jour a échoué. Réessayez.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      setToast({ tone: 'error', message: 'Cette photo est trop lourde. Choisissez un fichier de moins de 800 Ko.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await updateProfile({ avatarUrl: base64String });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-surface text-white font-body selection:bg-primary selection:text-black">
      {/* Top HUD - Compact & Ergonomic */}
      <header className="sticky top-0 inset-x-0 h-14 bg-surface/80 backdrop-blur-xl border-b border-border-soft z-50 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-surface-highest p-0.5 border border-white/10 shadow-lg flex items-center justify-center overflow-hidden">
            <img src="/src/assets/images/jawhara_crest_1790419338393.jpg" className="w-full h-full object-contain" alt="VJ" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-headline text-primary leading-none">VETERANS JAWHARA</span>
            <span className="text-[8px] text-white/30 uppercase font-black tracking-widest leading-none mt-0.5">
              {currentUser.role === 'COACH' ? 'ENTRAÎNEUR' : 'JOUEUR'} · ÉQUIPE
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end text-right hidden sm:flex">
             <span className="text-[10px] font-black uppercase truncate max-w-[120px]">{currentUser.firstName} {currentUser.lastName}</span>
             <span className="text-[8px] font-bold text-secondary uppercase opacity-60">{currentUser.role === 'COACH' ? 'Entraîneur' : 'Joueur'}</span>
          </div>
          <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <LogOut size={16} className="text-white/40" />
          </button>
        </div>
      </header>

      {/* Main Viewport - Responsive Container */}
      <main className="pt-6 pb-40 px-4 sm:px-6 max-w-4xl mx-auto min-h-[calc(100vh-56px)]">
        <AnimatePresence mode="wait">
          {!activeEventId ? (
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              {activeTab === 'team' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                     <h2 className="text-2xl font-headline">Équipe</h2>
                     <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                        {roster.length} JOUEURS
                     </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                     {roster.map((player) => (
                       <PlayerCard key={player.uid} player={player} />
                     ))}
                  </div>
                </div>
              )}

              {activeTab === 'matches' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                     <h2 className="text-2xl font-headline text-white">Matchs</h2>
                     {currentUser.role === 'COACH' && (
                       <button 
                        onClick={() => setShowEventCreator(true)}
                        className="btn-elite h-10 px-4 text-[10px]"
                       >
                         <PlusCircle size={14} />
                         Créer un match
                       </button>
                     )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-card rounded-[2rem] p-4">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-2">Prochain match</div>
                      <div className="text-xl font-headline text-primary">
                        {nextEvent ? (nextEvent.type === 'MATCH' ? `vs ${nextEvent.opponent}` : 'Séance d’entraînement') : 'Aucun match prévu'}
                      </div>
                      <div className="mt-3 text-[10px] text-white/60 uppercase tracking-widest">
                        {nextEvent ? `${nextEvent.date} · ${nextEvent.time}` : 'Ajouter le prochain événement'}
                      </div>
                    </div>
                    <div className="glass-card rounded-[2rem] p-4">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-2">Disponibles</div>
                      <div className="text-3xl font-headline text-secondary">{roster.length}</div>
                      <div className="mt-3 text-[10px] text-white/60 uppercase tracking-widest">Joueurs de l’équipe</div>
                    </div>
                    <div className="glass-card rounded-[2rem] p-4">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-2">État du groupe</div>
                      <div className="text-xl font-headline text-primary">{nextEvent ? 'À préparer' : 'En attente'}</div>
                      <div className="mt-3 text-[10px] text-white/60 uppercase tracking-widest">{events.length} rendez-vous</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                     {events.length === 0 ? (
                       <div className="bg-surface-raised rounded-[2.5rem] p-12 border border-border-soft text-center flex flex-col items-center opacity-40">
                          <Calendar size={48} className="mb-4 text-white/20" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">Aucun rendez-vous prévu</h3>
                       </div>
                     ) : (
                       events.map((event) => (
                         <EventCard key={event.id} event={event} onClick={() => setActiveEvent(event.id)} />
                       ))
                     )}
                  </div>
                </div>
              )}

              {activeTab === 'standings' && (
                <div className="space-y-6">
                   <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <h2 className="text-2xl font-headline">Classement</h2>
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">SAISON 1</span>
                   </div>
                   <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-2xl">
                      <table className="w-full text-left border-collapse">
                         <thead className="bg-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                            <tr>
                               <th className="px-6 py-5">#</th>
                               <th className="px-6 py-5">Joueur</th>
                               <th className="px-6 py-5 text-center">M</th>
                               <th className="px-6 py-5 text-center">B</th>
                               <th className="px-6 py-5 text-center">P</th>
                               <th className="px-6 py-5 text-right">Note</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-white/5">
                            {[...roster].sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0)).map((player, idx) => (
                               <tr key={player.uid} className="hover:bg-white/5 transition-colors group">
                                  <td className="px-6 py-5 text-[10px] font-black text-white/20">{idx + 1}</td>
                                  <td className="px-6 py-5">
                                     <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10 group-hover:border-secondary transition-all">
                                           <img src={player.avatarUrl} className="w-full h-full object-cover" alt={player.lastName} />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-tight">{player.firstName[0]}. {player.lastName}</span>
                                     </div>
                                  </td>
                                  <td className="px-6 py-5 text-center text-[10px] font-black opacity-40 tabular-nums">{player.matchCount || 0}</td>
                                  <td className="px-6 py-5 text-center text-[10px] font-black text-[#FFD700] tabular-nums">{player.goals || 0}</td>
                                  <td className="px-6 py-5 text-center text-[10px] font-black text-[#00E5FF] tabular-nums">{player.assists || 0}</td>
                                  <td className="px-6 py-5 text-right">
                                     <span className="text-sm font-headline text-secondary tabular-nums">{player.avgRating?.toFixed(1) || '0.0'}</span>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-8">
                   <h2 className="text-2xl font-headline">Profil</h2>
                   <div className="glass-card rounded-[3rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
                      
                      <div className="flex flex-col md:flex-row gap-10 items-start md:items-center">
                         <div className="flex flex-col items-center gap-4 mx-auto md:mx-0">
                             <div className="w-44 h-44 rounded-[2.5rem] overflow-hidden border-2 border-primary/30 shadow-2xl relative group bg-surface-highest">
                               <img src={currentUser.avatarUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Avatar" />
                               <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleAvatarUpload}
                                  />
                                  <Camera className="text-white mb-2" size={32} />
                                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Mettre à jour</span>
                               </label>
                            </div>
                            <div className="flex flex-col items-center">
                               <span className="text-lg font-headline text-primary">{currentUser.firstName}</span>
                               <span className="text-4xl font-headline leading-none">{currentUser.lastName}</span>
                            </div>
                         </div>

                         <div className="flex-1 w-full space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <ProfileField label="Rôle" value={currentUser.role === 'COACH' ? 'Entraîneur' : 'Joueur'} readOnly />
                               <ProfileField label="Téléphone" value={currentUser.phoneNumber} saving={isSavingProfile} onSave={(v: string) => updateProfile({ phoneNumber: v })} />
                               <ProfileField label="Date de naissance" value={currentUser.birthDate} readOnly />
                               <ProfileField label="N° maillot" value={String(currentUser.jerseyNumber || '-')} saving={isSavingProfile} onSave={(v: string) => updateProfile({ jerseyNumber: parseInt(v) || 0 })} />
                               <ProfileField label="Poste" value={currentUser.position || '-'} saving={isSavingProfile} onSave={(v: string) => updateProfile({ position: v as any })} />
                            </div>

                              <div className="pt-6 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                               <div className="bg-white/5 rounded-2xl p-4 text-center">
                                  <span className="block text-[8px] font-black text-white/30 uppercase mb-1">Matchs</span>
                                  <span className="text-2xl font-headline text-secondary tabular-nums">{currentUser.matchCount || 0}</span>
                               </div>
                               <div className="bg-white/5 rounded-2xl p-4 text-center">
                                  <span className="block text-[8px] font-black text-white/30 uppercase mb-1">Note</span>
                                  <span className="text-2xl font-headline text-primary tabular-nums">{currentUser.avgRating?.toFixed(1) || '0.0'}</span>
                               </div>
                               <div className="bg-white/5 rounded-2xl p-4 text-center">
                                  <span className="block text-[8px] font-black text-white/30 uppercase mb-1">Buts</span>
                                  <span className="text-2xl font-headline text-[#FFD700] tabular-nums">{currentUser.goals || 0}</span>
                               </div>
                               <div className="bg-white/5 rounded-2xl p-4 text-center">
                                  <span className="block text-[8px] font-black text-white/30 uppercase mb-1">Passes</span>
                                  <span className="text-2xl font-headline text-[#00E5FF] tabular-nums">{currentUser.assists || 0}</span>
                               </div>
                            </div>

                         </div>
                      </div>
                   </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4 mb-4">
                 <button 
                  onClick={() => setActiveEvent(null)}
                  className="w-12 h-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90"
                 >
                   <ChevronRight size={24} className="rotate-180" />
                 </button>
                 <div>
                    <h3 className="text-2xl font-headline">
                      {activeEvent?.type === 'MATCH' ? `VS ${activeEvent.opponent}` : 'ENTRAÎNEMENT'}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                      <span>{activeEvent?.date}</span>
                      <span className="text-white/20">·</span>
                      <span>{activeEvent?.time}</span>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                 <div className="lg:col-span-8 space-y-10">
                    {activeEvent?.type === 'MATCH' && (
                       <div className="space-y-6">
                          <div className="flex items-center justify-between border-b border-white/5 pb-3">
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Disposition</h4>
                             <div className="flex items-center gap-1.5 text-[9px] font-black text-secondary uppercase tracking-widest">
                               <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_#00e5ff] animate-pulse" />
                               Titulaires
                             </div>
                          </div>
                          <div className="aspect-[4/5] sm:aspect-auto">
                            <PitchCanvas 
                              eventId={activeEventId!} 
                              readOnly={currentUser.role !== 'COACH' || activeEvent?.isCompleted} 
                              matchStats={activeEvent?.matchStats} 
                            />
                          </div>
                       </div>
                    )}

                    <div className="glass-card rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden">
                        {activeEvent?.isCompleted && activeEvent?.matchStats && (
                          <div className="glass-card rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden mb-8 border border-white/5">
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6">Statistiques du match</h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {Object.entries(activeEvent.matchStats).map(([uid, stats]: [string, any]) => {
                                   const player = roster.find(p => p.uid === uid);
                                   if (!player) return null;
                                   return (
                                      <div key={uid} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 group hover:bg-white/10 transition-all">
                                         <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 group-hover:border-primary/50 transition-colors">
                                               <img src={player.avatarUrl} className="w-full h-full object-cover" alt={player.lastName} />
                                            </div>
                                            <div className="flex flex-col">
                                               <span className="text-[10px] font-black uppercase tracking-tight text-white/90">{player.lastName}</span>
                                            </div>
                                         </div>
                                         <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1">
                                               {stats.goals > 0 && Array.from({length: stats.goals}).map((_, i) => (
                                                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_#00FF66]" />
                                               ))}
                                            </div>
                                            <div className={cn(
                                               "px-2 py-0.5 rounded-md text-[10px] font-black text-white shadow-lg",
                                               stats.rating >= 8.5 ? "bg-secondary" : 
                                               stats.rating >= 7.0 ? "bg-primary" : 
                                               "bg-orange-500"
                                            )}>
                                               {stats.rating.toFixed(1)}
                                            </div>
                                         </div>
                                      </div>
                                   );
                                })}
                             </div>
                          </div>
                        )}

                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6">Informations du match</h4>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <MapPin size={24} />
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[8px] font-black opacity-30 uppercase tracking-widest">Lieu</span>
                                <span className="text-sm font-black uppercase tracking-tight">{activeEvent?.venue}</span>
                             </div>
                          </div>
                          {activeEvent?.type === 'MATCH' && (
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                                  <Shield size={24} />
                               </div>
                               <div className="flex flex-col">
                                  <span className="text-[8px] font-black opacity-30 uppercase tracking-widest">Adversaire</span>
                                  <span className="text-sm font-black uppercase tracking-tight">{activeEvent?.opponent}</span>
                               </div>
                            </div>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-8">
                    <div className="glass-card rounded-[2.5rem] p-6 shadow-xl flex flex-col gap-6 relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
                       
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Présences</h4>
                          <span className="text-lg font-headline text-primary">{participantsCount} confirmé{participantsCount > 1 ? 's' : ''}</span>
                       </div>
                       
                       {currentUser.role === 'PLAYER' && (
                         <button 
                          onClick={() => handleRsvp(activeEventId!)}
                          disabled={rsvpState === 'saving' || rsvpState === 'saved' || confirmedUsers.some(user => user.uid === currentUser.uid)}
                          className="btn-elite w-full h-16 group disabled:opacity-60 disabled:cursor-default"
                         >
                            {rsvpState === 'saving' ? 'Confirmation...' : rsvpState === 'saved' || confirmedUsers.some(user => user.uid === currentUser.uid) ? 'Présence confirmée' : 'Confirmer ma présence'}
                            {rsvpState === 'saving' ? <Loader2 size={20} className="animate-spin" /> : rsvpState === 'saved' || confirmedUsers.some(user => user.uid === currentUser.uid) ? <CheckCircle2 size={20} /> : <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                         </button>
                       )}
                       {rsvpState === 'error' && (
                         <p className="text-center text-xs text-red-400">Impossible de confirmer pour le moment. Réessayez.</p>
                       )}

                       <div className="space-y-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Joueurs confirmés</span>
                          <div className="flex flex-wrap gap-2.5">
                             {confirmedUsers.length === 0 ? (
                               <span className="text-[10px] opacity-20 uppercase font-black tracking-widest">Personne n’a encore répondu</span>
                             ) : (
                               confirmedUsers.map(player => (
                                 <div key={player.uid} className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 shadow-lg relative group bg-surface-highest transition-all hover:scale-110 active:scale-95">
                                    <img src={player.avatarUrl} className="w-full h-full object-cover" alt={player.lastName} />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                       <span className="text-[6px] font-black text-center px-1 uppercase text-white">{player.lastName}</span>
                                    </div>
                                 </div>
                               ))
                             )}
                          </div>
                       </div>
                    </div>

                    {currentUser.role === 'COACH' && !activeEvent?.isCompleted && (
                       <button 
                        onClick={() => setShowRatingConsole(true)}
                        className="btn-ghost w-full"
                       >
                          Finaliser le match
                       </button>
                    )}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation principale */}
      <nav className={cn(
        "fixed bottom-0 inset-x-0 h-18 sm:h-20 bg-surface/90 backdrop-blur-3xl border-t border-border-soft z-50 px-4 transition-transform duration-500 pb-safe",
        activeEventId ? "translate-y-full" : "translate-y-0"
      )}>
        <div className="grid grid-cols-4 h-full items-center max-w-lg mx-auto">
          <NavTab 
            icon={<LayoutGrid size={24} />} 
            label="Équipe" 
            active={activeTab === 'team'} 
            onClick={() => setActiveTab('team')} 
          />
          <NavTab 
            icon={<Compass size={24} />} 
            label="Matchs" 
            active={activeTab === 'matches'} 
            onClick={() => setActiveTab('matches')} 
          />
          <NavTab 
            icon={<Trophy size={24} />} 
            label="Classement" 
            active={activeTab === 'standings'} 
            onClick={() => setActiveTab('standings')} 
          />
          <NavTab 
            icon={<User size={24} />} 
            label="Profil" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
          />
        </div>
      </nav>

      {/* Modal Overlays */}
      <AnimatePresence>
         {showEventCreator && (
           <EventCreator onClose={() => setShowEventCreator(false)} />
         )}
         {showRatingConsole && activeEventId && (
           <RatingConsole eventId={activeEventId} onClose={() => setShowRatingConsole(false)} />
         )}
      </AnimatePresence>
      {toast && <FeedbackToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}

function ProfileField({ label, value, onSave, readOnly, saving }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);

  const handleSave = () => {
    if (saving) return;
    onSave(val);
    setIsEditing(false);
  };

  return (
    <div className="space-y-2 flex flex-col">
       <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">{label}</label>
       <div className="relative group">
          <input 
            type="text" 
            value={val}
            onChange={e => setVal(e.target.value)}
            disabled={!isEditing || readOnly}
            className={cn(
              "w-full h-14 bg-white/5 rounded-2xl px-5 text-xs font-bold border border-white/5 focus:border-primary/30 focus:outline-none transition-all uppercase text-white disabled:opacity-50",
              isEditing && "bg-white/10 border-primary/20"
            )}
          />
          {!readOnly && (
            <button 
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
              disabled={saving}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5"
            >
               {isEditing ? <Save size={16} /> : <Settings size={16} />}
            </button>
          )}
       </div>
    </div>
  );
}

function EventCard({ event, onClick }: { event: SquadEvent, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full glass-card p-6 rounded-[2.5rem] flex items-center justify-between group hover:bg-surface-raised transition-all hover:border-primary/20 shadow-2xl active:scale-[0.99]"
    >
      <div className="flex items-center gap-6">
         <div className="w-16 h-16 rounded-[1.5rem] bg-surface-highest flex items-center justify-center text-secondary group-hover:scale-105 transition-all duration-500 shadow-inner border border-white/5">
            {event.type === 'MATCH' ? <Shield size={28} /> : <Calendar size={28} />}
         </div>
         <div className="flex flex-col text-left">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">
               {event.type === 'MATCH' ? 'MATCH' : 'ENTRAÎNEMENT'}
            </span>
            <h4 className="text-xl font-headline text-white group-hover:text-primary transition-colors">
              {event.type === 'MATCH' ? `VS ${event.opponent}` : 'SÉANCE D’ENTRAÎNEMENT'}
            </h4>
            <div className="flex items-center gap-4 mt-3 text-white/40">
               <span className="text-[10px] font-black uppercase flex items-center gap-1.5">
                  <Calendar size={12} className="text-primary" /> {event.date}
               </span>
               <span className="text-[10px] font-black uppercase flex items-center gap-1.5">
                  <MapPin size={12} className="text-primary" /> {event.venue}
               </span>
            </div>
         </div>
      </div>
      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-primary group-hover:text-black transition-all">
        <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}

function NavTab({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 transition-all duration-500 relative py-2",
        active ? "text-primary scale-110" : "text-white/30 hover:text-white"
      )}
    >
      {active && (
        <motion.div 
          layoutId="tab-active"
          className="absolute -top-1 w-1 h-1 rounded-full bg-primary shadow-[0_0_12px_#00FF66]"
        />
      )}
      <div className={cn("transition-transform duration-500", active && "drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]")}>
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
    </button>
  );
}

function EventCreator({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState<Partial<SquadEvent>>({
    type: 'MATCH',
    date: new Date().toISOString().split('T')[0],
    time: '21:00',
    venue: 'Stade El Kantaoui',
    opponent: '',
    isCompleted: false,
    isPublished: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || createdMessage) return;
    if (!formData.date || !formData.time || !formData.venue || (formData.type === 'MATCH' && !formData.opponent?.trim())) {
      setSubmitError(formData.type === 'MATCH' ? 'Renseignez la date, l’heure, le lieu et l’adversaire.' : 'Renseignez la date, l’heure et le lieu.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await addDoc(collection(db, 'events'), {
        ...formData,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid
      });
      
      setCreatedMessage(formData.type === 'MATCH' ? 'Match créé. Les joueurs peuvent confirmer leur présence.' : 'Séance créée. Les joueurs peuvent confirmer leur présence.');
      window.setTimeout(onClose, 1000);
    } catch (error) {
      console.error('Event Creation Error:', error);
      setSubmitError('La création a échoué. Vérifiez votre connexion puis réessayez.');
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
    >
       <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#12141D] w-full max-w-lg rounded-[2.5rem] border border-white/5 p-8 shadow-3xl overflow-hidden relative"
       >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF66]/5 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-2xl font-bold font-headline uppercase tracking-tight mb-6 text-white text-center">Créer un évènement</h2>
          
           <form onSubmit={handleSubmit} className="space-y-6">
             {createdMessage && <div role="status" className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm font-semibold text-primary"><CheckCircle2 size={20} className="mt-0.5 shrink-0" /><span>{createdMessage}</span></div>}
             {submitError && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200"><AlertCircle size={20} className="mt-0.5 shrink-0" /><span>{submitError}</span></div>}
             <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: 'MATCH'})}
                  disabled={isSubmitting || Boolean(createdMessage)}
                  className={cn("py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", formData.type === 'MATCH' ? "bg-white/10 text-white" : "text-on-surface-variant")}
                >Match officiel</button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: 'TRAINING'})}
                  disabled={isSubmitting || Boolean(createdMessage)}
                  className={cn("py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", formData.type === 'TRAINING' ? "bg-white/10 text-white" : "text-on-surface-variant")}
                >Entraînement</button>
             </div>

             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5 text-left">
                      <label className="text-[8px] font-bold text-on-surface-variant uppercase ml-2 tracking-widest">Date</label>
                      <input 
                        type="date" 
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        disabled={isSubmitting || Boolean(createdMessage)}
                        className="w-full h-12 bg-white/5 rounded-xl px-4 text-xs font-bold border border-white/5 focus:border-[#00FF66]/30 focus:outline-none transition-all uppercase text-white"
                      />
                   </div>
                   <div className="space-y-1.5 text-left">
                      <label className="text-[8px] font-bold text-on-surface-variant uppercase ml-2 tracking-widest">Heure</label>
                      <input 
                        type="time" 
                        value={formData.time}
                        onChange={e => setFormData({...formData, time: e.target.value})}
                        disabled={isSubmitting || Boolean(createdMessage)}
                        className="w-full h-12 bg-white/5 rounded-xl px-4 text-xs font-bold border border-white/5 focus:border-[#00FF66]/30 focus:outline-none transition-all text-white"
                      />
                   </div>
                </div>

                <div className="space-y-1.5 text-left">
                   <label className="text-[8px] font-bold text-on-surface-variant uppercase ml-2 tracking-widest">Stade / Lieu</label>
                   <input 
                    type="text" 
                    value={formData.venue}
                    onChange={e => setFormData({...formData, venue: e.target.value})}
                    disabled={isSubmitting || Boolean(createdMessage)}
                    placeholder="E.G. STADE EL KANTAOUI"
                    className="w-full h-12 bg-white/5 rounded-xl px-4 text-xs font-bold border border-white/5 focus:border-[#00FF66]/30 focus:outline-none transition-all uppercase text-white placeholder:opacity-30"
                   />
                </div>

                {formData.type === 'MATCH' && (
                  <div className="space-y-1.5 text-left">
                    <label className="text-[8px] font-bold text-on-surface-variant uppercase ml-2 tracking-widest">Adversaire</label>
                    <input 
                      type="text" 
                      value={formData.opponent}
                      onChange={e => setFormData({...formData, opponent: e.target.value})}
                      disabled={isSubmitting || Boolean(createdMessage)}
                      placeholder="E.G. ÉTOILE VETERANS"
                      className="w-full h-12 bg-white/5 rounded-xl px-4 text-xs font-bold border border-white/5 focus:border-[#00FF66]/30 focus:outline-none transition-all uppercase text-white placeholder:opacity-30"
                    />
                  </div>
                )}
             </div>

             <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="btn-ghost flex-1 h-16"
                >Annuler</button>
                <button 
                  type="submit"
                  disabled={isSubmitting || Boolean(createdMessage)}
                  className="btn-elite flex-1 h-16 disabled:opacity-60"
                >{isSubmitting ? 'Création...' : 'Créer le rendez-vous'}</button>
             </div>
          </form>
       </motion.div>
    </motion.div>
  );
}
