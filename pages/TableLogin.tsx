
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, ChevronRight, AlertCircle, Check, Utensils } from 'lucide-react';

interface Props {
  onLogin: (table: string) => void;
}

const TableLogin: React.FC<Props> = ({ onLogin }) => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    onLogin(selectedTable);
    navigate('/cardapio');
  };

  const tables = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  return (
    <div className="min-h-screen bg-[#3d251e] flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-[3rem] p-8 md:p-10 shadow-2xl space-y-8 animate-scale-up">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-orange-500 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-orange-500/20 rotate-3">
            <Utensils size={40} />
          </div>
          <h1 className="text-2xl font-brand font-bold text-[#3d251e]">Seja bem-vindo!</h1>
          <p className="text-sm text-gray-400 px-4 font-medium">Selecione o número da sua mesa para começar a pedir.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-8">
          <div className="grid grid-cols-3 gap-4">
            {tables.map(tableNum => (
              <button
                key={tableNum}
                type="button"
                onClick={() => setSelectedTable(tableNum)}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all relative overflow-hidden border-2 ${
                  selectedTable === tableNum 
                  ? 'bg-orange-500 border-orange-400 text-white scale-105 shadow-xl' 
                  : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-orange-200'
                }`}
              >
                <span className="text-xs uppercase font-black opacity-40 mb-1">Mesa</span>
                <span className="text-3xl font-black">{tableNum}</span>
              </button>
            ))}
          </div>

          <div className="bg-orange-50 p-4 rounded-2xl flex gap-3 items-start border border-orange-100">
             <AlertCircle className="text-orange-500 shrink-0" size={18} />
             <p className="text-[10px] text-orange-800 leading-relaxed font-bold uppercase">
               Seu pedido será enviado com o número desta mesa. Por favor, confirme se você está sentado na mesa correta.
             </p>
          </div>

          <button 
            type="submit"
            disabled={!selectedTable}
            className="w-full bg-[#3d251e] text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-30"
          >
            Acessar Cardápio <ChevronRight />
          </button>
        </form>
        
        <div className="text-center pt-4 opacity-30">
           <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400">Padaria Vovó Guta</p>
        </div>
      </div>
    </div>
  );
};

export default TableLogin;
