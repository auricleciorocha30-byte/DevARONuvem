
import { Product, StoreSettings } from './types';

export const COLORS = {
  brown: '#3d251e',
  orange: '#f68c3e',
  cream: '#fff5e1',
  text: '#1f2937'
};

export const INITIAL_SETTINGS: StoreSettings = {
  isStoreOpen: true,
  isDeliveryActive: true,
  isTableOrderActive: true,
  isCommandOrderActive: true,
  isCounterPickupActive: true,
  isKitchenActive: true,
  isTvPanelActive: true,
  storeName: 'G & C Conveniência',
  cnpj: '',
  logoUrl: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=400&h=400&fit=crop',
  primaryColor: '#001F3F',
  secondaryColor: '#FFD700',
  canWaitstaffFinishOrder: false,
  canWaitstaffCancelItems: false,
  thermalPrinterWidth: '80mm',
  address: 'Rua das Flores, 123 - Centro',
  whatsapp: '558591076984',
  couponName: 'BEMVINDO',
  couponDiscount: 10,
  isCouponActive: false,
  isCouponForAllProducts: true,
  applicableProductIds: [],
  requirePosFinalization: false
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Café Expresso Premium',
    description: 'Grãos selecionados, torra média e sabor intenso.',
    price: 6.50,
    category: 'Cafeteria',
    imageUrl: 'https://images.unsplash.com/photo-1510972527921-ce03766a1cf1?w=400&h=300&fit=crop',
    isActive: true,
    featuredDay: 1
  }
];
