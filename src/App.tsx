import React, { useEffect, useState, useRef } from 'react';
import { 
  onSnapshot, 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  MapPin, 
  Plus, 
  Send, 
  User as UserIcon, 
  LogOut, 
  Navigation,
  Globe,
  Bot,
  Trash2,
  Tornado,
  Zap,
  ShieldCheck,
  AlertCircle,
  RotateCw
} from 'lucide-react';
import { db, auth, signIn, signOut, handleFirestoreError, OperationType } from './lib/firebase';
import { getDistance, NEARBY_RADIUS_KM } from './lib/geo';
import { generateMaritechResponse } from './services/geminiService';

// --- Types ---
interface Lobby {
  id: string;
  name: string;
  lat: number;
  lng: number;
  creatorId: string;
  createdAt: any;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: any;
  isAi?: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [activeLobby, setActiveLobby] = useState<Lobby | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLobbyName, setNewLobbyName] = useState('');

  // --- Auth State ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Location State ---
  const handleScan = () => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported by this browser.");
      return;
    }

    setIsScanning(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("Location found:", pos.coords.latitude, pos.coords.longitude);
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setError(null);
        setIsScanning(false);
      },
      (err) => {
        console.warn("Location error:", err);
        setError("Location access denied or timed out. Please enable GPS.");
        setIsScanning(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    handleScan();
  }, []);

  // --- Lobbies Sync ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'lobbies'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lobbyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lobby[];
      setLobbies(lobbyData);
    }, (err) => {
      console.error("Lobbies sync error:", err);
    });
    return () => unsubscribe();
  }, [user]);

  const nearbyLobbies = lobbies.filter(lobby => {
    if (!location) return true; // Show all if location is missing
    const dist = getDistance(location.lat, location.lng, lobby.lat, lobby.lng);
    return dist <= NEARBY_RADIUS_KM * 2; // Slightly larger radius for demo
  });

  const handleCreateLobby = async (name: string) => {
    if (!user) {
      setError("Please sign in to create a cluster.");
      return;
    }

    if (!name || !name.trim()) return;

    // Use fallback coordinates if location isn't ready
    const targetLat = location?.lat ?? 14.5995;
    const targetLng = location?.lng ?? 120.9842;

    setIsCreating(true);
    try {
      const newLobby = {
        name: name.trim(),
        lat: targetLat,
        lng: targetLng,
        creatorId: user.uid,
        createdAt: serverTimestamp()
      };
      
      console.log("Attempting to create lobby with payload:", newLobby);
      const docRef = await addDoc(collection(db, 'lobbies'), newLobby);
      console.log("Lobby successfully created with ID:", docRef.id);
      
      setActiveLobby({ id: docRef.id, ...newLobby } as Lobby);
      setError(null);
    } catch (err) {
      console.error("Lobby creation failed:", err);
      setError("Failed to create cluster. Please try again.");
      handleFirestoreError(err, OperationType.CREATE, 'lobbies');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteLobby = async (lobbyId: string) => {
    if (!window.confirm("Broadcast Termination: Delete this cluster?")) return;
    try {
      await deleteDoc(doc(db, 'lobbies', lobbyId));
      if (activeLobby?.id === lobbyId) setActiveLobby(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `lobbies/${lobbyId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Tornado className="w-10 h-10 text-indigo-600" />
        </motion.div>
        <p className="mt-4 text-xs font-bold text-slate-400 tracking-widest uppercase">Initializing Interface...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 overflow-hidden flex flex-col">
      {/* Geometric Balanced Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveLobby(null)}>
          <div className="w-10 h-10 bg-indigo-600 rounded-sm flex items-center justify-center text-white font-black italic text-xl">M</div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800 underline underline-offset-4 decoration-indigo-500 uppercase">MARITECH</h1>
            <p className="text-[9px] text-slate-400 font-bold tracking-[0.2em] uppercase leading-none">High-Tech Chika Hub</p>
          </div>
        </div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-800 uppercase">{user.displayName || 'Neighbor'}</span>
              <span className="text-[10px] text-indigo-500 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> VERIFIED
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <button 
              onClick={signOut}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Leave Network"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={signIn}
            className="bg-slate-900 text-white px-5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-all shadow-md"
          >
            Access Network
          </button>
        )}
      </header>

      <main className="max-w-7xl w-full mx-auto flex flex-col md:flex-row flex-grow overflow-hidden p-4 md:p-6 gap-6">
        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl"
            >
              <div className="inline-block mb-10 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold tracking-widest uppercase border border-indigo-100">
                Next-Gen Neighborhood Intel
              </div>
              <h2 className="text-5xl md:text-7xl font-black mb-8 text-slate-900 tracking-tighter leading-[0.9]">
                Connecting <span className="text-indigo-600 italic">Bawat</span> Neighbor Through <br/> AI Tech.
              </h2>
              <p className="text-slate-500 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
                Experience the Marites culture reimagined. Join public lobbies near your location and chat with a Gemini-powered bot that knows all the local vibes.
              </p>
              <button 
                onClick={signIn}
                className="bg-indigo-600 text-white px-10 py-5 rounded-sm font-black text-xl uppercase tracking-tighter shadow-[4px_4px_0px_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
              >
                Scan My Area
              </button>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Discovery Sidebar: Geometric Columns */}
            <aside className={`w-full md:w-80 lg:w-96 flex flex-col gap-4 ${activeLobby ? 'hidden md:flex' : 'flex'} flex-shrink-0`}>
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                  <Zap className="w-3 h-3 text-indigo-500" />
                  Signal Discovery
                </h3>
                <div className="flex items-center gap-2">
                  {location ? (
                    <span className="flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Scanned
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100 animate-pulse">
                      <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span> Searching...
                    </span>
                  )}
                  <button 
                    onClick={handleScan}
                    disabled={isScanning}
                    className="p-1 hover:bg-slate-100 rounded-sm text-slate-400 hover:text-indigo-600 transition-all disabled:opacity-50"
                    title="Refresh Scan"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-hide py-2">
                {nearbyLobbies.length === 0 ? (
                  <div className="p-10 bg-white border border-slate-200 border-dashed rounded-sm text-center flex flex-col items-center justify-center">
                    <UserIcon className="w-12 h-12 text-slate-100 mb-4" />
                    <p className="text-xs font-bold text-slate-400 uppercase italic">No active Clusters found in your range</p>
                  </div>
                ) : (
                  nearbyLobbies.map((lobby) => (
                    <motion.div 
                      key={lobby.id}
                      layoutId={lobby.id}
                      className="group relative"
                    >
                      <button
                        onClick={() => setActiveLobby(lobby)}
                        className={`w-full text-left p-5 border transition-all rounded-sm flex flex-col gap-1 ${
                          activeLobby?.id === lobby.id 
                            ? 'bg-white border-indigo-600 border-l-4 shadow-md' 
                            : 'bg-white border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 border border-slate-100">
                            ID: #{lobby.id.slice(0, 4).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-indigo-500 font-bold">
                            {location ? `${getDistance(location.lat, location.lng, lobby.lat, lobby.lng).toFixed(1)}km` : 'Remote'}
                          </span>
                        </div>
                        <span className={`text-lg font-black uppercase italic ${activeLobby?.id === lobby.id ? 'text-indigo-600' : 'text-slate-800'}`}>
                          {lobby.name}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium uppercase truncate">Joined by local neighbors</p>
                      </button>
                      {lobby.creatorId === user.uid && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLobby(lobby.id);
                          }}
                          className="absolute -top-1 -right-1 w-6 h-6 flex items-center justify-center bg-white border border-red-200 text-red-500 rounded-sm shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 z-20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </div>

              <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-sm">
                <button 
                  onClick={() => {
                    setShowCreateModal(true);
                  }}
                  disabled={isCreating}
                  className="w-full bg-slate-900 text-white py-4 rounded-sm font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all disabled:opacity-50"
                  id="new-cluster-btn"
                >
                  {isCreating ? <Tornado className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  New Cluster
                </button>
              </div>
            </aside>

            {/* Create Cluster Modal Inline */}
            <AnimatePresence>
              {showCreateModal && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                >
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white p-8 rounded-sm border-4 border-black shadow-[8px_8px_0px_#000] max-w-md w-full"
                  >
                    <h3 className="text-2xl font-black uppercase italic mb-2 tracking-tight">Deploy Cluster</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Network Initialization Protocol</p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Cluster Designation</label>
                        <input 
                          autoFocus
                          type="text"
                          value={newLobbyName}
                          onChange={(e) => setNewLobbyName(e.target.value)}
                          placeholder="e.g. Brgy. Intel Hub"
                          className="w-full bg-slate-50 border-2 border-slate-200 rounded-sm px-4 py-3 text-sm focus:border-indigo-600 focus:outline-none transition-all font-bold uppercase italic"
                        />
                      </div>
                      
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => setShowCreateModal(false)}
                          className="flex-1 py-3 border-2 border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                          Abort
                        </button>
                        <button 
                          onClick={async () => {
                            if (newLobbyName.trim()) {
                              await handleCreateLobby(newLobbyName);
                              setNewLobbyName('');
                              setShowCreateModal(false);
                            }
                          }}
                          disabled={isCreating || !newLobbyName.trim()}
                          className="flex-1 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
                        >
                          {isCreating ? 'Deploying...' : 'Initialize'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Interface: Main Balanced Column */}
            <section className={`flex-1 flex flex-col bg-white border border-slate-200 shadow-xl overflow-hidden rounded-sm ${activeLobby ? 'flex' : 'hidden md:flex items-center justify-center text-center p-12 bg-slate-50/50'}`}>
              <AnimatePresence mode="wait">
                {activeLobby ? (
                  <ChatWindow 
                    key={activeLobby.id} 
                    lobby={activeLobby} 
                    user={user} 
                    onBack={() => setActiveLobby(null)}
                  />
                ) : (
                  <div className="max-w-md">
                    <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto mb-8 flex items-center justify-center text-slate-300">
                      <Navigation className="w-10 h-10" />
                    </div>
                    <h4 className="text-2xl font-black text-slate-800 uppercase italic mb-4">Signal Intercept Ready</h4>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                      Select an active cluster from the side discovery panel to begin intercepted data transmission. 
                      Stay safe, stay neighborly.
                    </p>
                    <div className="flex justify-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-indigo-200"></span>
                       <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                       <span className="w-2 h-2 rounded-full bg-slate-100"></span>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </section>
          </>
        )}
      </main>

      {/* Persistent Status Bar */}
      <footer className="h-8 bg-slate-900 border-t border-slate-700 px-4 flex items-center justify-between z-[60] flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${location ? 'bg-green-500 shadow-[0_0_8px_#10b981]' : 'bg-yellow-500 animate-pulse'}`}></div>
             <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">
               {location ? `LOC: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'LOC: SCANNING...'}
             </span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">MODE: ENCRYPTED CHIKA</span>
        </div>
        <div className="flex items-center gap-2">
          <Bot className="w-3 h-3 text-indigo-500" />
          <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">AI Uptime: 99.9%</span>
        </div>
      </footer>

      {error && (
        <div className="fixed bottom-12 left-6 right-6 md:left-auto md:w-96 bg-red-600 text-white p-4 shadow-2xl z-[100] rounded-sm flex items-start gap-3 border-l-4 border-black">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-tight mb-1">Network Alert</p>
            <p className="text-[11px] font-medium leading-tight opacity-90">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-white hover:text-black transition-colors ml-auto font-black text-xs">DISMISS</button>
        </div>
      )}
    </div>
  );
}

function ChatWindow({ lobby, user, onBack }: { lobby: Lobby, user: User, onBack: () => void, key?: React.Key }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isBotThinking, setIsBotThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'lobbies', lobby.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    }, (err) => {
      console.error("Messages sync error:", err);
    });
    return () => unsubscribe();
  }, [lobby.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isBotThinking]);

  const handleSendMessage = async (e?: any) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const currentText = inputText;
    setInputText('');

    try {
      await addDoc(collection(db, 'lobbies', lobby.id, 'messages'), {
        text: currentText,
        senderId: user.uid,
        senderName: user.displayName || 'Neighbor',
        createdAt: serverTimestamp(),
        isAi: false
      });

      // AI triggering:
      // 1. Explicit command (!)
      // 2. Mentions maritech or ai
      // 3. Random chance
      if (currentText.startsWith('!') ||
          currentText.toLowerCase().includes('maritech') || 
          currentText.toLowerCase().includes('ai') || 
          Math.random() > 0.85) {
        
        // If it was an explicit command, maybe we strip the '!' for the bot's prompt
        const cleanMessage = currentText.startsWith('!') ? currentText.slice(1).trim() : currentText;
        triggerAiBot(cleanMessage);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `lobbies/${lobby.id}/messages`);
    }
  };

  const triggerAiBot = async (triggerMessage: string) => {
    setIsBotThinking(true);
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));

    const recentMsgs = [...messages, { senderName: user.displayName || 'Neighbor', text: triggerMessage }]
      .slice(-6)
      .map(m => ({ sender: m.senderName, text: m.text }));

    const aiResponse = await generateMaritechResponse(lobby.name, recentMsgs);

    try {
      await addDoc(collection(db, 'lobbies', lobby.id, 'messages'), {
        text: aiResponse,
        senderId: user.uid,
        senderName: 'MARI AI',
        createdAt: serverTimestamp(),
        isAi: true
      });
    } catch (err) {
      console.error("AI Post error:", err);
    } finally {
      setIsBotThinking(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex-1 flex flex-col h-full bg-white relative overflow-hidden"
    >
      {/* Lobby Header: Balanced */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <Navigation className="w-5 h-5 -rotate-90" />
          </button>
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-sm flex items-center justify-center text-indigo-600">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-slate-800 tracking-tight italic">{lobby.name}</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Public Cluster • Signal Locked</p>
          </div>
        </div>
        <div className="hidden sm:flex gap-2">
           <button onClick={onBack} className="px-3 py-1 bg-white border border-slate-200 text-[10px] font-bold rounded-sm uppercase tracking-wider hover:bg-slate-50 transition-colors">
            Exit
           </button>
        </div>
      </div>

      {/* Message Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-white/50"
      >
        {messages.length === 0 && !isBotThinking && (
          <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale">
            <Globe className="w-20 h-20 mb-4" />
            <p className="text-xs font-black uppercase italic tracking-[0.3em]">Awaiting Uplink...</p>
          </div>
        )}

        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-3 ${msg.senderId === user.uid && !msg.isAi ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-sm text-[10px] font-black italic border ${
              msg.isAi 
                ? 'bg-indigo-600 text-white border-indigo-700' 
                : msg.senderId === user.uid 
                  ? 'bg-slate-900 text-white border-slate-950' 
                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
            }`}>
              {msg.isAi ? 'AI' : msg.senderName.slice(0, 2).toUpperCase()}
            </div>

            <div className={`flex flex-col max-w-[80%] md:max-w-[70%] ${msg.senderId === user.uid && !msg.isAi ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{msg.senderName}</span>
                <span className="text-[9px] font-mono text-slate-300">
                  {msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                </span>
              </div>
              <div className={`p-4 rounded-sm text-sm shadow-sm border ${
                msg.isAi 
                  ? 'bg-indigo-50 border-indigo-100 text-indigo-900 border-l-4 italic' 
                  : msg.senderId === user.uid 
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-100' 
                    : 'bg-white border-slate-200 text-slate-700'
              }`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}

        {isBotThinking && (
          <div className="flex gap-3">
             <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-sm bg-indigo-600 text-white border border-indigo-700 font-black italic text-[10px] animate-pulse">
                AI
             </div>
             <div className="flex flex-col items-start max-w-[70%]">
               <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1 animate-pulse">Mari AI is thinking...</span>
               <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-sm italic text-indigo-400 flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
               </div>
             </div>
          </div>
        )}
      </div>

      {/* Geometric Input: Indigo Themed */}
      <div className="p-6 bg-slate-50 border-t border-slate-100 shadow-inner flex-shrink-0">
        <form 
          onSubmit={handleSendMessage}
          className="max-w-4xl mx-auto"
        >
          <div className="relative group flex flex-col gap-2">
            <div className="relative">
              <input 
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Spill the tea... (Use ! to ask AI)"
                className="w-full bg-white border border-slate-200 rounded-sm px-5 py-4 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-300 italic shadow-sm pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button 
                  type="button"
                  onClick={() => triggerAiBot("Summarize everything!")}
                  className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-sm transition-all"
                  title="Ask Gemini"
                  disabled={isBotThinking}
                >
                  <Bot className={`w-6 h-6 ${isBotThinking ? 'opacity-20' : ''}`} />
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between px-1">
               <div className="flex items-center gap-2 opacity-50">
                 <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Network Secure</span>
               </div>
               <button 
                type="submit"
                disabled={!inputText.trim()}
                className="bg-indigo-600 text-white px-8 py-2 rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-30 disabled:grayscale flex items-center gap-2 shadow-sm"
              >
                Send <span><Send className="w-3.5 h-3.5" /></span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
