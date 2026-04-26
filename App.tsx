
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Settings, 
  PlusCircle, 
  LogOut,
  Loader2,
  UserRound,
  ExternalLink,
  Utensils,
  Tv,
  Users,
  Zap,
  ChefHat,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  ShieldAlert,
  MessageCircle,
  AlertTriangle,
  Truck,
  CheckCircle2
} from 'lucide-react';
import { supabase } from './lib/supabase.ts';
import { Product, Order, StoreSettings, Waitstaff, OrderStatus, StoreProfile } from './types.ts';
import { INITIAL_SETTINGS } from './constants.ts';

// Pages
import AdminDashboard from './pages/AdminDashboard.tsx';
import MenuManagement from './pages/MenuManagement.tsx';
import OrdersList from './pages/OrdersList.tsx';
import StoreSettingsPage from './pages/StoreSettingsPage.tsx';
import DigitalMenu from './pages/DigitalMenu.tsx';
import TVBoard from './pages/TVBoard.tsx';
import AttendantPanel from './pages/AttendantPanel.tsx';
import LoginPage from './pages/LoginPage.tsx';
import WaitstaffManagement from './pages/WaitstaffManagement.tsx';
import { CustomerManagement } from './pages/CustomerManagement.tsx';
import POS from './pages/POS.tsx';
import DeliveryPanel from './pages/DeliveryPanel.tsx';
import KitchenBoard from './pages/KitchenBoard.tsx';
import SuperAdminPanel from './pages/SuperAdminPanel.tsx';
import IntegrationsPage from './pages/IntegrationsPage.tsx';

import { auth, signInWithGoogle } from './lib/firebase.ts';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';

const SOUNDS = {
  NEW_ORDER: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
  ORDER_READY: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'
};

const SESSION_KEY = 'gc-conveniencia-session-v2';
// Removed METADATA_CACHE_KEY as per user request to disable menu cache
const ORDERS_CACHE_KEY = 'gc-orders-cache-v2';

export default function App() {
  return (
    <HashRouter>
      <StoreContext />
    </HashRouter>
  );
}

