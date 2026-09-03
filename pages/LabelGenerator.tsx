import React, { useState, useMemo, useEffect } from 'react';
import { Product, Order } from '../types';
import { 
  Printer, 
  Search, 
  Tag, 
  Plus, 
  Minus, 
  Trash2, 
  Settings, 
  Grid, 
  Layers, 
  FileText, 
  RefreshCw, 
  Check, 
  ChevronRight, 
  AlertCircle,
  HelpCircle,
  Eye,
  Sliders,
  Sparkles,
  ShoppingBag,
  MapPin,
  Clock,
  User,
  Barcode as BarcodeIcon,
  QrCode as QrCodeIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// === HIGH PRECIZION CODE 128 (B) BARCODE GENERATOR ===
// Code 128 structure consists of Start B (104), Stop (106), Data, Checksum, and Quiet Zones.
// Let's implement the complete, standard pattern mapping for Code 128.
// Each pattern is represented as the width of 6 alternating bars and spaces (B S B S B S).
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212312", "232112", "111332", "113132", "113312", "111233", "111323", "113123", "112313", // 30-39
  "113213", "112331", "131132", "131312", "133112", "112214", "112412", "114212", "141122", "141221", // 40-49
  "112241", "112421", "114221", "122114", "122411", "142112", "142211", "241211", "221114", "213113", // 50-59
  "214112", "211214", "211412", "231112", "211133", "211313", "211331", "221114", "221411", "211142", // 60-69
  "211241", "211421", "224111", "221141", "221241", "221124", "224112", "134111", "111242", "111422", // 70-79
  "114112", "112241", "112421", "114221", "122114", "122411", "142112", "142211", "241211", "221114", // 80-89
  "213113", "214112", "211214", "211412", "231112", "211133", "211313", "224112", "221142", "221241", // 90-99
  "211214", "211412", "231112", "211133", "211313", "211331", "2331112" // 100-106 (106 is Stop - includes extra bar of width 2)
];

// Helper to encode string into Code 128 (Code B) barcode and render as React SVG elements
const Code128Barcode: React.FC<{ value: string; width?: number; height?: number; showText?: boolean }> = ({ 
  value, 
  width = 160, 
  height = 50, 
  showText = true 
}) => {
  const barcodeSvgContent = useMemo(() => {
    if (!value) return null;
    
    // Code 128 B supports standard ASCII 32 to 127
    const chars = value.split("").filter(c => {
      const code = c.charCodeAt(0);
      return code >= 32 && code <= 127;
    });

    if (chars.length === 0) return null;

    // Start Code B is index 104
    const sequence: number[] = [104];
    
    // Add data characters (ASCII value - 32)
    chars.forEach(c => {
      sequence.push(c.charCodeAt(0) - 32);
    });

    // Calculate checksum: (StartValue + Sum(CharValue * Position)) % 103
    let checksum = 104;
    for (let i = 1; i < sequence.length; i++) {
      checksum += sequence[i] * i;
    }
    checksum = checksum % 103;
    sequence.push(checksum);

    // Stop Code is index 106
    sequence.push(106);

    // Convert sequence of indices into bar-width string
    let barPattern = "";
    sequence.forEach((index, pos) => {
      const pattern = CODE128_PATTERNS[index];
      if (pattern) {
        barPattern += pattern;
      }
    });

    // Translate widths into SVG rects
    // Odd digits represent bars (black), Even digits represent spaces (white)
    const elements: { isBar: boolean; width: number }[] = [];
    for (let i = 0; i < barPattern.length; i++) {
      const w = parseInt(barPattern[i], 10);
      if (isNaN(w)) continue;
      elements.push({
        isBar: i % 2 === 0,
        width: w
      });
    }

    // Calculate total module width
    const totalModules = elements.reduce((sum, el) => sum + el.width, 0);
    
    return {
      elements,
      totalModules
    };
  }, [value]);

  if (!barcodeSvgContent) {
    return (
      <div className="flex flex-col items-center justify-center p-2 border border-dashed border-red-200 bg-red-50 rounded-lg text-xs text-red-600">
        <AlertCircle size={14} className="mb-1" />
        Código inválido para Barcode
      </div>
    );
  }

  const { elements, totalModules } = barcodeSvgContent;
  const moduleWidth = width / totalModules;

  let currentX = 0;

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto select-none">
        <g>
          {elements.map((el, idx) => {
            const elWidth = el.width * moduleWidth;
            const x = currentX;
            currentX += elWidth;

            if (el.isBar) {
              return (
                <rect 
                  key={idx} 
                  x={x} 
                  y={0} 
                  width={elWidth} 
                  height={height} 
                  fill="#000000" 
                  shapeRendering="crispEdges"
                />
              );
            }
            return null;
          })}
        </g>
      </svg>
      {showText && (
        <span className="text-[10px] font-mono tracking-[0.2em] mt-1 text-black font-semibold text-center select-none block">
          {value}
        </span>
      )}
    </div>
  );
};

// Types
type LabelPreset = 'product_small' | 'product_medium' | 'product_large' | 'shelf_price' | 'delivery_box' | 'sheet_a4_3x7' | 'sheet_a4_4x10' | 'custom';

interface LabelPresetConfig {
  id: LabelPreset;
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  columns: number;
  isSheet: boolean;
  idealFor: string;
}

