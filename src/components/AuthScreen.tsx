import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  Smartphone,
  ChevronRight,
  Camera,
  Users,
  PlusCircle,
  Mail,
  Lock,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile, useSquadStore } from '../store/useSquadStore';
import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface AuthScreenProps {
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [formData, setFormData] = useState<Partial<UserProfile>>({
    firstName: '',
    lastName: '',
    birthDate: '',
    phoneNumber: '',
    role: 'PLAYER',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=FUT'
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists()) {
        onAuthSuccess(userDoc.data() as UserProfile);
      } else {
        setError(`Profile data missing. Please register.`);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError(`Email/Password login is disabled in the Firebase Console.`);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      const userProfile: UserProfile = {
        uid,
        email,
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        birthDate: formData.birthDate || '',
        phoneNumber: formData.phoneNumber || '',
        avatarUrl: formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        role: formData.role as 'PLAYER' | 'COACH',
        isOnboarded: true,
        matchCount: 0,
        avgRating: 0
      };

      await setDoc(doc(db, 'users', uid), userProfile);
      await updateProfile(userCredential.user, {
        displayName: `${userProfile.firstName} ${userProfile.lastName}`,
        photoURL: userProfile.avatarUrl
      });

      onAuthSuccess(userProfile);
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError(`Email/Password login is disabled in the Firebase Console.`);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute top-0 inset-x-0 h-screen bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10 space-y-8"
      >
        <div className="text-center space-y-3">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative inline-block mb-4"
          >
             <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full animate-pulse" />
             <div className="relative w-24 h-24 bg-surface-highest rounded-[2rem] border border-white/10 p-0.5 shadow-2xl flex items-center justify-center overflow-hidden group">
               <img src="/src/assets/images/jawhara_crest_1790419338393.jpg" className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700" alt="Logo" />
             </div>
          </motion.div>
          <h1 className="text-4xl font-headline text-white">VETERANS JAWHARA</h1>
          <p className="text-[10px] text-white/40 font-bold tracking-[0.5em] uppercase">Elite Tactical Hub</p>
        </div>

        <div className="grid grid-cols-2 p-1.5 glass-card rounded-[2.5rem]">
          <button 
            onClick={() => { setMode('login'); setStep(1); setError(null); }}
            className={cn(
              "flex items-center justify-center gap-2 py-4 rounded-[2rem] text-[10px] font-bold uppercase tracking-widest transition-all",
              mode === 'login' ? "bg-white/5 text-primary shadow-lg border border-white/10" : "text-white/40 hover:text-white"
            )}
          >
            <LogIn size={14} /> Login
          </button>
          <button 
            onClick={() => { setMode('signup'); setStep(1); setError(null); }}
            className={cn(
              "flex items-center justify-center gap-2 py-4 rounded-[2rem] text-[10px] font-bold uppercase tracking-widest transition-all",
              mode === 'signup' ? "bg-primary text-black shadow-elite" : "text-white/40 hover:text-white"
            )}
          >
            <UserPlus size={14} /> Register
          </button>
        </div>

        <div className="glass-card rounded-[3rem] p-8 shadow-3xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
           
           {error && (
             <motion.div 
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: 'auto' }}
               className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-wider text-center"
             >
               {error}
             </motion.div>
           )}

           <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-6">
              <AnimatePresence mode="wait">
                 {mode === 'signup' && step === 1 && (
                   <motion.div 
                    key="s1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                   >
                      <div className="space-y-6">
                         <div className="flex flex-col items-center gap-4 mb-2">
                            <div className="relative group cursor-pointer" onClick={() => {
                              const seed = Math.random().toString(36).substring(7);
                              setFormData({...formData, avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`});
                            }}>
                               <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-primary/30 bg-black/40 group-hover:border-primary transition-all duration-500 shadow-2xl">
                                  <img src={formData.avatarUrl} className="w-full h-full object-cover" alt="Profile" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <Camera size={28} className="text-white" />
                                  </div>
                               </div>
                               <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-black border-4 border-surface-raised shadow-lg">
                                  <PlusCircle size={18} />
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Tap to Randomize Avatar</span>
                         </div>

                         <div className="space-y-4">
                            <InputField 
                              label="Email Address" 
                              type="email"
                              placeholder="COACH@SQUAD7.PRO" 
                              value={email}
                              onChange={setEmail}
                            />
                            <InputField 
                              label="Password" 
                              type="password"
                              placeholder="••••••••" 
                              value={password}
                              onChange={setPassword}
                            />
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                            <InputField 
                              label="First Name" 
                              placeholder="YASSINE" 
                              value={formData.firstName}
                              onChange={(v: string) => setFormData({...formData, firstName: v})}
                            />
                            <InputField 
                              label="Last Name" 
                              placeholder="BEN AMOR" 
                              value={formData.lastName}
                              onChange={(v: string) => setFormData({...formData, lastName: v})}
                            />
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                            <InputField 
                              label="Birth Date" 
                              type="date"
                              value={formData.birthDate}
                              onChange={(v: string) => setFormData({...formData, birthDate: v})}
                            />
                            <InputField 
                              label="Phone" 
                              placeholder="+216 ..." 
                              type="tel"
                              value={formData.phoneNumber}
                              onChange={(v: string) => setFormData({...formData, phoneNumber: v})}
                            />
                         </div>
                      </div>

                      <button 
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={!formData.firstName || !formData.lastName || !email || password.length < 6}
                        className="btn-elite w-full group"
                      >
                        Tactical Setup <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                   </motion.div>
                 )}

                 {mode === 'signup' && step === 2 && (
                   <motion.div 
                    key="s2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                   >
                      <div className="space-y-6 text-center">
                         <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Select Your Squad Role</h3>
                         <div className="grid grid-cols-2 gap-4">
                            <RoleBtn 
                              active={formData.role === 'PLAYER'} 
                              onClick={() => setFormData({...formData, role: 'PLAYER'})}
                              icon={<Users size={28} />}
                              label="Player"
                              desc="Join match calls"
                            />
                            <RoleBtn 
                              active={formData.role === 'COACH'} 
                              onClick={() => setFormData({...formData, role: 'COACH'})}
                              icon={<ShieldCheck size={28} />}
                              label="Coach"
                              desc="Tactical Admin"
                            />
                         </div>
                      </div>

                      <div className="space-y-4">
                        <button 
                          type="submit"
                          disabled={loading}
                          className="btn-elite w-full h-16 text-xl"
                        >
                          {loading ? 'Processing...' : 'Deploy Profile'}
                          {!loading && <ArrowRight size={24} />}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setStep(1)}
                          className="w-full py-2 text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white transition-colors"
                        >
                          Back to Profile
                        </button>
                      </div>
                   </motion.div>
                 )}

                 {mode === 'login' && (
                   <motion.div 
                    key="login"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-8"
                   >
                      <div className="space-y-4">
                        <InputField 
                          label="SQUAD ACCESS EMAIL" 
                          placeholder="DEMO@SQUAD7.PRO" 
                          type="email" 
                          value={email}
                          onChange={setEmail}
                        />
                        <InputField 
                          label="PASSWORD" 
                          placeholder="••••••••" 
                          type="password" 
                          value={password}
                          onChange={setPassword}
                        />
                      </div>
                      
                      <button 
                        type="submit"
                        disabled={loading}
                        className="btn-elite w-full h-16 text-xl"
                      >
                        {loading ? 'Authorizing...' : 'Authorize Access'}
                      </button>

                      <div className="flex flex-col items-center gap-6 pt-2 opacity-40">
                         <div className="flex items-center gap-4 w-full">
                            <div className="h-px flex-1 bg-white/20" />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Secured Access</span>
                            <div className="h-px flex-1 bg-white/20" />
                         </div>
                      </div>
                   </motion.div>
                 )}
              </AnimatePresence>
           </form>
        </div>

        <p className="text-center text-[9px] text-white/30 uppercase tracking-[0.2em]">
           By joining you agree to Tactical Standards & Squad Code of Conduct
        </p>
      </motion.div>
    </div>
  );
};

function InputField({ label, value, onChange, placeholder, type = 'text' }: any) {
  return (
    <div className="space-y-2">
       <label className="text-[9px] font-bold text-white/40 uppercase ml-2 tracking-[0.2em]">{label}</label>
       <div className="relative">
          <input 
            type={type} 
            value={value}
            onChange={e => onChange?.(e.target.value)}
            placeholder={placeholder}
            className="w-full h-14 bg-white/5 rounded-2xl px-5 text-xs font-bold border border-white/5 focus:border-primary/30 focus:outline-none transition-all uppercase placeholder:opacity-20 text-white"
          />
       </div>
    </div>
  );
}

function RoleBtn({ active, onClick, icon, label, desc }: any) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-4 p-8 rounded-[2.5rem] border transition-all relative overflow-hidden group",
        active ? "bg-primary/10 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40 hover:border-white/10"
      )}
    >
      <div className={cn(
        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
        active ? "bg-primary text-black scale-110 shadow-elite" : "bg-white/5 text-white/40 group-hover:scale-105"
      )}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-black uppercase tracking-widest">{label}</span>
        <span className="text-[8px] font-bold opacity-50 uppercase mt-0.5">{desc}</span>
      </div>
      {active && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#00FF66]" />
      )}
    </button>
  );
}