function StoreContext() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setGoogleUser(user);
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const MASTER_EMAIL = 'auricleciorocha30@gmail.com';
  const isMaster = googleUser?.email === MASTER_EMAIL;

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("Login Error:", e);
    }
  };

  const handleGoogleLogout = async () => {
    await signOut(auth);
  };
  
  const storeSlug = useMemo(() => {
    const slug = searchParams.get('loja');
    if (slug) return slug;
    const urlParams = new URLSearchParams(window.location.search);
    const mainSlug = urlParams.get('loja');
    if (mainSlug) return mainSlug;
    const hashPart = window.location.hash.split('?')[1];
    if (hashPart) {
        const hashParams = new URLSearchParams(hashPart);
        return hashParams.get('loja');
    }
    return null;
  }, [searchParams, location]);
  
  useEffect(() => {
    document.title = "Produto DevARO";
  }, []);

  const [currentStore, setCurrentStore] = useState<StoreProfile | null>(null);
  const [loadingStore, setLoadingStore] = useState(!!storeSlug);
  const [storeError, setStoreError] = useState<{message: string, isSuspended: boolean} | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [categories, setCategories] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'fail'>('checking');
  
  // Diagnostic backend check
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const resp = await fetch('/api-health', { 
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (resp.ok) {
            setBackendStatus('ok');
            console.log('%c[BACKEND] OK - Rotas de API ativas.', 'color: #10b981; font-weight: bold;');
        } else {
            setBackendStatus('fail');
            console.error('[BACKEND] Erro 404/Fail - O servidor não está respondendo corretamente.');
        }
      } catch (e) {
        setBackendStatus('fail');
        console.error('[BACKEND] Erro crítico de conexão com o servidor.', e);
      }
    };
    checkBackend();
  }, []);

  const [adminUser, setAdminUser] = useState<Waitstaff | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Error parsing session:", e);
      return null;
    }
  });

  const [activeTable, setActiveTable] = useState<string | null>(null);
  const initialLoadRef = useRef(true);
  const ordersRef = useRef<Order[]>([]);
  const syncIntervalRef = useRef<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSetUser = (user: Waitstaff | null) => {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
    setAdminUser(user);
  };

  // Security: Ensure user session matches current store
  useEffect(() => {
    if (adminUser && currentStore && adminUser.store_id && adminUser.store_id !== currentStore.id) {
      const protectedPaths = ['/pdv', '/atendimento', '/entregas', '/cozinha', '/tv'];
      const isAdminPath = location.pathname === '/' || location.pathname.startsWith('/pedidos') || location.pathname.startsWith('/cardapio-admin');
      
      if (protectedPaths.includes(location.pathname) || isAdminPath) {
        console.warn("Security: User store mismatch detected. Clearing session.");
        handleSetUser(null);
      }
    }
  }, [adminUser, currentStore, location.pathname]);

  const playAudio = (url: string) => {
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.play().catch(e => console.warn('Som bloqueado:', e));
  };

  const applyColors = useCallback((s: StoreSettings) => {
    document.documentElement.style.setProperty('--primary-color', s.primaryColor || '#001F3F');
    document.documentElement.style.setProperty('--secondary-color', s.secondaryColor || '#FFD700');
  }, []);

  useEffect(() => {
    if (storeSlug) {
      fetchStoreContext(storeSlug);
    } else {
      setLoadingStore(false);
      applyColors(INITIAL_SETTINGS);
      (supabase as any).disconnectStore();
    }
  }, [storeSlug, applyColors]);

  const fetchStoreContext = async (slug: string) => {
    setLoadingStore(true);
    try {
      // Normalize slug to lowercase to avoid case-sensitivity issues
      const normalizedSlug = slug.toLowerCase();

      // Try to get from cache first if offline or just to show something fast
      const cachedStore = localStorage.getItem(`store_profile_${normalizedSlug}`);
      if (cachedStore) {
          try {
              const parsed = JSON.parse(cachedStore);
              const mergedSettings = { ...INITIAL_SETTINGS, ...(parsed.settings || {}) };
              setCurrentStore(parsed);
              setSettings(mergedSettings);
              applyColors(mergedSettings);
              
              if (parsed.dbUrl && parsed.dbAuthToken) {
                  (supabase as any).connectToStore(parsed.dbUrl, parsed.dbAuthToken);
                  // Run cleanup in background
                  (supabase as any).cleanupOldCashHistory(parsed.id, 40);
              } else {
                  (supabase as any).disconnectStore();
              }
          } catch (e) {
              console.error("Error parsing cached store:", e);
          }

          if (!navigator.onLine) {
              setLoadingStore(false);
              return;
          }
      }

      if (!navigator.onLine) {
          if (!cachedStore) setStoreError({message: 'Sem conexão com a internet.', isSuspended: false});
          setLoadingStore(false);
          return;
      }

      console.log(`Fetching store profile for slug: ${normalizedSlug}`);

      const { data, error } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('slug', normalizedSlug)
        .maybeSingle();

      if (error) {
          console.error("Error fetching store:", error);
          throw error;
      }
      
      if (!data) {
        console.warn(`Store not found for slug: ${normalizedSlug}`);
        setStoreError({message: `Loja não encontrada (slug: ${normalizedSlug}). Verifique o endereço.`, isSuspended: false});
      } else if (!data.isActive && data.isactive !== true) {
        setStoreError({message: 'Esta conta está temporariamente suspensa.', isSuspended: true});
      } else {
        const storeData = data as any;
        let parsedSettings = {};
        if (typeof storeData.settings === 'string') {
            try {
                parsedSettings = JSON.parse(storeData.settings);
            } catch (e) {
                console.error("Error parsing store settings:", e);
            }
        } else if (storeData.settings) {
            parsedSettings = storeData.settings;
        }
        
        const mergedSettings = { ...INITIAL_SETTINGS, ...parsedSettings };
        
        const fullStoreData = { 
          ...storeData, 
          isActive: storeData.isActive ?? storeData.isactive ?? true,
          settings: mergedSettings 
        };

        setCurrentStore(fullStoreData);
        setSettings(mergedSettings);
        applyColors(mergedSettings);
        
        // Connect to specific DB if configured
        if (fullStoreData.dbUrl && fullStoreData.dbAuthToken) {
            console.log("Connecting to dedicated DB for store:", fullStoreData.name);
            (supabase as any).connectToStore(fullStoreData.dbUrl, fullStoreData.dbAuthToken);
            // Run cleanup in background
            (supabase as any).cleanupOldCashHistory(fullStoreData.id, 40);
        }

        // Cache store profile
        localStorage.setItem(`store_profile_${normalizedSlug}`, JSON.stringify(fullStoreData));
        localStorage.setItem('storeId', fullStoreData.id);
      }
    } catch (err: any) {
      console.error("Critical error loading store:", err);
      setStoreError({message: 'Erro ao carregar unidade. Tente recarregar a página.', isSuspended: false});
    } finally {
      setLoadingStore(false);
    }
  };

  const mapOrderFromDb = useCallback((dbOrder: any): Order => {
    let items = [];
    if (typeof dbOrder.items === 'string') {
        try {
            items = JSON.parse(dbOrder.items);
        } catch (e) {
            console.error("Error parsing items for order", dbOrder.id, e);
        }
    } else if (Array.isArray(dbOrder.items)) {
        items = dbOrder.items;
    }

    return {
      id: dbOrder.id ? dbOrder.id.toString() : crypto.randomUUID(),
      type: dbOrder.type || 'BALCAO',
      items: items,
      status: dbOrder.status || 'NOVO',
      total: Number(dbOrder.total || 0),
      createdAt: Number(dbOrder.createdAt || dbOrder.createdat || dbOrder.created_at || Date.now()),
      tableNumber: dbOrder.tableNumber || dbOrder.tablenumber || dbOrder.table_number,
      customerName: dbOrder.customerName || dbOrder.customername || dbOrder.customer_name,
      customerPhone: dbOrder.customerPhone || dbOrder.customerphone || dbOrder.customer_phone,
      deliveryAddress: dbOrder.deliveryAddress || dbOrder.deliveryaddress || dbOrder.delivery_address,
      paymentMethod: dbOrder.paymentMethod || dbOrder.paymentmethod || dbOrder.payment_method,
      notes: dbOrder.notes,
      changeFor: Number(dbOrder.changeFor || dbOrder.changefor || dbOrder.change_for || 0),
      waitstaffName: dbOrder.waitstaffName || dbOrder.waitstaffname || dbOrder.waitstaff_name,
      couponApplied: dbOrder.couponApplied || dbOrder.couponapplied || dbOrder.coupon_applied,
      discountAmount: Number(dbOrder.discountAmount || dbOrder.discountamount || dbOrder.discount_amount || 0),
      isSynced: true,
      deliveryDriverId: dbOrder.deliveryDriverId || dbOrder.deliverydriverid || dbOrder.delivery_driver_id,
      displayId: (dbOrder.displayId || dbOrder.displayid || dbOrder.display_id)?.toString(),
      paymentDetails: dbOrder.paymentDetails || dbOrder.paymentdetails || dbOrder.payment_details,
      referencePoint: dbOrder.referencePoint || dbOrder.referencepoint || dbOrder.reference_point,
      session_id: dbOrder.session_id,
      deliveryFee: Number(dbOrder.deliveryFee || dbOrder.deliveryfee || dbOrder.delivery_fee || 0),
      serviceFee: Number(dbOrder.serviceFee || dbOrder.servicefee || dbOrder.service_fee || 0),
      originAddress: dbOrder.originAddress || dbOrder.originaddress || dbOrder.origin_address,
      customerId: dbOrder.customerId || dbOrder.customerid || dbOrder.customer_id,
      stockDeducted: dbOrder.stockDeducted === 1 || dbOrder.stockdeducted === 1 || dbOrder.stock_deducted === 1 || dbOrder.stockDeducted === true || dbOrder.stockdeducted === true || dbOrder.stock_deducted === true
    };
  }, []);

  const mapProductFromDb = useCallback((p: any): Product => ({
    id: p.id ? p.id.toString() : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)),
    name: p.name || 'Sem nome',
    description: p.description || '',
    price: Number(p.price || 0),
    category: p.category || 'Geral',
    imageUrl: p.imageUrl || p.imageurl || p.image_url || '',
    isActive: p.isActive ?? p.isactive ?? p.is_active ?? true,
    featuredDay: p.featuredDay ?? p.featuredday ?? p.featured_day,
    isByWeight: p.isByWeight ?? p.isbyweight ?? p.is_by_weight ?? false,
    showInMenu: p.showInMenu ?? p.showinmenu ?? p.show_in_menu ?? true,
    barcode: p.barcode || undefined,
    stock: p.stock != null ? Number(p.stock) : undefined,
    fractions: p.fractions != null ? Number(p.fractions) : undefined,
    units: p.units != null ? Number(p.units) : undefined,
    fractionPrice: p.fractionPrice != null || p.fractionprice != null || p.fraction_price != null ? Number(p.fractionPrice || p.fractionprice || p.fraction_price) : undefined,
    ncm: p.ncm || undefined,
    cfop: p.cfop || undefined,
    icms_situacao_tributaria: p.icms_situacao_tributaria || p.icms_situacaotributaria || undefined,
    complements: (() => {
      if (!p.complements) return undefined;
      try {
        return typeof p.complements === 'string' ? JSON.parse(p.complements) : p.complements;
      } catch (e) {
        return undefined;
      }
    })()
  }), []);

  const [ecosystemUsage, setEcosystemUsage] = useState({
    ordersThisMonth: 0,
    productsCount: 0,
    usersCount: 0
  });

  const loadEcosystemUsage = useCallback(async () => {
    if (!currentStore) return;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const [ordersRes, productsRes, usersRes] = await Promise.all([
       supabase.from('orders').select('id').eq('store_id', currentStore.id).gte('createdAt', startOfMonth),
       supabase.from('products').select('id').eq('store_id', currentStore.id),
       supabase.from('waitstaff').select('id').eq('store_id', currentStore.id)
    ]);
    setEcosystemUsage({
       ordersThisMonth: ordersRes.data?.length || 0,
       productsCount: productsRes.data?.length || 0,
       usersCount: (usersRes.data?.length || 0) + 1 // Add 1 for the main store owner account
    });
  }, [currentStore]);

  useEffect(() => {
    loadEcosystemUsage();
  }, [loadEcosystemUsage]);

  const syncOrders = useCallback(async () => {
    if (!currentStore) return;
    if (document.hidden) return; 
    if (!navigator.onLine) return;

    setIsSyncing(true);
    try {
      console.log("Syncing orders for store:", currentStore.id);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', currentStore.id)
        .order('createdAt', { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error syncing orders:", error);
        throw error;
      }
      
      console.log("Orders fetched:", data?.length);

      if (data) {
        const newOrders = data.map(mapOrderFromDb);
        if (!initialLoadRef.current) {
          if (newOrders.length > ordersRef.current.length) playAudio(SOUNDS.NEW_ORDER);
          newOrders.forEach(no => {
            const old = ordersRef.current.find(oo => oo.id === no.id);
            if (old && old.status !== 'PRONTO' && no.status === 'PRONTO') playAudio(SOUNDS.ORDER_READY);
          });
        }
        ordersRef.current = newOrders;
        setOrders(newOrders);
        
        localStorage.setItem(`${ORDERS_CACHE_KEY}_${currentStore.id}`, JSON.stringify(newOrders));
        
        initialLoadRef.current = false;
        setLastSyncTime(Date.now());
      }
    } catch (err) { console.warn('Erro Sync', err); }
    finally { setIsSyncing(false); }
  }, [currentStore, mapOrderFromDb]);

  useEffect(() => {
    if (!currentStore) return;

    // Load orders from cache immediately
    const cachedOrders = localStorage.getItem(`${ORDERS_CACHE_KEY}_${currentStore.id}`);
    if (cachedOrders) {
        try {
            const parsed = JSON.parse(cachedOrders);
            setOrders(parsed);
            ordersRef.current = parsed;
        } catch (e) {
            console.error("Error parsing cached orders:", e);
        }
    }

    const fetchMetadata = async () => {
      if (!navigator.onLine || !currentStore) return;

      try {
        const [pRes, cRes] = await Promise.all([
          supabase.from('products').select('*').eq('store_id', currentStore.id),
          supabase.from('categories').select('*').eq('store_id', currentStore.id)
        ]);
        
        if (pRes.error) {
            console.error("Error fetching products:", pRes.error);
            alert(`Erro ao buscar produtos: ${pRes.error.message || JSON.stringify(pRes.error)}`);
        } else if (pRes.data) {
          const mappedP = pRes.data.map(mapProductFromDb);
          setProducts(mappedP);
        }

        if (cRes.error) {
            console.error("Error fetching categories:", cRes.error);
        } else if (cRes.data) {
          const cats = cRes.data.map((c: any) => c.name);
          setCategories(cats);
        }
      } catch (err: any) {
          console.error("Error fetching metadata:", err);
      }
    };

    fetchMetadata();
    syncOrders();

    const startPolling = () => {
      const syncs = settings?.syncIntervals;
      let intervalSec = 20;

      if (location.pathname.includes('/cozinha')) intervalSec = syncs?.kitchen || 20;
      else if (location.pathname.includes('/tv')) intervalSec = syncs?.tv || 20;
      else if (location.pathname.includes('/atendimento')) intervalSec = syncs?.waitress || 20;
      else if (location.pathname === '/' || location.pathname.includes('/pedidos')) intervalSec = syncs?.admin || 20;
      
      const intervalMs = intervalSec * 1000;
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = setInterval(syncOrders, intervalMs); 
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      } else {
        syncOrders();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentStore, mapOrderFromDb, mapProductFromDb, syncOrders, settings?.syncIntervals, location.pathname]);

  const addOrder = async (order: Order) => {
    if (settings?.maxOrdersPerMonth) {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const { data } = await supabase
        .from('orders')
        .select('id')
        .eq('store_id', currentStore?.id)
        .gte('createdAt', startOfMonth);
        
      if (data && data.length >= settings.maxOrdersPerMonth) {
        alert("Seu limite máximo de pedidos para este mês foi atingido. Entre em contato com seu consultor para fazer um upgrade do seu plano.");
        // We dispatch a custom event to show upgrade modal globally if needed, or returning early handles the block.
        return false;
      }
    }

    const dbOrder = {
      id: Number(order.id),
      store_id: currentStore?.id,
      type: order.type,
      items: JSON.stringify(order.items),
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      notes: order.notes,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerId: order.customerId,
      deliveryAddress: order.deliveryAddress,
      referencePoint: order.referencePoint,
      paymentMethod: order.paymentMethod,
      waitstaffName: order.waitstaffName,
      changeFor: order.changeFor,
      couponApplied: order.couponApplied,
      discountAmount: order.discountAmount,
      deliveryFee: order.deliveryFee,
      serviceFee: order.serviceFee,
      originAddress: order.originAddress,
      paymentDetails: order.paymentDetails,
      displayId: order.displayId,
      session_id: order.session_id,
      deliveryDriverId: order.deliveryDriverId,
      stockDeducted: order.stockDeducted !== false ? 1 : 0
    };
    await supabase.from('orders').insert([dbOrder]);
  };

  const pendingStatusUpdates = useRef(new Set<string>());
  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    if (pendingStatusUpdates.current.has(id + status)) return;
    pendingStatusUpdates.current.add(id + status);

    try {
      console.log("Updating order status:", id, status);
      
      // Always fetch the latest order from the database to ensure we have the correct items
      const { data: latestOrderData, error: fetchError } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
      
      // If the order was deleted from the database (e.g., merged into another order), 
      // we should NOT restore its stock, because the merged order already contains its items.
      if (!latestOrderData && !id.startsWith('local_')) {
          console.warn(`Order ${id} not found in database. It may have been merged and deleted. Skipping stock restoration.`);
          return;
      }

      let order = latestOrderData ? mapOrderFromDb(latestOrderData) : orders.find(o => o.id === id);

      if (order && status === 'CANCELADO' && order.status !== 'CANCELADO') {
        // Prevent race conditions by updating the DB first and checking if it was actually updated
        const { data: updatedOrders, error: updateError } = await supabase
            .from('orders')
            .eq('id', id)
            .neq('status', 'CANCELADO')
            .update({ status: 'CANCELADO' });

        if (updateError) {
            console.error("Error updating order status:", updateError);
            alert("Erro ao atualizar o status do pedido no banco de dados.");
            return;
        }

        const updatedOrder = updatedOrders && updatedOrders.length > 0 ? updatedOrders[0] : null;

        // If updatedOrder is null, it means the order was already CANCELADO in the DB by another process
        if (!updatedOrder && !id.startsWith('local_')) {
            console.warn(`Order ${id} was already cancelled in the database. Skipping stock restoration.`);
            // Still update local state just in case
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
            return;
        }

        // Group items by productId to avoid double restoration
        if (order.stockDeducted !== false) {
            const stockRestoration = new Map<string, number>();
            for (const item of order.items) {
                const targetProductId = item.originalProductId || item.productId;
                const current = stockRestoration.get(targetProductId) || 0;
                stockRestoration.set(targetProductId, current + Number(item.quantity || 0));

                // Restore complements stock
                if (item.complements && item.complements.length > 0) {
                    for (const cp of item.complements) {
                        const cpCurrent = stockRestoration.get(cp.itemId) || 0;
                        stockRestoration.set(cp.itemId, cpCurrent + (Number(cp.quantity || 0) * Number(item.quantity || 0)));
                    }
                }
            }

            for (const [productId, quantity] of stockRestoration.entries()) {
                // Fetch the latest stock from the database to avoid using stale state
                const { data: latestProduct, error: productError } = await supabase
                    .from('products')
                    .select('stock')
                    .eq('id', productId)
                    .maybeSingle();

                if (latestProduct && latestProduct.stock != null) {
                    const newStock = Number(latestProduct.stock) + quantity;
                    await supabase
                        .from('products')
                        .eq('id', productId)
                        .update({ stock: newStock });
                        
                    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
                }
            }
        }
          
          // Revert cashback if applicable
          if (order.customerId && settings.isCashbackActive) {
              try {
                  const payments = JSON.parse(order.paymentDetails || '[]');
                  const cashbackUsed = payments.find((p: any) => p.method === 'CASHBACK')?.amount || 0;
                  const cashbackPercentage = Number(settings.cashbackPercentage) || 0;
                  const cashbackEarned = Number(order.total) * (cashbackPercentage / 100);
                  
                  if (cashbackEarned > 0 || cashbackUsed > 0) {
                      const { data: customerData } = await supabase.from('customers').eq('id', order.customerId).maybeSingle();
                      if (customerData) {
                          const currentPoints = Number(customerData.points || 0);
                          // Revert: subtract earned, add back used
                          const newPoints = Math.max(0, currentPoints - cashbackEarned + cashbackUsed);
                          await supabase.from('customers').eq('id', order.customerId).update({ points: newPoints });
                      }
                  }
              } catch (e) {
                  console.error("Erro ao reverter cashback:", e);
              }
          }
          
          // Update local state
          setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      } else if (order && status === 'ENTREGUE' && order.stockDeducted === false) {
          // Deduct stock if it wasn't deducted yet
          let updatePayload: any = { status, stockDeducted: 1 };
          
          if ((status === 'ENTREGUE') && !id.startsWith('local_')) {
              let hasOpenSession = false;
              if (currentStore?.id) {
                  const { data: openSessions } = await supabase
                      .from('register_sessions')
                      .select('id')
                      .eq('store_id', currentStore.id)
                      .eq('status', 'OPEN')
                      .gte('opened_at', Date.now() - 16 * 60 * 60 * 1000)
                      .limit(1);
                  hasOpenSession = openSessions && openSessions.length > 0;
              }
                  
              if (!hasOpenSession) {
                  updatePayload.session_id = 'FECHADO';
              }
          }

          if (!id.startsWith('local_')) {
              const { data: updatedOrders, error: updateError } = await supabase
                  .from('orders')
                  .eq('id', id)
                  .update(updatePayload);

              if (updateError) {
                  console.error("Error updating order status:", updateError);
                  alert("Erro ao atualizar o status do pedido.");
                  return;
              }
              
              if (!updatedOrders || updatedOrders.length === 0) {
                  console.warn("Nenhum pedido foi atualizado. Ele pode ter sido removido ou modificado por outro usuário.");
              }
          }

          const stockDeduction = new Map<string, number>();
          for (const item of order.items) {
              const targetProductId = item.originalProductId || item.productId;
              const current = stockDeduction.get(targetProductId) || 0;
              stockDeduction.set(targetProductId, current + Number(item.quantity || 0));

              // Deduct complements stock if they exist as products
              if (item.complements && item.complements.length > 0) {
                  for (const cp of item.complements) {
                      const cpCurrent = stockDeduction.get(cp.itemId) || 0;
                      stockDeduction.set(cp.itemId, cpCurrent + (Number(cp.quantity || 0) * Number(item.quantity || 0)));
                  }
              }
          }

          for (const [productId, quantity] of stockDeduction.entries()) {
              const { data: latestProduct } = await supabase
                  .from('products')
                  .select('stock')
                  .eq('id', productId)
                  .maybeSingle();

              if (latestProduct && latestProduct.stock != null) {
                  const newStock = Number(latestProduct.stock) - quantity;
                  await supabase
                      .from('products')
                      .eq('id', productId)
                      .update({ stock: newStock });
                      
                  setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
              }
          }
          
          setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updatePayload, stockDeducted: true } : o));
      } else {
          // For other statuses, just update normally
          let updatePayload: any = { status };
          
          if ((status === 'ENTREGUE') && !id.startsWith('local_')) {
              // Check if there's an open POS session
              let hasOpenSession = false;
              if (currentStore?.id) {
                  const { data: openSessions } = await supabase
                      .from('register_sessions')
                      .select('id')
                      .eq('store_id', currentStore.id)
                      .eq('status', 'OPEN')
                      .gte('opened_at', Date.now() - 16 * 60 * 60 * 1000)
                      .limit(1);
                  hasOpenSession = openSessions && openSessions.length > 0;
              }
                  
              if (!hasOpenSession) {
                  // No open session. Set session_id to 'FECHADO' so it doesn't show as pending in POS.
                  updatePayload.session_id = 'FECHADO';
              }
          }

          setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updatePayload } : o));
          if (!id.startsWith('local_')) {
              const { error } = await supabase.from('orders').eq('id', id).update(updatePayload);
              if (error) {
                  console.error("Erro ao atualizar status:", error);
                  alert("Erro ao sincronizar atualização de status com o servidor.");
              }
          }
      }
    } finally {
      pendingStatusUpdates.current.delete(id + status);
    }
  };

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    try {
      // Local check if ID is local_ but usually we update persisted ones
      if (id.startsWith('local_')) return;

      const { error } = await supabase.from('orders').eq('id', id).update(updates);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    } catch (err) {
      console.error("Erro ao atualizar pedido:", err);
    }
  }, []);

  const handleUpdateSettings = async (newSettings: StoreSettings) => {
    if (currentStore) {
      await supabase.from('store_profiles').eq('id', currentStore.id).update({ settings: JSON.stringify(newSettings) });
      const updatedStore = { ...currentStore, settings: newSettings };
      setCurrentStore(updatedStore);
      
      // Update cache so reloads don't use stale data
      const normalizedSlug = currentStore.slug?.toLowerCase();
      if (normalizedSlug) {
        localStorage.setItem(`store_profile_${normalizedSlug}`, JSON.stringify(updatedStore));
      }
    }
    setSettings(newSettings);
    applyColors(newSettings);
  };

  if (loadingStore) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-secondary" size={48} /></div>;

  if (storeError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm space-y-6">
           <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
             {storeError.isSuspended ? <AlertTriangle size={48} className="text-red-500" /> : <ShieldAlert size={48} className="text-red-500" />}
           </div>
           <h1 className="text-2xl font-brand font-bold text-slate-800">
             {storeError.isSuspended ? 'Conta Suspensa' : 'Acesso Restrito'}
           </h1>
           <p className="text-slate-400 font-medium leading-relaxed">{storeError.message}</p>
           
           {storeError.isSuspended ? (
             <a 
              href="https://wa.me/5585987582159" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
             >
               <MessageCircle size={20} /> Falar com o Suporte
             </a>
           ) : (
             <button 
               onClick={() => window.location.href = window.location.origin} 
               className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-black transition-colors"
             >
               Voltar ao Início
             </button>
           )}
        </div>
      </div>
    );
  }

  const lojaParam = storeSlug ? `?loja=${storeSlug}` : '';
  const loginRedirect = `/login${lojaParam}${lojaParam ? '&' : '?'}view=login`;

  // Ecosystem Firewall: Restrict access to 管理/POS routes
  // Except for Digital Menu and Public Success pages
  const isPublicPath = location.pathname.startsWith('/cardapio') || location.pathname === '/pagamento-ok' || location.pathname === '/login';
  
  if (checkingAuth) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-secondary" size={48} /></div>;

  // If not on a public path, and not a Master Google user, redirect or block
  if (!isPublicPath) {
    if (!googleUser) {
      return <Navigate to={`/login${lojaParam}`} replace />;
    }
    if (!isMaster) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert size={48} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-brand font-bold text-slate-800">Acesso Restrito</h1>
            <p className="text-slate-400 font-medium leading-relaxed">
              Esta área é reservada para a administração master. Sua conta ({googleUser.email}) não tem permissão de acesso.
            </p>
            <button 
              onClick={handleGoogleLogout}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-black transition-colors"
            >
              Trocar de Conta
            </button>
            <Link 
              to={`/cardapio${lojaParam}`}
              className="block mt-4 text-xs font-bold text-slate-300 uppercase tracking-widest"
            >
              Ir para o Cardápio
            </Link>
          </div>
        </div>
      );
    }
  }

  return (
    <Routes>
      <Route path="/atendimento" element={
        adminUser && (adminUser.role === 'ATENDENTE' || adminUser.role === 'GERENTE') && adminUser.store_id === currentStore?.id ? (
          <AttendantPanel adminUser={adminUser} orders={orders} settings={settings} onSelectTable={setActiveTable} updateStatus={updateOrderStatus} onLogout={() => handleSetUser(null)} isOffline={isOffline} />
        ) : (
          <Navigate to={`/login${lojaParam}${lojaParam ? '&' : '?'}role=atendente`} replace />
        )
      } />
      <Route path="/cozinha" element={
        adminUser && (adminUser.role === 'ATENDENTE' || adminUser.role === 'GERENTE') && adminUser.store_id === currentStore?.id ? (
          <KitchenBoard orders={orders} updateStatus={updateOrderStatus} />
        ) : (
          <Navigate to={loginRedirect} replace />
        )
      } />
      <Route path="/tv" element={
        adminUser && (adminUser.role === 'ATENDENTE' || adminUser.role === 'GERENTE') && adminUser.store_id === currentStore?.id ? (
          <TVBoard orders={orders} settings={settings} products={products} />
        ) : (
          <Navigate to={loginRedirect} replace />
        )
      } />
      <Route path="/cardapio/*" element={<DigitalMenu storeId={currentStore?.id} products={products} categories={categories} settings={settings} orders={orders} addOrder={addOrder} tableNumber={activeTable} onLogout={() => setActiveTable(null)} isWaitstaff={!!adminUser} ecosystemUsage={ecosystemUsage} refreshEcosystemUsage={loadEcosystemUsage} />} />
      <Route path="/master" element={<SuperAdminPanel />} />
      <Route path="/login" element={<LoginPage onLoginSuccess={handleSetUser} onGoogleLogin={handleGoogleLogin} isGoogleAuthenticated={!!googleUser} />} />

      <Route path="/pagamento-ok" element={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center space-y-4 border border-gray-100">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Pagamento Autorizado</h1>
            <p className="text-gray-500 text-sm">O processamento foi concluído. Você já pode fechar esta aba e retornar ao PDV principal.</p>
            <button 
              onClick={() => window.close()}
              className="mt-6 w-full py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-colors"
            >
              Fechar Aba
            </button>
          </div>
        </div>
      } />
      <Route path="/pdv" element={
        adminUser && (adminUser.role === 'ATENDENTE' || adminUser.role === 'GERENTE') && adminUser.store_id === currentStore?.id ? (
          <POS 
            storeId={currentStore?.id || ''} 
            user={adminUser} 
            settings={settings}
            onLogout={() => handleSetUser(null)}
            updateStatus={updateOrderStatus}
            isOffline={isOffline}
            ecosystemUsage={ecosystemUsage}
            refreshEcosystemUsage={loadEcosystemUsage}
          />
        ) : (
          <Navigate to={loginRedirect} replace />
        )
      } />

      <Route path="/entregas" element={
        adminUser && (adminUser.role === 'ENTREGADOR' || adminUser.role === 'GERENTE') && adminUser.store_id === currentStore?.id ? (
          <DeliveryPanel 
            storeId={currentStore?.id || adminUser.store_id || ''} 
            user={adminUser} 
            settings={settings}
            storeSlug={storeSlug || ''}
            onLogout={() => handleSetUser(null)}
          />
        ) : (
          <Navigate to={`/login${lojaParam}${lojaParam ? '&' : '?'}role=entregador`} replace />
        )
      } />

      <Route path="/" element={
        !storeSlug ? <SuperAdminPanel /> : (
          adminUser && adminUser.store_id === currentStore?.id ? (
            adminUser.role === 'GERENTE' ? 
              <AdminLayout settings={settings} onLogout={() => handleSetUser(null)} /> : 
              adminUser.role === 'ENTREGADOR' ?
                <Navigate to={`/entregas${lojaParam}`} /> :
                <Navigate to={`/atendimento${lojaParam}`} />
          ) : <Navigate to={loginRedirect} />
        )
      }>
        <Route index element={<AdminDashboard orders={orders} products={products} settings={settings} storeId={currentStore?.id} onLogout={() => handleSetUser(null)} />} />
        <Route path="cardapio-admin" element={<MenuManagement ecosystemUsage={ecosystemUsage} refreshEcosystemUsage={loadEcosystemUsage} settings={settings} storeId={currentStore?.id} products={products} saveProduct={async (p) => { 
          const payload: any = { ...p, store_id: currentStore?.id };
          if (payload.complements !== undefined) {
             payload.complements = payload.complements ? JSON.stringify(payload.complements) : null;
          }
          if (!payload.id) delete payload.id;

          // NeonBridge upsert returns { data: [result], error } directly. No .select() needed.
          const { data, error } = await supabase.from('products').upsert([payload]);
          if (error) {
              alert(`Erro na API ao salvar produto: ${error.message || JSON.stringify(error)}`);
              throw error;
          }

          if (data && data.length > 0) {
            const savedProduct = mapProductFromDb(data[0]);
            setProducts(prev => {
              const exists = prev.find(item => item.id === savedProduct.id);
              if (exists) {
                return prev.map(item => item.id === savedProduct.id ? savedProduct : item);
              }
              return [...prev, savedProduct];
            });
          }
        }} deleteProduct={async (id) => {
          const { error } = await supabase.from('products').eq('id', id).delete();
          if (error) throw error;

          // Update local state immediately
          setProducts(prev => prev.filter(item => item.id !== id));
        }} categories={categories} setCategories={setCategories} onCategoryChange={() => {
          // No cache to clear
        }} />} />
        <Route path="pedidos" element={<OrdersList orders={orders} updateStatus={updateOrderStatus} products={products} addOrder={addOrder} settings={settings} updateOrder={updateOrder} />} />
        <Route path="equipe" element={<WaitstaffManagement ecosystemUsage={ecosystemUsage} refreshEcosystemUsage={loadEcosystemUsage} currentStore={currentStore!} settings={settings} onUpdateSettings={handleUpdateSettings} />} />
        <Route path="clientes" element={<CustomerManagement storeId={currentStore?.id} />} />
        <Route path="integracoes" element={<IntegrationsPage settings={settings} onSave={handleUpdateSettings} />} />
        <Route path="configuracoes" element={<StoreSettingsPage settings={settings} products={products} onSave={handleUpdateSettings} storeId={currentStore?.id} />} />
      </Route>

      <Route path="*" element={<Navigate to={storeSlug ? `/cardapio${lojaParam}` : "/"} />} />
    </Routes>
  );
}

