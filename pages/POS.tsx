import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  QrCode, 
  X, 
  CheckCircle2, 
  Printer, 
  LogOut,
  Package,
  AlertCircle,
  Truck,
  User,
  MapPin,
  Phone,
  Calculator,
  DollarSign,
  Tag,
  Loader2,
  RefreshCw,
  Hash,
  ShoppingBag,
  Ticket,
  Wifi,
  WifiOff,
  ScanLine,
  Camera,
  Award,
  MessageCircle,
  Zap,
  Globe,
  Percent
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, Order, OrderItem, StoreSettings, Waitstaff, PaymentMethod, Customer, OrderStatus, CartComplementItem, ComplementCategory } from '../types';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { ComplementsModal } from '../components/ComplementsModal';

import InstallPrompt from '../components/InstallPrompt';

interface POSProps {
  storeId: string;
  user: Waitstaff;
  settings: StoreSettings;
  onLogout: () => void;
  updateStatus: (id: string, status: OrderStatus) => void;
  isOffline?: boolean;
  ecosystemUsage?: {
    ordersThisMonth: number;
    productsCount: number;
    usersCount: number;
  };
  refreshEcosystemUsage?: () => void;
}

interface Payment {
  method: PaymentMethod;
  amount: number;
}

export default function POS({ storeId, user, settings, onLogout, updateStatus, isOffline, ecosystemUsage, refreshEcosystemUsage }: POSProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [couriers, setCouriers] = useState<Waitstaff[]>([]);
  const [cart, setCart] = useState<OrderItem[]>(() => {
    const saved = localStorage.getItem(`pos-cart-${storeId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [originalCart, setOriginalCart] = useState<OrderItem[]>(() => {
    const saved = localStorage.getItem(`pos-originalCart-${storeId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Checkout State
  const [orderType, setOrderType] = useState<'BALCAO' | 'ENTREGA' | 'COMANDA' | 'MESA'>(() => {
    const saved = localStorage.getItem(`pos-orderType-${storeId}`);
    return (saved as any) || 'BALCAO';
  });
  const [commandNumber, setCommandNumber] = useState(() => {
    const saved = localStorage.getItem(`pos-commandNumber-${storeId}`);
    return saved || '';
  });
  const [isAutoFinalize, setIsAutoFinalize] = useState(() => {
    const saved = localStorage.getItem('pos-auto-finalize');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('pos-auto-finalize', isAutoFinalize.toString());
  }, [isAutoFinalize]);

  const [deliveryDetails, setDeliveryDetails] = useState(() => {
    const saved = localStorage.getItem(`pos-deliveryDetails-${storeId}`);
    return saved ? JSON.parse(saved) : {
      customerName: '',
      customerPhone: '',
      customerCpf: '',
      address: '',
      referencePoint: '',
      driverId: '',
      payOnDelivery: false,
      useStoreOrigin: true,
      originAddress: ''
    };
  });
  
  // Payment State
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadedPayments, setLoadedPayments] = useState<Payment[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPointProcessing, setIsPointProcessing] = useState(false);
  const [isOnlineProcessing, setIsOnlineProcessing] = useState(false);
  const [onlineCheckoutUrl, setOnlineCheckoutUrl] = useState<string | null>(null);
  const [pointPaymentId, setPointPaymentId] = useState<string | null>(null);
  const [pointStatus, setPointStatus] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [isEmittingNfce, setIsEmittingNfce] = useState(false);
  const [loadedCommandIds, setLoadedCommandIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(`pos-loadedCommandIds-${storeId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [loadedWaitstaffName, setLoadedWaitstaffName] = useState<string | null>(() => {
    const saved = localStorage.getItem(`pos-loadedWaitstaffName-${storeId}`);
    return saved ? saved : null;
  });
  const [loadedServiceFee, setLoadedServiceFee] = useState<number>(() => {
    const saved = localStorage.getItem(`pos-loadedServiceFee-${storeId}`);
    return saved ? parseFloat(saved) : 0;
  });

  useEffect(() => {
    localStorage.setItem(`pos-cart-${storeId}`, JSON.stringify(cart));
    localStorage.setItem(`pos-originalCart-${storeId}`, JSON.stringify(originalCart));
    localStorage.setItem(`pos-orderType-${storeId}`, orderType);
    localStorage.setItem(`pos-commandNumber-${storeId}`, commandNumber);
    localStorage.setItem(`pos-deliveryDetails-${storeId}`, JSON.stringify(deliveryDetails));
    localStorage.setItem(`pos-loadedCommandIds-${storeId}`, JSON.stringify(loadedCommandIds));
    if (loadedWaitstaffName) {
        localStorage.setItem(`pos-loadedWaitstaffName-${storeId}`, loadedWaitstaffName);
    } else {
        localStorage.removeItem(`pos-loadedWaitstaffName-${storeId}`);
    }
    localStorage.setItem(`pos-loadedServiceFee-${storeId}`, loadedServiceFee.toString());
  }, [cart, originalCart, orderType, commandNumber, deliveryDetails, loadedCommandIds, loadedWaitstaffName, loadedServiceFee, storeId]);
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['Todos', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) || 
                            (p.barcode || '').includes(search);
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      return matchesSearch && matchesCategory && p.isActive;
    });
  }, [products, search, selectedCategory]);

  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isLookingUpCommand, setIsLookingUpCommand] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(10); // Reset count when products or search change
  }, [products, search, selectedCategory]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 10);
      }
    }, { threshold: 0.1 });

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredProducts, loadMoreRef.current]);

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCpf, setNewCustomerCpf] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerCashbackBalance, setNewCustomerCashbackBalance] = useState(0);
  const [newCustomerCashbackParticipant, setNewCustomerCashbackParticipant] = useState(true);
  const [deliveryOrdersList, setDeliveryOrdersList] = useState<Order[]>([]);
  const [deliverySearchTerm, setDeliverySearchTerm] = useState('');
  
  const [isContingencyMode, setIsContingencyMode] = useState(() => {
    return localStorage.getItem(`contingency_mode_${storeId}`) === 'true';
  });
  const [contingencyOrders, setContingencyOrders] = useState<Order[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);

  const handleConsultNfcePOS = async (order: Order) => {
    if (!order.nfce_reference || !settings.focusNfeToken) return;

    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      alert("Seu navegador bloqueou o pop-up para o PDF. Emitindo mesmo assim...");
    }
    setIsEmittingNfce(true);
    try {
        const queryParams = new URLSearchParams({
            token: settings.focusNfeToken,
            environment: settings.focusNfeEnvironment || 'homologation',
            reference: order.nfce_reference
        });
        const response = await fetch(`/api/focus-nfe/consult-nfce?${queryParams.toString()}`);
        const result = await response.json();

        if (response.ok) {
            let danfeUrl = result.caminho_danfe;
            if (!danfeUrl && result.caminho_xml_nota_fiscal) {
                 danfeUrl = result.caminho_xml_nota_fiscal.replace('.xml', '.html');
            }
            if (danfeUrl && newWindow) {
               const url = `https://${settings.focusNfeEnvironment === 'production' ? 'api' : 'homologacao'}.focusnfe.com.br${danfeUrl}`;
               try {
                 newWindow.location.href = url;
                 newWindow.focus();
               } catch(e) {
                 console.log("Could not set newWindow location...", e);
                 window.open(url, '_blank')?.focus();
                 newWindow.close();
               }
            } else if (danfeUrl) {
               const url = `https://${settings.focusNfeEnvironment === 'production' ? 'api' : 'homologacao'}.focusnfe.com.br${danfeUrl}`;
               window.open(url, '_blank')?.focus();
            } else if(newWindow) {
               newWindow.close();
            }
            if (!danfeUrl) {
                alert(`NFC-e Status: ${result.status}\nMensagem: ${result.mensagem_sefaz || 'Sem mensagem'}`);
            }
        } else {
            alert(`Erro ao consultar NFC-e: ${result.mensagem || JSON.stringify(result)}`);
        }
    } catch (err) {
      console.error("Erro Consultar NFC-e:", err);
    } finally {
        setIsEmittingNfce(false);
    }
  };

  const handleEmitNfcePOS = async (order: Order) => {
    if (settings?.lockedFeatures?.includes('NFE')) {
      alert("Módulo bloqueado. Fale com seu consultor para desbloquear a emissão de notas fiscais.");
      return;
    }
    if (!settings.focusNfeToken) {
      alert("Token da Focus NFe não configurado nas Integrações.");
      return;
    }
    if (!settings.cnpj) {
      alert("CNPJ da loja não configurado nas Configurações.");
      return;
    }

    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      alert("Seu navegador bloqueou o pop-up para o PDF. Emitindo mesmo assim...");
    }
    setIsEmittingNfce(true);
    const reference = `order_${order.id}_${Date.now()}`;
    try {
      let customerCpf = order.customerCpf || '';
      if (!customerCpf && order.customerId) {
        const { data: customerData } = await supabase.from('customers').select('cpf').eq('id', order.customerId).maybeSingle();
        if (customerData) customerCpf = customerData.cpf || '';
      }

      let items = [];
      if (typeof order.items === 'string') {
        items = JSON.parse(order.items);
      } else if (Array.isArray(order.items)) {
        items = order.items;
      }

      const nfceData: any = {
        cnpj_emitente: settings.cnpj.replace(/\D/g, ''),
        data_emissao: new Date().toISOString(),
        indicador_inscricao_estadual_destinatario: 9,
        modalidade_frete: 9,
        local_destino: 1,
        presenca_comprador: 1,
        items: items.map((item: any, index: number) => {
          const product = products.find(p => p.id === item.productId);
          return {
            numero_item: index + 1,
            codigo_produto: String(item.productId).substring(0, 60),
            descricao: item.name,
            quantidade_comercial: item.quantity,
            quantidade_tributavel: item.quantity,
            unidade_comercial: item.isByWeight ? 'KG' : 'UN',
            unidade_tributavel: item.isByWeight ? 'KG' : 'UN',
            valor_unitario_comercial: item.price,
            valor_unitario_tributavel: item.price,
            valor_bruto: item.price * item.quantity,
            codigo_barras_comercial: product?.barcode || 'SEM GTIN',
            codigo_barras_tributavel: product?.barcode || 'SEM GTIN',
            codigo_ncm: (product?.ncm || '21069090').replace(/\D/g, ''),
            cfop: product?.cfop || (order.type === 'ENTREGA' ? '5102' : '5102'),
            icms_origem: 0,
            icms_situacao_tributaria: product?.icms_situacao_tributaria || '102'
          };
        }),
        formas_pagamento: [
          {
            forma_pagamento: order.paymentMethod === 'DINHEIRO' ? '01' : 
                            order.paymentMethod === 'CARTAO' ? '03' : 
                            order.paymentMethod === 'DEBITO' ? '04' : 
                            order.paymentMethod === 'PIX' ? '17' : '99',
            valor_pagamento: order.total
          }
        ]
      };

      if (customerCpf || order.customerName) {
        nfceData.destinatario = {
          nome: order.customerName || 'Consumidor',
          cpf: customerCpf.replace(/\D/g, '') || undefined,
        };
      }

      const response = await fetch('/api/focus-nfe/emit-nfce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settings.focusNfeToken,
          environment: settings.focusNfeEnvironment,
          nfceData,
          reference: reference
        })
      });

      const result = await response.json();

      let finalResult = result;
      if (response.ok) {
        // Prepare new window text
        if (newWindow) {
            newWindow.document.write('<h2>Aguardando autorização da SEFAZ...</h2><p>Isso geralmente leva alguns segundos.</p>');
        }

        // Loop while status is processando_autorizacao
        let retries = 0;
        while ((finalResult.status === 'processando_autorizacao' || finalResult.status === 'processando') && retries < 10) {
            await new Promise(r => setTimeout(r, 2000));
            const queryParams = new URLSearchParams({
                token: settings.focusNfeToken,
                environment: settings.focusNfeEnvironment || 'homologation',
                reference: reference
            });
            try {
                const checkRes = await fetch(`/api/focus-nfe/consult-nfce?${queryParams.toString()}`);
                if (checkRes.ok) finalResult = await checkRes.json();
            } catch (e) {
                console.error("Polling error", e);
            }
            retries++;
        }

        let danfeUrl = finalResult.caminho_danfe;
        if (!danfeUrl && finalResult.caminho_xml_nota_fiscal) {
             danfeUrl = finalResult.caminho_xml_nota_fiscal.replace('.xml', '.html');
        }
        
        // Update local order to reflect successfully emitted NFC-e
        const isError = finalResult.status === 'erro_autorizacao' || finalResult.status === 'denegado' || finalResult.status === 'rejeitado';
        if (!isError) {
            const nfceStatusStr = finalResult.status === 'autorizado' ? 'AUTHORIZED' : 'PROCESSING';
            await supabase.from('orders').eq('id', order.id).update({
                nfce_reference: reference, // store reference
                nfce_status: nfceStatusStr
            });
            setLastOrder(prev => prev && prev.id === order.id ? { ...prev, nfce_reference: reference, nfce_status: nfceStatusStr } : prev);
        }

        if (danfeUrl && newWindow) {
           const url = `https://${settings.focusNfeEnvironment === 'production' ? 'api' : 'homologacao'}.focusnfe.com.br${danfeUrl}`;
           try {
             newWindow.location.href = url;
             newWindow.focus();
           } catch(e) {
             console.log("Could not set newWindow location...", e);
             window.open(url, '_blank')?.focus();
             newWindow.close();
           }
        } else if (danfeUrl) {
           const url = `https://${settings.focusNfeEnvironment === 'production' ? 'api' : 'homologacao'}.focusnfe.com.br${danfeUrl}`;
           window.open(url, '_blank')?.focus();
        } else {
           if (newWindow) newWindow.close();
           if (finalResult.status === 'processando_autorizacao' || finalResult.status === 'processando') {
             alert('A nota fiscal ainda está sendo processada pela SEFAZ. Você pode usar a opção "Consultar/Imprimir" no Histórico de Pedidos em alguns instantes para imprimi-la.');
           } else if (finalResult.status === 'autorizado') {
              alert('Nota fiscal autorizada, mas sem link de impressão retornado pela API. Consulte o painel da SEFAZ ou Focus.');
           } else if (finalResult.status === 'erro_autorizacao') {
              const erros = finalResult.erros ? finalResult.erros.map((e: any) => `- ${e.codigo || ''}: ${e.mensagem}`).join('\n') : finalResult.mensagem_sefaz;
              alert(`Erro na autorização da SEFAZ:\n${erros || 'Erro desconhecido'}`);
           } else {
              alert(`NFC-e enviada, status: ${finalResult.status || 'desconhecido'}`);
           }
        }
      } else {
        console.error("Erro Focus NFe:", result);
        let errorMessage = result.error || result.mensagem || JSON.stringify(result);
        if (result.erros && Array.isArray(result.erros)) {
            const detalhamento = result.erros.map((e: any) => `- ${e.codigo}: ${e.mensagem}`).join('\n');
            errorMessage = `${result.mensagem || 'Erros de validação:'}\n\n${detalhamento}`;
        }
        alert(`Erro ao emitir NFC-e:\n${errorMessage}`);
      }
    } catch (error) {
      console.error("Erro ao emitir NFC-e:", error);
      alert(`Erro de conexão ao emitir NFC-e: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    } finally {
      setIsEmittingNfce(false);
    }
  };

  const calculateDeliveryFee = async () => {
    if (!settings.address) {
      alert("Endereço da loja não configurado. Não é possível calcular a taxa.");
      return;
    }
    if (!deliveryDetails.address) {
      alert("Preencha o endereço de destino para calcular a taxa.");
      return;
    }

    setIsCalculatingFee(true);
    try {
      // Geocode Store Address
      const storeRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(settings.address)}&countrycodes=br&limit=1`);
      const storeData = await storeRes.json();
      
      // Geocode Customer Address - Add context from store address
      const storeParts = settings.address.split(',');
      const cityContext = storeParts.length > 1 ? storeParts[storeParts.length - 1].trim() : '';
      const customerQuery = cityContext ? `${deliveryDetails.address}, ${cityContext}` : deliveryDetails.address;

      const customerRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(customerQuery)}&countrycodes=br&limit=1`);
      const customerData = await customerRes.json();

      if (storeData.length === 0) {
        alert("Não foi possível localizar o endereço da loja.");
        setIsCalculatingFee(false);
        return;
      }
      if (customerData.length === 0) {
        alert("Não foi possível localizar o endereço de destino. Tente ser mais específico em sua busca.");
        setIsCalculatingFee(false);
        return;
      }

      const storeLat = parseFloat(storeData[0].lat);
      const storeLon = parseFloat(storeData[0].lon);
      const custLat = parseFloat(customerData[0].lat);
      const custLon = parseFloat(customerData[0].lon);

      // Haversine formula
      const R = 6371; // Radius of the earth in km
      const dLat = (custLat - storeLat) * Math.PI / 180;
      const dLon = (custLon - storeLon) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(storeLat * Math.PI / 180) * Math.cos(custLat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      const distance = R * c; // Distance in km

      if (settings.freeDeliveryToleranceKm && distance <= settings.freeDeliveryToleranceKm) {
        setDeliveryFee(0);
        alert(`Distância: ${distance.toFixed(1)}km. Dentro da tolerância de entrega grátis.`);
      } else if (settings.deliveryFeeRules && settings.deliveryFeeRules.length > 0) {
        // Sort rules by upToKm ascending
        const sortedRules = [...settings.deliveryFeeRules].sort((a, b) => a.upToKm - b.upToKm);
        let appliedFee = null;
        for (const rule of sortedRules) {
          if (distance <= rule.upToKm) {
            appliedFee = rule.fee;
            break;
          }
        }
        if (appliedFee !== null) {
          setDeliveryFee(appliedFee);
          alert(`Taxa de entrega: R$ ${appliedFee.toFixed(2)}`);
        } else {
          alert("Endereço fora da área de entrega programada.");
          setDeliveryFee(0);
        }
      } else {
        setDeliveryFee(0);
        alert("Nenhuma regra de taxa de entrega definida.");
      }
    } catch (error) {
      console.error("Error calculating fee:", error);
      alert("Erro ao calcular taxa de entrega. Tente novamente.");
    } finally {
      setIsCalculatingFee(false);
    }
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (showScanner) {
      html5QrCode = new Html5Qrcode("pos-reader");
      
      const startScanner = async () => {
        try {
          await html5QrCode?.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 }
            },
            (decodedText) => {
              setSearch(decodedText);
              // Trigger search
              const exactMatch = products.find(p => p.barcode === decodedText);
              if (exactMatch) {
                handleProductClick(exactMatch);
                setSearch('');
              }
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
  }, [showScanner, products]);

  useEffect(() => {
    localStorage.setItem(`contingency_mode_${storeId}`, isContingencyMode.toString());
  }, [isContingencyMode, storeId]);

  useEffect(() => {
    const saved = localStorage.getItem(`contingency_orders_${storeId}`);
    if (saved) {
      try {
        setContingencyOrders(JSON.parse(saved));
      } catch (e) {
      console.error('Error parsing contingency orders', e);
      }
    }
  }, [storeId]);

  const syncContingencyOrders = async () => {
    if (contingencyOrders.length === 0) return;
    setIsProcessing(true);
    try {
      for (const order of contingencyOrders) {
        const { id, ...orderData } = order as any; // Remove local ID
        const { error } = await supabase.from('orders').insert([orderData]);
        if (error) throw error;

        // Update stock
        const stockUpdates = new Map<string, number>();
        for (const newItem of order.items) {
            const targetProductId = newItem.originalProductId || newItem.productId;
            const current = stockUpdates.get(targetProductId) || 0;
            stockUpdates.set(targetProductId, current - Number(newItem.quantity || 0));
            
            // Deduct complements stock
            if (newItem.complements && newItem.complements.length > 0) {
                for (const cp of newItem.complements) {
                    const cpCurrent = stockUpdates.get(cp.itemId) || 0;
                    stockUpdates.set(cp.itemId, cpCurrent - (Number(cp.quantity || 0) * Number(newItem.quantity || 0)));
                }
            }
        }

        for (const [productId, diff] of stockUpdates.entries()) {
            if (diff !== 0) {
                const product = products.find(p => p.id === productId);
                if (product && product.stock != null) {
                    const newStock = product.stock + diff;
                    const updates: any = { stock: newStock };
                    
                    if (newStock <= 0) {
                        updates.isactive = false;
                    } else {
                        updates.isactive = true;
                    }

                    await supabase
                        .from('products')
                        .eq('id', product.id)
                        .update(updates);
                }
            }
        }
      }
      setContingencyOrders([]);
      localStorage.removeItem(`contingency_orders_${storeId}`);
      fetchProducts(); // Refresh stock
      alert("Pedidos sincronizados com sucesso!");
    } catch (err: any) {
      alert("Erro ao sincronizar pedidos: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const lookupCommand = async (num: string, type: 'MESA' | 'COMANDA' | 'BALCAO' | 'ENTREGA' = 'COMANDA') => {
    if (!num) return;
    if (isContingencyMode) {
        alert("A busca de comandas/mesas não está disponível no Modo Contingência.");
        return;
    }
    const cleanNum = num.trim();
    setIsLookingUpCommand(true);
    try {
        let query = supabase
            .from('orders')
            .select('*')
            .eq('store_id', storeId)
            .eq('type', type)
            .in('status', ['AGUARDANDO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'PREPARANDO', 'PRONTO', 'ENVIADO_PARA_ENTREGA', 'SAIU_PARA_ENTREGA', 'CHEGUEI_NA_ORIGEM'])
            .gte('createdAt', Date.now() - 24 * 60 * 60 * 1000);

        if (type === 'MESA' || type === 'COMANDA') {
            query = query.eq('tableNumber', cleanNum);
        } else {
            query = query.eq('displayId', cleanNum);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
            const unpaidData = data.filter(o => {
                // 1. Never show cancelled orders
                if (o.status === 'CANCELADO') return false;
                
                // 2. If it's finalized in a closed session, hide it
                if (o.session_id === 'FECHADO') return false;

                // 3. Session ownership logic:
                // If it has a session_id, it must be OUR session.
                // If it has NO session_id, it's a new order from an attendant/menu.
                if (o.session_id && o.session_id !== currentSession?.id) return false;

                // 4. If it's already finalized (ENTREGUE), check if it needs payment
                if (o.status === 'ENTREGUE') {
                    let hasRealPayment = false;
                    if (o.paymentMethod && o.paymentMethod !== 'A_PAGAR') hasRealPayment = true;
                    if (o.paymentDetails) {
                        try {
                            const pd = JSON.parse(o.paymentDetails);
                            if (pd.some((p: any) => p.method !== 'A_PAGAR')) hasRealPayment = true;
                        } catch {}
                    }
                    // If it's delivered AND paid, it's definitely not "pendente"
                    if (hasRealPayment) return false;
                }
                
                return true;
            });
            
            if (unpaidData.length === 0) {
                alert(`Todos os pedidos para a ${type === 'MESA' ? 'Mesa' : type === 'COMANDA' ? 'Comanda' : 'Pedido'} ${cleanNum} já foram finalizados.`);
                return;
            }

            const activeOrders = unpaidData;
            
            let targetCart: OrderItem[] = [];
            let targetLoadedIds: string[] = [];
            let shouldMerge = false;

            if (cart.length > 0) {
                shouldMerge = window.confirm(`Já existem itens no carrinho. Deseja SOMAR os pedidos da ${type === 'MESA' ? 'Mesa' : type === 'COMANDA' ? 'Comanda' : 'Pedido'} ${cleanNum} ao pedido atual? \n\nOK = SOMAR\nCancelar = SUBSTITUIR (Limpar atual)`);
                if (shouldMerge) {
                    targetCart = cart.map(item => ({...item}));
                    targetLoadedIds = [...loadedCommandIds];
                }
            }

            const newOrderIds: string[] = [];
            let newOriginalCart = shouldMerge ? [...originalCart] : [];
            
            activeOrders.forEach(order => {
                if (targetLoadedIds.includes(order.id)) return; // Already loaded
                newOrderIds.push(order.id);
                
                let items = [];
                if (typeof order.items === 'string') {
                    try {
                        items = JSON.parse(order.items);
                    } catch (e) {
      console.error("Error parsing items for order", order.id, e);
                    }
                } else if (Array.isArray(order.items)) {
                    items = order.items;
                }
                
                items.forEach((item: any) => {
                    // Stock Check Logic
                    const targetId = item.originalProductId || item.productId;
                    const product = products.find(p => p.id === targetId);
                    const existingItem = targetCart.find(tc => tc.productId === item.productId && tc.isByWeight === item.isByWeight);
                    const currentQty = existingItem ? existingItem.quantity : 0;
                    
                    let qtyToAdd = item.quantity;

                    if (product && product.stock != null) {
                        if ((currentQty + qtyToAdd) > product.stock) {
                            const available = Math.max(0, product.stock - currentQty);
                            if (available < qtyToAdd) {
                                alert(`Atenção: O produto "${item.name}" tem estoque insuficiente para somar (${product.stock}). Adicionando apenas ${available} itens.`);
                                qtyToAdd = available;
                            }
                        }
                    }

                    if (qtyToAdd > 0) {
                        if (existingItem) {
                            existingItem.quantity += qtyToAdd;
                            existingItem.originalQuantity = (existingItem.originalQuantity || 0) + qtyToAdd;
                        } else {
                            targetCart.push({ 
                                ...item, 
                                quantity: qtyToAdd,
                                isPersisted: true, 
                                originalQuantity: qtyToAdd 
                            });
                        }
                        
                        if (order.stockDeducted !== false) {
                            const existingOriginal = newOriginalCart.find(oc => oc.productId === item.productId && oc.isByWeight === item.isByWeight);
                            if (existingOriginal) {
                                existingOriginal.quantity += qtyToAdd;
                                existingOriginal.originalQuantity = (existingOriginal.originalQuantity || 0) + qtyToAdd;
                            } else {
                                newOriginalCart.push({
                                    ...item,
                                    quantity: qtyToAdd,
                                    isPersisted: true,
                                    originalQuantity: qtyToAdd
                                });
                            }
                        }
                    }
                });
            });

            setCart(targetCart);
            setOriginalCart(JSON.parse(JSON.stringify(newOriginalCart)));
            setLoadedCommandIds([...targetLoadedIds, ...newOrderIds]);
            
            let totalServiceFee = shouldMerge ? loadedServiceFee : 0;
            let totalDeliveryFee = shouldMerge ? deliveryFee : 0;
            let mergedPayments = shouldMerge ? [...loadedPayments] : [];

            activeOrders.forEach(order => {
                if (!targetLoadedIds.includes(order.id)) {
                    totalServiceFee += (order.serviceFee || 0);
                    totalDeliveryFee += (order.deliveryFee || 0);
                    
                    if (order.paymentDetails) {
                        try {
                            const parsed = JSON.parse(order.paymentDetails);
                            if (parsed.length === 0 && order.status === 'PAGO') {
                                mergedPayments.push({ method: order.paymentMethod || 'ONLINE', amount: order.total });
                            } else {
                                const parsedWithAmounts = parsed.map((p: any) => ({
                                    ...p,
                                    amount: p.amount ?? order.total
                                }));
                                mergedPayments.push(...parsedWithAmounts);
                            }
                        } catch (e) {
                            if (order.status === 'PAGO') mergedPayments.push({ method: order.paymentMethod || 'ONLINE', amount: order.total });
                        }
                    } else if (order.status === 'PAGO') {
                        mergedPayments.push({ method: order.paymentMethod || 'ONLINE', amount: order.total });
                    }
                }
            });
            
            setLoadedServiceFee(totalServiceFee);
            setDeliveryFee(totalDeliveryFee);
            setLoadedPayments(mergedPayments);

            if (!shouldMerge) {
                setLoadedWaitstaffName(activeOrders[0].waitstaffName || null);
                if (type === 'MESA' || type === 'COMANDA') {
                    setCommandNumber(cleanNum);
                } else {
                    // For BALCAO and ENTREGA, we load the order details
                    const order = activeOrders[0];
                    setDeliveryDetails({
                        customerName: order.customerName || '',
                        customerPhone: order.customerPhone || '',
                        address: order.deliveryAddress || '',
                        referencePoint: order.referencePoint || '',
                        driverId: order.deliveryDriverId || '',
                        payOnDelivery: false,
                        useStoreOrigin: true,
                        originAddress: ''
                    });
                }
                setOrderType(type);
            }
            
            alert(`${type === 'MESA' ? 'Mesa' : type === 'COMANDA' ? 'Comanda' : 'Pedido'} ${cleanNum} carregada com sucesso.`);
            setShowDeliveryModal(false);
        } else {
            alert(`Nenhum pedido em aberto para a ${type === 'MESA' ? 'Mesa' : type === 'COMANDA' ? 'Comanda' : 'Pedido'} ${cleanNum}.`);
        }
    } catch (err) {
      console.error("Erro ao consultar:", err);
        alert("Erro ao consultar.");
    } finally {
        setIsLookingUpCommand(false);
    }
  };

  const [lookupType, setLookupType] = useState<'ENTREGA' | 'BALCAO' | 'MESA' | 'COMANDA'>('ENTREGA');
  const [newOrdersCount, setNewOrdersCount] = useState({
    ENTREGA: 0,
    BALCAO: 0,
    MESA: 0,
    COMANDA: 0
  });

  useEffect(() => {
    if (!storeId || isContingencyMode) return;

    const fetchNewOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('type')
          .eq('store_id', storeId)
          .in('status', ['AGUARDANDO', 'AGUARDANDO_PAGAMENTO', 'PAGO']);
        
        if (error) throw error;
        
        if (data) {
          const counts = { ENTREGA: 0, BALCAO: 0, MESA: 0, COMANDA: 0 };
          data.forEach(order => {
            if (order.type in counts) {
              counts[order.type as keyof typeof counts]++;
            }
          });
          setNewOrdersCount(counts);
        }
      } catch (err) {
      console.error("Erro ao buscar novos pedidos:", err);
      }
    };

    fetchNewOrders();

    const intervalId = setInterval(() => {
      fetchNewOrders();
    }, (settings?.syncIntervals?.pos || 20) * 1000); 

    return () => {
      clearInterval(intervalId);
    };
  }, [storeId, isContingencyMode]);

  const lookupOrdersList = async (type: 'ENTREGA' | 'BALCAO' | 'MESA' | 'COMANDA') => {
    setIsLookingUpCommand(true);
    setLookupType(type);
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('store_id', storeId)
            .eq('type', type)
            .in('status', ['AGUARDANDO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'PREPARANDO', 'PRONTO', 'ENVIADO_PARA_ENTREGA', 'SAIU_PARA_ENTREGA', 'CHEGUEI_NA_ORIGEM'])
            .gte('createdAt', Date.now() - 24 * 60 * 60 * 1000)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            const unpaidData = data.filter(o => {
                // 1. Never show cancelled orders
                if (o.status === 'CANCELADO') return false;
                
                // 2. If it's finalized in a closed session, hide it
                if (o.session_id === 'FECHADO') return false;

                // 3. Session ownership logic:
                // If it has a session_id, it must be OUR session.
                // If it has NO session_id, it's a new order from an attendant/menu.
                if (o.session_id && o.session_id !== currentSession?.id) return false;

                // 4. If it's already finalized (ENTREGUE), check if it needs payment
                if (o.status === 'ENTREGUE') {
                    let hasRealPayment = false;
                    if (o.paymentMethod && o.paymentMethod !== 'A_PAGAR') hasRealPayment = true;
                    if (o.paymentDetails) {
                        try {
                            const pd = JSON.parse(o.paymentDetails);
                            if (pd.some((p: any) => p.method !== 'A_PAGAR')) hasRealPayment = true;
                        } catch {}
                    }
                    // If it's delivered AND paid, it's definitely not "pendente"
                    if (hasRealPayment) return false;
                }
                
                return true;
            });
            
            if (unpaidData.length === 0) {
                alert(`Nenhum pedido de ${type.toLowerCase()} pendente encontrado.`);
                return;
            }

            const parsedData = unpaidData.map(order => {
                let items = order.items;
                if (typeof items === 'string') {
                    try {
                        items = JSON.parse(items);
                    } catch (e) {
      console.error("Error parsing items for order", order.id, e);
                        items = [];
                    }
                }
                return {
                    ...order,
                    items: Array.isArray(items) ? items : []
                };
            });
            setDeliveryOrdersList(parsedData);
            setShowDeliveryModal(true);
        } else {
            alert(`Nenhum pedido de ${type.toLowerCase()} encontrado.`);
        }
    } catch (err) {
      console.error(err);
        alert("Erro ao buscar pedidos.");
    } finally {
        setIsLookingUpCommand(false);
    }
  };

  const loadOrderFromList = (order: Order) => {
      let items = [];
      if (typeof order.items === 'string') {
          try {
              items = JSON.parse(order.items);
          } catch (e) {
      console.error("Error parsing items for order", order.id, e);
          }
      } else if (Array.isArray(order.items)) {
          items = order.items;
      }
      
      const mappedItems = items.map((i: any) => ({ ...i, isPersisted: true, originalQuantity: i.quantity }));
      
      let targetCart = mappedItems;
      let targetLoadedIds = [order.id];
      let shouldMerge = false;
      let newOriginalCart = order.stockDeducted !== false ? mappedItems : [];

      if (cart.length > 0) {
          shouldMerge = window.confirm(`Já existem itens no carrinho. Deseja SOMAR este pedido ao atual? \n\nOK = SOMAR\nCancelar = SUBSTITUIR (Limpar atual)`);
          if (shouldMerge) {
              if (loadedCommandIds.includes(order.id)) {
                  alert("Este pedido já está carregado no carrinho.");
                  return;
              }
              targetLoadedIds = [...loadedCommandIds, order.id];
              
              const mergedCart = [...cart];
              newOriginalCart = [...originalCart];
              
              mappedItems.forEach((item: any) => {
                  const existingItem = mergedCart.find(tc => tc.productId === item.productId && tc.isByWeight === item.isByWeight);
                  if (existingItem) {
                      existingItem.quantity += item.quantity;
                      existingItem.originalQuantity = (existingItem.originalQuantity || 0) + item.quantity;
                  } else {
                      mergedCart.push(item);
                  }
                  
                  if (order.stockDeducted !== false) {
                      const existingOriginal = newOriginalCart.find(oc => oc.productId === item.productId && oc.isByWeight === item.isByWeight);
                      if (existingOriginal) {
                          existingOriginal.quantity += item.quantity;
                          existingOriginal.originalQuantity = (existingOriginal.originalQuantity || 0) + item.quantity;
                      } else {
                          newOriginalCart.push({...item});
                      }
                  }
              });
              targetCart = mergedCart;
          }
      }

      setCart(targetCart);
      setOriginalCart(JSON.parse(JSON.stringify(newOriginalCart)));
      setLoadedCommandIds(targetLoadedIds);
      
      if (shouldMerge) {
          setLoadedServiceFee(loadedServiceFee + (order.serviceFee || 0));
          setDeliveryFee(deliveryFee + (order.deliveryFee || 0));
          
          if (order.paymentDetails) {
              try {
                  const parsed = JSON.parse(order.paymentDetails);
                  setLoadedPayments(prev => [...prev, ...parsed]);
              } catch (e) {}
          }
      } else {
          setLoadedWaitstaffName(order.waitstaffName || null);
          setLoadedServiceFee(order.serviceFee || 0);
          setDeliveryFee(order.deliveryFee || 0);
          
          if (order.paymentDetails) {
              try {
                  const parsed = JSON.parse(order.paymentDetails);
                  if (parsed.length === 0 && order.status === 'PAGO') {
                      setLoadedPayments([{ method: order.paymentMethod || 'ONLINE', amount: order.total }]);
                  } else {
                      setLoadedPayments(parsed);
                  }
              } catch (e) {
                  setLoadedPayments(order.status === 'PAGO' ? [{ method: order.paymentMethod || 'ONLINE', amount: order.total }] : []);
              }
          } else {
              setLoadedPayments(order.status === 'PAGO' ? [{ method: order.paymentMethod || 'ONLINE', amount: order.total }] : []);
          }
          
          setOrderType(order.type as any);
          if (order.type === 'MESA' || order.type === 'COMANDA') {
              setCommandNumber(order.tableNumber || '');
          } else {
              setCommandNumber('');
          }

          // Load customer if exists
          if (order.customerId) {
              supabase.from('customers').eq('id', order.customerId).maybeSingle().then(({ data }) => {
                  if (data) {
                      setSelectedCustomer(data);
                  }
              });
          }

          setDeliveryDetails({
              customerName: order.customerName || '',
              customerPhone: order.customerPhone || '',
              address: order.deliveryAddress || '',
              referencePoint: order.referencePoint || '',
              driverId: order.deliveryDriverId || '',
              payOnDelivery: false
          });
      }
      setShowDeliveryModal(false);
  };

  // Weight Modal
  const [weightModal, setWeightModal] = useState<{ isOpen: boolean, product: Product | null }>({ isOpen: false, product: null });
  const [weightInput, setWeightInput] = useState('');

  // Fractional Modal
  const [fractionalModal, setFractionalModal] = useState<{ isOpen: boolean, product: Product | null }>({ isOpen: false, product: null });
  const [selectedFractions, setSelectedFractions] = useState<(Product | null)[]>([]);

  // Complements Modal
  const [complementsProduct, setComplementsProduct] = useState<Product | null>(null);
  const [selectedComplements, setSelectedComplements] = useState<CartComplementItem[]>([]);
  const [complementsQuantity, setComplementsQuantity] = useState<number>(1);

  // Scale Integration
  const [scaleWeight, setScaleWeight] = useState<number | null>(null);
  const [isScaleConnected, setIsScaleConnected] = useState(false);
  const [scaleError, setScaleError] = useState('');

  const connectScale = async () => {
    if (!('serial' in navigator)) {
      setScaleError('Web Serial API não suportada neste navegador.');
      return;
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      setIsScaleConnected(true);
      setScaleError('');
      
      const reader = port.readable.getReader();
      let buffer = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;
        
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          // Extrai números da string (ex: "001500" -> 1500g ou "1.500" -> 1.5kg)
          const match = line.match(/(\d+\.?\d*)/);
          if (match) {
             let weight = parseFloat(match[1]);
             // Se o peso vier sem ponto decimal e for grande (ex: 1500 para 1.5kg), assumimos que é gramas
             if (weight > 100 && !line.includes('.')) {
                 weight = weight / 1000; // Converte para KG
             }
             if (!isNaN(weight) && weight > 0) {
                setScaleWeight(weight); // Peso em KG
                // Se o modal estiver aberto, atualiza o input automaticamente com o peso em gramas
                setWeightInput((weight * 1000).toFixed(0));
             }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setScaleError('Erro ao conectar balança: ' + err.message);
      setIsScaleConnected(false);
    }
  };

  // Register Closing
  const [isClosingRegister, setIsClosingRegister] = useState(false);
  const [dailySales, setDailySales] = useState<{ total: number, byMethod: Record<string, number>, count: number, bleeds: number, products: any[] } | null>(null);
  
  // Session State
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [isOpeningRegister, setIsOpeningRegister] = useState(false);
  const [initialAmount, setInitialAmount] = useState('');
  
  // Cash Bleed (Sangria)
  const [isBleedModalOpen, setIsBleedModalOpen] = useState(false);
  const [bleedAmount, setBleedAmount] = useState('');
  const [bleedReason, setBleedReason] = useState('');

  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  useEffect(() => {
    fetchProducts();
    fetchCouriers();
    fetchSession();
    fetchCustomers();
  }, [storeId, isContingencyMode]);

  const fetchCustomers = async () => {
    if (!storeId || isContingencyMode) return;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId);
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error("Erro ao buscar clientes:", err);
    }
  };

  const fetchSession = async () => {
    if (isContingencyMode) {
      setCurrentSession({ id: 'contingency_session', initial_amount: 0 });
      setIsOpeningRegister(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('register_sessions')
        .select('*')
        .eq('store_id', storeId)
        .eq('waitstaff_id', user.id)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setCurrentSession(data[0]);
      } else {
        setCurrentSession(null);
        setIsOpeningRegister(true);
      }
    } catch (e) {
      console.error("Error fetching session:", e);
      setCurrentSession(null);
      setIsOpeningRegister(true);
    }
  };

  const handleOpenRegister = async () => {
    if (isContingencyMode) {
        alert("Desative o Modo Contingência para abrir o caixa.");
        return;
    }
    try {
      const amount = parseFloat(initialAmount) || 0;
      const session: any = {
        id: crypto.randomUUID(),
        store_id: storeId,
        waitstaff_id: user.id,
        waitstaff_name: user.name,
        opened_at: Date.now(),
        initial_amount: amount,
        status: 'OPEN'
      };

      const { data, error } = await supabase.from('register_sessions').insert([session]);
      if (error) throw error;
      if (data && data.length > 0) {
        setCurrentSession(data[0]);
        setIsOpeningRegister(false);
        
        if (amount > 0) {
          await supabase.from('cash_movements').insert([{
            id: crypto.randomUUID(),
            store_id: storeId,
            type: 'ABERTURA_CAIXA',
            amount: amount,
            description: 'Troco inicial',
            waitstaffName: user.name,
            createdAt: Date.now(),
            session_id: data[0].id
          }]);
        }
      }
    } catch (err: any) {
      alert("Erro ao abrir o caixa: " + err.message);
    }
  };

  const fetchProducts = async () => {
    setIsProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('isActive', true);
      if (error) throw error;
      if (data) {
        setProducts(data);
        localStorage.setItem(`cached_products_${storeId}`, JSON.stringify(data));
      }
    } catch (e) {
      console.error("Error fetching products:", e);
      const cached = localStorage.getItem(`cached_products_${storeId}`);
      if (cached) {
        try { setProducts(JSON.parse(cached)); } catch (err) {}
      }
    } finally {
      setIsProductsLoading(false);
    }
  };

  const fetchCouriers = async () => {
    try {
      const { data, error } = await supabase
        .from('waitstaff')
        .select('*')
        .eq('store_id', storeId)
        .eq('role', 'ENTREGADOR');
      if (error) throw error;
      if (data) {
        setCouriers(data);
        localStorage.setItem(`cached_couriers_${storeId}`, JSON.stringify(data));
      }
    } catch (e) {
      console.error("Error fetching couriers:", e);
      const cached = localStorage.getItem(`cached_couriers_${storeId}`);
      if (cached) {
        try { setCouriers(JSON.parse(cached)); } catch (err) {}
      }
    }
  };

  const getPromotionalPrice = (product: Product, customBasePrice?: number) => {
    const base = customBasePrice !== undefined ? customBasePrice : product.price;
    if (!settings.isCouponActive || !settings.couponDiscount || settings.couponDiscount <= 0 || base <= 0) return null;
    const isApplicable = settings.isCouponForAllProducts || settings.applicableProductIds?.includes(product.id);
    if (!isApplicable) return null;
    const discount = base * (settings.couponDiscount / 100);
    return base - discount;
  };

  const getPromotionalDiscountPercentage = (product: Product) => {
    if (!settings.isCouponActive) return null;
    const isApplicable = settings.isCouponForAllProducts || settings.applicableProductIds?.includes(product.id);
    if (!isApplicable || !settings.couponDiscount || settings.couponDiscount <= 0) return null;
    return settings.couponDiscount;
  };

  const handleProductClick = (product: Product) => {
    if (product.stock != null && product.stock <= 0) {
      alert("Produto sem estoque!");
      return;
    }

    if (product.complements && product.complements.length > 0 && !product.isByWeight) {
      setComplementsProduct(product);
      setSelectedComplements([]);
      setComplementsQuantity(1);
      return;
    }

    if (product.isByWeight) {
      setWeightModal({ isOpen: true, product });
      setWeightInput('');
    } else {
      addToCart(product, 1);
    }
  };

  const addToCart = (product: Product, quantity: number, complementsToAdd?: CartComplementItem[]) => {
    setCart(prev => {
      let cartItemId = product.id;
      let itemName = product.name;
      let rawPrice = product.price;

      if (complementsToAdd && complementsToAdd.length > 0) {
        // Create unique ID by appending sorted complement item IDs
        const sortedComplements = [...complementsToAdd].sort((a, b) => a.itemId.localeCompare(b.itemId));
        const hash = sortedComplements.map(c => `${c.itemId}x${c.quantity}`).join('_');
        cartItemId = `${product.id}_c_${hash}`;
        
        // Add complement prices to base item price
        const complementsTotal = complementsToAdd.reduce((sum, c) => sum + (c.price * c.quantity), 0);
        rawPrice += complementsTotal;
      }

      const promoPrice = getPromotionalPrice(product, rawPrice);
      let itemPrice = promoPrice !== null ? promoPrice : rawPrice;

      const existing = prev.find(item => item.productId === cartItemId);
      const currentQty = existing ? existing.quantity : 0;
      
      if (product.stock != null && (currentQty + quantity) > product.stock) {
        alert(`Estoque insuficiente! Disponível: ${product.stock} ${product.isByWeight ? 'KG' : 'un'}`);
        return prev;
      }

      if (existing) {
        return prev.map(item => 
          item.productId === cartItemId 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      
      return [...prev, {
        productId: cartItemId,
        name: itemName,
        price: itemPrice,
        quantity: quantity,
        description: product.description,
        isByWeight: product.isByWeight,
        isFractional: false,
        originalProductId: product.id,
        complements: complementsToAdd
      }];
    });
    setWeightModal({ isOpen: false, product: null });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const canCancel = user.role === 'GERENTE' || settings.canWaitstaffCancelItems;

    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        let newQty = item.quantity + delta;
        newQty = Math.round(newQty * 1000) / 1000;
        newQty = Math.max(0, newQty);
        
        if (delta < 0 && item.isPersisted && !canCancel) {
            if (newQty < (item.originalQuantity || 0)) {
                alert('Você não tem permissão para cancelar itens já lançados.');
                return item;
            }
        }

        if (delta > 0) {
            const targetId = item.originalProductId || item.productId;
            const product = products.find(p => p.id === targetId);
            if (product && product.stock != null && newQty > product.stock) {
                alert(`Estoque insuficiente! Disponível: ${product.stock} ${product.isByWeight ? 'KG' : 'un'}`);
                return item;
            }
        }
        
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const subtotal = cart.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 0)), 0);
  const commissionRate = (user && (user.role === 'ATENDENTE' || user.role === 'GERENTE') && settings.waitstaffCommissions?.[user.id]) || 0;
  
  const newItemsSubtotal = cart.reduce((acc, item) => {
      const addedQty = Math.max(0, (item.quantity || 0) - (item.originalQuantity || 0));
      return acc + ((item.price || 0) * addedQty);
  }, 0);
  
  const currentLoadedSubtotal = cart.reduce((acc, item) => {
      const loadedQty = Math.min(item.quantity || 0, item.originalQuantity || 0);
      return acc + ((item.price || 0) * loadedQty);
  }, 0);
  
  const originalLoadedSubtotal = originalCart.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 0)), 0);
  
  const adjustedLoadedServiceFee = originalLoadedSubtotal > 0 
      ? loadedServiceFee * (currentLoadedSubtotal / originalLoadedSubtotal)
      : loadedServiceFee;

  const serviceFee = (orderType === 'MESA' || orderType === 'COMANDA') 
      ? adjustedLoadedServiceFee + (newItemsSubtotal * (commissionRate / 100))
      : 0;

  const total = subtotal + serviceFee + (orderType === 'ENTREGA' ? (deliveryFee || 0) : 0);
  const totalPaid = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = Math.max(0, totalPaid - total);

  useEffect(() => {
    if (isCheckoutOpen) {
      setCurrentPaymentAmount(remaining.toFixed(2));
    }
  }, [total, isCheckoutOpen, remaining]);

  const handleAddPayment = () => {
    const amount = parseFloat(currentPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setPayments(prev => [...prev, { method: currentPaymentMethod, amount }]);
    setCurrentPaymentAmount('');
  };

  const handleUseCashback = () => {
    if (!selectedCustomer || !selectedCustomer.points) return;
    if (selectedCustomer.points < (settings.minCashbackToUse || 0)) {
        alert(`O valor mínimo para usar cashback é de ${formatCurrency(settings.minCashbackToUse || 0)}.`);
        return;
    }
    
    const availableCashback = selectedCustomer.points;
    const amountToUse = Math.min(availableCashback, remaining);
    
    if (amountToUse <= 0) return;

    // Check if already used cashback
    const alreadyUsed = payments.find(p => p.method === 'CASHBACK');
    if (alreadyUsed) {
        alert("Cashback já aplicado nesta venda.");
        return;
    }

    setPayments(prev => [...prev, { method: 'CASHBACK', amount: amountToUse }]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handleOnlinePayment = async () => {
    const amount = parseFloat(currentPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (!settings.onlinePaymentAccessToken) {
        alert("Token de pagamento online não configurado.");
        return;
    }

    setIsOnlineProcessing(true);
    
    try {
        // Customer name is optional for PDV PIX to speed up
        const finalCustomerName = selectedCustomer?.name || deliveryDetails.customerName || 'Cliente PDV';
        const finalCustomerPhone = selectedCustomer?.phone || deliveryDetails.customerPhone || '';

        // Generate a real order ID if possible, or use a temp one
        const tempId = `pos_${Date.now()}`;

        const mockOrder = {
          id: tempId,
          displayId: 'PDV',
          total: amount,
          items: cart.length > 0 ? cart : [{ name: 'Venda Diversa', quantity: 1, price: amount }],
          customerName: finalCustomerName,
          customerPhone: finalCustomerPhone
        };

        const redirectStoreUrl = `${window.location.origin}/pagamento-ok`;

        const endpoint = settings.onlinePaymentProvider === 'mercado_pago' ? '/api/mercado-pago/create-preference' : '/api/v1/process-payment';
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: settings.onlinePaymentAccessToken,
                accessToken: settings.onlinePaymentAccessToken,
                environment: settings.pagbankEnvironment || 'sandbox',
                orderData: mockOrder,
                status: 'pending',
                storeUrl: redirectStoreUrl,
                storeSlug: settings.slug,
                storeId: storeId
            })
        });

        const responseText = await response.text();
        
        if (!response.ok) {
            console.error(`API Error ${response.status}:`, responseText);
            const is404 = response.status === 404;
            const helpMsg = is404 
              ? ' (Erro 404: O servidor backend não foi encontrado ou o Proxy bloqueou a rota /api).' 
              : '';
            throw new Error(`Erro na API (${response.status})${helpMsg}. Detalhes: ${responseText.substring(0, 50)}`);
        }

        let data: any = {};
        try {
          data = JSON.parse(responseText);
        } catch (e: any) {
      console.error('Failed to parse API response:', responseText);
          throw new Error(`Resposta inválida do servidor. Verifique se o app está rodando como "estático" em vez de "full-stack".`);
        }

        if (data.checkout_url || data.init_point) {
            const link = data.init_point || data.checkout_url;
            setOnlineCheckoutUrl(link);
            window.open(link, '_blank');
            alert("Link de pagamento gerado e aberto em nova aba. Após a confirmação do cliente, adicione o pagamento.");
        } else {
            console.error('Checkout failed. Data:', data);
            const errorMessage = data.error || (data.message) || (data.error_messages ? data.error_messages.map((m: any) => m.description).join(', ') : null);
            throw new Error(errorMessage || `Erro ao gerar checkout (Status: ${response.status}). Resposta: ${responseText.substring(0, 100)}`);
        }
    } catch (err: any) {
        alert(err.message);
    } finally {
        setIsOnlineProcessing(false);
    }
  };

  const handlePointPayment = async () => {
    const amount = parseFloat(currentPaymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    if (!settings.onlinePaymentAccessToken || !settings.mercadoPagoPointDeviceId) {
        alert("Configuração do Mercado Pago Point incompleta.");
        return;
    }

    setIsPointProcessing(true);
    setPointStatus('Enviando para maquininha...');
    
    try {
        const response = await fetch('/api/mercado-pago/point/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken: settings.onlinePaymentAccessToken,
                deviceId: settings.mercadoPagoPointDeviceId,
                amount: amount,
                description: `Venda PDV - ${settings.storeName}`,
                externalReference: `pos_${Date.now()}`
            })
        });

        const data = await response.json();
        if (data.id) {
            setPointPaymentId(data.id);
            setPointStatus('Aguardando pagamento na maquininha...');
        } else {
            throw new Error(data.error || 'Erro ao iniciar pagamento.');
        }
    } catch (err: any) {
        alert(err.message);
        setIsPointProcessing(false);
        setPointStatus(null);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isPointProcessing && pointPaymentId) {
        interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/mercado-pago/point/payment-intent/${pointPaymentId}?accessToken=${settings.onlinePaymentAccessToken}`);
                const data = await response.json();
                
                if (data.state === 'FINISHED') {
                    clearInterval(interval);
                    const amount = parseFloat(currentPaymentAmount);
                    setPayments(prev => [...prev, { method: 'MAQUININHA', amount }]);
                    setIsPointProcessing(false);
                    setPointPaymentId(null);
                    setPointStatus(null);
                    setCurrentPaymentAmount('');
                    alert("Pagamento aprovado na maquininha!");
                } else if (data.state === 'CANCELED' || data.state === 'ERROR') {
                    clearInterval(interval);
                    alert("Pagamento cancelado ou erro na maquininha.");
                    setIsPointProcessing(false);
                    setPointPaymentId(null);
                    setPointStatus(null);
                }
            } catch (err) {
      console.error("Erro ao consultar status do Point:", err);
            }
        }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPointProcessing, pointPaymentId, currentPaymentAmount, settings.onlinePaymentAccessToken]);

    const handleSaveToCommand = async () => {
    if (cart.length === 0) return;
    
    if (loadedCommandIds.length === 0 && ecosystemUsage && settings.maxOrdersPerMonth && ecosystemUsage.ordersThisMonth >= settings.maxOrdersPerMonth) {
        alert("Seu limite máximo de pedidos para este mês foi atingido. Entre em contato com seu consultor para fazer um upgrade do seu plano.");
        return;
    }
    
    let num = commandNumber;
    let currentType = orderType;
    
    if (currentType === 'BALCAO') {
        num = prompt("Digite o número da comanda para lançar os itens:") || '';
        if (!num) return;
        setCommandNumber(num);
        currentType = 'COMANDA';
        setOrderType('COMANDA');
    } else if (currentType === 'MESA' || currentType === 'COMANDA') {
        if (!num) {
            num = prompt("Digite o número da comanda/mesa para lançar os itens:") || '';
            if (!num) return;
            setCommandNumber(num);
        }
    }
    
    setIsProcessing(true);
    try {
        const order: Partial<Order> = {
            store_id: storeId,
            type: currentType,
            tableNumber: (currentType === 'MESA' || currentType === 'COMANDA') ? num : undefined,
            items: cart,
            status: (currentType === 'ENTREGA' && settings.autoApproveDeliveries) ? 'ENVIADO_PARA_ENTREGA' : 'PREPARANDO',
            total: total,
            serviceFee: serviceFee,
            waitstaffName: loadedWaitstaffName || user.name,
            isSynced: false,
            stockDeducted: true,
            paymentDetails: loadedPayments.length > 0 ? JSON.stringify(loadedPayments) : undefined,
            paymentMethod: loadedPayments.length > 1 ? 'MISTO' : (loadedPayments.length === 1 ? loadedPayments[0].method : undefined),
            customerName: currentType === 'ENTREGA' ? deliveryDetails.customerName : undefined,
            customerPhone: currentType === 'ENTREGA' ? deliveryDetails.customerPhone : undefined,
            deliveryAddress: currentType === 'ENTREGA' ? deliveryDetails.address : undefined,
            originAddress: currentType === 'ENTREGA' ? (deliveryDetails.useStoreOrigin ? settings.address : deliveryDetails.originAddress) : undefined,
            referencePoint: currentType === 'ENTREGA' ? deliveryDetails.referencePoint : undefined,
            deliveryDriverId: currentType === 'ENTREGA' && deliveryDetails.driverId ? deliveryDetails.driverId : undefined,
            customerId: selectedCustomer?.id,
            deliveryFee: currentType === 'ENTREGA' ? deliveryFee : undefined
        };

        if (loadedCommandIds.length > 0) {
            const firstId = loadedCommandIds[0];
            const { error } = await supabase.from('orders').eq('id', firstId).update(order);
            if (error) throw error;
            
            if (loadedCommandIds.length > 1) {
                for (let i = 1; i < loadedCommandIds.length; i++) {
                    await supabase.from('orders').eq('id', loadedCommandIds[i]).delete();
                }
            }
        } else {
            order.createdAt = Date.now();
            order.displayId = Math.floor(1000 + Math.random() * 9000).toString();
            const { error } = await supabase.from('orders').insert([order]);
            if (error) throw error;
        }
        
        // Update stock based on the difference between cart and originalCart
        const stockUpdates = new Map<string, number>();
        for (const oldItem of originalCart) {
            const targetProductId = oldItem.originalProductId || oldItem.productId;
            const current = stockUpdates.get(targetProductId) || 0;
            stockUpdates.set(targetProductId, current + Number(oldItem.originalQuantity || oldItem.quantity || 0));
            
            // Restore complements stock
            if (oldItem.complements && oldItem.complements.length > 0) {
                for (const cp of oldItem.complements) {
                    const cpCurrent = stockUpdates.get(cp.itemId) || 0;
                    stockUpdates.set(cp.itemId, cpCurrent + (Number(cp.quantity || 0) * Number(oldItem.originalQuantity || oldItem.quantity || 0)));
                }
            }
        }
        for (const newItem of cart) {
            const targetProductId = newItem.originalProductId || newItem.productId;
            const current = stockUpdates.get(targetProductId) || 0;
            stockUpdates.set(targetProductId, current - Number(newItem.quantity || 0));

            // Deduct complements stock
            if (newItem.complements && newItem.complements.length > 0) {
                for (const cp of newItem.complements) {
                    const cpCurrent = stockUpdates.get(cp.itemId) || 0;
                    stockUpdates.set(cp.itemId, cpCurrent - (Number(cp.quantity || 0) * Number(newItem.quantity || 0)));
                }
            }
        }

        for (const [productId, diff] of stockUpdates.entries()) {
            if (diff !== 0) {
                const product = products.find(p => p.id === productId);
                if (product && product.stock != null) {
                    const newStock = product.stock + diff;
                    const updates: any = { stock: newStock };
                    if (newStock <= 0) updates.isactive = false;
                    else updates.isactive = true;
                    await supabase.from('products').eq('id', product.id).update(updates);
                }
            }
        }
        
        setCart([]);
        setOriginalCart([]);
        setLoadedCommandIds([]);
        setLoadedPayments([]);
        setLoadedWaitstaffName(null);
        setLoadedServiceFee(0);
        setCommandNumber('');
        setOrderType('BALCAO'); // Reset to default after saving
        alert("Itens lançados na comanda com sucesso!");
    } catch (err: any) {
        alert("Erro ao salvar comanda: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid shortcuts if an input is focused (unless it's ESC to blur/clear)
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      
      if (e.key === 'Escape') {
        if (isCheckoutOpen) setIsCheckoutOpen(false);
        if (showDeliveryModal) setShowDeliveryModal(false);
        if (weightModal.isOpen) setWeightModal({ isOpen: false, product: null });
        if (complementsProduct) setComplementsProduct(null);
        setSearch('');
        return;
      }

      if (isInput && !e.key.startsWith('F')) return;

      switch (e.key) {
        case 'F2':
          e.preventDefault();
          const searchInput = document.getElementById('pdv-search-input') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
          break;
        case 'F4':
          e.preventDefault();
          if (cart.length > 0) setIsCheckoutOpen(true);
          break;
        case 'F6':
          e.preventDefault();
          lookupOrdersList('COMANDA');
          break;
        case 'F7':
          e.preventDefault();
          lookupOrdersList('MESA');
          break;
        case 'F8':
          e.preventDefault();
          lookupOrdersList('ENTREGA');
          break;
        case 'F9':
          e.preventDefault();
          lookupOrdersList('BALCAO');
          break;
        case 'F10':
          e.preventDefault();
          if (cart.length > 0) handleSaveToCommand();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckoutOpen, showDeliveryModal, weightModal.isOpen, complementsProduct, lookupOrdersList, handleSaveToCommand, setSearch, setIsCheckoutOpen, setShowDeliveryModal, setWeightModal, setComplementsProduct]);

  const ProductSkeleton = () => (
    <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full animate-pulse">
      <div className="aspect-square rounded-lg bg-gray-200 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
      <div className="mt-auto flex justify-between items-end">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="w-8 h-8 rounded-full bg-gray-200" />
      </div>
    </div>
  );

  const handleCancelOrder = async () => {
    if (loadedCommandIds.length === 0) return;
    
    const canCancel = user.role === 'GERENTE' || settings.canWaitstaffCancelItems;
    if (!canCancel) {
        alert('Você não tem permissão para cancelar pedidos.');
        return;
    }

    if (!window.confirm(`Tem certeza que deseja cancelar este pedido?`)) {
        return;
    }

    setIsProcessing(true);
    try {
        // Cancel the loaded orders
        const uniqueIds: string[] = Array.from(new Set(loadedCommandIds));
        for (const id of uniqueIds) {
            await updateStatus(id, 'CANCELADO');
        }

        await fetchProducts();

        setCart([]);
        setOriginalCart([]);
        setLoadedCommandIds([]);
        setLoadedPayments([]);
        setCommandNumber('');
        setOrderType('BALCAO');
        setDeliveryDetails({
            customerName: '',
            customerPhone: '',
            address: '',
            referencePoint: '',
            driverId: '',
            payOnDelivery: false,
            useStoreOrigin: true,
            originAddress: ''
        });
        setDeliveryFee(0);
        alert("Pedido cancelado com sucesso!");
    } catch (err: any) {
        alert("Erro ao cancelar pedido: " + err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleSaveNewCustomer = async () => {
    if (!newCustomerName || !newCustomerPhone) return;
    
    let formattedPhone = newCustomerPhone.replace(/\D/g, '');
    if (formattedPhone.length > 0 && !formattedPhone.startsWith('55')) {
        formattedPhone = `55${formattedPhone}`;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ 
          name: newCustomerName, 
          phone: formattedPhone, 
          cpf: newCustomerCpf,
          address: newCustomerAddress,
          points: newCustomerCashbackBalance,
          isLoyaltyParticipant: newCustomerCashbackParticipant,
          store_id: storeId 
        }]);
      if (error) throw error;
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerCpf('');
      setNewCustomerAddress('');
      setNewCustomerCashbackBalance(0);
      setNewCustomerCashbackParticipant(true);
      setShowNewCustomerModal(false);
      fetchCustomers();
    } catch (err: any) {
      console.error("Erro ao cadastrar cliente:", err);
      alert("Erro ao cadastrar cliente: " + (err.message || "Erro desconhecido"));
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (loadedCommandIds.length === 0 && ecosystemUsage && settings.maxOrdersPerMonth && ecosystemUsage.ordersThisMonth >= settings.maxOrdersPerMonth) {
        alert("Seu limite máximo de pedidos para este mês foi atingido. Entre em contato com seu consultor para fazer um upgrade do seu plano.");
        return;
    }
    
    const isPayOnDelivery = orderType === 'ENTREGA' && deliveryDetails.payOnDelivery;
    
    if (remaining > 0.01 && !isPayOnDelivery) {
      alert(`Falta pagar ${formatCurrency(remaining)}`);
      return;
    }

    if (!isPayOnDelivery && payments.some(p => p.method === 'A_PAGAR')) {
      alert("Para concluir a venda, remova o item 'A PAGAR' e lance a forma de pagamento real (Pix, Dinheiro, Cartão, etc).");
      return;
    }
    
    setIsProcessing(true);

    try {
      const finalPayments = [...payments];
      if (isPayOnDelivery) {
        const paidAmount = payments.reduce((acc, p) => acc + p.amount, 0);
        const aPagarAmount = total - paidAmount;
        if (aPagarAmount > 0) {
          finalPayments.push({ method: 'A_PAGAR', amount: aPagarAmount });
        }
      }

      const order: Partial<Order> = {
        store_id: storeId,
        type: orderType,
        tableNumber: (orderType === 'COMANDA' || orderType === 'MESA') ? commandNumber : undefined,
        items: cart,
        status: isAutoFinalize 
          ? (orderType === 'ENTREGA' ? 'ENVIADO_PARA_ENTREGA' : 'ENTREGUE') 
          : (orderType === 'ENTREGA' && settings.autoApproveDeliveries) ? 'ENVIADO_PARA_ENTREGA' : 'PREPARANDO',
        total: total,
        serviceFee: serviceFee,
        paymentMethod: finalPayments.length === 1 ? finalPayments[0].method : 'MISTO' as any,
        paymentDetails: JSON.stringify(finalPayments),
        waitstaffName: loadedWaitstaffName || user.name,
        changeFor: change > 0 ? total + change : undefined,
        isSynced: false,
        customerName: (orderType === 'ENTREGA' || orderType === 'BALCAO') ? deliveryDetails.customerName : undefined,
        customerPhone: (orderType === 'ENTREGA' || orderType === 'BALCAO') ? deliveryDetails.customerPhone : undefined,
        deliveryAddress: orderType === 'ENTREGA' ? deliveryDetails.address : undefined,
        originAddress: orderType === 'ENTREGA' ? (deliveryDetails.useStoreOrigin ? settings.address : deliveryDetails.originAddress) : undefined,
        referencePoint: orderType === 'ENTREGA' ? deliveryDetails.referencePoint : undefined,
        deliveryDriverId: orderType === 'ENTREGA' && deliveryDetails.driverId ? deliveryDetails.driverId : undefined,
        session_id: currentSession?.id,
        customerId: selectedCustomer?.id,
        customerCpf: (orderType === 'ENTREGA' || orderType === 'BALCAO') ? deliveryDetails.customerCpf : (selectedCustomer?.cpf || undefined),
        deliveryFee: orderType === 'ENTREGA' ? deliveryFee : undefined,
        stockDeducted: true
      };

      if (isContingencyMode) {
        const newOrderObj = { ...order, id: `local_${Date.now()}`, createdAt: Date.now(), displayId: Math.floor(1000 + Math.random() * 9000).toString() } as Order;
        const newContingencyList = [...contingencyOrders, newOrderObj];
        setContingencyOrders(newContingencyList);
        localStorage.setItem(`contingency_orders_${storeId}`, JSON.stringify(newContingencyList));
        
        setLastOrder(newOrderObj);
        if (confirm("Venda realizada em MODO CONTINGÊNCIA! Deseja imprimir o cupom?")) {
            printReceipt(newOrderObj);
        }
        
        setCart([]);
        setOriginalCart([]);
        setPayments([]);
        setLoadedCommandIds([]);
        setLoadedPayments([]);
        setLoadedWaitstaffName(null);
        setLoadedServiceFee(0);
        setCommandNumber('');
        setDeliveryDetails({ customerName: '', customerPhone: '', address: '', driverId: '', payOnDelivery: false, useStoreOrigin: true, originAddress: '', referencePoint: '' });
        setDeliveryFee(0);
        setSelectedCustomer(null);
        setCustomerSearchTerm('');
        setIsCheckoutOpen(false);
        setIsProcessing(false);
        return;
      }

      let finalOrderData;
      let originalOrderHadCustomer = false;
      
      if (loadedCommandIds.length > 0) {
          const firstId = loadedCommandIds[0];
          
          // Check if original order already had a customer to prevent double cashback
          // Only mark as true if the order already received cashback.
          // DigitalMenu applies cashback at creation for ENTREGA and BALCAO.
          const { data: origOrder } = await supabase.from('orders').eq('id', firstId).maybeSingle();
          if (origOrder && origOrder.customerId) {
              if (origOrder.type !== 'MESA' && origOrder.type !== 'COMANDA') {
                  originalOrderHadCustomer = true;
              } else if (origOrder.status === 'ENTREGUE' || origOrder.status === 'CLOSED') {
                  originalOrderHadCustomer = true;
              }
          }
          
          // Prevent resetting status backwards if the order was already PRONTO or further
          if (origOrder) {
              const advancedStatuses = ['PRONTO', 'ENVIADO_PARA_ENTREGA', 'SAIU_PARA_ENTREGA', 'CHEGUEI_NA_ORIGEM', 'ENTREGUE', 'CLOSED'];
              if (advancedStatuses.includes(origOrder.status)) {
                  if (origOrder.status === 'PRONTO') {
                      order.status = orderType === 'ENTREGA' ? 'ENVIADO_PARA_ENTREGA' : 'ENTREGUE';
                  } else {
                      order.status = origOrder.status; // Keep the advanced status
                  }
              }
          }
          
          const { data, error } = await supabase.from('orders').eq('id', firstId).update(order);
          if (error) throw error;
          finalOrderData = data ? data[0] : null;
          
          if (loadedCommandIds.length > 1) {
              for (let i = 1; i < loadedCommandIds.length; i++) {
                  await supabase.from('orders').eq('id', loadedCommandIds[i]).delete();
              }
          }
      } else {
          order.createdAt = Date.now();
          order.displayId = Math.floor(1000 + Math.random() * 9000).toString();
          const { data, error } = await supabase.from('orders').insert([order]);
          if (error) throw error;
          finalOrderData = data ? data[0] : null;
      }

      // Update stock based on the difference between cart and originalCart
      const stockUpdates = new Map<string, number>();

      for (const oldItem of originalCart) {
          const targetProductId = oldItem.originalProductId || oldItem.productId;
          const current = stockUpdates.get(targetProductId) || 0;
          stockUpdates.set(targetProductId, current + Number(oldItem.originalQuantity || oldItem.quantity || 0));

          // Restore complements stock
          if (oldItem.complements && oldItem.complements.length > 0) {
              for (const cp of oldItem.complements) {
                  const cpCurrent = stockUpdates.get(cp.itemId) || 0;
                  stockUpdates.set(cp.itemId, cpCurrent + (Number(cp.quantity || 0) * Number(oldItem.originalQuantity || oldItem.quantity || 0)));
              }
          }
      }

      for (const newItem of cart) {
          const targetProductId = newItem.originalProductId || newItem.productId;
          const current = stockUpdates.get(targetProductId) || 0;
          stockUpdates.set(targetProductId, current - Number(newItem.quantity || 0));

          // Deduct complements stock
          if (newItem.complements && newItem.complements.length > 0) {
              for (const cp of newItem.complements) {
                  const cpCurrent = stockUpdates.get(cp.itemId) || 0;
                  stockUpdates.set(cp.itemId, cpCurrent - (Number(cp.quantity || 0) * Number(newItem.quantity || 0)));
              }
          }
      }

      for (const [productId, diff] of stockUpdates.entries()) {
          if (diff !== 0) {
              const product = products.find(p => p.id === productId);
              if (product && product.stock != null) {
                  const newStock = product.stock + diff;
                  const updates: any = { stock: newStock };
                  
                  if (newStock <= 0) {
                      updates.isactive = false;
                  } else {
                      updates.isactive = true;
                  }

                  await supabase
                      .from('products')
                      .eq('id', product.id)
                      .update(updates);
              }
          }
      }

      const newOrder = finalOrderData;
      if (newOrder) {
        setLastOrder(newOrder);
        
        if (settings.isCashbackActive && selectedCustomer && selectedCustomer.isLoyaltyParticipant !== false && order.total && !originalOrderHadCustomer) {
            const cashbackUsed = payments.find(p => p.method === 'CASHBACK')?.amount || 0;
            const cashbackPercentage = Number(settings.cashbackPercentage) || 0;
            const cashbackEarned = Number(order.total) * (cashbackPercentage / 100);
            
            if (cashbackEarned > 0 || cashbackUsed > 0) {
                try {
                    // Fetch latest points to avoid race conditions
                    const { data: latestCustomer } = await supabase
                        .from('customers')
                        .eq('id', selectedCustomer.id)
                        .maybeSingle();
                    
                    const currentPoints = latestCustomer ? Number(latestCustomer.points || 0) : Number(selectedCustomer.points || 0);

                    const newCashbackBalance = currentPoints - cashbackUsed + cashbackEarned;
                    const { data, error } = await supabase
                        .from('customers')
                        .eq('id', selectedCustomer.id)
                        .update({ points: Math.max(0, newCashbackBalance) });
                    
                    if (error) {
                        console.error("Erro ao atualizar cashback do cliente no Supabase:", error);
                    } else {
                        setSelectedCustomer({ ...selectedCustomer, points: Math.max(0, newCashbackBalance) });
                    }
                } catch (e) {
      console.error("Erro ao atualizar cashback do cliente:", e);
                }
            }
        }

        // Auto print or show print option
        if (confirm("Venda realizada! Deseja imprimir o cupom?")) {
            printReceipt(newOrder);
        }
      }

      setCart([]);
      setOriginalCart([]);
      setPayments([]);
      setLoadedCommandIds([]);
      setLoadedPayments([]);
      setLoadedWaitstaffName(null);
      setLoadedServiceFee(0);
      setCommandNumber('');
      setDeliveryDetails({ customerName: '', customerPhone: '', address: '', driverId: '', payOnDelivery: false, useStoreOrigin: true, originAddress: '', referencePoint: '' });
      setDeliveryFee(0);
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
      setIsCheckoutOpen(false);
      fetchProducts(); // Refresh stock
      fetchCustomers(); // Refresh customers points
      
    } catch (err: any) {
      alert("Erro ao finalizar venda: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBleed = async () => {
      if (isContingencyMode) {
          alert("A sangria não está disponível no Modo Contingência.");
          return;
      }
      const amount = parseFloat(bleedAmount);
      if (isNaN(amount) || amount <= 0) {
          alert("Valor inválido");
          return;
      }
      if (!bleedReason) {
          alert("Informe o motivo");
          return;
      }

      try {
          const { error } = await supabase.from('cash_movements').insert([{
              store_id: storeId,
              type: 'SANGRIA',
              amount: amount,
              description: bleedReason,
              waitstaffName: user.name,
              createdAt: Date.now(),
              session_id: currentSession?.id
          }]);

          if (error) throw error;

          alert("Sangria realizada com sucesso!");
          setBleedAmount('');
          setBleedReason('');
          setIsBleedModalOpen(false);
      } catch (err: any) {
          alert("Erro ao realizar sangria: " + err.message);
      }
  };

  const handleCloseRegister = async () => {
    if (isContingencyMode || contingencyOrders.length > 0) {
        alert("Sincronize os pedidos e desative o Modo Contingência antes de fechar o caixa.");
        return;
    }
    setIsClosingRegister(true);

    try {
      const sessionId = currentSession?.id;
      let orders: any[] = [];
      let movements: any[] = [];

      if (sessionId) {
        const { data: sessionOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('store_id', storeId)
          .eq('session_id', sessionId);
        
        const { data: sessionMovements } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('store_id', storeId)
          .eq('session_id', sessionId)
          .eq('type', 'SANGRIA');

        orders = sessionOrders || [];
        movements = sessionMovements || [];
      } else {
        // Fallback for older data without session_id
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfDay = today.getTime();

        const { data: todayOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('store_id', storeId)
          .gte('createdAt', startOfDay);
        
        const { data: todayMovements } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('store_id', storeId)
          .gte('createdAt', startOfDay)
          .eq('type', 'SANGRIA');

        orders = todayOrders || [];
        movements = todayMovements || [];
      }

      const bleedsTotal = movements.reduce((acc, m) => acc + (m.amount || 0), 0);

      const sales = (orders as Order[] || []).reduce((acc, order) => {
        if (order.status === 'CANCELADO') return acc;
        
        let orderPayments: Payment[] = [];
        if (order.paymentDetails) {
            try { orderPayments = JSON.parse(order.paymentDetails); } catch(e) {}
        } else if (order.paymentMethod) {
            orderPayments = [{ method: order.paymentMethod, amount: order.total || 0 }];
        }

        if (orderPayments.length === 0) {
            if (order.paymentMethod === 'A_PAGAR' as any && order.status === 'ENTREGUE') {
                orderPayments = [{ method: 'A_PAGAR' as any, amount: order.total || 0 }];
            } else {
                return acc;
            }
        }

        const orderTotal = order.total || 0;
        acc.total += orderTotal;
        acc.count += 1;

        orderPayments.forEach(p => {
            if (p && p.method) {
                acc.byMethod[p.method] = (acc.byMethod[p.method] || 0) + (p.amount || 0);
            }
        });

        (order.items || []).forEach(item => {
            const existing = acc.products.find(p => p.productId === item.productId);
            if (existing) {
                existing.quantity += item.quantity;
                existing.total += item.price * item.quantity;
            } else {
                acc.products.push({
                    productId: item.productId,
                    name: item.name,
                    quantity: item.quantity,
                    total: item.price * item.quantity,
                    isByWeight: item.isByWeight
                });
            }
        });

        return acc;
      }, { total: 0, byMethod: {} as Record<string, number>, count: 0, bleeds: bleedsTotal, products: [] as any[] });
      
      setDailySales(sales);
    } catch (err) {
      console.error(err);
      setDailySales({ total: 0, byMethod: {}, count: 0, bleeds: 0, products: [] });
    }
  };

  const confirmCloseRegister = async () => {
    if (!currentSession) return;
    
    try {
      const closedAmount = (dailySales?.total || 0) + currentSession.initial_amount - (dailySales?.bleeds || 0);
      
      await supabase
        .from('register_sessions')
        .eq('id', currentSession.id)
        .update({
          status: 'CLOSED',
          closed_at: Date.now(),
          closed_amount: closedAmount
        });

      await supabase.from('cash_movements').insert([{
        id: crypto.randomUUID(),
        store_id: storeId,
        type: 'FECHAMENTO_CAIXA',
        amount: closedAmount,
        description: 'Fechamento de caixa',
        waitstaffName: user.name,
        createdAt: Date.now(),
        session_id: currentSession.id
      }]);
      
      setCurrentSession(null);
      setIsClosingRegister(false);
      setDailySales(null);
      setIsOpeningRegister(true);
    } catch (err) {
      console.error("Erro ao fechar caixa:", err);
      alert("Erro ao fechar o caixa. Tente novamente.");
    }
  };

  const printReceipt = async (order: Order) => {
    if (settings.usbPrinterVendorId && settings.usbPrinterProductId) {
      try {
        const removeAccents = (str: string) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        let text = "";
        text += removeAccents(settings.storeName).toUpperCase() + "\n";
        if (settings.cnpj) {
          text += `CNPJ: ${settings.cnpj}\n`;
        }
        text += `Data: ${new Date(order.createdAt).toLocaleString()}\n`;
        text += `Pedido: #${order.displayId || String(order.id || '').slice(0, 8)}\n`;
        text += `Cliente: ${removeAccents(order.customerName || 'Consumidor')}\n`;
        text += "--------------------------------\n";
        
        order.items.forEach((item: any) => {
          const line = `${item.quantity}x ${removeAccents(item.name).substring(0, 20)}`;
          const price = formatCurrency(item.price * item.quantity);
          const spaces = Math.max(1, 32 - line.length - price.length);
          text += line + " ".repeat(spaces) + price + "\n";
        });
        
        text += "--------------------------------\n";
        if (order.serviceFee && order.serviceFee > 0) {
          const feeText = `Comissao (${removeAccents(order.waitstaffName || 'Atendente')})`;
          const feeVal = formatCurrency(order.serviceFee);
          const spacesFee = Math.max(1, 32 - feeText.length - feeVal.length);
          text += feeText + " ".repeat(spacesFee) + feeVal + "\n";
        }
        if (order.deliveryFee && order.deliveryFee > 0) {
          const feeText = "Taxa de Entrega";
          const feeVal = formatCurrency(order.deliveryFee);
          const spacesFee = Math.max(1, 32 - feeText.length - feeVal.length);
          text += feeText + " ".repeat(spacesFee) + feeVal + "\n";
        }
        const totalText = "TOTAL";
        const totalVal = formatCurrency(order.total);
        const spacesTotal = Math.max(1, 32 - totalText.length - totalVal.length);
        text += totalText + " ".repeat(spacesTotal) + totalVal + "\n";
        
        let paymentText = `Pagamento: ${removeAccents(order.paymentMethod || '')}\n`;
        if (order.paymentMethod === 'MISTO' && order.paymentDetails) {
            try {
                const details = JSON.parse(order.paymentDetails);
                paymentText = `Pagamento:\n`;
                details.forEach((p: any) => {
                    paymentText += `  ${removeAccents(p.method)}: ${formatCurrency(p.amount)}\n`;
                });
            } catch (e) {}
        }
        text += paymentText;
        if (order.changeFor) {
          const changeAmount = order.changeFor - order.total;
          text += `Pago em Dinheiro: ${formatCurrency(order.changeFor)}\n`;
          text += `Troco: ${formatCurrency(changeAmount)}\n`;
        }
        text += "\nObrigado pela preferencia!\n\n\n\n";

        const devices = await (navigator as any).usb.getDevices();
        const device = devices.find((d: any) => d.vendorId === settings.usbPrinterVendorId && d.productId === settings.usbPrinterProductId);
        
        if (device) {
          await device.open();
          if (device.configuration === null) {
            await device.selectConfiguration(1);
          }
          await device.claimInterface(0);

          const encoder = new TextEncoder();
          const data = encoder.encode(text);
          
          const init = new Uint8Array([0x1B, 0x40, 0x1B, 0x45, 0x01]); 
          const cut = new Uint8Array([0x1D, 0x56, 0x00]); 

          let outEndpoint;
          for (const endpoint of device.configuration.interfaces[0].alternate.endpoints) {
            if (endpoint.direction === 'out') {
              outEndpoint = endpoint;
              break;
            }
          }

          if (outEndpoint) {
            await device.transferOut(outEndpoint.endpointNumber, init);
            await device.transferOut(outEndpoint.endpointNumber, data);
            await device.transferOut(outEndpoint.endpointNumber, cut);
            await device.close();
            return; // Success
          }
        } else {
          console.warn("Impressora USB não encontrada. Tentando impressão padrão.");
        }
      } catch (error) {
      console.error("Erro na impressão USB:", error);
      }
    }

    const printWidth = settings.printWidthPx ? `${settings.printWidthPx}px` : (settings.thermalPrinterWidth === '58mm' ? '180px' : '280px');
    const winWidth = settings.printWidthPx ? settings.printWidthPx + 50 : (settings.thermalPrinterWidth === '58mm' ? 300 : 400);
    const content = `
      <div style="font-family: 'Courier New', Courier, monospace; width: ${printWidth}; padding-right: 5px; font-size: 14px; font-weight: 900; color: black !important; line-height: 1.1; letter-spacing: -0.5px; -webkit-print-color-adjust: exact;">
        <h2 style="text-align: center; margin: 0; font-size: 16px; font-weight: 900; color: black !important;">${settings.storeName}</h2>
        ${settings.cnpj ? `<p style="text-align: center; margin: 0 0 5px 0; font-size: 12px; color: black !important;">CNPJ: ${settings.cnpj}</p>` : ''}
        <p style="margin: 2px 0; color: black !important;">Data: ${new Date(order.createdAt).toLocaleString()}</p>
        <p style="margin: 2px 0; color: black !important;">Pedido: #${order.displayId || String(order.id || '').slice(0, 8)}</p>
        <p style="margin: 2px 0; color: black !important;">Cliente: ${order.customerName || 'Consumidor'}</p>
        ${order.customerPhone ? `<p style="margin: 2px 0; color: black !important;">Telefone: ${order.customerPhone}</p>` : ''}
        ${order.deliveryAddress ? `<p style="margin: 2px 0; color: black !important;">Endereço: ${order.deliveryAddress}</p>` : ''}
        ${order.referencePoint ? `<p style="margin: 2px 0; color: black !important;">Ref: ${order.referencePoint}</p>` : ''}
        <div style="border-top: 2px dashed black; margin: 5px 0;"></div>
        ${order.items.map((item: any) => `
          <div style="display: flex; justify-content: space-between; margin: 1px 0; color: black !important;">
            <span style="flex: 1;">${item.quantity}x ${item.name}</span>
            <span style="margin-left: 5px;">${formatCurrency(item.price * item.quantity)}</span>
          </div>
          ${item.complements && item.complements.length > 0 ? item.complements.map((comp: any) => `
            <div style="margin: 0; padding-left: 10px; color: black !important; font-size: 13px;">
              + ${comp.quantity}x ${comp.name}
            </div>
          `).join('') : ''}
        `).join('')}
        <div style="border-top: 2px dashed black; margin: 5px 0;"></div>
        ${order.serviceFee && order.serviceFee > 0 ? `
        <div style="display: flex; justify-content: space-between; color: black !important;">
          <span>Comissao (${order.waitstaffName || 'Atendente'})</span>
          <span>${formatCurrency(order.serviceFee)}</span>
        </div>
        <div style="border-top: 1px dashed black; margin: 5px 0;"></div>
        ` : ''}
        ${order.deliveryFee && order.deliveryFee > 0 ? `
        <div style="display: flex; justify-content: space-between; color: black !important;">
          <span>Taxa de Entrega</span>
          <span>${formatCurrency(order.deliveryFee)}</span>
        </div>
        <div style="border-top: 1px dashed black; margin: 5px 0;"></div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 16px; margin: 5px 0; color: black !important;">
          <span>TOTAL</span>
          <span>${formatCurrency(order.total)}</span>
        </div>
        ${(() => {
            if (order.paymentMethod === 'MISTO' && order.paymentDetails) {
                try {
                    const details = JSON.parse(order.paymentDetails);
                    let paymentInfo = `<p style="margin: 2px 0; color: black !important;">Pagamento:</p>` + details.map((p: any) => `<p style="margin: 0 0 0 10px; color: black !important;">${p.method}: ${formatCurrency(p.amount)}</p>`).join('');
                    
                    const aPagar = details.find((p: any) => p.method === 'A_PAGAR');
                    if (aPagar && aPagar.amount > 0) {
                        paymentInfo += `<p style="margin: 5px 0; font-weight: 900; font-size: 16px; color: black !important;">TOTAL A RECEBER: ${formatCurrency(aPagar.amount)}</p>`;
                    }
                    return paymentInfo;
                } catch (e) {}
            }
            return `<p style="margin: 2px 0; color: black !important;">Pagamento: ${order.paymentMethod}</p>`;
        })()}
        ${order.changeFor ? `<p style="margin: 1px 0; color: black !important;">Pago em Dinheiro: ${formatCurrency(order.changeFor)}</p><p style="margin: 1px 0; color: black !important;">Troco: ${formatCurrency(order.changeFor - order.total)}</p>` : ''}
        <div style="border-top: 2px dashed black; margin: 10px 0;"></div>
        ${settings.isCashbackActive && order.customerId && ((Number(order.total) || 0) * (Number(settings.cashbackPercentage || 0) / 100)) > 0 ? `
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 14px; margin: 5px 0; color: black !important;">
          <span>CASHBACK GANHO:</span>
          <span>${formatCurrency((Number(order.total) || 0) * (Number(settings.cashbackPercentage || 0) / 100))}</span>
        </div>
        ` : ''}
        <p style="text-align: center; margin: 0; font-weight: 900; color: black !important;">OBRIGADO PELA PREFERENCIA!</p>
        <p style="text-align: center; margin: 0; font-weight: 900; font-size: 8px; color: black !important; margin-top: 5px;">SISTEMA DevARO</p>
        <br /><br />
      </div>
    `;

    const win = window.open('', '', `width=${winWidth},height=600`);
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Cupom</title>
            <style>
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 5px; background: white; font-family: monospace; }
              * { 
                color: black !important; 
                font-weight: 900 !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
              }
            </style>
          </head>
          <body onload="window.print(); window.onafterprint = function() { window.close(); }; setTimeout(function() { window.close(); }, 1000);">
            ${content}
          </body>
        </html>
      `);
      win.document.close();
    }
  };
  
  const printBudget = () => {
    if (cart.length === 0) return;
    
    const printWidth = settings.printWidthPx ? `${settings.printWidthPx}px` : (settings.thermalPrinterWidth === '58mm' ? '180px' : '280px');
    const winWidth = settings.printWidthPx ? settings.printWidthPx + 50 : (settings.thermalPrinterWidth === '58mm' ? 300 : 400);
    const content = `
    <div style="font-family: monospace; width: ${printWidth}; padding-right: 5px; font-size: 14px; font-weight: 900; color: black !important; line-height: 1.1; -webkit-print-color-adjust: exact;">
      <h2 style="text-align: center; margin: 0; font-size: 16px; font-weight: 900; color: black !important;">ORCAMENTO</h2>
      <p style="text-align: center; margin: 0 0 10px 0; color: black !important;">${settings.storeName}</p>
      <p style="margin: 2px 0; color: black !important;">Data: ${new Date().toLocaleString()}</p>
      <div style="border-top: 2px dashed black; margin: 5px 0;"></div>
      <table style="width: 100%; text-align: left; font-size: 13px; font-weight: 900; color: black !important;">
        <tr>
          <th style="padding-bottom: 5px;">Qtd</th>
          <th style="padding-bottom: 5px;">Item</th>
          <th style="text-align: right; padding-bottom: 5px;">Total</th>
        </tr>
        ${cart.map(item => `
        <tr>
          <td style="vertical-align: top; color: black !important;">${item.isByWeight ? item.quantity.toFixed(3) + 'kg' : item.quantity}</td>
          <td style="vertical-align: top; color: black !important;">${item.name}</td>
          <td style="text-align: right; vertical-align: top; color: black !important;">${formatCurrency(item.price * item.quantity)}</td>
        </tr>
        `).join('')}
      </table>
      <div style="border-top: 2px dashed black; margin: 5px 0;"></div>
      <h3 style="text-align: right; margin: 10px 0; font-size: 16px; font-weight: 900; color: black !important;">Total: ${formatCurrency(total)}</h3>
      <div style="border-top: 1px dashed black; margin: 10px 0;"></div>
      <p style="text-align: center; font-size: 11px; margin-top: 10px; font-weight: 900; color: black !important;">Este documento nao e um cupom fiscal.</p>
      <br /><br />
    </div>
    `;

    const win = window.open('', '', `width=${winWidth},height=600`);
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Orcamento</title>
            <style>
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 5px; background: white; font-family: monospace; }
              * { 
                color: black !important; 
                font-weight: 900 !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
              }
            </style>
          </head>
          <body onload="window.print(); window.onafterprint = function() { window.close(); }; setTimeout(function() { window.close(); }, 1000);">
            ${content}
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  const printDailyReport = () => {
      if (!dailySales) return;
      
      const initial = currentSession?.initial_amount || 0;
      const totalInBox = dailySales.total + initial - dailySales.bleeds;
      const printWidth = settings.printWidthPx ? `${settings.printWidthPx}px` : (settings.thermalPrinterWidth === '58mm' ? '180px' : '280px');
      const winWidth = settings.printWidthPx ? settings.printWidthPx + 50 : (settings.thermalPrinterWidth === '58mm' ? 300 : 400);

      const content = `
      <div style="font-family: monospace; width: ${printWidth}; padding-right: 5px; font-size: 14px; font-weight: 900; color: black !important; line-height: 1.1; -webkit-print-color-adjust: exact;">
        <h2 style="text-align: center; margin: 0; font-size: 16px; font-weight: 900; color: black !important;">FECHAMENTO CAIXA</h2>
        <p style="text-align: center; margin: 0 0 10px 0; color: black !important;">${settings.storeName}</p>
        <p style="margin: 2px 0; color: black !important;">Data: ${new Date().toLocaleString()}</p>
        <p style="margin: 2px 0; color: black !important;">Operador: ${user.name}</p>
        <div style="border-top: 2px dashed black; margin: 5px 0;"></div>
        <p style="margin: 2px 0; color: black !important;"><strong>Troco Inicial:</strong> ${formatCurrency(initial)}</p>
        <p style="margin: 2px 0; color: black !important;"><strong>Vendas Totais:</strong> ${dailySales.count}</p>
        <p style="margin: 2px 0; color: black !important;"><strong>Faturamento:</strong> ${formatCurrency(dailySales.total)}</p>
        <div style="border-top: 1px dashed black; margin: 5px 0;"></div>
        <p style="margin: 5px 0; color: black !important;"><strong>Por Metodo:</strong></p>
        ${Object.entries(dailySales.byMethod).map(([method, amount]) => `
            <div style="display: flex; justify-content: space-between; margin: 1px 0; color: black !important;">
                <span>${method}</span>
                <span>${formatCurrency(amount as number)}</span>
            </div>
        `).join('')}
        <div style="border-top: 1px dashed black; margin: 5px 0;"></div>
        <p style="margin: 5px 0; color: black !important;"><strong>Produtos:</strong></p>
        ${dailySales.products.sort((a, b) => b.total - a.total).map(p => `
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 1px 0; color: black !important;">
                <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
                <span style="margin-left: 5px;">${p.isByWeight ? p.quantity.toFixed(3) + 'kg' : p.quantity + 'x'}</span>
                <span style="margin-left: 5px;">${formatCurrency(p.total)}</span>
            </div>
        `).join('')}
        <div style="border-top: 2px dashed black; margin: 5px 0;"></div>
        <div style="display: flex; justify-content: space-between; color: black !important;">
            <span>Total Sangrias</span>
            <span>- ${formatCurrency(dailySales.bleeds)}</span>
        </div>
        <div style="border-top: 2px dashed black; margin: 5px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; color: black !important;">
            <span>TOTAL EM CAIXA</span>
            <span>${formatCurrency(totalInBox)}</span>
        </div>
        <br />
        <p style="text-align: center; font-weight: 900; color: black !important;">--- FIM DO RELATORIO ---</p>
        <br /><br />
      </div>
      `;

    const win = window.open('', '', `width=${winWidth},height=600`);
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Relatorio</title>
            <style>
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 5px; background: white; font-family: monospace; }
              * { 
                color: black !important; 
                font-weight: 900 !important; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact;
              }
            </style>
          </head>
          <body onload="window.print(); window.onafterprint = function() { window.close(); }; setTimeout(function() { window.close(); }, 1000);">
            ${content}
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] bg-gray-100 overflow-hidden font-sans text-gray-900">
      {isOffline && (
          <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-600 text-white py-2 px-4 flex items-center justify-center gap-2 font-bold shadow-lg animate-slide-down">
              <WifiOff size={20} />
              <span>MODO CONTINGÊNCIA ATIVO - VOCÊ ESTÁ OFFLINE</span>
          </div>
      )}
      {ecosystemUsage && settings.maxOrdersPerMonth && ecosystemUsage.ordersThisMonth >= (settings.maxOrdersPerMonth * 0.8) && ecosystemUsage.ordersThisMonth < settings.maxOrdersPerMonth && (
          <div className="fixed top-0 left-0 right-0 z-[99] bg-yellow-500 text-black py-2 px-4 flex items-center justify-center gap-2 font-bold shadow-lg animate-slide-down text-xs md:text-sm">
              <AlertCircle size={20} />
              <span>Atenção: Você atingiu {Math.floor((ecosystemUsage.ordersThisMonth / settings.maxOrdersPerMonth) * 100)}% do seu limite de pedidos mensal ({ecosystemUsage.ordersThisMonth}/{settings.maxOrdersPerMonth}).</span>
          </div>
      )}
      {/* Left Side - Products */}
      <div className="flex-1 flex flex-col min-w-0 h-[55dvh] lg:h-full">
        <header 
          className="p-3 md:p-4 shadow-sm flex flex-col z-10 gap-3 transition-colors"
          style={{ backgroundColor: settings.primaryColor || '#ffffff' }}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex justify-between w-full md:w-auto items-center gap-3">
              {settings.logoUrl && (
                <img src={settings.logoUrl || undefined} alt="Logo" className="h-10 w-10 md:h-12 md:w-12 object-contain rounded-full bg-white/10 p-1" />
              )}
              <div>
                <h1 className="text-lg md:text-xl font-bold" style={{ color: settings.primaryColor ? '#ffffff' : '#1f2937' }}>
                  PDV - {settings.storeName}
                </h1>
                <p className="text-[10px] md:text-xs" style={{ color: settings.primaryColor ? 'rgba(255,255,255,0.8)' : '#6b7280' }}>
                  Operador: {user.name}
                </p>
              </div>
              <button onClick={onLogout} className="md:hidden p-2 hover:bg-white/10 rounded-full" style={{ color: settings.primaryColor ? '#ffffff' : '#ef4444' }}>
                  <LogOut size={20} />
              </button>
            </div>
            <div className="flex gap-1 md:gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
               <button onClick={connectScale} className={`p-2 rounded-xl flex items-center gap-2 px-3 md:px-4 border shrink-0 ${isScaleConnected ? 'text-blue-600 border-blue-100 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`} 
                  style={{ 
                      color: !isScaleConnected ? (settings.primaryColor ? 'rgba(255,255,255,0.7)' : '#9ca3af') : undefined,
                      borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                      backgroundColor: settings.primaryColor && !isScaleConnected ? 'rgba(255,255,255,0.1)' : undefined
                  }}
                  title={isScaleConnected ? "Balança Conectada" : "Conectar Balança"}>
                  <div className="relative">
                      <Package size={18} />
                      {isScaleConnected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                  </div>
                  <span className="text-xs font-bold">{scaleWeight ? `${scaleWeight.toFixed(3)}kg` : 'Balança'}</span>
               </button>
               <button onClick={() => setIsBleedModalOpen(true)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-xl flex items-center gap-2 px-3 md:px-4 border border-orange-100 shrink-0" 
                  style={{ 
                      color: settings.primaryColor ? '#ffffff' : undefined,
                      borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                      backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                  }}
                  title="Sangria">
                  <Minus size={18} />
                  <span className="text-xs font-bold">Sangria</span>
               </button>
               <button onClick={handleCloseRegister} className="p-2 text-green-600 hover:bg-green-50 rounded-xl flex items-center gap-2 px-3 md:px-4 border border-green-100 shrink-0" 
                  style={{ 
                      color: settings.primaryColor ? '#ffffff' : undefined,
                      borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                      backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                  }}
                  title="Fechar Caixa">
                  <DollarSign size={18} />
                  <span className="text-xs font-bold">Fechar Caixa</span>
               </button>
               <button onClick={() => {
                   window.location.reload();
               }} className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl border border-gray-100 shrink-0" 
                  style={{ 
                      color: settings.primaryColor ? '#ffffff' : undefined,
                      borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                      backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                  }}
                  title="Atualizar Cardápio">
                  <RefreshCw size={18} />
               </button>
               <button 
                  onClick={() => setIsContingencyMode(!isContingencyMode)} 
                  className={`p-2 rounded-xl flex items-center gap-2 px-3 md:px-4 border shrink-0 ${isContingencyMode ? 'text-orange-600 border-orange-100 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`} 
                  style={{ 
                      color: !isContingencyMode ? (settings.primaryColor ? 'rgba(255,255,255,0.7)' : '#9ca3af') : undefined,
                      borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                      backgroundColor: settings.primaryColor && !isContingencyMode ? 'rgba(255,255,255,0.1)' : undefined
                  }}
                  title={isContingencyMode ? "Modo Contingência Ativo" : "Ativar Modo Contingência"}
               >
                  {isContingencyMode ? <WifiOff size={18} /> : <Wifi size={18} />}
                  <span className="text-xs font-bold hidden md:inline">{isContingencyMode ? 'Contingência' : 'Online'}</span>
               </button>
               {contingencyOrders.length > 0 && (
                  <button 
                    onClick={syncContingencyOrders} 
                    disabled={isProcessing}
                    className="p-2 text-white bg-orange-500 hover:bg-orange-600 rounded-xl flex items-center gap-2 px-3 md:px-4 border border-orange-600 shrink-0 shadow-lg animate-pulse" 
                    title="Sincronizar Pedidos"
                  >
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    <span className="text-xs font-bold hidden md:inline">Sincronizar ({contingencyOrders.length})</span>
                  </button>
               )}
               <InstallPrompt />
               {lastOrder && (
                 <div className="flex gap-2 shrink-0">
                   <button onClick={() => printReceipt(lastOrder)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl border border-blue-100" 
                    style={{ 
                        color: settings.primaryColor ? '#ffffff' : undefined,
                        borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                        backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                    }}
                    title="Reimprimir Último Cupom">
                      <Printer size={18} />
                   </button>
                   {settings.focusNfeToken && (
                     <button 
                      onClick={() => {
                        if (lastOrder.nfce_status === 'AUTHORIZED' || lastOrder.nfce_reference) {
                           handleConsultNfcePOS(lastOrder);
                        } else {
                           handleEmitNfcePOS(lastOrder);
                        }
                      }}
                      disabled={isEmittingNfce}
                      className="p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl border border-indigo-700 flex items-center gap-2" 
                      title={lastOrder.nfce_reference ? "Consultar/Reimprimir NFC-e" : "Emitir NFC-e do Último Pedido"}>
                        {isEmittingNfce ? <Loader2 size={18} className="animate-spin" /> : (lastOrder.nfce_reference ? <Search size={18} /> : <Tag size={18} />)}
                        <span className="text-xs font-bold hidden md:inline">{lastOrder.nfce_reference ? "Consultar NF" : "Emitir NF"}</span>
                     </button>
                   )}
                 </div>
               )}
               <button onClick={onLogout} className="hidden md:flex p-2 text-red-500 hover:bg-red-50 rounded-xl border border-red-100 shrink-0" 
                  style={{ 
                      color: settings.primaryColor ? '#ffffff' : undefined,
                      borderColor: settings.primaryColor ? 'rgba(255,255,255,0.2)' : undefined,
                      backgroundColor: settings.primaryColor ? 'rgba(255,255,255,0.1)' : undefined
                  }}
                  title="Sair">
                  <LogOut size={18} />
               </button>
            </div>
          </div>
          
          {/* Shortcuts Info - Desktop Only */}
          <div className="hidden lg:flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider overflow-x-auto no-scrollbar" style={{ color: settings.primaryColor ? 'rgba(255,255,255,0.6)' : '#9ca3af' }}>
            <div className="flex items-center gap-1 shrink-0"><kbd className="bg-black/10 px-1.5 py-0.5 rounded border border-white/10 shrink-0">F2</kbd> Buscar</div>
            <div className="flex items-center gap-1 shrink-0"><kbd className="bg-black/10 px-1.5 py-0.5 rounded border border-white/10 shrink-0">F4</kbd> Checkout</div>
            <div className="flex items-center gap-1 shrink-0"><kbd className="bg-black/10 px-1.5 py-0.5 rounded border border-white/10 shrink-0">F6</kbd> Comanda</div>
            <div className="flex items-center gap-1 shrink-0"><kbd className="bg-black/10 px-1.5 py-0.5 rounded border border-white/10 shrink-0">F7</kbd> Mesa</div>
            <div className="flex items-center gap-1 shrink-0"><kbd className="bg-black/10 px-1.5 py-0.5 rounded border border-white/10 shrink-0">F8</kbd> Entrega</div>
            <div className="flex items-center gap-1 shrink-0"><kbd className="bg-black/10 px-1.5 py-0.5 rounded border border-white/10 shrink-0">F9</kbd> Retirada / Viagem</div>
            <div className="flex items-center gap-1 shrink-0"><kbd className="bg-black/10 px-1.5 py-0.5 rounded border border-white/10 shrink-0">F10</kbd> Lançar</div>
            <div className="flex items-center gap-1 shrink-0"><kbd className="bg-black/10 px-1.5 py-0.5 rounded border border-white/10 shrink-0">ESC</kbd> Limpar</div>
          </div>
        </header>
        
        {/* ... (rest of the component) */}

        <div className="bg-white border-b shadow-sm shrink-0 z-10 sticky top-0">
          <div className="p-2 md:p-3 flex gap-2 md:gap-4 overflow-x-auto no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat 
                    ? 'text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: selectedCategory === cat ? (settings.primaryColor || '#2563eb') : undefined
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="px-2 md:px-4 pb-2 md:pb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="pdv-search-input"
                type="text"
                placeholder="Buscar produto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const exactMatch = products.find(p => p.barcode === search);
                    if (exactMatch) {
                      handleProductClick(exactMatch);
                      setSearch('');
                    } else if (filteredProducts.length === 1) {
                      handleProductClick(filteredProducts[0]);
                      setSearch('');
                    }
                  }
                }}
                className="w-full pl-10 md:pl-12 pr-4 py-2 md:py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm md:text-base"
                autoFocus
              />
            </div>
            <button 
              type="button" 
              onClick={() => setShowScanner(!showScanner)} 
              className="p-2 md:p-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center shadow-sm" 
              title="Ler com a câmera"
            >
              <ScanLine size={20} />
            </button>
            <label className="p-2 md:p-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center cursor-pointer shadow-sm" title="Ler de uma imagem">
              <Camera size={20} />
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                onChange={async (e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    const html5QrCode = new Html5Qrcode("pos-reader");
                    try {
                      const decodedText = await html5QrCode.scanFile(file, true);
                      setSearch(decodedText);
                      const exactMatch = products.find(p => p.barcode === decodedText);
                      if (exactMatch) {
                        handleProductClick(exactMatch);
                        setSearch('');
                      }
                      alert("Código lido com sucesso!");
                    } catch (err) {
                      alert("Não foi possível ler o código na imagem.");
                    }
                  }
                }} 
              />
            </label>
          </div>
        </div>

        <div className="p-2 md:p-4 flex-1 overflow-y-auto bg-gray-50 flex flex-col">
          {showScanner && (
            <div className="mb-4 bg-black rounded-xl overflow-hidden relative">
              <div id="pos-reader" className="w-full"></div>
              <button 
                onClick={() => setShowScanner(false)}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 z-10"
              >
                <X size={20} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
            {isProductsLoading ? (
              Array.from({ length: 15 }).map((_, i) => <ProductSkeleton key={i} />)
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400">
                <Package size={48} className="mx-auto mb-2 opacity-20" />
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              filteredProducts.slice(0, visibleCount).map(product => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="bg-white p-2 md:p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all text-left flex flex-col h-full group relative overflow-hidden"
                >
                  <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-gray-50 relative shrink-0">
                    {product.imageUrl ? (
                      <img 
                        src={product.imageUrl || undefined} 
                        alt={product.name} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <Package size={24} />
                      </div>
                    )}
                    {product.stock != null && (
                      <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold shadow-sm z-10 ${product.stock > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {product.stock > 0 ? `${product.stock} un` : 'Esgotado'}
                      </div>
                    )}
                    {product.isByWeight && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold shadow-sm bg-blue-500 text-white z-10 uppercase">
                        Peso
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 text-[11px] md:text-xs line-clamp-2 leading-tight mb-1 group-hover:text-blue-600 transition-colors">
                    {product.name}
                  </h3>
                  <div className="mt-auto pt-1 flex justify-between items-center">
                    <span className="font-extrabold text-sm md:text-base text-gray-900 leading-none">
                      {(() => {
                        const promoPrice = getPromotionalPrice(product);
                        if (promoPrice !== null) {
                           return formatCurrency(promoPrice);
                        }
                        const discountPercentage = getPromotionalDiscountPercentage(product);
                        if (product.price <= 0 && discountPercentage) {
                           return (
                             <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                               <Percent size={10} /> {discountPercentage}% OFF
                             </span>
                           );
                        }
                        return formatCurrency(product.price);
                      })()}
                    </span>
                    <div 
                      className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all scale-90 group-hover:scale-100"
                    >
                      <Plus size={16} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          
          {/* Scroll Sentinel */}
          {!isProductsLoading && filteredProducts.length > visibleCount && (
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              <Loader2 className="animate-spin text-gray-300" size={32} />
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className="w-full lg:w-96 bg-white shadow-xl flex flex-col border-t lg:border-l border-gray-200 z-20 h-[45dvh] lg:h-full">
        <div className="p-3 border-b bg-gray-50 flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center w-full">
            <h2 className="font-bold text-gray-800 flex items-center gap-2 shrink-0">
              <ShoppingCart size={18} />
              <span>Carrinho</span>
            </h2>
            {cart.length > 0 && (
                <button 
                  onClick={() => {
                      if (confirm("Limpar carrinho?")) {
                          setCart([]);
                          setOriginalCart([]);
                          setLoadedCommandIds([]);
                          setLoadedPayments([]);
                          setLoadedWaitstaffName(null);
                          setLoadedServiceFee(0);
                          setCommandNumber('');
                      }
                  }}
                  className="p-2 flex items-center gap-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors text-xs font-bold"
                  title="Limpar Carrinho"
                >
                  <Trash2 size={16} />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar w-full">
              <button 
                onClick={() => lookupOrdersList('COMANDA')}
                disabled={isLookingUpCommand}
                title="Lista de Comandas"
                className="relative flex-1 p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap"
                style={{
                    backgroundColor: settings.primaryColor ? `${settings.primaryColor}20` : undefined,
                    color: settings.primaryColor || undefined
                }}
              >
                {newOrdersCount.COMANDA > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                  </span>
                )}
                {isLookingUpCommand ? <Loader2 className="animate-spin" size={16} /> : <Tag size={16} />}
                <span>Comanda</span>
              </button>
              <button 
                onClick={() => lookupOrdersList('MESA')}
                disabled={isLookingUpCommand}
                title="Lista de Mesas"
                className="relative flex-1 p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap"
              >
                {newOrdersCount.MESA > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                  </span>
                )}
                {isLookingUpCommand ? <Loader2 className="animate-spin" size={16} /> : <Hash size={16} />}
                <span>Mesa</span>
              </button>
              <button 
                onClick={() => lookupOrdersList('ENTREGA')}
                disabled={isLookingUpCommand}
                title="Lista de Entregas"
                className="relative flex-1 p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap"
              >
                {newOrdersCount.ENTREGA > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                  </span>
                )}
                {isLookingUpCommand ? <Loader2 className="animate-spin" size={16} /> : <Truck size={16} />}
                <span className="hidden sm:inline">Entrega</span>
              </button>
              <button 
                onClick={() => lookupOrdersList('BALCAO')}
                disabled={isLookingUpCommand}
                title="Pedidos Retirada / Viagem"
                className="relative flex-1 p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap"
              >
                {newOrdersCount.BALCAO > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                  </span>
                )}
                {isLookingUpCommand ? <Loader2 className="animate-spin" size={16} /> : <ShoppingBag size={16} />}
                <span className="hidden sm:inline">Viagem</span>
              </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 opacity-50">
              <ShoppingCart size={48} />
              <p>Carrinho vazio</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800 line-clamp-1 break-words">{item.name}</p>
                  {item.complements && item.complements.length > 0 && (
                     <ul className="mt-1 space-y-0.5 mb-1">
                        {item.complements.map((comp, idx) => (
                           <li key={idx} className="text-[9px] text-gray-500 font-medium">
                              <span className="text-gray-400 font-bold">{comp.quantity}x</span> {comp.name}
                              {comp.price > 0 && <span className="text-gray-400"> (+ R$ {(comp.price * comp.quantity).toFixed(2)})</span>}
                           </li>
                        ))}
                     </ul>
                  )}
                  <p className="text-xs text-gray-500">{formatCurrency(item.price)} {item.isByWeight ? '/ kg' : 'un'}</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                  <button onClick={() => updateQuantity(item.productId, item.isByWeight ? -0.1 : -1)} className="p-1 hover:bg-white rounded-md shadow-sm transition-all text-gray-600">
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-bold w-12 text-center">
                    {item.isByWeight ? item.quantity.toFixed(3) : item.quantity}
                  </span>
                  <button onClick={() => updateQuantity(item.productId, item.isByWeight ? 0.1 : 1)} className="p-1 hover:bg-white rounded-md shadow-sm transition-all text-blue-600">
                    <Plus size={14} />
                  </button>
                </div>
                <button onClick={() => updateQuantity(item.productId, -item.quantity)} className="p-2 text-red-300 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 md:p-6 bg-gray-50 border-t space-y-3 md:space-y-4 shrink-0">
          {serviceFee > 0 && (
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>Comissão ({commissionRate > 0 ? `${commissionRate}%` : 'Atendente'})</span>
              <span>{formatCurrency(serviceFee)}</span>
            </div>
          )}
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
                <span className="text-gray-500 font-medium text-sm md:text-base">Total a Pagar</span>
                {loadedCommandIds.length > 0 && (
                    <span className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                        <Tag size={10} /> Comanda {commandNumber}
                    </span>
                )}
            </div>
            <span className="text-2xl md:text-3xl font-black text-gray-900">{formatCurrency(total)}</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {loadedCommandIds.length > 0 && (
                <button 
                    onClick={handleCancelOrder}
                    disabled={isProcessing}
                    className={`flex-1 min-w-[100px] py-3 md:py-4 bg-red-500 text-white rounded-xl font-bold text-sm md:text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1 md:gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'}`}
                >
                    <X size={20} />
                    <span className="hidden sm:inline">Cancelar</span>
                </button>
            )}
            {cart.length > 0 && (
                <>
                    <button 
                        onClick={printBudget}
                        disabled={isProcessing}
                        className="flex-1 min-w-[100px] py-3 md:py-4 bg-gray-600 text-white rounded-xl font-bold text-sm md:text-lg shadow-lg hover:bg-gray-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 md:gap-2"
                    >
                        <Printer size={20} />
                        <span className="hidden sm:inline">Orçamento</span>
                    </button>
                    <button 
                        onClick={handleSaveToCommand}
                        disabled={isProcessing}
                        className="flex-1 min-w-[100px] py-3 md:py-4 bg-blue-600 text-white rounded-xl font-bold text-sm md:text-lg shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 md:gap-2"
                        style={{ backgroundColor: settings.primaryColor || '#2563eb' }}
                    >
                        <Tag size={20} />
                        Lançar
                    </button>
                </>
            )}
            <button 
                onClick={() => {
                    setIsCheckoutOpen(true);
                    setPayments(loadedCommandIds.length > 0 ? loadedPayments : []);
                    setCurrentPaymentAmount(total.toFixed(2));
                }}
                disabled={cart.length === 0}
                className="flex-[2] min-w-[200px] w-full py-3 md:py-4 bg-green-600 text-white rounded-xl font-bold text-sm md:text-lg shadow-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 md:gap-2"
            >
                <CheckCircle2 size={20} />
                {loadedCommandIds.length > 0 ? `Finalizar Comanda ${commandNumber}` : 'Finalizar Venda'}
            </button>
          </div>
        </div>
      </div>

      {/* Weight Modal */}
      {weightModal.isOpen && weightModal.product && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4">Informe o Peso (Gramas)</h3>
            {isScaleConnected && (
                <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    Lendo da balança...
                </div>
            )}
            <p className="text-sm text-gray-500 mb-4">{weightModal.product.name}</p>
            <div className="relative mb-6">
                <input 
                    type="text" 
                    inputMode="decimal"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-2xl font-bold text-center outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">g</span>
            </div>
            <div className="flex gap-3">
                <button onClick={() => setWeightModal({ isOpen: false, product: null })} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600">Cancelar</button>
                <button 
                    onClick={() => {
                        const weight = parseFloat(weightInput.replace(',', '.'));
                        if (weight > 0) addToCart(weightModal.product!, weight / 1000);
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold"
                >
                    Confirmar
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Complements Modal */}
      {complementsProduct && (
        <ComplementsModal
          product={complementsProduct}
          selectedComplements={selectedComplements}
          quantity={complementsQuantity}
          onClose={() => setComplementsProduct(null)}
          onQuantityChange={setComplementsQuantity}
          getPromotionalPrice={getPromotionalPrice}
          onToggleComplement={(category, item, currentQty, maxCategoryQty) => {
             const catItems = selectedComplements.filter(sc => sc.categoryId === category.id);
             const currentCatCount = catItems.reduce((sum, sc) => sum + sc.quantity, 0);

             let newComplements = [...selectedComplements];

             if (maxCategoryQty === 1) {
                newComplements = newComplements.filter(sc => sc.categoryId !== category.id);
                newComplements.push({
                   categoryId: category.id,
                   categoryName: category.name,
                   itemId: item.id,
                   name: item.name,
                   price: item.price,
                   quantity: 1
                });
             } else {
                const existingIndex = newComplements.findIndex(sc => sc.categoryId === category.id && sc.itemId === item.id);
                
                if (existingIndex > -1) {
                   const qty = newComplements[existingIndex].quantity;
                   if (currentQty > qty) { 
                      if (currentCatCount >= maxCategoryQty) return; 
                      newComplements[existingIndex].quantity += 1;
                   } else { 
                      if (newComplements[existingIndex].quantity > 1) {
                         newComplements[existingIndex].quantity -= 1;
                      } else {
                         newComplements.splice(existingIndex, 1);
                      }
                   }
                } else { 
                   if (currentCatCount >= maxCategoryQty) return; 
                   newComplements.push({
                      categoryId: category.id,
                      categoryName: category.name,
                      itemId: item.id,
                      name: item.name,
                      price: item.price,
                      quantity: 1
                   });
                }
             }
             setSelectedComplements(newComplements);
          }}
          onConfirm={() => {
             addToCart(complementsProduct, complementsQuantity, selectedComplements);
             setComplementsProduct(null);
          }}
        />
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Finalizar Venda</h2>
              <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex border-b">
                <button 
                    onClick={() => setOrderType('BALCAO')}
                    className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider ${orderType === 'BALCAO' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-400'}`}
                >
                    Retirada / Viagem
                </button>
                <button 
                    onClick={() => setOrderType('ENTREGA')}
                    className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider ${orderType === 'ENTREGA' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-400'}`}
                >
                    Entrega
                </button>
                <button 
                    onClick={() => setOrderType('COMANDA')}
                    className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider ${orderType === 'COMANDA' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-400'}`}
                >
                    Comanda
                </button>
                <button 
                    onClick={() => setOrderType('MESA')}
                    className={`flex-1 py-4 font-bold text-sm uppercase tracking-wider ${orderType === 'MESA' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-gray-50 text-gray-400'}`}
                >
                    Mesa
                </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <input 
                      type="checkbox" 
                      id="autoFinalize"
                      checked={isAutoFinalize}
                      onChange={e => setIsAutoFinalize(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="autoFinalize" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                      Finalizar Automaticamente (Marcar como Entregue)
                  </label>
              </div>

              <div className="space-y-2 relative">
                <label className="text-xs font-bold text-gray-500 uppercase">Vincular Cliente (Opcional)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={selectedCustomer ? `${selectedCustomer.name} (${(selectedCustomer.points || 0).toFixed(2)} R$)` : customerSearchTerm}
                    onChange={e => {
                      setCustomerSearchTerm(e.target.value);
                      setSelectedCustomer(null);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-10 pr-10 p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 outline-none"
                    placeholder="Buscar cliente por nome, telefone ou CPF..."
                  />
                  {selectedCustomer && (
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearchTerm('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  )}
                  {showCustomerDropdown && !selectedCustomer && customerSearchTerm && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {customers
                        .filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || c.phone.includes(customerSearchTerm) || (c.cpf && c.cpf.includes(customerSearchTerm)))
                        .map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearchTerm('');
                              setShowCustomerDropdown(false);
                              if (orderType === 'ENTREGA' || orderType === 'BALCAO') {
                                setDeliveryDetails(prev => ({
                                  ...prev,
                                  customerName: c.name,
                                  customerPhone: c.phone,
                                  customerCpf: c.cpf || '',
                                  address: c.address || ''
                                }));
                              }
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex justify-between items-center"
                          >
                            <div>
                              <div className="font-bold text-gray-800">{c.name}</div>
                              <div className="text-xs text-gray-500">{c.phone}</div>
                            </div>
                            <div className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                              {(c.points || 0).toFixed(2)} R$
                            </div>
                          </button>
                        ))}
                      <button
                        onClick={() => {
                          setNewCustomerPhone('+55');
                          setShowNewCustomerModal(true);
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-center px-4 py-2 text-blue-600 font-bold hover:bg-blue-50 border-t"
                      >
                        + Cadastrar novo cliente
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {(orderType === 'COMANDA' || orderType === 'MESA') && (
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-4">
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-blue-700 uppercase">
                              {orderType === 'COMANDA' ? 'Número da Comanda' : 'Número da Mesa'}
                          </label>
                          <div className="relative">
                              {orderType === 'COMANDA' ? <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} /> : <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />}
                              <input 
                                  type="number" 
                                  value={commandNumber}
                                  onChange={e => setCommandNumber(e.target.value)}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none text-lg font-bold"
                                  placeholder="000"
                                  autoFocus
                              />
                          </div>
                      </div>
                  </div>
              )}

              {orderType === 'ENTREGA' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-blue-700 uppercase">Cliente</label>
                          <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="text" 
                                  value={deliveryDetails.customerName}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, customerName: e.target.value})}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="Nome do Cliente"
                              />
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-blue-700 uppercase">Telefone</label>
                          <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="text" 
                                  value={deliveryDetails.customerPhone}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, customerPhone: e.target.value})}
                                  onBlur={e => {
                                      let val = e.target.value.trim();
                                      if (val && !val.startsWith('+55') && !val.startsWith('55')) {
                                          val = '+55' + val;
                                      } else if (val.startsWith('55')) {
                                          val = '+' + val;
                                      }
                                      setDeliveryDetails({...deliveryDetails, customerPhone: val});
                                  }}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="(00) 00000-0000"
                              />
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-blue-700 uppercase">CPF (NFC-e)</label>
                          <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="text" 
                                  value={deliveryDetails.customerCpf || ''}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, customerCpf: e.target.value})}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="CPF do Cliente"
                              />
                          </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-blue-700 uppercase">Endereço de Destino</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                                <input 
                                    type="text" 
                                    value={deliveryDetails.address}
                                    onChange={e => setDeliveryDetails({...deliveryDetails, address: e.target.value})}
                                    className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                    placeholder="Endereço completo"
                                />
                            </div>
                            {settings.isDeliveryFeeActive && (
                              <button 
                                onClick={calculateDeliveryFee}
                                disabled={isCalculatingFee || !deliveryDetails.address.trim()}
                                className="px-4 py-3 bg-blue-100 text-blue-700 rounded-xl font-bold text-xs uppercase tracking-widest border border-blue-200 disabled:opacity-50 whitespace-nowrap"
                              >
                                {isCalculatingFee ? '...' : 'Consultar Taxa'}
                              </button>
                            )}
                          </div>
                      </div>
                      
                      <div className="space-y-1 md:col-span-2 bg-white p-3 rounded-xl border border-blue-100">
                          <div className="flex items-center gap-2 mb-2">
                              <input 
                                  type="checkbox" 
                                  id="useStoreOrigin"
                                  checked={deliveryDetails.useStoreOrigin}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, useStoreOrigin: e.target.checked})}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                              />
                              <label htmlFor="useStoreOrigin" className="text-xs font-bold text-blue-800 cursor-pointer">
                                  Origem é o endereço da loja
                              </label>
                          </div>
                          
                          {!deliveryDetails.useStoreOrigin && (
                              <div className="relative mt-2">
                                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                                  <input 
                                      type="text" 
                                      value={deliveryDetails.originAddress}
                                      onChange={e => setDeliveryDetails({...deliveryDetails, originAddress: e.target.value})}
                                      className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                      placeholder="Endereço de origem"
                                  />
                              </div>
                          )}
                      </div>

                      <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-blue-700 uppercase">Ponto de Referência</label>
                          <div className="relative">
                              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="text" 
                                  value={deliveryDetails.referencePoint}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, referencePoint: e.target.value})}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="Ponto de referência"
                              />
                          </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-blue-700 uppercase">Entregador (Opcional)</label>
                          <div className="relative">
                              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <select 
                                  value={deliveryDetails.driverId}
                                  onChange={e => setDeliveryDetails({...deliveryDetails, driverId: e.target.value})}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                              >
                                  <option value="">Em Aberto (Qualquer Entregador)</option>
                                  {couriers.map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-blue-700 uppercase">Taxa de Entrega (R$)</label>
                          <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                              <input 
                                  type="number" 
                                  step="0.01"
                                  min="0"
                                  value={deliveryFee || ''}
                                  onChange={e => {
                                      const val = parseFloat(e.target.value);
                                      setDeliveryFee(isNaN(val) ? 0 : val);
                                  }}
                                  className="w-full pl-10 p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none"
                                  placeholder="0.00"
                              />
                          </div>
                      </div>
                      <div className="space-y-1 md:col-span-2 flex items-center gap-2 mt-2">
                          <input 
                              type="checkbox" 
                              id="payOnDelivery"
                              checked={deliveryDetails.payOnDelivery}
                              onChange={e => setDeliveryDetails({...deliveryDetails, payOnDelivery: e.target.checked})}
                              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                          />
                          <label htmlFor="payOnDelivery" className="text-sm font-bold text-blue-800 cursor-pointer">
                              Pagar no ato da entrega
                          </label>
                      </div>
                  </div>
              )}

              <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                      <div className="text-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Total a Pagar</p>
                        <p className="text-3xl font-black text-gray-900">{formatCurrency(total)}</p>
                        <p className="text-xs text-red-500 font-bold mt-1">Restante: {formatCurrency(remaining)}</p>
                        
                        {settings.isCashbackActive && selectedCustomer && selectedCustomer.points > 0 && selectedCustomer.points >= (settings.minCashbackToUse || 0) && remaining > 0 && (
                            <button 
                                onClick={handleUseCashback}
                                className="mt-3 w-full flex items-center justify-center gap-2 p-2 bg-orange-100 text-orange-700 rounded-xl border border-orange-200 hover:bg-orange-200 transition-colors text-sm font-bold"
                            >
                                <Award size={16} />
                                Usar Cashback: {formatCurrency(selectedCustomer.points)}
                            </button>
                        )}
                      </div>

                      <div className="space-y-2">
                          {orderType === 'ENTREGA' && deliveryDetails.payOnDelivery ? (
                              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm font-bold text-center">
                                  Pagamento será realizado no ato da entrega.
                              </div>
                          ) : (
                              <>
                                  <label className="text-xs font-bold text-gray-500 uppercase">Adicionar Pagamento</label>
                                  <div className="flex gap-2">
                                      <input 
                                          type="number" 
                                          value={currentPaymentAmount}
                                          onChange={e => setCurrentPaymentAmount(e.target.value)}
                                          className="flex-1 p-3 rounded-xl border border-gray-200 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                          placeholder="Valor"
                                      />
                                      <select 
                                          value={currentPaymentMethod}
                                          onChange={e => setCurrentPaymentMethod(e.target.value as PaymentMethod)}
                                          className="p-3 rounded-xl border border-gray-200 font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                      >
                                          <option value="DINHEIRO">Dinheiro</option>
                                          <option value="CARTAO">Cartão</option>
                                          <option value="DEBITO">Débito</option>
                                          <option value="VALES">Vales</option>
                                          <option value="PIX">Pix</option>
                                          {settings.isOnlinePaymentActive && (
                                              <option value="ONLINE">Pagamento Online</option>
                                          )}
                                          {settings.onlinePaymentProvider === 'mercado_pago' && settings.mercadoPagoPointDeviceId && (
                                              <option value="MAQUININHA">Maquininha Point</option>
                                          )}
                                      </select>
                                      <button 
                                          onClick={currentPaymentMethod === 'MAQUININHA' ? handlePointPayment : (currentPaymentMethod === 'ONLINE' && !onlineCheckoutUrl ? handleOnlinePayment : handleAddPayment)}
                                          disabled={isPointProcessing || isOnlineProcessing}
                                          className={`p-3 text-white rounded-xl ${isPointProcessing || isOnlineProcessing ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                                      >
                                          {isPointProcessing || isOnlineProcessing ? <Loader2 className="animate-spin" size={20} /> : (currentPaymentMethod === 'ONLINE' && !onlineCheckoutUrl ? <Zap size={20} /> : <Plus size={20} />)}
                                      </button>
                                  </div>

                                  {isOnlineProcessing && (
                                      <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3 animate-pulse">
                                          <Loader2 className="animate-spin text-green-600" size={20} />
                                          <span className="text-sm font-bold text-green-800">Gerando link de pagamento...</span>
                                      </div>
                                  )}

                                  {currentPaymentMethod === 'ONLINE' && onlineCheckoutUrl && (
                                      <div className="p-3 bg-green-50 rounded-xl border border-green-100 space-y-2">
                                          <div className="flex justify-between items-center">
                                              <span className="text-xs font-bold text-green-800 uppercase tracking-widest">Link de Pagamento Ativo</span>
                                              <button onClick={() => setOnlineCheckoutUrl(null)} className="text-red-500 hover:text-red-700">
                                                  <X size={14} />
                                              </button>
                                          </div>
                                          <button 
                                              onClick={() => window.open(onlineCheckoutUrl, '_blank')}
                                              className="w-full py-2 bg-white border border-green-200 text-green-700 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                                          >
                                              <Globe size={14} /> Abrir Link Novamente
                                          </button>
                                          <p className="text-[10px] text-green-600 italic">* Após receber a confirmação no celular do cliente, clique no botão (+) acima para confirmar no PDV.</p>
                                      </div>
                                  )}

                                  {isPointProcessing && (
                                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3 animate-pulse">
                                          <Loader2 className="animate-spin text-blue-600" size={20} />
                                          <span className="text-sm font-bold text-blue-800">{pointStatus}</span>
                                      </div>
                                  )}
                                  
                                  {currentPaymentMethod === 'MAQUININHA' && !isPointProcessing && (
                                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800">
                                          <p className="font-bold uppercase">Integração Mercado Pago Point</p>
                                          <p>Ao clicar no botão (+), o valor será enviado automaticamente para a maquininha vinculada.</p>
                                      </div>
                                  )}
                                  
                                  {currentPaymentMethod === 'CARTAO' && currentPaymentAmount && !isNaN(parseFloat(currentPaymentAmount)) && (
                                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-1">
                                          <p className="font-bold uppercase">Simulação de Parcelamento</p>
                                          <div className="grid grid-cols-3 gap-2">
                                              {[1, 2, 3, 4, 5, 6].map(i => (
                                                  <div key={i} className="bg-white p-1 rounded border border-blue-100 text-center">
                                                      <span className="font-bold">{i}x</span> {formatCurrency(parseFloat(currentPaymentAmount) / i)}
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  )}
                              </>
                          )}
                      </div>

                      {currentPaymentMethod === 'PIX' && (!orderType || orderType !== 'ENTREGA' || !deliveryDetails.payOnDelivery) && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col items-center gap-4 text-center">
                          {settings.pixQrCodeUrl ? (
                            <img src={settings.pixQrCodeUrl || undefined} alt="QR Pix" className="w-48 h-48 object-contain mix-blend-multiply bg-white p-2 rounded-xl shadow-sm" />
                          ) : (
                            <QrCode size={48} className="text-gray-400" />
                          )}
                          <div className="flex-1">
                              <p className="text-sm font-bold text-gray-700">QR Code Pix</p>
                              <p className="text-xs text-gray-500">Escaneie para pagar</p>
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-200 h-64 overflow-y-auto">
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Pagamentos Lançados</h3>
                      {payments.length === 0 ? (
                          <p className="text-center text-gray-400 text-sm mt-10">Nenhum pagamento adicionado</p>
                      ) : (
                          <div className="space-y-2">
                              {payments.map((p, i) => (
                                  <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                                      <div className="flex items-center gap-2">
                                          {p.method === 'DINHEIRO' && <Banknote size={16} className="text-green-600" />}
                                          {p.method === 'CARTAO' && <CreditCard size={16} className="text-blue-600" />}
                                          {p.method === 'DEBITO' && <CreditCard size={16} className="text-blue-400" />}
                                          {p.method === 'VALES' && <Ticket size={16} className="text-orange-600" />}
                                          {p.method === 'PIX' && <QrCode size={16} className="text-purple-600" />}
                                          {p.method === 'CASHBACK' && <Award size={16} className="text-orange-500" />}
                                          {p.method === 'MAQUININHA' && <Zap size={16} className="text-blue-600" />}
                                          <span className="font-bold text-sm">{p.method === 'CASHBACK' ? 'CASHBACK' : p.method}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <span className="font-bold">{formatCurrency(p.amount)}</span>
                                          <button onClick={() => handleRemovePayment(i)} className="text-red-400 hover:text-red-600">
                                              <Trash2 size={14} />
                                          </button>
                                      </div>
                                  </div>
                              ))}
                              {change > 0 && (
                                  <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100">
                                      <span className="font-bold text-green-700 text-sm">Troco</span>
                                      <span className="font-black text-green-700">{formatCurrency(change)}</span>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>

            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-2">
              <button 
                onClick={handleCheckout}
                disabled={isProcessing || remaining > 0.01}
                className="flex-1 py-4 bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <CheckCircle2 size={24} />}
                Finalizar Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery/Counter Orders Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex flex-col gap-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    {lookupType === 'ENTREGA' ? <Truck size={24} className="text-purple-600" /> : 
                     lookupType === 'BALCAO' ? <ShoppingBag size={24} className="text-blue-600" /> :
                     lookupType === 'MESA' ? <Hash size={24} className="text-orange-600" /> :
                     <Tag size={24} className="text-blue-600" />}
                    {lookupType === 'ENTREGA' ? 'Entregas Pendentes' : 
                     lookupType === 'BALCAO' ? 'Pedidos Retirada / Viagem Pendentes' :
                     lookupType === 'MESA' ? 'Mesas Pendentes' : 'Comandas Pendentes'}
                </h2>
                <button onClick={() => setShowDeliveryModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X size={24} />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar por código (#1234) ou nome..." 
                    value={deliverySearchTerm}
                    onChange={(e) => setDeliverySearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700"
                    autoFocus
                />
              </div>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {(() => {
                    const filteredList = deliveryOrdersList.filter(o => {
                        if (!deliverySearchTerm) return true;
                        const term = deliverySearchTerm.toLowerCase();
                        return (
                            (o.displayId && String(o.displayId).includes(term)) || 
                            (o.customerName && o.customerName.toLowerCase().includes(term)) ||
                            (o.tableNumber && String(o.tableNumber).includes(term)) ||
                            (o.id && String(o.id).includes(term))
                        );
                    });

                    if (filteredList.length === 0) {
                        return <p className="text-center text-gray-500 py-10">Nenhum pedido encontrado.</p>;
                    }

                    let displayList: any[] = [];
                    if (lookupType === 'MESA' || lookupType === 'COMANDA') {
                        const grouped = new Map<string, Order[]>();
                        filteredList.forEach(o => {
                            const key = o.tableNumber || o.id;
                            if (!grouped.has(key)) grouped.set(key, []);
                            grouped.get(key)!.push(o);
                        });
                        displayList = Array.from(grouped.values()).map(orders => {
                            if (orders.length === 1) return orders[0];
                            const mergedOrder = { ...orders[0] } as any;
                            mergedOrder.items = orders.flatMap(o => o.items || []);
                            mergedOrder.total = orders.reduce((sum, o) => sum + (o.total || 0), 0);
                            mergedOrder._isGrouped = true;
                            mergedOrder._groupedIds = orders.map(o => o.id);
                            return mergedOrder;
                        });
                    } else {
                        displayList = filteredList;
                    }

                    return displayList.map(order => (
                        <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        order.type === 'ENTREGA' ? 'bg-purple-100 text-purple-700' : 
                                        order.type === 'BALCAO' ? 'bg-blue-100 text-blue-700' :
                                        order.type === 'MESA' ? 'bg-orange-100 text-orange-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                        {(order.type === 'MESA' || order.type === 'COMANDA') && order.tableNumber ? 
                                            `${order.type === 'MESA' ? 'Mesa' : 'Comanda'} ${order.tableNumber}` : 
                                            `#${order.displayId || String(order.id || '').slice(0,8)}`}
                                    </span>
                                    <span className="text-xs text-gray-400 font-bold">
                                        {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : '--:--'}
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-gray-100 text-gray-600">
                                        {order.status.replace(/_/g, ' ')}
                                    </span>
                                    {order.deliveryDriverId && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-yellow-100 text-yellow-700 flex items-center gap-1">
                                            <Truck size={10} />
                                            {couriers.find(c => c.id === order.deliveryDriverId)?.name || 'Entregador'}
                                            {couriers.find(c => c.id === order.deliveryDriverId)?.phone && (
                                              <a 
                                                href={`https://wa.me/55${couriers.find(c => c.id === order.deliveryDriverId)?.phone?.replace(/\D/g, '')}`}
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="ml-1 text-green-600 hover:text-green-700 hover:scale-110 transition-transform"
                                                onClick={e => e.stopPropagation()}
                                                title="WhatsApp do Entregador"
                                              >
                                                <MessageCircle size={12} />
                                              </a>
                                            )}
                                        </span>
                                    )}
                                </div>
                                {((order.type !== 'MESA' && order.type !== 'COMANDA') || order.customerName) && (
                                    <h3 className="font-bold text-gray-800">{order.customerName || 'Cliente sem nome'}</h3>
                                )}
                                {order.type === 'ENTREGA' && (
                                  <>
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <Phone size={12} /> {order.customerPhone || 'Sem telefone'}
                                        {order.customerPhone && (
                                            <a 
                                                href={`https://wa.me/${order.customerPhone.replace(/\D/g, '')}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="ml-2 text-green-500 hover:text-green-600"
                                                title="Abrir WhatsApp"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <MessageCircle size={14} />
                                            </a>
                                        )}
                                    </p>
                                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                        <MapPin size={12} /> {order.deliveryAddress || 'Retirada'}
                                    </p>
                                    {order.referencePoint && (
                                        <p className="text-xs text-gray-400 italic mt-1 ml-4">
                                            Ref: {order.referencePoint}
                                        </p>
                                    )}
                                  </>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(order.items || []).slice(0, 3).map((item: any, idx: number) => (
                                        item ? (
                                            <span key={idx} className="bg-gray-50 text-gray-600 px-2 py-1 rounded text-xs font-medium border border-gray-100">
                                                {item.quantity}x {item.name}
                                            </span>
                                        ) : null
                                    ))}
                                    {(order.items || []).length > 3 && (
                                        <span className="text-xs text-gray-400 self-center">+{order.items.length - 3} itens</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end justify-between gap-4 min-w-[120px]">
                                <span className="text-xl font-black text-gray-900">{formatCurrency(order.total || 0)}</span>
                                <div className="flex flex-col gap-2 w-full">
                                    <button 
                                        onClick={() => {
                                            if (lookupType === 'MESA' || lookupType === 'COMANDA') {
                                                lookupCommand(order.tableNumber || '', lookupType);
                                            } else {
                                                loadOrderFromList(order);
                                            }
                                        }}
                                        className={`w-full py-2 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
                                            order.type === 'ENTREGA' ? 'bg-purple-600 hover:bg-purple-700' : 
                                            order.type === 'BALCAO' ? 'bg-blue-600 hover:bg-blue-700' :
                                            order.type === 'MESA' ? 'bg-orange-600 hover:bg-orange-700' :
                                            'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                    >
                                        <CheckCircle2 size={16} />
                                        Selecionar
                                    </button>
                                    <button 
                                        disabled={isProcessing}
                                        onClick={async () => {
                                            if(window.confirm((order as any)._isGrouped ? 'Tem certeza que deseja cancelar TODOS os pedidos desta mesa/comanda?' : 'Tem certeza que deseja cancelar este pedido?')) {
                                                try {
                                                    if ((order as any)._isGrouped) {
                                                        for (const id of (order as any)._groupedIds) {
                                                            await updateStatus(id, 'CANCELADO');
                                                        }
                                                    } else {
                                                        await updateStatus(order.id, 'CANCELADO');
                                                    }
                                                        
                                                    // Refresh the list
                                                    lookupOrdersList(lookupType);
                                                } catch (err) {
      console.error("Erro ao cancelar pedido:", err);
                                                    alert("Erro ao cancelar pedido.");
                                                }
                                            }
                                        }}
                                        className={`w-full py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`}
                                    >
                                        <X size={16} />
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ));
                })()}
            </div>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {isClosingRegister && dailySales && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <DollarSign size={24} className="text-green-600" />
                    Fechamento de Caixa
                </h2>
                
                <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                        <span className="text-gray-600 font-medium">Vendas Hoje</span>
                        <span className="font-bold text-xl">{dailySales.count}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl text-blue-800">
                        <span className="font-medium">Total Bruto</span>
                        <span className="font-black text-2xl">{formatCurrency(dailySales.total)}</span>
                    </div>
                    
                    <div className="border-t pt-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Por Método</p>
                        <div className="space-y-2">
                            {Object.entries(dailySales.byMethod).map(([method, amount]) => (
                                <div key={method} className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-600">{method}</span>
                                    <span className="font-bold">{formatCurrency(amount as number)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-orange-50 text-orange-800 rounded-xl">
                        <span className="font-medium">Total Sangrias</span>
                        <span className="font-bold text-lg">- {formatCurrency(dailySales.bleeds)}</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-gray-50 text-gray-800 rounded-xl">
                        <span className="font-medium">Troco Inicial</span>
                        <span className="font-bold text-lg">{formatCurrency(currentSession?.initial_amount || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-green-50 text-green-800 rounded-xl border border-green-100">
                        <span className="font-bold uppercase">Total em Caixa</span>
                        <span className="font-bold text-xl">{formatCurrency(dailySales.total - dailySales.bleeds + (currentSession?.initial_amount || 0))}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsClosingRegister(false)}
                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmCloseRegister}
                        className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 flex items-center justify-center gap-2"
                    >
                        <DollarSign size={18} /> Confirmar Fechamento
                    </button>
                    <button 
                        onClick={printDailyReport}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        <Printer size={18} /> Imprimir
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Opening Register Modal */}
      {isOpeningRegister && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <DollarSign size={24} className="text-green-600" />
              Abertura de Caixa
            </h2>
            <p className="text-gray-600 mb-4 text-sm">Informe o valor de troco inicial para abrir o caixa.</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Troco Inicial (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={initialAmount}
                  onChange={e => setInitialAmount(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 font-bold"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={onLogout}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                Sair
              </button>
              <button 
                onClick={handleOpenRegister}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <DollarSign size={18} /> Abrir Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bleed Modal */}
      {isBleedModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-orange-600 mb-6 flex items-center gap-2">
                <Minus size={24} />
                Realizar Sangria
            </h2>
            
            <div className="space-y-4 mb-6">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                  <input 
                      type="number" 
                      value={bleedAmount}
                      onChange={e => setBleedAmount(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-orange-500 font-bold text-lg"
                      placeholder="0.00"
                      autoFocus
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Descrição</label>
                  <input 
                      type="text" 
                      value={bleedReason}
                      onChange={e => setBleedReason(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Ex: Pagamento fornecedor, retirada..."
                  />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsBleedModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button 
                onClick={handleBleed}
                className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {showNewCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Novo Cliente</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Nome" className="w-full p-3 border rounded-xl" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
              <input type="text" placeholder="Telefone" className="w-full p-3 border rounded-xl" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
              <input type="text" placeholder="CPF" className="w-full p-3 border rounded-xl" value={newCustomerCpf} onChange={(e) => setNewCustomerCpf(e.target.value)} />
              <input type="text" placeholder="Endereço" className="w-full p-3 border rounded-xl" value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} />
              <input type="number" placeholder="Cashback Acumulado" className="w-full p-3 border rounded-xl" value={newCustomerCashbackBalance} onChange={(e) => setNewCustomerCashbackBalance(parseFloat(e.target.value) || 0)} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newCustomerCashbackParticipant} onChange={(e) => setNewCustomerCashbackParticipant(e.target.checked)} className="w-5 h-5" />
                Participa do Programa de Cashback
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowNewCustomerModal(false)} className="flex-1 py-3 bg-gray-200 rounded-xl font-bold">Cancelar</button>
              <button onClick={handleSaveNewCustomer} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
