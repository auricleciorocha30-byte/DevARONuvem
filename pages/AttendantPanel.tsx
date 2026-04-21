
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { 
  Hash, 
  UserRound, 
  Clock, 
  X, 
  PlusCircle, 
  CheckCircle,
  LogOut,
  Printer,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Truck,
  Loader2,
  RefreshCw,
  Lock,
  Tag,
  MoreVertical,
  MessageCircle,
  WifiOff
} from 'lucide-react';
import { Order, OrderStatus, Waitstaff, StoreSettings } from '../types';
import { supabase } from '../lib/supabase';
import InstallPrompt from '../components/InstallPrompt';

interface Props {
  adminUser: Waitstaff | null;
  onSelectTable: (table: string | null) => void;
  orders: Order[];
  settings: StoreSettings;
  updateStatus: (id: string, status: OrderStatus) => Promise<void>;
  onLogout: () => void;
  isOffline?: boolean;
}

const AttendantPanel: React.FC<Props> = ({ adminUser, onSelectTable, orders, settings, updateStatus, onLogout, isOffline }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTableModal, setSelectedTableModal] = useState<{id: string, type: 'MESA' | 'COMANDA'} | null>(null);
  const [activeTab, setActiveTab] = useState<'MAPA' | 'PEDIDOS'>('MAPA');
  const [printOrder, setPrintOrder] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  const tables = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  useEffect(() => {
    if (adminUser) {
        supabase.from('register_sessions')
            .select('*')
            .eq('store_id', adminUser.store_id)
            .eq('waitstaff_id', adminUser.id)
            .eq('status', 'OPEN')
            .maybeSingle()
            .then(({ data }) => setCurrentSession(data));
    }
  }, [adminUser]);

  // Se não houver usuário logado, redireciona para o login da loja atual
  if (!adminUser) {
    const storeSlug = searchParams.get('loja');
    return <Navigate to={`/login${storeSlug ? `?loja=${storeSlug}` : ''}`} />;
  }

  const isGerente = useMemo(() => adminUser?.role === 'GERENTE', [adminUser]);
  const checkCanFinish = (orderType: string) => {
    if (isGerente) return true;
    if (orderType === 'BALCAO') return true;
    if (orderType === 'ENTREGA' && !settings.requirePosFinalization) return true;
    if (settings.requirePosFinalization) return false;
    return settings.canWaitstaffFinishOrder === true;
  };
  const canCancel = useMemo(() => isGerente || settings.canWaitstaffCancelItems, [isGerente, settings.canWaitstaffCancelItems]);

  const activeOrders = useMemo(() => {
    return orders.filter(o => {
        if (o.status === 'ENTREGUE' || o.status === 'CANCELADO') return false;
        if (settings.hideUnpaidOnlineOrders && o.status === 'AGUARDANDO_PAGAMENTO') return false;
        return true;
    });
  }, [orders, settings.hideUnpaidOnlineOrders]);

  const newBalcaoEntregaOrders = useMemo(() => {
    return activeOrders.filter(o => (o.type === 'BALCAO' || o.type === 'ENTREGA') && (o.status === 'AGUARDANDO' || o.status === 'AGUARDANDO_PAGAMENTO' || o.status === 'PAGO'));
  }, [activeOrders]);

  const occupiedTables = useMemo(() => {
    const map = new Map<string, { status: string, count: number, total: number }>();
    activeOrders.forEach(o => {
      if (o.tableNumber && o.type === 'MESA') {
        const current = map.get(o.tableNumber);
        let newStatus = current?.status || o.status;
        // Priority: PREPARANDO > AGUARDANDO > PRONTO
        if (o.status === 'PREPARANDO') newStatus = 'PREPARANDO';
        else if (o.status === 'AGUARDANDO' && newStatus !== 'PREPARANDO') newStatus = 'AGUARDANDO';
        else if (o.status === 'PRONTO' && newStatus !== 'PREPARANDO' && newStatus !== 'AGUARDANDO') newStatus = 'PRONTO';

        map.set(o.tableNumber, { 
            status: newStatus, 
            count: (current?.count || 0) + 1,
            total: (current?.total || 0) + Number(o.total)
        });
      }
    });
    return map;
  }, [activeOrders]);

  const activeCommands = useMemo(() => {
    const map = new Map<string, { status: string, count: number, total: number }>();
    activeOrders.forEach(o => {
      if (o.tableNumber && o.type === 'COMANDA') {
        const current = map.get(o.tableNumber);
        let newStatus = current?.status || o.status;
        // Priority: PREPARANDO > AGUARDANDO > PRONTO
        if (o.status === 'PREPARANDO') newStatus = 'PREPARANDO';
        else if (o.status === 'AGUARDANDO' && newStatus !== 'PREPARANDO') newStatus = 'AGUARDANDO';
        else if (o.status === 'PRONTO' && newStatus !== 'PREPARANDO' && newStatus !== 'AGUARDANDO') newStatus = 'PRONTO';

        map.set(o.tableNumber, { 
            status: newStatus, 
            count: (current?.count || 0) + 1,
            total: (current?.total || 0) + Number(o.total)
        });
      }
    });
    return map;
  }, [activeOrders]);

  const displayOrders = useMemo(() => {
    const result: (Order & { originalIds: string[] })[] = [];
    const groups = new Map<string, Order & { originalIds: string[] }>();

    activeOrders.forEach(order => {
        if (order.tableNumber) {
            const key = `${order.type}-${order.tableNumber}`;
            if (groups.has(key)) {
                const existing = groups.get(key)!;
                existing.originalIds.push(order.id);
                existing.total += order.total;
                existing.serviceFee = (existing.serviceFee || 0) + (order.serviceFee || 0);
                order.items.forEach(newItem => {
                    const existingItem = existing.items.find(i => i.productId === newItem.productId);
                    if (existingItem) {
                        existingItem.quantity += newItem.quantity;
                    } else {
                        existing.items.push({ ...newItem });
                    }
                });
            } else {
                groups.set(key, { ...order, items: order.items.map(i => ({...i})), originalIds: [order.id] });
            }
        } else {
            result.push({ ...order, originalIds: [order.id] });
        }
    });

    return [...result, ...Array.from(groups.values())].sort((a, b) => b.createdAt - a.createdAt);
  }, [activeOrders]);

  const handleResourceClick = (id: string, type: 'MESA' | 'COMANDA') => {
    const isOccupied = type === 'MESA' ? occupiedTables.has(id) : activeCommands.has(id);
    
    if (isOccupied) {
      setSelectedTableModal({ id, type });
    } else {
      onSelectTable(id);
      const storeSlug = searchParams.get('loja');
      // Se for comanda, passa o tipo na URL para o DigitalMenu saber
      const typeParam = type === 'COMANDA' ? '&tipo=COMANDA' : '';
      navigate(`/cardapio?loja=${storeSlug || ''}${typeParam}`);
    }
  };

  const handleQuickOrder = (type: string) => { 
    onSelectTable(null); 
    const storeSlug = searchParams.get('loja');
    navigate(`/cardapio?tipo=${type}${storeSlug ? `&loja=${storeSlug}` : ''}`); 
  };

  const handlePrintConferencia = (tableNum: string, type?: 'MESA' | 'COMANDA') => {
    const tableOrders = activeOrders.filter(o => o.tableNumber === tableNum && (!type || o.type === type));
    const combinedItems: any[] = [];
    
    tableOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = combinedItems.find(i => i.productId === item.productId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          combinedItems.push({ ...item });
        }
      });
    });

    const subtotal = combinedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const totalDiscount = tableOrders.reduce((acc, o) => acc + (o.discountAmount || 0), 0);
    const totalServiceFee = tableOrders.reduce((acc, o) => acc + (o.serviceFee || 0), 0);
    const finalTotal = subtotal - totalDiscount + totalServiceFee;
    
    setPrintOrder({
      id: `CONF-${tableNum}`,
      tableNumber: tableNum,
      items: combinedItems,
      total: finalTotal,
      subtotal: subtotal,
      discountAmount: totalDiscount,
      serviceFee: totalServiceFee,
      createdAt: Date.now(),
      isConferencia: true
    });
    
    setTimeout(() => { 
      window.print(); 
      setPrintOrder(null); 
    }, 300);
  };

  const updateTableOrders = async (tableNum: string, status: OrderStatus, type?: 'MESA' | 'COMANDA') => {
    const tableOrders = activeOrders.filter(o => o.tableNumber === tableNum && (!type || o.type === type));
    setIsUpdating(`table-${tableNum}`);
    try {
        await Promise.all(tableOrders.map(o => updateStatus(o.id, status)));
        setSelectedTableModal(null);
    } finally {
        setIsUpdating(null);
    }
  };

  const handleGroupStatusUpdate = async (ids: string[], status: OrderStatus) => {
    setIsUpdating(ids[0]);
    try {
        if (status === 'ENTREGUE' || status === 'ENVIADO_PARA_ENTREGA') {
             // Check if any of these orders are ENTREGA and require POS finalization
             const ordersToUpdate = ids.filter(id => {
                 const order = displayOrders.find(o => o.originalIds?.includes(id) || o.id === id);
                 if (order && order.type === 'ENTREGA' && settings.requirePosFinalization) {
                     return false; // Cannot set to ENTREGUE directly
                 }
                 return true;
             });

             if (ordersToUpdate.length > 0) {
                 await Promise.all(ordersToUpdate.map(id => updateStatus(id, status)));
             }
        } else {
             await Promise.all(ids.map(id => updateStatus(id, status)));
        }
    } finally {
        setIsUpdating(null);
    }
  };

  return (
    <div className="min-h-screen bg-primary p-4 md:p-8 relative overflow-x-hidden">
      {isOffline && (
          <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-600 text-white py-2 px-4 flex items-center justify-center gap-2 font-bold shadow-lg animate-slide-down">
              <WifiOff size={20} />
              <span>MODO CONTINGÊNCIA ATIVO - VOCÊ ESTÁ OFFLINE</span>
          </div>
      )}
      <style>{`
        @media print {
          @page { margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff !important; }
          body * { visibility: hidden; }
          #thermal-receipt-waiter, #thermal-receipt-waiter * { visibility: visible; color: black !important; font-weight: 900 !important; }
          #thermal-receipt-waiter { 
            display: block !important; 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: ${settings.printWidthPx ? `${settings.printWidthPx}px` : (settings.thermalPrinterWidth || '80mm')}; 
            padding: 5mm; 
            background: #fff; 
            font-family: 'Courier New', monospace; 
            font-size: 10pt; 
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between text-white gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-secondary rounded-3xl shadow-xl text-white">
              <UserRound size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-brand font-bold">Painel Atendente</h1>
              <p className="text-secondary text-sm font-medium flex items-center gap-2">
                <Clock size={14} /> {adminUser?.name} ({adminUser?.role})
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <InstallPrompt />
            <button onClick={() => handleQuickOrder('COMANDA')} className="flex items-center gap-2 px-4 py-3 bg-white/10 rounded-2xl hover:bg-white/20 font-bold text-xs">
              <Tag size={18} /> Comanda
            </button>
            <button onClick={onLogout} className="p-3 bg-red-500/10 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all">
              <LogOut size={24} />
            </button>
          </div>
        </header>

        <div className="flex bg-white/5 p-1.5 rounded-[2rem] border border-white/10">
          <button 
            onClick={() => setActiveTab('MAPA')} 
            className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all ${activeTab === 'MAPA' ? 'bg-secondary text-white shadow-lg' : 'text-white/30 hover:text-white/60'}`}
          >
            Mapa de Mesas
          </button>
          <button 
            onClick={() => setActiveTab('PEDIDOS')} 
            className={`relative flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'PEDIDOS' ? 'bg-secondary text-white shadow-lg' : 'text-white/30 hover:text-white/60'}`}
          >
            Pedidos Ativos
            {newBalcaoEntregaOrders.length > 0 && (
              <span className="absolute top-2 right-4 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </button>
        </div>

        {activeTab === 'MAPA' ? (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in">
            {tables.map(num => {
              const occ = occupiedTables.get(num);
              return (
                <button 
                  key={num} 
                  onClick={() => handleResourceClick(num, 'MESA')} 
                  className={`relative aspect-square rounded-[2rem] p-6 text-center border-2 flex flex-col items-center justify-center transition-all active:scale-95 ${
                    occ?.status === 'PRONTO' 
                      ? 'bg-green-600 border-green-400 shadow-lg shadow-green-900/20' 
                      : occ 
                      ? 'bg-secondary border-secondary/50 shadow-lg shadow-yellow-900/20' 
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  <Hash size={16} className="text-white/60 mb-1" />
                  <span className="text-5xl font-bold text-white block leading-none">{num}</span>
                  {occ && (
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                      <div className="bg-white/20 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">R$ {occ.total.toFixed(2)}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {activeCommands.size > 0 && (
            <div className="mt-8 pt-6 border-t border-white/10">
              <h3 className="text-white/50 font-bold uppercase tracking-widest text-xs mb-4 flex items-center gap-2"><Tag size={14}/> Comandas Ativas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in">
                {Array.from(activeCommands.entries()).map(([num, occ]) => (
                  <button 
                    key={`cmd-${num}`} 
                    onClick={() => handleResourceClick(num, 'COMANDA')} 
                    className={`relative aspect-square rounded-[2rem] p-6 text-center border-2 flex flex-col items-center justify-center transition-all active:scale-95 ${
                      occ.status === 'PRONTO' 
                        ? 'bg-green-600 border-green-400 shadow-lg shadow-green-900/20' 
                        : 'bg-purple-600 border-purple-400 shadow-lg shadow-purple-900/20'
                    }`}
                  >
                    <Tag size={16} className="text-white/60 mb-1" />
                    <span className="text-5xl font-bold text-white block leading-none">{num}</span>
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                      <div className="bg-white/20 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">R$ {occ.total.toFixed(2)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {displayOrders.map(order => (
              <div key={order.id} className={`bg-white rounded-[2.5rem] p-6 shadow-xl flex flex-col border relative group ${((order.type === 'BALCAO' || order.type === 'ENTREGA') && (order.status === 'AGUARDANDO' || order.status === 'PAGO')) ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-100'}`}>
                {((order.type === 'BALCAO' || order.type === 'ENTREGA') && (order.status === 'AGUARDANDO' || order.status === 'AGUARDANDO_PAGAMENTO' || order.status === 'PAGO')) && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${order.type === 'MESA' ? 'bg-blue-100 text-blue-600' : order.type === 'COMANDA' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                            {order.type} {(order.type === 'MESA' || order.type === 'COMANDA') && order.tableNumber && `• ${order.type === 'MESA' ? 'Mesa' : 'Cmd'} ${order.tableNumber}`}
                        </span>
                    </div>
                    <h3 className="font-bold text-primary truncate text-lg">
                        {order.customerName ? `${order.customerName} #${order.displayId || String(order.id).slice(-4)}` : `Pedido #${order.displayId || String(order.id).slice(-4)}`}
                    </h3>
                  </div>
                  <button onClick={() => { setPrintOrder(order); setTimeout(() => window.print(), 300); }} className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:text-secondary hover:bg-gray-100 transition-all">
                    <Printer size={20} />
                  </button>
                </div>

                <div className="flex-1 space-y-2 mb-5 border-t border-gray-50 pt-4 min-h-[100px] overflow-y-auto custom-scrollbar">
                  {/* Additional Info */}
                  <div className="flex flex-col gap-1 mb-3 pb-3 border-b border-gray-50 text-[10px] text-gray-500">
                     <div className="flex justify-between">
                        <span className="font-bold uppercase tracking-wider">Hora:</span>
                        <span>{new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                     </div>
                     {order.paymentMethod && (
                        <div className="flex justify-between">
                           <span className="font-bold uppercase tracking-wider">Pagamento:</span>
                           <span>{order.paymentMethod}</span>
                        </div>
                     )}
                     {order.customerPhone && (
                        <div className="flex justify-between items-center">
                           <span className="font-bold uppercase tracking-wider">Telefone:</span>
                           <span className="flex items-center gap-1">
                               {order.customerPhone}
                               <a 
                                   href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="text-green-500 hover:text-green-600"
                                   title="Abrir WhatsApp"
                                   onClick={e => e.stopPropagation()}
                               >
                                   <MessageCircle size={14} />
                               </a>
                           </span>
                        </div>
                     )}
                     {order.notes && (
                        <div className="mt-1 bg-yellow-50 p-2 rounded-lg border border-yellow-100 text-yellow-800 italic">
                           <span className="font-bold not-italic mr-1">Obs:</span> {order.notes}
                        </div>
                     )}
                  </div>

                  {order.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs font-bold text-zinc-600">
                      <span className="truncate pr-2">
                        <span className="bg-zinc-100 px-1.5 py-0.5 rounded mr-1.5">{it.isByWeight ? it.quantity.toFixed(3) : it.quantity}x</span> {it.name}
                      </span>
                      <span className="shrink-0 text-zinc-400">R$ {(it.price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t border-gray-50">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex flex-col">
                      <p className="text-2xl font-brand font-bold text-primary">R$ {order.total.toFixed(2)}</p>
                      {order.serviceFee > 0 && <span className="text-[10px] text-gray-500 font-bold">Inclui R$ {order.serviceFee.toFixed(2)} de comissão</span>}
                    </div>
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${order.status === 'PRONTO' ? 'bg-green-100 text-green-600 animate-pulse' : (order.status === 'AGUARDANDO' || order.status === 'AGUARDANDO_PAGAMENTO') ? 'bg-yellow-100 text-yellow-600' : 'bg-orange-100 text-orange-600'}`}>
                        {order.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {(order.status === 'AGUARDANDO' || order.status === 'AGUARDANDO_PAGAMENTO' || order.status === 'PAGO') && (
                      <div className="flex gap-2 w-full">
                        <button 
                          disabled={isUpdating === order.id}
                          onClick={() => handleGroupStatusUpdate(order.originalIds, 'PREPARANDO')} 
                          className="flex-1 py-3.5 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {isUpdating === order.id ? <Loader2 className="animate-spin" size={14} /> : (order.status === 'AGUARDANDO_PAGAMENTO' ? 'CONFIRMAR E PRODUZIR' : 'MANDAR P/ PRODUÇÃO')}
                        </button>
                        
                        <div className="relative">
                            <button 
                                onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)}
                                className="h-full px-3 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-colors flex items-center justify-center"
                            >
                                <MoreVertical size={18} />
                            </button>
                            
                            {openMenuId === order.id && (
                                <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 flex flex-col">
                                    <button 
                                        onClick={() => {
                                            handleGroupStatusUpdate(order.originalIds, 'PRONTO');
                                            setOpenMenuId(null);
                                        }}
                                        className="px-4 py-3 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 w-full"
                                    >
                                        <CheckCircle2 size={14} className="text-green-500"/> Pular Produção (Pronto)
                                    </button>
                                    
                                    {(isGerente || settings.canWaitstaffCancelItems) && (
                                        <button 
                                            onClick={() => {
                                                if(window.confirm('Tem certeza que deseja cancelar este pedido?')) {
                                                    handleGroupStatusUpdate(order.originalIds, 'CANCELADO');
                                                }
                                                setOpenMenuId(null);
                                            }}
                                            className="px-4 py-3 text-left text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50 w-full"
                                        >
                                            <XCircle size={14} /> Cancelar Pedido
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                      </div>
                    )}

                    {order.status === 'PREPARANDO' && (
                      <button 
                        disabled={isUpdating === order.id}
                        onClick={() => handleGroupStatusUpdate(order.originalIds, 'PRONTO')} 
                        className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        {isUpdating === order.id ? <Loader2 className="animate-spin" size={14} /> : 'MARCAR PRONTO'}
                      </button>
                    )}
                    
                    {order.status === 'PRONTO' && (
                      checkCanFinish(order.type) ? (
                        <button 
                          disabled={isUpdating === order.id}
                          onClick={() => handleGroupStatusUpdate(order.originalIds, order.type === 'ENTREGA' ? 'ENVIADO_PARA_ENTREGA' : 'ENTREGUE')} 
                          className="flex-1 py-3.5 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {isUpdating === order.id ? <Loader2 className="animate-spin" size={14} /> : (order.type === 'ENTREGA' ? 'ENVIAR P/ ENTREGA' : 'FINALIZAR')}
                        </button>
                      ) : (
                        <div className="flex-1 py-3.5 bg-gray-100 text-gray-400 rounded-2xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1 cursor-not-allowed">
                          <Lock size={12} /> {settings.requirePosFinalization ? 'Finalizar no PDV' : 'Apenas Gerente'}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
            {displayOrders.length === 0 && (
              <div className="col-span-full py-24 text-center text-white/20 italic space-y-4">
                <RefreshCw size={48} className="mx-auto opacity-20" />
                <p>Nenhum pedido em aberto no momento.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTableModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl animate-scale-up border border-orange-100">
            <div className="p-8 border-b bg-orange-50/50 text-center relative">
              <button onClick={() => setSelectedTableModal(null)} className="absolute top-6 right-6 p-2 text-gray-300 hover:text-gray-500 transition-colors">
                <X size={24}/>
              </button>
              <div className="w-16 h-16 bg-primary text-secondary rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-black/10">
                {selectedTableModal.type === 'MESA' ? <Hash size={32} /> : <Tag size={32} />}
              </div>
              <h2 className="text-2xl font-brand font-bold text-primary">{selectedTableModal.type === 'MESA' ? 'Mesa' : 'Comanda'} {selectedTableModal.id}</h2>
              <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest mt-1">
                Total acumulado: R$ {((selectedTableModal.type === 'MESA' ? occupiedTables.get(selectedTableModal.id) : activeCommands.get(selectedTableModal.id))?.total ?? 0).toFixed(2)}
              </p>
            </div>
            <div className="p-8 space-y-3">
              <button 
                onClick={() => { 
                  onSelectTable(selectedTableModal.id); 
                  const storeSlug = searchParams.get('loja');
                  const typeParam = selectedTableModal.type === 'COMANDA' ? '&tipo=COMANDA' : '';
                  navigate(`/cardapio?loja=${storeSlug || ''}${typeParam}`); 
                }} 
                className="w-full flex items-center gap-4 p-5 bg-orange-50 rounded-2xl border border-orange-100 font-black text-[11px] uppercase tracking-wider text-orange-900 hover:bg-orange-100 transition-all active:scale-95"
              >
                <PlusCircle className="text-orange-500" size={20} /> Adicionar Item
              </button>
              
              <button 
                onClick={() => handlePrintConferencia(selectedTableModal.id, selectedTableModal.type)} 
                className="w-full flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 font-black text-[11px] uppercase tracking-wider text-gray-700 hover:bg-gray-100 transition-all active:scale-95"
              >
                <Printer className="text-gray-400" size={20} /> Imprimir Conferência
              </button>

              <button 
                disabled={isUpdating === `table-${selectedTableModal.id}`}
                onClick={() => updateTableOrders(selectedTableModal.id, 'PRONTO', selectedTableModal.type)} 
                className="w-full flex items-center gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100 font-black text-[11px] uppercase tracking-wider text-blue-700 hover:bg-blue-100 transition-all active:scale-95"
              >
                {isUpdating === `table-${selectedTableModal.id}` ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 className="text-blue-500" size={20} />} Marcar Tudo Pronto
              </button>
              
              {checkCanFinish(selectedTableModal.type) ? (
                <button 
                  disabled={isUpdating === `table-${selectedTableModal.id}`}
                  onClick={() => updateTableOrders(selectedTableModal.id, 'ENTREGUE', selectedTableModal.type)} 
                  className="w-full flex items-center gap-4 p-5 bg-green-50 rounded-2xl border border-green-100 font-black text-[11px] uppercase tracking-wider text-green-700 hover:bg-green-100 transition-all active:scale-95"
                >
                  {isUpdating === `table-${selectedTableModal.id}` ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle className="text-green-500" size={20} />} Finalizar Pedidos
                </button>
              ) : (
                <div className="w-full flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 font-black text-[9px] uppercase tracking-wider text-gray-400 cursor-not-allowed">
                  <Lock size={16} /> {settings.requirePosFinalization ? 'Finalizar no PDV' : 'Apenas Gerente'}
                </div>
              )}

              {canCancel ? (
                <button 
                  disabled={isUpdating === `table-${selectedTableModal.id}`}
                  onClick={() => { if(window.confirm('Deseja realmente cancelar todos os pedidos desta mesa/comanda?')) updateTableOrders(selectedTableModal.id, 'CANCELADO', selectedTableModal.type); }} 
                  className="w-full flex items-center gap-4 p-5 bg-red-50 rounded-2xl border border-red-100 font-black text-[11px] uppercase tracking-wider text-red-700 hover:bg-red-100 transition-all active:scale-95"
                >
                  {isUpdating === `table-${selectedTableModal.id}` ? <Loader2 className="animate-spin" size={20} /> : <XCircle className="text-red-500" size={20} />} Cancelar Pedidos
                </button>
              ) : (
                <div className="w-full flex items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 font-black text-[9px] uppercase tracking-wider text-gray-400 cursor-not-allowed">
                  <Lock size={16} /> Cancelar (Apenas Gerente)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {printOrder && (
        <div id="thermal-receipt-waiter">
          <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
              <p style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '1mm' }}>{settings.storeName.toUpperCase()}</p>
              {settings.address && <p style={{ fontSize: '7pt', lineHeight: '1.2', margin: '1mm 0' }}>{settings.address}</p>}
              {settings.whatsapp && <p style={{ fontSize: '7pt' }}>WhatsApp: {settings.whatsapp}</p>}
              <div style={{ borderTop: '1px solid #000', margin: '3mm 0' }}></div>
              <p style={{ fontSize: '7pt' }}>{printOrder.isConferencia ? 'CONFERÊNCIA DE MESA' : 'PEDIDO DE VENDA'}</p>
              <p style={{ fontSize: '7pt' }}>EMISSÃO: {new Date().toLocaleString('pt-BR')}</p>
          </div>
          
          <div style={{ paddingBottom: '2mm' }}>
              <p style={{ fontWeight: 'bold', fontSize: '10pt', textAlign: 'center', marginBottom: '2mm' }}>
                {printOrder.tableNumber ? `MESA: ${printOrder.tableNumber}` : `PEDIDO: #${printOrder.displayId || String(printOrder.id || '').slice(-4)}`}
              </p>
              <p style={{ fontSize: '9pt' }}>ATENDENTE: {adminUser?.name.toUpperCase() || 'SISTEMA'}</p>
              <p style={{ fontSize: '9pt' }}>CLIENTE: {printOrder.customerName?.toUpperCase() || 'BALCÃO'}</p>
              {printOrder.customerPhone && <p style={{ fontSize: '9pt' }}>TEL: {printOrder.customerPhone}</p>}
              
              {printOrder.deliveryAddress && (
                <div style={{ marginTop: '2mm', padding: '2mm', background: '#f0f0f0', border: '1px solid #000' }}>
                    <p style={{ fontSize: '8pt', fontWeight: 'bold' }}>ENTREGA EM:</p>
                    <p style={{ fontSize: '8pt' }}>{printOrder.deliveryAddress.toUpperCase()}</p>
                    {printOrder.referencePoint && <p style={{ fontSize: '8pt' }}>REF: {printOrder.referencePoint}</p>}
                </div>
              )}
          </div>

          <div style={{ borderTop: '1px dashed #000', padding: '2mm 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {printOrder.items.map((it: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontSize: '9pt', padding: '1.5mm 0' }}>
                        {it.isByWeight ? `${it.quantity.toFixed(3)}kg` : `${it.quantity}x`} {it.name.toUpperCase()}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '9pt' }}>{(it.price * it.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>

          {printOrder.notes && (
            <div style={{ borderTop: '1px dashed #000', padding: '2mm 0' }}>
               <p style={{ fontSize: '8pt', fontWeight: 'bold' }}>OBSERVAÇÕES:</p>
               <p style={{ fontSize: '8pt', fontStyle: 'italic' }}>- {printOrder.notes}</p>
            </div>
          )}

          <div style={{ borderTop: '1px solid #000', padding: '3mm 0', textAlign: 'right' }}>
              <p style={{ fontSize: '9pt' }}>SUBTOTAL: R$ {(printOrder.subtotal || (printOrder.total - (printOrder.serviceFee || 0) + (printOrder.discountAmount || 0))).toFixed(2)}</p>
              {printOrder.discountAmount && printOrder.discountAmount > 0 && (
                <p style={{ fontSize: '9pt', color: '#000' }}>DESCONTO: -R$ {printOrder.discountAmount.toFixed(2)}</p>
              )}
              {printOrder.serviceFee && printOrder.serviceFee > 0 && (
                <p style={{ fontSize: '9pt', color: '#000' }}>COMISSÃO: R$ {printOrder.serviceFee.toFixed(2)}</p>
              )}
              <p style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '1mm' }}>TOTAL: R$ {printOrder.total.toFixed(2)}</p>
              <p style={{ fontSize: '8pt', marginTop: '1mm' }}>PAGAMENTO: {printOrder.paymentMethod || (printOrder.isConferencia ? 'A CONFERIR' : 'A DEFINIR')}</p>
              
              {printOrder.changeFor && printOrder.changeFor > 0 && (
                <div style={{ marginTop: '2mm' }}>
                    <p style={{ fontSize: '9pt' }}>PAGO EM DINHEIRO: R$ {printOrder.changeFor.toFixed(2)}</p>
                    <p style={{ fontSize: '10pt', fontWeight: 'bold' }}>TROCO: R$ {(printOrder.changeFor - printOrder.total).toFixed(2)}</p>
                </div>
              )}
          </div>
          
          <div style={{ borderTop: '1px dashed #000', marginTop: '4mm', paddingTop: '4mm', textAlign: 'center' }}>
              <p style={{ fontSize: '8pt' }}>OBRIGADO PELA PREFERÊNCIA!</p>
              <p style={{ fontSize: '6pt' }}>SISTEMA G & C CONVENIÊNCIA</p>
              {printOrder.isConferencia && <p style={{ fontSize: '7pt', fontWeight: 'bold', marginTop: '2mm' }}>ESTE DOCUMENTO NÃO É UM CUPOM FISCAL</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendantPanel;
