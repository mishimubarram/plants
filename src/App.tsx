/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Leaf, 
  Camera, 
  MessageSquare, 
  User as UserIcon, 
  History, 
  Search, 
  Plus, 
  Droplets, 
  Sun, 
  Thermometer, 
  Sprout,
  Settings,
  LogOut,
  MapPin,
  ChevronRight,
  X,
  Send,
  Loader2,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  BookOpen,
  Users,
  Bell,
  Heart,
  Share2,
  Sparkles,
  Info,
  ArrowLeft,
  RefreshCw,
  AlarmClock
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { signIn, signInAsGuest, logOut, db, collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, handleFirestoreError, OperationType, orderBy, limit } from './firebase';
import { identifyPlant, diagnosePlant, getPlantAssistantResponse, getLocalPlantsKnowledge, getSeasonalTips, getPlantHealthAdvice, getPlantCareGuide } from './services/geminiService';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import './i18n';

type Page = 'home' | 'identify' | 'garden' | 'chat' | 'profile' | 'diagnose' | 'guides' | 'community' | 'health';

export default function App() {
  const { t, i18n } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();
  const [activePage, setActivePage] = useState<Page>('home');
  const [history, setHistory] = useState<Page[]>(['home']);
  const [plants, setPlants] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [localKnowledge, setLocalKnowledge] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<any>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const lastTriggeredMinute = useRef<string>('');

  const handleSignIn = async () => {
    setLoginError(null);
    try {
      await signIn();
    } catch (err: any) {
      console.error("Sign in failed:", err);
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        setLoginError("This local IP address (or domain) is not authorized in your Firebase Console. Under 'Authentication > Settings > Authorized domains', add this IP/domain to whitelist it, or simply use the Guest Mode below!");
      } else {
        setLoginError(err?.message || "Failed to sign in. Please try again.");
      }
    }
  };

  const handleGuestSignIn = async () => {
    setLoginError(null);
    try {
      await signInAsGuest();
    } catch (err: any) {
      setLoginError(err?.message || "Failed to sign in as guest.");
    }
  };

  useEffect(() => {
    if (user) {
      const path = `users/${user.uid}/plants`;
      const q = query(collection(db, path));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPlants(p);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  }, []);

  useEffect(() => {
    if (location && localKnowledge.length === 0) {
      getLocalPlantsKnowledge(location.lat, location.lng).then(setLocalKnowledge);
    }
  }, [location]);

  useEffect(() => {
    if (profile?.preferences?.language) {
      i18n.changeLanguage(profile.preferences.language);
    }
  }, [profile]);

  useEffect(() => {
    if (!user || plants.length === 0) return;

    const unsubscribes = plants.map(plant => {
      const path = `users/${user.uid}/plants/${plant.id}/reminders`;
      return onSnapshot(collection(db, path), (snapshot) => {
        const r = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          plantId: plant.id, 
          plantName: plant.name, 
          userId: user.uid,
          ...doc.data() 
        }));
        setReminders(prev => {
          const otherReminders = prev.filter(rem => rem.plantId !== plant.id);
          return [...otherReminders, ...r];
        });
      }, (error) => {
        console.error(`Error listening to reminders at ${path}:`, error);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, plants]);

  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime === lastTriggeredMinute.current) return;

      console.log(`Checking alarms at ${currentTime}... Total reminders: ${reminders.length}`);

      reminders.forEach(rem => {
        // Clean the stored time in case it has different format
        const remTime = rem.time?.trim();
        if (rem.enabled && remTime === currentTime) {
          console.log(`ALARM TRIGGERED for ${rem.plantName} at ${currentTime}`);
          setActiveAlarm(rem);
          lastTriggeredMinute.current = currentTime;
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAlarms();
      }
    };

    // Check immediately
    checkAlarms();

    const interval = setInterval(checkAlarms, 10000); // Check every 10 seconds
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reminders]);

  const navigateTo = (page: Page) => {
    if (page !== activePage) {
      setHistory(prev => [...prev, page]);
      setActivePage(page);
    }
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const prevPage = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setActivePage(prevPage);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-main">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg-main font-serif text-text-main md:flex-row" dir={i18n.language === 'ur' ? 'rtl' : 'ltr'}>
      {/* Sidebar for Desktop */}
      <nav className="hidden w-64 flex-col border-r border-primary/10 bg-white p-6 md:flex">
        <div className="mb-10 flex items-center gap-2 text-primary">
          <Leaf className="h-8 w-8" />
          <h1 className="text-2xl font-bold tracking-tight">Botanic AI</h1>
        </div>
        
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-2">
          <NavButton active={activePage === 'home'} onClick={() => navigateTo('home')} icon={<Sprout />} label={t('home')} />
          <NavButton active={activePage === 'identify'} onClick={() => navigateTo('identify')} icon={<Camera />} label={t('identify')} />
          <NavButton active={activePage === 'diagnose'} onClick={() => navigateTo('diagnose')} icon={<AlertTriangle />} label={t('diagnose')} />
          <NavButton active={activePage === 'health'} onClick={() => navigateTo('health')} icon={<Sparkles />} label={t('healthAdvice')} />
          <NavButton active={activePage === 'garden'} onClick={() => navigateTo('garden')} icon={<Leaf />} label={t('myPlants')} />
          <NavButton active={activePage === 'guides'} onClick={() => navigateTo('guides')} icon={<BookOpen />} label={t('careGuides')} />
          <NavButton active={activePage === 'community'} onClick={() => navigateTo('community')} icon={<Users />} label={t('community')} />
          <NavButton active={activePage === 'chat'} onClick={() => navigateTo('chat')} icon={<MessageSquare />} label={t('chat')} />
          <NavButton active={activePage === 'profile'} onClick={() => navigateTo('profile')} icon={<UserIcon />} label={t('profile')} />
        </div>

        {user && (
          <button 
            onClick={logOut}
            className="mt-auto flex items-center gap-3 rounded-xl p-3 text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">{t('logout')}</span>
          </button>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="relative flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
        {activePage !== 'home' && (
          <button 
            onClick={goBack}
            className="mb-6 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-primary shadow-sm border border-primary/5 transition-transform hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-bold">{t('back')}</span>
          </button>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-4xl"
          >
            {!user && activePage !== 'profile' ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center max-w-xl mx-auto bg-white/60 backdrop-blur-md rounded-3xl border border-primary/10 shadow-xl">
                <Leaf className="mb-6 h-16 w-16 text-primary" />
                <h2 className="mb-4 text-3xl font-bold text-primary">{t('welcome')}</h2>
                <p className="mb-8 text-primary/70">
                  {t('identifyPrompt')}
                </p>
                
                {loginError && (
                  <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-150 text-left text-sm text-red-700">
                    <p className="font-semibold mb-1">Sign-in Notice:</p>
                    <p className="leading-relaxed">{loginError}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row w-full gap-4 justify-center">
                  <button 
                    onClick={handleSignIn}
                    className="flex items-center justify-center gap-3 rounded-full bg-primary px-8 py-4 text-white transition-transform hover:scale-105 shadow-lg font-medium cursor-pointer"
                  >
                    <UserIcon className="h-5 w-5" />
                    <span>{t('login')}</span>
                  </button>

                  <button 
                    onClick={handleGuestSignIn}
                    className="flex items-center justify-center gap-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-8 py-4 transition-transform hover:scale-105 font-medium cursor-pointer border border-slate-200 shadow-sm"
                  >
                    <UserIcon className="h-5 w-5 text-slate-500" />
                    <span>Continue as Guest</span>
                  </button>
                </div>

                <div className="mt-8 text-xs text-primary/50 text-center space-y-1">
                  <p>🔒 Runs securely on Firebase Authentication</p>
                  <p>💡 Tip: For network IPs like <code className="bg-primary/5 px-1 rounded font-mono">192.168.1.27</code>, use Guest Mode to bypass domain validation.</p>
                </div>
              </div>
            ) : (
              <>
                {activePage === 'home' && (
                  <HomePage 
                    plants={plants} 
                    localKnowledge={localKnowledge} 
                    onNavigate={navigateTo} 
                    location={location} 
                    onSetReminder={setShowReminderModal}
                    onShowNotifications={setShowNotifications}
                  />
                )}
                {activePage === 'identify' && <IdentifyPage user={user} onPlantAdded={() => navigateTo('garden')} />}
                {activePage === 'diagnose' && <DiagnosePage />}
                {activePage === 'health' && <HealthAdvicePage />}
                {activePage === 'garden' && <GardenPage plants={plants} searchQuery={searchQuery} setSearchQuery={setSearchQuery} user={user} onSetReminder={setShowReminderModal} />}
                {activePage === 'guides' && <GuidesPage />}
                {activePage === 'community' && <CommunityPage user={user} />}
                {activePage === 'chat' && <ChatPage user={user} />}
                {activePage === 'profile' && <ProfilePage user={user} profile={profile} onNavigate={navigateTo} loginError={loginError} handleSignIn={handleSignIn} handleGuestSignIn={handleGuestSignIn} />}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showNotifications && (
          <NotificationModal 
            needsWater={plants.filter(p => {
              if (!p.lastWatered || !p.wateringFrequencyDays) return false;
              const last = new Date(p.lastWatered).getTime();
              const diff = (Date.now() - last) / (1000 * 60 * 60 * 24);
              return diff >= p.wateringFrequencyDays;
            })} 
            upcomingTasks={plants.flatMap(p => (p.tasks || []).map((t: any) => ({ ...t, plantName: p.name, plantId: p.id, userId: p.userId }))).filter(task => {
              if (!task.lastCompleted || !task.frequencyDays) return true;
              const last = new Date(task.lastCompleted).getTime();
              const diff = (Date.now() - last) / (1000 * 60 * 60 * 24);
              return diff >= task.frequencyDays;
            })} 
            onClose={() => setShowNotifications(false)} 
          />
        )}
        {showReminderModal && (
          <ReminderModal 
            plant={showReminderModal} 
            onClose={() => setShowReminderModal(null)} 
            onTestAlarm={(alarm) => setActiveAlarm(alarm)}
          />
        )}
        {activeAlarm && (
          <AlarmOverlay 
            alarm={activeAlarm} 
            onClose={() => setActiveAlarm(null)} 
          />
        )}
      </AnimatePresence>

      {/* Bottom Nav for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-[#5A5A40]/10 bg-white p-3 md:hidden z-50">
        <MobileNavButton active={activePage === 'home'} onClick={() => navigateTo('home')} icon={<Sprout />} />
        <MobileNavButton active={activePage === 'identify'} onClick={() => navigateTo('identify')} icon={<Camera />} />
        <MobileNavButton active={activePage === 'health'} onClick={() => navigateTo('health')} icon={<Sparkles />} />
        <MobileNavButton active={activePage === 'garden'} onClick={() => navigateTo('garden')} icon={<Leaf />} />
        <MobileNavButton active={activePage === 'community'} onClick={() => navigateTo('community')} icon={<Users />} />
        <MobileNavButton active={activePage === 'chat'} onClick={() => navigateTo('chat')} icon={<MessageSquare />} />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl p-3 transition-all",
        active ? "nav-active" : "nav-inactive"
      )}
    >
      <span className={cn("h-5 w-5", active ? "text-white" : "text-primary")}>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function MobileNavButton({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full p-3 transition-all",
        active ? "nav-active" : "nav-inactive"
      )}
    >
      <span className={cn("h-6 w-6", active ? "text-white" : "text-primary")}>{icon}</span>
    </button>
  );
}

// --- Page Components ---

function HomePage({ plants, localKnowledge, onNavigate, location, onSetReminder, onShowNotifications }: { plants: any[]; localKnowledge: any[]; onNavigate: (p: Page) => void; location: any; onSetReminder: (p: any) => void; onShowNotifications: (b: boolean) => void }) {
  const { t } = useTranslation();
  const [seasonalTips, setSeasonalTipsData] = useState<any[]>([]);
  const [plantOfTheDay, setPlantOfTheDay] = useState<any>(null);
  
  useEffect(() => {
    if (location) {
      getSeasonalTips(location.lat, location.lng, new Date().toISOString()).then(setSeasonalTipsData);
    }
    // Random plant of the day
    const plantsList = [
      { name: 'Monstera', scientific: 'Monstera deliciosa', tip: 'Keep in bright indirect light.', img: 'https://picsum.photos/seed/monstera/400/300' },
      { name: 'Snake Plant', scientific: 'Sansevieria trifasciata', tip: 'Thrives on neglect. Water sparingly.', img: 'https://picsum.photos/seed/snake/400/300' },
      { name: 'Peace Lily', scientific: 'Spathiphyllum', tip: 'Will droop when thirsty. Keep soil moist.', img: 'https://picsum.photos/seed/peace/400/300' }
    ];
    setPlantOfTheDay(plantsList[Math.floor(Math.random() * plantsList.length)]);
  }, [location]);

  const needsWater = plants.filter(p => {
    if (!p.lastWatered || !p.wateringFrequencyDays) return false;
    const last = new Date(p.lastWatered).getTime();
    const diff = (Date.now() - last) / (1000 * 60 * 60 * 24);
    return diff >= p.wateringFrequencyDays;
  });

  const upcomingTasks = plants.flatMap(p => (p.tasks || []).map((t: any) => ({ ...t, plantName: p.name, plantId: p.id, userId: p.userId }))).filter(task => {
    if (!task.lastCompleted || !task.frequencyDays) return true;
    const last = new Date(task.lastCompleted).getTime();
    const diff = (Date.now() - last) / (1000 * 60 * 60 * 24);
    return diff >= task.frequencyDays;
  });

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold text-primary">{t('welcome')}</h2>
          <p className="text-primary/90 font-medium">Your personal botanical garden is thriving.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onShowNotifications(true)}
            className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm border border-primary/5 transition-transform hover:scale-105"
          >
            <Bell className="h-6 w-6 text-primary" />
            {(needsWater.length + upcomingTasks.length) > 0 && (
              <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {needsWater.length + upcomingTasks.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {(needsWater.length > 0 || upcomingTasks.length > 0) ? (
            <section className="rounded-[32px] bg-white p-8 shadow-sm border border-primary/5">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-accent" />
                  <h3 className="text-2xl font-bold text-primary">Priority Tasks</h3>
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary/60">Due Today</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {needsWater.map(p => (
                  <div key={`water-${p.id}`} className="flex items-center gap-4 rounded-2xl bg-bg-main/50 p-4 border border-primary/5">
                    <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-white shadow-sm">
                      <img src={p.imageUrl || 'https://picsum.photos/seed/plant/100/100'} alt={p.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-text-main">{p.name}</h4>
                      <p className="text-[10px] uppercase font-bold text-blue-500">{t('watering')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => onSetReminder({ plantId: p.id, plantName: p.name, userId: p.userId })}
                        className="rounded-full bg-primary/10 p-2 text-primary shadow-sm transition-transform hover:scale-110"
                      >
                        <AlarmClock className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          const path = `users/${p.userId}/plants/${p.id}`;
                          try {
                            await updateDoc(doc(db, 'users', p.userId, 'plants', p.id), { lastWatered: new Date().toISOString() });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.UPDATE, path);
                          }
                        }}
                        className="rounded-full bg-blue-500 p-2 text-white shadow-sm transition-transform hover:scale-110"
                      >
                        <Droplets className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {upcomingTasks.map(task => (
                  <div key={`task-${task.id}`} className="flex items-center gap-4 rounded-2xl bg-bg-main/50 p-4 border border-primary/5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-green-600 shadow-sm">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-text-main">{task.plantName}</h4>
                      <p className="text-[10px] uppercase font-bold text-green-500">{t(task.type)}</p>
                    </div>
                    <button 
                      onClick={async () => {
                        const path = `users/${task.userId}/plants/${task.plantId}`;
                        try {
                          const plantRef = doc(db, 'users', task.userId, 'plants', task.plantId);
                          const plantDoc = await getDoc(plantRef);
                          if (plantDoc.exists()) {
                            const updatedTasks = plantDoc.data().tasks.map((t: any) => t.id === task.id ? { ...t, lastCompleted: new Date().toISOString() } : t);
                            await updateDoc(plantRef, { tasks: updatedTasks });
                          }
                        } catch (error) {
                          handleFirestoreError(error, OperationType.UPDATE, path);
                        }
                      }}
                      className="rounded-full bg-green-500 p-2 text-white shadow-sm transition-transform hover:scale-110"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-[32px] bg-white p-12 text-center shadow-sm border border-primary/5">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-500">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-primary">All caught up!</h3>
              <p className="text-primary/60">Your plants are happy and well-cared for.</p>
            </section>
          )}

          <div className="grid gap-6 sm:grid-cols-3">
            <button 
              onClick={() => onNavigate('identify')}
              className="group relative h-48 overflow-hidden rounded-[32px] bg-primary p-8 text-left text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <Camera className="mb-4 h-10 w-10 text-white/50" />
              <h3 className="text-2xl font-bold">{t('identify')}</h3>
              <p className="text-sm text-white/70">Snap a photo to learn more.</p>
              <ChevronRight className="absolute bottom-8 right-8 h-6 w-6 transition-transform group-hover:translate-x-2" />
            </button>

            <button 
              onClick={() => onNavigate('diagnose')}
              className="group relative h-48 overflow-hidden rounded-[32px] bg-accent p-8 text-left text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <AlertTriangle className="mb-4 h-10 w-10 text-white/50" />
              <h3 className="text-2xl font-bold">{t('diagnose')}</h3>
              <p className="text-sm text-white/70">Troubleshoot plant issues.</p>
              <ChevronRight className="absolute bottom-8 right-8 h-6 w-6 transition-transform group-hover:translate-x-2" />
            </button>

            <button 
              onClick={() => onNavigate('health')}
              className="group relative h-48 overflow-hidden rounded-[32px] bg-blue-600 p-8 text-left text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <Sparkles className="mb-4 h-10 w-10 text-white/50" />
              <h3 className="text-2xl font-bold">Health Advice</h3>
              <p className="text-sm text-white/70">Optimize plant health.</p>
              <ChevronRight className="absolute bottom-8 right-8 h-6 w-6 transition-transform group-hover:translate-x-2" />
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {plantOfTheDay && (
            <section className="card group">
              <div className="relative h-48 overflow-hidden">
                <img src={plantOfTheDay.img} alt={plantOfTheDay.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                <div className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary shadow-sm">
                  Plant of the Day
                </div>
              </div>
              <div className="p-6">
                <h4 className="text-xl font-bold text-text-main">{plantOfTheDay.name}</h4>
                <p className="mb-4 text-xs italic text-primary/60">{plantOfTheDay.scientific}</p>
                <div className="rounded-xl bg-bg-main/50 p-4 text-sm text-primary/80 italic">
                  "{plantOfTheDay.tip}"
                </div>
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-bold text-primary">{t('seasonalTips')}</h3>
            </div>
            <div className="space-y-4">
              {seasonalTips.map((tip, i) => (
                <div key={i} className="rounded-2xl bg-white p-5 shadow-sm border border-primary/5 transition-transform hover:translate-x-1">
                  <span className="text-[10px] uppercase font-bold text-primary/30">{t(tip.category)}</span>
                  <h4 className="mb-1 font-bold text-primary">{tip.title}</h4>
                  <p className="text-xs text-primary/70">{tip.advice}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function NotificationModal({ needsWater, upcomingTasks, onClose }: { needsWater: any[]; upcomingTasks: any[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-primary">Notifications</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-bg-main">
            <X className="h-5 w-5 text-primary/40" />
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
          {needsWater.length === 0 && upcomingTasks.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto mb-4 h-10 w-10 text-primary/10" />
              <p className="text-primary/40">No new notifications</p>
            </div>
          ) : (
            <>
              {needsWater.map(p => (
                <div key={`notif-water-${p.id}`} className="flex items-start gap-4 rounded-2xl bg-blue-50 p-4 border border-blue-100">
                  <Droplets className="h-5 w-5 text-blue-500 mt-1" />
                  <div>
                    <h4 className="font-bold text-blue-900">{p.name} needs water!</h4>
                    <p className="text-sm text-blue-700">It's been {Math.floor((Date.now() - new Date(p.lastWatered).getTime()) / (1000 * 60 * 60 * 24))} days since last watering.</p>
                  </div>
                </div>
              ))}
              {upcomingTasks.map(task => (
                <div key={`notif-task-${task.id}`} className="flex items-start gap-4 rounded-2xl bg-green-50 p-4 border border-green-100">
                  <Calendar className="h-5 w-5 text-green-500 mt-1" />
                  <div>
                    <h4 className="font-bold text-green-900">{task.type} for {task.plantName}</h4>
                    <p className="text-sm text-green-700">Time to take care of your plant!</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ReminderModal({ plant, onClose, onTestAlarm }: { plant: any; onClose: () => void; onTestAlarm: (alarm: any) => void }) {
  const { user } = useAuth();
  const [time, setTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  const handleSetReminder = async () => {
    if (!user) return;
    setLoading(true);
    const targetUserId = plant.userId || user.uid;
    const path = `users/${targetUserId}/plants/${plant.plantId}/reminders`;
    try {
      await addDoc(collection(db, 'users', targetUserId, 'plants', plant.plantId, 'reminders'), {
        type: 'watering',
        time,
        enabled: true,
        plantName: plant.plantName || plant.name || 'My Plant', // Safe fallback
        userId: targetUserId,
        plantId: plant.plantId,
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-8 shadow-2xl"
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <AlarmClock className="h-8 w-8" />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-primary">Set Reminder</h3>
          <p className="mb-6 text-primary/60">When should we remind you to water {plant.plantName}?</p>
          
          <input 
            type="time" 
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mb-8 w-full rounded-2xl border border-primary/10 bg-bg-main p-4 text-center text-3xl font-bold text-primary outline-none focus:border-primary"
          />

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleSetReminder}
              disabled={loading}
              className="w-full rounded-full bg-primary py-4 font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? 'Setting...' : 'Set Alarm'}
            </button>
            <button 
              onClick={() => {
                onTestAlarm({ plantName: plant.plantName, plantId: plant.plantId, userId: plant.userId });
                onClose();
              }}
              className="w-full rounded-full bg-primary/10 py-4 font-bold text-primary hover:bg-primary/20"
            >
              Test Alarm Now
            </button>
            <button 
              onClick={onClose}
              className="w-full rounded-full border border-primary/20 py-4 font-bold text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AlarmOverlay({ alarm, onClose }: { alarm: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-primary/90 backdrop-blur-md"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative flex flex-col items-center text-center text-white"
      >
        <motion.div 
          animate={{ 
            rotate: [0, -10, 10, -10, 10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className="mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-white/20"
        >
          <AlarmClock className="h-16 w-16" />
        </motion.div>
        
        <h2 className="mb-2 text-4xl font-bold">Time to Water!</h2>
        <p className="mb-12 text-xl opacity-80">Your {alarm.plantName} is thirsty.</p>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button 
            onClick={async () => {
              await updateDoc(doc(db, 'users', alarm.userId, 'plants', alarm.plantId), { lastWatered: new Date().toISOString() });
              onClose();
            }}
            className="w-full rounded-full bg-white py-4 font-bold text-primary shadow-2xl transition-transform hover:scale-105"
          >
            I Watered It!
          </button>
          <button 
            onClick={onClose}
            className="w-full rounded-full border border-white/20 py-4 font-bold text-white hover:bg-white/10"
          >
            Snooze
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DiagnosePage() {
  const { t } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDiagnose = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const base64 = image.split(',')[1];
      const data = await diagnosePlant(base64);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to diagnose plant");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setImage(null);
    setError(null);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-primary">{t('diagnose')}</h2>
      
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-left text-sm text-red-700 max-w-xl mx-auto shadow-sm">
          <p className="font-semibold mb-1">Diagnosis Error:</p>
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {!result ? (
        <div className="flex flex-col items-center">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-80 w-full max-w-md cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-accent/20 bg-white transition-all hover:border-accent hover:bg-accent/5"
          >
            {image ? (
              <img src={image} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <>
                <Camera className="mb-4 h-12 w-12 text-accent/50 group-hover:text-accent" />
                <p className="text-center text-accent/90 font-medium">Upload a photo of the affected area</p>
              </>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>

          {image && !loading && (
            <button 
              onClick={handleDiagnose}
              className="mt-6 rounded-full bg-accent px-10 py-4 font-bold text-white shadow-lg transition-transform hover:scale-105"
            >
              {t('diagnose')}
            </button>
          )}

          {loading && (
            <div className="mt-6 flex items-center gap-2 text-accent">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="font-bold">{t('identifying')}</span>
            </div>
          )}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl bg-white shadow-xl border border-primary/5"
        >
          <div className="p-8">
            <h3 className="mb-2 text-3xl font-bold text-accent">{result.diagnosis}</h3>
            
            <div className="mb-6">
              <h4 className="text-sm font-bold uppercase tracking-wider text-primary/80 mb-2">{t('symptoms')}</h4>
              <ul className="list-inside list-disc space-y-1 text-text-main">
                {result.symptoms.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-green-50 p-6 border border-green-100">
                <h4 className="mb-2 font-bold text-green-800">{t('organic')}</h4>
                <p className="text-sm text-green-700 leading-relaxed">{result.organicTreatment}</p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-6 border border-blue-100">
                <h4 className="mb-2 font-bold text-blue-800">{t('chemical')}</h4>
                <p className="text-sm text-blue-700 leading-relaxed">{result.chemicalTreatment}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-bg-main/50 p-6 border border-primary/5">
              <h4 className="mb-2 font-bold text-primary">{t('prevention')}</h4>
              <p className="text-sm text-primary/80 leading-relaxed">{result.prevention}</p>
            </div>

            <button 
              onClick={reset}
              className="mt-8 w-full rounded-full border border-primary/20 py-4 font-bold text-primary transition-colors hover:bg-primary/5"
            >
              Try Another Photo
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function IdentifyPage({ user, onPlantAdded }: { user: any; onPlantAdded: () => void }) {
  const { t } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdentify = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const base64 = image.split(',')[1];
      const data = await identifyPlant(base64);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to identify plant");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToGarden = async () => {
    if (!user || !result || loading) return;
    setLoading(true);
    const path = `users/${user.uid}/plants`;
    try {
      await addDoc(collection(db, path), {
        ...result,
        userId: user.uid,
        imageUrl: image,
        lastWatered: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isCustom: false,
        notes: '',
        tasks: [
          { id: 'water', type: 'watering', frequencyDays: result.wateringFrequencyDays, lastCompleted: new Date().toISOString() }
        ]
      });
      onPlantAdded();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-primary">{t('identify')}</h2>
      
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-left text-sm text-red-700 max-w-xl mx-auto shadow-sm">
          <p className="font-semibold mb-1">Identification Error:</p>
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {!result ? (
        <div className="flex flex-col items-center">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-80 w-full max-w-md cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-primary/30 bg-white transition-all hover:border-primary hover:bg-primary/5"
          >
            {image ? (
              <img src={image} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <>
                <Camera className="mb-4 h-12 w-12 text-primary/60 group-hover:text-primary" />
                <p className="text-center text-primary/90 font-medium">{t('identifyPrompt')}</p>
              </>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>

          {image && !loading && (
            <button 
              onClick={handleIdentify}
              className="mt-6 rounded-full bg-primary px-10 py-4 font-bold text-white shadow-lg transition-transform hover:scale-105"
            >
              {t('identify')}
            </button>
          )}

          {loading && (
            <div className="mt-6 flex items-center gap-2 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="font-bold">{t('identifying')}</span>
            </div>
          )}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl bg-white shadow-xl border border-primary/5"
        >
          <div className="h-64 w-full overflow-hidden">
            <img src={image!} alt={result.name} className="h-full w-full object-cover" />
          </div>
          <div className="p-8">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-3xl font-bold text-text-main">{result.name}</h3>
                <p className="italic text-primary/90 font-medium">{result.scientificName}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-blue-600">
                <Droplets className="h-4 w-4" />
                <span className="text-sm font-bold">{result.wateringFrequencyDays} days</span>
              </div>
            </div>

            <p className="mb-8 text-primary/80 leading-relaxed">{result.description}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <CareItem icon={<Droplets />} label={t('watering')} value={result.careInstructions.watering} />
              <CareItem icon={<Sun />} label={t('sunlight')} value={result.careInstructions.sunlight} />
              <CareItem icon={<Thermometer />} label={t('temperature')} value={result.careInstructions.temperature} />
              <CareItem icon={<Sprout />} label={t('soil')} value={result.careInstructions.soil} />
            </div>

            <div className="mt-10 flex gap-4">
              <button 
                onClick={handleAddToGarden}
                className="flex-1 rounded-full bg-primary py-4 font-bold text-white shadow-lg transition-transform hover:scale-[1.02]"
              >
                Add to My Garden
              </button>
              <button 
                onClick={() => {
                  setResult(null);
                  setImage(null);
                }}
                className="rounded-full border border-primary/20 px-8 py-4 font-bold text-primary transition-colors hover:bg-primary/5"
              >
                Identify Another
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function CareItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-bg-main/50 p-4 border border-primary/10">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary/80">{label}</p>
        <p className="text-sm font-medium text-text-main">{value}</p>
      </div>
    </div>
  );
}

function GardenPage({ plants, searchQuery, setSearchQuery, user, onSetReminder }: { plants: any[]; searchQuery: string; setSearchQuery: (s: string) => void; user: any; onSetReminder: (p: any) => void }) {
  const { t } = useTranslation();
  const [selectedPlant, setSelectedPlant] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPlants = plants.filter(p => 
    (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (p.scientificName?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (plantId: string) => {
    if (!user) return;
    const path = `users/${user.uid}/plants/${plantId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'plants', plantId));
      setSelectedPlant(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold text-primary">{t('myPlants')}</h2>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/50" />
          <input 
            type="text" 
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-primary/10 bg-white py-2 pl-10 pr-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/5"
          />
        </div>
      </div>

      {filteredPlants.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlants.map(p => (
            <motion.div 
              key={p.id}
              layoutId={p.id}
              onClick={() => setSelectedPlant(p)}
              className="group cursor-pointer overflow-hidden rounded-3xl bg-white shadow-sm transition-all hover:shadow-xl border border-primary/5"
            >
              <div className="relative h-48 overflow-hidden">
                <img src={p.imageUrl || 'https://picsum.photos/seed/plant/400/300'} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-primary backdrop-blur-sm">
                  {p.wateringFrequencyDays}d
                </div>
              </div>
              <div className="p-5">
                <h4 className="text-xl font-bold text-text-main">{p.name}</h4>
                <p className="text-sm italic text-primary/80 font-medium">{p.scientificName}</p>
                <div className="mt-4 flex items-center justify-between text-xs font-bold text-primary">
                  <div className="flex items-center gap-1">
                    <History className="h-3 w-3" />
                    <span>{new Date(p.lastWatered).toLocaleDateString()}</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </motion.div>
          ))}
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/20 bg-white/50 text-primary/50 transition-colors hover:border-primary hover:bg-white"
          >
            <Plus className="mb-2 h-10 w-10" />
            <span className="font-bold">{t('addPlant')}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-64 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/20 text-primary/50">
            <Leaf className="mb-4 h-12 w-12 opacity-20" />
            <p>{t('noPlants')}</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-full bg-primary px-8 py-4 font-bold text-white shadow-lg transition-transform hover:scale-105"
          >
            <Plus className="h-5 w-5" />
            {t('addPlant')}
          </button>
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="max-h-[80vh] overflow-y-auto pr-2">
                <h3 className="mb-6 text-2xl font-bold">{t('addPlant')}</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const path = `users/${user.uid}/plants`;
                  try {
                    await addDoc(collection(db, path), {
                      name: formData.get('name'),
                      scientificName: formData.get('scientificName'),
                      description: formData.get('description'),
                      wateringFrequencyDays: Number(formData.get('frequency')),
                      imageUrl: customImage,
                      careInstructions: {
                        watering: formData.get('watering') || 'Custom care',
                        sunlight: formData.get('sunlight') || 'Custom care',
                        temperature: formData.get('temperature') || 'Custom care',
                        soil: formData.get('soil') || 'Custom care'
                      },
                      userId: user.uid,
                      lastWatered: new Date().toISOString(),
                      createdAt: new Date().toISOString(),
                      isCustom: true,
                      notes: ''
                    });
                    setShowAddModal(false);
                    setCustomImage(null);
                  } catch (error) {
                    handleFirestoreError(error, OperationType.CREATE, path);
                  }
                }} className="space-y-4">
                  <div className="flex flex-col items-center gap-4 mb-6">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative h-32 w-32 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-primary/20 bg-bg-main transition-all hover:border-primary hover:bg-primary/5"
                    >
                      {customImage ? (
                        <img src={customImage} alt="Custom" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-primary/30 group-hover:text-primary">
                          <Camera className="h-8 w-8" />
                          <span className="text-[10px] font-bold uppercase mt-1">Add Photo</span>
                        </div>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase text-primary/80 mb-1">Name</label>
                      <input name="name" required className="w-full rounded-xl border border-primary/10 bg-bg-main p-3 outline-none focus:border-primary text-text-main" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-primary/80 mb-1">Scientific Name</label>
                      <input name="scientificName" className="w-full rounded-xl border border-primary/10 bg-bg-main p-3 outline-none focus:border-primary text-text-main" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-primary/80 mb-1">Watering Frequency (Days)</label>
                    <input name="frequency" type="number" defaultValue={7} required className="w-full rounded-xl border border-primary/10 bg-bg-main p-3 outline-none focus:border-primary text-text-main" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase text-primary/80 mb-1">Watering Guide</label>
                      <input name="watering" placeholder="e.g. Keep soil moist" className="w-full rounded-xl border border-primary/10 bg-bg-main p-3 outline-none focus:border-primary text-text-main" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-primary/80 mb-1">Sunlight Guide</label>
                      <input name="sunlight" placeholder="e.g. Bright indirect" className="w-full rounded-xl border border-primary/10 bg-bg-main p-3 outline-none focus:border-primary text-text-main" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-primary/80 mb-1">Description</label>
                    <textarea name="description" className="w-full rounded-xl border border-primary/10 bg-bg-main p-3 outline-none focus:border-primary text-text-main" rows={2} />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button type="submit" className="flex-1 rounded-full bg-primary py-3 font-bold text-white shadow-lg transition-transform hover:scale-[1.02]">
                      {t('save')}
                    </button>
                    <button type="button" onClick={() => setShowAddModal(false)} className="rounded-full border border-primary/20 px-6 py-3 font-bold text-primary">
                      {t('cancel')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPlant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlant(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              layoutId={selectedPlant.id}
              className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <button 
                onClick={() => setSelectedPlant(null)}
                className="absolute right-4 top-4 z-10 rounded-full bg-black/20 p-2 text-white backdrop-blur-md hover:bg-black/40"
              >
                <X className="h-6 w-6" />
              </button>
              
              <div className="max-h-[90vh] overflow-y-auto">
                <div className="h-64 w-full overflow-hidden">
                  <img src={selectedPlant.imageUrl || 'https://picsum.photos/seed/plant/800/600'} alt={selectedPlant.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="p-8">
                  <div className="mb-6 flex items-start justify-between">
                    <div>
                      <h3 className="text-3xl font-bold">{selectedPlant.name}</h3>
                      <p className="italic text-[#5A5A40]/70">{selectedPlant.scientificName}</p>
                    </div>
                    <button 
                      onClick={async () => {
                        await updateDoc(doc(db, 'users', selectedPlant.userId, 'plants', selectedPlant.id), { lastWatered: new Date().toISOString() });
                        setSelectedPlant({ ...selectedPlant, lastWatered: new Date().toISOString() });
                      }}
                      className="flex items-center gap-2 rounded-full bg-[#5A5A40] px-6 py-3 font-bold text-white shadow-lg transition-transform hover:scale-105"
                    >
                      <Droplets className="h-5 w-5" />
                      {t('waterNow')}
                    </button>
                    <button 
                      onClick={() => {
                        onSetReminder({ plantId: selectedPlant.id, plantName: selectedPlant.name, userId: selectedPlant.userId });
                        setSelectedPlant(null);
                      }}
                      className="flex items-center gap-2 rounded-full border border-primary/20 px-6 py-3 font-bold text-primary transition-colors hover:bg-primary/5"
                    >
                      <AlarmClock className="h-5 w-5" />
                      Set Alarm
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedPlant.id)}
                      className="flex items-center gap-2 rounded-full bg-red-50 px-6 py-3 font-bold text-red-600 transition-colors hover:bg-red-100"
                    >
                      <Trash2 className="h-5 w-5" />
                      Delete
                    </button>
                  </div>

                  <div className="mb-8 grid gap-4 sm:grid-cols-2">
                    <CareItem icon={<Droplets />} label={t('watering')} value={selectedPlant.careInstructions.watering} />
                    <CareItem icon={<Sun />} label={t('sunlight')} value={selectedPlant.careInstructions.sunlight} />
                    <CareItem icon={<Thermometer />} label={t('temperature')} value={selectedPlant.careInstructions.temperature} />
                    <CareItem icon={<Sprout />} label={t('soil')} value={selectedPlant.careInstructions.soil} />
                  </div>

                  <div className="mb-8 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-bold">Recurring Tasks</h4>
                      <button 
                        onClick={async () => {
                          const type = prompt('Task type (pruning, fertilizing, repotting, other):') as any;
                          const freq = Number(prompt('Frequency in days:'));
                          if (type && freq) {
                            const newTask = {
                              id: Math.random().toString(36).substr(2, 9),
                              type,
                              frequencyDays: freq,
                              lastCompleted: new Date().toISOString(),
                              description: ''
                            };
                            const updatedTasks = [...(selectedPlant.tasks || []), newTask];
                            await updateDoc(doc(db, 'users', selectedPlant.userId, 'plants', selectedPlant.id), { tasks: updatedTasks });
                            setSelectedPlant({ ...selectedPlant, tasks: updatedTasks });
                          }
                        }}
                        className="flex items-center gap-1 text-sm font-bold text-[#5A5A40] hover:underline"
                      >
                        <Plus className="h-4 w-4" />
                        {t('addTask')}
                      </button>
                    </div>
                    <div className="grid gap-3">
                      {(selectedPlant.tasks || []).map((task: any) => (
                        <div key={task.id} className="flex items-center justify-between rounded-2xl bg-[#f5f5f0] p-4">
                          <div>
                            <p className="font-bold text-[#5A5A40] capitalize">{t(task.type)}</p>
                            <p className="text-xs text-[#5A5A40]/50">Every {task.frequencyDays} days</p>
                          </div>
                          <button 
                            onClick={async () => {
                              const updatedTasks = selectedPlant.tasks.map((t: any) => t.id === task.id ? { ...t, lastCompleted: new Date().toISOString() } : t);
                              await updateDoc(doc(db, 'users', selectedPlant.userId, 'plants', selectedPlant.id), { tasks: updatedTasks });
                              setSelectedPlant({ ...selectedPlant, tasks: updatedTasks });
                            }}
                            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#5A5A40] shadow-sm"
                          >
                            Mark Done
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xl font-bold">{t('notes')}</h4>
                    <textarea 
                      defaultValue={selectedPlant.notes}
                      onBlur={async (e) => {
                        await updateDoc(doc(db, 'users', selectedPlant.userId, 'plants', selectedPlant.id), { notes: e.target.value });
                      }}
                      placeholder="Add your own notes here..."
                      className="w-full rounded-2xl border border-[#5A5A40]/10 bg-[#f5f5f0] p-4 outline-none focus:border-[#5A5A40]"
                      rows={4}
                    />
                  </div>

                  <div className="mt-10 flex items-center justify-between border-t border-[#5A5A40]/10 pt-6">
                    <p className="text-sm text-[#5A5A40]/50">Added on {new Date(selectedPlant.createdAt).toLocaleDateString()}</p>
                    <button 
                      onClick={async () => {
                        if (confirm('Are you sure you want to remove this plant?')) {
                          await deleteDoc(doc(db, 'users', selectedPlant.userId, 'plants', selectedPlant.id));
                          setSelectedPlant(null);
                        }
                      }}
                      className="flex items-center gap-2 text-sm font-bold text-red-600 hover:underline"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('delete')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatPage({ user }: { user: any }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'users', user.uid, 'chat'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const m = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(m.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      }, (error) => {
        console.error("Error listening to chat messages:", error);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    const userMsg = input;
    setInput('');
    setLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, 'users', user.uid, 'chat'), {
        userId: user.uid,
        role: 'user',
        content: userMsg,
        timestamp: new Date().toISOString()
      });

      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const aiResponse = await getPlantAssistantResponse(history, userMsg);

      await addDoc(collection(db, 'users', user.uid, 'chat'), {
        userId: user.uid,
        role: 'model',
        content: aiResponse,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to get AI response");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-3xl bg-white shadow-xl md:h-[calc(100vh-8rem)] border border-primary/5">
      <div className="flex items-center gap-3 border-b border-primary/10 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-text-main">Botanic AI Assistant</h3>
          <p className="text-xs text-primary/50">Ask me anything about your plants</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-bg-main/30">
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-left text-sm text-red-700 max-w-xl mx-auto flex items-start justify-between shadow-sm">
            <div>
              <p className="font-semibold mb-1">Chat Error:</p>
              <p className="leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 font-bold ml-2 text-lg hover:text-red-700">×</button>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn(
            "flex w-full",
            m.role === 'user' ? "justify-end" : "justify-start"
          )}>
            <div className={cn(
              "max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm",
              m.role === 'user' ? "bg-primary text-white" : "bg-white text-text-main border border-primary/5"
            )}>
              <div className="markdown-body">
                <Markdown>{m.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white p-4 border border-primary/5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-primary/10 bg-white">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            className="flex-1 rounded-full border border-primary/10 bg-bg-main/50 px-6 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/5"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white transition-transform hover:scale-105 disabled:opacity-50 shadow-lg"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ 
  user, 
  profile, 
  onNavigate,
  loginError,
  handleSignIn,
  handleGuestSignIn
}: { 
  user: any; 
  profile: any; 
  onNavigate: (p: Page) => void;
  loginError: string | null;
  handleSignIn: () => Promise<void>;
  handleGuestSignIn: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();

  const updatePreference = async (key: string, value: any) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), {
      [`preferences.${key}`]: value
    });
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-primary">{t('profile')}</h2>

      {user ? (
        <div className="space-y-6">
          <div className="flex items-center gap-6 rounded-3xl bg-white p-8 shadow-sm border border-primary/5">
            <img src={user.photoURL} alt={user.displayName} className="h-24 w-24 rounded-full border-4 border-primary/10" />
            <div>
              <h3 className="text-2xl font-bold text-text-main">{user.displayName}</h3>
              <p className="text-primary/60">{user.email}</p>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm space-y-6 border border-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-primary" />
                <h4 className="font-bold text-text-main">{t('databaseStatus')}</h4>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-green-600">{t('connected')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-primary" />
                <h4 className="font-bold text-text-main">{t('language')}</h4>
              </div>
              <select 
                value={profile?.preferences?.language || 'en'}
                onChange={(e) => {
                  updatePreference('language', e.target.value);
                  i18n.changeLanguage(e.target.value);
                }}
                className="rounded-lg border border-primary/10 bg-bg-main/50 p-2 outline-none focus:border-primary"
              >
                <option value="en">English</option>
                <option value="ur">اردو (Urdu)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-primary" />
                <h4 className="font-bold text-text-main">{t('notifications')}</h4>
              </div>
              <button 
                onClick={() => updatePreference('notifications', !profile?.preferences?.notifications)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  profile?.preferences?.notifications ? "bg-primary" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 h-4 w-4 rounded-full bg-white transition-all",
                  profile?.preferences?.notifications ? "left-6" : "left-1"
                )} />
              </button>
            </div>
          </div>

          <button 
            onClick={logOut}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red-50 p-4 font-bold text-red-600 transition-colors hover:bg-red-100"
          >
            <LogOut className="h-5 w-5" />
            {t('logout')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center max-w-md mx-auto bg-white/50 backdrop-blur-sm rounded-3xl border border-primary/10 shadow-md">
          <UserIcon className="mb-4 h-12 w-12 text-primary/40 animate-pulse" />
          <h3 className="text-xl font-bold text-primary mb-2">Sign in Required</h3>
          <p className="text-sm text-primary/70 mb-6">Connect your account or choose guest mode to manage your personal garden and chat with AI.</p>
          
          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-left text-xs text-red-700">
              <p className="font-semibold mb-1">Notice:</p>
              <p>{loginError}</p>
            </div>
          )}

          <div className="flex flex-col w-full gap-3">
            <button 
              onClick={handleSignIn}
              className="flex items-center justify-center gap-3 rounded-full bg-primary px-6 py-3 text-white transition-transform hover:scale-105 shadow-md font-medium cursor-pointer text-sm"
            >
              <UserIcon className="h-4 w-4" />
              <span>{t('login')}</span>
            </button>
            
            <button 
              onClick={handleGuestSignIn}
              className="flex items-center justify-center gap-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-6 py-3 transition-transform hover:scale-105 font-medium cursor-pointer border border-slate-200 text-sm"
            >
              <UserIcon className="h-4 w-4 text-slate-500" />
              <span>Continue as Guest</span>
            </button>
          </div>
          
          <p className="mt-4 text-[10px] text-primary/40">
            For local network IPs (e.g., 192.168.1.27), please use Guest Mode.
          </p>
        </div>
      )}
    </div>
  );
}

function GuidesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const initialGuides = [
    { name: 'Monstera Deliciosa', category: 'Indoor', light: 'Bright Indirect', water: 'Every 1-2 weeks', img: 'https://picsum.photos/seed/monstera/800/600', detail: 'Known for its iconic holes, the Monstera thrives in humid environments and likes to climb.' },
    { name: 'Snake Plant', category: 'Indoor', light: 'Low to Bright', water: 'Every 2-3 weeks', img: 'https://picsum.photos/seed/snakeplant/800/600', detail: 'One of the toughest plants, perfect for beginners. It also purifies the air at night.' },
    { name: 'Lavender', category: 'Outdoor', light: 'Full Sun', water: 'Once a week', img: 'https://picsum.photos/seed/lavender/800/600', detail: 'Requires well-draining soil and plenty of sun. Great for attracting pollinators.' },
    { name: 'Fiddle Leaf Fig', category: 'Indoor', light: 'Bright Indirect', water: 'Once a week', img: 'https://picsum.photos/seed/fiddle/800/600', detail: 'A statement plant that loves consistency. Avoid moving it once it finds a happy spot.' },
    { name: 'Aloe Vera', category: 'Succulent', light: 'Bright Direct', water: 'Every 3 weeks', img: 'https://picsum.photos/seed/aloe/800/600', detail: 'A medicinal succulent that loves sun. Only water when the soil is completely dry.' },
    { name: 'Peace Lily', category: 'Indoor', light: 'Low to Medium', water: 'Once a week', img: 'https://picsum.photos/seed/peacelily/800/600', detail: 'Communicates its needs by drooping when thirsty. Keep away from direct hot sun.' },
    { name: 'Spider Plant', category: 'Indoor', light: 'Indirect Light', water: 'Once a week', img: 'https://picsum.photos/seed/spiderplant/800/600', detail: 'Produces "babies" that can be easily propagated. Very adaptable and easy to grow.' },
    { name: 'Pothos', category: 'Indoor', light: 'Low to Medium', water: 'Every 1-2 weeks', img: 'https://picsum.photos/seed/pothos/800/600', detail: 'The ultimate trailing plant. Can survive in low light and is very forgiving.' },
  ];

  const [guides, setGuides] = useState(initialGuides);

  const filtered = guides.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  const handleAiSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getPlantCareGuide(search);
      if (result) {
        setGuides(prev => {
          if (prev.find(p => p.name.toLowerCase() === result.name.toLowerCase())) return prev;
          return [result, ...prev];
        });
        setSearch(result.name);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to generate care guide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-3xl font-bold text-primary">Plant Care Guides</h2>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60" />
            <input 
              type="text" 
              placeholder="Search guides..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
              className="w-full rounded-full border border-primary/20 bg-white py-2 pl-10 pr-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-text-main"
            />
          </div>
          <button 
            onClick={handleAiSearch}
            disabled={loading}
            className="rounded-full bg-primary px-6 py-2 font-bold text-white shadow-md transition-transform hover:scale-105 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Search AI'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-left text-sm text-red-700 max-w-xl mx-auto shadow-sm">
          <p className="font-semibold mb-1">Care Guide Error:</p>
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="mb-4 text-primary/60">No local guide found for "{search}".</p>
          <button 
            onClick={handleAiSearch}
            className="rounded-full bg-primary/10 px-8 py-3 font-bold text-primary hover:bg-primary/20"
          >
            Ask AI for a Care Guide
          </button>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((guide, i) => (
          <motion.div 
            key={guide.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card group cursor-pointer"
          >
            <div className="h-48 overflow-hidden">
              <img src={guide.img} alt={guide.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
            </div>
            <div className="p-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary/50">{guide.category}</span>
              <h3 className="mb-4 text-xl font-bold text-text-main">{guide.name}</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-primary/70">
                  <Sun className="h-4 w-4" />
                  <span>{guide.light}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-primary/70">
                  <Droplets className="h-4 w-4" />
                  <span>{guide.water}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-primary/70 pt-2 border-t border-primary/5">
                  <Info className="h-4 w-4 shrink-0" />
                  <span className="text-xs italic">{guide.detail}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CommunityPage({ user }: { user: any }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'posts'));
    return unsubscribe;
  }, []);

  const handleLike = async (post: any) => {
    if (!user) return;
    const path = `posts/${post.id}`;
    const likes = post.likes || [];
    const newLikes = likes.includes(user.uid) 
      ? likes.filter((id: string) => id !== user.uid)
      : [...likes, user.uid];
    
    try {
      await updateDoc(doc(db, 'posts', post.id), { likes: newLikes });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-primary">Community Feed</h2>
        <button 
          onClick={() => setShowPostModal(true)}
          className="btn-primary flex items-center gap-2 py-2"
        >
          <Plus className="h-4 w-4" />
          Post
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} user={user} onLike={() => handleLike(post)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showPostModal && (
          <PostModal user={user} onClose={() => setShowPostModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PostCard({ post, user, onLike }: { post: any; user: any; onLike: () => void }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (showComments) {
      const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error(`Error listening to comments for post ${post.id}:`, error);
      });
      return unsubscribe;
    }
  }, [showComments, post.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    const path = `posts/${post.id}/comments`;
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        userId: user.uid,
        userName: user.displayName,
        userAvatar: user.photoURL,
        content: commentText,
        createdAt: new Date().toISOString()
      });
      setCommentText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const isLiked = post.likes?.includes(user?.uid);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <img src={post.userAvatar || 'https://i.pravatar.cc/150'} alt={post.userName} className="h-10 w-10 rounded-full" />
        <div>
          <h4 className="font-bold text-text-main">{post.userName}</h4>
          <span className="text-xs text-primary/70 font-medium">{new Date(post.createdAt).toLocaleString()}</span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <p className="text-primary/80 whitespace-pre-wrap">{post.content}</p>
      </div>
      {post.imageUrl && (
        <div className="h-80 w-full overflow-hidden">
          <img src={post.imageUrl} alt="Post" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="flex items-center gap-6 p-4 border-t border-primary/5">
        <button 
          onClick={onLike}
          className={cn(
            "flex items-center gap-2 text-sm font-bold transition-colors",
            isLiked ? "text-red-500" : "text-primary/80 hover:text-primary"
          )}
        >
          <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
          <span>{post.likes?.length || 0}</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm font-bold text-primary/80 hover:text-primary"
        >
          <MessageSquare className="h-5 w-5" />
          <span>Comment</span>
        </button>
      </div>

      {showComments && (
        <div className="bg-bg-main/30 p-4 border-t border-primary/5 space-y-4">
          <div className="space-y-3">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <img src={comment.userAvatar} alt={comment.userName} className="h-8 w-8 rounded-full" />
                <div className="flex-1 rounded-2xl bg-white p-3 shadow-sm">
                  <h5 className="text-xs font-bold text-primary">{comment.userName}</h5>
                  <p className="text-sm text-primary/80">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Write a comment..." 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 rounded-full border border-primary/10 bg-white px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button type="submit" className="rounded-full bg-primary p-2 text-white">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function PostModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user || loading) return;
    setLoading(true);
    const path = 'posts';
    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        userName: user.displayName,
        userAvatar: user.photoURL,
        content,
        imageUrl: image,
        likes: [],
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"
      >
        <h3 className="mb-4 text-2xl font-bold text-primary">Create Post</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea 
            placeholder="What's on your mind?" 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-32 w-full rounded-2xl border border-primary/10 bg-bg-main/50 p-4 outline-none focus:border-primary"
            required
          />
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="relative h-40 w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-primary/10 bg-bg-main/30 flex items-center justify-center"
          >
            {image ? (
              <img src={image} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="text-center text-primary/40">
                <Camera className="mx-auto mb-2 h-8 w-8" />
                <span className="text-sm">Add a photo</span>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 rounded-full bg-primary py-3 font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? 'Posting...' : 'Post to Community'}
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="rounded-full border border-primary/20 px-6 py-3 font-bold text-primary"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function HealthAdvicePage() {
  const { t } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGetAdvice = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const base64 = image.split(',')[1];
      const data = await getPlantHealthAdvice(base64);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to analyze plant health");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Sparkles className="h-8 w-8 text-primary" />
        <h2 className="text-3xl font-bold text-primary">AI Health Optimizer</h2>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-left text-sm text-red-700 max-w-xl mx-auto shadow-sm">
          <p className="font-semibold mb-1">Health Advice Error:</p>
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {!result ? (
        <div className="flex flex-col items-center">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-80 w-full max-w-md cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-primary/30 bg-white transition-all hover:border-primary hover:bg-primary/5"
          >
            {image ? (
              <img src={image} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <div className="text-center">
                <Camera className="mx-auto mb-4 h-12 w-12 text-primary/30 group-hover:text-primary" />
                <p className="text-primary/60">Upload a photo of your plant for health advice</p>
                <p className="text-xs text-primary/40 mt-2">Even if it's dusty, dirty, or struggling!</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>

          {image && !loading && (
            <button 
              onClick={handleGetAdvice}
              className="mt-6 rounded-full bg-primary px-10 py-4 font-bold text-white shadow-lg transition-transform hover:scale-105"
            >
              Get Expert Advice
            </button>
          )}

          {loading && (
            <div className="mt-6 flex items-center gap-2 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="font-bold">AI is analyzing your plant...</span>
            </div>
          )}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="rounded-3xl bg-white p-8 shadow-xl border border-primary/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-primary">Health Analysis</h3>
              <span className={cn(
                "rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest",
                result.urgency === 'high' ? "bg-red-100 text-red-600" : 
                result.urgency === 'medium' ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"
              )}>
                Urgency: {result.urgency}
              </span>
            </div>

            <div className="mb-8 rounded-2xl bg-bg-main/50 p-6">
              <p className="text-primary/80 leading-relaxed italic">"{result.healthStatus}"</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <section>
                <div className="flex items-center gap-2 mb-4 text-primary">
                  <Sparkles className="h-5 w-5" />
                  <h4 className="font-bold">Cleaning & Grooming</h4>
                </div>
                <p className="text-sm text-primary/70 leading-relaxed">{result.cleaningTips}</p>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                  <h4 className="font-bold">Recovery Steps</h4>
                </div>
                <ul className="space-y-2">
                  {result.recoverySteps.map((step: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-primary/70">
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="mt-8 border-t border-primary/5 pt-8">
              <h4 className="font-bold text-primary mb-4">Long-term Maintenance Plan</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.maintenancePlan.map((plan: string, i: number) => (
                  <div key={i} className="rounded-xl bg-primary/5 p-4 text-sm text-primary/70">
                    {plan}
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => {
                setResult(null);
                setImage(null);
              }}
              className="mt-10 w-full rounded-full border border-primary/20 py-4 font-bold text-primary transition-colors hover:bg-primary/5"
            >
              Analyze Another Plant
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
