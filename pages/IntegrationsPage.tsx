import React from 'react';
import { Zap, CreditCard, FileText, Link as LinkIcon, Blocks } from 'lucide-react';

export default function IntegrationsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
          <Blocks size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-brand font-bold text-gray-800">Integrações</h2>
          <p className="text-sm text-gray-500">Conecte sua loja com serviços externos</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center space-y-4">
        <div className="w-20 h-20 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap size={40} />
        </div>
        <h3 className="text-xl font-bold text-gray-800">Em Breve: Central de Integrações</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Estamos preparando o terreno para conectar sua loja com os melhores serviços do mercado.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 pt-8 border-t border-gray-50 text-left">
          <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 flex gap-4 opacity-70">
            <div className="p-3 bg-white rounded-xl shadow-sm h-fit">
              <CreditCard className="text-blue-500" size={24} />
            </div>
            <div>
              <h4 className="font-bold text-gray-800">Pagamentos Online</h4>
              <p className="text-xs text-gray-500 mt-1">Integração com Mercado Pago, Pagar.me, Stripe e Pix Automático.</p>
            </div>
          </div>
          
          <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 flex gap-4 opacity-70">
            <div className="p-3 bg-white rounded-xl shadow-sm h-fit">
              <FileText className="text-green-500" size={24} />
            </div>
            <div>
              <h4 className="font-bold text-gray-800">Emissão de Notas Fiscais</h4>
              <p className="text-xs text-gray-500 mt-1">Emissão automática de NFC-e e NF-e integrada aos pedidos.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50 flex gap-4 opacity-70">
            <div className="p-3 bg-white rounded-xl shadow-sm h-fit">
              <LinkIcon className="text-orange-500" size={24} />
            </div>
            <div>
              <h4 className="font-bold text-gray-800">Ifood & Delivery</h4>
              <p className="text-xs text-gray-500 mt-1">Receba pedidos do iFood diretamente no seu painel.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
