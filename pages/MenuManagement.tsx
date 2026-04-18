
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Plus, Search, Edit2, Trash2, Camera, Star, Tag, X, Loader2, Weight, Power, ListTree, ScanLine, FileText, Printer } from 'lucide-react';
import { Switch } from '../components/Switch';
import { supabase } from '../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  products: Product[];
  saveProduct: (p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  categories: string[];
  setCategories: (c: string[]) => void;
  storeId?: string;
  onCategoryChange?: () => void;
}

const MenuManagement: React.FC<Props> = ({ products, saveProduct, deleteProduct, categories, setCategories, storeId, onCategoryChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);

  const handleBarcodeLookup = async (code: string) => {
    if (!code || code.length < 8) return;
    setIsSearchingBarcode(true);
    try {
      const response = await fetch(`/api/barcode-lookup/${code}`);
      if (response.ok) {
        const data = await response.json();
        setEditingProduct(prev => {
          if (!prev) return null;
          return {
            ...prev,
            name: prev.name || data.name,
            description: prev.description || data.description,
            ncm: prev.ncm || data.ncm,
            cfop: prev.cfop || '5102',
            icms_situacao_tributaria: prev.icms_situacao_tributaria || '102'
          };
        });
      }
    } catch (error) {
      console.error("Erro ao consultar código de barras:", error);
    } finally {
      setIsSearchingBarcode(false);
    }
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (showScanner) {
      html5QrCode = new Html5Qrcode("reader");
      
      const startScanner = async () => {
        try {
          await html5QrCode?.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 }
            },
            (decodedText) => {
              setEditingProduct(prev => prev ? { ...prev, barcode: decodedText } : null);
              handleBarcodeLookup(decodedText);
              html5QrCode?.stop().then(() => {
                setShowScanner(false);
              }).catch(console.error);
            },
            (errorMessage) => {
              // parse error, ignore
            }
          );
        } catch (err) {
          console.error("Error starting scanner:", err);
          alert("Erro ao iniciar a câmera. Verifique as permissões.");
          setShowScanner(false);
        }
      };

      startScanner();
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [showScanner]);

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
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
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setEditingProduct(prev => prev ? {...prev, imageUrl: dataUrl} : prev);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSaving(true);

    try {
        const productData: Partial<Product> = {
            id: editingProduct.id || Math.random().toString(36).substr(2, 9),
            name: editingProduct.name || '',
            description: editingProduct.description || '',
            price: Number(editingProduct.price) || 0,
            category: editingProduct.category || categories[0] || 'Geral',
            imageUrl: editingProduct.imageUrl || 'https://picsum.photos/400/300',
            isActive: editingProduct.isActive !== false,
            showInMenu: editingProduct.showInMenu !== false,
            featuredDay: (editingProduct.featuredDay === -1 || editingProduct.featuredDay === undefined) ? undefined : Number(editingProduct.featuredDay),
            isByWeight: !!editingProduct.isByWeight,
            barcode: editingProduct.barcode || undefined,
            stock: (editingProduct.stock != null && !isNaN(Number(editingProduct.stock))) ? Number(editingProduct.stock) : null,
            fractions: (editingProduct.fractions != null && !isNaN(Number(editingProduct.fractions))) ? Number(editingProduct.fractions) : null,
            units: (editingProduct.units != null && !isNaN(Number(editingProduct.units))) ? Number(editingProduct.units) : null,
            fractionPrice: (editingProduct.fractionPrice != null && !isNaN(Number(editingProduct.fractionPrice))) ? Number(editingProduct.fractionPrice) : null,
            ncm: editingProduct.ncm || undefined,
            cfop: editingProduct.cfop || undefined,
            icms_situacao_tributaria: editingProduct.icms_situacao_tributaria || undefined
        };

        await saveProduct(productData);
        setShowProductModal(false);
        setEditingProduct(null);
    } catch (err: any) {
        console.error('Falha ao salvar:', err);
        alert(`Erro ao salvar: ${err.message || 'Verifique sua conexão e tente novamente.'}`);
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;
    
    if (categories.some(c => c.toLowerCase() === trimmedName.toLowerCase())) {
        alert("Esta categoria já existe.");
        return;
    }

    if (!storeId) {
        alert("Erro: Loja não identificada. Recarregue a página.");
        return;
    }
    
    setIsSavingCategory(true);
    try {
      const { error } = await supabase.from('categories').insert([{ name: trimmedName, store_id: storeId }]);
      if (error) {
         if (String(error.code) === '23505' || String(error).includes('UNIQUE constraint failed') || error.message?.includes('UNIQUE constraint failed')) { // Unique violation
             // If it exists in DB but not locally, add it to local state so user can use it
             if (!categories.includes(trimmedName)) {
                 setCategories([...categories, trimmedName]);
                 setNewCategoryName('');
                 alert("Categoria recuperada do banco de dados.");
             } else {
                 alert("Esta categoria já existe na lista.");
             }
         } else {
             throw error;
         }
      } else {
          setCategories([...categories, trimmedName]);
          setNewCategoryName('');
          if (onCategoryChange) onCategoryChange();
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao adicionar categoria: ${err.message}`);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catName: string) => {
    if (products.some(p => p.category === catName)) {
      alert("Não é possível excluir uma categoria que possui produtos vinculados.");
      return;
    }

    if (window.confirm(`Deseja excluir a categoria "${catName}"?`)) {
      try {
        const { error } = await supabase.from('categories').eq('name', catName).eq('store_id', storeId).delete();
        if (error) throw error;
        setCategories(categories.filter(c => c !== catName));
        if (onCategoryChange) onCategoryChange();
      } catch (err: any) {
        alert(`Erro ao excluir categoria: ${err.message}`);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir este produto?")) {
        try {
            await deleteProduct(id);
        } catch (err: any) {
            alert(`Erro ao excluir: ${err.message}`);
        }
    }
  };

  const days = [
    { id: 0, name: "Domingo" }, { id: 1, name: "Segunda" }, { id: 2, name: "Terça" },
    { id: 3, name: "Quarta" }, { id: 4, name: "Quinta" }, { id: 5, name: "Sexta" }, { id: 6, name: "Sábado" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar produtos..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <button 
                onClick={() => {
                  const printWindow = window.open('', '', 'width=800,height=600');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Cardápio</title>
                          <style>
                            body { font-family: sans-serif; padding: 20px; }
                            h1 { text-align: center; font-size: 24px; margin-bottom: 20px; text-transform: uppercase; }
                            .category { font-size: 18px; font-weight: bold; margin-top: 20px; border-bottom: 2px solid #ccc; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase; }
                            .product { display: flex; justify-content: space-between; margin-bottom: 10px; page-break-inside: avoid; border-bottom: 1px dashed #eee; padding-bottom: 8px; }
                            .product-info { flex: 1; padding-right: 20px; }
                            .product-name { font-weight: bold; font-size: 14px; }
                            .product-desc { font-size: 11px; color: #666; margin-top: 4px; }
                            .product-price { font-weight: bold; font-size: 14px; white-space: nowrap; }
                            @media print { body { padding: 0; } }
                          </style>
                        </head>
                        <body>
                          <h1>Nosso Cardápio</h1>
                          ${categories.map(cat => `
                            <div class="category">${cat}</div>
                            ${products.filter(p => p.category === cat && p.isActive).map(p => `
                              <div class="product">
                                <div class="product-info">
                                  <div class="product-name">${p.name}</div>
                                  ${p.description ? `<div class="product-desc">${p.description}</div>` : ''}
                                </div>
                                <div class="product-price">
                                  ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}
                                </div>
                              </div>
                            `).join('')}
                          `).join('')}
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    setTimeout(() => {
                      printWindow.print();
                      printWindow.close();
                    }, 500);
                  }
                }}
                className="px-4 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
            >
                <Printer size={18} /> Imprimir Cardápio
            </button>
            <button 
                onClick={() => setShowCategoryModal(true)}
                className="px-4 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
            >
                <ListTree size={18} /> Categorias
            </button>
            <button 
                onClick={() => { setEditingProduct({ category: categories[0] || '', description: '', featuredDay: -1, isActive: true, showInMenu: true, isByWeight: false }); setShowProductModal(true); }}
                className="px-4 py-3 bg-[#f68c3e] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors shadow-md whitespace-nowrap"
            >
                <Plus size={18} /> Novo Produto
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar max-h-[calc(100vh-200px)] p-2 -m-2">
        {filtered.map(product => (
          <div key={product.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group relative ${!product.isActive ? 'opacity-50 grayscale' : ''}`}>
            <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
              <button onClick={() => { setEditingProduct(product); setShowProductModal(true); }} className="p-2 bg-white rounded-lg shadow text-blue-500 hover:bg-blue-50">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleDelete(product.id)} className="p-2 bg-white rounded-lg shadow text-red-500 hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                {!product.isActive && (
                    <span className="bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg uppercase">Indisponível</span>
                )}
                {product.showInMenu === false && (
                    <span className="bg-gray-600 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg uppercase">Oculto no Cardápio</span>
                )}
                {product.isByWeight && (
                    <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg flex items-center gap-1 uppercase">
                        <Weight size={10} /> Balança (KG)
                    </span>
                )}
            </div>

            <img src={product.imageUrl} className="w-full h-40 object-cover" alt={product.name} />
            <div className="p-4">
              <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    {product.category}
                  </span>
                  {product.featuredDay !== null && product.featuredDay !== undefined && product.featuredDay !== -1 && <Star size={14} className="text-yellow-500 fill-current" />}
              </div>
              <h3 className="font-bold text-sm text-gray-800 mt-2">{product.name}</h3>
              <p className="text-xs text-gray-400 line-clamp-1 mb-1">{product.description}</p>
              <p className="text-sm font-bold text-[#3d251e]">R$ {product.price.toFixed(2)} {product.isByWeight ? '/ KG' : ''}</p>
            </div>
          </div>
        ))}
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold">Gerenciar Categorias</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
            </div>
            <div className="p-6 space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nova Categoria</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newCategoryName} 
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Ex: Bebidas, Doces..."
                        />
                        <button 
                            onClick={handleAddCategory}
                            disabled={isSavingCategory || !newCategoryName.trim()}
                            className="px-4 py-2 bg-[#3d251e] text-white rounded-lg font-bold disabled:opacity-50"
                        >
                            {isSavingCategory ? <Loader2 className="animate-spin" size={20}/> : <Plus size={20}/>}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Categorias Atuais</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {categories.map((cat, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                                <span className="font-medium text-gray-700">{cat}</span>
                                <button 
                                    onClick={() => handleDeleteCategory(cat)}
                                    className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold">{editingProduct?.id ? 'Editar Produto' : 'Cadastrar Produto'}</h2>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
            </div>
            <form 
              onSubmit={handleSaveProduct} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                  e.preventDefault();
                }
              }}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-orange-50 p-3 rounded-xl flex items-center justify-between border border-orange-100">
                    <div className="flex items-center gap-2">
                        <Power size={14} className={editingProduct?.isActive ? 'text-green-600' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold uppercase text-gray-500">Disponível</span>
                    </div>
                    <Switch checked={editingProduct?.isActive ?? true} onChange={(v) => setEditingProduct({...editingProduct, isActive: v})} />
                  </div>
                  <div className="bg-purple-50 p-3 rounded-xl flex items-center justify-between border border-purple-100">
                    <div className="flex items-center gap-2">
                        <ListTree size={14} className={editingProduct?.showInMenu !== false ? 'text-purple-600' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold uppercase text-gray-500">No Cardápio</span>
                    </div>
                    <Switch checked={editingProduct?.showInMenu ?? true} onChange={(v) => setEditingProduct({...editingProduct, showInMenu: v})} />
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                  <div className="bg-blue-50 p-3 rounded-xl flex items-center justify-between border border-blue-100">
                    <div className="flex items-center gap-2">
                        <Weight size={14} className={editingProduct?.isByWeight ? 'text-blue-600' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold uppercase text-gray-500">Venda por KG</span>
                    </div>
                    <Switch checked={editingProduct?.isByWeight ?? false} onChange={(v) => setEditingProduct({...editingProduct, isByWeight: v})} />
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
                    <div className="w-24 h-24 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 cursor-pointer overflow-hidden relative shrink-0">
                      {editingProduct?.imageUrl ? ( <img src={editingProduct.imageUrl} className="w-full h-full object-cover" alt="Preview" /> ) : ( <> <Camera size={24} /> <span className="text-[10px]">Galeria</span> </> )}
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleImageUpload} />
                    </div>
                    <div className="h-24 sm:h-8 flex-1 sm:w-24 bg-gray-100 rounded-lg flex flex-col sm:flex-row items-center justify-center text-gray-500 border border-gray-200 cursor-pointer relative hover:bg-gray-200 transition-colors">
                      <Camera size={14} className="mb-1 sm:mb-0 sm:mr-1" /> <span className="text-[10px] font-bold uppercase text-center">Tirar<br className="hidden sm:block"/>Foto</span>
                      <input type="file" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleImageUpload} />
                    </div>
                  </div>
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Produto *</label>
                    <input required type="text" value={editingProduct?.name || ''} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição / Ingredientes</label>
                <textarea 
                  rows={2} 
                  value={editingProduct?.description || ''} 
                  onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})} 
                  className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 resize-none text-sm" 
                  placeholder="Ex: Pão fofinho feito com fermentação natural..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{editingProduct?.isByWeight ? 'Preço por KG (R$)' : 'Preço Unitário (R$)'}</label>
                  <input required type="number" step="0.01" value={editingProduct?.price || ''} onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    {editingProduct?.isByWeight ? 'Estoque Atual (KG)' : 'Estoque Atual (Unid)'}
                  </label>
                  <input type="number" step={editingProduct?.isByWeight ? "0.001" : "1"} value={editingProduct?.stock ?? ''} onChange={(e) => setEditingProduct({...editingProduct, stock: e.target.value === '' ? undefined : parseFloat(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="Opcional" />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                  </div>
                  <h4 className="font-bold text-sm text-gray-700">Venda Fracionada (Opcional)</h4>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Útil para pizzas meio a meio ou combos. Deixe em branco se não for fracionado.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd. de Frações</label>
                    <input type="number" min="1" step="1" value={editingProduct?.fractions ?? ''} onChange={(e) => setEditingProduct({...editingProduct, fractions: e.target.value === '' ? undefined : parseInt(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: 2" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Qtd. de Unidades</label>
                    <input type="number" min="1" step="1" value={editingProduct?.units ?? ''} onChange={(e) => setEditingProduct({...editingProduct, units: e.target.value === '' ? undefined : parseInt(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: 1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor por Fração (R$)</label>
                    <input type="number" step="0.01" value={editingProduct?.fractionPrice ?? ''} onChange={(e) => setEditingProduct({...editingProduct, fractionPrice: e.target.value === '' ? undefined : parseFloat(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="Ex: 15.00" />
                  </div>
                  <div className="flex items-end">
                    <div className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500">
                      Preço Total: R$ {((editingProduct?.fractions || 0) * (editingProduct?.fractionPrice || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                  <select required value={editingProduct?.category || ''} onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none">
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
              </div>

              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código de Barras (Opcional)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        value={editingProduct?.barcode || ''} 
                        onChange={(e) => setEditingProduct({...editingProduct, barcode: e.target.value})} 
                        onBlur={(e) => handleBarcodeLookup(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" 
                        placeholder="EAN / Código" 
                      />
                      {isSearchingBarcode && (
                        <div className="absolute right-2 top-2">
                          <Loader2 className="animate-spin text-orange-500" size={20} />
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => editingProduct?.barcode && handleBarcodeLookup(editingProduct.barcode)} className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors flex items-center justify-center" title="Consultar dados">
                      <Search size={20} />
                    </button>
                    <button type="button" onClick={() => setShowScanner(!showScanner)} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center" title="Ler com a câmera">
                      <ScanLine size={20} />
                    </button>
                    <label className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center cursor-pointer" title="Ler de uma imagem">
                      <Camera size={20} />
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                        onChange={async (e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            const file = e.target.files[0];
                            const html5QrCode = new Html5Qrcode("reader");
                            try {
                              const decodedText = await html5QrCode.scanFile(file, true);
                              setEditingProduct(prev => prev ? { ...prev, barcode: decodedText } : null);
                              handleBarcodeLookup(decodedText);
                              alert("Código lido com sucesso!");
                            } catch (err) {
                              alert("Não foi possível ler o código na imagem.");
                            }
                          }
                        }} 
                      />
                    </label>
                  </div>
                  <div id="reader" className={showScanner ? "mt-2 p-2 border border-gray-200 rounded-lg bg-gray-50 w-full" : "hidden"}></div>
                  {showScanner && (
                    <button type="button" onClick={() => setShowScanner(false)} className="mt-2 w-full py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold uppercase">Cancelar Leitura</button>
                  )}
              </div>

              <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Oferta do Dia (Exibir em Destaque)</label>
                  <select 
                    value={editingProduct?.featuredDay ?? -1} 
                    onChange={(e) => setEditingProduct({...editingProduct, featuredDay: parseInt(e.target.value)})} 
                    className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none"
                  >
                      <option value="-1">Nenhum dia</option>
                      {days.map((day) => <option key={day.id} value={day.id}>{day.name}</option>)}
                  </select>
              </div>

              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={16} className="text-zinc-400" />
                  <h4 className="font-bold text-sm text-gray-700 uppercase tracking-widest">Dados Fiscais (NFC-e)</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">NCM</label>
                    <input 
                      type="text" 
                      maxLength={8}
                      value={editingProduct?.ncm || ''} 
                      onChange={(e) => setEditingProduct({...editingProduct, ncm: e.target.value.replace(/\D/g, '')})} 
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono" 
                      placeholder="Ex: 21069090" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">CFOP</label>
                    <input 
                      type="text" 
                      maxLength={4}
                      value={editingProduct?.cfop || ''} 
                      onChange={(e) => setEditingProduct({...editingProduct, cfop: e.target.value.replace(/\D/g, '')})} 
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono" 
                      placeholder="Ex: 5102" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">CSOSN / CST (Situação Tributária)</label>
                  <input 
                    type="text" 
                    maxLength={3}
                    value={editingProduct?.icms_situacao_tributaria || ''} 
                    onChange={(e) => setEditingProduct({...editingProduct, icms_situacao_tributaria: e.target.value.replace(/\D/g, '')})} 
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-xs font-mono" 
                    placeholder="Ex: 102" 
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-3 text-gray-400 font-bold">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-[#3d251e] text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"> 
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Produto'} 
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