const PRESETS: LabelPresetConfig[] = [
  { id: 'product_small', name: 'Pequeno (30x20mm)', description: 'Ideal para joias, pequenos acessórios e copos', widthMm: 30, heightMm: 20, columns: 1, isSheet: false, idealFor: 'Joias, Doces, Pequenos itens' },
  { id: 'product_medium', name: 'Médio Padrão (40x30mm)', description: 'Tamanho padrão de etiquetas para produtos de varejo', widthMm: 40, heightMm: 30, columns: 1, isSheet: false, idealFor: 'Roupas, Embalagens, Produtos Gerais' },
  { id: 'product_large', name: 'Grande / Catálogo (60x40mm)', description: 'Mais espaço para descrições, tabelas ou logos', widthMm: 60, heightMm: 40, columns: 1, isSheet: false, idealFor: 'Cervejas Artesanais, Cosméticos, Caixas' },
  { id: 'shelf_price', name: 'Etiqueta de Gôndola (80x40mm)', description: 'Destaque visual para preço, ideal para prateleiras de mercado', widthMm: 80, heightMm: 40, columns: 1, isSheet: false, idealFor: 'Preços em Prateleiras e Displays' },
  { id: 'delivery_box', name: 'Sacola & Delivery (80x80mm)', description: 'Etiqueta quadrada para fechar sacolas de delivery e caixas', widthMm: 80, heightMm: 80, columns: 1, isSheet: false, idealFor: 'Delivery, Sacolas, Caixas de Pizza' },
  { id: 'sheet_a4_3x7', name: 'Folha A4 Pimaco (3x7)', description: 'Imprima em qualquer impressora jato de tinta ou laser (21 etiquetas)', widthMm: 70, heightMm: 42, columns: 3, isSheet: true, idealFor: 'Folhas de Etiquetas Pimaco 6182' },
  { id: 'sheet_a4_4x10', name: 'Folha A4 Pimaco (4x10)', description: 'Alta densidade de etiquetas pequenas em folha comum (40 etiquetas)', widthMm: 52.5, heightMm: 29.7, columns: 4, isSheet: true, idealFor: 'Folhas de Etiquetas Pimaco 6180' },
];

interface LabelItem {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  barcode?: string;
  qrCodeUrl?: string;
  quantity: number;
  orderInfo?: {
    orderId: string;
    customerName: string;
    deliveryAddress?: string;
    notes?: string;
    itemsSummary: string;
    createdAt: string;
    tableOrBalcao?: string;
  };
}

interface LabelGeneratorProps {
  products: Product[];
  orders: Order[];
  settings?: any;
}

