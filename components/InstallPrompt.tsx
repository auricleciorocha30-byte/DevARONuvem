import React, { useState, useEffect } from 'react';
import { Download, Smartphone } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

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

  if (!isInstallable && !isIOS) return null;

  return (
    <button
      onClick={isInstallable ? handleInstallClick : () => alert('Para instalar no iOS, toque no botão de compartilhar e depois em "Adicionar à Tela de Início".')}
      className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-bold transition-colors"
      title="Instalar Aplicativo"
    >
      {isIOS ? <Smartphone size={16} /> : <Download size={16} />}
      <span className="hidden md:inline">Instalar App</span>
    </button>
  );
}
