
import React, { useMemo, useEffect, useState } from 'react';
import { Order, StoreSettings, Product } from '../types';
import { ChefHat, CheckCircle2, Tv, Flame, Star, Calendar, ShoppingBag, Truck, Utensils } from 'lucide-react';

interface Props {
  orders: Order[];
  settings: StoreSettings;
  products: Product[];
}

const TVBoard: React.FC<Props> = ({ orders, settings, products }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [offerIndex, setOfferIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { preparing, ready } = useMemo(() => {
    const active = orders.filter(o => o.status === 'PREPARANDO' || o.status === 'PRONTO');
    
    const prepList: { label: string, type: string }[] = [];
    const readyList: { label: string, type: string }[] = [];

    active.forEach(o => {
      let label = '';
      const shortId = o.displayId || String(o.id).slice(-3).toUpperCase();
      const firstName = o.customerName ? o.customerName.split(' ')[0].toUpperCase() : null;

      if (o.type === 'MESA') {
        label = `MESA ${o.tableNumber}`;
      } else if (o.type === 'COMANDA') {
        label = `COMANDA ${o.tableNumber}`;
      } else if (o.type === 'BALCAO') {
        label = `BALCÃO ${firstName || shortId}`;
      } else {
        label = `DELIVERY ${firstName || shortId}`;
      }

      const item = { label, type: o.type };
      if (o.status === 'PREPARANDO') prepList.push(item);
      else readyList.push(item);
    });

    const uniquePrep = Array.from(new Map(prepList.map(item => [item.label, item])).values());
    const uniqueReady = Array.from(new Map(readyList.map(item => [item.label, item])).values());

    return {
      preparing: uniquePrep.slice(0, 12),
      ready: uniqueReady.slice(0, 8)
    };
  }, [orders]);
  
  const today = currentTime.getDay();
  
  // Filtra todas as ofertas ativas para o dia de hoje
  const todayOffers = useMemo(() => 
    products.filter(p => p.featuredDay === today && p.isActive), 
    [products, today]
  );

  // Efeito para rotacionar as ofertas a cada 6 segundos
  useEffect(() => {
    if (todayOffers.length <= 1) return;

    const interval = setInterval(() => {
      setOfferIndex((prev) => (prev + 1) % todayOffers.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [todayOffers.length]);

  const todayOffer = todayOffers[offerIndex];

  return (
    <div className="min-h-screen bg-primary text-white p-8 overflow-hidden flex flex-col">
      <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-6">
        <div className="flex items-center gap-6">
          <img src={settings.logoUrl || undefined} className="w-20 h-20 rounded-full border-4 border-secondary shadow-xl" alt="Logo" />
          <div>
            <h1 className="text-4xl font-brand font-bold">{settings.storeName}</h1>
            <p className="text-lg text-secondary uppercase tracking-widest font-medium">Painel de Atendimento</p>
          </div>
        </div>
        <div className="bg-white/5 px-6 py-2 rounded-2xl border border-white/10">
          <p className="text-4xl font-bold font-mono">{currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest">{currentTime.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-8">
        <div className="col-span-8 grid grid-cols-2 gap-8">
          <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10 flex flex-col">
            <div className="flex items-center gap-4 mb-8 text-secondary">
              <ChefHat size={32} />
              <h2 className="text-2xl font-bold uppercase">Em Produção</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {preparing.length === 0 ? <p className="col-span-2 text-center text-white/20 italic">Produção aguardando pedidos...</p> : 
                preparing.map((item, idx) => (
                  <div key={idx} className="p-4 bg-white/5 rounded-2xl flex items-center justify-between border border-white/5 animate-pulse">
                    <span className="text-xl font-bold uppercase tracking-tight truncate mr-2">{item.label}</span>
                    <div className="opacity-40 shrink-0">
                        {item.type === 'MESA' || item.type === 'COMANDA' ? <Utensils size={18}/> : item.type === 'ENTREGA' ? <Truck size={18}/> : <ShoppingBag size={18}/>}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          <div className="bg-secondary rounded-[2.5rem] p-8 shadow-2xl flex flex-col">
            <div className="flex items-center gap-4 mb-8 text-white">
              <CheckCircle2 size={32} />
              <h2 className="text-2xl font-bold uppercase tracking-tight">Retirar / Pronto</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {ready.length === 0 ? <p className="text-center text-white/50 italic py-10">Novas delícias saindo em breve!</p> : 
                ready.map((item, idx) => (
                  <div key={idx} className="p-6 bg-white text-primary rounded-2xl shadow-xl flex items-center justify-between animate-bounce">
                    <span className="text-4xl font-black uppercase tracking-tight">{item.label}</span>
                    <div className="text-secondary">
                        {item.type === 'MESA' || item.type === 'COMANDA' ? <Utensils size={40}/> : item.type === 'ENTREGA' ? <Truck size={40}/> : <ShoppingBag size={40}/>}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        <div className="col-span-4 h-full">
          <div className="bg-gradient-to-b from-yellow-500 to-orange-600 rounded-[2.5rem] p-1 shadow-2xl h-full">
            <div className="rounded-[2.3rem] h-full p-8 flex flex-col items-center text-center" style={{ backgroundColor: settings.primaryColor ? `${settings.primaryColor}E6` : '#3d251eE6' }}>
              <div className="bg-yellow-400 text-primary px-6 py-2 rounded-full font-bold text-sm uppercase mb-6 flex items-center gap-2">
                <Flame size={18} fill="currentColor" /> Recomendação
              </div>
              
              {todayOffer ? (
                <div key={todayOffer.id} className="space-y-6 flex-1 flex flex-col justify-center animate-fade-in transition-all duration-1000">
                  <div className="relative">
                    <img src={todayOffer.imageUrl || undefined} className="w-full aspect-square object-cover rounded-[2rem] shadow-2xl border-4 border-yellow-400/20" alt="Destaque" />
                    {todayOffers.length > 1 && (
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {todayOffers.map((_, i) => (
                          <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === offerIndex ? 'w-6 bg-yellow-400' : 'w-1.5 bg-white/20'}`} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-3xl font-brand font-bold text-yellow-400 mb-2 leading-none">{todayOffer.name}</h3>
                    <p className="text-gray-400 text-xs line-clamp-2 mb-4">{todayOffer.description}</p>
                    {todayOffer.price > 0 && <p className="text-5xl font-bold text-white">R$ {todayOffer.price.toFixed(2)}</p>}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center text-white/20">
                  <Star size={64} className="mx-auto mb-4"/>
                  <p className="text-[10px] uppercase font-bold tracking-widest">Aguardando ofertas</p>
                </div>
              )}
              
              <div className="mt-8 pt-4 border-t border-white/10 w-full">
                 <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">{settings.storeName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default TVBoard;
