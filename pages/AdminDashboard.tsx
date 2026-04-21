
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Order, Product, StoreSettings } from '../types';
import { 
  TrendingUp, 
  ShoppingBag, 
  XCircle, 
  Printer, 
  Filter, 
  ChevronDown, 
  ChefHat, 
  UserRound, 
  Tv, 
  Smartphone, 
  Copy, 
  Check, 
  ExternalLink,
  CalendarDays,
  Calendar,
  LogOut,
  Truck
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  orders: Order[];
  products: Product[];
  settings: StoreSettings;
  storeId?: string;
  onLogout?: () => void;
}

const AdminDashboard: React.FC<Props> = ({ orders, products, settings, storeId, onLogout }) => {
  const [searchParams] = useSearchParams();
  const [waitstaff, setWaitstaff] = useState<any[]>([]);
  const [isPrintingCommissionsOnly, setIsPrintingCommissionsOnly] = useState(false);
  const [qrMode, setQrMode] = useState<'geral' | 'local' | 'externo'>('geral');
  
  const storeSlug = useMemo(() => {
    const slug = searchParams.get('loja');
    if (slug) return slug;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('loja');
  }, [searchParams]);

  React.useEffect(() => {
    const fetchWaitstaff = async () => {
      const targetStoreId = storeId || orders[0]?.store_id;
      if (!targetStoreId) return;
      
      const { supabase } = await import('../lib/supabase');
      const { data } = await supabase
        .from('waitstaff')
        .select('*')
        .eq('store_id', targetStoreId);
      
      if (data) setWaitstaff(data);
    };
    fetchWaitstaff();
  }, [orders, storeId]);
  
  const now = new Date();
  const currentMonthValue = now.getMonth() + 1;
  const currentYearValue = now.getFullYear();

  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthValue = previousMonthDate.getMonth() + 1;
  const previousYearValue = previousMonthDate.getFullYear();

  const [filterMonth, setFilterMonth] = useState<number>(currentMonthValue);
  const [filterYear, setFilterYear] = useState<number>(currentYearValue);
  const [filterDay, setFilterDay] = useState<number>(0); // 0 = Todos os dias do mês

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (settings?.hideUnpaidOnlineOrders && order.status === 'AGUARDANDO_PAGAMENTO') return false;

      const orderDate = new Date(order.createdAt);
      
      if (filterMonth === -1) {
        const isCurrent = orderDate.getFullYear() === currentYearValue && (orderDate.getMonth() + 1) === currentMonthValue;
        const isPrevious = orderDate.getFullYear() === previousYearValue && (orderDate.getMonth() + 1) === previousMonthValue;
        return isCurrent || isPrevious;
      }

      const matchesYear = orderDate.getFullYear() === filterYear;
      const matchesMonth = (orderDate.getMonth() + 1) === filterMonth;
      const matchesDay = filterDay === 0 || orderDate.getDate() === filterDay;
      return matchesYear && matchesMonth && matchesDay;
    });
  }, [orders, settings?.hideUnpaidOnlineOrders, filterDay, filterYear, filterMonth, currentMonthValue, currentYearValue, previousMonthValue, previousYearValue]);

  const totalSales = useMemo(() => filteredOrders
    .filter(o => o.status !== 'CANCELADO' && o.status !== 'PREPARANDO')
    .reduce((acc, o) => acc + (Number(o.total) || 0), 0), [filteredOrders]);
    
  const totalOrdersCount = filteredOrders.filter(o => o.status !== 'CANCELADO').length;
  const canceledOrdersCount = filteredOrders.filter(o => o.status === 'CANCELADO').length;
  
  const salesByProduct = useMemo(() => {
    const map = new Map<string, { name: string, category: string, quantity: number, total: number, isByWeight: boolean }>();
    filteredOrders.filter(o => o.status !== 'CANCELADO' && o.status !== 'PREPARANDO').forEach(order => {
        (order.items || []).forEach(item => {
          const productId = item.productId || 'unknown';
          const existing = map.get(productId);
          const qty = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          const subtotal = price * qty;
          if (existing) {
            existing.quantity += qty;
            existing.total += subtotal;
          } else {
            const productInfo = products.find(p => p.id === productId);
            map.set(productId, {
              name: item.name || 'Produto sem nome',
              category: productInfo?.category || 'Geral',
              quantity: qty,
              total: subtotal,
              isByWeight: !!item.isByWeight
            });
          }
        });
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredOrders, products]);

  const commissions = useMemo(() => {
    const comms = new Map<string, { name: string, totalSales: number, commissionValue: number, rate: number }>();
    
    filteredOrders.filter(o => o.status !== 'CANCELADO' && o.status !== 'PREPARANDO').forEach(order => {
      if (!order.waitstaffName) return;
      
      const staffName = order.waitstaffName.trim();
      const staffMember = waitstaff.find(w => w.name.trim().toLowerCase() === staffName.toLowerCase());
      
      const staffId = staffMember?.id || `name_${staffName}`;
      
      // Tenta pegar a taxa pelo ID (convertendo para string para garantir)
      let rate = 0;
      if (staffMember) {
        const idStr = String(staffMember.id);
        rate = settings.waitstaffCommissions?.[idStr] || 0;
        
        // Fallback: se não achou pelo ID, tenta ver se há alguma chave que bata com o ID
        if (rate === 0 && settings.waitstaffCommissions) {
          const foundKey = Object.keys(settings.waitstaffCommissions).find(k => String(k) === idStr);
          if (foundKey) rate = settings.waitstaffCommissions[foundKey];
        }
      }
      
      const existing = comms.get(staffId);
      const orderTotal = Number(order.total) || 0;
      const baseSales = orderTotal - (order.serviceFee || 0) - (order.deliveryFee || 0);
      
      // Se o serviceFee for 0 ou undefined, tenta calcular pela taxa se houver
      const commValue = (order.serviceFee && Number(order.serviceFee) > 0) 
        ? Number(order.serviceFee) 
        : baseSales * (rate / 100);
      
      if (existing) {
        existing.totalSales += baseSales;
        existing.commissionValue += commValue;
      } else {
        comms.set(staffId, {
          name: staffMember?.name || staffName,
          totalSales: baseSales,
          commissionValue: commValue,
          rate: rate
        });
      }
    });
    
    return Array.from(comms.values()).sort((a, b) => b.commissionValue - a.commissionValue);
  }, [filteredOrders, waitstaff, settings.waitstaffCommissions]);

  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const lojaParam = storeSlug ? `?loja=${storeSlug}` : '';

  const handleCopyLink = (type: string, urlSuffix: string = '') => {
    const separator = lojaParam ? '&' : '?';
    const finalSuffix = urlSuffix ? `${separator}${urlSuffix.replace('&', '')}` : '';
    const url = `${window.location.origin}/#/cardapio${lojaParam}${finalSuffix}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className={`space-y-8 pb-12 text-zinc-900 animate-fade-in ${isPrintingCommissionsOnly ? 'print-commissions-only' : ''}`}>
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
           <h1 className="text-3xl font-brand font-bold text-gray-800">Painel de Gestão</h1>
           <p className="text-gray-500 text-sm">Monitoramento em tempo real do faturamento.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-all active:scale-95 text-xs">
            <Printer size={16} className="text-secondary" /> Imprimir Tudo
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS - SIMPLIFICADA (SÓ DIA) */}
      <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-wrap items-center gap-6 no-print">
        <div className="flex items-center gap-3 text-primary">
            <Filter size={20} className="text-secondary" />
            <span className="text-xs font-black uppercase tracking-widest">Filtros:</span>
        </div>
        
        <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Selecionar Dia</label>
            <select 
                value={filterDay} 
                onChange={(e) => setFilterDay(Number(e.target.value))}
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-secondary/20 min-w-[150px] shadow-sm"
            >
                <option value={0}>Mês Inteiro (Todos)</option>
                {Array.from({ length: new Date(filterYear, filterMonth, 0).getDate() }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Apenas Dia {i + 1}</option>
                ))}
            </select>
        </div>

        <div className="flex gap-4">
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Selecionar Mês</label>
                <select 
                    value={filterMonth === -1 ? 'both' : `${filterYear}-${filterMonth}`}
                    onChange={(e) => {
                        if (e.target.value === 'both') {
                            setFilterMonth(-1);
                            setFilterYear(currentYearValue);
                            setFilterDay(0);
                        } else {
                            const [y, m] = e.target.value.split('-');
                            setFilterYear(Number(y));
                            setFilterMonth(Number(m));
                            setFilterDay(0); // reset day when changing month
                        }
                    }}
                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-secondary/20 min-w-[150px] shadow-sm"
                >
                    <option value="both">
                        Ambos os meses
                    </option>
                    <option value={`${currentYearValue}-${currentMonthValue}`}>
                        {months[currentMonthValue - 1]} / {currentYearValue} (Atual)
                    </option>
                    <option value={`${previousYearValue}-${previousMonthValue}`}>
                        {months[previousMonthValue - 1]} / {previousYearValue} (Anterior)
                    </option>
                </select>
            </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
            <div className="hidden lg:flex flex-col items-end">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total de Pedidos</p>
                <p className="text-sm font-bold text-primary">{filteredOrders.length}</p>
            </div>
            <div className="hidden lg:flex w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center text-orange-500 shadow-sm border border-orange-100">
                <Calendar size={22} />
            </div>
        </div>
      </div>

      {/* CABEÇALHO DE IMPRESSÃO - OTIMIZADO */}
      <div className="hidden print:block mb-8 border-b-2 border-primary pb-6">
          <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-brand font-bold text-primary">{settings.storeName}</h2>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Relatório Administrativo</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-primary uppercase tracking-tighter">Período Selecionado:</p>
                <p className="text-lg font-bold">
                    {filterMonth === -1 ? 'Últimos 2 Meses' : (filterDay !== 0 ? `${filterDay} de ` : 'Mês de ') + months[filterMonth - 1] + ' de ' + filterYear}
                </p>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
            {/* CARDS DE ATALHO (SUMIR NA IMPRESSÃO) */}
            <section className="space-y-3 no-print">
                <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Painéis Operacionais</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <OpPanelLink to={`/pdv${lojaParam}`} label="PDV / Caixa" icon={<ShoppingBag size={24} />} color="bg-green-50 text-green-600 border-green-100" />
                    <OpPanelLink to={`/atendimento${lojaParam}`} label="Atendimento" icon={<UserRound size={24} />} color="bg-orange-50 text-orange-600 border-orange-100" />
                    <OpPanelLink to={`/entregas${lojaParam}`} label="Entregas" icon={<Truck size={24} />} color="bg-blue-50 text-blue-600 border-blue-100" />
                    <OpPanelLink to={`/cozinha${lojaParam}`} label="Produção" icon={<ChefHat size={24} />} color="bg-blue-50 text-blue-600 border-blue-100" />
                    <OpPanelLink to={`/tv${lojaParam}`} label="Painel TV" icon={<Tv size={24} />} color="bg-purple-50 text-purple-600 border-purple-100" />
                    {onLogout && (
                        <button 
                            onClick={onLogout}
                            className="p-6 rounded-[2.5rem] flex flex-col items-center gap-3 border transition-all active:scale-95 bg-red-50 text-red-600 border-red-100 shadow-sm hover:shadow-xl group"
                        >
                            <div className="p-3 bg-white rounded-2xl shadow-sm transition-transform group-hover:scale-110">
                                <LogOut size={24} />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest">Sair</span>
                        </button>
                    )}
                </div>
            </section>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 no-print-commissions">
                <StatCard icon={<TrendingUp className="text-green-500" />} label="Faturamento" value={`R$ ${totalSales.toFixed(2)}`} color="bg-green-50" />
                <StatCard icon={<ShoppingBag className="text-blue-500" />} label="Vendas (Qtd)" value={totalOrdersCount.toString()} color="bg-blue-50" />
                <StatCard icon={<XCircle className="text-red-500" />} label="Cancelamentos" value={canceledOrdersCount.toString()} color="bg-red-50" />
            </div>

            {/* GRÁFICO */}
            <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 no-print-commissions">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <TrendingUp className="text-secondary" /> {filterDay !== 0 ? `Desempenho Dia ${filterDay}` : `Faturamento por Dia da Semana (${months[filterMonth-1]})`}
                </h2>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={generateChartData(filteredOrders)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                            <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                            <Bar dataKey="sales" radius={[10, 10, 10, 10]} barSize={20}>
                                {generateChartData(filteredOrders).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 5 || index === 6 ? '#f68c3e' : '#001F3F'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-[9px] text-gray-400 mt-4 text-center italic">Relatório gerado em {currentYearValue}. {filterDay === 0 ? "Exibindo média acumulada do mês." : `Exibindo dados do dia ${filterDay}.`}</p>
            </section>

            {/* RELATÓRIO DE PRODUTOS */}
            <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 no-print-commissions">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <ShoppingBag className="text-secondary" /> Detalhamento de Produtos
                </h2>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-10 bg-white">
                            <tr className="border-b border-gray-100">
                                <th className="pb-4 pt-2 text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white">Produto</th>
                                <th className="pb-4 pt-2 text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white">Categoria</th>
                                <th className="pb-4 pt-2 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right bg-white">Qtd</th>
                                <th className="pb-4 pt-2 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right bg-white">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {salesByProduct.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 text-sm font-bold text-gray-800">{item.name}</td>
                                    <td className="py-4 text-xs font-bold text-gray-500">{item.category}</td>
                                    <td className="py-4 text-sm font-black text-primary text-right">
                                        {item.isByWeight ? `${item.quantity.toFixed(3)} kg` : item.quantity}
                                    </td>
                                    <td className="py-4 text-sm font-black text-green-600 text-right">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total)}
                                    </td>
                                </tr>
                            ))}
                            {salesByProduct.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-sm font-bold text-gray-400">
                                        Nenhuma venda registrada neste período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* RELATÓRIO DE COMISSÕES */}
            <style>
              {`
                @media print {
                  .no-print { display: none !important; }
                  .print-commissions-only .no-print-commissions { display: none !important; }
                  body { background: white !important; margin: 0 !important; padding: 20px !important; }
                  .bg-white { border: none !important; box-shadow: none !important; padding: 0 !important; }
                  section { border: none !important; box-shadow: none !important; padding: 0 !important; margin-bottom: 20px !important; page-break-inside: avoid; }
                  table { width: 100% !important; border-collapse: collapse !important; }
                  th, td { border-bottom: 1px solid #eee !important; padding: 8px !important; }
                  .max-h-\[400px\] { max-height: none !important; overflow: visible !important; }
                  .overflow-y-auto { overflow: visible !important; }
                  .overflow-x-auto { overflow: visible !important; }
                }
              `}
            </style>
            <section className={`bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 ${commissions.length > 0 ? '' : 'no-print'}`}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <UserRound className="text-secondary" /> Comissões de Atendentes
                    </h2>
                    {commissions.length > 0 && (
                        <button 
                            onClick={() => {
                                setIsPrintingCommissionsOnly(true);
                                setTimeout(() => {
                                    window.print();
                                    setIsPrintingCommissionsOnly(false);
                                }, 100);
                            }} 
                            className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-secondary/20 transition-all no-print"
                        >
                            <Printer size={14} /> Imprimir Comissões
                        </button>
                    )}
                </div>
                <p className="text-xs text-gray-500 mb-4 no-print">Baseado em todos os pedidos lançados pelo atendente no período selecionado.</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Atendente</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Taxa (%)</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Total Vendas</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Comissão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {commissions.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 text-sm font-bold text-gray-800">{item.name}</td>
                                    <td className="py-4 text-sm font-bold text-gray-500 text-right">{item.rate}%</td>
                                    <td className="py-4 text-sm font-black text-primary text-right">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalSales)}
                                    </td>
                                    <td className="py-4 text-sm font-black text-green-600 text-right">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.commissionValue)}
                                    </td>
                                </tr>
                            ))}
                            {commissions.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-sm font-bold text-gray-400">
                                        Nenhuma comissão registrada para este período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>

        <div className="lg:col-span-4 space-y-8 no-print">
            {/* DIVULGAÇÃO (SUMIR NA IMPRESSÃO) */}
            <section className="bg-primary text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden print:hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary opacity-20 rounded-full blur-3xl"></div>
                <h2 className="text-xl font-brand font-bold mb-2 flex items-center gap-2">
                    <Smartphone className="text-secondary" /> Seu App na Mão
                </h2>
                <p className="text-white/60 text-xs mb-6 font-medium leading-relaxed">
                    Divulgue seu cardápio para os clientes instalarem o WebApp da sua unidade.
                </p>

                <div className="bg-white p-6 rounded-[2.5rem] flex flex-col items-center mb-6 shadow-2xl relative">
                    <div className="flex gap-2 w-full mb-4">
                       <button onClick={() => setQrMode('geral')} className={`flex-1 text-[9px] font-bold py-2 rounded-xl transition-all ${qrMode === 'geral' ? 'bg-primary text-white shadow' : 'bg-gray-100 text-gray-500'}`}>Geral</button>
                       <button onClick={() => setQrMode('local')} className={`flex-1 text-[9px] font-bold py-2 rounded-xl transition-all ${qrMode === 'local' ? 'bg-primary text-white shadow' : 'bg-gray-100 text-gray-500'}`}>Interno</button>
                       <button onClick={() => setQrMode('externo')} className={`flex-1 text-[9px] font-bold py-2 rounded-xl transition-all ${qrMode === 'externo' ? 'bg-primary text-white shadow' : 'bg-gray-100 text-gray-500'}`}>Externo</button>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 mb-4" id="print-qr-target">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/#/cardapio${lojaParam}${qrMode === 'local' ? '&modo=local' : qrMode === 'externo' ? '&modo=externo' : ''}`)}`} 
                          alt={`QR Code ${qrMode}`}
                          className="w-36 h-36"
                        />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">
                        QR Code {qrMode === 'geral' ? 'Completo' : qrMode === 'local' ? 'Atendimento Local' : 'para Delivery/Retirada'}
                    </p>
                    
                    <button 
                        onClick={() => {
                            const params = qrMode === 'local' ? '&modo=local' : qrMode === 'externo' ? '&modo=externo' : '';
                            const finalUrl = `${window.location.origin}/#/cardapio${lojaParam}${params.replace('&', '%26')}`;
                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(finalUrl)}`;
                            const printWindow = window.open('', '', 'width=600,height=800');
                            if(printWindow) {
                                printWindow.document.write(`
                                    <html>
                                        <head>
                                            <title>Imprimir QR Code</title>
                                            <style>
                                                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-center: center; text-align: center; height: 100vh; padding: 20px; }
                                                h1 { font-size: 28px; margin-bottom: 5px; color: #111; }
                                                p { font-size: 16px; color: #666; margin-bottom: 30px; }
                                                img { width: 300px; height: 300px; }
                                                .footer { margin-top: 30px; font-weight: bold; font-size: 18px; }
                                            </style>
                                        </head>
                                        <body>
                                            <h1>Escaneie para Acessar</h1>
                                            <p>Acesse nosso ${qrMode === 'local' ? 'Cardápio Local' : qrMode === 'externo' ? 'Cardápio de Delivery' : 'Cardápio Digital'}</p>
                                            <img src="${qrUrl}" onload="window.print();window.close()" />
                                            <div class="footer">${settings?.storeName || 'Nossa Loja'}</div>
                                        </body>
                                    </html>
                                `);
                                printWindow.document.close();
                            }
                        }}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-secondary/10 text-secondary rounded-xl font-bold hover:bg-secondary/20 transition-colors"
                    >
                        <Printer size={16} /> Imprimir QR Code
                    </button>
                </div>

                <div className="space-y-3">
                    <button 
                        onClick={() => handleCopyLink('geral')}
                        className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            {copiedLink === 'geral' ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-secondary" />}
                            <span className="text-xs font-bold">{copiedLink === 'geral' ? 'Copiado!' : 'Copiar Link Geral (Todos os tipos)'}</span>
                        </div>
                        {copiedLink !== 'geral' && <ChevronDown size={16} className="-rotate-90 opacity-20" />}
                    </button>
                    <button 
                        onClick={() => handleCopyLink('local', '&modo=local')}
                        className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            {copiedLink === 'local' ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-secondary" />}
                            <span className="text-xs font-bold">{copiedLink === 'local' ? 'Copiado!' : 'Copiar Link Atendimento Local (Mesas/Comandas)'}</span>
                        </div>
                        {copiedLink !== 'local' && <ChevronDown size={16} className="-rotate-90 opacity-20" />}
                    </button>
                    <button 
                        onClick={() => handleCopyLink('externo', '&modo=externo')}
                        className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            {copiedLink === 'externo' ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-secondary" />}
                            <span className="text-xs font-bold">{copiedLink === 'externo' ? 'Copiado!' : 'Copiar Link Externo (Entrega/Retirada)'}</span>
                        </div>
                        {copiedLink !== 'externo' && <ChevronDown size={16} className="-rotate-90 opacity-20" />}
                    </button>
                    <a 
                      href={`/#/cardapio${lojaParam}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="w-full flex items-center justify-between p-4 bg-secondary text-primary rounded-2xl font-bold transition-all shadow-lg active:scale-95"
                    >
                        <div className="flex items-center gap-3">
                            <ExternalLink size={18} />
                            <span className="text-xs uppercase tracking-wider font-black">Ver Cardápio Online</span>
                        </div>
                    </a>
                </div>
            </section>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: any) => (
    <div className={`${color} p-6 rounded-[2.5rem] flex items-center gap-5 border border-white/50 shadow-sm hover:shadow-lg transition-all print:border-gray-200 print:shadow-none print:bg-transparent`}>
        <div className="p-4 bg-white rounded-3xl shadow-sm border border-gray-50">{icon}</div>
        <div>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">{label}</p>
            <p className="text-xl font-black text-gray-800">{value}</p>
        </div>
    </div>
);

const OpPanelLink = ({ to, label, icon, color }: any) => (
    <a href={`#${to}`} target="_blank" rel="noreferrer" className={`p-6 rounded-[2.5rem] flex flex-col items-center gap-3 border transition-all active:scale-95 ${color} shadow-sm hover:shadow-xl group`}>
        <div className="p-3 bg-white rounded-2xl shadow-sm transition-transform group-hover:scale-110">{icon}</div>
        <span className="text-xs font-black uppercase tracking-widest">{label}</span>
    </a>
);

const generateChartData = (orders: Order[]) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const data = days.map(d => ({ name: d, sales: 0 }));
    orders.filter(o => o.status !== 'CANCELADO' && o.status !== 'PREPARANDO').forEach(o => {
        const day = new Date(o.createdAt).getDay();
        data[day].sales += Number(o.total) || 0;
    });
    // Reordenar para começar da Segunda-feira
    return [...data.slice(1), data[0]];
};

export default AdminDashboard;
