import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor, X, Info } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed app)
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    setIsStandalone(isStandaloneMode);

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
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } else {
      // Show custom step-by-step installation guide if native installer is unavailable
      setShowGuideModal(true);
    }
  };

  // If already installed/standalone, do not render anything
  if (isStandalone) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm active:scale-95 shrink-0"
        title="Instalar Aplicativo"
      >
        <Download size={16} />
        <span>Instalar App</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-fade-in text-slate-800">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Download size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Como Instalar o App</h3>
                  <p className="text-xs text-white/80">Adicione um atalho em sua tela inicial</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 hover:bg-white/15 rounded-full transition-colors text-white"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Notice */}
              <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
                <Info size={20} className="shrink-0 mt-0.5 text-blue-500" />
                <p className="font-medium leading-relaxed">
                  Ao instalar, você terá acesso imediato com melhor desempenho diretamente da sua tela inicial, sem precisar abrir o navegador toda vez.
                </p>
              </div>

              {/* Instructions by Device */}
              <div className="space-y-4">
                {/* Android / Chrome */}
                <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="p-3 bg-green-100 text-green-700 rounded-xl h-11 w-11 flex items-center justify-center shrink-0">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Dispositivos Android (Chrome)</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Toque no ícone de <strong className="text-slate-700">três pontos (⋮)</strong> no canto superior direito do navegador e selecione <strong className="text-slate-700">"Instalar aplicativo"</strong> ou <strong className="text-slate-700">"Adicionar à tela inicial"</strong>.
                    </p>
                  </div>
                </div>

                {/* iOS / Safari */}
                <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="p-3 bg-blue-100 text-blue-700 rounded-xl h-11 w-11 flex items-center justify-center shrink-0">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Dispositivos iOS (iPhone / Safari)</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Toque no botão de <strong className="text-slate-700">Compartilhar</strong> (ícone de seta para cima) na barra inferior e selecione <strong className="text-slate-700">"Adicionar à Tela de Início"</strong>.
                    </p>
                  </div>
                </div>

                {/* PC / Computador */}
                <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="p-3 bg-purple-100 text-purple-700 rounded-xl h-11 w-11 flex items-center justify-center shrink-0">
                    <Monitor size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Computador (Chrome / Edge / Opera)</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Clique no <strong className="text-slate-700">ícone de computador com uma seta</strong> que aparece no lado direito da barra de endereços (perto da estrela de favoritos), ou selecione <strong className="text-slate-700">Instalar página como app</strong> no menu do navegador.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
