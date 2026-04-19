
import React, { useState, useEffect } from 'react';
import { StoreSettings, Waitstaff, StoreProfile } from '../types';
import { Switch } from '../components/Switch';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Printer, 
  UserPlus, 
  Trash2, 
  Users,
  Loader2,
  ShieldAlert,
  Crown,
  AlertCircle,
  Truck,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  currentStore: StoreProfile;
  settings: StoreSettings;
  onUpdateSettings: (s: StoreSettings) => void;
}

const WaitstaffManagement: React.FC<Props> = ({ currentStore, settings, onUpdateSettings }) => {
  const [staff, setStaff] = useState<Waitstaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'GERENTE' | 'ATENDENTE' | 'ENTREGADOR'>('ATENDENTE');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStaff();
  }, [currentStore.id]);

  const fetchStaff = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('waitstaff')
      .select('*')
      .eq('store_id', currentStore.id)
      .order('role')
      .order('name');
    
    if (data) setStaff(data as Waitstaff[]);
    setLoading(false);
  };

  const togglePermission = (key: keyof StoreSettings) => {
    onUpdateSettings({ ...settings, [key]: !settings[key] });
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPass) return;
    setIsSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('waitstaff').update({
          name: newName, 
          password: newPass,
          phone: newPhone,
          role: newRole
        }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('waitstaff').insert([{ 
          store_id: currentStore.id,
          name: newName, 
          password: newPass,
          phone: newPhone,
          role: newRole 
        }]);
        if (error) throw error;
      }
      resetForm();
      fetchStaff();
    } catch (err: any) {
      alert(`Erro ao ${editingId ? 'editar' : 'adicionar'} colaborador: ` + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewPass('');
    setNewPhone('');
    setNewRole('ATENDENTE');
    setEditingId(null);
  };

  const handleEditStaff = (member: Waitstaff) => {
    setNewName(member.name);
    setNewPass(member.password || '');
    setNewPhone(member.phone || '');
    setNewRole(member.role);
    setEditingId(member.id);
  };

  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm("Remover este membro da equipe?")) return;
    await supabase.from('waitstaff').eq('id', id).delete();
    fetchStaff();
  };

  const handleUpdateCommission = (staffId: string, percentage: number) => {
    const currentCommissions = settings.waitstaffCommissions || {};
    onUpdateSettings({
      ...settings,
      waitstaffCommissions: {
        ...currentCommissions,
        [staffId]: percentage
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl text-zinc-900">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Permissões de Atendimento</h2>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
             <AlertCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
             <p className="text-[11px] text-blue-700 font-bold uppercase leading-snug">
               Nota: Estas restrições aplicam-se apenas aos usuários com cargo de "ATENDENTE". Usuários "GERENTE" possuem acesso total irrestrito.
             </p>
          </div>

          <div className="space-y-4 flex-1">
            <PermissionCard 
              title="Finalizar Pedidos" 
              description="Permite que o atendente marque pedidos como ENTREGUES."
              icon={<CheckCircle2 className="text-green-500" />}
              checked={settings.canWaitstaffFinishOrder}
              onChange={() => togglePermission('canWaitstaffFinishOrder')}
            />
            <PermissionCard 
              title="Cancelar/Excluir Itens" 
              description="Permite que o atendente cancele pedidos ou remova itens."
              icon={<XCircle className="text-red-500" />}
              checked={settings.canWaitstaffCancelItems}
              onChange={() => togglePermission('canWaitstaffCancelItems')}
            />
          </div>
        </section>

        <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-8">
            <div className={`p-3 rounded-2xl text-white shadow-lg ${editingId ? 'bg-blue-500' : 'bg-orange-500'}`}>
              {editingId ? <Edit2 size={24} /> : <UserPlus size={24} />}
            </div>
            <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Editar Membro' : 'Novo Membro'}</h2>
          </div>
          
          <form onSubmit={handleAddStaff} className="space-y-4 mb-8">
            <div className="grid grid-cols-1 gap-4">
              <input 
                type="text" 
                placeholder="Nome do Atendente" 
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                required
              />
              <input 
                type="password" 
                placeholder="Senha de Acesso" 
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                className="p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                required
              />
              {newRole === 'ENTREGADOR' && (
                <input 
                  type="tel" 
                  placeholder="Telefone/WhatsApp do Entregador" 
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                />
              )}
              <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
                {(['ATENDENTE', 'GERENTE', 'ENTREGADOR'] as const).map(role => (
                   <button 
                     key={role}
                     type="button"
                     onClick={() => setNewRole(role)}
                     className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${newRole === role ? 'bg-primary text-white shadow-md' : 'text-gray-400'}`}
                   >
                     {role === 'GERENTE' ? <Crown size={14}/> : role === 'ENTREGADOR' ? <Truck size={14}/> : <Users size={14}/>}
                     {role}
                   </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                type="submit" 
                disabled={isSaving}
                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : (editingId ? <Save size={20}/> : <UserPlus size={20}/>)}
                {editingId ? 'Salvar Alterações' : 'Adicionar à Equipe'}
              </button>
              {editingId && (
                <button 
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 active:scale-95 transition-all"
                >
                  <X size={20}/>
                </button>
              )}
            </div>
          </form>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Equipe Atual</h3>
            {loading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-gray-200" /></div> : 
              staff.length === 0 ? <p className="text-center py-10 text-gray-300 italic text-sm">Nenhum membro cadastrado.</p> :
              staff.map(member => (
                <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${member.role === 'GERENTE' ? 'bg-orange-50 text-orange-500 border-orange-100' : member.role === 'ENTREGADOR' ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-white text-primary border-gray-200'}`}>
                      {member.role === 'GERENTE' ? <Crown size={18} /> : member.role === 'ENTREGADOR' ? <Truck size={18} /> : <Users size={18} />}
                    </div>
                    <div>
                      <span className="font-bold text-gray-700 block leading-none">{member.name}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{member.role}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(member.role === 'ATENDENTE' || member.role === 'GERENTE') && (
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase hidden sm:inline">Comissão:</span>
                        <div className="relative w-20">
                          <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            step="0.1"
                            value={settings.waitstaffCommissions?.[member.id] || ''}
                            onChange={(e) => handleUpdateCommission(member.id, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full py-1.5 px-2 pr-6 text-sm font-bold text-right bg-white border border-gray-200 rounded-lg outline-none focus:border-orange-500"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                        </div>
                      </div>
                    )}
                    <button onClick={() => handleEditStaff(member)} className="p-2 text-blue-300 hover:text-blue-500 transition-colors"><Edit2 size={18}/></button>
                    <button onClick={() => handleDeleteStaff(member.id)} className="p-2 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))
            }
          </div>
        </section>
      </div>
    </div>
  );
};

const PermissionCard = ({ title, description, icon, checked, onChange }: { title: string, description: string, icon: React.ReactNode, checked: boolean, onChange: (v: boolean) => void }) => (
  <div className={`p-5 rounded-3xl border-2 transition-all ${checked ? 'border-blue-100 bg-blue-50/20' : 'border-gray-50 bg-gray-50/50'}`}>
    <div className="flex items-center justify-between mb-3">
      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">{icon}</div>
      <Switch checked={checked} onChange={onChange} />
    </div>
    <h3 className="font-bold text-gray-800 text-sm mb-1">{title}</h3>
    <p className="text-[10px] text-gray-500 leading-tight">{description}</p>
  </div>
);

export default WaitstaffManagement;
