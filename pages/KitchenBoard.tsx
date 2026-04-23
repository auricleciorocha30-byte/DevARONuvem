
import React, { useMemo, useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { ChefHat, Clock, Utensils, ShoppingBag, Truck, CheckCircle, Hash, DollarSign, MapPin, Scale } from 'lucide-react';

interface Props {
  orders: Order[];
  updateStatus: (id: string, status: OrderStatus) => Promise<void>;
}

const KitchenBoard: React.FC<Props> = ({ orders, updateStatus }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status === 'PREPARANDO');
  }, [orders]);

  const columns = useMemo(() => {
    return {
      salao: activeOrders.filter(o => o.type === 'MESA' || o.type === 'COMANDA').sort((a, b) => a.createdAt - b.createdAt),
      balcao: activeOrders.filter(o => o.type === 'BALCAO').sort((a, b) => a.createdAt - b.createdAt),
      entrega: activeOrders.filter(o => o.type === 'ENTREGA').sort((a, b) => a.createdAt - b.createdAt),
    };
  }, [activeOrders]);

  const handleMarkReady = async (id: string) => {
    try {
      await updateStatus(id, 'PRONTO');
    } catch (err) {
      alert('Erro ao atualizar status do pedido.');
    }
  };

  const getTimeElapsed = (timestamp: number) => {
    const elapsed = Math.floor((currentTime.getTime() - timestamp) / 60000);
    if (elapsed < 1) return 'Agora';
    return `${elapsed} min`;
  };

  return (
    <div className="bg-zinc-900 text-white p-6 flex flex-col gap-6 font-sans h-screen max-h-screen overflow-hidden">
      <header className="shrink-0 flex justify-between items-center border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-secondary rounded-2xl text-white shadow-lg">
            <ChefHat size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-brand font-bold">Painel da Produção</h1>
            <p className="text-xs text-secondary uppercase font-black tracking-widest">Produção em Tempo Real</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-right">
                <p className="text-3xl font-mono font-bold leading-none">{currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{activeOrders.length} Pedidos Ativos</p>
            </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden min-h-0">
        {/* COLUNA SALÃO */}
        <section className="flex flex-col bg-zinc-800/40 rounded-[2.5rem] border border-white/5 overflow-hidden">
          <div className="p-6 flex items-center justify-between border-b border-white/5 bg-blue-500/10">
            <div className="flex items-center gap-3">
              <Utensils className="text-blue-400" />
              <h2 className="text-xl font-bold uppercase tracking-tight">Salão</h2>
            </div>
            <span className="bg-blue-500 text-[10px] font-black px-3 py-1 rounded-full">{columns.salao.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {columns.salao.map(order => (
              <OrderCard key={order.id} order={order} onReady={handleMarkReady} elapsed={getTimeElapsed(order.createdAt)} />
            ))}
            {columns.salao.length === 0 && <EmptyState text="Nenhum pedido no salão" />}
          </div>
        </section>

        {/* COLUNA BALCÃO */}
        <section className="flex flex-col bg-zinc-800/40 rounded-[2.5rem] border border-white/5 overflow-hidden">
          <div className="p-6 flex items-center justify-between border-b border-white/5 bg-orange-500/10">
            <div className="flex items-center gap-3">
              <ShoppingBag className="text-orange-400" />
              <h2 className="text-xl font-bold uppercase tracking-tight">Balcão</h2>
            </div>
            <span className="bg-orange-500 text-[10px] font-black px-3 py-1 rounded-full">{columns.balcao.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {columns.balcao.map(order => (
              <OrderCard key={order.id} order={order} onReady={handleMarkReady} elapsed={getTimeElapsed(order.createdAt)} />
            ))}
            {columns.balcao.length === 0 && <EmptyState text="Nenhum balcão pendente" />}
          </div>
        </section>

        {/* COLUNA ENTREGA */}
        <section className="flex flex-col bg-zinc-800/40 rounded-[2.5rem] border border-white/5 overflow-hidden">
          <div className="p-6 flex items-center justify-between border-b border-white/5 bg-green-500/10">
            <div className="flex items-center gap-3">
              <Truck className="text-green-400" />
              <h2 className="text-xl font-bold uppercase tracking-tight">Entregas</h2>
            </div>
            <span className="bg-green-500 text-[10px] font-black px-3 py-1 rounded-full">{columns.entrega.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {columns.entrega.map(order => (
              <OrderCard key={order.id} order={order} onReady={handleMarkReady} elapsed={getTimeElapsed(order.createdAt)} />
            ))}
            {columns.entrega.length === 0 && <EmptyState text="Nenhuma entrega pendente" />}
          </div>
        </section>
      </div>
    </div>
  );
};

interface OrderCardProps {
  order: Order;
  onReady: (id: string) => void | Promise<void>;
  elapsed: string;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onReady, elapsed }) => {
  const isLate = elapsed.includes('min') && parseInt(elapsed) > 15;

  return (
    <div className={`bg-white rounded-[2rem] p-6 shadow-xl animate-scale-up border-4 ${isLate ? 'border-red-500' : 'border-transparent'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">ID #{order.displayId || String(order.id).slice(-4)}</span>
             {isLate && <span className="bg-red-500 text-[8px] font-black px-2 py-0.5 rounded text-white animate-pulse">ATRASADO</span>}
          </div>
          <h3 className="text-2xl font-black text-zinc-900 leading-none">
            {order.type === 'MESA' ? `MESA ${order.tableNumber}` : order.type === 'COMANDA' ? `COMANDA ${order.tableNumber}` : order.customerName || 'CLIENTE'}
          </h3>
          {order.waitstaffName && <p className="text-[10px] font-bold text-zinc-400 uppercase mt-1">Atendente: {order.waitstaffName}</p>}
        </div>
        <div className="text-right">
          <div className={`flex items-center gap-1 font-bold text-sm ${isLate ? 'text-red-600' : 'text-zinc-400'}`}>
            <Clock size={14} /> {elapsed}
          </div>
        </div>
      </div>

      {order.type === 'ENTREGA' && order.deliveryAddress && (
        <div className="mb-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-start gap-2">
           <MapPin size={14} className="text-zinc-400 shrink-0 mt-0.5" />
           <p className="text-[11px] text-zinc-600 font-medium leading-snug">{order.deliveryAddress}</p>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-zinc-50 pb-2 last:border-0">
            <span className={`bg-zinc-900 text-white min-w-[32px] h-8 px-2 rounded-lg flex items-center justify-center font-black ${item.isByWeight ? 'text-xs' : 'text-lg'} shrink-0`}>
              {item.isByWeight ? `${item.quantity.toFixed(3).replace('.', ',')}kg` : item.quantity}
            </span>
            <div className="flex-1">
                <p className="text-zinc-800 font-bold text-lg leading-tight">{item.name}</p>
                {item.description && <p className="text-xs text-zinc-500 italic mt-0.5">{item.description}</p>}
                
                {item.complements && item.complements.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {item.complements.map((comp: any, idx: number) => (
                       <p key={idx} className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md inline-block mr-2">
                           + {comp.quantity}x {comp.name}
                       </p>
                    ))}
                  </div>
                )}

                {item.isByWeight && (
                  <div className="flex items-center gap-1 mt-1 text-blue-500">
                    <Scale size={10} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">Venda por Peso</span>
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="p-3 bg-zinc-50 rounded-xl mb-4 border-l-4 border-zinc-200">
           <p className="text-[10px] text-zinc-400 font-black uppercase mb-1">Observações</p>
           <p className="text-sm text-zinc-700 italic font-medium">"{order.notes}"</p>
        </div>
      )}

      {order.changeFor && (
        <div className="p-4 bg-orange-100 rounded-xl mb-6 flex items-center justify-between border-2 border-orange-200 text-orange-900">
          <div className="flex items-center gap-2">
            <DollarSign size={20} className="text-orange-600" />
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest leading-none">Troco Necessário</p>
               <p className="text-xl font-black">R$ {(order.changeFor - order.total).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={() => onReady(order.id)}
        className="w-full py-4 bg-secondary text-white rounded-[1.5rem] font-black text-sm uppercase flex items-center justify-center gap-3 shadow-xl hover:scale-105 transition-transform active:scale-95"
      >
        <CheckCircle size={20} /> Pronto para Retirada
      </button>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
    <div className="h-full flex flex-col items-center justify-center text-zinc-600 italic py-20 text-center px-6">
        <ChefHat size={48} className="opacity-10 mb-4" />
        <p className="text-sm font-medium">{text}</p>
    </div>
);

export default KitchenBoard;
