/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { Play, Check, X, LogOut, Edit2, ArrowRight, Sparkles, Upload, CreditCard, Eye, Loader2, HardDrive, Trash, Plus, Download, Shield, Tv, Globe } from 'lucide-react';

const API_BASE_URL = 'https://stream-me-api.onrender.com';
const KKIAPAY_PUBLIC_KEY = 'YOUR_KKIAPAY_PUBLIC_KEY';
const KKIAPAY_SANDBOX = true;
const TOKEN_KEY = 'streamme_token';
const STORAGE_LIMIT_STANDARD = 20;
const STORAGE_LIMIT_PREMIUM = 999;

const StorageManager = {
  async init() {
    return new Promise((resolve) => {
      const req = indexedDB.open('StreamMeDB', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('downloads')) {
          db.createObjectStore('downloads', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  },
  async saveDownload(id, data, blob) {
    const db = await this.init();
    const tx = db.transaction('downloads', 'readwrite');
    const store = tx.objectStore('downloads');
    await store.put({ id, data, blob, downloadedAt: Date.now(), size: blob.size });
  },
  async listDownloads() {
    const db = await this.init();
    return new Promise((resolve) => {
      const req = db.transaction('downloads').objectStore('downloads').getAll();
      req.onsuccess = () => resolve(req.result);
    });
  },
  async deleteDownload(id) {
    const db = await this.init();
    const tx = db.transaction('downloads', 'readwrite');
    await tx.objectStore('downloads').delete(id);
  },
  getTotalSize(downloads) {
    return downloads.reduce((sum, d) => sum + (d.size || 0), 0);
  },
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
};

const api = {
  getToken: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  setToken: (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} },
  async call(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = api.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      return data;
    } catch (e) {
      throw new Error('Erreur réseau');
    }
  },
  signup: (b) => api.call('POST', '/api/auth/signup', b),
  login: (b) => api.call('POST', '/api/auth/login', b),
  me: () => api.call('GET', '/api/auth/me'),
  listProfiles: () => api.call('GET', '/api/profiles'),
  createProfile: (b) => api.call('POST', '/api/profiles', b),
  listCatalog: () => api.call('GET', '/api/catalog?limit=200'),
  getWatchlist: (pid) => api.call('GET', `/api/catalog/profiles/${pid}/watchlist`),
  addToList: (pid, cid) => api.call('POST', `/api/catalog/profiles/${pid}/watchlist/${cid}`),
  removeFromList: (pid, cid) => api.call('DELETE', `/api/catalog/profiles/${pid}/watchlist/${cid}`),
  adminCreate: (b) => api.call('POST', '/api/admin/content', b),
  adminDelete: (id) => api.call('DELETE', `/api/admin/content/${id}`),
};

const PROFILES_COLORS = [
  ['#EF4444', '#7C2D12'], ['#3B82F6', '#0C4A6E'], ['#10B981', '#064E3B'],
  ['#EC4899', '#831843'], ['#A855F7', '#3B0764'], ['#06B6D4', '#164E63'],
];

const formatSize = (bytes) => StorageManager.formatSize(bytes);

const Logo = ({ size = 'md' }) => {
  const sizes = { sm: 'text-xl', md: 'text-2xl', lg: 'text-5xl md:text-7xl' };
  return (
    <div className={`${sizes[size]} font-black tracking-tighter inline-flex items-baseline`} style={{ fontFamily: 'system-ui' }}>
      <span className="text-red-500">STREAM</span><span className="text-white opacity-90">·</span><span className="text-white">ME</span>
    </div>
  );
};

const Poster = ({ item, size = 'card' }) => {
  const heights = { card: 'h-48 sm:h-52', detail: 'h-72' };
  const c1 = item.poster_color_1 || '#EF4444';
  const c2 = item.poster_color_2 || '#7C2D12';
  return (
    <div className={`${heights[size]} w-full rounded-md overflow-hidden relative`} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
      <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/90 to-transparent">
        <div className="text-[10px] tracking-widest uppercase opacity-70 mb-1 text-red-200">{item.genre}</div>
        <div className="text-white font-bold text-sm md:text-base">{item.title}</div>
      </div>
    </div>
  );
};

const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-blue-500' };
  return <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 ${colors[type]} text-white px-5 py-3 rounded-lg shadow-2xl max-w-md text-sm font-medium`}>{message}</div>;
};

const DownloadsManager = ({ onClose, user, showToast }) => {
  const [downloads, setDownloads] = useState([]);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    (async () => {
      const list = await StorageManager.listDownloads();
      setDownloads(list.sort((a, b) => b.downloadedAt - a.downloadedAt));
      setTotalSize(StorageManager.getTotalSize(list));
    })();
  }, []);

  const handleDelete = async (id) => {
    await StorageManager.deleteDownload(id);
    const updated = downloads.filter(d => d.id !== id);
    setDownloads(updated);
    setTotalSize(StorageManager.getTotalSize(updated));
    showToast('Vidéo supprimée', 'info');
  };

  const limit = user.subscription_plan === 'premium' ? STORAGE_LIMIT_PREMIUM : STORAGE_LIMIT_STANDARD;

  return (
    <div className="fixed inset-0 z-40 bg-black overflow-y-auto">
      <div className="sticky top-0 bg-black/95 backdrop-blur border-b border-white/10 px-4 md:px-12 py-4 flex items-center justify-between z-10">
        <div>
          <h1 className="text-2xl font-bold text-white">Mes téléchargements</h1>
          <p className="text-xs text-white/50">{downloads.length} / {limit} vidéos • {formatSize(totalSize)}</p>
        </div>
        <button onClick={onClose} className="text-white hover:text-red-400"><X size={28} /></button>
      </div>
      <div className="max-w-5xl mx-auto p-4 md:p-12">
        {downloads.length === 0 ? (
          <p className="text-white/60 text-center py-12">Aucune vidéo téléchargée</p>
        ) : (
          <div className="space-y-3">
            {downloads.map((d) => (
              <div key={d.id} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="w-20 h-20 rounded flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-700"></div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">{d.data?.title || 'Vidéo'}</h3>
                  <div className="text-xs text-white/50">{formatSize(d.size)}</div>
                </div>
                <button onClick={() => handleDelete(d.id)} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded">
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const BrowseApp = ({ user, catalog, profile, onSwitchProfile, onLogout, showToast }) => {
  const [downloadsMgrOpen, setDownloadsMgrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const wl = await api.getWatchlist(profile.id);
        setWatchlist(wl.map(x => x.id));
      } catch {}
    })();
  }, [profile.id]);

  const toggleWatchlist = async (id) => {
    const inList = watchlist.includes(id);
    setWatchlist(prev => inList ? prev.filter(x => x !== id) : [...prev, id]);
    try {
      if (inList) await api.removeFromList(profile.id, id);
      else await api.addToList(profile.id, id);
    } catch (e) {
      setWatchlist(prev => inList ? [...prev, id] : prev.filter(x => x !== id));
      showToast(e.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/90 to-transparent px-4 md:px-12 py-4 flex items-center justify-between">
        <Logo size="md" />
        <div className="flex items-center gap-3 relative">
          <button onClick={() => setDownloadsMgrOpen(true)} className="text-white/80 hover:text-blue-400">
            <HardDrive size={20} />
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm hover:ring-2 ring-red-500"
            style={{ background: `linear-gradient(135deg, ${PROFILES_COLORS[0][0]}, ${PROFILES_COLORS[0][1]})` }}>
            {profile.name[0].toUpperCase()}
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-neutral-950 border border-white/10 rounded-lg shadow-2xl py-2 z-50">
              <button onClick={onSwitchProfile} className="w-full text-left px-4 py-2 text-white/80 hover:bg-white/5 flex items-center gap-2 text-sm"><Edit2 size={16} /> Changer</button>
              <button onClick={onLogout} className="w-full text-left px-4 py-2 text-white/80 hover:bg-white/5 flex items-center gap-2 text-sm border-t border-white/10 mt-1 pt-2"><LogOut size={16} /> Déco</button>
            </div>
          )}
        </div>
      </header>
      <div className="pt-24 pb-20 px-4 md:px-12">
        <h1 className="text-3xl font-bold text-white mb-6 mt-12">Catalogue</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {catalog.map(item => (
            <button key={item.id} onClick={() => toggleWatchlist(item.id)} className="hover:scale-105 transition-transform group relative">
              <Poster item={item} size="card" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                <Play size={32} className="text-white" fill="white" />
              </div>
              {watchlist.includes(item.id) && (
                <div className="absolute top-2 right-2 bg-red-500 rounded-full p-1"><Check size={16} className="text-white" /></div>
              )}
            </button>
          ))}
        </div>
      </div>
      {downloadsMgrOpen && <DownloadsManager onClose={() => setDownloadsMgrOpen(false)} user={user} showToast={showToast} />}
    </div>
  );
};

const AuthScreen = ({ mode, onSubmit, onSwitch, onBack, showToast }) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (!email.match(/^[^@]+@[^@]+\.[^@]+$/)) { showToast('Email invalide', 'error'); return; }
    if (pass.length < 6) { showToast('Min 6 caractères', 'error'); return; }
    if (mode === 'signup' && !name.trim()) { showToast('Nom requis', 'error'); return; }
    setLoading(true);
    try {
      await onSubmit({ email: email.toLowerCase(), password: pass, name });
    } catch (err) {
      showToast(err.message, 'error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative">
      <button onClick={onBack} className="absolute top-6 left-6 text-white/60 hover:text-white text-sm">← Retour</button>
      <div className="w-full max-w-md bg-neutral-950/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
        <div className="text-center mb-6"><Logo size="md" /></div>
        <h2 className="text-2xl font-bold text-white mb-6 text-center">{mode === 'signup' ? 'Créer un compte' : 'Connexion'}</h2>
        <form onSubmit={handle} className="space-y-3">
          {mode === 'signup' && <input type="text" placeholder="Nom" value={name} onChange={e => setName(e.target.value)} disabled={loading} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:border-red-500 focus:outline-none" />}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:border-red-500 focus:outline-none" />
          <input type="password" placeholder="Mot de passe" value={pass} onChange={e => setPass(e.target.value)} disabled={loading} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:border-red-500 focus:outline-none" />
          <button type="submit" disabled={loading} className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-3 rounded-lg font-bold">{loading ? '...' : mode === 'signup' ? "S'inscrire" : 'Connexion'}</button>
        </form>
        <p className="text-center text-sm text-white/60 mt-6">{mode === 'signup' ? 'Déjà inscrit ?' : 'Pas inscrit ?'} <button onClick={onSwitch} className="text-red-400 hover:underline">{mode === 'signup' ? 'Connexion' : "S'inscrire"}</button></p>
      </div>
    </div>
  );
};

const ProfilePicker = ({ profiles, onSelect, onLogout }) => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
    <Logo size="md" />
    <h1 className="text-5xl text-white font-bold mt-8 mb-12">Qui regarde ?</h1>
    <div className="flex flex-wrap justify-center gap-6 mb-10">
      {profiles.map((p, i) => {
        const [c1, c2] = PROFILES_COLORS[i % PROFILES_COLORS.length];
        return (
          <button key={p.id} onClick={() => onSelect(p)} className="group text-center">
            <div className="w-32 h-32 rounded-xl flex items-center justify-center text-5xl font-black text-white mb-2 group-hover:ring-4 ring-red-500 transition-all" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>{p.name[0].toUpperCase()}</div>
            <div className="text-white/80">{p.name}</div>
          </button>
        );
      })}
    </div>
    <button onClick={onLogout} className="text-white/60 hover:text-white border border-white/20 px-4 py-2 rounded text-sm">Déconnecter</button>
  </div>
);

const LandingPage = ({ onSignIn, onSignUp }) => (
  <div className="min-h-screen bg-black text-white overflow-x-hidden">
    <header className="fixed top-0 left-0 right-0 z-30 px-4 md:px-12 py-4 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent">
      <Logo size="md" />
      <button onClick={onSignIn} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded font-semibold">Connexion</button>
    </header>
    <section className="relative min-h-screen flex items-center justify-center px-4 pt-20">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top right, rgba(239,68,68,0.25) 0%, transparent 50%), #000' }} />
      <div className="relative text-center max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 mb-6">
          <Sparkles size={14} className="text-red-400" /><span className="text-xs text-red-400 uppercase">Streaming Nouvelle Génération</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">Films & séries,<br /><span className="text-red-500">illimités.</span></h1>
        <p className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto">Regardez en ligne ou hors ligne. Gratuit, sur abonnement, ou à la carte. Mobile Money.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={onSignUp} className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-md font-bold text-lg flex items-center justify-center gap-2">Commencer <ArrowRight size={20} /></button>
          <button onClick={onSignIn} className="text-white/80 hover:text-white px-6 py-4">Connexion →</button>
        </div>
      </div>
    </section>
    <section className="py-20 px-4 md:px-12 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-16">Pourquoi <span className="text-red-500">STREAM·ME</span> ?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { t: 'Sur tous vos écrans', d: 'TV, mobile, tablette, ordinateur.' },
            { t: 'Regardez hors-ligne', d: 'Téléchargez et regardez sans connexion.' },
            { t: 'Sans publicité', d: 'Expérience pure sans interruption.' },
            { t: 'Catalogue mondial', d: 'Milliers de films et séries en HD/4K.' },
            { t: 'Mobile Money & Carte', d: 'MTN, Moov, Orange ou carte bancaire.' },
            { t: 'Streaming rapide', d: "Optimisé pour l'Afrique." },
          ].map((f, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-red-500/50 transition-colors">
              <h3 className="text-xl font-bold mb-2">{f.t}</h3>
              <p className="text-white/60">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
    <section className="py-20 px-4 md:px-12 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-12">Choisissez votre formule</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { name: 'Essentiel', price: 2500 },
            { name: 'Standard', price: 4500, popular: true },
            { name: 'Premium', price: 7500 },
          ].map((p) => (
            <div key={p.name} className={`relative rounded-xl p-6 ${p.popular ? 'bg-gradient-to-br from-red-500/20 to-orange-600/10 border-2 border-red-500' : 'bg-white/5 border border-white/10'}`}>
              {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAIRE</div>}
              <h3 className="text-2xl font-bold mb-2">{p.name}</h3>
              <div className="mb-6"><span className="text-4xl font-black">{p.price.toLocaleString('fr-FR')}</span><span className="text-white/60 ml-1">FCFA</span></div>
              <button onClick={onSignUp} className={`w-full py-3 rounded font-semibold transition-colors ${p.popular ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}>Choisir</button>
            </div>
          ))}
        </div>
      </div>
    </section>
    <footer className="border-t border-white/10 py-12 px-4 text-center">
      <Logo size="sm" />
      <p className="text-white/40 text-xs mt-6">© 2026 Stream·Me</p>
    </footer>
  </div>
);

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => setToast({ message, type, id: Date.now() });

  useEffect(() => {
    (async () => {
      try { const c = await api.listCatalog(); setCatalog(c); } catch (e) { console.error(e); }
      const token = api.getToken();
      if (token) {
        try {
          const u = await api.me();
          setUser(u);
          const p = await api.listProfiles();
          setProfiles(p);
          setScreen(p.length > 0 ? 'profiles' : 'landing');
        } catch { api.setToken(null); setScreen('landing'); }
      } else { setScreen('landing'); }
    })();
  }, []);

  const handleSignup = async (data) => {
    const { user: u, token } = await api.signup(data);
    api.setToken(token); setUser(u);
    const p = await api.listProfiles(); setProfiles(p);
    showToast(`Bienvenue ${u.name} !`, 'success');
    setScreen(p.length > 0 ? 'profiles' : 'landing');
  };

  const handleLogin = async (data) => {
    const { user: u, token } = await api.login(data);
    api.setToken(token); setUser(u);
    const p = await api.listProfiles(); setProfiles(p);
    showToast(`Bon retour ${u.name} !`, 'success');
    setScreen(p.length > 0 ? 'profiles' : 'landing');
  };

  const logout = () => {
    api.setToken(null); setUser(null); setProfiles([]); setActiveProfile(null);
    setScreen('landing'); showToast('Déconnecté', 'info');
  };

  if (screen === 'loading') return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-500" size={32} /></div>;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        ::-webkit-scrollbar { display: none; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      {screen === 'landing' && <LandingPage onSignIn={() => setScreen('login')} onSignUp={() => setScreen('signup')} />}
      {screen === 'login' && <AuthScreen mode="login" onSubmit={handleLogin} onSwitch={() => setScreen('signup')} onBack={() => setScreen('landing')} showToast={showToast} />}
      {screen === 'signup' && <AuthScreen mode="signup" onSubmit={handleSignup} onSwitch={() => setScreen('login')} onBack={() => setScreen('landing')} showToast={showToast} />}
      {screen === 'profiles' && user && <ProfilePicker profiles={profiles} onSelect={(p) => { setActiveProfile(p); setScreen('browse'); }} onLogout={logout} />}
      {screen === 'browse' && user && activeProfile && <BrowseApp user={user} catalog={catalog} profile={activeProfile} onSwitchProfile={() => setScreen('profiles')} onLogout={logout} showToast={showToast} />}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
