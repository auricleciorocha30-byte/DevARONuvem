
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { Plus, Search, Edit2, Trash2, Camera, Star, Tag, X, Loader2, Weight, Power, ListTree, ScanLine, FileText, Printer, Layers, Check, Upload, Percent } from 'lucide-react';
import { Switch } from '../components/Switch';
import { ComplementBuilder } from '../components/ComplementBuilder';
import { supabase } from '../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';

const PriceInput = ({ value, onChange, placeholder, className }: { value: number, onChange: (val: number) => void, placeholder?: string, className?: string }) => {
    const [localVal, setLocalVal] = useState(
        value === 0 ? '' : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );

    const parseCurrency = (str: string) => {
        if (!str) return 0;
        let clean = str.replace(/[^0-9.,]/g, '');
        if (clean.includes(',') && clean.includes('.')) {
            // e.g. 1.234,50 -> 1234.50
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else if (clean.includes(',')) {
            // e.g. 20,50 -> 20.50
            clean = clean.replace(',', '.');
        } else if (clean.includes('.')) {
            // e.g. 20.50 -> 20.50
            // Keep unchanged, handles numpad dot
        }
        const val = parseFloat(clean);
        return isNaN(val) ? 0 : val;
    };

    useEffect(() => {
        const currentParsed = parseCurrency(localVal);
        if (currentParsed !== value) {
            setLocalVal(value === 0 && !localVal ? '' : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
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
                const parsed = parseCurrency(localVal);
                if (parsed !== 0 || localVal !== '') {
                   setLocalVal(parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                }
            }}
            onChange={e => {
                const val = e.target.value;
                const sanitized = val.replace(/[^0-9.,]/g, '');
                setLocalVal(sanitized);
                onChange(parseCurrency(sanitized));
            }}
        />
    );
};

interface Props {
  products: Product[];
  saveProduct: (p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  categories: string[];
  setCategories: (c: string[]) => void;
  storeId?: string;
  onCategoryChange?: () => void;
  settings?: any;
  ecosystemUsage?: { ordersThisMonth: number, productsCount: number, usersCount: number };
  refreshEcosystemUsage?: () => void;
}

const MenuManagement: React.FC<Props> = ({ products, saveProduct, deleteProduct, categories, setCategories, storeId, onCategoryChange, settings, ecosystemUsage, refreshEcosystemUsage }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [selectedComboProductId, setSelectedComboProductId] = useState('');
  const [selectedComboQtyCount, setSelectedComboQtyCount] = useState(1);
  const [comboProductSearch, setComboProductSearch] = useState('');
  const [comboIncludedSearch, setComboIncludedSearch] = useState('');

  const addComboItem = () => {
    if (!selectedComboProductId) return;
    const prodObj = products.find(p => p.id === selectedComboProductId);
    if (!prodObj) return;

    const currentItems = editingProduct?.comboItems || [];
    const exists = currentItems.find(item => item.productId === selectedComboProductId);
    let updatedItems;
    if (exists) {
      updatedItems = currentItems.map(item => 
        item.productId === selectedComboProductId 
          ? { ...item, quantity: item.quantity + selectedComboQtyCount }
          : item
      );
    } else {
      updatedItems = [
        ...currentItems,
        {
          productId: selectedComboProductId,
          name: prodObj.name,
          quantity: selectedComboQtyCount
        }
      ];
    }

    setEditingProduct(prev => prev ? { ...prev, comboItems: updatedItems } : prev);
    setSelectedComboProductId('');
    setSelectedComboQtyCount(1);
  };

  const removeComboItem = (productId: string) => {
    const currentItems = editingProduct?.comboItems || [];
    const updatedItems = currentItems.filter(item => item.productId !== productId);
    setEditingProduct(prev => prev ? { ...prev, comboItems: updatedItems } : prev);
  };
  const [isSaving, setIsSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');
  const [isSavingCategoryEdit, setIsSavingCategoryEdit] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [productTab, setProductTab] = useState<'INFO' | 'OPCOES'>('INFO');

  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);

  const [showXmlImportModal, setShowXmlImportModal] = useState(false);
  const [xmlText, setXmlText] = useState('');
  const [parsedNfeItems, setParsedNfeItems] = useState<any[]>([]);
  const [globalMarkup, setGlobalMarkup] = useState<number>(50);
  const [stockUpdateMode, setStockUpdateMode] = useState<'ADD' | 'REPLACE'>('ADD');
  const [isProcessingXml, setIsProcessingXml] = useState(false);

  const handleParseXml = (text: string) => {
    if (!text.trim()) {
      alert("Por favor, forneça o conteúdo XML da Nota Fiscal.");
      return;
    }
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      
      const parseError = xmlDoc.getElementsByTagName("parsererror");
      if (parseError.length > 0) {
        throw new Error("Formato de XML inválido. Verifique se o conteúdo colado é um XML de NF-e completo e válido.");
      }

      const detElements = xmlDoc.getElementsByTagName("det");
      if (detElements.length === 0) {
        throw new Error("Nenhum item de produto (<det>) foi encontrado no XML fornecido.");
      }

      const items: any[] = [];
      for (let i = 0; i < detElements.length; i++) {
        const det = detElements[i];
        const prod = det.getElementsByTagName("prod")[0];
        if (!prod) continue;

        const cProd = prod.getElementsByTagName("cProd")[0]?.textContent || '';
        let cEAN = prod.getElementsByTagName("cEAN")[0]?.textContent || '';
        if (cEAN === 'SEM GTIN' || cEAN.trim() === '7890000000000' || !/^\d+$/.test(cEAN)) {
          cEAN = '';
        }

        const xProd = prod.getElementsByTagName("xProd")[0]?.textContent || '';
        const ncm = prod.getElementsByTagName("NCM")[0]?.textContent || '';
        const cfop = prod.getElementsByTagName("CFOP")[0]?.textContent || '';
        
        let suggestedSalesCfop = '5102';
        if (cfop.startsWith('14') || cfop.startsWith('24')) {
          suggestedSalesCfop = '5405';
        }

        const qCom = parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || '0');
        const vUnCom = parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || '0');

        let icmsSituation = '102';
        const icmsElements = det.getElementsByTagName("ICMS");
        if (icmsElements.length > 0) {
          const innerIcms = icmsElements[0];
          const cstElement = innerIcms.getElementsByTagName("CST")[0] || innerIcms.getElementsByTagName("CSOSN")[0];
          if (cstElement && cstElement.textContent) {
            icmsSituation = cstElement.textContent;
          }
        }

        const matchedProduct = products.find(p => {
          if (cEAN && p.barcode === cEAN) return true;
          return p.name.toLowerCase().trim() === xProd.toLowerCase().trim();
        });

        const salePrice = Number((vUnCom * (1 + globalMarkup / 100)).toFixed(2));

        items.push({
          id: Math.random().toString(36).substr(2, 9),
          cProd,
          barcode: cEAN,
          name: xProd,
          ncm,
          cfop: suggestedSalesCfop,
          quantity: qCom,
          costPrice: vUnCom,
          icms: icmsSituation,
          matchedProductId: matchedProduct ? matchedProduct.id : undefined,
          matchedProductName: matchedProduct ? matchedProduct.name : undefined,
          selected: true,
          salePrice: matchedProduct ? matchedProduct.price : salePrice,
          category: matchedProduct ? matchedProduct.category : (categories[0] || 'Geral')
        });
      }

      setParsedNfeItems(items);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro ao processar XML.");
    }
  };

  const handleMarkupChange = (newMarkup: number) => {
    setGlobalMarkup(newMarkup);
    setParsedNfeItems(prev => prev.map(item => {
      if (!item.matchedProductId) {
        return {
          ...item,
          salePrice: Number((item.costPrice * (1 + newMarkup / 100)).toFixed(2))
        };
      }
      return item;
    }));
  };

  const handleConfirmXmlImport = async () => {
    const selectedItems = parsedNfeItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      alert("Nenhum item selecionado para importação.");
      return;
    }

    setIsProcessingXml(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const item of selectedItems) {
        try {
          if (item.matchedProductId) {
            const existing = products.find(p => p.id === item.matchedProductId);
            if (existing) {
              const updatedStock = stockUpdateMode === 'ADD' 
                ? (existing.stock || 0) + item.quantity 
                : item.quantity;

              const productPayload: Partial<Product> = {
                id: existing.id,
                name: existing.name,
                category: item.category || existing.category,
                description: existing.description || 'Importado via NF-e',
                imageUrl: existing.imageUrl || '',
                imageUrl2: existing.imageUrl2 || '',
                isActive: existing.isActive,
                price: item.salePrice,
                costPrice: item.costPrice,
                stock: updatedStock,
                ncm: item.ncm || existing.ncm,
                cfop: item.cfop || existing.cfop,
                icms_situacao_tributaria: item.icms || existing.icms_situacao_tributaria,
                barcode: existing.barcode || item.barcode || undefined
              };

              await saveProduct(productPayload);
              successCount++;
            }
          } else {
            const newProductPayload: Partial<Product> = {
              name: item.name,
              category: item.category,
              description: 'Importado via NF-e',
              imageUrl: '',
              imageUrl2: '',
              isActive: true,
              price: item.salePrice,
              costPrice: item.costPrice,
              stock: item.quantity,
              ncm: item.ncm,
              cfop: item.cfop,
              icms_situacao_tributaria: item.icms || '102',
              barcode: item.barcode || undefined
            };

            await saveProduct(newProductPayload);
            successCount++;
          }
        } catch (err) {
          console.error(`Erro ao importar item ${item.name}:`, err);
          errorCount++;
        }
      }

      alert(`Importação concluída! ${successCount} produtos importados/atualizados com sucesso.${errorCount > 0 ? ` ${errorCount} falhas.` : ''}`);
      setShowXmlImportModal(false);
      setParsedNfeItems([]);
      setXmlText('');
      if (onCategoryChange) {
         onCategoryChange();
      }
    } catch (globalErr: any) {
      alert(`Erro geral na importação: ${globalErr.message || globalErr}`);
    } finally {
      setIsProcessingXml(false);
    }
  };

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
        alert("Dados do produto preenchidos via código de barras!");
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

  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(12);
  }, [searchTerm]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 12);
      }
    }, { threshold: 0.1 });

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filtered, loadMoreRef.current]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'imageUrl2' = 'imageUrl') => {
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
          setEditingProduct(prev => prev ? {...prev, [field]: dataUrl} : prev);
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
            costPrice: Number(editingProduct.costPrice) || 0,
            category: editingProduct.category || categories[0] || 'Geral',
            imageUrl: editingProduct.imageUrl || 'https://picsum.photos/400/300',
            imageUrl2: editingProduct.imageUrl2 || '',
            isActive: editingProduct.isActive !== false,
            showInMenu: editingProduct.showInMenu !== false,
            featuredDay: (editingProduct.featuredDay === -1 || editingProduct.featuredDay === undefined) ? undefined : Number(editingProduct.featuredDay),
            featuredDays: editingProduct.featuredDays || [],
            isByWeight: !!editingProduct.isByWeight,
            barcode: editingProduct.barcode || undefined,
            stock: (editingProduct.stock != null && !isNaN(Number(editingProduct.stock))) ? Number(editingProduct.stock) : null,
            units: (editingProduct.units != null && !isNaN(Number(editingProduct.units))) ? Number(editingProduct.units) : null,
            ncm: editingProduct.ncm || undefined,
            cfop: editingProduct.cfop || undefined,
            icms_situacao_tributaria: editingProduct.icms_situacao_tributaria || undefined,
            complements: editingProduct.complements || [],
            isCombo: !!editingProduct.isCombo,
            comboItems: editingProduct.comboItems || []
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

  const handleEditCategory = async (oldName: string) => {
    const trimmedNewName = editingCategoryValue.trim();
    if (!trimmedNewName) {
      alert("O nome da categoria não pode ser vazio.");
      return;
    }

    if (trimmedNewName === oldName) {
      setEditingCategory(null);
      return;
    }

    if (categories.some(c => c.toLowerCase() === trimmedNewName.toLowerCase() && c !== oldName)) {
      alert("Esta categoria já existe.");
      return;
    }

    if (!storeId) {
      alert("Erro: Loja não identificada. Recarregue a página.");
      return;
    }

    setIsSavingCategoryEdit(true);
    try {
      // 1. Update categories table in supabase
      const { error: catError } = await supabase
        .from('categories')
        .eq('name', oldName)
        .eq('store_id', storeId)
        .update({ name: trimmedNewName });

      if (catError) throw catError;

      // 2. Update category name on any products that use it
      const { error: prodError } = await supabase
        .from('products')
        .eq('category', oldName)
        .eq('store_id', storeId)
        .update({ category: trimmedNewName });

      if (prodError) {
        console.warn("Aviso ao atualizar produtos da categoria editada:", prodError);
      }

      // 3. Update local categories array
      setCategories(categories.map(c => c === oldName ? trimmedNewName : c));
      
      // 4. Trigger onCategoryChange to reload everything
      if (onCategoryChange) {
        await onCategoryChange();
      }

      setEditingCategory(null);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao editar categoria: ${err.message}`);
    } finally {
      setIsSavingCategoryEdit(false);
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
                onClick={() => {
                  setParsedNfeItems([]);
                  setXmlText('');
                  setShowXmlImportModal(true);
                }}
                className="px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-md whitespace-nowrap"
            >
                <FileText size={18} /> Importar Nota (XML)
            </button>
            <button 
                onClick={() => { 
                  if (ecosystemUsage && settings?.maxProducts && ecosystemUsage.productsCount >= settings.maxProducts) {
                      alert("Limite máximo de produtos atingido. Entre em contato com seu consultor para fazer um upgrade do seu plano.");
                      return;
                  }
                  setEditingProduct({ category: categories[0] || '', description: '', featuredDay: -1, isActive: true, showInMenu: true, isByWeight: false, complements: [] }); setProductTab('INFO'); setShowProductModal(true); 
                }}
                className="px-4 py-3 bg-[#f68c3e] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors shadow-md whitespace-nowrap"
            >
                <Plus size={18} /> Novo Produto
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar max-h-[calc(100vh-200px)] p-2 -m-2">
        {filtered.slice(0, visibleCount).map(product => (
          <div key={product.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group relative ${!product.isActive ? 'opacity-50 grayscale' : ''}`}>
            <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
              <button onClick={() => { setEditingProduct(product); setProductTab('INFO'); setShowProductModal(true); }} className="p-2 bg-white rounded-lg shadow text-blue-500 hover:bg-blue-50">
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
                {product.isCombo && (
                    <span className="bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg flex items-center gap-1 uppercase">
                        <Layers size={10} /> Combo ({product.comboItems?.length || 0} itens)
                    </span>
                )}
            </div>

            <div className="relative w-full h-40 overflow-hidden bg-slate-50">
              <img 
                src={product.imageUrl || undefined} 
                className={`w-full h-full object-cover transition-opacity duration-300 absolute inset-0 ${product.imageUrl2 ? 'group-hover:opacity-0' : ''}`} 
                alt={product.name} 
                loading="lazy" 
              />
              {product.imageUrl2 && (
                <img 
                  src={product.imageUrl2} 
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
                  alt={`${product.name} - Secundária`} 
                  loading="lazy" 
                />
              )}
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    {product.category}
                  </span>
                  {((product.featuredDay !== null && product.featuredDay !== undefined && product.featuredDay !== -1) || (product.featuredDays && product.featuredDays.length > 0)) && <Star size={14} className="text-yellow-500 fill-current" />}
              </div>
              <h3 className="font-bold text-sm text-gray-800 mt-2">{product.name}</h3>
              <p className="text-xs text-gray-400 line-clamp-1 mb-1">{product.description}</p>
              <p className="text-sm font-bold text-[#3d251e]">R$ {product.price.toFixed(2)} {product.isByWeight ? '/ KG' : ''}</p>
            </div>
          </div>
        ))}

        {filtered.length > visibleCount && (
          <div ref={loadMoreRef} className="col-span-full h-20 flex items-center justify-center">
            <Loader2 className="animate-spin text-orange-500" size={32} />
          </div>
        )}
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-scale-up max-h-[85vh] flex flex-col">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50 shrink-0">
              <h2 className="text-xl font-bold">Gerenciar Categorias</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors"><X /></button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nova Categoria</label>
                    <div className="flex gap-2 items-center">
                        <input 
                            type="text" 
                            value={newCategoryName} 
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-1 min-w-0 p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Ex: Bebidas, Doces..."
                        />
                        <button 
                            onClick={handleAddCategory}
                            disabled={isSavingCategory || !newCategoryName.trim()}
                            className="px-4 py-2 bg-[#3d251e] text-white rounded-lg font-bold disabled:opacity-50 shrink-0"
                        >
                            {isSavingCategory ? <Loader2 className="animate-spin" size={20}/> : <Plus size={20}/>}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Categorias Atuais</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {categories.map((cat, idx) => {
                            const isEditing = editingCategory === cat;
                            return (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group min-h-[50px]">
                                    {isEditing ? (
                                        <div className="flex gap-2 items-center w-full">
                                            <input 
                                                type="text" 
                                                value={editingCategoryValue} 
                                                onChange={(e) => setEditingCategoryValue(e.target.value)}
                                                className="flex-1 min-w-0 p-1.5 px-3 text-sm border border-orange-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white font-medium text-gray-700"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleEditCategory(cat);
                                                    } else if (e.key === 'Escape') {
                                                        setEditingCategory(null);
                                                    }
                                                }}
                                            />
                                            <button 
                                                onClick={() => handleEditCategory(cat)}
                                                disabled={isSavingCategoryEdit || !editingCategoryValue.trim()}
                                                className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 shrink-0"
                                            >
                                                {isSavingCategoryEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                            </button>
                                            <button 
                                                onClick={() => setEditingCategory(null)}
                                                disabled={isSavingCategoryEdit}
                                                className="p-1.5 bg-gray-200 text-gray-500 rounded-lg hover:bg-gray-300 transition-colors shrink-0"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-medium text-gray-700">{cat}</span>
                                            <div className="flex gap-1 shrink-0 group-hover:opacity-100 md:opacity-0 transition-opacity">
                                                <button 
                                                    onClick={() => {
                                                        setEditingCategory(cat);
                                                        setEditingCategoryValue(cat);
                                                    }}
                                                    className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar Categoria"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteCategory(cat)}
                                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Excluir Categoria"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
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
            
            <div className="flex border-b">
                <button
                    type="button"
                    onClick={() => setProductTab('INFO')}
                    className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${productTab === 'INFO' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Informações
                </button>
                <button
                    type="button"
                    onClick={() => setProductTab('OPCOES')}
                    className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${productTab === 'OPCOES' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Opções & Complementos
                </button>
            </div>

            <form 
              onSubmit={handleSaveProduct} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                  e.preventDefault();
                }
              }}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar"
            >
              <div className={`${productTab === 'INFO' ? 'block' : 'hidden'} space-y-4`}>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-xl flex items-center justify-between border border-blue-100">
                    <div className="flex items-center gap-2">
                        <Weight size={14} className={editingProduct?.isByWeight ? 'text-blue-600' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold uppercase text-gray-500">Venda por KG</span>
                    </div>
                    <Switch checked={editingProduct?.isByWeight ?? false} onChange={(v) => {
                      if (v) {
                        setEditingProduct({...editingProduct, isByWeight: true, isCombo: false, comboItems: []});
                      } else {
                        setEditingProduct({...editingProduct, isByWeight: false});
                      }
                    }} />
                  </div>
                  <div className="bg-amber-50 p-3 rounded-xl flex items-center justify-between border border-amber-100">
                    <div className="flex items-center gap-2">
                        <Layers size={14} className={editingProduct?.isCombo ? 'text-amber-600' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold uppercase text-gray-500">Produto é um Combo</span>
                    </div>
                    <Switch checked={editingProduct?.isCombo ?? false} onChange={(v) => {
                      if (v) {
                        setEditingProduct({...editingProduct, isCombo: true, isByWeight: false, comboItems: editingProduct.comboItems || []});
                      } else {
                        setEditingProduct({...editingProduct, isCombo: false, comboItems: []});
                      }
                    }} />
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Foto Principal */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <span className="block text-xs font-bold text-slate-500 uppercase">Foto Principal</span>
                  <div className="flex gap-2">
                    <div className="w-20 h-20 bg-white rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 cursor-pointer overflow-hidden relative shrink-0 shadow-sm">
                      {editingProduct?.imageUrl ? ( <img src={editingProduct.imageUrl || undefined} className="w-full h-full object-cover" alt="Preview 1" /> ) : ( <> <Camera size={20} /> <span className="text-[9px] font-bold uppercase">Galeria</span> </> )}
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleImageUpload(e, 'imageUrl')} />
                    </div>
                    <div className="w-20 h-20 bg-white rounded-xl flex flex-col items-center justify-center text-gray-500 border border-gray-200 cursor-pointer relative hover:bg-gray-50 transition-colors shadow-sm text-center p-1">
                      <Camera size={18} className="mb-1" /> <span className="text-[9px] font-bold uppercase leading-tight">Tirar<br/>Foto</span>
                      <input type="file" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleImageUpload(e, 'imageUrl')} />
                    </div>
                    {editingProduct?.imageUrl && (
                      <button 
                        type="button" 
                        onClick={() => setEditingProduct({...editingProduct, imageUrl: ''})} 
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold self-end"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>

                {/* Foto Secundária */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <span className="block text-xs font-bold text-slate-500 uppercase">Foto Secundária (Opcional)</span>
                  <div className="flex gap-2">
                    <div className="w-20 h-20 bg-white rounded-xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 cursor-pointer overflow-hidden relative shrink-0 shadow-sm">
                      {editingProduct?.imageUrl2 ? ( <img src={editingProduct.imageUrl2 || undefined} className="w-full h-full object-cover" alt="Preview 2" /> ) : ( <> <Camera size={20} /> <span className="text-[9px] font-bold uppercase">Galeria</span> </> )}
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleImageUpload(e, 'imageUrl2')} />
                    </div>
                    <div className="w-20 h-20 bg-white rounded-xl flex flex-col items-center justify-center text-gray-500 border border-gray-200 cursor-pointer relative hover:bg-gray-50 transition-colors shadow-sm text-center p-1">
                      <Camera size={18} className="mb-1" /> <span className="text-[9px] font-bold uppercase leading-tight">Tirar<br/>Foto</span>
                      <input type="file" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleImageUpload(e, 'imageUrl2')} />
                    </div>
                    {editingProduct?.imageUrl2 && (
                      <button 
                        type="button" 
                        onClick={() => setEditingProduct({...editingProduct, imageUrl2: ''})} 
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold self-end"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Produto *</label>
                <input required type="text" value={editingProduct?.name || ''} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
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
                  <PriceInput 
                    value={editingProduct?.price ?? 0}
                    onChange={(val) => setEditingProduct({...editingProduct, price: val})}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço de Custo (R$)</label>
                  <PriceInput 
                    value={editingProduct?.costPrice ?? 0}
                    onChange={(val) => setEditingProduct({...editingProduct, costPrice: val})}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    {editingProduct?.isByWeight ? 'Estoque Atual (KG)' : 'Estoque Atual (Unid)'}
                  </label>
                  <input type="number" step={editingProduct?.isByWeight ? "0.001" : "1"} value={editingProduct?.stock ?? ''} onFocus={(e) => e.target.select()} onChange={(e) => setEditingProduct({...editingProduct, stock: e.target.value === '' ? undefined : parseFloat(e.target.value)})} className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="Opcional" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                  <select required value={editingProduct?.category || ''} onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none">
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              {editingProduct?.isCombo && (
                <div className="bg-amber-50/50 px-3 py-4 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-amber-200 pb-2">
                    <Layers className="text-amber-600" size={16} />
                    <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wide">Produtos Inclusos no Combo</h3>
                  </div>

                  {/* Add item Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-7">
                      <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Selecionar Produto</label>
                      <div className="space-y-1">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                          <input 
                            type="text" 
                            placeholder="Buscar produto para incluir..." 
                            value={comboProductSearch}
                            onChange={(e) => setComboProductSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg outline-none text-xs bg-white" 
                          />
                        </div>
                        <select 
                          value={selectedComboProductId} 
                          onChange={(e) => setSelectedComboProductId(e.target.value)}
                          className="w-full p-2 border border-gray-200 rounded-lg bg-white outline-none text-xs"
                        >
                          <option value="">Selecione um produto...</option>
                          {products
                            .filter(p => !p.isCombo && p.id !== editingProduct?.id && (!comboProductSearch || p.name.toLowerCase().includes(comboProductSearch.toLowerCase())))
                            .map(p => (
                              <option key={p.id} value={p.id}>{p.name} - R$ {p.price.toFixed(2)}</option>
                            ))
                          }
                        </select>
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Qtd</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={selectedComboQtyCount} 
                        onChange={(e) => setSelectedComboQtyCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none text-xs bg-white" 
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <button 
                        type="button" 
                        onClick={() => {
                          addComboItem();
                          setComboProductSearch(''); // Clear search on addition
                        }}
                        disabled={!selectedComboProductId}
                        className="w-full p-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center text-xs disabled:opacity-50 h-[34px]"
                      >
                        Incluir
                      </button>
                    </div>
                  </div>

                  {/* Table / List of added items */}
                  {(!editingProduct.comboItems || editingProduct.comboItems.length === 0) ? (
                    <p className="text-xs text-center text-gray-400 py-2">Nenhum produto incluído neste combo ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 bg-amber-100/50 p-2 rounded-xl border border-amber-200">
                        <span className="text-[10px] font-bold text-amber-800 uppercase">Itens no Combo</span>
                        <div className="relative w-48">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-600" size={12} />
                          <input 
                            type="text" 
                            placeholder="Buscar itens inclusos..." 
                            value={comboIncludedSearch}
                            onChange={(e) => setComboIncludedSearch(e.target.value)}
                            className="w-full pl-8 pr-2 py-1 bg-white border border-amber-200 rounded-lg outline-none text-[10px] text-amber-900" 
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
                        {editingProduct.comboItems
                          .filter(item => !comboIncludedSearch || (item.name || '').toLowerCase().includes(comboIncludedSearch.toLowerCase()))
                          .map((item) => (
                            <div key={item.productId} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-amber-100 text-xs shadow-sm">
                              <div>
                                <span className="font-semibold text-gray-700">{item.name}</span>
                                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">x{item.quantity}</span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => removeComboItem(item.productId)}
                                className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dias em Destaque (Exibir em Ofertas)</label>
                  <div className="flex flex-wrap gap-2">
                    {days.map((day) => {
                      const isActive = editingProduct?.featuredDays?.includes(day.id) || editingProduct?.featuredDay === day.id;
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            let newDays = editingProduct?.featuredDays ? [...editingProduct.featuredDays] : [];
                            
                            // If it was the old featuredDay, migrate it
                            if (editingProduct?.featuredDay === day.id && !newDays.includes(day.id)) {
                                newDays.push(day.id);
                            }

                            if (newDays.includes(day.id)) {
                              newDays = newDays.filter(d => d !== day.id);
                            } else {
                              newDays.push(day.id);
                            }
                            setEditingProduct({...editingProduct, featuredDays: newDays, featuredDay: -1});
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                            isActive 
                            ? 'bg-orange-500 text-white border-orange-600 shadow-sm' 
                            : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          {day.name}
                        </button>
                      )
                    })}
                  </div>
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
              </div>

              {productTab === 'OPCOES' && (
                  <ComplementBuilder 
                    complements={editingProduct?.complements || []}
                    onChange={(complements) => setEditingProduct({ ...editingProduct, complements })}
                  />
              )}

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

      {showXmlImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="xml-import-modal">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-scale-up">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500 rounded-2xl text-white">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Importar Produtos de Nota Fiscal (XML)</h3>
                  <p className="text-xs font-semibold text-slate-500">Cadastre novos produtos em lote e atualize preços de custo, estoque e dados fiscais via NF-e</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowXmlImportModal(false);
                  setParsedNfeItems([]);
                  setXmlText('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
              
              {parsedNfeItems.length === 0 ? (
                /* Source Selection Panel */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Drag and Drop File Selector */}
                    <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group">
                      <input 
                        type="file" 
                        accept=".xml"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const content = evt.target?.result as string;
                              setXmlText(content);
                              handleParseXml(content);
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                      <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Upload size={32} />
                      </div>
                      <span className="text-sm font-bold text-indigo-950">Enviar Arquivo XML (.xml)</span>
                      <p className="text-xs font-semibold text-indigo-500/70 mt-1">Selecione o arquivo da NF-e direto do seu computador ou celular</p>
                    </div>

                    {/* Text Area Parser */}
                    <div className="flex flex-col space-y-2">
                      <label className="text-xs font-bold text-slate-600 uppercase">Ou cole o conteúdo do XML abaixo:</label>
                      <textarea 
                        rows={6}
                        value={xmlText}
                        onChange={(e) => setXmlText(e.target.value)}
                        placeholder="Cole aqui todo o texto contido no arquivo XML da nota de compra..."
                        className="w-full p-3 text-xs font-mono border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-[140px]"
                      />
                      <button 
                        onClick={() => handleParseXml(xmlText)}
                        className="py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                      >
                        <Check size={16} /> Processar XML Colado
                      </button>
                    </div>

                  </div>
                </div>
              ) : (
                /* Import Preview Panel */
                <div className="space-y-6">
                  
                  {/* Global Import Settings */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Margem de Lucro Padrão (Novos Itens)</label>
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="number"
                          value={globalMarkup}
                          onChange={(e) => handleMarkupChange(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl outline-none font-bold text-sm text-slate-800 border-none bg-white h-10 shadow-sm"
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 mt-1 block">Aplica (Preço de Custo + X%) como sugestão de venda para novos produtos</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Atualização do Estoque</label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button 
                          type="button"
                          onClick={() => setStockUpdateMode('ADD')}
                          className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all h-10 ${
                            stockUpdateMode === 'ADD' 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          Somar ao Estoque
                        </button>
                        <button 
                          type="button"
                          onClick={() => setStockUpdateMode('REPLACE')}
                          className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all h-10 ${
                            stockUpdateMode === 'REPLACE' 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          Substituir Estoque
                        </button>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 mt-1 block">
                        {stockUpdateMode === 'ADD' 
                          ? 'Soma a quantidade comprada ao estoque atual cadastrado.' 
                          : 'Define o estoque exatamente para a quantidade comprada.'}
                      </span>
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-500 block">Total de itens na Nota</span>
                        <span className="text-2xl font-black text-indigo-600">{parsedNfeItems.length}</span>
                        <span className="text-[10px] font-semibold text-slate-400 block">
                          ({parsedNfeItems.filter(i => i.selected).length} selecionados para importar)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm max-h-[40vh] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase border-b border-slate-100">
                          <th className="py-3 px-4 w-12 text-center">
                            <input 
                              type="checkbox"
                              checked={parsedNfeItems.every(i => i.selected)}
                              onChange={(e) => setParsedNfeItems(prev => prev.map(p => ({ ...p, selected: e.target.checked })))}
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                          </th>
                          <th className="py-3 px-4">Produto da Nota</th>
                          <th className="py-3 px-4 text-center w-28">Estoque Compra</th>
                          <th className="py-3 px-4 text-right w-28">Custo Unitário</th>
                          <th className="py-3 px-4 text-right w-36">Preço de Venda</th>
                          <th className="py-3 px-4 w-44">Categoria Destino</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {parsedNfeItems.map((item) => (
                          <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${!item.selected ? 'opacity-50' : ''}`}>
                            {/* Checkbox */}
                            <td className="py-4 px-4 text-center">
                              <input 
                                type="checkbox"
                                checked={item.selected}
                                onChange={(e) => setParsedNfeItems(prev => prev.map(p => p.id === item.id ? { ...p, selected: e.target.checked } : p))}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                            </td>

                            {/* Info */}
                            <td className="py-4 px-4 space-y-1">
                              <div className="font-black text-slate-800 uppercase tracking-tight max-w-sm truncate" title={item.name}>
                                {item.name}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.barcode && (
                                  <span className="bg-slate-100 text-slate-500 font-mono text-[9px] px-1.5 py-0.5 rounded">
                                    EAN: {item.barcode}
                                  </span>
                                )}
                                <span className="bg-indigo-50 text-indigo-500 font-semibold text-[9px] px-1.5 py-0.5 rounded">
                                  NCM: {item.ncm} | CFOP: {item.cfop}
                                </span>
                                <span className="bg-slate-50 text-slate-400 font-semibold text-[9px] px-1.5 py-0.5 rounded">
                                  CST: {item.icms}
                                </span>
                              </div>
                              
                              {/* Match Status Badge */}
                              <div className="pt-1">
                                {item.matchedProductId ? (
                                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1 uppercase">
                                    <Check size={10} /> Associado a: {item.matchedProductName}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1 uppercase">
                                    ✚ Novo Produto (Será criado)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Buy Qty */}
                            <td className="py-4 px-4 text-center font-bold text-slate-600">
                              {item.quantity}
                            </td>

                            {/* Cost Price */}
                            <td className="py-4 px-4 text-right font-bold text-slate-600">
                              R$ {item.costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* Selling Price */}
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end">
                                <PriceInput 
                                  value={item.salePrice}
                                  onChange={(val) => setParsedNfeItems(prev => prev.map(p => p.id === item.id ? { ...p, salePrice: val } : p))}
                                  className="w-24 p-1.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-right font-bold bg-white"
                                />
                              </div>
                            </td>

                            {/* Category selector */}
                            <td className="py-4 px-4">
                              <select 
                                value={item.category}
                                onChange={(e) => setParsedNfeItems(prev => prev.map(p => p.id === item.id ? { ...p, category: e.target.value } : p))}
                                className="w-full p-1.5 border border-slate-200 rounded-lg bg-white outline-none font-bold"
                              >
                                {categories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex gap-3 bg-slate-50">
              {parsedNfeItems.length > 0 && (
                <button 
                  type="button" 
                  onClick={() => {
                    setParsedNfeItems([]);
                    setXmlText('');
                  }} 
                  className="px-6 py-3 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500 font-bold transition-colors text-xs uppercase"
                >
                  Voltar / Outra Nota
                </button>
              )}
              <div className="flex-1" />
              <button 
                type="button" 
                onClick={() => {
                  setShowXmlImportModal(false);
                  setParsedNfeItems([]);
                  setXmlText('');
                }} 
                className="px-6 py-3 text-slate-400 font-bold hover:text-slate-600 text-xs uppercase"
              >
                Cancelar
              </button>
              {parsedNfeItems.length > 0 && (
                <button 
                  type="button" 
                  disabled={isProcessingXml}
                  onClick={handleConfirmXmlImport} 
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs uppercase transition-all"
                >
                  {isProcessingXml ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> Processando Importação...
                    </>
                  ) : (
                    <>
                      Confirmar Importação de {parsedNfeItems.filter(i => i.selected).length} itens
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
