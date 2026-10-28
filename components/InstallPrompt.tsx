import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor, X, Info, ExternalLink, CheckCircle2, Loader2, Sparkles, Share, PlusSquare } from 'lucide-react';

interface InstallPromptProps {
  label?: string;
  appType?: 'pdv' | 'atendente' | 'entregador' | 'cardapio' | 'general';
  className?: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPrompt({ label, appType = 'general', className }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    // 1. Detect if running as installed standalone PWA
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // 2. Detect iOS (Safari doesn't support beforeinstallprompt)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 3. Detect if running inside an iframe (browsers block beforeinstallprompt in iframes)
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }

    // 4. Check global beforeinstallprompt captured early in index.html
    if ((window as any).deferredPWAInstallPrompt) {
      setDeferredPrompt((window as any).deferredPWAInstallPrompt);
      setIsInstallable(true);
    }

    const onPromptAvailable = (e: any) => {
      const promptEvent = e.detail || (window as any).deferredPWAInstallPrompt;
      if (promptEvent) {
        setDeferredPrompt(promptEvent);
        setIsInstallable(true);
      }
    };

    const onAppInstalled = () => {
      setIsStandalone(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      (window as any).deferredPWAInstallPrompt = null;
      setInstallSuccess(true);
      setShowGuideModal(false);
      setTimeout(() => setInstallSuccess(false), 5000);
    };

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).deferredPWAInstallPrompt = e;
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('pwa-prompt-available', onPromptAvailable);
    window.addEventListener('pwa-installed', onAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('pwa-prompt-available', onPromptAvailable);
      window.removeEventListener('pwa-installed', onAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const getStoreSlug = () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      let loja = urlParams.get('loja') || '';
      if (!loja && window.location.hash.includes('loja=')) {
        const hashParts = window.location.hash.split('?');
        if (hashParts[1]) {
          const hashParams = new URLSearchParams(hashParts[1]);
          loja = hashParams.get('loja') || '';
        }
      }
      if (!loja) {
        loja = localStorage.getItem('last_store_slug') || localStorage.getItem('storeSlug') || '';
      }
      return loja;
    } catch (e) {
      return '';
    }
  };

