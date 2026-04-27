
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  X, 
  ChevronLeft, 
  Plus as PlusIcon, 
  Minus as MinusIcon, 
  CheckCircle, 
  Loader2, 
  Search, 
  MapPin, 
  ExternalLink, 
  Send, 
  Flame, 
  Utensils, 
  ShoppingBag, 
  Truck, 
  MessageCircle, 
  AlertCircle,  Store, 
  Scale,
  AlertTriangle,
  Power,
  Info,
  Phone,
  Navigation,
  ArrowRight,
  ShieldCheck,
  Tag,
  Check,
  Wallet,
  CreditCard,
  Banknote,
  DollarSign,
  Hash,
  UserRound,
  ArrowLeft,
  Award,
  Globe,
  Clock,
  QrCode,
  CheckCircle2,
  Percent
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Product, StoreSettings, Order, OrderItem, OrderType, PaymentMethod, Waitstaff, CartComplementItem, ComplementCategory } from '../types';
import InstallPrompt from '../components/InstallPrompt';
import { ComplementsModal } from '../components/ComplementsModal';

interface Props {
  storeId?: string;
  products: Product[];
  categories: string[];
  settings: StoreSettings;
  orders: Order[];
  addOrder: (order: Order) => Promise<void | boolean>;
  tableNumber: string | null;
  onLogout: () => void;
  onCloseMenu?: () => void;
  isWaitstaff?: boolean;
  ecosystemUsage?: { ordersThisMonth: number; productsCount: number; usersCount: number; };
  refreshEcosystemUsage?: () => Promise<void>;
}

