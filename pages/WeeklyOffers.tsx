
import React, { useState } from 'react';
import { Product } from '../types';
import { CalendarDays, Star, Plus, X, CheckCircle2 } from 'lucide-react';

interface Props {
  products: Product[];
  saveProduct: (p: Product) => Promise<void>;
}

const WeeklyOffers: React.FC<Props> = ({ products, saveProduct }) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const days = [
    { id: 0, name: "Domingo" },
    { id: 1, name: "Segunda-feira" },
    { id: 2, name: "Terça-feira" },
    { id: 3, name: "Quarta-feira" },
    { id: 4, name: "Quinta-feira" },
    { id: 5, name: "Sexta-feira" },
    { id: 6, name: "Sábado" },
  ];

  const getProductForDay = (dayId: number) => {
    return products.find(p => p.featuredDay === dayId);
  };

  const handleSetOffer = async (productId: string, dayId: number) => {
    // 1. Remove existing offer for this day if any
    const existing = getProductForDay(dayId);
    if (existing) {
        await saveProduct({ ...existing, featuredDay: undefined });
    }

    // 2. Set new offer
    const product = products.find(p => p.id === productId);
    if (product) {
        // Also remove this product from any OTHER day it might be assigned to
        await saveProduct({ ...product, featuredDay: dayId });
    }
    
    setSelectedDay(null);
  };

  const removeOffer = async (dayId: number) => {
    const product = getProductForDay(dayId);
    if (product) {
        await saveProduct({ ...product, featuredDay: undefined });
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex items-start gap-4">
        <div className="p-3 bg-orange-500 rounded-2xl text-white shadow-lg">
          <CalendarDays size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-orange-900">Ofertas da Semana</h2>
          <p className="text-sm text-orange-700">Configure um item especial para cada dia da semana. Ele aparecerá em destaque no topo do cardápio digital do cliente.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {days.map((day) => {
          const product = getProductForDay(day.id);
          return (
            <div key={day.id} className={`bg-white rounded-[2.5rem] p-6 shadow-sm border transition-all ${product ? 'border-orange-200 bg-orange-50/20' : 'border-gray-100'}`}>
              <h3 className="text-lg font-bold text-gray-800 mb-4">{day.name}</h3>
              
              {product ? (
                <div className="space-y-4">
                  <div className="relative aspect-video rounded-2xl overflow-hidden shadow-md">
                    <img src={product.imageUrl || undefined} alt={product.name} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 p-2 bg-yellow-400 rounded-full text-white shadow-lg">
                      <Star size={16} fill="currentColor" />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.category}</p>
                    {product.price > 0 && <p className="text-sm font-bold text-orange-600 mt-1">R$ {product.price.toFixed(2)}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedDay(day.id)}
                      className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
                    >
                      Alterar
                    </button>
                    <button 
                      onClick={() => removeOffer(day.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setSelectedDay(day.id)}
                  className="w-full aspect-video rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-orange-400 hover:text-orange-400 transition-all hover:bg-orange-50"
                >
                  <Plus size={24} />
                  <span className="text-xs font-bold uppercase tracking-widest">Definir Oferta</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {selectedDay !== null && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-8 border-b flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Selecionar Oferta</h2>
                <p className="text-sm text-gray-500">Escolha o item para {days.find(d => d.id === selectedDay)?.name}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-8 grid grid-cols-2 gap-4">
              {products.filter(p => p.isActive && p.showInMenu !== false).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSetOffer(p.id, selectedDay!)}
                  className="p-4 border border-gray-100 rounded-3xl flex items-center gap-4 hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
                >
                  <img src={p.imageUrl || undefined} className="w-16 h-16 rounded-2xl object-cover shadow-sm" alt={p.name} />
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-sm text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category}</p>
                    {p.price > 0 && <p className="text-sm font-bold text-orange-600">R$ {p.price.toFixed(2)}</p>}
                  </div>
                  <div className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CheckCircle2 size={24} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyOffers;
