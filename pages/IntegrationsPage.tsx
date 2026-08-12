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
  Loader2,
  Download,
  RefreshCw,
  Calendar,
  DownloadCloud,
  FileArchive
} from 'lucide-react';
import { StoreSettings } from '../types';

interface Props {
  settings: StoreSettings;
  onSave: (settings: Partial<StoreSettings>) => Promise<void>;
  storeId?: string;
}

export default function IntegrationsPage({ settings, onSave, storeId }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<StoreSettings>>({
    focusNfeToken: settings.focusNfeToken || '',
    focusNfeEnvironment: settings.focusNfeEnvironment || 'homologation',
    focusNfeCertificate: settings.focusNfeCertificate || '',
    focusNfeTaxReformActive: settings.focusNfeTaxReformActive ?? false,
    focusNfeIbsAliquot: settings.focusNfeIbsAliquot ?? 0.10,
    focusNfeCbsAliquot: settings.focusNfeCbsAliquot ?? 0.90,
    onlinePaymentProvider: settings.onlinePaymentProvider || 'mercado_pago',
    onlinePaymentAccessToken: settings.onlinePaymentAccessToken || '',
    onlinePaymentPublicKey: settings.onlinePaymentPublicKey || '',
    isOnlinePaymentActive: settings.isOnlinePaymentActive || false,
    mercadoPagoPointDeviceId: settings.mercadoPagoPointDeviceId || '',
    mercadoPagoWebhookSecret: settings.mercadoPagoWebhookSecret || '',
  });

  const [backups, setBackups] = useState<any[] | null>(null);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  const fetchBackups = async () => {
    if (!settings.focusNfeToken || !settings.cnpj) return;
    setIsLoadingBackups(true);
    setBackupError(null);
    try {
      const response = await fetch(`/api/focus-nfe/backups?token=${encodeURIComponent(settings.focusNfeToken)}&environment=${encodeURIComponent(settings.focusNfeEnvironment || 'homologation')}&cnpj=${encodeURIComponent(settings.cnpj)}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao consultar backups na API.');
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setBackups(data);
      } else if (data && typeof data === 'object' && data.error) {
        throw new Error(data.error);
      } else {
        setBackups([]);
      }
    } catch (err: any) {
      console.error(err);
      setBackupError(err.message || 'Erro de conexão ao buscar backups.');
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleDownload = async (path: string, fileName: string) => {
    if (!settings.focusNfeToken) return;
    setDownloadingPath(path);
    try {
      const url = `/api/focus-nfe/download-backup?token=${encodeURIComponent(settings.focusNfeToken)}&environment=${encodeURIComponent(settings.focusNfeEnvironment || 'homologation')}&path=${encodeURIComponent(path)}`;
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar o download do arquivo.');
    } finally {
      setDownloadingPath(null);
    }
  };

  const formatBackupMonth = (mesStr: string) => {
    if (mesStr && mesStr.length === 6) {
      const year = mesStr.substring(0, 4);
      const month = mesStr.substring(4, 6);
      return `${month}/${year}`;
    }
    return mesStr;
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
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col h-full relative">
          {settings?.lockedFeatures?.includes('NFE') && (
            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] rounded-[2.5rem] flex items-center justify-center cursor-not-allowed" onClick={(e) => { e.stopPropagation(); alert("Fale com seu consultor para desbloquear a emissão de notas fiscais."); }}>
                <div className="bg-white p-4 rounded-2xl shadow-xl flex flex-col items-center gap-2 border border-red-100 pointer-events-none">
                    <Lock className="text-red-500" size={32} />
                    <span className="text-xs font-bold text-gray-800">Módulo Bloqueado</span>
                </div>
            </div>
          )}
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
                <p className="text-[10px] text-gray-400 mt-2 ml-1 italic leading-relaxed">
                  * Nota: O token do ambiente de <strong className="text-gray-500 whitespace-nowrap">Produção</strong> é <strong>diferente</strong> do token de <strong className="text-gray-500 whitespace-nowrap">Homologação</strong>. Certifique-se de configurar o token correto para o ambiente escolhido.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Certificado Digital (Base64) - Opcional</label>
                <div className="relative">
                  <Upload className="absolute left-4 top-4 text-gray-300" size={18} />
                  <textarea
                    value={formData.focusNfeCertificate}
                    onChange={(e) => setFormData({ ...formData, focusNfeCertificate: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-xs h-32 resize-none"
                    placeholder="Cole aqui apenas se não configurou no painel da Focus"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-2 ml-1 italic leading-relaxed">
                  * Se você já fez o upload do Certificado A1 diretamente na plataforma da Focus NFe, pode deixar este campo vazio! O sistema usará o certificado instalado lá automaticamente através do Token.
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
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 flex flex-col h-full relative">
          {settings?.lockedFeatures?.includes('ONLINE_PAYMENT') && (
            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] rounded-[2.5rem] flex items-center justify-center cursor-not-allowed" onClick={(e) => { e.stopPropagation(); alert("Fale com seu consultor para desbloquear o Pagamento Online."); }}>
                <div className="bg-white p-4 rounded-2xl shadow-xl flex flex-col items-center gap-2 border border-red-100 pointer-events-none">
                    <Lock className="text-red-500" size={32} />
                    <span className="text-xs font-bold text-gray-800">Módulo Bloqueado</span>
                </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl relative">
                <CreditCard size={32} />
                {settings?.lockedFeatures?.includes('ONLINE_PAYMENT') && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1" title="Funcionalidade Bloqueada - Fale com seu consultor">
                    <Lock size={12} />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Pagamento Online</h3>
                <p className="text-xs text-gray-500">Receba via Pix e Cartão no Checkout</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                if (settings?.lockedFeatures?.includes('ONLINE_PAYMENT')) {
                    alert("Fale com seu consultor para desbloquear esta funcionalidade.");
                    return;
                }
                setFormData({ ...formData, isOnlinePaymentActive: !formData.isOnlinePaymentActive })
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.isOnlinePaymentActive ? 'bg-blue-600' : 'bg-gray-200'} ${settings?.lockedFeatures?.includes('ONLINE_PAYMENT') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isOnlinePaymentActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="space-y-6 flex-1">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Provedor</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, onlinePaymentProvider: 'mercado_pago' })}
                    className={`py-3 rounded-xl font-bold text-[10px] transition-all border ${formData.onlinePaymentProvider === 'mercado_pago' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                  >
                    Mercado Pago
                  </button>
                </div>
              </div>

              {formData.onlinePaymentProvider === 'mercado_pago' && (
                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 space-y-4 transition-all">
                  <h4 className="text-sm font-bold text-blue-900 border-b border-blue-100 pb-2">Passo a Passo: Integração Multi-lojas Mercado Pago</h4>
                  <div className="space-y-4 mt-2">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">1</div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-blue-900">Acesse o Mercado Pago Developers</p>
                        <p className="text-[10px] text-blue-800 leading-relaxed">
                          Acesse o <a href="https://www.mercadopago.com.br/developers/panel" target="_blank" rel="noreferrer" className="underline font-bold">painel de desenvolvedor</a> logado com a <strong>conta do Mercado Pago desta respectiva loja</strong> (a conta para a qual os pagamentos irão). Crie uma nova aplicação no painel com um nome sugestivo (ex: Loja Centro Webhooks).
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">2</div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-blue-900">Copie as Credenciais</p>
                        <p className="text-[10px] text-blue-800 leading-relaxed">
                          No menu lateral esquerdo da sua aplicação no MP, clique em <strong>Credenciais de Produção</strong>. Copie o seu <strong>Access Token (Chave Privada)</strong> e a sua <strong>Public Key (Chave Pública)</strong> e cole nos devidos campos abaixo.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">3</div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-blue-900">Configure a URL de Webhook única desta Loja</p>
                        <p className="text-[10px] text-blue-800 leading-relaxed">
                          No menu lateral, acesse <strong>Notificações &gt; Webhooks</strong>. No campo de URL para envio, cole a <strong>Sua URL de Webhook</strong> gerada no final deste formulário. Essa URL é <strong className="text-blue-900 bg-blue-200/50 px-1 rounded">exclusiva e única para esta loja</strong> recebendo eventos de pagamentos dela. Marque o evento <strong>Pagamentos (payments)</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">4</div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-blue-900">Cole a Assinatura Secreta</p>
                        <p className="text-[10px] text-blue-800 leading-relaxed">
                          Após adicionar o webhook e salvar as alterações no Mercado Pago, irá aparecer na tela do MP uma <strong>Assinatura secreta</strong>. Copie esse código e cole logo no campo "Assinatura Secreta do Webhook" aqui embaixo e Salve!
                        </p>
                      </div>
                    </div>
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
                </div>
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

              {formData.onlinePaymentProvider === 'mercado_pago' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">
                      Assinatura Secreta do Webhook (Secret)
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <input
                        type="password"
                        value={formData.mercadoPagoWebhookSecret}
                        onChange={(e) => setFormData({ ...formData, mercadoPagoWebhookSecret: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-sm"
                        placeholder="Gerada no painel do Mercado Pago"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 ml-1 italic">
                      * Cole aqui a "Assinatura secreta" gerada no painel de Webhooks do Mercado Pago para sua segurança.
                    </p>
                  </div>

                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <Globe className="text-indigo-600" size={16} />
                      <h4 className="text-xs font-bold text-indigo-900 uppercase">Sua URL de Webhook</h4>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-indigo-200">
                      <code className="text-[9px] font-mono break-all flex-1 text-indigo-800">
                        {window.location.origin}/api/webhooks/mercadopago/{storeId || 'ID_DA_LOJA'}
                      </code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/mercadopago/${storeId || 'ID_DA_LOJA'}`);
                          alert('URL copiada para a área de transferência!');
                        }}
                        className="p-1 hover:bg-indigo-50 text-indigo-600 rounded"
                      >
                        <Upload size={14} />
                      </button>
                    </div>
                    <p className="text-[9px] text-indigo-600 italic">
                      Copie esta URL e cole no campo "URL para envio" no painel do Mercado Pago.
                    </p>
                  </div>
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

      {/* PAINEL DE GESTÃO FISCAL & REFORMA TRIBUTÁRIA */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-50">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl">
              <FileText size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Módulo de Gestão Fiscal & Reforma Tributária</h3>
              <p className="text-xs text-gray-500">
                Consulte e exporte backups fiscais da Focus NFe e configure as alíquotas da Reforma Tributária (IBS/CBS)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* COLUNA ESQUERDA: REFORMA TRIBUTÁRIA */}
          <div className="space-y-6">
            <div>
              <h4 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-2">
                <Shield className="text-orange-500" size={18} />
                Reforma Tributária (IBS e CBS)
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                A Reforma Tributária (PEC 45/2019) introduz a Contribuição sobre Bens e Serviços (CBS - Federal) e o Imposto sobre Bens e Serviços (IBS - Estadual/Municipal). 
                Durante o período de transição (iniciado em Janeiro de 2026), as alíquotas de teste aplicáveis são de <strong>0,10% para IBS</strong> e <strong>0,90% para CBS</strong> de forma facultativa para empresas do Simples Nacional.
              </p>
            </div>

            <div className="p-5 bg-orange-50/50 rounded-2xl border border-orange-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-orange-950 block">Ativar Envio de IBS / CBS</span>
                  <span className="text-[10px] text-orange-800 leading-none">Inclui o Grupo de Tributação sobre Bens e Serviços no XML</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, focusNfeTaxReformActive: !formData.focusNfeTaxReformActive })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.focusNfeTaxReformActive ? 'bg-orange-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.focusNfeTaxReformActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {formData.focusNfeTaxReformActive && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-orange-100/50">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-orange-900 mb-1">
                      Alíquota IBS (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.focusNfeIbsAliquot}
                      onChange={(e) => setFormData({ ...formData, focusNfeIbsAliquot: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-orange-200 rounded-xl outline-none text-xs text-orange-950 font-bold focus:border-orange-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-orange-900 mb-1">
                      Alíquota CBS (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.focusNfeCbsAliquot}
                      onChange={(e) => setFormData({ ...formData, focusNfeCbsAliquot: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-orange-200 rounded-xl outline-none text-xs text-orange-950 font-bold focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 block mb-1">Status de Atualização</span>
              <p className="text-[10px] text-blue-900 leading-relaxed">
                <strong>Simples Nacional:</strong> Para empresas sob o regime do Simples Nacional (como as optantes por esse regime), o envio desses campos na NFC-e é <strong>opcional até Dezembro de 2026</strong>, tornando-se obrigatório apenas em Janeiro de 2027. O sistema já está totalmente compatível e pronto para transmitir os campos assim que você decidir ativar ou quando a obrigatoriedade for iniciada.
              </p>
            </div>
          </div>

          {/* COLUNA DIREITA: CONSULTA & EXPORTAÇÃO FISCAL (BACKUPS) */}
          <div className="space-y-6">
            <div>
              <h4 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-2">
                <DownloadCloud className="text-green-600" size={18} />
                Consultar & Exportar Backups (XML / DANFEs)
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                A Focus NFe gera pacotes de backup mensais em arquivos compactados contendo todos os XMLs assinados e PDFs das DANFEs geradas. Os emissores de notas fiscais têm a obrigação legal de armazenar os XMLs por no mínimo 5 anos.
              </p>
            </div>

            {(!settings.focusNfeToken || !settings.cnpj) ? (
              <div className="p-6 bg-gray-50 border border-gray-100 rounded-3xl flex flex-col items-center text-center space-y-3">
                <AlertCircle className="text-gray-400" size={32} />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-700 block">Configurações Incompletas</span>
                  <p className="text-[10px] text-gray-500 max-w-sm">
                    Para consultar e baixar os backups, você precisa configurar o <strong>Token da Focus NFe</strong> nesta página e o <strong>CNPJ</strong> nas Configurações da Loja, e salvar as alterações.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fetchBackups}
                    disabled={isLoadingBackups}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs transition-all shadow-md active:scale-98"
                  >
                    {isLoadingBackups ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    {backups ? 'Atualizar Lista de Backups' : 'Consultar Backups Focus NFe'}
                  </button>
                </div>

                {backupError && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-xs flex gap-2">
                    <AlertCircle className="shrink-0" size={16} />
                    <span>{backupError}</span>
                  </div>
                )}

                {isLoadingBackups && (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-400">
                    <Loader2 className="animate-spin text-green-600" size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Buscando backups por CNPJ...</span>
                  </div>
                )}

                {backups && backups.length === 0 && !isLoadingBackups && (
                  <div className="py-8 text-center text-gray-400 border border-dashed border-gray-100 rounded-2xl text-xs">
                    Nenhum backup de arquivos fiscais gerado pela Focus NFe foi encontrado para o CNPJ {settings.cnpj}.
                  </div>
                )}

                {backups && backups.length > 0 && !isLoadingBackups && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {backups.map((bk, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100/70 border border-gray-100 rounded-xl transition-all">
                        <div className="flex items-center gap-2">
                          <Calendar className="text-gray-400" size={16} />
                          <span className="text-xs font-bold text-gray-700">{formatBackupMonth(bk.mes)}</span>
                        </div>
                        <div className="flex gap-2">
                          {bk.xmls && (
                            <button
                              type="button"
                              onClick={() => handleDownload(bk.xmls, `xml_backup_${bk.mes}.zip`)}
                              disabled={downloadingPath !== null}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-[10px] font-bold transition-all"
                            >
                              <FileArchive size={12} />
                              XMLs (.zip)
                            </button>
                          )}
                          {bk.danfes && (
                            <button
                              type="button"
                              onClick={() => handleDownload(bk.danfes, `danfe_backup_${bk.mes}.zip`)}
                              disabled={downloadingPath !== null}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold transition-all"
                            >
                              <Download size={12} />
                              DANFEs (.zip)
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
