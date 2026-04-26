
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Lock, 
  LogIn, 
  Loader2, 
  AlertCircle, 
  ShieldCheck, 
  Mail, 
  Smartphone,
  ChefHat,
  UserRound,
  Tv,
  Store,
  ArrowRight,
  Monitor,
  Download,
  Share,
  PlusSquare,
  QrCode,
  Truck
} from 'lucide-react';

interface Props {
  onLoginSuccess: (user: any) => void;
  onGoogleLogin?: () => Promise<void>;
  isGoogleAuthenticated?: boolean;
}

export default function LoginPage({ onLoginSuccess, onGoogleLogin, isGoogleAuthenticated }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'hub' | 'login'>('hub');
  
  useEffect(() => {
    if (searchParams.get('view') === 'login') {
      setView('login');
    }
    if (searchParams.get('role') === 'entregador') {
      setView('login');
      setIntendedDestination('/entregas');
    }
    if (searchParams.get('role') === 'atendente') {
      setView('login');
      setIntendedDestination('/atendimento');
    }
  }, [searchParams]);

  const [intendedDestination, setIntendedDestination] = useState<string | null>(null);
  
  const storeSlug = searchParams.get('loja');
  const lojaParam = storeSlug ? `?loja=${storeSlug}` : '';

  // PWA Install Logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [storeSettings, setStoreSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      if (storeSlug) {
        const { data } = await supabase.from('store_profiles').eq('slug', storeSlug).maybeSingle();
        if (data) {
          setCurrentStoreId(data.id);
          if (data.settings) {
            setStoreSettings(data.settings);
          }
        }
      }
    };
    fetchSettings();
  }, [storeSlug]);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let currentStoreId = null;
      if (storeSlug) {
        // Ensure we are on Main DB to fetch profile
        (supabase as any).disconnectStore();
        
        const { data: storeData } = await supabase.from('store_profiles').eq('slug', storeSlug).maybeSingle();
        
        if (storeData) {
            currentStoreId = storeData.id;
            // Connect to specific DB if configured
            if (storeData.dbUrl && storeData.dbAuthToken) {
                (supabase as any).connectToStore(storeData.dbUrl, storeData.dbAuthToken);
            }
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
        store_id: currentStoreId
      });

      if (authError) throw authError;

      if (authData.user) {
        const userData = {
          id: authData.user.id,
          name: authData.user.email || 'Usuário',
          role: authData.user.role,
          store_id: (authData.user as any).store_id
        };
        
        onLoginSuccess(userData);

        if (intendedDestination) {
          navigate(`${intendedDestination}${lojaParam}`);
        } else {
          if (userData.role === 'GERENTE') navigate(`/${lojaParam}`);
          else if (userData.role === 'ENTREGADOR') navigate(`/entregas${lojaParam}`);
          else navigate(`/atendimento${lojaParam}`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  const handlePortalAction = (target: string, requiresAuth: boolean) => {
    if (requiresAuth) {
      const session = localStorage.getItem('gc-conveniencia-session-v1');
      if (session) {
        try {
            const user = JSON.parse(session);
            
            // Security: Check if user belongs to this store
            if (currentStoreId && user.store_id !== currentStoreId) {
                // Wrong store session. Treat as not logged in for this portal.
                setIntendedDestination(target);
                setView('login');
                return;
            }
            
            // PDV: Apenas Gerente e Atendente
            if (target === '/pdv') {
                if (user.role !== 'GERENTE' && user.role !== 'ATENDENTE') {
                    alert('Acesso ao PDV restrito a Gerentes e Atendentes.');
                    return;
                }
            }
            
            // Entregas: Apenas Gerente e Entregador
            if (target === '/entregas') {
                if (user.role !== 'GERENTE' && user.role !== 'ENTREGADOR') {
                    alert('Acesso ao Painel de Entregas restrito a Gerentes e Entregadores.');
                    return;
                }
            }

            // Atendimento: Apenas Gerente e Atendente
            if (target === '/atendimento') {
                if (user.role !== 'GERENTE' && user.role !== 'ATENDENTE') {
                    alert('Acesso ao Painel de Atendimento restrito a Gerentes e Atendentes.');
                    return;
                }
            }

            navigate(`${target}${lojaParam}`);
        } catch (e) {
            localStorage.removeItem('gc-conveniencia-session-v1');
            setIntendedDestination(target);
            setView('login');
        }
      } else {
        setIntendedDestination(target);
        setView('login');
        if (target === '/entregas') {
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.set('role', 'entregador');
          navigate({ search: newSearchParams.toString() }, { replace: true });
        } else if (target === '/atendimento') {
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.set('role', 'atendente');
          navigate({ search: newSearchParams.toString() }, { replace: true });
        }
      }
    } else {
      navigate(`${target}${lojaParam}`);
    }
  };

  const PortalButton = ({ icon: Icon, title, description, to, color, requiresAuth }: any) => {
    return (
      <button 
        onClick={() => handlePortalAction(to, requiresAuth)}
        className="group flex items-center gap-5 p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-orange-100 transition-all text-left active:scale-95"
      >
        <div className={`p-4 rounded-2xl ${color} text-white shadow-lg shadow-black/5 group-hover:scale-110 transition-transform`}>
          <Icon size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 leading-none mb-1">{title}</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{description}</p>
        </div>
        <ArrowRight size={20} className="text-gray-200 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
      </button>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff5e1] p-4 md:p-6 relative overflow-hidden text-zinc-900">
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-orange-500 rounded-full opacity-10 blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary rounded-full opacity-10 blur-3xl"></div>

      <div className="bg-white/40 backdrop-blur-md w-full max-w-2xl rounded-[3rem] p-2 shadow-2xl relative z-10 border border-white/20">
        <div className="bg-white rounded-[2.8rem] p-6 md:p-12 space-y-8 md:space-y-10">
          
          <div className="text-center">
            <div className="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-500 text-secondary">
              <Store size={40} />
            </div>
            <h1 className="text-2xl md:text-3xl font-brand font-bold text-primary">
              {intendedDestination === '/entregas' ? 'Portal do Entregador' : 'Portal do Colaborador'}
            </h1>
            <p className="text-xs md:text-sm text-gray-400 mt-2 uppercase font-black tracking-widest">Acesso Unidade: {storeSlug || 'Master'}</p>
          </div>

          {view === 'hub' ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 animate-scale-up">
                <button 
                  onClick={() => { setIntendedDestination('/'); setView('login'); }}
                  className="group flex items-center gap-5 p-6 md:p-8 bg-primary rounded-[2rem] border border-primary/10 shadow-lg text-left active:scale-95 w-full"
                >
                  <div className="p-4 rounded-2xl bg-white/10 text-secondary shadow-lg group-hover:scale-110 transition-transform">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-xl md:text-2xl leading-none mb-1">Gerência</h3>
                    <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Painel Administrativo</p>
                  </div>
                  <ArrowRight size={24} className="text-white/20 group-hover:text-secondary group-hover:translate-x-1 transition-all" />
                </button>
              </div>

              {/* Seção de Instalação PWA Dinâmica */}
              <div className="pt-4 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase font-black tracking-widest text-gray-300">
                    <span className="bg-white px-4">Instalar no Dispositivo</span>
                  </div>
                </div>

                {isInstallable ? (
                  <button 
                    onClick={handleInstallClick}
                    className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-secondary to-orange-400 text-primary rounded-3xl font-bold shadow-xl shadow-orange-500/10 hover:shadow-2xl hover:scale-[1.02] transition-all active:scale-95"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/20 rounded-2xl"><Download size={24} /></div>
                      <div className="text-left">
                        <p className="text-sm font-black uppercase leading-none mb-1">Baixar Aplicativo</p>
                        <p className="text-[10px] opacity-70">Acesso rápido e offline</p>
                      </div>
                    </div>
                    <ArrowRight size={20} />
                  </button>
                ) : isIOS ? (
                  <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2.5rem] space-y-4">
                    <div className="flex items-center gap-3">
                      <Smartphone className="text-blue-600" size={24} />
                      <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Instalar no seu iPhone</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white rounded-2xl border border-blue-100 shadow-sm">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-blue-700">
                        <span>Toque em</span> <Share size={18} className="text-blue-500" />
                      </div>
                      <ArrowRight size={14} className="text-blue-200" />
                      <div className="flex items-center gap-2 text-[11px] font-bold text-blue-700">
                         <span>depois em</span> <PlusSquare size={18} className="text-blue-500" />
                      </div>
                    </div>
                    <p className="text-[10px] text-blue-400 text-center font-bold">"ADICIONAR À TELA DE INÍCIO"</p>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                      Este sistema já está pronto para uso mobile. <br/> Use o navegador Chrome para melhor experiência.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-scale-up">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm animate-shake">
                  <AlertCircle size={18} />
                  <span className="flex-1 font-medium">{error}</span>
                </div>
              )}

              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex items-center gap-3 mb-4">
                <div className="p-2 bg-white rounded-lg text-orange-500 shadow-sm"><Lock size={16} /></div>
                <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest leading-tight">
                  Acesso restrito à unidade: {storeSlug || 'Master'}
                </p>
              </div>

              {onGoogleLogin && !isGoogleAuthenticated && (
                <div className="space-y-4 mb-8">
                  <button
                    type="button"
                    onClick={onGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-all active:scale-95 px-6"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/pickers/google.svg" alt="Google" className="w-5 h-5" />
                    Entrar com Google (Acesso Master)
                  </button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-gray-300">
                      <span className="bg-white px-4">Ou use login de colaborador</span>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-4 tracking-widest">Usuário</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-secondary/20 focus:bg-white transition-all text-gray-700 font-medium"
                      placeholder="Nome de usuário"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-4 tracking-widest">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-secondary/20 focus:bg-white transition-all text-gray-700"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-black/10 disabled:opacity-50 group"
                  >
                    {loading ? <Loader2 className="animate-spin" size={24} /> : (
                      <>
                        Entrar Agora
                        <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                  {intendedDestination !== '/entregas' && (
                    <button 
                      type="button"
                      onClick={() => { setView('hub'); setIntendedDestination(null); setError(null); }}
                      className="w-full py-4 text-gray-400 font-bold text-xs uppercase tracking-[0.2em]"
                    >
                      Voltar ao Portal
                    </button>
                  )}
                </div>
              </form>
              
              {/* Seção de Instalação PWA Dinâmica para Entregador */}
              {intendedDestination === '/entregas' && (
                <div className="pt-4 space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase font-black tracking-widest text-gray-300">
                      <span className="bg-white px-4">Instalar no Dispositivo</span>
                    </div>
                  </div>

                  {isInstallable ? (
                    <button 
                      onClick={handleInstallClick}
                      className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-secondary to-orange-400 text-primary rounded-3xl font-bold shadow-xl shadow-orange-500/10 hover:shadow-2xl hover:scale-[1.02] transition-all active:scale-95"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl"><Download size={24} /></div>
                        <div className="text-left">
                          <p className="text-sm font-black uppercase leading-none mb-1">Baixar Aplicativo</p>
                          <p className="text-[10px] opacity-70">Acesso rápido e offline</p>
                        </div>
                      </div>
                      <ArrowRight size={20} />
                    </button>
                  ) : isIOS ? (
                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2.5rem] space-y-4">
                      <div className="flex items-center gap-3">
                        <Smartphone className="text-blue-600" size={24} />
                        <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Instalar no seu iPhone</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white rounded-2xl border border-blue-100 shadow-sm">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-blue-700">
                          <span>Toque em</span> <Share size={18} className="text-blue-500" />
                        </div>
                        <ArrowRight size={14} className="text-blue-200" />
                        <div className="flex items-center gap-2 text-[11px] font-bold text-blue-700">
                           <span>depois em</span> <PlusSquare size={18} className="text-blue-500" />
                        </div>
                      </div>
                      <p className="text-[10px] text-blue-400 text-center font-bold">"ADICIONAR À TELA DE INÍCIO"</p>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                        Este sistema já está pronto para uso mobile. <br/> Use o navegador Chrome para melhor experiência.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="pt-6 border-t border-gray-100 text-center space-y-4">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">Canais de Suporte</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="https://wa.me/5585987582159" target="_blank" className="flex items-center gap-2 text-[10px] font-bold text-green-500">
                <Smartphone size={14} /> WhatsApp Suporte
              </a>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                <Monitor size={14} /> Central v2.4
              </div>
            </div>
          </div>

        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
}
