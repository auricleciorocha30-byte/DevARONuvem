import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Customer } from '../types';
import { Users, Plus, Edit2, Trash2, Search, Loader2, Award } from 'lucide-react';

export function CustomerManagement({ storeId }: { storeId?: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (storeId) {
      fetchCustomers();
    } else {
      setIsLoading(false);
    }
  }, [storeId]);

  const fetchCustomers = async () => {
    if (!storeId) return;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId)
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !storeId) return;
    setIsSaving(true);

    try {
      const { id, ...rest } = editingCustomer;
      const customerData = {
        name: rest.name || '',
        phone: rest.phone || '',
        cpf: rest.cpf || '',
        address: rest.address || '',
        referencePoint: rest.referencePoint || '',
        points: rest.points || 0,
        isLoyaltyParticipant: rest.isLoyaltyParticipant !== false,
        store_id: storeId,
        createdAt: rest.createdAt || Date.now()
      };

      if (id) {
        const { error } = await supabase
          .from('customers')
          .eq('id', id)
          .update(customerData);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([customerData]);
        if (error) throw error;
      }

      await fetchCustomers();
      setIsModalOpen(false);
      setEditingCustomer(null);
    } catch (err: any) {
      console.error('Error saving customer:', err);
      alert('Erro ao salvar cliente: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    
    try {
      const { error } = await supabase
        .from('customers')
        .eq('id', id)
        .delete();
      
      if (error) throw error;
      await fetchCustomers();
    } catch (err) {
      console.error('Error deleting customer:', err);
      alert('Erro ao excluir cliente.');
    }
  };

  const handleClearAllCashback = async () => {
    if (!storeId) return;
    if (!confirm('Tem certeza que deseja ZERAR o cashback de TODOS os clientes? Esta ação não pode ser desfeita.')) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .eq('store_id', storeId)
        .gt('points', 0)
        .update({ points: 0 });
      
      if (error) throw error;
      await fetchCustomers();
      alert('Cashback de todos os clientes foi zerado com sucesso.');
    } catch (err: any) {
      console.error('Error clearing all cashback:', err);
      alert('Erro ao zerar cashback: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" />
            Clientes
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie seus clientes e programa de fidelidade</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={handleClearAllCashback}
            disabled={isSaving || customers.length === 0}
            className="bg-orange-100 text-orange-600 px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-orange-200 transition-colors shadow-sm font-medium w-full sm:w-auto disabled:opacity-50"
          >
            <Trash2 size={20} />
            Zerar Cashback
          </button>
          <button
            onClick={() => {
              setEditingCustomer({ name: '', phone: '', points: 0, isLoyaltyParticipant: true });
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm font-medium w-full sm:w-auto"
          >
            <Plus size={20} />
            Novo Cliente
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                <tr className="text-gray-500 text-sm">
                  <th className="p-4 font-medium">Nome</th>
                  <th className="p-4 font-medium">Telefone</th>
                  <th className="p-4 font-medium">CPF</th>
                  <th className="p-4 font-medium">Endereço</th>
                  <th className="p-4 font-medium">Pontos</th>
                  <th className="p-4 font-medium text-center">Fidelidade</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-800">{customer.name || '-'}</td>
                    <td className="p-4 text-gray-600">{customer.phone || '-'}</td>
                    <td className="p-4 text-gray-600">{customer.cpf || '-'}</td>
                    <td className="p-4 text-gray-600 truncate max-w-[150px]" title={customer.address || ''}>{customer.address || '-'}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                        <Award size={14} />
                        {(customer.points || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${customer.isLoyaltyParticipant !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {customer.isLoyaltyParticipant !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingCustomer(customer);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-800 text-lg">
                {editingCustomer?.id ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Trash2 size={20} className="hidden" /> {/* Placeholder for alignment if needed, or just use X */}
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={editingCustomer?.name || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nome do cliente"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="tel"
                  required
                  value={editingCustomer?.phone || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  onBlur={e => {
                      let val = e.target.value.trim();
                      if (val && !val.startsWith('+55') && !val.startsWith('55')) {
                          val = '+55' + val;
                      } else if (val.startsWith('55')) {
                          val = '+' + val;
                      }
                      setEditingCustomer(prev => ({ ...prev, phone: val }));
                  }}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input
                  type="text"
                  value={editingCustomer?.cpf || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, cpf: e.target.value }))}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="000.000.000-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input
                  type="text"
                  value={editingCustomer?.address || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Rua, Número, Bairro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ponto de Referência</label>
                <input
                  type="text"
                  value={editingCustomer?.referencePoint || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, referencePoint: e.target.value }))}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Próximo a..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cashback Acumulado (R$)</label>
                <input
                  type="number"
                  min="0"
                  value={editingCustomer?.points || 0}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, points: parseFloat(e.target.value) || 0 }))}
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isLoyaltyParticipant"
                  checked={editingCustomer?.isLoyaltyParticipant !== false}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, isLoyaltyParticipant: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="isLoyaltyParticipant" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Participa do Programa de Cashback
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
