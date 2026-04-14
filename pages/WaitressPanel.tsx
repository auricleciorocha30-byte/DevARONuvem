
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Loader2
} from 'lucide-react';
import { Order, OrderStatus, Waitstaff, StoreSettings } from '../types';
import { supabase } from '../lib/supabase';
import InstallPrompt from '../components/InstallPrompt';

interface Props {
  onSelectTable: (table: string | null) => void;
  orders: Order[];
  settings: StoreSettings;
}

const WaitressPanel: React.FC<Props> = ({ onSelectTable, orders, settings }) => {
  const navigate = useNavigate();
  const [activeWaitstaff, setActiveWaitstaff] = useState<Waitstaff | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLogingIn, setIsLogingIn] = useState(false);
  const [selectedTableModal, setSelectedTableModal] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'MAPA' | 'PEDIDOS'>('MAPA');
  const [printOrder, setPrintOrder] = useState<any | null>(null);
  
  const tables = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  useEffect(() => {
    const saved = localStorage.getItem('vovo-guta-waitstaff');
    if (saved) {
      setActiveWaitstaff(JSON.parse(saved));
    } else {
      setShowLogin(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLogingIn(true);
    try {
      const { data, error } = await supabase.from('waitstaff')
        .select('*')
        .eq('name', loginName)
        .eq('password', loginPass)
        .maybeSingle();

      if (data) {
        setActiveWaitstaff(data);
        localStorage.setItem('vovo-guta-waitstaff', JSON.stringify(data));
        setShowLogin(false);
      } else {
        setLoginError('Acesso negado.');
      }
    } catch (err) {
      setLoginError('Erro de conexão.');
    } finally {
      setIsLogingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vovo-guta-waitstaff');
    setActiveWaitstaff(null);
    setShowLogin(true);
  };

  const activeOrders = useMemo(() => orders.filter(o => o.status === 'PREPARANDO' || o.status === 'PRONTO'), [orders]);

  const occupiedTables = useMemo(() => {
    const map = new Map<string, { status: string, count: number }>();
    activeOrders.forEach(o => {
      if (o.tableNumber) {
        const current = map.get(o.tableNumber);
        const newStatus = (current?.status === 'PRONTO' || o.status === 'PRONTO') ? 'PRONTO' : 'PREPARANDO';
        map.set(o.tableNumber, { status: newStatus, count: (current?.count || 0) + 1 });
      }
    });
    return map;
  }, [activeOrders]);

  const handleTableClick = (tableNum: string) => {
    if (occupiedTables.has(tableNum)) setSelectedTableModal(tableNum);
    else { onSelectTable(tableNum); navigate('/cardapio'); }
  };

  const handleQuickOrder = (type: string) => { onSelectTable(null); navigate(`/cardapio?tipo=${type}`); };

  const handlePrint = (order: any) => {
    setPrintOrder(order);
    setTimeout(() => { window.print(); setPrintOrder(null); }, 300);
  };

  const updateTableOrders = async (tableNum: string, status: OrderStatus) => {
    const tableOrders = activeOrders.filter(o => o.tableNumber === tableNum);
    // Fix: Moved .eq() before .update() to comply with NeonBridge mock implementation which returns a Promise from terminal methods.
    await Promise.all(tableOrders.map(o => supabase.from('orders').eq('id', o.id).update({ status })));
    setSelectedTableModal(null);
  };

  return (
    <div className="min-h-screen bg-primary p-4 md:p-8 relative">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #thermal-receipt-waiter, #thermal-receipt-waiter * { visibility: visible; }
          #thermal-receipt-waiter { 
            display: block !important; position: absolute; left: 0; top: 0; 
            width: ${settings.thermalPrinterWidth || '80mm'}; padding: 5mm; 
            background: #fff; font-family: 'Courier New', monospace; font-size: 10pt; color: #000;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between text-white gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-secondary rounded-3xl shadow-xl text-white"><UserRound size={32} /></div>
            <div>
              <h1 className="text-3xl font-brand font-bold">Atendimento</h1>
              <p className="text-secondary text-sm font-medium flex items-center gap-2"><Clock size={14} /> {activeWaitstaff?.name || 'Aguardando Login'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <InstallPrompt />
            <button onClick={() => handleQuickOrder('BALCAO')} className="flex items-center gap-2 px-4 py-3 bg-white/10 rounded-2xl hover:bg-white/20 font-bold text-xs"><ShoppingBag size={18} /> Balcão</button>
            <button onClick={() => handleQuickOrder('ENTREGA')} className="flex items-center gap-2 px-4 py-3 bg-white/10 rounded-2xl hover:bg-white/20 font-bold text-xs"><Truck size={18} /> Entrega</button>
            <button onClick={handleLogout} className="p-3 bg-red-500/10 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><LogOut size={24} /></button>
          </div>
        </header>

        <div className="flex bg-white/5 p-1.5 rounded-[2rem] border border-white/10">
          <button onClick={() => setActiveTab('MAPA')} className={`flex-1 py-4 rounded-[1.5rem] font-bold text-xs tracking-widest ${activeTab === 'MAPA' ? 'bg-secondary text-white shadow-lg' : 'text-white/40'}`}>MAPA</button>
          <button onClick={() => setActiveTab('PEDIDOS')} className={`flex-1 py-4 rounded-[1.5rem] font-bold text-xs tracking-widest ${activeTab === 'PEDIDOS' ? 'bg-secondary text-white shadow-lg' : 'text-white/40'}`}>PEDIDOS ATIVOS</button>
        </div>

        {activeTab === 'MAPA' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in">
            {tables.map(num => {
              const occ = occupiedTables.get(num);
              return (
                <button key={num} onClick={() => handleTableClick(num)} className={`relative aspect-square rounded-[2rem] p-6 text-center border-2 flex flex-col items-center justify-center transition-all ${occ?.status === 'PRONTO' ? 'bg-green-600 border-green-400' : occ ? 'bg-secondary border-secondary/50' : 'bg-white/5 border-white/10'}`}>
                  <Hash size={16} className="text-white/60 mb-1" />
                  <span className="text-5xl font-bold text-white block">{num}</span>
                  {occ && <div className="absolute top-3 right-3 bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full">{occ.count} itens</div>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            {activeOrders.map(order => (
              <div key={order.id} className="bg-white rounded-[2rem] p-5 shadow-xl flex flex-col border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-400">{order.type} {order.tableNumber && `• Mesa ${order.tableNumber}`}</p>
                    <h3 className="font-bold text-primary truncate">{order.customerName ? `${order.customerName} #${order.displayId || String(order.id).slice(-4)}` : `Pedido #${order.displayId || String(order.id).slice(-4)}`}</h3>
                  </div>
                  <button onClick={() => handlePrint(order)} className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:text-secondary"><Printer size={18} /></button>
                </div>
                <div className="flex-1 space-y-1 mb-4 border-t pt-3 min-h-[80px]">
                  {order.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs font-medium text-gray-600"><span>{it.quantity}x {it.name}</span><span>R$ {(it.price * it.quantity).toFixed(2)}</span></div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 pt-3 border-t">
                  <div className="flex justify-between items-center"><p className="text-xl font-bold text-primary">R$ {order.total.toFixed(2)}</p><span className="text-[9px] font-black px-2 py-1 bg-orange-100 text-orange-600 rounded-full">{order.status}</span></div>
                  <div className="flex gap-2">
                    {/* Fix: Moved .eq() before .update() to comply with NeonBridge mock implementation. */}
                    {order.status === 'PREPARANDO' && <button onClick={() => supabase.from('orders').eq('id', order.id).update({ status: 'PRONTO' })} className="flex-1 py-3 bg-blue-500 text-white rounded-xl text-[10px] font-bold">PRONTO</button>}
                    {/* Fix: Moved .eq() before .update() to comply with NeonBridge mock implementation. */}
                    <button onClick={() => supabase.from('orders').eq('id', order.id).update({ status: 'ENTREGUE' })} className="flex-1 py-3 bg-primary text-white rounded-xl text-[10px] font-bold">FINALIZAR</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTableModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-sm rounded-[3rem] overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-8 border-b bg-gray-50 text-center relative">
              <button onClick={() => setSelectedTableModal(null)} className="absolute top-6 right-6 p-2 text-gray-300"><X size={24}/></button>
              <div className="w-16 h-16 bg-primary text-secondary rounded-2xl flex items-center justify-center mx-auto mb-4"><Hash size={32} /></div>
              <h2 className="text-2xl font-brand font-bold text-primary">Mesa {selectedTableModal}</h2>
            </div>
            <div className="p-8 space-y-3">
              <button onClick={() => { onSelectTable(selectedTableModal); navigate('/cardapio'); }} className="w-full flex items-center gap-4 p-4 bg-orange-50 rounded-2xl border border-orange-100 font-bold text-sm"><PlusCircle className="text-secondary" /> Adicionar Item</button>
              <button onClick={() => updateTableOrders(selectedTableModal, 'PRONTO')} className="w-full flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 font-bold text-sm text-blue-700"><CheckCircle2 /> Marcar Tudo Pronto</button>
              <button onClick={() => updateTableOrders(selectedTableModal, 'ENTREGUE')} className="w-full flex items-center gap-4 p-4 bg-green-50 rounded-2xl border border-green-100 font-bold text-sm text-green-700"><CheckCircle /> Finalizar Conta</button>
              <button onClick={() => updateTableOrders(selectedTableModal, 'CANCELADO')} className="w-full flex items-center gap-4 p-4 bg-red-50 rounded-2xl border border-red-100 font-bold text-sm text-red-700"><XCircle /> Cancelar Pedidos</button>
            </div>
          </div>
        </div>
      )}

      {printOrder && (
        <div id="thermal-receipt-waiter">
          <div style={{ textAlign: 'center' }}><p style={{ fontWeight: 'bold' }}>{settings.storeName.toUpperCase()}</p><p style={{ fontSize: '8pt' }}>{new Date().toLocaleString()}</p></div>
          <div style={{ borderTop: '1px solid #000', margin: '2mm 0' }}></div>
          <p style={{ fontWeight: 'bold' }}>{printOrder.tableNumber ? `MESA: ${printOrder.tableNumber}` : 'PEDIDO'}</p>
          <table style={{ width: '100%', marginTop: '2mm' }}>
            {printOrder.items.map((it: any, i: number) => (
              <tr key={i}><td style={{ fontSize: '9pt' }}>{it.quantity}x {it.name}</td><td style={{ textAlign: 'right' }}>{(it.price * it.quantity).toFixed(2)}</td></tr>
            ))}
          </table>
          <div style={{ borderTop: '1px solid #000', marginTop: '2mm', textAlign: 'right' }}><p style={{ fontWeight: 'bold' }}>TOTAL: R$ {printOrder.total.toFixed(2)}</p></div>
        </div>
      )}

      {showLogin && (
        <div className="fixed inset-0 z-[120] bg-primary flex items-center justify-center p-4">
          <div className="bg-white w-full max-sm rounded-[3rem] p-10 shadow-2xl space-y-8">
            <div className="text-center"><h1 className="text-2xl font-brand font-bold text-primary">Acesso Equipe</h1></div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" placeholder="Nome" value={loginName} onChange={e => setLoginName(e.target.value)} className="w-full px-4 py-4 bg-gray-50 border rounded-2xl" required />
              <input type="password" placeholder="Senha" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full px-4 py-4 bg-gray-50 border rounded-2xl" required />
              {loginError && <p className="text-xs text-red-500 font-bold">{loginError}</p>}
              <button disabled={isLogingIn} type="submit" className="w-full py-5 bg-primary text-white rounded-2xl font-bold shadow-xl flex items-center justify-center">{isLogingIn ? <Loader2 className="animate-spin"/> : 'Entrar'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaitressPanel;
