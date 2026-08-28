import React, { useState } from 'react';
import { ShieldCheck, X, Loader2, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ManagerPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  onSuccess: () => void;
  title: string;
  actionDescription?: string;
}

export default function ManagerPasswordModal({
  isOpen,
  onClose,
  storeId,
  onSuccess,
  title,
  actionDescription
}: ManagerPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      // Query waitstaff for GERENTE with matching password in this store
      const { data, error } = await supabase
        .from('waitstaff')
        .select('*')
        .eq('store_id', storeId)
        .eq('role', 'GERENTE')
        .eq('password', password);

      if (error) throw error;

      if (data && data.length > 0) {
        // Found a manager with this password! Successful override.
        onSuccess();
        setPassword('');
        onClose();
      } else {
        setErrorMsg('Senha de gerente incorreta ou inválida!');
      }
    } catch (err: any) {
      console.error('Error verifying manager password:', err);
      setErrorMsg('Erro de conexão ao verificar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-fade-in text-slate-800">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-orange-500 to-amber-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Autorização de Gerente</h3>
              <p className="text-[10px] text-white/80 uppercase font-black tracking-wider">Ação Bloqueada</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setPassword('');
              setErrorMsg(null);
              onClose();
            }}
            className="p-1.5 hover:bg-white/15 rounded-full transition-colors text-white"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Tentativa de:</h4>
            <p className="font-bold text-sm text-slate-700">{title}</p>
            {actionDescription && (
              <p className="text-xs text-slate-500 leading-relaxed">{actionDescription}</p>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-xs font-black text-slate-600 uppercase">Digite a Senha de um Gerente</label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                required
                autoFocus
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 font-bold text-slate-800 tracking-widest placeholder-gray-300"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 text-center uppercase tracking-wide">
              {errorMsg}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex gap-2 pt-2">
            <button 
              type="button"
              onClick={() => {
                setPassword('');
                setErrorMsg(null);
                onClose();
              }}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading || !password}
              className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              Autorizar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
