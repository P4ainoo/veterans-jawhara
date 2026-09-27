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
  Activity,
  Clock,
  AlertCircle,
  Check,
  X,
  Bell,
  BellOff
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { useSquadStore, SquadEvent, UserProfile } from './store/useSquadStore';
import { cn } from './lib/utils';
import { PitchCanvas } from './components/PitchCanvas';
import { PlayerCard } from './components/PlayerCard';
import { RatingConsole } from './components/RatingConsole';
import { useNotifications } from './hooks/useNotifications';
import { compressImage } from './lib/image-utils';
import { auth, db } from './lib/firebase';
import { 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  getDocs,
  where
} from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';

type Tab = 'dashboard' | 'squad' | 'matchday' | 'reports' | 'profile';

export default function App() {
  const { currentUser, setCurrentUser, roster, setRoster, events, setEvents, activeEventId, setActiveEvent } = useSquadStore();
  const { permission, requestPermission } = useNotifications();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showEventCreator, setShowEventCreator] = useState(false);
  const [showRatingConsole, setShowRatingConsole] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

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
    const q = query(collection(db, 'events'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const evts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SquadEvent));
      setEvents(evts);
    }, (error) => {
      console.error("Events Listener Error:", error);
    });
  }, [currentUser, setEvents, isAuthChecking]);

  const [rsvps, setRsvps] = useState<Record<string, 'JOINED' | 'DECLINED'>>({});

  // Fetch RSVPs for active event
  useEffect(() => {
    if (isAuthChecking || !auth.currentUser || !activeEventId) {
      setRsvps({});
      return;
    }
    const rsvpRef = collection(db, 'events', activeEventId, 'rsvps');
    return onSnapshot(rsvpRef, (snapshot) => {
      const rsvpMap: Record<string, 'JOINED' | 'DECLINED'> = {};
      snapshot.docs.forEach(doc => {
        rsvpMap[doc.id] = doc.data().status;
      });
      setRsvps(rsvpMap);
    }, (error) => {
      console.error("RSVP Listener Error:", error);
    });
  }, [activeEventId, roster, isAuthChecking]);

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
  const confirmedUsers = roster.filter(u => rsvps[u.uid] === 'JOINED');
  const declinedUsers = roster.filter(u => rsvps[u.uid] === 'DECLINED');
  const participantsCount = confirmedUsers.length;

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  const handleRsvp = async (eventId: string, status: 'JOINED' | 'DECLINED') => {
    try {
      const rsvpDoc = doc(db, 'events', eventId, 'rsvps', currentUser.uid);
      await setDoc(rsvpDoc, {
        userId: currentUser.uid,
        eventId,
        status,
        timestamp: new Date().toISOString()
      });
      alert(`Présence mise à jour : ${status === 'JOINED' ? 'PRÉSENT' : 'ABSENT'}`);
    } catch (error) {
      console.error('RSVP Error:', error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      // Ensure we use the correct document ID (which is the uid)
      await updateDoc(doc(db, 'users', currentUser.uid), data);
      setCurrentUser({ ...currentUser, ...data });
      // If it's not a photo update, show generic success
      if (!data.avatarUrl) {
        alert("Profil synchronisé.");
      }
    } catch (error) {
      console.error('Profile Update Error:', error);
      alert("Échec de la synchronisation. Vérifiez votre connexion.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = reader.result as string;
        // Compress the image before saving
        const compressed = await compressImage(base64String);
        await updateProfile({ avatarUrl: compressed });
        alert("Photo mise à jour : sauvegardée dans le coffre de l'équipe.");
      } catch (error) {
        console.error("Compression error:", error);
        alert("Erreur lors du traitement de l'image.");
      }
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
              COMMANDEMENT {currentUser.role === 'COACH' ? 'ENTRAÎNEUR' : 'JOUEUR'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end text-right hidden sm:flex">
             <span className="text-[10px] font-black uppercase truncate max-w-[120px]">{currentUser.firstName} {currentUser.lastName}</span>
             <span className="text-[8px] font-bold text-secondary uppercase opacity-60">Elite Level 12</span>
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
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                     <h2 className="text-2xl font-headline text-white">Tableau de Bord</h2>
                     <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                        <Activity size={14} className="animate-pulse" /> État en Direct
                     </div>
                  </div>

                  {/* Quick Actions Card */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                     {currentUser.role === 'COACH' && (
                       <button 
                        onClick={() => setShowEventCreator(true)}
                        className="bg-primary text-black p-4 rounded-3xl flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg active:scale-95"
                       >
                         <PlusCircle size={24} />
                         <span className="text-[9px] font-black uppercase tracking-widest">Ajouter Match</span>
                       </button>
                     )}
                     <button 
                      onClick={() => setActiveTab('squad')}
                      className="bg-white/5 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-95"
                     >
                       <Users size={24} className="text-secondary" />
                       <span className="text-[9px] font-black uppercase tracking-widest">Effectif</span>
                     </button>
                     <button 
                      onClick={() => setActiveTab('matchday')}
                      className="bg-white/5 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-95"
                     >
                       <Calendar size={24} className="text-primary" />
                       <span className="text-[9px] font-black uppercase tracking-widest">Calendrier</span>
                     </button>
                     <button 
                      onClick={() => setActiveTab('reports')}
                      className="bg-white/5 border border-white/5 p-4 rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-95"
                     >
                       <Trophy size={24} className="text-[#FFD700]" />
                       <span className="text-[9px] font-black uppercase tracking-widest">Stats</span>
                     </button>
                  </div>

                  {/* Next Match Spotlight */}
                  {events.find(e => !e.isCompleted) ? (
                    <div className="glass-card rounded-[2.5rem] p-8 border border-primary/20 relative overflow-hidden shadow-2xl">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                       <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
                          <div className="flex-1 space-y-4 text-center sm:text-left">
                             <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">Prochain Match</span>
                             <h3 className="text-3xl font-headline">VS {events.find(e => !e.isCompleted)?.opponent}</h3>
                             <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-white/40">
                                <span className="text-xs font-black uppercase flex items-center gap-2">
                                   <Calendar size={14} className="text-primary" /> {events.find(e => !e.isCompleted)?.date}
                                </span>
                                <span className="text-xs font-black uppercase flex items-center gap-2">
                                   <Clock size={14} className="text-primary" /> {events.find(e => !e.isCompleted)?.time}
                                </span>
                                <span className="text-xs font-black uppercase flex items-center gap-2">
                                   <MapPin size={14} className="text-primary" /> {events.find(e => !e.isCompleted)?.venue}
                                </span>
                             </div>
                          </div>
                          <button 
                            onClick={() => setActiveEvent(events.find(e => !e.isCompleted)?.id!)}
                            className="btn-elite px-8 py-4 h-auto text-xs"
                          >
                             Détails du Match <ArrowRight size={16} />
                          </button>
                       </div>
                    </div>
                  ) : (
                    <div className="glass-card rounded-[2.5rem] p-12 text-center border border-white/5 opacity-40">
                       <Shield size={48} className="mx-auto mb-4 text-white/20" />
                       <h3 className="text-[10px] font-black uppercase tracking-widest">Aucun Match Prévu</h3>
                    </div>
                  )}

                  {/* Team Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="glass-card p-6 rounded-[2rem] border border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                           <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">État de l'Effectif</h4>
                           <button 
                            onClick={() => setActiveTab('squad')}
                            className="text-[8px] font-black text-primary uppercase tracking-widest hover:underline"
                           >Voir Tout</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-white/5 p-4 rounded-2xl">
                              <span className="text-2xl font-headline text-primary">{roster.length}</span>
                              <span className="block text-[8px] font-black uppercase opacity-40">Inscrits</span>
                           </div>
                           <div className="bg-white/5 p-4 rounded-2xl">
                              <span className="text-2xl font-headline text-secondary">{roster.filter(p => p.healthStatus === 'HEALTHY' || !p.healthStatus).length}</span>
                              <span className="block text-[8px] font-black uppercase opacity-40">Disponibles</span>
                           </div>
                        </div>
                        {roster.some(p => p.healthStatus === 'INJURED') && (
                          <div className="pt-2">
                             <span className="text-[8px] font-black text-red-500 uppercase tracking-widest block mb-2">Rapport de Blessures</span>
                             <div className="flex flex-wrap gap-2">
                                {roster.filter(p => p.healthStatus === 'INJURED').map(p => (
                                  <div key={p.uid} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
                                     <div className="w-4 h-4 rounded-full overflow-hidden border border-red-500/40">
                                        <img src={p.avatarUrl} className="w-full h-full object-cover" />
                                     </div>
                                     <span className="text-[8px] font-black uppercase text-red-500">{p.lastName}</span>
                                  </div>
                                ))}
                             </div>
                          </div>
                        )}
                     </div>
                     <div className="glass-card p-6 rounded-[2rem] border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Progression Saison</h4>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-white/5 p-4 rounded-2xl">
                              <span className="text-2xl font-headline text-[#FFD700]">{events.filter(e => e.isCompleted).length}</span>
                              <span className="block text-[8px] font-black uppercase opacity-40">Joués</span>
                           </div>
                           <div className="bg-white/5 p-4 rounded-2xl">
                              <span className="text-2xl font-headline text-[#00E5FF]">{roster.reduce((acc, p) => acc + (p.goals || 0), 0)}</span>
                              <span className="block text-[8px] font-black uppercase opacity-40">Buts Équipe</span>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {activeTab === 'squad' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                     <h2 className="text-2xl font-headline text-white">Effectif de l'Équipe</h2>
                     <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                        {roster.length} JOUEURS TOTAL
                     </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                     {roster.map((player) => (
                       <PlayerCard key={player.uid} player={player} />
                     ))}
                  </div>
                </div>
              )}

              {activeTab === 'matchday' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                     <h2 className="text-2xl font-headline text-white">Calendrier des Matchs</h2>
                     {currentUser.role === 'COACH' && (
                       <button 
                        onClick={() => setShowEventCreator(true)}
                        className="btn-elite h-10 px-4 text-[10px]"
                       >
                         <PlusCircle size={14} />
                         Ajouter Match
                       </button>
                     )}
                  </div>

                  <div className="flex flex-col gap-4">
                     {events.length === 0 ? (
                       <div className="bg-surface-raised rounded-[2.5rem] p-12 border border-border-soft text-center flex flex-col items-center opacity-40">
                          <Calendar size={48} className="mb-4 text-white/20" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">Aucun Match Trouvé</h3>
                       </div>
                     ) : (
                       events.map((event) => (
                         <EventCard key={event.id} event={event} onClick={() => setActiveEvent(event.id)} />
                       ))
                     )}
                  </div>
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="space-y-6">
                   <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <h2 className="text-2xl font-headline text-white">Stats de Performance</h2>
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">SAISON 1</span>
                   </div>
                   <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5">
                      <table className="w-full text-left border-collapse">
                         <thead className="bg-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                            <tr>
                               <th className="px-6 py-5">#</th>
                               <th className="px-6 py-5">Joueur</th>
                               <th className="px-6 py-5 text-center">Matchs</th>
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
                                        <span className="text-xs font-black uppercase tracking-tight">{player.lastName}</span>
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
                   <h2 className="text-2xl font-headline text-white">Profile Settings</h2>
                   <div className="glass-card rounded-[3rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden border border-white/5">
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
                                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Update Photo</span>
                               </label>
                            </div>
                            <div className="flex flex-col items-center">
                               <span className="text-lg font-headline text-primary">{currentUser.firstName}</span>
                               <span className="text-4xl font-headline leading-none">{currentUser.lastName}</span>
                            </div>
                         </div>

                         <div className="flex-1 w-full space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <ProfileField label="Role" value={currentUser.role} readOnly />
                               <ProfileField label="Phone" value={currentUser.phoneNumber} onSave={(v: string) => updateProfile({ phoneNumber: v })} />
                               <ProfileField label="Health Status" value={currentUser.healthStatus || 'HEALTHY'} onSave={(v: string) => updateProfile({ healthStatus: v as any })} />
                               <ProfileField label="Jersey #" value={String(currentUser.jerseyNumber || '-')} onSave={(v: string) => updateProfile({ jerseyNumber: parseInt(v) || 0 })} />
                               <ProfileField label="Position" value={currentUser.position || '-'} onSave={(v: string) => updateProfile({ position: v as any })} />
                            </div>

                              <div className="pt-6 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                               <div className="bg-white/5 rounded-2xl p-4 text-center">
                                  <span className="block text-[8px] font-black text-white/30 uppercase mb-1">Missions</span>
                                  <span className="text-2xl font-headline text-secondary tabular-nums">{currentUser.matchCount || 0}</span>
                               </div>
                               <div className="bg-white/5 rounded-2xl p-4 text-center">
                                  <span className="block text-[8px] font-black text-white/30 uppercase mb-1">Rating</span>
                                  <span className="text-2xl font-headline text-primary tabular-nums">{currentUser.avgRating?.toFixed(1) || '0.0'}</span>
                               </div>
                               <div className="bg-white/5 rounded-2xl p-4 text-center">
                                  <span className="block text-[8px] font-black text-white/30 uppercase mb-1">Goals</span>
                                  <span className="text-2xl font-headline text-[#FFD700] tabular-nums">{currentUser.goals || 0}</span>
                               </div>
                               <div className="bg-white/5 rounded-2xl p-4 text-center">
                                  <span className="block text-[8px] font-black text-white/30 uppercase mb-1">Assists</span>
                                  <span className="text-2xl font-headline text-[#00E5FF] tabular-nums">{currentUser.assists || 0}</span>
                               </div>
                            </div>

                            <div className="pt-6 border-t border-white/5 space-y-3">
                               <button 
                                onClick={async () => {
                                  const dPlayers = [
                                    { uid: 'd1', firstName: 'Mehdi', lastName: 'SASSI', jerseyNumber: 10, avgRating: 9.2, matchCount: 15, goals: 12, assists: 8, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mehdi' },
                                    { uid: 'd2', firstName: 'Zied', lastName: 'JAZIRI', jerseyNumber: 11, avgRating: 8.5, matchCount: 14, goals: 8, assists: 4, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zied' },
                                    { uid: 'mock-leader', firstName: 'Coach', lastName: 'LOUAY', jerseyNumber: 1, avgRating: 7.5, matchCount: 1, goals: 0, assists: 0, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Coach' }
                                  ];
                                  for(const p of dPlayers) await setDoc(doc(db, 'users', p.uid), { ...p, role: 'PLAYER', isOnboarded: true });
                                  const mId = 'demo-match';
                                  await setDoc(doc(db, 'events', mId), {
                                    id: mId, type: 'MATCH', opponent: 'ÉTOILE VETERANS', date: '2026-09-25', time: '20:30', venue: 'Sousse', isCompleted: true, isPublished: true, formation: '3-2-1',
                                    pitchAssignments: { 
                                      'slot-0-0': 'd1', 
                                      'slot-1-0': 'd2', 
                                      'slot-2-1': 'mock-leader',
                                      'gk': currentUser?.uid 
                                    },
                                    matchStats: { 
                                      'd1': { goals: 2, assists: 0, rating: 9.4 }, 
                                      'd2': { goals: 0, assists: 2, rating: 8.8 }, 
                                      'mock-leader': { goals: 0, assists: 0, rating: 7.2 },
                                      [currentUser?.uid||'']: { goals: 0, assists: 0, rating: 7.5 } 
                                    }
                                  });
                                  setActiveEvent(mId);
                                  alert('Tactical Demo Deployed!');
                                }}
                                className="w-full h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 font-black text-[9px] uppercase tracking-[0.2em] mb-4"
                               >
                                  Deploy Tactical Demo Data
                               </button>
                               <button 
                                onClick={requestPermission}
                                className={cn(
                                  "w-full h-14 rounded-2xl flex items-center justify-center gap-3 transition-all font-headline text-sm uppercase tracking-widest",
                                  permission === 'granted' 
                                    ? "bg-primary/10 text-primary border border-primary/20 cursor-default" 
                                    : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10"
                                )}
                               >
                                 {permission === 'granted' ? (
                                   <>
                                     <Bell size={18} />
                                     Comms Active
                                   </>
                                 ) : (
                                   <>
                                     <BellOff size={18} />
                                     Enable Tactical Alerts
                                   </>
                                 )}
                               </button>
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
                      {activeEvent?.type === 'MATCH' ? `VS ${activeEvent.opponent}` : 'SQUAD DRILLS'}
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
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Déploiement Tactique</h4>
                             <div className="flex items-center gap-1.5 text-[9px] font-black text-secondary uppercase tracking-widest">
                               <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_#00e5ff] animate-pulse" />
                               Titulaire
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
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6">Stats de Match</h4>
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

                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6">Détails du Match</h4>
                       
                       {activeEvent?.notes && (
                         <div className="mb-8 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                            <div className="flex items-center gap-2 mb-2">
                               <AlertCircle size={14} className="text-primary" />
                               <span className="text-[9px] font-black uppercase tracking-widest text-primary">Notes de l'Entraîneur</span>
                            </div>
                            <p className="text-xs font-bold text-white/80 leading-relaxed uppercase">
                               {activeEvent.notes}
                            </p>
                         </div>
                       )}
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <MapPin size={24} />
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[8px] font-black opacity-30 uppercase tracking-widest">Lieu du Match</span>
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
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Attendance</h4>
                          <span className="text-lg font-headline text-primary">{participantsCount} GOING</span>
                       </div>
                       
                       {currentUser.role === 'PLAYER' && !activeEvent?.isCompleted && (
                         <div className="grid grid-cols-2 gap-3">
                            <button 
                             onClick={() => handleRsvp(activeEventId!, 'JOINED')}
                             className={cn(
                               "h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all",
                               rsvps[currentUser.uid] === 'JOINED' 
                                 ? "bg-primary text-black shadow-lg shadow-primary/20" 
                                 : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10"
                             )}
                            >
                               <Check size={16} /> Going
                            </button>
                            <button 
                             onClick={() => handleRsvp(activeEventId!, 'DECLINED')}
                             className={cn(
                               "h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all",
                               rsvps[currentUser.uid] === 'DECLINED' 
                                 ? "bg-red-500 text-white shadow-lg shadow-red-500/20" 
                                 : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10"
                             )}
                            >
                               <X size={16} /> Unavailable
                            </button>
                         </div>
                       )}

                       <div className="space-y-6">
                          <div className="space-y-3">
                             <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Confirmed ({confirmedUsers.length})</span>
                             <div className="flex flex-wrap gap-2.5">
                                {confirmedUsers.length === 0 ? (
                                  <span className="text-[10px] opacity-20 uppercase font-black tracking-widest">Waiting for Signal...</span>
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

                          {declinedUsers.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-white/5">
                               <span className="text-[10px] font-black uppercase tracking-widest text-red-500/40">Unavailable ({declinedUsers.length})</span>
                               <div className="flex flex-wrap gap-2.5">
                                  {declinedUsers.map(player => (
                                    <div key={player.uid} className="w-9 h-9 rounded-xl overflow-hidden border border-white/10 opacity-40 grayscale filter hover:grayscale-0 hover:opacity-100 transition-all cursor-help relative group">
                                       <img src={player.avatarUrl} className="w-full h-full object-cover" alt={player.lastName} />
                                       <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <span className="text-[5px] font-black text-center px-1 uppercase text-white">{player.lastName}</span>
                                       </div>
                                    </div>
                                  ))}
                               </div>
                            </div>
                          )}
                       </div>
                    </div>

                    {currentUser.role === 'COACH' && !activeEvent?.isCompleted && (
                       <button 
                        onClick={() => setShowRatingConsole(true)}
                        className="btn-ghost w-full"
                       >
                          Finaliser le Match & Noter
                       </button>
                    )}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quick Profile Footer - Floating Ergonomic */}
      {!activeEventId && (
        <div className="fixed bottom-20 sm:bottom-24 inset-x-0 px-6 z-40 pointer-events-none pb-safe">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto bg-surface-raised/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 flex items-center justify-between shadow-3xl pointer-events-auto shadow-black"
          >
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-primary/40 bg-surface-highest shadow-inner">
                   <img src={currentUser.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary">{currentUser.role} UNIT</span>
                   <span className="text-xs font-black uppercase tracking-tight leading-none">{currentUser.firstName} {currentUser.lastName}</span>
                </div>
             </div>
             <button 
              onClick={() => setActiveTab('profile')}
              className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest transition-all border border-white/5 active:scale-95"
             >
                Modifier Profil
             </button>
          </motion.div>
        </div>
      )}

      {/* Global Tab Navigation - Elite Sports Pattern */}
      <nav className={cn(
        "fixed bottom-0 inset-x-0 h-18 sm:h-20 bg-surface/90 backdrop-blur-3xl border-t border-border-soft z-50 px-4 transition-transform duration-500 pb-safe",
        activeEventId ? "translate-y-full" : "translate-y-0"
      )}>
        <div className="grid grid-cols-5 h-full items-center max-w-lg mx-auto">
          <NavTab 
            icon={<LayoutGrid size={22} />} 
            label="Dash" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavTab 
            icon={<Users size={22} />} 
            label="Effectif" 
            active={activeTab === 'squad'} 
            onClick={() => setActiveTab('squad')} 
          />
          <NavTab 
            icon={<Compass size={22} />} 
            label="Matchs" 
            active={activeTab === 'matchday'} 
            onClick={() => setActiveTab('matchday')} 
          />
          <NavTab 
            icon={<Trophy size={22} />} 
            label="Stats" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
          />
          <NavTab 
            icon={<User size={22} />} 
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
    </div>
  );
}

function ProfileField({ label, value, onSave, readOnly }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);

  const handleSave = () => {
    onSave(val);
    setIsEditing(false);
  };

  const isSelect = label === 'État de Santé' || label === 'Poste' || label === 'Rôle';
  
  const healthMapping: Record<string, string> = {
    'HEALTHY': 'SAIN',
    'INJURED': 'BLESSÉ',
    'RECOVERING': 'RÉCUPÉRATION',
    'AWAY': 'ABSENT'
  };

  const roleMapping: Record<string, string> = {
    'PLAYER': 'JOUEUR',
    'COACH': 'ENTRAÎNEUR',
    'ADMIN': 'ADMIN'
  };

  const options = label === 'État de Santé' 
    ? ['HEALTHY', 'INJURED', 'RECOVERING', 'AWAY']
    : label === 'Poste'
    ? ['GK', 'DEF', 'MID', 'FWD']
    : ['PLAYER', 'COACH', 'ADMIN'];

  const getDisplayVal = (v: string) => {
    if (label === 'État de Santé') return healthMapping[v] || v;
    if (label === 'Rôle') return roleMapping[v] || v;
    return v;
  };

  return (
    <div className="space-y-2 flex flex-col">
       <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">{label}</label>
       <div className="relative group">
          {isEditing && !readOnly ? (
            isSelect ? (
              <select 
                value={val}
                onChange={e => setVal(e.target.value)}
                className="w-full h-14 bg-white/10 rounded-2xl px-5 text-xs font-bold border border-primary/20 focus:outline-none transition-all uppercase text-white appearance-none"
              >
                {options.map(opt => <option key={opt} value={opt} className="bg-surface">{getDisplayVal(opt)}</option>)}
              </select>
            ) : (
              <input 
                type="text" 
                value={val}
                onChange={e => setVal(e.target.value)}
                className="w-full h-14 bg-white/10 rounded-2xl px-5 text-xs font-bold border border-primary/20 focus:outline-none transition-all uppercase text-white"
              />
            )
          ) : (
            <div className="w-full h-14 bg-white/5 rounded-2xl px-5 flex items-center text-xs font-bold border border-white/5 text-white/80 uppercase">
              {getDisplayVal(val)}
            </div>
          )}
          {!readOnly && (
            <button 
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
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
               {event.type}
            </span>
            <h4 className="text-xl font-headline text-white group-hover:text-primary transition-colors">
              {event.type === 'MATCH' ? `VS ${event.opponent}` : 'SQUAD TRAINING'}
            </h4>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-white/40">
               <span className="text-[10px] font-black uppercase flex items-center gap-1.5">
                  <Calendar size={12} className="text-primary" /> {event.date}
               </span>
               <span className="text-[10px] font-black uppercase flex items-center gap-1.5">
                  <Clock size={12} className="text-primary" /> {event.time}
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
  const { events, setEvents } = useSquadStore();
  const [formData, setFormData] = useState<Partial<SquadEvent>>({
    type: 'MATCH',
    date: new Date().toISOString().split('T')[0],
    time: '21:00',
    venue: 'Stade El Kantaoui',
    opponent: '',
    isCompleted: false,
    isPublished: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const eventId = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'events', eventId), {
        ...formData,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid
      });
      
      // Notify about new mission
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('NOUVELLE MISSION ÉQUIPE', {
          body: `${formData.type === 'MATCH' ? 'Match vs ' + formData.opponent : 'Entraînement'} a été publié. Signalez votre présence !`,
          icon: '/icon-512.jpg'
        });
      }

      onClose();
    } catch (error) {
      console.error('Event Creation Error:', error);
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
          <h2 className="text-2xl font-bold font-headline uppercase tracking-tight mb-6 text-white text-center">Planifier un Match</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
             <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: 'MATCH'})}
                  className={cn("py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", formData.type === 'MATCH' ? "bg-white/10 text-white" : "text-white/40")}
                >Match Officiel</button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, type: 'TRAINING'})}
                  className={cn("py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all", formData.type === 'TRAINING' ? "bg-white/10 text-white" : "text-white/40")}
                >Entraînement</button>
             </div>

             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5 text-left">
                      <label className="text-[8px] font-bold text-white/40 uppercase ml-2 tracking-widest">Date</label>
                      <input 
                        type="date" 
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        className="w-full h-12 bg-white/5 rounded-xl px-4 text-xs font-bold border border-white/5 focus:border-[#00FF66]/30 focus:outline-none transition-all uppercase text-white"
                      />
                   </div>
                   <div className="space-y-1.5 text-left">
                      <label className="text-[8px] font-bold text-white/40 uppercase ml-2 tracking-widest">Heure</label>
                      <input 
                        type="time" 
                        value={formData.time}
                        onChange={e => setFormData({...formData, time: e.target.value})}
                        className="w-full h-12 bg-white/5 rounded-xl px-4 text-xs font-bold border border-white/5 focus:border-[#00FF66]/30 focus:outline-none transition-all text-white"
                      />
                   </div>
                </div>

                <div className="space-y-1.5 text-left">
                   <label className="text-[8px] font-bold text-white/40 uppercase ml-2 tracking-widest">Lieu / Stade</label>
                   <input 
                    type="text" 
                    value={formData.venue}
                    onChange={e => setFormData({...formData, venue: e.target.value})}
                    placeholder="EX: STADE EL KANTAOUI"
                    className="w-full h-12 bg-white/5 rounded-xl px-4 text-xs font-bold border border-white/5 focus:border-[#00FF66]/30 focus:outline-none transition-all uppercase text-white placeholder:opacity-30"
                   />
                </div>

                {formData.type === 'MATCH' && (
                  <div className="space-y-1.5 text-left">
                    <label className="text-[8px] font-bold text-white/40 uppercase ml-2 tracking-widest">Adversaire</label>
                    <input 
                      type="text" 
                      value={formData.opponent}
                      onChange={e => setFormData({...formData, opponent: e.target.value})}
                      placeholder="EX: ÉTOILE VETERANS"
                      className="w-full h-12 bg-white/5 rounded-xl px-4 text-xs font-bold border border-white/5 focus:border-[#00FF66]/30 focus:outline-none transition-all uppercase text-white placeholder:opacity-30"
                    />
                  </div>
                )}

                <div className="space-y-1.5 text-left">
                   <label className="text-[8px] font-bold text-white/40 uppercase ml-2 tracking-widest">Notes de Match / Instructions</label>
                   <textarea 
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    placeholder="EX: TENUE NOIRE, ÉCHAUFFEMENT À 20:45"
                    className="w-full h-24 bg-white/5 rounded-xl p-4 text-xs font-bold border border-white/5 focus:border-[#00FF66]/30 focus:outline-none transition-all uppercase text-white placeholder:opacity-30 resize-none"
                   />
                </div>
             </div>

             <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="btn-ghost flex-1 h-14"
                >Annuler</button>
                <button 
                  type="submit"
                  className="btn-elite flex-1 h-14"
                >Publier Match</button>
             </div>
          </form>
       </motion.div>
    </motion.div>
  );
}
