import React from 'react';
import { ComplementCategory, ComplementItem } from '../types';
import { Plus, Trash2, GripVertical, Settings } from 'lucide-react';
import { Switch } from './Switch';

interface Props {
  complements: ComplementCategory[];
  onChange: (complements: ComplementCategory[]) => void;
}

export const ComplementBuilder: React.FC<Props> = ({ complements, onChange }) => {
  const handleAddCategory = () => {
    onChange([
      ...complements,
      {
        id: Math.random().toString(36).substr(2, 9),
        name: '',
        isRequired: false,
        minQuantity: 0,
        maxQuantity: 1,
        items: []
      }
    ]);
  };

  const handleUpdateCategory = (id: string, updates: Partial<ComplementCategory>) => {
    onChange(complements.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleDeleteCategory = (id: string) => {
    if (!window.confirm("Remover esta prateleira de opções?")) return;
    onChange(complements.filter(c => c.id !== id));
  };

  const handleAddItem = (categoryId: string) => {
    onChange(complements.map(c => {
      if (c.id === categoryId) {
        return {
          ...c,
          items: [
            ...c.items,
            { id: Math.random().toString(36).substr(2, 9), name: '', price: 0 }
          ]
        };
      }
      return c;
    }));
  };

  const handleUpdateItem = (categoryId: string, itemId: string, updates: Partial<ComplementItem>) => {
    onChange(complements.map(c => {
      if (c.id === categoryId) {
        return {
          ...c,
          items: c.items.map(i => i.id === itemId ? { ...i, ...updates } : i)
        };
      }
      return c;
    }));
  };

  const handleDeleteItem = (categoryId: string, itemId: string) => {
    onChange(complements.map(c => {
      if (c.id === categoryId) {
        return { ...c, items: c.items.filter(i => i.id !== itemId) };
      }
      return c;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div>
          <h3 className="font-bold text-gray-800">Complementos / Adicionais</h3>
          <p className="text-xs text-gray-500">Crie opções como "Escolha a carne", "Adicionais", etc.</p>
        </div>
        <button
          type="button"
          onClick={handleAddCategory}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <Plus size={16} /> Nova Categoria
        </button>
      </div>

      <div className="space-y-4">
        {complements.map((category, index) => (
          <div key={category.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="bg-gray-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={category.name}
                  onChange={e => handleUpdateCategory(category.id, { name: e.target.value })}
                  placeholder='Ex: "Escolha seu molho" ou "Tamanho"'
                  className="w-full text-lg font-bold bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none px-1 py-1"
                />
                
                <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm bg-white p-2 border rounded-lg shadow-sm w-full md:w-max">
                  <label className="flex items-center gap-2 font-bold text-gray-600 cursor-pointer min-w-max">
                    <Switch checked={category.isRequired} onChange={v => handleUpdateCategory(category.id, { isRequired: v })} />
                    Obrigatório
                  </label>
                  
                  <div className="hidden md:block h-4 w-[1px] bg-gray-300"></div>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium whitespace-nowrap">Min:</span>
                    <input 
                      type="text"
                      inputMode="numeric"
                      value={category.minQuantity === 0 && !category.isRequired ? '' : category.minQuantity} 
                      onFocus={(e) => e.target.select()}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                        if (!isNaN(val)) handleUpdateCategory(category.id, { minQuantity: val });
                      }}
                      className="w-12 border rounded bg-gray-50 px-1 text-center outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium whitespace-nowrap">Máx:</span>
                    <input 
                      type="text"
                      inputMode="numeric"
                      value={category.maxQuantity || ''} 
                      onFocus={(e) => e.target.select()}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                        if (!isNaN(val)) handleUpdateCategory(category.id, { maxQuantity: val });
                      }}
                      className="w-12 border rounded bg-gray-50 px-1 text-center outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="self-end md:self-start">
                 <button type="button" onClick={() => handleDeleteCategory(category.id)} className="text-red-500 hover:text-red-700 bg-white p-2 rounded-lg border shadow-sm">
                   <Trash2 size={16} />
                 </button>
              </div>
            </div>

            <div className="p-4 space-y-2">
              {category.items.map((item, iIndex) => (
                <div key={item.id} className="flex flex-col md:flex-row gap-3 items-center bg-gray-50 p-2 rounded-xl border border-dashed border-gray-200">
                   <div className="text-gray-300 cursor-grab px-2 md:block hidden">
                     <GripVertical size={16} />
                   </div>
                   
                   <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-2">
                     <input 
                       type="text" 
                       value={item.name} 
                       onChange={e => handleUpdateItem(category.id, item.id, { name: e.target.value })}
                       placeholder="Nome da opção (Ex: Molho Especial)"
                       className="w-full p-2 text-sm border rounded-lg outline-none"
                     />
                     <input 
                       type="text" 
                       value={item.description || ''} 
                       onChange={e => handleUpdateItem(category.id, item.id, { description: e.target.value })}
                       placeholder="Descrição (opcional)"
                       className="w-full p-2 text-sm border rounded-lg outline-none"
                     />
                     <div className="flex items-center gap-2">
                       <span className="text-gray-500 text-sm font-bold pl-2">R$</span>
                       <input 
                         type="text" 
                         inputMode="decimal"
                         value={item.price === 0 ? '' : item.price} 
                         onFocus={(e) => e.target.select()}
                         onChange={e => {
                           const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                           if (!isNaN(val)) handleUpdateItem(category.id, item.id, { price: val });
                         }}
                         placeholder="0.00"
                         className="flex-1 w-full p-2 text-sm border rounded-lg outline-none"
                       />
                       <button type="button" onClick={() => handleDeleteItem(category.id, item.id)} className="p-2 text-red-400 hover:text-red-600">
                         <Trash2 size={16} />
                       </button>
                     </div>
                   </div>
                </div>
              ))}

              <button 
                type="button"
                onClick={() => handleAddItem(category.id)}
                className="mt-2 w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
              >
                <Plus size={16} /> Adicionar Opção
              </button>
            </div>
          </div>
        ))}

        {complements.length === 0 && (
          <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl">
            <Settings className="mx-auto text-gray-300 mb-2" size={32} />
            <p className="text-gray-500 font-medium">Nenhum complemento criado.</p>
            <p className="text-xs text-gray-400">Clique em "Nova Categoria" para começar.</p>
          </div>
        )}
      </div>
    </div>
  );
};