export const LabelGenerator: React.FC<LabelGeneratorProps> = ({ products, orders, settings }) => {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'custom'>('products');
  
  // Selection States
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  
  // Order Selection States
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [printOrderDeliveryOnly, setPrintOrderDeliveryOnly] = useState(false);
  const [printOrderItemsSeparately, setPrintOrderItemsSeparately] = useState(true);

  // Custom Label State
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customCode, setCustomCode] = useState('');
  const [customCodeType, setCustomCodeType] = useState<'barcode' | 'qrcode'>('barcode');
  const [customQty, setCustomQty] = useState<number>(1);

  // Presets & Sizing state
  const [selectedPreset, setSelectedPreset] = useState<LabelPreset>('product_medium');
  const [customWidth, setCustomWidth] = useState<number>(40);
  const [customHeight, setCustomHeight] = useState<number>(30);
  
  // Customization Options
  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [codeType, setCodeType] = useState<'barcode' | 'qrcode' | 'none'>('barcode');
  const [showBorder, setShowBorder] = useState(true);
  const [customText, setCustomText] = useState('');
  const [customTextPosition, setCustomTextPosition] = useState<'top' | 'bottom'>('bottom');
  const [alignment, setAlignment] = useState<'left' | 'center'>('center');
  const [fontSizeTitle, setFontSizeTitle] = useState<number>(14);
  const [fontSizePrice, setFontSizePrice] = useState<number>(18);
  const [fontSizeMeta, setFontSizeMeta] = useState<number>(10);
  const [priceColorAccent, setPriceColorAccent] = useState(true);
  const [fontColor, setFontColor] = useState('#000000');
  const [fontFamily, setFontFamily] = useState('system-ui, sans-serif');

  // Local Categories extracted from products
  const categories = useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => {
      if (p.category) list.add(p.category);
    });
    return Array.from(list);
  }, [products]);

  // Current active preset configuration
  const presetConfig = useMemo(() => {
    const p = PRESETS.find(pr => pr.id === selectedPreset);
    if (p) {
      return p;
    }
    return {
      id: 'custom' as any,
      name: 'Personalizado',
      description: 'Dimensões customizadas pelo usuário',
      widthMm: customWidth,
      heightMm: customHeight,
      columns: 1,
      isSheet: false,
      idealFor: 'Geral'
    };
  }, [selectedPreset, customWidth, customHeight]);

  // Sync custom dimensions with preset when preset changes
  useEffect(() => {
    const p = PRESETS.find(pr => pr.id === selectedPreset);
    if (p) {
      setCustomWidth(p.widthMm);
      setCustomHeight(p.heightMm);
    }
  }, [selectedPreset]);

  // Filtered products list for selector
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(productSearch));
      const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, productSearch, selectedCategory]);

  // Selected Order details
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId);
  }, [orders, selectedOrderId]);

  // Compile final array of labels to be printed
  const labelsToPrint = useMemo((): LabelItem[] => {
    const items: LabelItem[] = [];

    // tab: Products
    if (activeTab === 'products') {
      Object.entries(selectedProducts).forEach(([prodId, qty]) => {
        if (qty <= 0) return;
        const prod = products.find(p => p.id === prodId);
        if (prod) {
          items.push({
            id: `prod-${prod.id}`,
            title: prod.name,
            subtitle: prod.category || '',
            price: prod.price,
            barcode: prod.barcode || undefined,
            qrCodeUrl: prod.barcode ? undefined : undefined, // can represent product link too if needed
            quantity: qty
          });
        }
      });
    }

    // tab: Orders
    if (activeTab === 'orders' && selectedOrder) {
      const formattedDate = new Date(selectedOrder.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      const itemsSummary = selectedOrder.items
        .map(i => `${i.quantity}x ${i.name}`)
        .join(', ');

      // Mode 1: Delivery Address Label Only
      if (printOrderDeliveryOnly) {
        items.push({
          id: `order-delivery-${selectedOrder.id}`,
          title: `ENTREGA - PEDIDO #${selectedOrder.displayId || selectedOrder.id.substring(0, 5)}`,
          subtitle: `Cliente: ${selectedOrder.customerName || 'Cliente Geral'}`,
          price: selectedOrder.total,
          barcode: selectedOrder.displayId || selectedOrder.id.substring(0, 8),
          quantity: 1,
          orderInfo: {
            orderId: selectedOrder.displayId || selectedOrder.id.substring(0, 6),
            customerName: selectedOrder.customerName || 'Cliente Geral',
            deliveryAddress: selectedOrder.deliveryAddress || 'Retirada no Balcão',
            notes: selectedOrder.notes,
            itemsSummary: itemsSummary,
            createdAt: formattedDate,
            tableOrBalcao: selectedOrder.tableNumber ? `Mesa ${selectedOrder.tableNumber}` : undefined
          }
        });
      }

      // Mode 2: Individual Item Labels (one for each product package)
      if (printOrderItemsSeparately) {
        selectedOrder.items.forEach((item, itemIdx) => {
          // Add label for each unit ordered, or 1 label per distinct item
          items.push({
            id: `order-item-${selectedOrder.id}-${item.productId}-${itemIdx}`,
            title: item.name,
            subtitle: selectedOrder.customerName ? `Para: ${selectedOrder.customerName}` : `Pedido #${selectedOrder.displayId || selectedOrder.id.substring(0, 4)}`,
            price: item.price,
            quantity: item.quantity, // print 'quantity' labels for this item
            orderInfo: {
              orderId: selectedOrder.displayId || selectedOrder.id.substring(0, 6),
              customerName: selectedOrder.customerName || 'Cliente Geral',
              itemsSummary: `Item ${itemIdx + 1} de ${selectedOrder.items.length}`,
              createdAt: formattedDate,
              notes: selectedOrder.notes || undefined,
              tableOrBalcao: selectedOrder.tableNumber ? `MESA ${selectedOrder.tableNumber}` : selectedOrder.type === 'BALCAO' ? 'BALCÃO' : 'DELIVERY'
            }
          });
        });
      }
    }

    // tab: Custom / Manual
    if (activeTab === 'custom' && customTitle) {
      items.push({
        id: 'custom-label-item',
        title: customTitle,
        subtitle: customSubtitle,
        price: customPrice,
        barcode: customCodeType === 'barcode' ? customCode : undefined,
        qrCodeUrl: customCodeType === 'qrcode' ? customCode : undefined,
        quantity: customQty
      });
    }

    return items;
  }, [activeTab, selectedProducts, products, selectedOrder, printOrderDeliveryOnly, printOrderItemsSeparately, customTitle, customSubtitle, customPrice, customCode, customCodeType, customQty]);

  // Total quantity of labels to render on paper
  const totalLabelsCount = useMemo(() => {
    return labelsToPrint.reduce((acc, item) => acc + item.quantity, 0);
  }, [labelsToPrint]);

  // Flattened array of individual labels for rendering on page
  const flattenedLabels = useMemo(() => {
    const list: LabelItem[] = [];
    labelsToPrint.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        list.push({ ...item, quantity: 1 });
      }
    });
    return list;
  }, [labelsToPrint]);

  // Multi-product selection actions
  const handleProductQtyChange = (productId: string, val: number) => {
    setSelectedProducts(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + val);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const addAllProducts = () => {
    const next: Record<string, number> = {};
    filteredProducts.forEach(p => {
      next[p.id] = 1;
    });
    setSelectedProducts(next);
  };

  const clearAllProducts = () => {
    setSelectedProducts({});
  };

  const handlePrint = () => {
    if (flattenedLabels.length === 0) {
      alert("Adicione pelo menos uma etiqueta para imprimir.");
      return;
    }
    window.print();
  };

  // Preset quick selections for specific use-cases
  const applyUseCasePreset = (useCase: 'standard_product' | 'shelf_large' | 'gourmet_beer' | 'delivery_seal' | 'sheet_a4') => {
    switch(useCase) {
      case 'standard_product':
        setSelectedPreset('product_medium');
        setShowStoreName(true);
        setShowProductName(true);
        setShowPrice(true);
        setCodeType('barcode');
        setShowBorder(true);
        setAlignment('center');
        setFontSizeTitle(13);
        setFontSizePrice(18);
        setFontSizeMeta(9);
        break;
      case 'shelf_large':
        setSelectedPreset('shelf_price');
        setShowStoreName(true);
        setShowProductName(true);
        setShowPrice(true);
        setCodeType('barcode');
        setShowBorder(true);
        setAlignment('left');
        setFontSizeTitle(16);
        setFontSizePrice(24);
        setFontSizeMeta(10);
        break;
      case 'gourmet_beer':
        setSelectedPreset('product_large');
        setShowStoreName(true);
        setShowProductName(true);
        setShowPrice(true);
        setCodeType('qrcode');
        setShowBorder(true);
        setAlignment('center');
        setFontSizeTitle(14);
        setFontSizePrice(20);
        setFontSizeMeta(10);
        break;
      case 'delivery_seal':
        setSelectedPreset('delivery_box');
        setShowStoreName(true);
        setShowProductName(true);
        setShowPrice(false);
        setCodeType('none');
        setShowBorder(true);
        setAlignment('center');
        setFontSizeTitle(16);
        setFontSizePrice(14);
        setFontSizeMeta(11);
        setCustomText("Obrigado pelo seu pedido! Bom apetite! ❤️");
        setCustomTextPosition('bottom');
        break;
      case 'sheet_a4':
        setSelectedPreset('sheet_a4_3x7');
        setShowStoreName(true);
        setShowProductName(true);
        setShowPrice(true);
        setCodeType('barcode');
        setShowBorder(true);
        setAlignment('center');
        setFontSizeTitle(12);
        setFontSizePrice(16);
        setFontSizeMeta(9);
        break;
    }
  };

  return (
    <div className="w-full space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* PRINT-ONLY CSS STYLES INJECTOR */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Montserrat:wght@400;600;700;900&family=Playfair+Display:wght@400;700;900&family=Outfit:wght@400;600;700;900&family=Pacifico&family=Courier+Prime:wght@400;700&family=Plus+Jakarta+Sans:wght@400;700;800&display=swap');

        @media print {
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
          }
          /* Custom layout depending on continuous vs sheet */
          .print-label-sheet {
            display: grid !important;
            grid-template-columns: repeat(${presetConfig.columns}, 1fr) !important;
            gap: ${presetConfig.isSheet ? '2mm' : '0'} !important;
            padding: ${presetConfig.isSheet ? '10mm 5mm' : '0'} !important;
            background: #ffffff !important;
          }
          .print-label-item {
            width: ${presetConfig.widthMm}mm !important;
            height: ${presetConfig.heightMm}mm !important;
            max-width: ${presetConfig.widthMm}mm !important;
            max-height: ${presetConfig.heightMm}mm !important;
            box-sizing: border-box !important;
            border: ${showBorder ? `0.5px solid ${fontColor}` : 'none'} !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: ${alignment === 'center' ? 'center' : 'flex-start'} !important;
            text-align: ${alignment === 'center' ? 'center' : 'left'} !important;
            padding: 2.5mm !important;
            overflow: hidden !important;
            background: #ffffff !important;
            color: ${fontColor} !important;
            font-family: ${fontFamily} !important;
            position: relative !important;
          }
          /* Page size configuration */
          @page {
            size: ${presetConfig.isSheet ? 'A4 portrait' : `${presetConfig.widthMm + 4}mm ${presetConfig.heightMm + 4}mm`} !important;
            margin: ${presetConfig.isSheet ? '5mm' : '0'} !important;
          }
        }
      `}</style>

      {/* HEADER SECTION (NO-PRINT) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm no-print">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <Tag size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gerador de Etiquetas</h1>
            <p className="text-slate-500 text-sm">Crie etiquetas de código de barras, preços de gôndola e fechamento de pedidos.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            disabled={flattenedLabels.length === 0}
            className={`px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              flattenedLabels.length > 0 
                ? 'bg-orange-600 text-white hover:bg-orange-700 active:scale-95 shadow-md shadow-orange-100' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Printer size={20} />
            Imprimir ({flattenedLabels.length} {flattenedLabels.length === 1 ? 'Etiqueta' : 'Etiquetas'})
          </button>
        </div>
      </div>

      {/* QUICK PRESET BENTO (NO-PRINT) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
        <button 
          onClick={() => applyUseCasePreset('standard_product')}
          className="bg-white hover:bg-orange-50/50 p-3 rounded-xl border border-slate-100 hover:border-orange-200 text-left transition-all active:scale-95"
        >
          <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Modelo Comum</span>
          <span className="font-bold text-slate-800 text-sm block">🏷️ Etiqueta de Produto</span>
          <span className="text-xs text-slate-500">40x30mm com barras</span>
        </button>
        <button 
          onClick={() => applyUseCasePreset('shelf_large')}
          className="bg-white hover:bg-orange-50/50 p-3 rounded-xl border border-slate-100 hover:border-orange-200 text-left transition-all active:scale-95"
        >
          <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Preço de Prateleira</span>
          <span className="font-bold text-slate-800 text-sm block">🗄️ Etiqueta de Gôndola</span>
          <span className="text-xs text-slate-500">80x40mm preço gigante</span>
        </button>
        <button 
          onClick={() => applyUseCasePreset('gourmet_beer')}
          className="bg-white hover:bg-orange-50/50 p-3 rounded-xl border border-slate-100 hover:border-orange-200 text-left transition-all active:scale-95"
        >
          <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Artesanais & Doces</span>
          <span className="font-bold text-slate-800 text-sm block">🍾 QR Code / Detalhes</span>
          <span className="text-xs text-slate-500">60x40mm com QR Code</span>
        </button>
        <button 
          onClick={() => applyUseCasePreset('delivery_seal')}
          className="bg-white hover:bg-orange-50/50 p-3 rounded-xl border border-slate-100 hover:border-orange-200 text-left transition-all active:scale-95"
        >
          <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Embalagens</span>
          <span className="font-bold text-slate-800 text-sm block">🍕 Selo de Lacre / Bag</span>
          <span className="text-xs text-slate-500">80x80mm com agradecimento</span>
        </button>
        <button 
          onClick={() => applyUseCasePreset('sheet_a4')}
          className="bg-white hover:bg-orange-50/50 p-3 rounded-xl border border-slate-100 hover:border-orange-200 text-left transition-all active:scale-95"
        >
          <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Sem Impressora Térmica</span>
          <span className="font-bold text-slate-800 text-sm block">📄 Folha Pimaco A4</span>
          <span className="text-xs text-slate-500">Imprima em impressora comum</span>
        </button>
      </div>

      {/* CORE WORKSPACE SPLIT (NO-PRINT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        
        {/* LEFT PANEL: DATA SELECTION & TEMPLATE CUSTOMIZATION */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* TAB NAVIGATION CARDS */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
              <button
                onClick={() => { setActiveTab('products'); clearAllProducts(); }}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'products' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Layers size={18} />
                Menu / Cardápio
              </button>
              <button
                onClick={() => { setActiveTab('orders'); setSelectedOrderId(''); }}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'orders' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <ShoppingBag size={18} />
                Pedidos Recentes
              </button>
              <button
                onClick={() => { setActiveTab('custom'); }}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'custom' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Sliders size={18} />
                Avulsa / Manual
              </button>
            </div>

            <div className="p-6">
              
              {/* TAB CONTENT 1: MENU PRODUCTS */}
              {activeTab === 'products' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        placeholder="Buscar produto por nome ou código de barras..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                      />
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none text-sm text-slate-700 min-w-[150px]"
                    >
                      <option value="all">Todas Categorias</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-600 font-semibold">{filteredProducts.length} produtos encontrados</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={addAllProducts}
                        className="text-orange-600 hover:text-orange-700 font-bold uppercase tracking-wider"
                      >
                        Adicionar Todos
                      </button>
                      <span className="text-slate-300">|</span>
                      <button 
                        onClick={clearAllProducts}
                        className="text-slate-500 hover:text-slate-600 font-bold uppercase tracking-wider"
                      >
                        Limpar Seleção
                      </button>
                    </div>
                  </div>

                  {/* PRODUCTS LIST */}
                  <div className="max-h-[300px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 custom-scrollbar pr-1">
                    {filteredProducts.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        Nenhum produto cadastrado ou correspondente à busca.
                      </div>
                    ) : (
                      filteredProducts.map(prod => {
                        const qty = selectedProducts[prod.id] || 0;
                        return (
                          <div key={prod.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                            <div className="min-w-0 pr-4">
                              <span className="font-bold text-sm text-slate-800 block truncate">{prod.name}</span>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-xs font-bold text-orange-600">R$ {prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                {prod.barcode && (
                                  <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                                    EAN: {prod.barcode}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* QTY CONTROLS */}
                            <div className="flex items-center gap-2.5 shrink-0">
                              {qty > 0 ? (
                                <>
                                  <button
                                    onClick={() => handleProductQtyChange(prod.id, -1)}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 rounded-lg transition-colors"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className="w-8 text-center font-bold text-sm text-slate-800">{qty}</span>
                                  <button
                                    onClick={() => handleProductQtyChange(prod.id, 1)}
                                    className="p-1.5 bg-orange-100 hover:bg-orange-200 active:scale-95 text-orange-600 rounded-lg transition-colors"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleProductQtyChange(prod.id, 1)}
                                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                                >
                                  Adicionar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB CONTENT 2: RECENT ORDERS */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Selecione o Pedido</span>
                  <div className="grid grid-cols-1 gap-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {orders.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Nenhum pedido recente localizado.
                      </div>
                    ) : (
                      orders.slice(0, 15).map(order => {
                        const isSelected = order.id === selectedOrderId;
                        const dateStr = new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <button
                            key={order.id}
                            onClick={() => setSelectedOrderId(order.id)}
                            className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                              isSelected 
                                ? 'border-orange-500 bg-orange-50/20 ring-2 ring-orange-500/10' 
                                : 'border-slate-100 hover:border-slate-200 bg-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-brand font-black text-sm text-slate-800">Pedido #{order.displayId || order.id.substring(0, 5)}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{order.type}</span>
                              </div>
                              <span className="text-xs text-slate-500 mt-0.5 block truncate max-w-[280px]">
                                {order.customerName || 'Cliente Geral'} • {order.items.length} itens
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-sm text-slate-800 block">R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              <span className="text-[10px] text-slate-400 font-medium block">{dateStr}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selectedOrder && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-bold text-slate-600">Configurações da Etiqueta do Pedido:</span>
                        <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">Pedido Selecionado</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={printOrderDeliveryOnly}
                            onChange={(e) => {
                              setPrintOrderDeliveryOnly(e.target.checked);
                              if (e.target.checked) setPrintOrderItemsSeparately(false);
                            }}
                            className="rounded text-orange-600 focus:ring-orange-500 border-slate-300 w-4 h-4"
                          />
                          Selo de Entrega (Apenas Endereço)
                        </label>

                        <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={printOrderItemsSeparately}
                            onChange={(e) => {
                              setPrintOrderItemsSeparately(e.target.checked);
                              if (e.target.checked) setPrintOrderDeliveryOnly(false);
                            }}
                            className="rounded text-orange-600 focus:ring-orange-500 border-slate-300 w-4 h-4"
                          />
                          Etiquetas de Itens Individuais
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT 3: CUSTOM LABELS */}
              {activeTab === 'custom' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título Principal</label>
                      <input
                        type="text"
                        placeholder="Ex: Nome do Produto ou Item"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Subtítulo / Descrição</label>
                      <input
                        type="text"
                        placeholder="Ex: Vol: 500ml, Peso: 200g"
                        value={customSubtitle}
                        onChange={(e) => setCustomSubtitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Preço (Opcional)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={customPrice === 0 ? '' : customPrice}
                          onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Código de Barras ou QR Code</label>
                      <input
                        type="text"
                        placeholder="Ex: 7891234567890 ou link"
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tipo de Código</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomCodeType('barcode')}
                          className={`flex-1 py-2 px-3 border rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                            customCodeType === 'barcode' ? 'border-orange-500 bg-orange-50/10 text-orange-600' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          <BarcodeIcon size={14} /> Barcode (Código de Barras)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomCodeType('qrcode')}
                          className={`flex-1 py-2 px-3 border rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                            customCodeType === 'qrcode' ? 'border-orange-500 bg-orange-50/10 text-orange-600' : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          <QrCodeIcon size={14} /> QR Code (Pix ou Links)
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Quantidade de Cópias</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomQty(prev => Math.max(1, prev - 1))}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="number"
                          value={customQty}
                          onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 py-2 border rounded-xl text-center font-bold text-slate-800 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setCustomQty(prev => prev + 1)}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* TEMPLATE FORMAT & CUSTOM DIMENSIONS CONFIG */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Settings className="text-slate-400" size={18} />
              <h2 className="font-black text-slate-800 text-base">Formatos de Papel & Modelos</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Modelo Pré-Configurado</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value as LabelPreset)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none text-sm text-slate-700"
                >
                  <optgroup label="Bobina Térmica Contínua (Zebra, Elgin, Xprinter)">
                    <option value="product_small">Pequeno (30x20mm)</option>
                    <option value="product_medium">Médio Padrão (40x30mm)</option>
                    <option value="product_large">Grande / Caixas (60x40mm)</option>
                    <option value="shelf_price">Gôndola Prateleira (80x40mm)</option>
                    <option value="delivery_box">Sacolas & Delivery (80x80mm)</option>
                  </optgroup>
                  <optgroup label="Folhas Adesivas A4 Comuns (Qualquer impressora)">
                    <option value="sheet_a4_3x7">Folha A4 Pimaco (3x7 - 21 Etiquetas)</option>
                    <option value="sheet_a4_4x10">Folha A4 Pimaco (4x10 - 40 Etiquetas)</option>
                  </optgroup>
                  <option value="custom">Dimensões Customizadas (mm)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Uso Recomendado</label>
                <div className="px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-slate-600 text-xs font-semibold flex items-center gap-2 h-[42px]">
                  <Sparkles size={14} className="text-orange-500 shrink-0" />
                  <span className="truncate">{presetConfig.idealFor}</span>
                </div>
              </div>
            </div>

            {selectedPreset === 'custom' && (
              <div className="grid grid-cols-2 gap-4 bg-orange-50/30 p-4 rounded-xl border border-orange-100/50 animate-scale-up">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-orange-700 uppercase tracking-wider block">Largura da Etiqueta (mm)</label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Math.max(10, parseInt(e.target.value) || 40))}
                    className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:outline-none text-sm font-bold text-orange-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-orange-700 uppercase tracking-wider block">Altura da Etiqueta (mm)</label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Math.max(10, parseInt(e.target.value) || 30))}
                    className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:outline-none text-sm font-bold text-orange-950"
                  />
                </div>
              </div>
            )}
          </div>

          {/* LABEL FIELD DISPLAY OPTIONS */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sliders className="text-slate-400" size={18} />
              <h2 className="font-black text-slate-800 text-base">Campos & Exibição das Etiquetas</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:border-slate-200 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={showStoreName}
                  onChange={(e) => setShowStoreName(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 border-slate-300 w-4.5 h-4.5"
                />
                Nome do Estabelecimento
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:border-slate-200 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={showProductName}
                  onChange={(e) => setShowProductName(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 border-slate-300 w-4.5 h-4.5"
                />
                Título do Item
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:border-slate-200 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 border-slate-300 w-4.5 h-4.5"
                />
                Exibir Preço (R$)
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:border-slate-200 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={showBorder}
                  onChange={(e) => setShowBorder(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 border-slate-300 w-4.5 h-4.5"
                />
                Borda Separadora
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:border-slate-200 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={priceColorAccent}
                  onChange={(e) => setPriceColorAccent(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 border-slate-300 w-4.5 h-4.5"
                />
                Destaque no Preço
              </label>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Código Integrado</label>
                <select
                  value={codeType}
                  onChange={(e) => setCodeType(e.target.value as any)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                >
                  <option value="barcode">Código de Barras</option>
                  <option value="qrcode">Código QR (QR Code)</option>
                  <option value="none">Nenhum Código</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Texto Livre / Rodapé Personalizado</label>
                <input
                  type="text"
                  placeholder="Ex: Obrigado pela preferência! ou Validade: 30 dias"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-xs text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Posição Texto Livre</label>
                  <select
                    value={customTextPosition}
                    onChange={(e) => setCustomTextPosition(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                  >
                    <option value="top">No Topo</option>
                    <option value="bottom">No Rodapé</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Alinhamento Texto</label>
                  <select
                    value={alignment}
                    onChange={(e) => setAlignment(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                  >
                    <option value="center">Centralizado</option>
                    <option value="left">Alinhado à Esquerda</option>
                  </select>
                </div>
              </div>
            </div>

            {/* FONT STYLE & COLOR */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5">
              <span className="text-xs font-bold text-slate-600 block">Estilo & Cor da Fonte</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tipo de Fonte (Família)</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-bold"
                  >
                    <option value="system-ui, sans-serif">Sans-Serif (Moderna)</option>
                    <option value="Georgia, serif">Serif (Clássica)</option>
                    <option value="monospace">Monospace (Técnica)</option>
                    <option value="'Montserrat', sans-serif">Montserrat</option>
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="'Caveat', cursive">Caveat (Artesanal)</option>
                    <option value="'Pacifico', cursive">Pacifico (Retro Cursiva)</option>
                    <option value="'Outfit', sans-serif">Outfit (Geométrica)</option>
                    <option value="'Courier Prime', monospace">Courier Prime (Máquina de Escrever)</option>
                    <option value="'Plus Jakarta Sans', sans-serif">Plus Jakarta Sans</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cor do Texto</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 shrink-0"
                    />
                    <select
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-bold"
                    >
                      <option value="#000000">Preto</option>
                      <option value="#1e293b">Cinza Escuro</option>
                      <option value="#991b1b">Vermelho Escuro</option>
                      <option value="#1e3a8a">Azul Marinho</option>
                      <option value="#064e3b">Verde Escuro</option>
                      <option value="#b45309">Dourado / Bronze</option>
                      {!['#000000', '#1e293b', '#991b1b', '#1e3a8a', '#064e3b', '#b45309'].includes(fontColor) && (
                        <option value={fontColor}>Personalizada ({fontColor})</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* FONT SIZING SLIDERS */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5">
              <span className="text-xs font-bold text-slate-600 block">Tamanho das Fontes (Pixels)</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Título</span>
                    <span>{fontSizeTitle}px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={fontSizeTitle}
                    onChange={(e) => setFontSizeTitle(parseInt(e.target.value))}
                    className="w-full accent-orange-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Preço</span>
                    <span>{fontSizePrice}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="32"
                    value={fontSizePrice}
                    onChange={(e) => setFontSizePrice(parseInt(e.target.value))}
                    className="w-full accent-orange-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Metadados / Rodapé</span>
                    <span>{fontSizeMeta}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="16"
                    value={fontSizeMeta}
                    onChange={(e) => setFontSizeMeta(parseInt(e.target.value))}
                    className="w-full accent-orange-600"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT PANEL: LIVE WYSIWYG PREVIEW */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6 h-fit">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="text-slate-400" size={18} />
                <h2 className="font-black text-slate-800 text-base">Visualização Real (Amostra)</h2>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">
                {presetConfig.widthMm}x{presetConfig.heightMm} mm
              </span>
            </div>

            {flattenedLabels.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <HelpCircle size={32} className="mx-auto mb-2 text-slate-300 animate-pulse" />
                <span>Adicione produtos ou preencha dados manuais para visualizar a etiqueta de teste.</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-slate-100 rounded-xl border border-slate-200/50 overflow-hidden relative group">
                
                {/* SAMPLE LABELS CONTAINER */}
                <div className="shadow-2xl bg-white border border-slate-300 p-2.5 transition-transform duration-300 max-w-full">
                  <div 
                    style={{
                      width: `${presetConfig.widthMm * 3.779}px`, // conversion approximate mm to px at 96 DPI
                      height: `${presetConfig.heightMm * 3.779}px`,
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: alignment === 'center' ? 'center' : 'flex-start',
                      textAlign: alignment === 'center' ? 'center' : 'left',
                      border: showBorder ? `1px solid ${fontColor}` : 'none',
                      position: 'relative',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff',
                      color: fontColor,
                      fontFamily: fontFamily,
                      overflow: 'hidden'
                    }}
                  >
                    {/* Header: Store Name or free text top */}
                    <div className="w-full flex flex-col items-center select-none">
                      {customText && customTextPosition === 'top' && (
                        <span style={{ fontSize: `${fontSizeMeta - 1}px` }} className="text-current font-semibold block leading-tight truncate w-full">
                          {customText}
                        </span>
                      )}
                      {showStoreName && (
                        <span style={{ fontSize: `${fontSizeMeta}px` }} className="text-current font-black uppercase tracking-wider block leading-tight truncate w-full">
                          {settings?.storeName || 'MINHA LOJA'}
                        </span>
                      )}
                    </div>

                    {/* Middle: Title & Metadata or address summary */}
                    <div className="w-full flex flex-col justify-center my-1 select-none">
                      {showProductName && (
                        <h3 
                          style={{ fontSize: `${fontSizeTitle}px` }} 
                          className="font-black text-current leading-tight tracking-tight line-clamp-2 w-full uppercase"
                        >
                          {flattenedLabels[0].title}
                        </h3>
                      )}
                      
                      {flattenedLabels[0].subtitle && (
                        <span style={{ fontSize: `${fontSizeMeta}px` }} className="opacity-80 font-bold block mt-0.5 leading-tight truncate w-full">
                          {flattenedLabels[0].subtitle}
                        </span>
                      )}

                      {/* Display Order Details specifically if loaded */}
                      {flattenedLabels[0].orderInfo && (
                        <div className="mt-1.5 space-y-1 w-full text-left bg-current/[0.03] p-1.5 rounded border border-current/10">
                          {flattenedLabels[0].orderInfo.deliveryAddress && (
                            <div className="flex gap-1 items-start">
                              <MapPin size={9} className="shrink-0 mt-0.5 text-current" />
                              <span className="text-[9px] font-black leading-tight line-clamp-3 text-current">
                                {flattenedLabels[0].orderInfo.deliveryAddress}
                              </span>
                            </div>
                          )}
                          {flattenedLabels[0].orderInfo.notes && (
                            <div className="text-[8px] font-semibold text-current italic line-clamp-2 leading-tight border-t border-current/10 pt-0.5 mt-0.5 opacity-90">
                              Obs: {flattenedLabels[0].orderInfo.notes}
                            </div>
                          )}
                          <div className="flex justify-between items-center text-[8px] text-current/75 border-t border-current/10 pt-0.5 font-bold mt-0.5">
                            <span>{flattenedLabels[0].orderInfo.tableOrBalcao || 'ENTREGA'}</span>
                            <span>{flattenedLabels[0].orderInfo.createdAt}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Integrated Codes and Price block */}
                    <div className="w-full flex flex-col items-center justify-end space-y-1">
                      
                      {/* Price Section */}
                      {showPrice && flattenedLabels[0].price > 0 && (
                        <div 
                          style={{ fontSize: `${fontSizePrice}px` }} 
                          className={`font-black tracking-tight leading-none text-center select-none ${
                            priceColorAccent ? 'text-red-600' : 'text-current'
                          }`}
                        >
                          R$ {flattenedLabels[0].price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}

                      {/* Codes Section */}
                      {codeType === 'barcode' && flattenedLabels[0].barcode && (
                        <Code128Barcode 
                          value={flattenedLabels[0].barcode} 
                          width={presetConfig.widthMm * 2.8} 
                          height={Math.min(presetConfig.heightMm * 0.8, 28)} 
                          showText={presetConfig.heightMm > 25}
                        />
                      )}

                      {codeType === 'qrcode' && (flattenedLabels[0].barcode || flattenedLabels[0].qrCodeUrl || flattenedLabels[0].title) && (
                        <div className="flex justify-center p-1 bg-white border border-black/10 rounded">
                          <QRCodeSVG 
                            value={flattenedLabels[0].barcode || flattenedLabels[0].qrCodeUrl || flattenedLabels[0].title} 
                            size={Math.min(presetConfig.heightMm * 1.5, 45)}
                          />
                        </div>
                      )}

                      {/* Custom footer text */}
                      {customText && customTextPosition === 'bottom' && (
                        <span style={{ fontSize: `${fontSizeMeta - 1}px` }} className="text-current font-semibold block leading-tight text-center truncate w-full">
                          {customText}
                        </span>
                      )}
                    </div>

                  </div>
                </div>

                <div className="absolute bottom-2.5 right-2.5 text-[10px] text-slate-400 font-bold tracking-wider select-none opacity-0 group-hover:opacity-100 transition-opacity">
                  Amostra WYSIWYG
                </div>
              </div>
            )}

            {/* SELECTION SUMMARY LIST */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Resumo do Lote de Impressão</span>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 divide-y divide-slate-200/60 text-xs font-semibold max-h-[200px] overflow-y-auto custom-scrollbar">
                {labelsToPrint.length === 0 ? (
                  <span className="text-slate-400 text-center block py-4">Nenhuma etiqueta em lote.</span>
                ) : (
                  labelsToPrint.map(item => (
                    <div key={item.id} className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0">
                      <div className="min-w-0 pr-4">
                        <span className="text-slate-800 font-bold block truncate">{item.title}</span>
                        {item.price > 0 && <span className="text-slate-500 text-[10px]">Preço unitário: R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                      </div>
                      <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-1 rounded-lg font-black shrink-0 text-[11px]">
                        {item.quantity} {item.quantity === 1 ? 'cópia' : 'cópias'}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-between items-center pt-2 font-bold text-sm text-slate-800 border-t border-slate-100">
                <span>Total de Etiquetas Impressas:</span>
                <span className="text-orange-600 font-black text-base">{totalLabelsCount}</span>
              </div>
            </div>
            
            <button
              onClick={handlePrint}
              disabled={flattenedLabels.length === 0}
              className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                flattenedLabels.length > 0 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-100 active:scale-[0.98]' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Printer size={18} />
              Enviar para Impressão (F6)
            </button>
          </div>
        </div>

      </div>

      {/* RENDER BLOCK EXCLUSIVELY FOR NATIVE BROWSER PRINTING (HIDDEN BY DEFAULT IN UI) */}
      <div className="hidden print-area">
        <div className="print-label-sheet">
          {flattenedLabels.map((lbl, idx) => (
            <div key={`${lbl.id}-print-${idx}`} className="print-label-item">
              
              {/* Top Section */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: alignment === 'center' ? 'center' : 'flex-start' }}>
                {customText && customTextPosition === 'top' && (
                  <span style={{ fontSize: `${fontSizeMeta - 1}px`, fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {customText}
                  </span>
                )}
                {showStoreName && (
                  <span style={{ fontSize: `${fontSizeMeta}px`, fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {settings?.storeName || 'MINHA LOJA'}
                  </span>
                )}
              </div>

              {/* Middle Title / Description Section */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '1mm 0' }}>
                {showProductName && (
                  <span style={{ fontSize: `${fontSizeTitle}px`, fontWeight: 'bold', textTransform: 'uppercase', lineHeight: '1.1' }}>
                    {lbl.title}
                  </span>
                )}
                {lbl.subtitle && (
                  <span style={{ fontSize: `${fontSizeMeta}px`, fontWeight: 'bold', opacity: '0.8' }}>
                    {lbl.subtitle}
                  </span>
                )}

                {/* Delivery and Order Metadata */}
                {lbl.orderInfo && (
                  <div style={{ 
                    marginTop: '1.5mm', 
                    padding: '1mm', 
                    background: '#f3f4f6', 
                    borderRadius: '1mm', 
                    border: '0.2px solid ' + fontColor,
                    textAlign: 'left'
                  }}>
                    {lbl.orderInfo.deliveryAddress && (
                      <span style={{ fontSize: `${fontSizeMeta}px`, fontWeight: 'bold', display: 'block', lineHeight: '1.2' }}>
                        Endereço: {lbl.orderInfo.deliveryAddress}
                      </span>
                    )}
                    {lbl.orderInfo.notes && (
                      <span style={{ fontSize: `${fontSizeMeta - 1}px`, display: 'block', fontStyle: 'italic', marginTop: '0.5mm' }}>
                        Obs: {lbl.orderInfo.notes}
                      </span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${fontSizeMeta - 2}px`, borderTop: '0.1px solid ' + fontColor, marginTop: '1mm', paddingTop: '0.5mm', fontWeight: 'bold' }}>
                      <span>{lbl.orderInfo.tableOrBalcao || 'DELIVERY'}</span>
                      <span>{lbl.orderInfo.createdAt}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Integrated Codes & Price section */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1mm' }}>
                
                {/* Price block */}
                {showPrice && lbl.price > 0 && (
                  <span style={{ fontSize: `${fontSizePrice}px`, fontWeight: 'black' }}>
                    R$ {lbl.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}

                {/* Barcode svg block */}
                {codeType === 'barcode' && lbl.barcode && (
                  <Code128Barcode 
                    value={lbl.barcode} 
                    width={presetConfig.widthMm * 2.8} 
                    height={Math.min(presetConfig.heightMm * 0.8, 28)} 
                    showText={presetConfig.heightMm > 25}
                  />
                )}

                {/* QR Code svg block */}
                {codeType === 'qrcode' && (lbl.barcode || lbl.qrCodeUrl || lbl.title) && (
                  <div style={{ padding: '0.5mm', background: '#ffffff', border: '0.1px solid ' + fontColor, borderRadius: '0.5mm' }}>
                    <QRCodeSVG 
                      value={lbl.barcode || lbl.qrCodeUrl || lbl.title} 
                      size={Math.min(presetConfig.heightMm * 1.5, 45)}
                    />
                  </div>
                )}

                {customText && customTextPosition === 'bottom' && (
                  <span style={{ fontSize: `${fontSizeMeta - 1}px`, fontWeight: 'bold' }}>
                    {customText}
                  </span>
                )}
              </div>

            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
