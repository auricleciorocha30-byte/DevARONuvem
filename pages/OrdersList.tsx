
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, Product, OrderType, OrderItem, StoreSettings } from '../types';
import { Clock, Printer, UserRound, CheckCircle2, DollarSign, AlertCircle, MapPin, Phone, MessageSquare, Ticket, Percent, Navigation, CreditCard, Wallet, Banknote } from 'lucide-react';

interface Props {
  orders: Order[];
  updateStatus: (id: string, status: OrderStatus) => void;
  products: Product[];
  addOrder: (order: Order) => void;
  settings: StoreSettings;
}

interface GroupedOrder {
  id: string;
  displayId?: string;
  originalOrderIds: string[];
  type: OrderType;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  serviceFee?: number;
  createdAt: number;
  paymentMethod?: string;
  deliveryAddress?: string;
  referencePoint?: string;
  notes: string[];
  waitstaffName?: string;
  changeFor?: number;
  couponApplied?: string;
  discountAmount?: number;
  deliveryFee?: number;
}

const OrdersList: React.FC<Props> = ({ orders, updateStatus, products, addOrder, settings }) => {
  console.log("OrdersList received orders:", orders);
  const [filterType, setFilterType] = useState<'TODOS' | OrderType>('TODOS');
  const [printOrder, setPrintOrder] = useState<GroupedOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const displayGroups = useMemo(() => {
    const activeOrders = orders.filter(o => o.status !== 'ENTREGUE' && o.status !== 'CANCELADO');
    const filtered = activeOrders.filter(o => filterType === 'TODOS' || o.type === filterType);
    
    const groupsMap = new Map<string, GroupedOrder>();
    
    filtered.forEach(order => {
        const key = order.type === 'MESA' || order.type === 'COMANDA' 
            ? `${order.type}-${order.tableNumber}` 
            : `${order.type}-${order.customerName}-${order.customerPhone}`;
            
        if (groupsMap.has(key)) {
            const existing = groupsMap.get(key)!;
            order.items.forEach(newItem => {
                const existingItem = existing.items.find(i => i.productId === newItem.productId);
                if (existingItem) {
                    existingItem.quantity += newItem.quantity;
                } else {
                    existing.items.push({ ...newItem });
                }
            });
            existing.total += order.total;
            existing.serviceFee = (existing.serviceFee || 0) + (order.serviceFee || 0);
            existing.originalOrderIds.push(order.id);
            if (order.notes && order.notes.trim() !== "") existing.notes.push(order.notes);
        } else {
            groupsMap.set(key, {
                id: order.id,
                displayId: order.displayId,
                originalOrderIds: [order.id],
                type: order.type,
                tableNumber: order.tableNumber,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                items: [...order.items],
                status: order.status,
                total: order.total,
                serviceFee: order.serviceFee,
                createdAt: order.createdAt,
                paymentMethod: order.paymentMethod,
                deliveryAddress: order.deliveryAddress,
                notes: order.notes && order.notes.trim() !== "" ? [order.notes] : [],
                waitstaffName: order.waitstaffName,
                changeFor: order.changeFor,
                couponApplied: order.couponApplied,
                discountAmount: order.discountAmount,
                deliveryFee: order.deliveryFee
            });
        }
    });

    return Array.from(groupsMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, filterType]);

  const handlePrint = (group: GroupedOrder) => {
    setPrintOrder(group);
    setTimeout(() => { 
      window.print(); 
      setPrintOrder(null); 
    }, 200);
  };

  const handleStatusUpdate = async (group: GroupedOrder, newStatus: OrderStatus) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        const uniqueIds = Array.from(new Set(group.originalOrderIds));
        await Promise.all(uniqueIds.map(id => updateStatus(id, newStatus)));
    } finally {
        setIsProcessing(false);
    }
  };

  const getPaymentIcon = (method?: string) => {
    if (method === 'PIX') return <CreditCard size={14} className="text-blue-500" />;
    if (method === 'CARTAO') return <Wallet size={14} className="text-purple-500" />;
    if (method === 'DINHEIRO') return <Banknote size={14} className="text-green-500" />;
    return <DollarSign size={14} className="text-gray-400" />;
  };

  return (
    <div className="space-y-6 text-zinc-900">
      <style>{`
        @media print {
          @page { margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff !important; }
          body * { visibility: hidden; }
          #thermal-receipt, #thermal-receipt * { visibility: visible; }
          #thermal-receipt { 
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: ${settings.thermalPrinterWidth || '80mm'}; 
            padding: 5mm;
            background: #fff; 
            font-family: 'Courier New', monospace; 
            font-size: 10pt; 
            color: #000;
          }
        }
      `}</style>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['TODOS', 'MESA', 'BALCAO', 'ENTREGA'].map(f => (
            <button key={f} onClick={() => setFilterType(f as any)} className={`px-6 py-2.5 rounded-2xl font-bold text-sm border transition-all ${filterType === f ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>{f}</button>
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayGroups.map(group => (
          <div key={group.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col hover:shadow-xl transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 bg-gray-50 rounded-bl-2xl">
                <span className="text-[8px] font-black text-gray-300 uppercase">#{group.displayId || String(group.id).slice(-4)}</span>
            </div>

            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${group.type === 'ENTREGA' ? 'bg-green-100 text-green-600' : group.type === 'MESA' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                    {group.type} {group.tableNumber && `(Mesa ${group.tableNumber})`}
                  </span>
                  {group.waitstaffName && (
                    <span className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                      <UserRound size={10} /> {group.waitstaffName}
                    </span>
                  )}
                  <span className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full text-[8px] font-black uppercase flex items-center gap-1">
                    <Clock size={10} /> {new Date(group.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 truncate">
                  {group.customerName ? `${group.customerName} #${group.displayId || String(group.id).slice(-4)}` : `Pedido #${group.displayId || String(group.id).slice(-4)}`}
                </h3>
              </div>
              <button onClick={() => handlePrint(group)} className="p-3 bg-gray-50 text-gray-400 hover:text-orange-500 rounded-xl transition-colors shrink-0"><Printer size={20} /></button>
            </div>

            {/* DETALHES DE ENTREGA / CONTATO */}
            {(group.customerPhone || group.deliveryAddress) && (
              <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                 {group.customerPhone && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Phone size={14} className="text-gray-400" />
                            <span className="text-xs font-bold text-gray-700">{group.customerPhone}</span>
                        </div>
                        <a href={`https://wa.me/55${group.customerPhone.replace(/\D/g, '')}`} target="_blank" className="p-1 bg-green-500 text-white rounded-lg"><MessageSquare size={12} /></a>
                    </div>
                 )}
                 {group.deliveryAddress && (
                    <div className="flex items-start gap-2 pt-1 border-t border-gray-200 mt-1">
                        <MapPin size={14} className="text-red-400 shrink-0 mt-0.5" />
                        <span className="text-[10px] font-medium text-gray-600 leading-tight">{group.deliveryAddress}</span>
                    </div>
                 )}
              </div>
            )}

            <div className="flex-1 space-y-2 mb-6 border-t pt-4 max-h-48 overflow-y-auto custom-scrollbar">
              {group.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 font-medium">
                    <strong className="bg-zinc-100 px-1.5 py-0.5 rounded mr-1.5">{item.isByWeight ? `${item.quantity.toFixed(3)}kg` : `${item.quantity}x`}</strong> 
                    {item.name}
                  </span>
                  <span className="font-mono font-bold text-xs text-gray-400">R$ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {group.deliveryFee && group.deliveryFee > 0 ? (
                <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100">
                  <span className="text-gray-700 font-medium">Taxa de Entrega</span>
                  <span className="font-mono font-bold text-xs text-gray-400">R$ {group.deliveryFee.toFixed(2)}</span>
                </div>
              ) : null}
            </div>

            {group.notes.length > 0 && (
                <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <p className="text-[8px] font-black uppercase text-orange-400 tracking-widest mb-1">Observações</p>
                    {group.notes.map((n, i) => <p key={i} className="text-[10px] text-orange-800 italic leading-snug">"{n}"</p>)}
                </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <div className="p-2 bg-gray-50 rounded-lg">{getPaymentIcon(group.paymentMethod)}</div>
                   <div>
                      <p className="text-[8px] font-black text-gray-300 uppercase leading-none">Pagamento</p>
                      <p className="text-[10px] font-bold text-gray-700 uppercase">{group.paymentMethod || 'A Definir'}</p>
                   </div>
                </div>
                <div className="text-right">
                  {group.discountAmount && group.discountAmount > 0 && (
                    <p className="text-[10px] font-bold text-green-600 leading-none mb-1">Desconto: -R$ {group.discountAmount.toFixed(2)}</p>
                  )}
                  {group.serviceFee && group.serviceFee > 0 && (
                    <p className="text-[10px] font-bold text-gray-500 leading-none mb-1">Comissão: R$ {group.serviceFee.toFixed(2)}</p>
                  )}
                  <p className="text-2xl font-brand font-bold text-primary">R$ {group.total.toFixed(2)}</p>
                </div>
              </div>

              {group.changeFor && group.changeFor > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2">
                        <Banknote size={16} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Troco p/ R$ {group.changeFor.toFixed(2)}</span>
                    </div>
                    <span className="text-sm font-black text-blue-800">R$ {(group.changeFor - group.total).toFixed(2)}</span>
                </div>
              )}

              <div className="flex gap-2">
                 {group.status === 'PREPARANDO' && (
                   <button 
                    disabled={isProcessing}
                    onClick={() => handleStatusUpdate(group, 'PRONTO')} 
                    className={`flex-1 py-3.5 bg-secondary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                   >
                    Sinalizar Pronto
                   </button>
                 )}
                 <button 
                  disabled={isProcessing}
                  onClick={() => handleStatusUpdate(group, group.type === 'ENTREGA' ? 'ENVIADO_PARA_ENTREGA' : 'ENTREGUE')} 
                  className={`flex-1 py-3.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                  {group.type === 'ENTREGA' ? 'Enviar p/ Entrega' : 'Finalizar'}
                 </button>
                 <button 
                  disabled={isProcessing}
                  onClick={() => { if(window.confirm('Tem certeza que deseja cancelar este pedido? O estoque será restaurado.')) handleStatusUpdate(group, 'CANCELADO'); }} 
                  className={`flex-1 py-3.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                  Cancelar
                 </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {printOrder && (
          <div id="thermal-receipt">
              <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
                  <p style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '1mm' }}>{settings.storeName.toUpperCase()}</p>
                  {settings.address && <p style={{ fontSize: '7pt', lineHeight: '1.2', margin: '1mm 0' }}>{settings.address}</p>}
                  {settings.whatsapp && <p style={{ fontSize: '7pt' }}>WhatsApp: {settings.whatsapp}</p>}
                  <div style={{ borderTop: '1px solid #000', margin: '3mm 0' }}></div>
                  <p style={{ fontSize: '7pt' }}>EMISSÃO: {new Date().toLocaleString('pt-BR')}</p>
              </div>
              
              <div style={{ paddingBottom: '2mm' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '10pt', textAlign: 'center', marginBottom: '2mm' }}>
                    {printOrder.tableNumber ? `MESA: ${printOrder.tableNumber}` : `PEDIDO: #${printOrder.displayId || String(printOrder.id).slice(-4)}`}
                  </p>
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
                      {printOrder.items.map((it, i) => (
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

              {printOrder.notes.length > 0 && (
                <div style={{ borderTop: '1px dashed #000', padding: '2mm 0' }}>
                   <p style={{ fontSize: '8pt', fontWeight: 'bold' }}>OBSERVAÇÕES:</p>
                   {printOrder.notes.map((n, i) => <p key={i} style={{ fontSize: '8pt', fontStyle: 'italic' }}>- {n}</p>)}
                </div>
              )}

              <div style={{ borderTop: '1px solid #000', padding: '3mm 0', textAlign: 'right' }}>
                  <p style={{ fontSize: '9pt' }}>SUBTOTAL: R$ {(printOrder.total + (printOrder.discountAmount || 0) - (printOrder.deliveryFee || 0) - (printOrder.serviceFee || 0)).toFixed(2)}</p>
                  {printOrder.discountAmount && (
                    <p style={{ fontSize: '9pt', color: '#000' }}>DESCONTO ({printOrder.couponApplied || 'CUPOM'}): -R$ {printOrder.discountAmount.toFixed(2)}</p>
                  )}
                  {printOrder.serviceFee && printOrder.serviceFee > 0 ? (
                    <p style={{ fontSize: '9pt', color: '#000' }}>COMISSÃO: R$ {printOrder.serviceFee.toFixed(2)}</p>
                  ) : null}
                  {printOrder.deliveryFee && printOrder.deliveryFee > 0 ? (
                    <p style={{ fontSize: '9pt', color: '#000' }}>TAXA DE ENTREGA: R$ {printOrder.deliveryFee.toFixed(2)}</p>
                  ) : null}
                  <p style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '1mm' }}>TOTAL: R$ {printOrder.total.toFixed(2)}</p>
                  {(() => {
                      if (printOrder.paymentMethod === 'MISTO') {
                          // We need the original order to get paymentDetails
                          const originalOrder = orders.find(o => o.id === printOrder.originalOrderIds[0]);
                          if (originalOrder && originalOrder.paymentDetails) {
                              try {
                                  const details = JSON.parse(originalOrder.paymentDetails);
                                  return (
                                      <div style={{ fontSize: '8pt', marginTop: '1mm' }}>
                                          <p>PAGAMENTO:</p>
                                          {details.map((p: any, i: number) => (
                                              <p key={i} style={{ marginLeft: '10px' }}>{p.method}: R$ {p.amount.toFixed(2)}</p>
                                          ))}
                                      </div>
                                  );
                              } catch (e) {}
                          }
                      }
                      return <p style={{ fontSize: '8pt', marginTop: '1mm' }}>PAGAMENTO: {printOrder.paymentMethod || 'A DEFINIR'}</p>;
                  })()}
                  
                  {printOrder.changeFor && (
                    <div style={{ marginTop: '2mm' }}>
                        <p style={{ fontSize: '9pt' }}>PAGO EM DINHEIRO: R$ {printOrder.changeFor.toFixed(2)}</p>
                        <p style={{ fontSize: '10pt', fontWeight: 'bold' }}>TROCO: R$ {(printOrder.changeFor - printOrder.total).toFixed(2)}</p>
                    </div>
                  )}
              </div>
              
              <div style={{ borderTop: '1px dashed #000', marginTop: '4mm', paddingTop: '4mm', textAlign: 'center' }}>
                  <p style={{ fontSize: '8pt' }}>AGRADECEMOS A PREFERÊNCIA!</p>
                  <p style={{ fontSize: '6pt' }}>SISTEMA G & C CONVENIÊNCIA</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default OrdersList;