const DigitalMenu: React.FC<Props> = ({ storeId, products, categories: externalCategories, settings, addOrder, tableNumber: initialTable, onLogout, onCloseMenu, isWaitstaff: initialIsWaitstaff = false, ecosystemUsage, refreshEcosystemUsage }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTable = searchParams.get('mesa');
  const urlType = searchParams.get('tipo');
  const urlModo = searchParams.get('modo'); // 'local' | 'externo'
  const storeSlug = searchParams.get('loja');
  const paymentStatus = searchParams.get('payment');
  const paymentOrderId = searchParams.get('orderId');
  
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(!!paymentStatus);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details' | 'success'>(paymentStatus ? 'success' : 'cart');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [generatedDisplayId, setGeneratedDisplayId] = useState<string | null>(null);
  const [generatedPix, setGeneratedPix] = useState<{qr_code: string, qr_code_base64: string} | null>(null);
  
  const [weightProduct, setWeightProduct] = useState<Product | null>(null);
  const [selectedWeightGrams, setSelectedWeightGrams] = useState<string>("");

  const [fractionalProduct, setFractionalProduct] = useState<Product | null>(null);
  const [selectedFractions, setSelectedFractions] = useState<(Product | null)[]>([]);

  const [complementsProduct, setComplementsProduct] = useState<Product | null>(null);
  const [selectedComplements, setSelectedComplements] = useState<CartComplementItem[]>([]);
  const [complementsQuantity, setComplementsQuantity] = useState<number>(1);

  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingPhone, setTrackingPhone] = useState('');
  const [trackedOrders, setTrackedOrders] = useState<Order[]>([]);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  const getPromotionalPrice = (product: Product, customBasePrice?: number) => {
    const base = customBasePrice !== undefined ? customBasePrice : product.price;
    if (!settings?.isCouponActive || base <= 0) return null;
    const isApplicable = settings.isCouponForAllProducts || settings.applicableProductIds?.includes(product.id);
    if (!isApplicable || !settings.couponDiscount || settings.couponDiscount <= 0) return null;
    return base * (1 - settings.couponDiscount / 100);
  };

  const getPromotionalDiscountPercentage = (product: Product) => {
    if (!settings?.isCouponActive) return null;
    const isApplicable = settings.isCouponForAllProducts || settings.applicableProductIds?.includes(product.id);
    if (!isApplicable || !settings.couponDiscount || settings.couponDiscount <= 0) return null;
    return settings.couponDiscount;
  };

  useEffect(() => {
    if (checkoutStep === 'success') {
      const timer = setTimeout(() => {
        setIsCartOpen(false);
        setCheckoutStep('cart');
        // Clear params from URL if they exist
        if (paymentStatus || paymentOrderId) {
          const url = new URL(window.location.href);
          url.searchParams.delete('status');
          url.searchParams.delete('order_id');
          window.history.replaceState({}, '', url.toString());
        }
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [checkoutStep, paymentStatus, paymentOrderId]);

  useEffect(() => {
    if (paymentStatus && paymentOrderId) {
      // Update order in database based on payment status
      const updatePaymentStatus = async () => {
        try {
          const { data: currentOrder } = await supabase.from('orders').select('total, status').eq('id', paymentOrderId).single();
          if (!currentOrder) return;
          
          const amount = currentOrder.total;

          if (paymentStatus === 'success' && currentOrder.status === 'AGUARDANDO_PAGAMENTO') {
            await supabase.from('orders').eq('id', paymentOrderId).update({ 
               status: 'PAGO',
               paymentDetails: JSON.stringify([{ method: 'ONLINE', status: 'approved', amount }]) 
            });
          } else if (paymentStatus === 'failure' && currentOrder.status === 'AGUARDANDO_PAGAMENTO') {
            await supabase.from('orders').eq('id', paymentOrderId).update({ 
               status: 'CANCELADO',
               paymentDetails: JSON.stringify([{ method: 'ONLINE', status: 'rejected', amount }]) 
            });
          }
        } catch (error) {
          console.error('Erro ao atualizar status do pagamento:', error);
        }
      };
      updatePaymentStatus();
    }
  }, [paymentStatus, paymentOrderId]);

  const effectiveTable = initialTable || urlTable || null;
  const isStoreClosed = settings.isStoreOpen === false;

  const [isWaitstaff, setIsWaitstaff] = useState(initialIsWaitstaff || !!localStorage.getItem('gc-conveniencia-session-v1'));

  const [hasSelectedMode, setHasSelectedMode] = useState(() => {
    if (urlType && ['BALCAO', 'ENTREGA', 'MESA', 'COMANDA'].includes(urlType)) return true;
    if (isWaitstaff) return true;
    if (effectiveTable && settings.isTableOrderActive) return true;
    
    if (urlModo === 'local') {
        if (settings.isTableOrderActive && settings.isCommandOrderActive === false) return true;
        if (!settings.isTableOrderActive && settings.isCommandOrderActive !== false) return true;
    }
    if (urlModo === 'externo') {
        if (settings.isCounterPickupActive && !settings.isDeliveryActive) return true;
        if (!settings.isCounterPickupActive && settings.isDeliveryActive) return true;
    }
    
    return false;
  });
  
  const [orderType, setOrderType] = useState<OrderType>(() => {
    if (urlType === 'BALCAO' && settings.isCounterPickupActive) return 'BALCAO';
    if (urlType === 'ENTREGA' && settings.isDeliveryActive) return 'ENTREGA';
    if (urlType === 'COMANDA') return 'COMANDA';
    if (effectiveTable && settings.isTableOrderActive) return 'MESA';
    
    if (urlModo === 'local') {
        if (settings.isTableOrderActive && settings.isCommandOrderActive === false) return 'MESA';
        if (!settings.isTableOrderActive && settings.isCommandOrderActive !== false) return 'COMANDA';
    }
    if (urlModo === 'externo') {
        if (settings.isCounterPickupActive && !settings.isDeliveryActive) return 'BALCAO';
        if (!settings.isCounterPickupActive && settings.isDeliveryActive) return 'ENTREGA';
    }
    
    return isWaitstaff ? 'MESA' : 'BALCAO';
  });

  useEffect(() => {
    if (isWaitstaff && !urlType && !effectiveTable && orderType === 'BALCAO') {
        setOrderType('MESA');
    }
  }, [isWaitstaff, urlType, effectiveTable, orderType]);

  const handleResetMode = () => {
    if (urlType || effectiveTable) return; // Don't reset if locked by URL
    
    // Don't reset if urlModo locks to a single option
    if (urlModo === 'local' && (!settings.isTableOrderActive || settings.isCommandOrderActive === false)) return;
    if (urlModo === 'externo' && (!settings.isCounterPickupActive || !settings.isDeliveryActive)) return;
    
    setHasSelectedMode(false);
    setCheckoutStep('cart');
    setIsCartOpen(false);
  };

  const [manualTable, setManualTable] = useState(effectiveTable || '');
  const [payment, setPayment] = useState<PaymentMethod | 'CASHBACK' | ''>('');
  const [combinedPayment, setCombinedPayment] = useState<PaymentMethod | ''>('');
  const [changeFor, setChangeFor] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPoints, setCustomerPoints] = useState<number>(0);
  const [useCashback, setUseCashback] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [referencePoint, setReferencePoint] = useState('');
  const [isConsulting, setIsConsulting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const showAlert = (msg: string) => setErrorMsg(msg);
  const showSuccessAlert = (msg: string) => setSuccessMsg(msg);
  
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [isFeeConfirmed, setIsFeeConfirmed] = useState(false);
  
  const [activeWaitstaff, setActiveWaitstaff] = useState<Waitstaff | null>(null);

  const handleConsultCustomer = async () => {
      if (!customerPhone.trim() || !storeId) return;
      setIsConsulting(true);
      try {
          const { data, error } = await supabase
              .from('customers')
              .select('*')
              .eq('store_id', storeId)
              .eq('phone', customerPhone.trim());
              
          if (data && data.length > 0) {
              const customer = data[0];
              setCustomerName(customer.name || '');
              setDeliveryAddress(customer.address || '');
              setReferencePoint(customer.referencePoint || '');
              setCustomerId(customer.id);
              setCustomerPoints(customer.points || 0);
              showSuccessAlert('Cadastro encontrado! Dados preenchidos.');
              
              if (orderType === 'ENTREGA' && customer.address) {
                  calculateDeliveryFee(customer.address);
              }
          } else {
              showAlert('Nenhum cadastro encontrado para este telefone.');
              setCustomerId(null);
              setCustomerPoints(0);
          }
      } catch (err) {
          console.error("Erro ao consultar cliente:", err);
          showAlert('Erro ao consultar cadastro.');
      } finally {
          setIsConsulting(false);
      }
  };

  const calculateDeliveryFee = async (addressOverride?: string) => {
    const targetAddress = addressOverride || deliveryAddress;
    if (!settings.address) {
      if (!addressOverride) alert("Endereço da loja não configurado. Não é possível calcular a taxa.");
      return;
    }
    if (!targetAddress) {
      if (!addressOverride) alert("Preencha seu endereço para calcular a taxa.");
      return;
    }

    setIsCalculatingFee(true);
    try {
      // Geocode Store Address
      const storeRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(settings.address)}&countrycodes=br&limit=1`);
      const storeData = await storeRes.json();
      
      // Geocode Customer Address - Add context from store address to help Nominatim
      const storeParts = settings.address.split(',');
      const cityContext = storeParts.length > 1 ? storeParts[storeParts.length - 1].trim() : '';
      const customerQuery = cityContext ? `${targetAddress}, ${cityContext}` : targetAddress;

      const customerRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(customerQuery)}&countrycodes=br&limit=1`);
      const customerData = await customerRes.json();

      if (storeData.length === 0) {
        if (!addressOverride) showAlert("Não foi possível localizar o endereço da loja.");
        setIsCalculatingFee(false);
        return;
      }
      if (customerData.length === 0) {
        if (!addressOverride) showAlert("Não foi possível localizar o seu endereço. Tente ser mais específico em sua busca.");
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

      setDeliveryDistanceKm(distance);

      if (settings.freeDeliveryToleranceKm && distance <= settings.freeDeliveryToleranceKm) {
        setDeliveryFee(0);
        setIsFeeConfirmed(true);
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
          setIsFeeConfirmed(false); // Require confirmation
        } else {
          showAlert("Endereço fora da área de entrega programada.");
          setDeliveryFee(null);
          setDeliveryDistanceKm(null);
          setIsFeeConfirmed(false);
        }
      } else {
        setDeliveryFee(0);
        setIsFeeConfirmed(true);
      }
    } catch (error) {
      console.error("Error calculating fee:", error);
      alert("Erro ao calcular taxa de entrega. Tente novamente.");
    } finally {
      setIsCalculatingFee(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('gc-conveniencia-session-v1');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            setActiveWaitstaff(parsed);
            setIsWaitstaff(true);
        } catch (e) {
            console.error("Error parsing session in DigitalMenu:", e);
        }
    }
  }, []);

  useEffect(() => {
    if (!customerPhone || customerPhone.length < 8 || !settings.isCashbackActive || !storeId) {
        setCustomerId(null);
        setCustomerPoints(0);
        setUseCashback(false);
        return;
    }

    const timer = setTimeout(async () => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .eq('store_id', storeId)
                .eq('phone', customerPhone)
                .maybeSingle();
            
            if (data && !error) {
                setCustomerId(data.id);
                setCustomerPoints(Number(data.points || 0));
                if (data.name && !customerName) {
                    setCustomerName(data.name);
                }
                if (data.address && !deliveryAddress) {
                    setDeliveryAddress(data.address);
                    if (orderType === 'ENTREGA') {
                        calculateDeliveryFee(data.address);
                    }
                }
            } else {
                setCustomerId(null);
                setCustomerPoints(0);
                setUseCashback(false);
            }
        } catch (e) {
            console.error("Erro ao buscar cliente:", e);
        }
    }, 800);

    return () => clearTimeout(timer);
  }, [customerPhone, storeId, settings.isCashbackActive]);

  const categories = useMemo(() => ['Todos', ...externalCategories], [externalCategories]);
  
  const featuredProducts = useMemo(() => {
    const today = new Date().getDay();
    return products.filter(p => p.featuredDay === today && p.isActive && p.showInMenu !== false);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p.showInMenu === false) return false;
      const matchesCategory = activeCategory === 'Todos' || p.category === activeCategory;
      const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (p.barcode && String(p.barcode).includes(searchTerm));
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchTerm]);

  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(12);
  }, [searchTerm, activeCategory]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 12);
      }
    }, { threshold: 0.1 });

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredProducts, loadMoreRef.current]);

  const handleBack = () => {
    if (onCloseMenu) {
      onCloseMenu();
      return;
    }
    
    // Se for atendente, força a volta para o painel de mesas garantindo o slug
    if (isWaitstaff) {
      const lojaParam = storeSlug ? `?loja=${storeSlug}` : '';
      navigate(`/atendimento${lojaParam}`);
      return;
    }

    setHasSelectedMode(false);
  };

  const handleTrackOrder = async () => {
    if (!trackingPhone) return;
    setIsTrackingLoading(true);
    try {
      const cleanPhone = trackingPhone.replace(/\D/g, '');
      const phoneWithPrefix = cleanPhone.startsWith('55') ? `+${cleanPhone}` : `+55${cleanPhone}`;
      
      const startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday as start of week
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', storeId)
        .in('customerPhone', [cleanPhone, phoneWithPrefix])
        .gte('createdAt', startOfWeek.getTime())
        .order('createdAt', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTrackedOrders(data || []);
    } catch (err) {
      console.error("Error tracking order:", err);
      alert("Erro ao buscar pedidos.");
    } finally {
      setIsTrackingLoading(false);
    }
  };

  const handleReorder = (order: Order) => {
    setCart(prev => {
      const newCart = [...prev];
      order.items.forEach(item => {
        const existing = newCart.find(i => i.productId === item.productId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          newCart.push({ ...item });
        }
      });
      return newCart;
    });
    setIsTrackingModalOpen(false);
    setIsCartOpen(true);
    setCheckoutStep('cart');
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDENTE': return 'Pendente';
      case 'AGUARDANDO_PAGAMENTO': return 'Aguardando Pagamento';
      case 'PAGO': return 'Pago';
      case 'PREPARANDO': return 'Preparando';
      case 'PRONTO': return 'Pronto';
      case 'ENVIADO_PARA_ENTREGA': return 'Saiu para Entrega';
      case 'ENTREGUE': return 'Entregue';
      case 'CANCELADO': return 'Cancelado';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDENTE': return 'bg-yellow-100 text-yellow-800';
      case 'AGUARDANDO_PAGAMENTO': return 'bg-orange-100 text-orange-800';
      case 'PAGO': return 'bg-green-100 text-green-800';
      case 'PREPARANDO': return 'bg-blue-100 text-blue-800';
      case 'PRONTO': return 'bg-green-100 text-green-800';
      case 'ENVIADO_PARA_ENTREGA': return 'bg-purple-100 text-purple-800';
      case 'ENTREGUE': return 'bg-gray-100 text-gray-800';
      case 'CANCELADO': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddToCart = (product: Product, complementsToAdd?: CartComplementItem[], quantityToAdd: number = 1) => {
    if (!product.isActive) return;
    if (product.stock != null && product.stock <= 0) {
      showAlert("Produto sem estoque!");
      return;
    }

    if (product.complements && product.complements.length > 0 && !complementsToAdd && !product.isByWeight) {
      setComplementsProduct(product);
      setSelectedComplements([]);
      setComplementsQuantity(1);
      return;
    }

    if (product.isByWeight) {
      setWeightProduct(product);
      setSelectedWeightGrams("");
      return;
    }

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
      
      if (product.stock != null && (currentQty + quantityToAdd) > product.stock) {
        showAlert(`Estoque insuficiente! Disponível: ${product.stock} un`);
        return prev;
      }

      if (existing) {
        return prev.map(item => item.productId === cartItemId ? { ...item, quantity: item.quantity + quantityToAdd } : item);
      }
      
      return [...prev, { 
        productId: cartItemId, 
        name: itemName, 
        description: product.description,
        price: itemPrice, 
        quantity: quantityToAdd, 
        isByWeight: false,
        isFractional: false,
        originalProductId: product.id,
        complements: complementsToAdd
      }];
    });
  };

  const confirmWeightAddition = () => {
    if (!weightProduct || !selectedWeightGrams) return;
    const grams = parseFloat(selectedWeightGrams.replace(',', '.'));
    if (isNaN(grams) || grams <= 0) {
      showAlert("Por favor, informe um peso válido em gramas.");
      return;
    }
    const quantityKg = grams / 1000;
    const productToAdd = { ...weightProduct };
    
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.productId === productToAdd.id);
      const currentQty = existingIndex > -1 ? prev[existingIndex].quantity : 0;
      
      const promoPrice = getPromotionalPrice(productToAdd);
      const itemPrice = promoPrice !== null ? promoPrice : productToAdd.price;

      if (productToAdd.stock != null && (currentQty + quantityKg) > productToAdd.stock) {
        showAlert(`Estoque insuficiente! Disponível: ${productToAdd.stock.toFixed(3)} KG`);
        return prev;
      }

      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex] = { 
          ...newCart[existingIndex], 
          quantity: newCart[existingIndex].quantity + quantityKg 
        };
        return newCart;
      }
      return [...prev, { 
        productId: productToAdd.id, 
        name: productToAdd.name, 
        description: productToAdd.description,
        price: itemPrice, 
        quantity: quantityKg, 
        isByWeight: true,
        originalProductId: productToAdd.id
      }];
    });
    setWeightProduct(null);
    setSelectedWeightGrams("");
  };

  const updateCartItemQuantity = (productId: string, delta: number) => {
    setCart(prev => {
        return prev.map(item => {
            if (item.productId === productId) {
                const step = item.isByWeight ? 0.050 : 1;
                const newQty = item.quantity + (delta * step);
                
                if (delta > 0) {
                    const product = products.find(p => p.id === productId);
                    if (product && product.stock != null && newQty > product.stock) {
                        showAlert(`Estoque insuficiente! Disponível: ${product.stock} ${product.isByWeight ? 'KG' : 'un'}`);
                        return item;
                    }
                }
                
                return newQty > 0 ? { ...item, quantity: newQty } : null;
            }
            return item;
        }).filter(Boolean) as OrderItem[];
    });
  };

  const { subtotal, cartTotal } = useMemo(() => {
    const sub = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    return { subtotal: sub, cartTotal: sub };
  }, [cart]);

  const commissionRate = (isWaitstaff && (activeWaitstaff?.role === 'ATENDENTE' || activeWaitstaff?.role === 'GERENTE') && settings.waitstaffCommissions?.[activeWaitstaff.id]) || 0;
  const serviceFee = (orderType === 'MESA' || orderType === 'COMANDA') ? cartTotal * (commissionRate / 100) : 0;
  const finalTotal = cartTotal + serviceFee + (orderType === 'ENTREGA' && deliveryFee ? deliveryFee : 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if ((orderType === 'MESA' || orderType === 'COMANDA') && !manualTable) { showAlert(`Informe o número da ${orderType === 'MESA' ? 'mesa' : 'comanda'}.`); return; }
    if (orderType === 'BALCAO' && (!customerName || !customerPhone) && !isWaitstaff) { showAlert('Informe o seu nome e telefone.'); return; }
    if ((orderType === 'MESA' || orderType === 'COMANDA') && !customerPhone && !isWaitstaff) { showAlert('Informe o seu telefone para iniciar/continuar.'); return; }
    if (orderType === 'ENTREGA' && (!customerName || !customerPhone || !deliveryAddress)) { showAlert('Preencha os dados de entrega.'); return; }
    
    // Check for payment method selection (except for waitstaff or table/command orders)
    if (!isWaitstaff && orderType !== 'MESA' && orderType !== 'COMANDA') {
        if (!payment) {
            showAlert('Selecione uma forma de pagamento.');
            return;
        }
        if (payment === 'CASHBACK' && customerPoints < finalTotal && !combinedPayment) {
            showAlert('Selecione uma forma de pagamento para completar o valor.');
            return;
        }
    }

    if (orderType === 'ENTREGA' && settings.isDeliveryFeeActive && !isFeeConfirmed) {
        showAlert('Confirme a taxa de entrega antes de finalizar o pedido.');
        return;
    }

    if (orderType === 'ENTREGA' && settings.minDeliveryOrderValue && cartTotal < settings.minDeliveryOrderValue) {
        showAlert(`O valor mínimo para entrega é R$ ${settings.minDeliveryOrderValue.toFixed(2)}`);
        return;
    }

    setIsSending(true);

    if ((orderType === 'MESA' || orderType === 'COMANDA') && !isWaitstaff) {
        const { data: activeOrdersList } = await supabase
            .from('orders')
            .select('tableNumber, customerPhone, type')
            .eq('store_id', storeId)
            .in('status', ['PENDENTE', 'PREPARANDO', 'PRONTO', 'AGUARDANDO_PAGAMENTO', 'AGUARDANDO', 'ENVIADO_PARA_ENTREGA']);
        
        if (activeOrdersList) {
            const tableOpenOrders = activeOrdersList.filter(o => o.tableNumber === manualTable && o.type === orderType);
            if (tableOpenOrders.length > 0) {
                const tablePhone = tableOpenOrders[0].customerPhone;
                if (tablePhone && tablePhone !== customerPhone.trim()) {
                    showAlert(`Esta ${orderType === 'MESA' ? 'Mesa' : 'Comanda'} já está sendo utilizada por outro cliente. Fale com um atendente.`);
                    setIsSending(false);
                    return;
                }
            } else {
                const phoneOpenOrders = activeOrdersList.filter(o => o.customerPhone === customerPhone.trim());
                if (phoneOpenOrders.length > 0) {
                    const otherTable = phoneOpenOrders[0].tableNumber;
                    const otherType = phoneOpenOrders[0].type === 'MESA' ? 'Mesa' : 'Comanda';
                    showAlert(`Este telefone já está com a ${otherType} ${otherTable} aberta. Feche a anterior para abrir uma nova.`);
                    setIsSending(false);
                    return;
                }
            }
        }
    }

    const orderChangeFor = ((payment === 'DINHEIRO' || (payment === 'CASHBACK' && combinedPayment === 'DINHEIRO')) && changeFor) ? parseFloat(changeFor.replace(',', '.')) : undefined;
    const displayId = Math.floor(1000 + Math.random() * 9000).toString();

    let finalCustomerId = customerId;
    let amountToUse = 0;
    let paymentDetailsArray: any[] = [];

    try {
        if ((orderType === 'ENTREGA' || orderType === 'BALCAO') && customerPhone) {
            // Double check if customer exists to prevent duplicates
            const { data: existingCustomer } = await supabase
                .from('customers')
                .eq('store_id', storeId)
                .eq('phone', customerPhone.trim())
                .maybeSingle();

            if (existingCustomer) {
                finalCustomerId = existingCustomer.id;
                
                // Update customer data if changed
                const updates: any = {};
                let hasUpdates = false;
                
                if (customerName.trim() && existingCustomer.name !== customerName.trim()) {
                    updates.name = customerName.trim();
                    hasUpdates = true;
                }
                if (orderType === 'ENTREGA') {
                    if (deliveryAddress.trim() && existingCustomer.address !== deliveryAddress.trim()) {
                        updates.address = deliveryAddress.trim();
                        hasUpdates = true;
                    }
                    if (referencePoint.trim() && existingCustomer.referencePoint !== referencePoint.trim()) {
                        updates.referencePoint = referencePoint.trim();
                        hasUpdates = true;
                    }
                }
                
                if (hasUpdates) {
                    await supabase.from('customers').eq('id', finalCustomerId).update(updates);
                }
            } else if (!finalCustomerId && customerName.trim()) {
                // Create new customer
                const newCustomerId = crypto.randomUUID();
                const { data, error } = await supabase
                    .from('customers')
                    .insert([{
                        id: newCustomerId,
                        store_id: storeId,
                        name: customerName.trim(),
                        phone: customerPhone.trim(),
                        address: orderType === 'ENTREGA' ? deliveryAddress.trim() : undefined,
                        referencePoint: orderType === 'ENTREGA' ? referencePoint.trim() : undefined,
                        points: 0,
                        isLoyaltyParticipant: true
                    }]);
                
                if (data && data.length > 0 && !error) {
                    finalCustomerId = data[0].id || newCustomerId;
                } else if (!error) {
                    finalCustomerId = newCustomerId;
                }
            }
        }

        if (orderType === 'MESA' || orderType === 'COMANDA') {
            // Do not set payment details for table/command orders as they are paid at the cashier
            paymentDetailsArray = [];
        } else if (payment === 'CASHBACK' && finalCustomerId && customerPoints > 0) {
            amountToUse = Math.min(customerPoints, finalTotal);
            paymentDetailsArray.push({ method: 'CASHBACK', amount: amountToUse });
            if (amountToUse < finalTotal) {
                paymentDetailsArray.push({ method: combinedPayment, amount: finalTotal - amountToUse });
            }
        } else if (payment === 'A_PAGAR') {
            paymentDetailsArray.push({ method: 'A_PAGAR', amount: finalTotal });
        } else {
            paymentDetailsArray.push({ method: payment, amount: finalTotal });
        }

        if (settings.isCashbackActive && finalCustomerId) {
            const isTableOrCommand = orderType === 'MESA' || orderType === 'COMANDA';
            
            // For MESA/COMANDA, the payment and cashback are handled in POS upon final checkout.
            // For DELIVERY/PICKUP, we handle it here to ensure the customer receives their points.
            if (!isTableOrCommand) {
                const cashbackPercentage = Number(settings.cashbackPercentage) || 0;
                const cashbackEarned = Number(finalTotal) * (cashbackPercentage / 100);

                if (amountToUse > 0 || cashbackEarned > 0) {
                    // Fetch latest points to avoid race conditions
                    const { data: latestCustomer } = await supabase
                        .from('customers')
                        .eq('id', finalCustomerId)
                        .maybeSingle();
                    
                    const currentPoints = latestCustomer ? Number(latestCustomer.points || 0) : Number(customerPoints || 0);

                    const newBalance = currentPoints - amountToUse + cashbackEarned;
                    await supabase
                        .from('customers')
                        .eq('id', finalCustomerId)
                        .update({ points: Math.max(0, newBalance) });
                    
                    if (typeof setCustomerPoints === 'function') {
                        setCustomerPoints(Math.max(0, newBalance));
                    }
                }
            }
        }

        // Update stock for all orders (customers and waitstaff)
        const stockUpdates = new Map<string, number>();
        for (const newItem of cart) {
            const targetProductId = newItem.originalProductId || newItem.productId;
            const current = stockUpdates.get(targetProductId) || 0;
            stockUpdates.set(targetProductId, current - Number(newItem.quantity || 0));
        }

        for (const [productId, diff] of stockUpdates.entries()) {
            if (diff !== 0) {
                // Fetch the latest stock from the database
                const { data: latestProduct } = await supabase
                    .from('products')
                    .select('stock')
                    .eq('id', productId)
                    .maybeSingle();

                if (latestProduct && latestProduct.stock != null) {
                    const newStock = latestProduct.stock + diff;
                    const updates: any = { stock: newStock };
                    if (newStock <= 0) updates.isactive = false;
                    else updates.isactive = true;
                    await supabase.from('products').eq('id', productId).update(updates);
                }
            }
        }

        const finalOrder: Order = {
          id: Date.now().toString(), 
          displayId: displayId,
          type: orderType, 
          items: cart, 
          status: (payment === 'ONLINE' || combinedPayment === 'ONLINE') ? 'AGUARDANDO_PAGAMENTO' : 'AGUARDANDO', 
          total: finalTotal, 
          serviceFee: serviceFee,
          createdAt: Date.now(), 
          paymentMethod: paymentDetailsArray.length > 1 ? 'MISTO' : (paymentDetailsArray.length === 1 ? paymentDetailsArray[0].method : undefined),
          paymentDetails: paymentDetailsArray.length > 0 ? JSON.stringify(paymentDetailsArray) : undefined,
          changeFor: orderChangeFor,
          notes: notes.trim() || undefined, 
          tableNumber: (orderType === 'MESA' || orderType === 'COMANDA') ? manualTable : undefined,
          customerName: customerName.trim() || (isWaitstaff ? `Atend: ${activeWaitstaff?.name}` : undefined), 
          customerPhone: customerPhone.trim() || undefined,
          customerId: finalCustomerId || undefined,
          deliveryAddress: orderType === 'ENTREGA' ? deliveryAddress.trim() : undefined,
          referencePoint: orderType === 'ENTREGA' ? referencePoint.trim() : undefined,
          deliveryFee: orderType === 'ENTREGA' && deliveryFee !== null ? deliveryFee : undefined,
          waitstaffName: activeWaitstaff?.name || undefined,
          couponApplied: undefined,
          discountAmount: undefined,
          stockDeducted: true
        };

        const success = await addOrder(finalOrder); 
        if (success === false) {
           return;
        }
        setGeneratedDisplayId(displayId);
        setCart([]); 
        setCustomerName('');
        setCustomerPhone('');
        setDeliveryAddress('');
        setReferencePoint('');
        setNotes('');
        setChangeFor('');
        setPayment('');
        setCombinedPayment('');
        if (!effectiveTable) setManualTable('');
        
        if ((payment === 'PIX' || combinedPayment === 'PIX') && settings.onlinePaymentProvider === 'mercado_pago' && settings.onlinePaymentAccessToken) {
          try {
             const response = await fetch('/api/mercado-pago/create-pix', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                 accessToken: settings.onlinePaymentAccessToken,
                 orderData: finalOrder,
                 storeSlug: settings.slug || storeSlug,
               })
             });
             const data = await response.json();
             if (data.qr_code) {
               setGeneratedPix({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64 });
               setCheckoutStep('success'); // Show success component with QR code
             }
          } catch(err) {
             console.error("Erro gerando Pix MP", err);
          }
        }
        
        if ((payment === 'ONLINE' || combinedPayment === 'ONLINE') && settings.onlinePaymentProvider === 'mercado_pago') {
          try {
            const redirectStoreUrl = `${window.location.origin}${window.location.pathname}#/cardapio?loja=${settings.slug || storeSlug}${urlModo ? '&modo=' + urlModo : ''}`;
            const response = await fetch('/api/mercado-pago/create-preference', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken: settings.onlinePaymentAccessToken,
                orderData: finalOrder,
                storeUrl: redirectStoreUrl,
                storeSlug: settings.slug || storeSlug,
              })
            });
            const data = await response.json();
            if (data.init_point) {
              window.location.href = data.init_point;
              return; // Stop execution to allow redirect
            } else {
              alert('Erro ao gerar link de pagamento. O pedido foi salvo, por favor pague na entrega ou no balcão.');
            }
          } catch (err) {
            console.error('Erro no pagamento online:', err);
            alert('Erro ao gerar link de pagamento. O pedido foi salvo, por favor pague na entrega ou no balcão.');
          }
        }

        if ((payment === 'ONLINE' || combinedPayment === 'ONLINE') && settings.onlinePaymentProvider === 'pagbank') {
          try {
            const redirectStoreUrl = `${window.location.origin}${window.location.pathname}#/cardapio?loja=${settings.slug || storeSlug}${urlModo ? '&modo=' + urlModo : ''}`;
            const response = await fetch('/api/v1/process-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: settings.onlinePaymentAccessToken,
                environment: settings.pagbankEnvironment || 'sandbox',
                orderData: finalOrder,
                storeUrl: redirectStoreUrl,
                storeSlug: settings.slug || storeSlug,
                storeId: storeId
              })
            });
            
            const responseText = await response.text();
            let data;
            try {
              data = responseText ? JSON.parse(responseText) : {};
            } catch (e) {
              console.error('Non-JSON response from PagBank API:', responseText);
              throw new Error(`Resposta inválida do servidor. (Status: ${response.status})`);
            }

            if (data.checkout_url) {
              window.location.href = data.checkout_url;
              return; // Stop execution to allow redirect
            } else {
              const errorMessage = data.error || (data.message) || (data.error_messages ? data.error_messages.map((m: any) => m.description).join(', ') : null);
              alert('Erro ao gerar link de pagamento PagBank: ' + (errorMessage || `Status: ${response.status}`));
            }
          } catch (err: any) {
            console.error('Erro no pagamento online PagBank:', err);
            alert(`Erro ao gerar link de pagamento PagBank: ${err.message}`);
          }
        }

        setCheckoutStep('success'); 
    } catch (err: any) { 
        alert(`Erro ao enviar pedido: ${err.message}`); 
    } finally { 
        setIsSending(false); 
    }
  };

  if (!hasSelectedMode && !isWaitstaff) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center p-6 text-zinc-900">
        <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl space-y-10 border border-orange-100 animate-scale-up relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary opacity-10 rounded-full blur-3xl"></div>
          <div className="text-center relative z-10">
            <div className="relative inline-block mb-6">
                <img src={settings.logoUrl || undefined} className="w-24 h-24 rounded-full border-4 border-orange-50 object-cover shadow-2xl" alt="Logo" />
                {!isStoreClosed && <div className="absolute -bottom-1 -right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white"></div>}
            </div>
            <h1 className="text-2xl font-brand font-bold text-primary leading-tight">Olá! Seja bem-vindo.</h1>
            <p className="text-xs text-gray-400 mt-2 uppercase tracking-[0.2em] font-black">{isStoreClosed ? 'ESTAMOS FECHADOS NO MOMENTO' : 'Como deseja fazer seu pedido?'}</p>
          </div>
          {isStoreClosed ? (
            <div className="bg-red-50 p-8 rounded-[2rem] border border-red-100 text-center space-y-4">
               <Power size={56} className="text-red-300 mx-auto" strokeWidth={1.5} />
               <p className="text-sm font-bold text-red-700 leading-relaxed uppercase">Nossa loja física e digital estão pausadas agora. Voltaremos em breve!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
                {(!urlModo || urlModo === 'local') && settings.isTableOrderActive && (
                  <button onClick={() => { setOrderType('MESA'); setHasSelectedMode(true); }} className="group flex items-center justify-between p-5 bg-orange-50/50 hover:bg-orange-100/50 rounded-[1.8rem] transition-all border border-orange-100 active:scale-95 text-left">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-white rounded-2xl text-orange-600 shadow-sm transition-transform group-hover:scale-110"><Utensils size={28} /></div>
                          <div>
                            <p className="font-bold text-lg text-primary leading-none">Na Mesa</p>
                            <p className="text-[10px] text-orange-700 opacity-60 font-black uppercase mt-1 tracking-wider">Estou no salão</p>
                          </div>
                      </div>
                      <ArrowRight className="text-orange-200 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" size={20} />
                  </button>
                )}
                {(!urlModo || urlModo === 'local') && settings.isCommandOrderActive !== false && (
                  <button onClick={() => { setOrderType('COMANDA'); setHasSelectedMode(true); }} className="group flex items-center justify-between p-5 bg-purple-50/50 hover:bg-purple-100/50 rounded-[1.8rem] transition-all border border-purple-100 active:scale-95 text-left">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-white rounded-2xl text-purple-600 shadow-sm transition-transform group-hover:scale-110"><Tag size={28} /></div>
                          <div>
                            <p className="font-bold text-lg text-primary leading-none">Comanda</p>
                            <p className="text-[10px] text-purple-700 opacity-60 font-black uppercase mt-1 tracking-wider">Tenho uma comanda</p>
                          </div>
                      </div>
                      <ArrowRight className="text-purple-200 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" size={20} />
                  </button>
                )}
                {(!urlModo || urlModo === 'externo') && settings.isCounterPickupActive && (
                  <button onClick={() => { setOrderType('BALCAO'); setHasSelectedMode(true); }} className="group flex items-center justify-between p-5 bg-blue-50/50 hover:bg-blue-100/50 rounded-[1.8rem] transition-all border border-blue-100 active:scale-95 text-left">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-white rounded-2xl text-blue-600 shadow-sm transition-transform group-hover:scale-110"><ShoppingBag size={28} /></div>
                          <div>
                            <p className="font-bold text-lg text-primary leading-none">Balcão</p>
                            <p className="text-[10px] text-blue-700 opacity-60 font-black uppercase mt-1 tracking-wider">Vou retirar aqui</p>
                          </div>
                      </div>
                      <ArrowRight className="text-blue-200 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" size={20} />
                  </button>
                )}
                {(!urlModo || urlModo === 'externo') && settings.isDeliveryActive && (
                  <button onClick={() => { setOrderType('ENTREGA'); setHasSelectedMode(true); }} className="group flex items-center justify-between p-5 bg-green-50/50 hover:bg-green-100/50 rounded-[1.8rem] transition-all border border-green-100 active:scale-95 text-left">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-white rounded-2xl text-green-600 shadow-sm transition-transform group-hover:scale-110"><Truck size={28} /></div>
                          <div>
                            <p className="font-bold text-lg text-primary leading-none">Entrega</p>
                            <p className="text-[10px] text-green-700 opacity-60 font-black uppercase mt-1 tracking-wider">Receber em casa</p>
                          </div>
                      </div>
                      <ArrowRight className="text-green-200 group-hover:text-green-400 group-hover:translate-x-1 transition-all" size={20} />
                  </button>
                )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900 relative flex flex-col font-sans">
      <header className={`sticky top-0 z-30 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] ${isWaitstaff ? 'bg-secondary' : 'bg-white'} ${isWaitstaff ? 'text-white' : 'text-slate-800'} p-3 md:p-4 transition-all w-full border-b ${isWaitstaff ? 'border-secondary' : 'border-slate-100'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={handleBack} className={`p-2 rounded-full shrink-0 ${isWaitstaff ? 'hover:bg-white/10' : 'hover:bg-slate-100'} transition-colors`}>
              {isWaitstaff ? <ArrowLeft size={22} /> : <ChevronLeft size={22} />}
            </button>
            <div className="flex flex-col min-w-0">
                <h1 className="font-brand text-base md:text-lg font-bold leading-none truncate">{settings.storeName}</h1>
                <button onClick={handleResetMode} className="text-[10px] uppercase font-black opacity-60 truncate mt-0.5 text-left hover:opacity-100 decoration-dotted underline-offset-2 transition-opacity">
                  {orderType} {(orderType === 'MESA' || orderType === 'COMANDA') && manualTable ? `• ${orderType === 'MESA' ? 'Mesa' : 'Comanda'} ${manualTable}` : ''}
                </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InstallPrompt />
            <button onClick={() => setIsTrackingModalOpen(true)} className={`p-2.5 rounded-full shrink-0 active:scale-95 transition-transform ${isWaitstaff ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><Search size={20} /></button>
            <button onClick={() => setIsInfoOpen(true)} className={`p-2.5 rounded-full shrink-0 active:scale-95 transition-transform ${isWaitstaff ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><Info size={20} /></button>
            <button onClick={() => { setIsCartOpen(true); setCheckoutStep('cart'); }} className={`relative p-2.5 rounded-full shrink-0 active:scale-95 transition-transform ${isWaitstaff ? 'bg-white/10 text-white' : 'bg-primary text-white hover:bg-primary/90 shadow-md'}`}>
               <ShoppingCart size={20} />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-secondary text-white text-[9px] w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold shadow-sm">{cart.length}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 flex-1 pb-24 text-slate-800 overflow-x-hidden w-full box-border">
        {isStoreClosed && !isWaitstaff && (
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center gap-3 animate-pulse mb-6">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <p className="text-[10px] font-black uppercase text-red-700 tracking-widest">A loja está fechada. Apenas visualização.</p>
          </div>
        )}

        <div className="relative group w-full mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="O que deseja comer hoje?" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white rounded-2xl outline-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all text-sm font-medium" />
        </div>

        {!searchTerm && featuredProducts.length > 0 && activeCategory === 'Todos' && (
          <section className="animate-fade-in w-full mb-8 space-y-3">
             <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Destaques</h2>
             <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory custom-scrollbar-hide -mx-4 px-4">
               {featuredProducts.map((featuredProduct) => (
                 <div key={featuredProduct.id} className="w-[85vw] max-w-[320px] sm:max-w-[360px] snap-center shrink-0 bg-white rounded-3xl p-3 sm:p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col gap-3 relative overflow-hidden group">
                    <div className="absolute top-4 right-4 bg-orange-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-full z-20 shadow-sm flex items-center gap-1"><Flame size={10} className="animate-pulse" /> Top</div>
                    <div className="w-full h-40 rounded-2xl overflow-hidden shrink-0 bg-slate-50 relative group-hover:shadow-inner transition-shadow">
                        <img 
                          src={featuredProduct.imageUrl || undefined} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700 cursor-pointer" 
                          alt={featuredProduct.name} 
                          onClick={(e) => { e.stopPropagation(); setExpandedImage(featuredProduct.imageUrl!); }}
                          loading="lazy"
                        />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1 px-1">
                       <div className="min-w-0">
                          {settings?.isCashbackActive && <div className="mb-2"><span className="bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center w-fit gap-1"><DollarSign size={10}/> Cashback Ativo</span></div>}
                          <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight mb-1">{featuredProduct.name}</h3>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">{featuredProduct.description}</p>
                       </div>
                       <div className="flex items-center justify-between gap-2 mt-4">
                          {(() => {
                             const promoPrice = getPromotionalPrice(featuredProduct);
                             if (promoPrice !== null) {
                               return (
                                 <div className="flex flex-col">
                                   <span className="text-[10px] text-slate-400 line-through">De R$ {featuredProduct.price.toFixed(2)}</span>
                                   <span className="text-lg sm:text-xl font-black text-primary">por R$ {promoPrice.toFixed(2)}{featuredProduct.isByWeight ? '/kg' : ''}</span>
                                 </div>
                               );
                             }
                             const discountPercentage = getPromotionalDiscountPercentage(featuredProduct);
                             if (featuredProduct.price <= 0 && discountPercentage) {
                               return (
                                 <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                                   <Percent size={12} /> {discountPercentage}% OFF
                                 </span>
                               );
                             }
                             return (
                               <span className="text-lg sm:text-xl font-black text-primary">
                                 {featuredProduct.price > 0 ? `R$ ${featuredProduct.price.toFixed(2)}${featuredProduct.isByWeight ? '/kg' : ''}` : ''}
                               </span>
                             );
                          })()}
                          {!isStoreClosed && (
                            <button 
                              onClick={() => handleAddToCart(featuredProduct)} 
                              className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 shrink-0 hover:opacity-90 ${isWaitstaff ? 'bg-secondary' : 'bg-primary'}`}
                            >
                              <PlusIcon size={14} /> 
                              <span className="whitespace-nowrap uppercase">Adicionar</span>
                            </button>
                          )}
                       </div>
                    </div>
                 </div>
               ))}
             </div>
          </section>
        )}

        <div className="sticky top-16 md:top-[72px] z-20 bg-slate-50/80 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 border-b border-slate-100 mb-6">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => { setActiveCategory(cat); setSearchTerm(''); }} className={`px-5 py-2.5 rounded-xl whitespace-nowrap font-bold text-[11px] transition-all ${activeCategory === cat ? (isWaitstaff ? 'bg-secondary text-white shadow-md' : 'bg-primary text-white shadow-md') : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>{cat}</button>
              ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {filteredProducts.slice(0, visibleCount).map(product => (
            <div 
              key={product.id} 
              className={`bg-white rounded-[1.5rem] p-3 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex gap-4 items-center border border-slate-100 transition-all w-full box-border group ${!product.isActive ? 'opacity-50 grayscale' : ''}`}
            >
              <div className="relative shrink-0">
                <img 
                  src={product.imageUrl || undefined} 
                  className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-xl cursor-pointer transition-transform group-hover:scale-105" 
                  alt={product.name} 
                  onClick={(e) => { e.stopPropagation(); setExpandedImage(product.imageUrl!); }}
                  loading="lazy"
                />
                {product.isByWeight && <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1.5 rounded-lg shadow-md border-2 border-white"><Scale size={12} /></div>}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-1">
                <div className="min-w-0">
                  {settings?.isCashbackActive && <div className="mb-1.5"><span className="bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center w-fit gap-1"><DollarSign size={10}/> Cashback Ativo</span></div>}
                  <h3 className="font-bold text-sm md:text-base leading-tight text-slate-800 mb-1">{product.name}</h3>
                  <p className="text-[11px] text-slate-500 whitespace-normal line-clamp-2 leading-relaxed">{product.description}</p>
                </div>
                <div className="flex items-center justify-between mt-3 gap-2">
                  {(() => {
                     const promoPrice = getPromotionalPrice(product);
                     if (promoPrice !== null) {
                       return (
                         <div className="flex flex-col">
                           <span className="text-[10px] text-slate-400 line-through">De R$ {product.price.toFixed(2)}</span>
                           <span className="font-black text-primary text-sm sm:text-md">por R$ {promoPrice.toFixed(2)}{product.isByWeight ? '/kg' : ''}</span>
                         </div>
                       );
                     }
                     const discountPercentage = getPromotionalDiscountPercentage(product);
                     if (product.price <= 0 && discountPercentage) {
                       return (
                         <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                           <Percent size={12} /> {discountPercentage}% OFF
                         </span>
                       );
                     }
                     return product.price > 0 ? <span className="font-black text-primary text-sm sm:text-md">R$ {product.price.toFixed(2)}{product.isByWeight ? '/kg' : ''}</span> : <span />;
                  })()}
                  {!isStoreClosed && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }} 
                      className={`w-8 h-8 rounded-full text-white flex items-center justify-center shadow-md text-xs font-bold transition-all active:scale-90 hover:-translate-y-0.5 shrink-0 ${isWaitstaff ? 'bg-secondary' : 'bg-primary'}`}
                    >
                      <PlusIcon size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length > visibleCount && (
          <div ref={loadMoreRef} className="col-span-full h-20 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}
      </main>

      {/* FLOATING CART BUTTON */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm animate-fade-in">
          <button 
            onClick={() => { setIsCartOpen(true); setCheckoutStep('cart'); }} 
            className={`w-full text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between active:scale-95 transition-transform border border-white/20 ${isWaitstaff ? 'bg-secondary' : 'bg-primary'}`}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart size={24} />
                <span className="absolute -top-2 -right-2 bg-white text-primary text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-sm">{cart.length}</span>
              </div>
              <span className="font-bold text-sm uppercase tracking-widest">Ver Sacola</span>
            </div>
            <span className="font-black text-lg">R$ {finalTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* MODAL DO CARRINHO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up border border-orange-100">
             <header className="p-6 border-b flex items-center justify-between bg-orange-50/50">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-primary text-secondary rounded-xl shadow-sm"><ShoppingCart size={20} /></div>
                   <h2 className="text-xl font-brand font-bold text-primary">Minha Sacola</h2>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm"><X size={24} /></button>
             </header>

             <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {checkoutStep === 'cart' ? (
                  <div className="space-y-6">
                     {cart.length === 0 ? (
                       <div className="py-20 text-center space-y-4">
                          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto"><ShoppingBag size={40} className="text-gray-200" /></div>
                          <p className="text-gray-400 font-bold">Sua sacola está vazia.</p>
                          <button onClick={() => setIsCartOpen(false)} className="text-secondary font-black text-xs uppercase tracking-widest">Voltar ao Menu</button>
                       </div>
                     ) : (
                       <>
                         <div className="space-y-4">
                            {cart.map(item => (
                              <div key={item.productId} className="flex items-center gap-4 bg-gray-50/50 p-4 rounded-3xl border border-gray-100 group">
                                 <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-800 break-words">{item.name}</h4>
                                    {item.complements && item.complements.length > 0 && (
                                       <ul className="mt-1 space-y-1 mb-2">
                                          {item.complements.map((comp, idx) => (
                                             <li key={idx} className="text-[10px] text-gray-500 font-medium">
                                                <span className="text-gray-400 font-bold">{comp.quantity}x</span> {comp.name}
                                                {comp.price > 0 && <span className="text-gray-400"> (+ R$ {(comp.price * comp.quantity).toFixed(2)})</span>}
                                             </li>
                                          ))}
                                       </ul>
                                    )}
                                    {item.price > 0 && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">R$ {item.price.toFixed(2)} {item.isByWeight ? '/kg' : 'un'}</p>}
                                 </div>
                                 <div className="flex items-center bg-white rounded-2xl border border-gray-100 p-1 shadow-sm">
                                    <button onClick={() => updateCartItemQuantity(item.productId, -1)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><MinusIcon size={14} /></button>
                                    <span className="px-3 font-black text-sm text-primary min-w-[3rem] text-center">
                                       {item.isByWeight ? `${item.quantity.toFixed(3)}kg` : item.quantity}
                                    </span>
                                    <button onClick={() => updateCartItemQuantity(item.productId, 1)} className="p-2 text-gray-400 hover:text-green-500 transition-colors"><PlusIcon size={14} /></button>
                                 </div>
                              </div>
                            ))}
                         </div>
                       </>
                     )}
                  </div>
                ) : checkoutStep === 'details' ? (
                  <div className="space-y-6">
                     <button onClick={() => setCheckoutStep('cart')} className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2"><ChevronLeft size={14}/> Voltar para Sacola</button>
                     
                     <div className="space-y-4">
                        {orderType === 'ENTREGA' && (
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                                Telefone (WhatsApp)
                              </label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                   <input 
                                      type="tel" 
                                      value={customerPhone} 
                                      onChange={e => setCustomerPhone(e.target.value)} 
                                      onBlur={e => {
                                          let val = e.target.value.trim();
                                          if (val && !val.startsWith('+55') && !val.startsWith('55')) {
                                              val = '+55' + val;
                                          } else if (val.startsWith('55')) {
                                              val = '+' + val;
                                          }
                                          setCustomerPhone(val);
                                      }}
                                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" 
                                      placeholder="85 9..." 
                                   />
                                </div>
                                <button 
                                  onClick={handleConsultCustomer}
                                  disabled={isConsulting || !customerPhone.trim()}
                                  className="px-4 py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold text-xs uppercase tracking-widest border border-blue-100 disabled:opacity-50"
                                >
                                  {isConsulting ? '...' : 'Consultar'}
                                </button>
                              </div>
                           </div>
                        )}
                        {orderType === 'MESA' || orderType === 'COMANDA' ? (
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Número da {orderType === 'MESA' ? 'Mesa' : 'Comanda'}</label>
                              <div className="relative">
                                 <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                 <input type="number" value={manualTable} onChange={e => setManualTable(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-lg" placeholder="EX: 01" />
                              </div>
                           </div>
                        ) : (
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nome do Cliente</label>
                              <div className="relative">
                                 <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                 <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" placeholder="Digite seu nome" />
                              </div>
                           </div>
                        )}

                        {orderType !== 'ENTREGA' && (
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                                Telefone (WhatsApp) {(orderType !== 'BALCAO' && orderType !== 'MESA') || isWaitstaff ? '(Opcional)' : ''}
                              </label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                   <input 
                                      type="tel" 
                                      value={customerPhone} 
                                      onChange={e => setCustomerPhone(e.target.value)} 
                                      onBlur={e => {
                                          let val = e.target.value.trim();
                                          if (val && !val.startsWith('+55') && !val.startsWith('55')) {
                                              val = '+55' + val;
                                          } else if (val.startsWith('55')) {
                                              val = '+' + val;
                                          }
                                          setCustomerPhone(val);
                                      }}
                                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" 
                                      placeholder="85 9..." 
                                   />
                                </div>
                                <button 
                                  onClick={handleConsultCustomer}
                                  disabled={isConsulting || !customerPhone.trim()}
                                  className="px-4 py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold text-xs uppercase tracking-widest border border-blue-100 disabled:opacity-50"
                                >
                                  {isConsulting ? '...' : 'Consultar'}
                                </button>
                              </div>
                           </div>
                        )}

                        {orderType === 'ENTREGA' && (
                          <>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Endereço Completo</label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                     <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                     <input type="text" value={deliveryAddress} onChange={e => { setDeliveryAddress(e.target.value); setIsFeeConfirmed(false); setDeliveryFee(null); }} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" placeholder="Rua, Número, Bairro..." />
                                  </div>
                                  {settings.isDeliveryFeeActive && (
                                    <button 
                                      onClick={() => calculateDeliveryFee()}
                                      disabled={isCalculatingFee || !deliveryAddress.trim()}
                                      className="px-4 py-4 bg-orange-50 text-orange-600 rounded-2xl font-bold text-xs uppercase tracking-widest border border-orange-100 disabled:opacity-50 whitespace-nowrap"
                                    >
                                      {isCalculatingFee ? '...' : 'Consultar Taxa'}
                                    </button>
                                  )}
                                </div>
                                {settings.isDeliveryFeeActive && deliveryFee !== null && (
                                  <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-bold text-blue-800">Distância: {deliveryDistanceKm?.toFixed(1)} km</p>
                                      <p className="text-sm font-black text-blue-900">Taxa: R$ {deliveryFee.toFixed(2)} | Total: R$ {(cartTotal + deliveryFee).toFixed(2)}</p>
                                    </div>
                                    {!isFeeConfirmed ? (
                                      <button 
                                        onClick={() => setIsFeeConfirmed(true)}
                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase"
                                      >
                                        Confirmar
                                      </button>
                                    ) : (
                                      <span className="text-xs font-bold text-green-600 flex items-center gap-1"><Check size={14} /> Confirmado</span>
                                    )}
                                  </div>
                                )}
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Ponto de Referência</label>
                                <div className="relative">
                                   <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                   <input type="text" value={referencePoint} onChange={e => setReferencePoint(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" placeholder="Próximo a..." />
                                </div>
                             </div>
                          </>
                        )}

                        <div className="space-y-4 pt-4 border-t border-gray-100">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 text-center">Método de Pagamento</p>
                           <div className="flex flex-wrap justify-center gap-2">
                              {[
                                {id: 'PIX', icon: <DollarSign size={18}/>, label: 'PIX'},
                                {id: 'CARTAO', icon: <CreditCard size={18}/>, label: 'Cartão'},
                                {id: 'DINHEIRO', icon: <Banknote size={18}/>, label: 'Dinheiro'},
                                {id: 'DEBITO', icon: <CreditCard size={18}/>, label: 'Débito'},
                                {id: 'ONLINE', icon: <Globe size={18}/>, label: 'Pagar Online'},
                                {id: 'A_PAGAR', icon: <Wallet size={18}/>, label: 'Na Entrega'},
                                {id: 'CASHBACK', icon: <Award size={18}/>, label: `Cashback`}
                              ].filter(m => {
                                // Online payment only if active
                                if (m.id === 'ONLINE' && (!settings.isOnlinePaymentActive || !settings.onlinePaymentProvider || settings.lockedFeatures?.includes('ONLINE_PAYMENT'))) return false;
                                
                                // Pagar na entrega only if it's delivery
                                if (m.id === 'A_PAGAR' && orderType !== 'ENTREGA') return false;
                                
                                // Cashback only if active and user has points
                                if (m.id === 'CASHBACK' && (!settings.isCashbackActive || customerPoints <= 0 || customerPoints < (settings.minCashbackToUse || 0))) return false;
                                
                                // Filter based on admin settings
                                if (settings.digitalMenuPaymentMethods && settings.digitalMenuPaymentMethods.length > 0 && m.id !== 'CASHBACK') {
                                  return settings.digitalMenuPaymentMethods.includes(m.id as any);
                                }
                                
                                // Default hide DEBITO as it's redundant with CARTAO usually
                                if (m.id === 'DEBITO') return false;
                                
                                return true;
                              })
                             .map(m => (
                                <button key={m.id} onClick={() => setPayment(m.id as any)} className={`flex flex-col items-center justify-center w-[100px] h-[80px] gap-2 p-2 rounded-2xl border transition-all ${payment === m.id ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>
                                   {m.icon}
                                   <span className="text-[10px] font-black uppercase text-center leading-tight">{m.label}</span>
                                   {m.id === 'CASHBACK' && <span className="text-[8px] font-bold">R$ {customerPoints.toFixed(2)}</span>}
                                </button>
                              ))}
                           </div>
                        </div>

                        {payment === 'CASHBACK' && customerPoints < finalTotal && (
                           <div className="space-y-4 pt-4 border-t border-gray-100 animate-scale-up">
                               <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-2 shadow-sm">
                                 <p className="text-lg md:text-xl font-black text-red-600 uppercase tracking-widest text-center">
                                   Falta pagar: R$ {(finalTotal - customerPoints).toFixed(2)}
                                 </p>
                                 <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center mt-1">
                                   Selecione como deseja completar o pagamento
                                 </p>
                               </div>
                               <div className="flex flex-wrap justify-center gap-2">
                                  {[
                                    {id: 'PIX', icon: <DollarSign size={18}/>, label: 'PIX'},
                                    {id: 'CARTAO', icon: <CreditCard size={18}/>, label: 'Cartão'},
                                    {id: 'DINHEIRO', icon: <Banknote size={18}/>, label: 'Dinheiro'},
                                    {id: 'DEBITO', icon: <CreditCard size={18}/>, label: 'Débito'},
                                    {id: 'ONLINE', icon: <Globe size={18}/>, label: 'Pagar Online'},
                                    {id: 'A_PAGAR', icon: <Wallet size={18}/>, label: 'Na Entrega'},
                                  ].filter(m => {
                                    if (m.id === 'ONLINE' && (!settings.isOnlinePaymentActive || !settings.onlinePaymentProvider || settings.lockedFeatures?.includes('ONLINE_PAYMENT'))) return false;
                                    if (m.id === 'A_PAGAR' && orderType !== 'ENTREGA') return false;
                                    if (settings.digitalMenuPaymentMethods && settings.digitalMenuPaymentMethods.length > 0) {
                                      return settings.digitalMenuPaymentMethods.includes(m.id as any);
                                    }
                                    if (m.id === 'DEBITO') return false;
                                    return true;
                                  }).map(m => (
                                   <button key={m.id} onClick={() => setCombinedPayment(m.id as any)} className={`flex flex-col items-center justify-center w-[100px] h-[80px] gap-2 p-2 rounded-2xl border transition-all ${combinedPayment === m.id ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>
                                      {m.icon}
                                      <span className="text-[10px] font-black uppercase text-center leading-tight">{m.label}</span>
                                   </button>
                                 ))}
                               </div>
                           </div>
                        )}

                        {(payment === 'DINHEIRO' || (payment === 'CASHBACK' && combinedPayment === 'DINHEIRO')) && (
                           <div className="space-y-2 animate-scale-up">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Troco para quanto?</label>
                              <input type="number" value={changeFor} onChange={e => setChangeFor(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold" placeholder="Deixe vazio se não precisar" />
                           </div>
                        )}

                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Observações (Opcional)</label>
                           <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none h-24 resize-none font-medium text-sm" placeholder="" />
                        </div>
                     </div>

                     <button disabled={isSending} onClick={handleCheckout} className="w-full py-5 bg-secondary text-primary rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">
                        {isSending ? <Loader2 className="animate-spin" size={24}/> : <><Send size={20}/> Finalizar e Enviar Pedido</>}
                     </button>
                  </div>
                ) : (
                  <div className="py-12 text-center animate-scale-up space-y-6">
                     <div className={`w-24 h-24 ${paymentStatus === 'failure' ? 'bg-red-500' : paymentStatus === 'pending' ? 'bg-yellow-500' : 'bg-green-500'} text-white rounded-full flex items-center justify-center mx-auto shadow-2xl animate-bounce`}>
                       {paymentStatus === 'failure' ? <X size={48} strokeWidth={4} /> : paymentStatus === 'pending' ? <Clock size={48} strokeWidth={4} /> : <Check size={48} strokeWidth={4} />}
                     </div>
                     <div>
                        <h3 className="text-3xl font-brand font-bold text-primary">
                          {paymentStatus === 'success' ? 'Pagamento Aprovado!' : 
                           paymentStatus === 'failure' ? 'Pagamento Recusado' : 
                           paymentStatus === 'pending' ? 'Pagamento Pendente' : 
                           'Pedido Enviado!'}
                        </h3>
                        <p className="text-gray-500 mt-2 font-medium">
                          {paymentStatus === 'success' ? 'Recebemos seu pagamento e já estamos preparando seu pedido.' : 
                           paymentStatus === 'failure' ? 'Houve um problema com seu pagamento. Por favor, pague no balcão ou na entrega.' :
                           paymentStatus === 'pending' ? 'Estamos aguardando a confirmação do pagamento.' :
                           'Já estamos preparando seu pedido.'}
                        </p>
                     </div>
                     <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 text-left space-y-2">
                        <div className="flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase">Senha do Pedido</span><span className="text-xl font-black text-primary">#{generatedDisplayId || paymentOrderId?.slice(-4)}</span></div>
                        <p className="text-[10px] text-gray-400 leading-snug">Fique atento ao painel da loja ou aguarde nosso atendente chamar.</p>
                     </div>

                     {generatedPix && (
                        <div className="bg-white p-6 rounded-3xl border border-gray-200 text-center space-y-4 shadow-xl">
                           <h4 className="font-bold text-gray-800 text-sm">Pague agora com Pix (Mercado Pago)</h4>
                           <img src={`data:image/jpeg;base64,${generatedPix.qr_code_base64}`} alt="QR Code Pix" className="mx-auto w-48 h-48" />
                           <div className="bg-gray-50 p-3 rounded-xl">
                              <p className="text-[9px] text-gray-500 break-all select-all font-mono">{generatedPix.qr_code}</p>
                           </div>
                           <button onClick={() => {
                              navigator.clipboard.writeText(generatedPix.qr_code);
                              alert("Código Copia e Cola copiado!");
                           }} className="w-full py-4 bg-purple-100 text-purple-700 font-bold rounded-xl text-sm mt-2 flex items-center justify-center gap-2">
                              <QrCode size={16}/> Copiar Código Pix
                           </button>
                        </div>
                     )}
                     
                     {(orderType === 'ENTREGA' || orderType === 'BALCAO') && customerPhone && (
                       <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 text-left space-y-2">
                         <div className="flex items-center gap-2 text-blue-600 mb-1">
                           <Search size={16} />
                           <span className="text-sm font-bold">Acompanhe seu pedido</span>
                         </div>
                         <p className="text-xs text-blue-800 leading-snug">Você pode consultar o status do seu pedido a qualquer momento clicando no ícone de lupa <Search size={12} className="inline" /> no topo da tela e informando seu telefone <strong>{customerPhone}</strong>.</p>
                       </div>
                     )}
                     
                     <div className="flex flex-col gap-3">
                        <button onClick={() => { setIsCartOpen(false); setCheckoutStep('cart'); }} className="w-full py-5 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Lançar outro item na sacola</button>
                        
                        {isWaitstaff && (
                           <button 
                             onClick={handleBack} 
                             className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                           >
                             <ArrowLeft size={16} /> Concluir e Voltar ao Mapa
                           </button>
                        )}
                     </div>
                  </div>
                )}
             </div>

             {/* FIXED FOOTER FOR CART */}
             {checkoutStep === 'cart' && cart.length > 0 && (
               <div className="p-6 border-t border-gray-100 bg-white shrink-0">
                 <div className="bg-primary p-6 rounded-[2rem] text-white space-y-2 shadow-xl shadow-black/5 mb-4">
                    <div className="flex justify-between text-xs opacity-60"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
                    {serviceFee > 0 && <div className="flex justify-between text-xs text-secondary font-bold"><span>Comissão ({commissionRate > 0 ? `${commissionRate}%` : 'Atendente'})</span><span>R$ {serviceFee.toFixed(2)}</span></div>}
                    {orderType === 'ENTREGA' && deliveryFee !== null && <div className="flex justify-between text-xs text-secondary font-bold"><span>Taxa de Entrega (Itens + Taxa)</span><span>R$ {deliveryFee.toFixed(2)} (R$ {(cartTotal + deliveryFee).toFixed(2)})</span></div>}
                    <div className="flex justify-between items-end pt-2">
                       <span className="text-sm font-bold uppercase tracking-widest">Total</span>
                       <span className="text-3xl font-black text-secondary">R$ {finalTotal.toFixed(2)}</span>
                    </div>
                 </div>

                 <div className="flex flex-col gap-3">
                   <button onClick={() => setCheckoutStep('details')} className="w-full py-5 bg-secondary text-primary rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all">Prosseguir para Identificação</button>
                   <button onClick={() => setIsCartOpen(false)} className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">
                     <div className="flex items-center justify-center gap-2">
                       <PlusIcon size={16} /> Adicionar mais itens
                     </div>
                   </button>
                 </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* MODAL DE INFORMAÇÕES DA LOJA */}
      {isInfoOpen && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl animate-scale-up overflow-hidden border border-orange-100">
            <div className="p-8 border-b bg-orange-50 text-center relative text-zinc-900">
               <button onClick={() => setIsInfoOpen(false)} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm"><X size={20} /></button>
               <img src={settings.logoUrl || undefined} className="w-20 h-20 rounded-full border-4 border-white shadow-xl mx-auto mb-4 object-cover" />
               <h2 className="text-xl font-brand font-bold text-primary">{settings.storeName}</h2>
               <div className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase mt-2 tracking-widest ${settings.isStoreOpen ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{settings.isStoreOpen ? 'Aberto Agora' : 'Fechado no Momento'}</div>
            </div>
            <div className="p-8 space-y-4">
               {settings.address && (
                 <div className="flex items-start gap-4 p-2">
                    <div className="p-3 bg-gray-50 rounded-2xl text-primary border border-gray-100"><MapPin size={20} /></div>
                    <div className="min-w-0">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Localização</p>
                       <p className="text-sm font-bold text-gray-700 leading-snug">{settings.address}</p>
                       <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} target="_blank" className="text-[10px] font-black text-secondary flex items-center gap-1 mt-1 uppercase">VER NO MAPA <Navigation size={10} /></a>
                    </div>
                 </div>
               )}

               {settings.whatsapp && (
                 <div className="flex items-start gap-4 p-2 border-t border-gray-100 pt-4">
                    <div className="p-3 bg-green-50 rounded-2xl text-green-600 border border-green-100"><Phone size={20} /></div>
                    <div className="min-w-0">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">WhatsApp</p>
                       <p className="text-sm font-bold text-gray-700 leading-snug">{settings.whatsapp}</p>
                       <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} target="_blank" className="text-[10px] font-black text-green-600 flex items-center gap-1 mt-1 uppercase">INICIAR CONVERSA <MessageCircle size={10} /></a>
                    </div>
                 </div>
               )}
               {settings.businessHours && (
                 <div className="flex items-start gap-4 p-2 border-t border-gray-100 pt-4">
                    <div className="p-3 bg-gray-50 rounded-2xl text-primary border border-gray-100"><Clock size={20} /></div>
                    <div className="min-w-0">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Horário de Funcionamento</p>
                       <p className="text-sm font-bold text-gray-700 leading-snug whitespace-pre-line">{settings.businessHours}</p>
                    </div>
                 </div>
               )}

               <div className="pt-4 border-t border-gray-100">
                  <button onClick={() => setIsInfoOpen(false)} className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-xl text-xs uppercase tracking-widest">Voltar</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RASTREIO */}
      {isTrackingModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl animate-scale-up space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Acompanhar Pedido</h3>
              <button onClick={() => setIsTrackingModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Digite seu número de telefone (WhatsApp) para consultar o status dos seus pedidos recentes.</p>
              <div className="relative">
                <input 
                  type="tel" 
                  value={trackingPhone} 
                  onChange={e => setTrackingPhone(e.target.value)} 
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700" 
                  placeholder="(00) 00000-0000" 
                />
              </div>
              <button 
                onClick={handleTrackOrder} 
                disabled={!trackingPhone || isTrackingLoading} 
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isTrackingLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                Buscar Pedidos
              </button>
            </div>

            {trackedOrders.length > 0 && (
              <div className="mt-6 space-y-4 border-t border-gray-100 pt-6">
                <h4 className="font-bold text-gray-700">Pedidos Recentes</h4>
                {trackedOrders.map(order => (
                  <div key={order.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-black text-sm text-gray-800">Pedido #{order.displayId || order.id.toString().slice(-4)}</span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          let cbAmount = 0;
                          if (order.paymentMethod === 'CASHBACK') cbAmount = order.total;
                          if (order.paymentDetails) {
                            try {
                              const details = JSON.parse(order.paymentDetails);
                              const cb = details.find((d: any) => d.method === 'CASHBACK');
                              if (cb) cbAmount = cb.amount;
                            } catch (e) {}
                          }
                          if (cbAmount > 0) {
                            return (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-1" title="Cashback Utilizado">
                                <Award size={10} /> R$ {cbAmount.toFixed(2)}
                              </span>
                            );
                          }
                          return null;
                        })()}
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-sm font-bold text-secondary">Total: R$ {order.total.toFixed(2)}</p>
                      <button 
                        onClick={() => handleReorder(order)}
                        className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center gap-1"
                      >
                        <ShoppingCart size={12} /> Refazer Pedido
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!isTrackingLoading && trackedOrders.length === 0 && trackingPhone && (
              <p className="text-center text-sm text-gray-500 mt-4">Nenhum pedido encontrado para este número.</p>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE PESO (KG) */}
      {weightProduct && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-scale-up space-y-6">
             <div className="text-center">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100"><Scale size={40} /></div>
                <h3 className="text-xl font-bold text-gray-800">{weightProduct.name}</h3>
                <p className="text-xs text-gray-400 uppercase font-black tracking-widest mt-1">Preço: R$ {weightProduct.price.toFixed(2)}/kg</p>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Informe o peso em Gramas</label>
                <div className="relative">
                   <input type="number" autoFocus value={selectedWeightGrams} onChange={e => setSelectedWeightGrams(e.target.value)} className="w-full px-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-black text-2xl text-center" placeholder="Ex: 500" />
                   <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-gray-300">g</span>
                </div>
                <div className="flex justify-between px-4">
                   <p className="text-[10px] text-gray-400 font-bold uppercase">Equivale a: { (parseFloat(selectedWeightGrams || "0")/1000).toFixed(3) } kg</p>
                   <p className="text-sm font-black text-secondary">R$ { (weightProduct.price * (parseFloat(selectedWeightGrams || "0")/1000)).toFixed(2) }</p>
                </div>
             </div>
             <div className="flex gap-3 pt-4">
                <button onClick={() => setWeightProduct(null)} className="flex-1 py-4 font-bold text-gray-400">Cancelar</button>
                <button onClick={confirmWeightAddition} disabled={!selectedWeightGrams} className="flex-[2] py-4 bg-primary text-white rounded-2xl font-bold shadow-xl disabled:opacity-50">Adicionar à Sacola</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL DE COMPLEMENTOS */}
      {errorMsg && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setErrorMsg(null)}>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center space-y-4 animate-scale-up max-w-sm w-full border border-orange-100" onClick={e => e.stopPropagation()}>
            <div className="relative mx-auto w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center">
              <div className="absolute inset-0 bg-orange-100/50 rounded-3xl animate-ping" />
              <AlertCircle size={40} className="relative z-10" />
            </div>
            <p className="font-bold text-gray-800 text-lg leading-tight">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Entendi</button>
          </div>
        </div>
      )}
      
      {successMsg && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setSuccessMsg(null)}>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center space-y-4 animate-scale-up max-w-sm w-full border border-green-100" onClick={e => e.stopPropagation()}>
            <div className="relative mx-auto w-20 h-20 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center">
              <div className="absolute inset-0 bg-green-100/50 rounded-3xl animate-ping" />
              <CheckCircle2 size={40} className="relative z-10" />
            </div>
            <p className="font-bold text-gray-800 text-lg leading-tight">{successMsg}</p>
            <button onClick={() => setSuccessMsg(null)} className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Legal!</button>
          </div>
        </div>
      )}

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
                // Radio behavior
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
                // Counter behavior
                const existingIndex = newComplements.findIndex(sc => sc.categoryId === category.id && sc.itemId === item.id);
                
                // If we are adding and not exceeding category max
                if (existingIndex > -1) {
                   const qty = newComplements[existingIndex].quantity;
                   if (currentQty > qty) { // Adding
                      if (currentCatCount >= maxCategoryQty) return; // Block
                      newComplements[existingIndex].quantity += 1;
                   } else { // Subtracting
                      if (newComplements[existingIndex].quantity > 1) {
                         newComplements[existingIndex].quantity -= 1;
                      } else {
                         newComplements.splice(existingIndex, 1);
                      }
                   }
                } else { // Adding new item
                   if (currentCatCount >= maxCategoryQty) return; // Block
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
             handleAddToCart(complementsProduct, selectedComplements, complementsQuantity);
             setComplementsProduct(null);
             setIsCartOpen(true);
             setCheckoutStep('cart');
          }}
        />
      )}

      {expandedImage && (
        <div 
          className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
           <div className="relative max-w-2xl w-full max-h-[90vh] flex items-center justify-center">
              <button 
                onClick={(e) => { e.stopPropagation(); setExpandedImage(null); }} 
                className="absolute -top-10 text-white hover:text-gray-300 right-0 p-2 bg-black/50 rounded-full"
              >
                  <X size={24} />
              </button>
              <img src={expandedImage || undefined} className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl animate-scale-up" alt="Produto" />
           </div>
        </div>
      )}
      
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default DigitalMenu;
