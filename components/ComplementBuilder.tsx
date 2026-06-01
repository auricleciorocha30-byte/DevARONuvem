import React, { useState, useEffect } from 'react';
import { ComplementCategory, ComplementItem } from '../types';
import { Plus, Trash2, GripVertical, Settings, Camera } from 'lucide-react';
import { Switch } from './Switch';

const PriceInput = ({ value, onChange, placeholder, className }: { value: number, onChange: (val: number) => void, placeholder?: string, className?: string }) => {
    const [localVal, setLocalVal] = useState(value === 0 ? '' : value.toString());

    useEffect(() => {
        const parsed = parseFloat(localVal.replace(',', '.'));
        if (isNaN(parsed) && value === 0) return;
        if (parsed !== value) {
            setLocalVal(value === 0 ? '' : value.toString());
        }
    }, [value]);

    return (
        <input
            type="text"
            inputMode="decimal"
            value={localVal}
            placeholder={placeholder}
            className={className}
            onFocus={e => e.target.select()}
            onBlur={() => {
                const parsed = parseFloat(localVal.replace(',', '.'));
                if (!isNaN(parsed)) {
                   setLocalVal(parsed.toFixed(2));
                }
            }}
            onChange={e => {
                const valStr = e.target.value.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
                
                // Allow only one decimal point
                const parts = valStr.split('.');
                const safeValStr = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : valStr;

                setLocalVal(e.target.value); // keep what they typed but clean up? Let's just keep their typed value to not mess up cursor, just replace unwanted chars
                
                const cleanedForState = e.target.value.replace(/[^0-9.,]/g, '');
                setLocalVal(cleanedForState);

                const finalParsed = parseFloat(safeValStr);
                onChange(isNaN(finalParsed) ? 0 : finalParsed);
            }}
        />
    );
}

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

  const handleItemImageUpload = (e: React.ChangeEvent<HTMLInputElement>, categoryId: string, itemId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400; // Smaller size for options
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
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          handleUpdateItem(categoryId, itemId, { imageUrl: dataUrl });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
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
                <div key={item.id} className="flex flex-col md:flex-row gap-3 items-center bg-gray-50 p-2 rounded-xl border border-dashed border-gray-200 hover:bg-gray-100 transition-colors">
                   <div className="text-gray-300 cursor-grab px-2 md:block hidden shrink-0">
                     <GripVertical size={16} />
                   </div>
                   
                   <div className="flex-1 w-full flex flex-col md:flex-row gap-3 items-start md:items-center">
                     <div className="w-14 h-14 bg-white border border-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden shrink-0 group shadow-sm transition-all hover:shadow-md">
                       {item.imageUrl ? (
                         <>
                           <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center backdrop-blur-sm transition-all">
                             <Camera size={14} className="text-white" />
                           </div>
                         </>
                       ) : (
                         <div className="text-gray-400 flex flex-col items-center justify-center group-hover:text-blue-500 transition-colors">
                            <Camera size={16} />
                            <span className="text-[8px] uppercase font-bold mt-1">Foto</span>
                         </div>
                       )}
                       <input 
                           type="file" 
                           accept="image/*" 
                           className="absolute inset-0 opacity-0 cursor-pointer"
                           onChange={e => handleItemImageUpload(e, category.id, item.id)}
                       />
                     </div>
                     <div className="flex-1 w-full flex flex-col xl:flex-row gap-2">
                       <input 
                         type="text" 
                         value={item.name} 
                         onChange={e => handleUpdateItem(category.id, item.id, { name: e.target.value })}
                         placeholder="Nome (Ex: Ovo, Bacon)"
                         className="flex-1 p-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                       />
                       <input 
                         type="text" 
                         value={item.description || ''} 
                         onChange={e => handleUpdateItem(category.id, item.id, { description: e.target.value })}
                         placeholder="Descrição (opcional)"
                         className="flex-1 p-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                       />
                       <div className="flex items-center gap-2 xl:w-40 shrink-0">
                         <span className="text-gray-500 text-sm font-bold pl-2 shrink-0">R$</span>
                         <PriceInput
                           value={item.price ?? 0}
                           onChange={(val) => handleUpdateItem(category.id, item.id, { price: val })}
                           placeholder="0,00"
                           className="flex-1 min-w-0 p-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                         />
                         <button type="button" onClick={() => handleDeleteItem(category.id, item.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                           <Trash2 size={16} />
                         </button>
                       </div>
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