  const syncCurrentManifest = () => {
    try {
      const loja = getStoreSlug();
      const manifestEl = document.getElementById('app-manifest');
      if (manifestEl) {
        const params = new URLSearchParams();
        if (appType && appType !== 'general') params.set('type', appType);
        if (loja) params.set('loja', loja);
        const targetHref = '/manifest.json' + (params.toString() ? '?' + params.toString() : '');
        if (manifestEl.getAttribute('href') !== targetHref) {
          manifestEl.setAttribute('href', targetHref);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    syncCurrentManifest();
  }, [appType]);

  const getTargetStandaloneUrl = () => {
    let route = window.location.hash || '';
    if (!route || route === '#/') {
      if (appType === 'pdv') route = '#/pdv';
      else if (appType === 'atendente') route = '#/atendimento';
      else if (appType === 'entregador') route = '#/entregas';
      else if (appType === 'cardapio') route = '#/cardapio';
    }
    const origin = window.location.origin;
    const urlParams = new URLSearchParams(window.location.search);
    const loja = getStoreSlug();
    if (loja) {
      urlParams.set('loja', loja);
    }
    if (appType && appType !== 'general') {
      urlParams.set('type', appType);
    }
    urlParams.set('auto_install', '1');
    return `${origin}/?${urlParams.toString()}${route}`;
  };

  const handleInstallClick = async () => {
    syncCurrentManifest();
    const promptEvent: BeforeInstallPromptEvent | null = 
      deferredPrompt || 
      (window as any).deferredPWAInstallPrompt ||
      (window.top && (window.top as any).deferredPWAInstallPrompt);

    // 1. If native deferred prompt is available in browser memory, trigger it DIRECTLY on click!
    if (promptEvent && typeof promptEvent.prompt === 'function') {
      try {
        setIsInstalling(true);
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsInstallable(false);
          setDeferredPrompt(null);
          (window as any).deferredPWAInstallPrompt = null;
          setInstallSuccess(true);
          setShowGuideModal(false);
          setTimeout(() => setInstallSuccess(false), 5000);
          setIsInstalling(false);
          return;
        }
        setIsInstalling(false);
        return;
      } catch (err) {
        console.error('[PWA] Error calling prompt():', err);
        setIsInstalling(false);
      }
    }

    // 2. If running inside an iframe (e.g. AI Studio preview environment),
    // modern browsers prohibit the install prompt inside frames.
    // We open directly in top window / new tab with auto_install=1 which immediately triggers native prompt on load!
    if (isInIframe) {
      try {
        const fullUrl = getTargetStandaloneUrl();
        const win = window.open(fullUrl, '_blank');
        if (win) {
          // Opened successfully
          setInstallSuccess(true);
          setTimeout(() => setInstallSuccess(false), 4000);
          return;
        }
      } catch (e) {
        console.warn('[PWA] Fallback to modal due to popup policy:', e);
      }
      setShowGuideModal(true);
      return;
    }

    // 3. If running on iOS Safari, WebKit has no prompt() API, so open iOS installation guide
    if (isIOS) {
      setShowGuideModal(true);
      return;
    }

    // 4. On Desktop or Android outside an iframe where prompt hasn't arrived yet:
    // Try waiting up to 600ms for event or display direct action modal
    setIsInstalling(true);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        setIsInstalling(false);
        setShowGuideModal(true);
      }
    }, 700);

    const checkInterval = setInterval(async () => {
      const activePrompt = (window as any).deferredPWAInstallPrompt;
      if (activePrompt && typeof activePrompt.prompt === 'function') {
        resolved = true;
        clearInterval(checkInterval);
        clearTimeout(timeout);
        try {
          await activePrompt.prompt();
          const choice = await activePrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            setInstallSuccess(true);
            setTimeout(() => setInstallSuccess(false), 5000);
          }
        } catch (e) {
          console.warn('[PWA] Install prompt exception:', e);
        } finally {
          setIsInstalling(false);
        }
      }
    }, 150);
  };

  // If already running as an installed standalone app, do not show the install button
  if (isStandalone) {
    return null;
  }

  // Display name by app type
  const defaultLabel = (() => {
    if (label) return label;
    switch (appType) {
      case 'pdv': return 'Instalar PDV';
      case 'atendente': return 'Instalar Atendente';
      case 'entregador': return 'Instalar Entregas';
      case 'cardapio': return 'Instalar Cardápio';
      default: return 'Instalar App';
    }
  })();

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={className || "flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm active:scale-95 shrink-0 disabled:opacity-75"}
        title="Instalar Aplicativo no Dispositivo com 1 Clique"
      >
        {isInstalling ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        <span>{isInstalling ? 'Instalando...' : defaultLabel}</span>
      </button>

      {/* Toast when install succeeds */}
      {installSuccess && (
        <div className="fixed bottom-6 right-6 z-[99999] bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in border border-emerald-400">
          <CheckCircle2 size={22} className="text-white shrink-0" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider">Instalação Iniciada!</p>
            <p className="text-[11px] opacity-90">O atalho do aplicativo foi configurado para seu dispositivo.</p>
          </div>
        </div>
      )}

      {showGuideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-scale-up text-slate-800">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-emerald-600 to-green-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl">
                  <Download size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Instalar {defaultLabel.replace('Instalar ', '')}</h3>
                  <p className="text-xs text-white/80">Instale diretamente para usar em tela cheia como app nativo</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 hover:bg-white/15 rounded-full transition-colors text-white"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Direct 1-Click Action */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-sm">Instalação Direta com 1 Clique</h4>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                      Clique no botão abaixo para abrir e confirmar a instalação direta no seu celular ou computador sem complicações:
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const targetUrl = getTargetStandaloneUrl();
                    window.open(targetUrl, '_blank');
                    setShowGuideModal(false);
                  }}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  <Sparkles size={16} /> Instalar Diretamente Agora
                </button>
              </div>

              {/* Notice */}
              <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-800">
                <Info size={18} className="shrink-0 mt-0.5 text-blue-600" />
                <p className="font-medium leading-relaxed">
                  Ao instalar o aplicativo, você tem carregamento instantâneo, funcionamento sem barra de navegador e atalho exclusivo na sua tela inicial.
                </p>
              </div>

              {/* Instructions by Device */}
              <div className="space-y-3">
                {/* Android / Chrome */}
                {!isIOS && (
                  <div className="flex gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 items-start">
                    <div className="p-2.5 bg-green-100 text-green-700 rounded-xl shrink-0">
                      <Smartphone size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Android (Chrome / Edge / Samsung)</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Toque no menu de <strong className="text-slate-900 font-extrabold">três pontos (⋮)</strong> do navegador e selecione <strong className="text-slate-900 font-extrabold">"Instalar aplicativo"</strong> ou <strong className="text-slate-900 font-extrabold">"Adicionar à tela inicial"</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* iOS / Safari */}
                <div className="flex gap-3.5 p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 items-start">
                  <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shrink-0">
                    <Share size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wide">iPhone / iPad (Safari)</h4>
                    <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                      1. Toque no botão <strong className="text-blue-950 font-extrabold">Compartilhar</strong> (ícone de quadrado com seta para cima na barra inferior).<br />
                      2. Role para baixo e toque em <strong className="text-blue-950 font-extrabold flex items-center gap-1 mt-1 inline-flex"><PlusSquare size={13} /> Adicionar à Tela de Início</strong>.
                    </p>
                  </div>
                </div>

                {/* PC / Computador */}
                {!isIOS && (
                  <div className="flex gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 items-start">
                    <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl shrink-0">
                      <Monitor size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Computador (Windows / Mac)</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Clique no ícone de <strong className="text-slate-900 font-extrabold">instalar (⊕ ou monitor com seta)</strong> na barra de endereços do Chrome/Edge ou acerte no botão acima.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button 
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
