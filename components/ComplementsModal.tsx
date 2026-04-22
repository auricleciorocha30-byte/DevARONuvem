import React, { useMemo } from 'react';
import { Product, CartComplementItem, ComplementCategory } from '../types';
import { X, Plus, Minus } from 'lucide-react';

interface Props {
  product: Product;
  selectedComplements: CartComplementItem[];
  quantity: number;
  onClose: () => void;
  onQuantityChange: (q: number) => void;
  onToggleComplement: (category: ComplementCategory, item: any, currentQty: number, maxCategoryQty: number) => void;
  onConfirm: () => void;
}

export const ComplementsModal: React.FC<Props> = ({ 
  product, 
  selectedComplements, 
  quantity, 
  onClose, 
  onQuantityChange, 
  onToggleComplement, 
  onConfirm 
}) => {
  const complements = product.complements || [];
  
  const isValid = useMemo(() => {
    return complements.every(cat => {
      const catCount = selectedComplements.filter(sc => sc.categoryId === cat.id).reduce((sum, sc) => sum + sc.quantity, 0);
      
      let min = cat.minQuantity || 0;
      if (cat.isRequired && min === 0) {
          // Se a categoria é obrigatória mas o lojista deixou min=0, 
          // assumimos que o cliente precisa cumprir a quantidade máxima (ex: "Escolha 2" -> precisa escolher 2)
          // ou pelo menos 1.
          min = cat.maxQuantity || 1;
      }

      if (cat.isRequired && catCount < min) return false;
      return true;
    });
  }, [complements, selectedComplements]);

  const calculateTotal = useMemo(() => {
    const complementsTotal = selectedComplements.reduce((sum, sc) => sum + (sc.price * sc.quantity), 0);
    return (product.price + complementsTotal) * quantity;
  }, [product.price, selectedComplements, quantity]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full max-w-lg sm:rounded-[3rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
        <header className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-[2rem] sm:rounded-t-[3rem]">
          <div>
            <h2 className="text-xl font-bold">{product.name}</h2>
            <p className="text-gray-500 text-sm">{product.description}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </header>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
           {complements.map(cat => {
             const catCount = selectedComplements.filter(sc => sc.categoryId === cat.id).reduce((sum, sc) => sum + sc.quantity, 0);
             return (
               <div key={cat.id} className="space-y-3">
                 <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border">
                   <div>
                     <h3 className="font-bold text-gray-800">{cat.name}</h3>
                     <p className="text-xs text-gray-500">
                       {cat.isRequired ? 'Obrigatório' : 'Opcional'} • 
                       {cat.maxQuantity > 1 ? ` Escolha até ${cat.maxQuantity} opções` : ' Escolha 1 opção'}
                     </p>
                   </div>
                   <div className="text-xs font-bold px-2 py-1 bg-white rounded shadow-sm">
                     {catCount} / {cat.maxQuantity}
                   </div>
                 </div>

                 <div className="space-y-2">
                   {cat.items.map(item => {
                     const selectedItem = selectedComplements.find(sc => sc.categoryId === cat.id && sc.itemId === item.id);
                     const itemQty = selectedItem ? selectedItem.quantity : 0;
                     
                     // Se categoria for maxQuantity = 1, renderizar radio button style
                     const isRadio = cat.maxQuantity === 1;

                     return (
                       <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${itemQty > 0 ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
                         onClick={() => {
                           if (isRadio && itemQty === 0) onToggleComplement(cat, item, itemQty, cat.maxQuantity);
                         }}
                       >
                         <div className="flex-1">
                           <div className="flex items-center gap-2">
                             {isRadio && (
                               <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${itemQty > 0 ? 'border-primary' : 'border-gray-300'}`}>
                                 {itemQty > 0 && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                               </div>
                             )}
                             <span className="font-bold text-gray-700">{item.name}</span>
                           </div>
                           {item.description && <p className="text-xs text-gray-500 pl-7">{item.description}</p>}
                           {item.price > 0 && <p className="text-xs font-bold text-secondary pl-7">+ R$ {item.price.toFixed(2)}</p>}
                         </div>
                         
                         {!isRadio && (
                           <div className="flex items-center gap-3 bg-white border rounded-xl p-1 shadow-sm" onClick={e => e.stopPropagation()}>
                             <button 
                               onClick={() => onToggleComplement(cat, item, itemQty, cat.maxQuantity)} 
                               disabled={itemQty === 0}
                               className={`p-1.5 rounded-lg ${itemQty > 0 ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-gray-50 text-gray-300'}`}
                             >
                               <Minus size={14} />
                             </button>
                             <span className="font-bold text-sm w-4 text-center">{itemQty}</span>
                             <button 
                               onClick={() => onToggleComplement(cat, item, itemQty, cat.maxQuantity)} 
                               className={`p-1.5 rounded-lg ${(catCount >= cat.maxQuantity) ? 'bg-gray-50 text-gray-300' : 'bg-green-50 text-green-500 hover:bg-green-100'}`}
                               disabled={catCount >= cat.maxQuantity}
                             >
                               <Plus size={14} />
                             </button>
                           </div>
                         )}
                       </div>
                     );
                   })}
                 </div>
               </div>
             );
           })}
        </div>

        <div className="p-6 border-t bg-gray-50 sm:rounded-b-[3rem]">
          <div className="flex items-center gap-4 mb-4 justify-between">
            <div className="flex items-center gap-4 bg-white border rounded-2xl p-2 shadow-sm">
              <button 
                onClick={() => onQuantityChange(quantity - 1)} 
                disabled={quantity <= 1}
                className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 disabled:opacity-50"
              >
                <Minus size={20} />
              </button>
              <span className="font-black text-xl w-6 text-center">{quantity}</span>
              <button 
                onClick={() => onQuantityChange(quantity + 1)} 
                className="p-3 bg-green-50 text-green-500 rounded-xl hover:bg-green-100"
              >
                <Plus size={20} />
              </button>
            </div>
            
            <button
              onClick={onConfirm}
              disabled={!isValid}
              className="flex-1 bg-primary text-white py-4 px-6 rounded-2xl font-bold shadow-xl flex items-center justify-between disabled:opacity-50 transition-opacity"
            >
              <span>Adicionar</span>
              <span>R$ {calculateTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
