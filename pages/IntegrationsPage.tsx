import React, { useState } from 'react';
import { 
  Zap, 
  CreditCard, 
  FileText, 
  Blocks, 
  Save, 
  Shield, 
  Globe, 
  CheckCircle2, 
  AlertCircle,
  Key,
  Lock,
  Upload,
  Loader2
} from 'lucide-react';
import { StoreSettings } from '../types';

interface Props {
  settings: StoreSettings;
  onSave: (settings: Partial<StoreSettings>) => Promise<void>;
}

export default function IntegrationsPage({ settings, onSave }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<StoreSettings>>({
    focusNfeToken: settings.focusNfeToken || '',
    focusNfeEnvironment: settings.focusNfeEnvironment || 'homologation',
    focusNfeCertificate: settings.focusNfeCertificate || '',
    onlinePaymentProvider: settings.onlinePaymentProvider || 'mercado_pago',
    onlinePaymentAccessToken: settings.onlinePaymentAccessToken || '',
    onlinePaymentPublicKey: settings.onlinePaymentPublicKey || '',
    pagbankEnvironment: settings.pagbankEnvironment || 'sandbox',
    isOnlinePaymentActive: settings.isOnlinePaymentActive || false,
    mercadoPagoPointDeviceId: settings.mercadoPagoPointDeviceId || '',
  });

  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  const handleGeneratePagBankKey = async () => {
    if (!formData.onlinePaymentAccessToken) {
      alert('Informe o Token (Chave Privada) antes de gerar a Chave Pública.');
      return;
    }
    
    setIsGeneratingKey(true);
    try {
      const response = await fetch('/api/pagbank/public-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: formData.onlinePaymentAccessToken,
          environment: formData.pagbankEnvironment
        })
      });
      
      const data = await response.json();
      if (response.ok && data.public_key) {
        setFormData({ ...formData, onlinePaymentPublicKey: data.public_key });
        alert('Chave Pública gerada e preenchida com sucesso!');
      } else {
        alert('Erro ao gerar chave pública: ' + (data.error || 'Verifique seu token.'));
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao comunicar com o servidor.');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ ...settings, ...formData });
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <Blocks size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-brand font-bold text-gray-800">Integrações</h2>
            <p className="text-sm text-gray-500">Conecte sua loja com serviços externos de NF-e e Pagamentos (v2)</p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <Zap className="animate-spin" size={20} /> : <Save size={20} />}
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FOCUS NFE SECTION */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col h-full">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-green-50 text-green-600 rounded-2xl">
              <FileText size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Focus NF-e</h3>
              <p className="text-xs text-gray-500">Emissão de Notas Fiscais (NFC-e / NF-e)</p>
            </div>
          </div>

          <div className="space-y-6 flex-1">
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
              <AlertCircle className="text-blue-500 shrink-0" size={20} />
              <p className="text-xs text-blue-800 leading-relaxed">
                A Focus NF-e permite automatizar a emissão de notas fiscais. Você precisará de um token de API e o certificado digital A1 da sua empresa.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Ambiente</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, focusNfeEnvironment: 'homologation' })}
                    className={`py-3 rounded-xl font-bold text-xs transition-all border ${formData.focusNfeEnvironment === 'homologation' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                  >
                    Homologação (Testes)
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, focusNfeEnvironment: 'production' })}
                    className={`py-3 rounded-xl font-bold text-xs transition-all border ${formData.focusNfeEnvironment === 'production' ? 'bg-primary text-white border-primary shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                  >
                    Produção (Real)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Token da API</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input
                    type="password"
                    value={formData.focusNfeToken}
                    onChange={(e) => setFormData({ ...formData, focusNfeToken: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-sm"
                    placeholder="Seu token da Focus NFe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Certificado Digital (Base64)</label>
                <div className="relative">
                  <Upload className="absolute left-4 top-4 text-gray-300" size={18} />
                  <textarea
                    value={formData.focusNfeCertificate}
                    onChange={(e) => setFormData({ ...formData, focusNfeCertificate: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-xs h-32 resize-none"
                    placeholder="Cole aqui o conteúdo do certificado A1 em Base64"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-2 ml-1 italic">
                  * O certificado deve ser o arquivo .pfx convertido para Base64.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="text-green-500" size={16} />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Conexão Segura</span>
            </div>
            {formData.focusNfeToken && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-widest">
                <CheckCircle2 size={14} /> Configurado
              </span>
            )}
          </div>
        </div>

        {/* ONLINE PAYMENT SECTION */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                <CreditCard size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Pagamento Online</h3>
                <p className="text-xs text-gray-500">Receba via Pix e Cartão no Checkout</p>
              </div>
            </div>
            
            <button
              onClick={() => setFormData({ ...formData, isOnlinePaymentActive: !formData.isOnlinePaymentActive })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.isOnlinePaymentActive ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isOnlinePaymentActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="space-y-6 flex-1">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Provedor</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, onlinePaymentProvider: 'mercado_pago' })}
                    className={`py-3 rounded-xl font-bold text-[10px] transition-all border ${formData.onlinePaymentProvider === 'mercado_pago' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                  >
                    Mercado Pago
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, onlinePaymentProvider: 'pagbank' })}
                    className={`py-3 rounded-xl font-bold text-[10px] transition-all border ${formData.onlinePaymentProvider === 'pagbank' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                  >
                    PagBank
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, onlinePaymentProvider: 'asaas' })}
                    className={`py-3 rounded-xl font-bold text-[10px] transition-all border ${formData.onlinePaymentProvider === 'asaas' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                  >
                    Asaas
                  </button>
                </div>
              </div>

              {formData.onlinePaymentProvider === 'pagbank' && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Ambiente PagBank</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFormData({ ...formData, pagbankEnvironment: 'sandbox' })}
                      className={`py-3 rounded-xl font-bold text-xs transition-all border ${formData.pagbankEnvironment === 'sandbox' ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                      Sandbox (Testes)
                    </button>
                    <button
                      onClick={() => setFormData({ ...formData, pagbankEnvironment: 'production' })}
                      className={`py-3 rounded-xl font-bold text-xs transition-all border ${formData.pagbankEnvironment === 'production' ? 'bg-primary text-white border-primary shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                    >
                      Produção (Real)
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                  Access Token (Chave Privada)
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input
                    type="password"
                    value={formData.onlinePaymentAccessToken}
                    onChange={(e) => setFormData({ ...formData, onlinePaymentAccessToken: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-sm"
                    placeholder="APP_USR-..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                  Public Key (Chave Pública)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="text"
                      value={formData.onlinePaymentPublicKey}
                      onChange={(e) => setFormData({ ...formData, onlinePaymentPublicKey: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-sm"
                      placeholder="Identificador da Chave..."
                    />
                  </div>
                  {formData.onlinePaymentProvider === 'pagbank' && (
                    <button
                      onClick={handleGeneratePagBankKey}
                      disabled={isGeneratingKey}
                      className="px-6 bg-green-50 text-green-600 border border-green-100 rounded-2xl font-bold text-xs hover:bg-green-100 transition-all disabled:opacity-50"
                    >
                      {isGeneratingKey ? <Loader2 className="animate-spin" size={18} /> : 'Gerar Chave'}
                    </button>
                  )}
                </div>
                {formData.onlinePaymentProvider === 'pagbank' && (
                  <p className="text-[10px] text-gray-400 mt-2 ml-1 italic">
                    * Clique em "Gerar Chave" para obter a chave pública automaticamente usando seu Access Token.
                  </p>
                )}
              </div>

              {formData.onlinePaymentProvider === 'mercado_pago' && (
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">ID da Maquininha (Point Device ID)</label>
                  <div className="relative">
                    <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                      type="text"
                      value={formData.mercadoPagoPointDeviceId}
                      onChange={(e) => setFormData({ ...formData, mercadoPagoPointDeviceId: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-sm"
                      placeholder="Ex: 12345678"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 ml-1 italic">
                    * Necessário para enviar pagamentos diretamente para a maquininha Point.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <div className="flex gap-3 mb-2">
                <AlertCircle className="text-orange-500 shrink-0" size={18} />
                <h4 className="text-xs font-bold text-orange-900 uppercase tracking-wider">Atenção</h4>
              </div>
              <p className="text-[10px] text-orange-800 leading-relaxed">
                Ao ativar o pagamento online, os clientes poderão pagar diretamente no checkout. Certifique-se de configurar os Webhooks no painel do seu provedor para que o sistema receba as confirmações de pagamento automaticamente.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="text-blue-500" size={16} />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transações Criptografadas</span>
            </div>
            {formData.isOnlinePaymentActive && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                <CheckCircle2 size={14} /> Ativo
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
