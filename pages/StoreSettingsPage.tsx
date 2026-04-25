
import React, { useRef, useState, useEffect } from 'react';
import { StoreSettings, Product } from '../types';
import { Switch } from '../components/Switch';
import { supabase } from '../lib/supabase';
import { 
  Save, 
  ImageIcon, 
  Palette, 
  Camera, 
  Database, 
  Globe,
  Store,
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  CheckCircle2,
  Loader2,
  ExternalLink,
  MapPin,
  Phone,
  Ticket,
  Percent,
  Search,
  Check,
  Download,
  Upload,
  AlertTriangle,
  Power,
  Layers,
  LayoutGrid,
  Utensils,
  ChefHat,
  Tv,
  Printer,
  Settings,
  Tag,
  Clock,
  CreditCard,
  X 
} from 'lucide-react';

interface Props {
  settings: StoreSettings;
  products: Product[];
  onSave: (s: StoreSettings) => Promise<void>;
  storeId?: string;
}

const StoreSettingsPage: React.FC<Props> = ({ settings, products, onSave, storeId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [localSettings, setLocalSettings] = useState<StoreSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const allPaymentMethods = [
    { id: 'PIX', label: 'PIX' },
    { id: 'CARTAO', label: 'Cartão' },
    { id: 'DINHEIRO', label: 'Dinheiro' },
    { id: 'ONLINE', label: 'Pagamento Online' },
    { id: 'A_PAGAR', label: 'Pagar na Entrega' },
    { id: 'DEBITO', label: 'Débito' }
  ];

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { 
        alert("A imagem é muito grande. Escolha uma imagem de até 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64String = canvas.toDataURL('image/jpeg', 0.7);
          setLocalSettings(prev => ({ ...prev, logoUrl: base64String }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(localSettings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert("Erro ao salvar as configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    if (!window.confirm("Deseja gerar um backup completo dos dados do sistema?")) return;
    setIsExporting(true);
    try {
      const { data, error } = await (supabase as any).backupDatabase(storeId); 
      if (error) throw error;

      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DevARO_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro no backup:", error);
      alert("Falha ao gerar backup.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("AVISO CRÍTICO: Restaurar dados irá sobrescrever informações atuais. Deseja continuar?")) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonString = event.target?.result as string;
        const { success, error } = await (supabase as any).restoreDatabase(jsonString, storeId);
        
        if (error) throw error;
        
        alert("Restauração concluída com sucesso! O sistema será reiniciado.");
        window.location.reload();
      } catch (error: any) {
        console.error("Erro na restauração:", error);
        alert("Erro ao importar dados: " + error.message);
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConnectUsbPrinter = async () => {
    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      if (device) {
        setLocalSettings(prev => ({
          ...prev,
          usbPrinterVendorId: device.vendorId,
          usbPrinterProductId: device.productId
        }));
        alert(`Impressora USB conectada: ${device.productName || 'Dispositivo Desconhecido'}`);
      }
    } catch (error: any) {
      console.error("Erro ao conectar impressora USB:", error);
      alert("Não foi possível conectar a impressora USB. Verifique se ela está ligada e conectada.");
    }
  };

  const toggleProductSelection = (productId: string) => {
    const current = localSettings.applicableProductIds || [];
    if (current.includes(productId)) {
        setLocalSettings({...localSettings, applicableProductIds: current.filter(id => id !== productId)});
    } else {
        setLocalSettings({...localSettings, applicableProductIds: [...current, productId]});
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 text-zinc-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-brand font-bold text-gray-800">Identidade & Configurações</h1>
          <p className="text-gray-500">Personalize as cores, logo e canais de contato.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl active:scale-95 disabled:opacity-50 min-w-[180px]"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {isSaving ? "Salvando..." : "Salvar Agora"}
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-2xl flex items-center gap-3 animate-slide-up">
          <CheckCircle2 size={20} />
          Alterações aplicadas com sucesso!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {/* Coluna 1: Operação e Localização */}
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <MapPin size={18} /> Contato & Localização
            </h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Nome da Loja</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input type="text" value={localSettings.storeName} onChange={(e) => setLocalSettings({...localSettings, storeName: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">CNPJ</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input type="text" placeholder="00.000.000/0000-00" value={localSettings.cnpj || ''} onChange={(e) => setLocalSettings({...localSettings, cnpj: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Endereço Completo</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input type="text" placeholder="Rua, Número, Bairro, Cidade..." value={localSettings.address || ''} onChange={(e) => setLocalSettings({...localSettings, address: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">WhatsApp (Com DDD)</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input type="text" placeholder="Ex: 5511999999999" value={localSettings.whatsapp || ''} onChange={(e) => setLocalSettings({...localSettings, whatsapp: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Horário de Funcionamento</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-4 text-gray-300" size={18} />
                  <textarea placeholder="Ex: Seg a Sex: 08:00 às 18:00&#10;Sáb: 08:00 às 12:00" value={localSettings.businessHours || ''} onChange={(e) => setLocalSettings({...localSettings, businessHours: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none resize-none min-h-[100px]" />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Power size={16} /> Operação
            </h2>
            <div className={`p-4 rounded-2xl border-2 transition-all w-full flex items-center justify-between ${localSettings.isStoreOpen ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50'}`}>
              <span className={`text-sm font-bold ${localSettings.isStoreOpen ? 'text-green-700' : 'text-red-700'}`}>
                {localSettings.isStoreOpen ? 'LOJA ABERTA' : 'LOJA FECHADA'}
              </span>
              <Switch checked={localSettings.isStoreOpen ?? true} onChange={(v) => setLocalSettings({...localSettings, isStoreOpen: v})} />
            </div>

            <div className="w-full mt-6 space-y-3 pt-6 border-t border-gray-100">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest text-center mb-2">Módulos do Sistema</p>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Utensils size={16} className="text-orange-500" />
                        <span className="text-xs font-bold text-gray-600">Módulo Mesas</span>
                    </div>
                    <Switch checked={localSettings.isTableOrderActive} onChange={(v) => setLocalSettings({...localSettings, isTableOrderActive: v})} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Tag size={16} className="text-purple-500" />
                        <span className="text-xs font-bold text-gray-600">Módulo Comandas</span>
                    </div>
                    <Switch checked={localSettings.isCommandOrderActive ?? true} onChange={(v) => setLocalSettings({...localSettings, isCommandOrderActive: v})} />
                </div>
            </div>

            <div className="w-full mt-6 space-y-3 pt-6 border-t border-gray-100">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest text-center mb-2">Canais de Venda (Menu Digital)</p>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <ShoppingBag size={16} className="text-blue-500" />
                        <span className="text-xs font-bold text-gray-600">Pedidos Balcão</span>
                    </div>
                    <Switch checked={localSettings.isCounterPickupActive} onChange={(v) => setLocalSettings({...localSettings, isCounterPickupActive: v})} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Truck size={16} className="text-green-500" />
                        <span className="text-xs font-bold text-gray-600">Pedidos Entrega</span>
                    </div>
                    <Switch checked={localSettings.isDeliveryActive} onChange={(v) => setLocalSettings({...localSettings, isDeliveryActive: v})} />
                </div>
                {localSettings.isDeliveryActive && (
                  <div className="p-3 bg-gray-50 rounded-xl space-y-1 mt-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Pedido Mínimo (R$)</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0.00" 
                      value={localSettings.minDeliveryOrderValue === 0 ? '' : (localSettings.minDeliveryOrderValue || '')} 
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        if (!isNaN(val)) setLocalSettings({...localSettings, minDeliveryOrderValue: val});
                      }} 
                      className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 outline-none text-sm font-bold" 
                    />
                  </div>
                )}
            </div>
          </section>
          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center justify-center gap-2">
                  <CreditCard size={18} /> Meios de Pagamento
              </h2>
              <p className="text-[10px] uppercase text-gray-400 text-center mb-4">No Menu Digital</p>
              <div className="flex flex-col gap-2">
                  {allPaymentMethods.map(method => (
                      <div key={method.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-xs font-bold text-gray-600">{method.label}</span>
                          <Switch 
                              checked={localSettings.digitalMenuPaymentMethods ? localSettings.digitalMenuPaymentMethods.includes(method.id as any) : true} 
                              onChange={(checked) => {
                                  const current = localSettings.digitalMenuPaymentMethods || ['PIX', 'CARTAO', 'DINHEIRO', 'ONLINE', 'A_PAGAR', 'DEBITO'];
                                  let next;
                                  if (checked) {
                                      next = [...current, method.id];
                                  } else {
                                      next = current.filter(m => m !== method.id);
                                  }
                                  setLocalSettings({...localSettings, digitalMenuPaymentMethods: next as any});
                              }} 
                          />
                      </div>
                  ))}
              </div>
          </section>

          {localSettings.isDeliveryActive && (
            <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                  <Truck size={18} /> Taxa de Entrega
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-700">Por Distância</span>
                    <span className="text-[10px] text-gray-400">Calculada via GPS Mapeado.</span>
                  </div>
                  <Switch 
                    checked={localSettings.isDeliveryFeeActive === true} 
                    onChange={(checked) => setLocalSettings({...localSettings, isDeliveryFeeActive: checked})} 
                  />
                </div>

                {localSettings.isDeliveryFeeActive && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Tolerância Entrega Grátis (KM)</label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        placeholder="Ex: 2" 
                        value={localSettings.freeDeliveryToleranceKm === 0 ? '' : (localSettings.freeDeliveryToleranceKm || '')} 
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                          if (!isNaN(val)) setLocalSettings({...localSettings, freeDeliveryToleranceKm: val});
                        }} 
                        className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 outline-none text-sm font-bold" 
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Regras de Taxa</label>
                        <button 
                          onClick={() => {
                            const rules = localSettings.deliveryFeeRules || [];
                            setLocalSettings({...localSettings, deliveryFeeRules: [...rules, { upToKm: 5, fee: 5 }]});
                          }}
                          className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded-md font-bold uppercase"
                        >
                          + Adicionar Regra
                        </button>
                      </div>
                      
                      {(localSettings.deliveryFeeRules || []).map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1">
                            <span className="text-[10px] text-gray-400 block ml-1">Até (KM)</span>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              value={rule.upToKm === 0 ? '' : rule.upToKm} 
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  const newRules = [...(localSettings.deliveryFeeRules || [])];
                                  newRules[idx].upToKm = val;
                                  setLocalSettings({...localSettings, deliveryFeeRules: newRules});
                                }
                              }}
                              className="w-full px-2 py-1.5 bg-white rounded-lg border border-gray-200 outline-none text-sm font-bold" 
                            />
                          </div>
                          <div className="flex-1">
                            <span className="text-[10px] text-gray-400 block ml-1">Valor (R$)</span>
                            <input 
                              type="text" 
                              inputMode="decimal"
                              value={rule.fee === 0 ? '' : rule.fee} 
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                  const newRules = [...(localSettings.deliveryFeeRules || [])];
                                  newRules[idx].fee = val;
                                  setLocalSettings({...localSettings, deliveryFeeRules: newRules});
                                }
                              }}
                              className="w-full px-2 py-1.5 bg-white rounded-lg border border-gray-200 outline-none text-sm font-bold" 
                            />
                          </div>
                          <button 
                            onClick={() => {
                              const newRules = [...(localSettings.deliveryFeeRules || [])];
                              newRules.splice(idx, 1);
                              setLocalSettings({...localSettings, deliveryFeeRules: newRules});
                            }}
                            className="mt-4 p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <AlertTriangle size={16} />
                          </button>
                        </div>
                      ))}
                      {(!localSettings.deliveryFeeRules || localSettings.deliveryFeeRules.length === 0) && (
                        <p className="text-xs text-gray-400 text-center py-2">Nenhuma regra definida. A taxa será 0.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

        </div>

        {/* Coluna 2: Regras e Vendas */}
        <div className="space-y-6">

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Settings size={16} /> Regras de Negócio
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-700">Programa de Cashback</span>
                  <span className="text-[10px] text-gray-400">Ativa o acúmulo de cashback para clientes no PDV.</span>
                </div>
                <Switch 
                  checked={localSettings.isCashbackActive === true} 
                  onChange={(checked) => setLocalSettings({...localSettings, isCashbackActive: checked})} 
                />
              </div>
              {localSettings.isCashbackActive && (
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Porcentagem de Cashback (%)</label>
                    <input 
                      type="number" 
                      placeholder="5" 
                      value={localSettings.cashbackPercentage || ''} 
                      onChange={(e) => setLocalSettings({...localSettings, cashbackPercentage: Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 outline-none text-sm font-bold" 
                    />
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Valor Mínimo para Usar Cashback (R$)</label>
                    <input 
                      type="number" 
                      placeholder="10" 
                      value={localSettings.minCashbackToUse || ''} 
                      onChange={(e) => setLocalSettings({...localSettings, minCashbackToUse: Number(e.target.value)})} 
                      className="w-full px-3 py-2 bg-white rounded-lg border border-gray-200 outline-none text-sm font-bold" 
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Ticket size={18} /> Preço Promocional
              </h2>
              <Switch checked={localSettings.isCouponActive || false} onChange={(v) => setLocalSettings({...localSettings, isCouponActive: v})} />
            </div>
            
            <div className={`space-y-6 transition-all ${localSettings.isCouponActive ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Desconto (%)</label>
                  <div className="relative">
                    <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input type="number" placeholder="10" value={localSettings.couponDiscount || ''} onChange={(e) => setLocalSettings({...localSettings, couponDiscount: Number(e.target.value)})} className="w-full pl-4 pr-12 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold" />
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100">
                      <div className="flex items-center gap-3">
                          <Layers className="text-orange-600" size={20} />
                          <span className="text-sm font-bold text-orange-900">Aplicar em todos os produtos</span>
                      </div>
                      <Switch checked={localSettings.isCouponForAllProducts ?? true} onChange={(v) => setLocalSettings({...localSettings, isCouponForAllProducts: v})} />
                  </div>

                  {!localSettings.isCouponForAllProducts && (
                      <div className="space-y-4 animate-scale-up">
                          <div className="flex gap-2">
                              <div className="relative flex-1">
                                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                  <input 
                                      type="text" 
                                      placeholder="Buscar produtos para a promoção..." 
                                      value={productSearch}
                                      onChange={(e) => setProductSearch(e.target.value)}
                                      className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" 
                                  />
                              </div>
                              {localSettings.applicableProductIds && localSettings.applicableProductIds.length > 0 && (
                                <button
                                  onClick={() => setLocalSettings({...localSettings, applicableProductIds: []})}
                                  className="flex items-center gap-1.5 px-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 hover:bg-red-100 transition-colors font-bold text-xs"
                                  title="Remover todos selecionados"
                                >
                                  <X size={16} /> Limpar
                                </button>
                              )}
                          </div>

                          <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                              {filteredProducts.map(product => {
                                  const isSelected = localSettings.applicableProductIds?.includes(product.id);
                                  return (
                                      <button 
                                          key={product.id}
                                          onClick={() => toggleProductSelection(product.id)}
                                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                                      >
                                          <div className="relative">
                                            <img src={product.imageUrl} className="w-10 h-10 rounded-lg object-cover" />
                                            {isSelected && (
                                                <div className="absolute -top-1 -right-1 bg-orange-500 text-white p-0.5 rounded-full shadow-sm">
                                                    <Check size={10} />
                                                </div>
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                              <p className="text-xs font-bold text-gray-800 truncate">{product.name}</p>
                                              <p className="text-[10px] text-gray-400">{product.category}</p>
                                          </div>
                                      </button>
                                  );
                              })}
                          </div>
                      </div>
                  )}
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">QR Code Pix</h2>
            <div className="relative group cursor-pointer" onClick={() => document.getElementById('pix-upload')?.click()}>
              <div className="w-40 h-40 rounded-2xl border-4 border-blue-100 overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner relative transition-transform hover:scale-105">
                {localSettings.pixQrCodeUrl ? (
                  <img src={localSettings.pixQrCodeUrl} alt="QR Code Pix" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center text-gray-300">
                    <ImageIcon size={32} />
                    <span className="text-[10px] font-bold mt-2">Adicionar QR</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Camera size={32} className="text-white" />
                </div>
              </div>
              <input 
                id="pix-upload"
                type="file" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 1024 * 1024) { 
                      alert("A imagem é muito grande. Escolha uma imagem de até 1MB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 400;
                        const MAX_HEIGHT = 400;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                          if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                          }
                        } else {
                          if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                          }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx?.drawImage(img, 0, 0, width, height);
                        
                        const base64String = canvas.toDataURL('image/jpeg', 0.7);
                        setLocalSettings(prev => ({ ...prev, pixQrCodeUrl: base64String }));
                      };
                      img.src = reader.result as string;
                    };
                    reader.readAsDataURL(file);
                  }
                }} 
                className="hidden" 
                accept="image/*" 
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-4 text-center max-w-[200px]">
              Faça upload do QR Code do seu Pix para exibir no PDV.
            </p>
          </section>
        </div>

        {/* Coluna 3: Visual e Sistema */}
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">Logotipo do Menu</h2>
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-40 h-40 rounded-full border-4 border-orange-100 overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner relative transition-transform hover:scale-105">
                {localSettings.logoUrl ? (
                  <img src={localSettings.logoUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={48} className="text-gray-200" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Camera size={32} className="text-white" />
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Palette size={16} /> Cores da Identidade
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 uppercase">Cor Principal</span>
                <input type="color" value={localSettings.primaryColor} onChange={(e) => setLocalSettings({...localSettings, primaryColor: e.target.value})} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 uppercase">Cor Destaque</span>
                <input type="color" value={localSettings.secondaryColor} onChange={(e) => setLocalSettings({...localSettings, secondaryColor: e.target.value})} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent" />
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Printer size={16} /> Impressora Térmica
            </h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Largura do Papel (Padrão)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setLocalSettings({...localSettings, thermalPrinterWidth: '58mm', printWidthPx: 180})}
                    className={`py-3 rounded-xl font-bold text-sm transition-all ${localSettings.thermalPrinterWidth === '58mm' ? 'bg-primary text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  >
                    58mm
                  </button>
                  <button 
                    onClick={() => setLocalSettings({...localSettings, thermalPrinterWidth: '80mm', printWidthPx: 280})}
                    className={`py-3 rounded-xl font-bold text-sm transition-all ${localSettings.thermalPrinterWidth === '80mm' ? 'bg-primary text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  >
                    80mm
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-2">Ajuste Fino de Largura (Pixels)</label>
                <input 
                  type="number" 
                  value={localSettings.printWidthPx || (localSettings.thermalPrinterWidth === '58mm' ? 180 : 280)} 
                  onChange={(e) => setLocalSettings({...localSettings, printWidthPx: Number(e.target.value)})} 
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-sm" 
                />
                <p className="text-[10px] text-gray-400 ml-2">Diminua este valor (ex: de 200 para 180) se o texto estiver cortando na lateral.</p>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3">
                  Conecte uma impressora térmica USB para impressão direta de cupons.
                </p>
                <button 
                  onClick={handleConnectUsbPrinter}
                  className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer size={18} />
                  {localSettings.usbPrinterVendorId ? 'Alterar Impressora USB' : 'Conectar Impressora USB'}
                </button>
                {localSettings.usbPrinterVendorId && (
                  <div className="p-3 bg-green-50 text-green-700 rounded-xl text-xs font-bold flex items-center justify-between mt-3">
                    <span>Impressora Configurada</span>
                    <button 
                      onClick={() => setLocalSettings(prev => ({...prev, usbPrinterVendorId: undefined, usbPrinterProductId: undefined}))}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Database size={16} /> Manutenção de Dados
            </h2>
            <div className="space-y-4">
              <button onClick={handleBackup} disabled={isExporting} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-orange-50 rounded-2xl border border-gray-100 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-orange-500 shadow-sm"><Download size={18} /></div>
                  <span className="text-sm font-bold text-gray-700">Fazer Backup</span>
                </div>
                {isExporting ? <Loader2 size={16} className="animate-spin text-orange-500" /> : <Database size={16} className="text-gray-300 group-hover:text-orange-500" />}
              </button>
              <button onClick={() => importFileRef.current?.click()} disabled={isImporting} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 rounded-2xl border border-gray-100 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-blue-500 shadow-sm"><Upload size={18} /></div>
                  <span className="text-sm font-bold text-gray-700">Restaurar Dados</span>
                </div>
                {isImporting ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <Database size={16} className="text-gray-300 group-hover:text-blue-500" />}
              </button>
              <input type="file" ref={importFileRef} onChange={handleRestore} className="hidden" accept=".json" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default StoreSettingsPage;
