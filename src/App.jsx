import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Leaf, Loader2, AlertCircle, CheckCircle, X, Wifi, WifiOff, 
  Activity, ShieldCheck, Stethoscope, History, Info, LogOut, User, Lock, Mail, Trash2,
  Phone, MapPin, ArrowRight, Smartphone, CloudLightning, Sprout, Home, Sun
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc,
  doc,
  setDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBajMfw6j3D_rsXEv7Om24Ho11BP83VjXc",
  authDomain: "plant-doctor-fe172.firebaseapp.com",
  projectId: "plant-doctor-fe172",
  storageBucket: "plant-doctor-fe172.firebasestorage.app",
  messagingSenderId: "966213776466",
  appId: "1:966213776466:web:97506388dc61bd221e5b8b",
};

const isConfigured = firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE";
const app = isConfigured ? initializeApp(firebaseConfig) : null;
const auth = isConfigured ? getAuth(app) : null;
const db = isConfigured ? getFirestore(app) : null;

export default function PlantDiseaseUI() {
  
  const [user, setUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('landing'); 
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [authError, setAuthError] = useState(null);

  // Scanner State
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking'); 
  const fileInputRef = useRef(null);

  // FIX: Default is now empty string (no selection) instead of 'auto'
  const [selectedPlant, setSelectedPlant] = useState('');

  // History State
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 1. Auth Listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && (currentTab === 'auth' || currentTab === 'landing')) {
        setCurrentTab('home');
      }
      if (!currentUser) {
        setCurrentTab('landing');
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch History (Real-time)
  useEffect(() => {
    if (!user || !db) return;
    setLoadingHistory(true);
    const historyRef = collection(db, 'users', user.uid, 'history');
    const unsubscribe = onSnapshot(historyRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setHistoryItems(items);
      setLoadingHistory(false);
    }, (err) => {
      console.error("History fetch error:", err);
      setLoadingHistory(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Check Backend Connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch("https://plant-doctor-backend.onrender.com");
        if (response.ok) setServerStatus('connected');
        else setServerStatus('disconnected');
      } catch {
        setServerStatus('disconnected');
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- HANDLERS ---

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!auth) { setAuthError("Firebase is not configured yet."); return; }
    setAuthError(null);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (db) {
          try {
            await setDoc(doc(db, 'users', userCredential.user.uid), {
              name, phone, address, email, joinedAt: serverTimestamp()
            });
          } catch (profileErr) {
            console.error("Error saving profile:", profileErr);
          }
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    clearData();
    setHistoryItems([]);
    setCurrentTab('landing');
    setEmail(''); setPassword(''); setName(''); setPhone(''); setAddress('');
  };

  const onSelectFile = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setSelectedFile(file);
    setResult(null);
    setError(null);
    setPreview(URL.createObjectURL(file));
  };

  const clearData = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveToHistory = async (data) => {
    if (!user || !db || data.status === "Error") return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'history'), {
        disease_class: data.class,
        confidence: data.confidence,
        timestamp: serverTimestamp(),
        solutions: data.solutions
      });
    } catch (err) {
      console.error("Failed to save history:", err);
    }
  };

  const deleteHistoryItem = async (itemId) => {
    if (!user || !db) return;
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'history', itemId));
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const sendFile = async () => {
    // FIX: Guard — plant type must be selected before sending
    if (!selectedFile || !selectedPlant) return;

    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("plant_type", selectedPlant);

    try {
      const response = await fetch("https://plant-doctor-backend.onrender.com/predict", {
        method: "POST",
        body: formData,
      });

      // FIX: Handle all error status codes with a proper message
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error (${response.status})`);
      }

      const data = await response.json();
      setResult(data);
      saveToHistory(data);
    } catch (err) {
      setError(err.message || "Could not connect to the backend.");
      if (err.message.includes("connect")) setServerStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: is the Analyze button ready to be clicked?
  // FIX: requires both a file AND a plant selection
  const canAnalyze = selectedFile && selectedPlant && !isLoading && !result && serverStatus !== 'disconnected';

  // --- RENDER HELPERS ---

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-white">Setup Required</h2>
          <p className="text-gray-400 mb-4">You haven't pasted your Firebase Config keys yet.</p>
        </div>
      </div>
    );
  }

  // --- VIEW: LANDING PAGE ---
  if (currentTab === 'landing') {
    return (
      <div className="min-h-screen bg-gray-950 font-sans flex flex-col text-gray-100">
        <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between w-full border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Leaf className="w-10 h-10 md:w-12 md:h-12 text-green-500" />
            <span className="font-extrabold text-3xl md:text-4xl text-white tracking-tighter">Plant Doctor AI</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentTab('auth')} className="text-gray-400 hover:text-green-400 font-medium transition-colors">
              Sign In
            </button>
            <button onClick={() => { setIsSignUp(true); setCurrentTab('auth'); }} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-full font-semibold transition-all shadow-lg shadow-green-900/20">
              Get Started
            </button>
          </div>
        </nav>

        <header className="flex-1 flex items-center justify-center py-16 px-6">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-900/30 text-green-400 text-sm font-medium border border-green-800/50">
                <Sprout className="w-4 h-4" />
                <span>AI-Powered Agriculture</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
                Heal your crops with <span className="text-green-500">Artificial Intelligence</span>
              </h1>
              <p className="text-xl text-gray-400 leading-relaxed max-w-lg">
                Instantly diagnose plant diseases using your camera. Get professional treatment advice and save your harvest in seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button onClick={() => { setIsSignUp(true); setCurrentTab('auth'); }} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-xl text-lg font-bold transition-all shadow-xl shadow-green-900/20 transform hover:-translate-y-1">
                  Start Diagnosing <ArrowRight className="w-5 h-5" />
                </button>
                <button onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })} className="flex items-center justify-center gap-2 bg-gray-900 border-2 border-gray-700 hover:border-green-500 hover:bg-gray-800 text-gray-300 px-8 py-4 rounded-xl text-lg font-bold transition-all">
                  Learn More
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 pt-4">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-950 flex items-center justify-center text-xs font-bold text-gray-400">{i}</div>
                  ))}
                </div>
                <p>Trusted by 10,000+ farmers worldwide</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute top-10 right-10 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-20"></div>
              <div className="absolute top-10 -left-10 w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-20"></div>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-gray-800 transform rotate-2 hover:rotate-0 transition-all duration-500">
                <img src="garden.png" alt="Farmer inspecting plants" className="w-full h-auto object-cover opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6 bg-gray-900/90 backdrop-blur-md border border-gray-700 p-4 rounded-xl shadow-lg flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center border border-red-800/50">
                    <Activity className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Analysis Complete</p>
                    <p className="text-xs text-gray-400">Tomato Late Blight detected</p>
                  </div>
                  <div className="ml-auto text-red-500 font-bold">98%</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section id="features" className="py-20 bg-gray-900 px-6 border-t border-gray-800">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">Why choose Plant Doctor?</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">We combine cutting-edge Deep Learning with agricultural expertise to provide lab-quality diagnosis in your pocket.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="w-14 h-14 bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-400 mb-6 border border-blue-800/50">
                  <CloudLightning className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Instant Analysis</h3>
                <p className="text-gray-400 leading-relaxed">Simply snap a photo and get results in seconds.</p>
              </div>
              <div className="bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="w-14 h-14 bg-green-900/30 rounded-xl flex items-center justify-center text-green-400 mb-6 border border-green-800/50">
                  <Stethoscope className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Expert Treatment</h3>
                <p className="text-gray-400 leading-relaxed">We provide organic and chemical treatment plans for every disease.</p>
              </div>
              <div className="bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="w-14 h-14 bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-400 mb-6 border border-purple-800/50">
                  <History className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Track History</h3>
                <p className="text-gray-400 leading-relaxed">Keep a digital log of your farm's health over time.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="bg-gray-950 py-12 border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Leaf className="w-6 h-6 text-green-500" />
              <span className="font-bold text-white">Plant Doctor AI</span>
            </div>
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Plant Doctor AI. Empowering Farmers.</p>
          </div>
        </footer>
      </div>
    );
  }

  // --- VIEW: AUTH ---
  if (currentTab === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-gray-800 w-full max-w-md p-8 rounded-3xl shadow-2xl border border-gray-700 relative">
          <button onClick={() => setCurrentTab('landing')} className="absolute top-4 left-4 text-gray-500 hover:text-gray-300 transition-colors">
            <ArrowRight className="w-6 h-6 rotate-180" />
          </button>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-green-900/30 border border-green-800/50 rounded-full mb-4">
              <Leaf className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Welcome to Plant Doctor</h1>
            <p className="text-gray-400">{isSignUp ? 'Create your farmer profile' : "Sign in to track your plant's health"}</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder-gray-600" placeholder="John Doe" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder-gray-600" placeholder="gardener@example.com" />
              </div>
            </div>
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                    <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder-gray-600" placeholder="+1 (555) 000-0000" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Farm Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                    <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder-gray-600" placeholder="123 Agri Lane, Crop City" />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder-gray-600" placeholder="••••••••" />
              </div>
            </div>

            {authError && (
              <div className="bg-red-900/20 border border-red-800/50 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {authError}
              </div>
            )}

            <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-green-900/20">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }} className="text-sm text-green-400 hover:text-green-300 font-medium transition-colors">
              {isSignUp ? 'Already have an account? Sign In' : 'New here? Create Account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP LAYOUT (Logged In) ---
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col font-sans">

      <nav className="bg-gray-900 shadow-md border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setCurrentTab('home')}>
            <Leaf className="w-8 h-8 md:w-10 md:h-10 text-green-500" />
            <span className="font-extrabold text-2xl md:text-3xl text-white hidden sm:block tracking-tight">Plant Doctor AI</span>
          </div>

          <div className="flex items-center bg-gray-950 border border-gray-800 rounded-lg p-1">
            {[
              { tab: 'home', icon: <Home className="w-4 h-4" />, label: 'Home' },
              { tab: 'scanner', icon: <Smartphone className="w-4 h-4" />, label: 'Scanner' },
              { tab: 'history', icon: <History className="w-4 h-4" />, label: 'History' },
              { tab: 'info', icon: <Info className="w-4 h-4" />, label: 'Info' },
            ].map(({ tab, icon, label }) => (
              <button key={tab} onClick={() => setCurrentTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${currentTab === tab ? 'bg-gray-800 text-green-400 shadow-sm border border-gray-700' : 'text-gray-400 hover:text-gray-200'}`}>
                {icon} {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${serverStatus === 'connected' ? 'bg-green-900/30 text-green-400 border-green-800/50' : 'bg-red-900/30 text-red-400 border-red-800/50'}`}>
              {serverStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden lg:inline">{serverStatus === 'connected' ? 'Online' : 'Offline'}</span>
            </div>
            <div className="h-8 w-px bg-gray-800 mx-1 hidden md:block"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-900/50 border border-green-800/50 rounded-full flex items-center justify-center text-green-400 font-bold text-sm">
                {user?.email?.[0].toUpperCase()}
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6">

        {/* --- TAB: HOME --- */}
        {currentTab === 'home' && (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="bg-gray-900 rounded-3xl p-8 shadow-lg border border-gray-800 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                <h1 className="text-3xl font-bold text-white">
                  Welcome back, {name ? name.split(' ')[0] : user?.email?.split('@')[0]}! 🌾
                </h1>
                <p className="text-gray-400 leading-relaxed">
                  Ready to check your crops? Select a plant type and upload a leaf photo for an instant diagnosis.
                </p>
                <button onClick={() => setCurrentTab('scanner')} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-green-900/20 transition-all flex items-center gap-2">
                  <Smartphone className="w-5 h-5" /> Start Diagnosis
                </button>
              </div>
              <div className="w-full md:w-1/3 aspect-video rounded-2xl overflow-hidden shadow-lg relative group border border-gray-700">
                <img src="farmer.png" alt="Farmer in field" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent flex items-end p-4">
                  <p className="text-white font-medium text-sm">Sustainable Farming</p>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl border border-gray-700 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-gray-950 border border-gray-800 rounded-full shadow-sm text-green-500">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Crop Protection 101</h2>
                </div>
                <ul className="space-y-3">
                  {[
                    "Rotate crops every 2-3 years to break disease cycles.",
                    "Sanitize tools between uses to prevent spread.",
                    "Monitor soil moisture—too wet promotes fungus."
                  ].map((tip, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-300">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gray-900 p-8 rounded-3xl shadow-lg border border-gray-800 flex flex-col justify-center">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Sun className="w-5 h-5 text-orange-500" /> Daily Tip
                </h3>
                <blockquote className="text-lg text-gray-300 italic border-l-4 border-green-500 pl-4 py-2 mb-4 bg-gray-950/50 rounded-r-lg">
                  "The best fertilizer is the gardener's shadow."
                </blockquote>
                <p className="text-sm text-gray-500">
                  Regular observation is key. Check your plants daily for early signs of stress before they become outbreaks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: SCANNER --- */}
        {currentTab === 'scanner' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gray-900 rounded-3xl shadow-xl border border-gray-800 overflow-hidden">
              <div className="p-8">

                {/* PLANT TYPE SELECTOR — now required, no auto-detect */}
                <div className="mb-6">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-2">
                    <Sprout className="w-4 h-4 text-green-500" />
                    Select Crop Type <span className="text-red-400 ml-1">*</span>
                  </label>
                  <select
                    value={selectedPlant}
                    onChange={(e) => { setSelectedPlant(e.target.value); setResult(null); setError(null); }}
                    className={`w-full bg-gray-950 border text-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all font-medium cursor-pointer ${
                      !selectedPlant ? 'border-yellow-700/60 text-gray-400' : 'border-gray-700'
                    }`}
                  >
                    <option value="" disabled>— Choose a plant type —</option>
                    <option value="tomato">🍅 Tomato</option>
                    <option value="potato">🥔 Potato</option>
                  </select>
                  {/* FIX: Show a gentle warning if user hasn't selected yet */}
                  {!selectedPlant && (
                    <p className="text-yellow-500/80 text-xs mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Please select a crop type before analyzing.
                    </p>
                  )}
                </div>

                {!preview ? (
                  <div
                    className="border-2 border-dashed border-gray-700 rounded-2xl h-64 flex flex-col items-center justify-center bg-gray-950/50 cursor-pointer hover:border-green-500 hover:bg-gray-900 transition-colors group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="bg-gray-900 border border-gray-800 p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-gray-300 font-medium text-lg">Click to upload image</p>
                    <p className="text-gray-500 text-sm">JPG, PNG supported</p>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden bg-black shadow-inner border border-gray-800 h-64 flex items-center justify-center">
                    <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain" />
                    <button onClick={(e) => { e.stopPropagation(); clearData(); }} className="absolute top-4 right-4 bg-gray-900/80 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={onSelectFile} accept="image/*" className="hidden" />
              </div>

              <div className="bg-gray-950 px-8 py-6 border-t border-gray-800 flex items-center justify-between min-h-[80px]">
                {isLoading ? (
                  <div className="w-full flex flex-col items-center justify-center py-2">
                    <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-2" />
                    <p className="text-gray-500 text-sm animate-pulse">Consulting knowledge base...</p>
                  </div>
                ) : result ? (
                  <button onClick={clearData} className="ml-auto text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-5 py-2 rounded-lg transition-colors">
                    Scan Another
                  </button>
                ) : preview ? (
                  <div className="w-full flex items-center justify-between">
                    {/* FIX: Show tooltip when plant not selected */}
                    <span className="text-xs text-gray-500">
                      {!selectedPlant ? '⚠️ Select a crop type above first' : `Analyzing as ${selectedPlant}`}
                    </span>
                    <button
                      onClick={sendFile}
                      disabled={!canAnalyze}
                      className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-green-900/20 transition-all flex items-center gap-2"
                    >
                      <Leaf className="w-5 h-5" /> Analyze Leaf
                    </button>
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Ready for upload
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                <div className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-800 to-gray-950 p-6 text-white flex justify-between items-center border-b border-gray-700">
                    <div>
                      <p className="text-gray-400 text-sm uppercase tracking-wider font-semibold mb-1">Diagnosis Result</p>
                      <h2 className="text-3xl font-bold">{result.class.replace(/_/g, " ")}</h2>
                    </div>
                    <div className="text-right">
                      <span className={`text-4xl font-bold ${result.status === "Error" ? "text-red-500" : "text-green-500"}`}>
                        {(result.confidence * 100).toFixed(0)}%
                      </span>
                      <p className="text-xs text-gray-500 uppercase mt-1">Confidence</p>
                    </div>
                  </div>
                  <div className="p-6 bg-gray-900">
                    <div className="flex gap-4">
                      <Activity className="w-6 h-6 text-blue-400 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-white">Condition Overview</h3>
                        <p className="text-gray-400 leading-relaxed mt-1">{result.solutions?.description || "No description available."}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-900 rounded-2xl shadow-lg border border-red-900/30 overflow-hidden">
                    <div className="bg-red-900/10 p-4 border-b border-red-900/30 flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-red-400" />
                      <h3 className="font-bold text-white">Treatment</h3>
                    </div>
                    <div className="p-5">
                      <ul className="space-y-3">
                        {result.solutions?.treatment?.map((item, index) => (
                          <li key={index} className="flex gap-3 text-sm text-gray-300">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-900/50 border border-red-800 text-red-400 flex items-center justify-center text-xs font-bold">{index + 1}</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-2xl shadow-lg border border-green-900/30 overflow-hidden">
                    <div className="bg-green-900/10 p-4 border-b border-green-900/30 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-green-400" />
                      <h3 className="font-bold text-white">Prevention</h3>
                    </div>
                    <div className="p-5">
                      <ul className="space-y-3">
                        {result.solutions?.prevention?.map((item, index) => (
                          <li key={index} className="flex gap-3 text-sm text-gray-300">
                            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB: HISTORY --- */}
        {currentTab === 'history' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-gray-900 rounded-3xl shadow-xl border border-gray-800 p-6 min-h-[500px]">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <History className="w-6 h-6 text-green-500" /> Diagnosis History
              </h2>

              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-2 text-green-500" />
                  <p>Loading records...</p>
                </div>
              ) : historyItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-gray-950 rounded-2xl border-2 border-dashed border-gray-800">
                  <Leaf className="w-12 h-12 mb-3 text-gray-700" />
                  <p>No scans recorded yet.</p>
                  <button onClick={() => setCurrentTab('scanner')} className="mt-4 text-green-500 font-medium hover:text-green-400 transition-colors">Start Scanning</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyItems.map((item) => (
                    <div key={item.id} className="border border-gray-800 bg-gray-950 rounded-xl p-4 hover:border-gray-700 transition-colors flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold border ${item.disease_class?.includes('Healthy') ? 'bg-green-900/50 border-green-800/50' : 'bg-red-900/50 border-red-800/50'}`}>
                          {item.confidence ? Math.round(item.confidence * 100) : '?'}%
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-200">{item.disease_class?.replace(/_/g, " ")}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'} •{' '}
                            {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString() : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`hidden sm:block px-3 py-1 rounded-full text-xs font-medium border ${item.disease_class?.includes('Healthy') ? 'bg-green-900/20 text-green-400 border-green-800/50' : 'bg-red-900/20 text-red-400 border-red-800/50'}`}>
                          {item.disease_class?.includes('Healthy') ? 'Healthy' : 'Disease'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}
                          className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB: INFO --- */}
        {currentTab === 'info' && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-gray-900 rounded-3xl shadow-xl border border-gray-800 p-8">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-white mb-2">About Plant Doctor AI</h2>
                <p className="text-gray-400 max-w-lg mx-auto">An intelligent system designed to help farmers and gardeners detect plant diseases instantly using computer vision.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" /> How it works
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Our system uses a Deep Learning CNN trained on thousands of plant leaf images. When you upload a photo, the AI analyzes pixel patterns to identify disease signatures.
                  </p>
                  {/* FIX: Updated to reflect that auto-detect is removed */}
                  <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl p-4">
                    <p className="text-yellow-400 text-xs font-semibold mb-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Important
                    </p>
                    <p className="text-yellow-300/80 text-xs leading-relaxed">
                      Always select the correct crop type before scanning. Tomato and potato leaves look very similar — selecting the right plant ensures the AI compares against the correct disease classes.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-500" /> Supported Diseases
                  </h3>
                  <ul className="text-gray-400 text-sm space-y-2 list-disc pl-4 marker:text-gray-600">
                    <li>Potato Early Blight</li>
                    <li>Potato Late Blight</li>
                    <li>Healthy Potato Leaves</li>
                    <li>Tomato Bacterial Spot</li>
                    <li>Tomato Early / Late Blight</li>
                    <li>Tomato Leaf Mold</li>
                    <li className="text-gray-600">(More crops coming soon)</li>
                  </ul>
                </div>
              </div>

              <div className="mt-10 bg-gray-950 rounded-2xl p-6 border border-gray-800">
                <h3 className="font-bold text-green-500 mb-3">User Guide</h3>
                <ol className="list-decimal pl-5 space-y-2 text-gray-300 text-sm marker:text-green-500">
                  <li><strong className="text-white">Select your crop type first</strong> — Tomato or Potato.</li>
                  <li>Ensure the leaf is well-lit and in the center of the frame.</li>
                  <li>Avoid blurry or extremely dark images for best accuracy.</li>
                  <li>Navigate to the <strong className="text-white">History</strong> tab to track disease spread over time.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

      </main>

      <footer className="bg-gray-900 border-t border-gray-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Leaf className="w-6 h-6 text-green-500" />
                <span className="font-bold text-xl text-white">Plant Doctor AI</span>
              </div>
              <p className="text-gray-400 text-sm">Empowering farmers and gardeners with AI-driven plant disease detection.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Contact Us</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-green-500" /><span>support@plantdoctor.ai</span></li>
                <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-green-500" /><span>+91 8218187829</span></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Customer Service</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => setCurrentTab('info')} className="hover:text-green-400 transition-colors text-left">Help Center</button></li>
                <li><button className="hover:text-green-400 transition-colors text-left">Terms of Service</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Plant Doctor AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}