function AdminLayout({ settings, onLogout }: { settings: StoreSettings, onLogout: () => void }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const storeSlug = useMemo(() => searchParams.get('loja'), [searchParams]);
  const lojaParam = storeSlug ? `?loja=${storeSlug}` : '';

  const menuItems = [
    { to: `/${lojaParam}`, label: 'Início', icon: <LayoutDashboard size={20} /> },
    { to: `/pedidos${lojaParam}`, label: 'Pedidos', icon: <ShoppingCart size={20} /> },
    { to: `/cardapio-admin${lojaParam}`, label: 'Menu', icon: <PlusCircle size={20} /> },
    { to: `/equipe${lojaParam}`, label: 'Time', icon: <Users size={20} /> },
    { to: `/clientes${lojaParam}`, label: 'Clientes', icon: <UserRound size={20} /> },
    { to: `/integracoes${lojaParam}`, label: 'Integrações', icon: <Zap size={20} /> },
    { to: `/configuracoes${lojaParam}`, label: 'Ajustes', icon: <Settings size={20} /> },
  ];

  const handleFullLogout = () => {
    onLogout();
    signOut(auth);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 pb-20 md:pb-0 text-zinc-900">
      {/* Mobile Header */}
      <header className="md:hidden bg-primary text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-md no-print">
        <div className="flex items-center gap-3">
          <img src={settings.logoUrl} className="w-8 h-8 rounded-full border border-secondary object-cover" alt="Logo" />
          <span className="font-brand font-bold truncate max-w-[150px]">{settings.storeName}</span>
        </div>
        <button onClick={handleFullLogout} className="p-2 bg-white/10 rounded-xl text-red-400 hover:bg-white/20 transition-all">
          <LogOut size={20} />
        </button>
      </header>

      <aside className="w-64 bg-primary text-white hidden md:flex flex-col border-r border-black/10 no-print">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <img src={settings.logoUrl} className="w-10 h-10 rounded-full border-2 border-secondary object-cover" alt="Logo" />
          <span className="font-brand text-lg font-bold truncate">{settings.storeName}</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map(item => (
            <Link key={item.to} to={item.to} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${location.pathname + location.search === item.to ? 'bg-secondary' : 'hover:bg-white/5'}`}>
              {item.icon} {item.label}
            </Link>
          ))}
          <div className="pt-6 pb-2 px-3 text-[10px] text-white/40 font-bold uppercase tracking-widest">Atalhos Externos</div>
          <a href={`#/pdv${lojaParam}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-green-400 font-bold"><ShoppingCart size={20} /> PDV / Caixa</a>
          <a href={`#/entregas${lojaParam}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-blue-400 font-bold"><Truck size={20} /> Entregas</a>
          <a href={`#/atendimento${lojaParam}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-orange-400 font-bold"><UserRound size={20} /> Atendimento</a>
          <a href={`#/cardapio${lojaParam}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-secondary"><Utensils size={20} /> Cardápio</a>
          <a href={`#/cozinha${lojaParam}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300"><ChefHat size={20} /> Produção</a>
          <a href={`#/tv${lojaParam}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 text-gray-300"><Tv size={20} /> Painel TV</a>
        </nav>
        <div className="p-4 border-t border-white/10"><button onClick={handleFullLogout} className="w-full flex items-center gap-3 p-3 text-red-400 font-bold"><LogOut size={18} /> Sair</button></div>
      </aside>
      <main className="flex-1 overflow-auto md:p-8 p-4 bg-gray-50"><Outlet /></main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t h-20 md:hidden flex items-center overflow-x-auto no-scrollbar z-50 no-print px-2">
        {menuItems.map(item => (
          <Link key={item.to} to={item.to} className={`flex flex-col items-center justify-center gap-1 flex-shrink-0 min-w-[72px] h-full ${location.pathname + location.search === item.to ? 'text-secondary' : 'text-gray-400'}`}>
            {item.icon}
            <span className="text-[9px] font-bold uppercase truncate w-full text-center px-1">{item.label}</span>
          </Link>
        ))}
        <a href={`#/entregas${lojaParam}`} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-1 flex-shrink-0 min-w-[72px] h-full text-blue-500">
          <Truck size={20} />
          <span className="text-[9px] font-bold uppercase truncate w-full text-center px-1">Entregas</span>
        </a>
        <button onClick={handleFullLogout} className="flex flex-col items-center justify-center gap-1 flex-shrink-0 min-w-[72px] h-full text-red-500">
          <LogOut size={20} />
          <span className="text-[9px] font-bold uppercase truncate w-full text-center px-1">Sair</span>
        </button>
      </nav>
    </div>
  );
}
