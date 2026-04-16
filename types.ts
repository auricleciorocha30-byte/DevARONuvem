
export type OrderStatus = 'AGUARDANDO' | 'PREPARANDO' | 'PRONTO' | 'ENVIADO_PARA_ENTREGA' | 'CHEGUEI_NA_ORIGEM' | 'SAIU_PARA_ENTREGA' | 'ENTREGUE' | 'CANCELADO';
export type OrderType = 'MESA' | 'BALCAO' | 'ENTREGA' | 'COMANDA';
export type PaymentMethod = 'PIX' | 'CARTAO' | 'DINHEIRO' | 'DEBITO' | 'VALES' | 'CASHBACK' | 'MISTO' | 'A_PAGAR' | 'ONLINE';

export interface StoreProfile {
  id: string;
  slug: string;
  name: string;
  logoUrl: string;
  address: string;
  whatsapp: string;
  isActive: boolean;
  createdAt: number;
  settings: StoreSettings;
}

export interface Waitstaff {
  id: string;
  store_id?: string;
  name: string;
  password?: string;
  role: 'GERENTE' | 'ATENDENTE' | 'ENTREGADOR';
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  isActive: boolean;
  showInMenu?: boolean;
  featuredDay?: number;
  isByWeight?: boolean;
  store_id?: string;
  barcode?: string;
  stock?: number;
  fractions?: number;
  units?: number;
  fractionPrice?: number;
  ncm?: string;
  cfop?: string;
  icms_situacao_tributaria?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  isByWeight?: boolean;
  isPersisted?: boolean;
  originalQuantity?: number;
  isFractional?: boolean;
  fractions?: number;
  originalProductId?: string;
  fractionProducts?: {
    productId: string;
    name: string;
    price: number;
  }[];
}

export interface Order {
  id: string;
  store_id?: string;
  type: OrderType;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: number;
  paymentMethod?: PaymentMethod;
  deliveryAddress?: string;
  originAddress?: string;
  referencePoint?: string;
  notes?: string;
  changeFor?: number;
  waitstaffName?: string;
  couponApplied?: string;
  discountAmount?: number;
  deliveryFee?: number;
  serviceFee?: number;
  isSynced?: boolean;
  deliveryDriverId?: string;
  displayId?: string;
  paymentDetails?: string; // JSON string of { method: string, amount: number }[]
  session_id?: string;
  stockDeducted?: boolean;
}

export interface CashMovement {
  id: string;
  store_id: string;
  type: 'SANGRIA' | 'SUPRIMENTO' | 'ABERTURA_CAIXA' | 'FECHAMENTO_CAIXA';
  amount: number;
  description: string;
  waitstaffName: string;
  createdAt: number;
  session_id?: string;
}

export interface RegisterSession {
  id: string;
  store_id: string;
  waitstaff_id: string;
  waitstaff_name: string;
  opened_at: number;
  closed_at?: number;
  initial_amount: number;
  closed_amount?: number;
  status: 'OPEN' | 'CLOSED';
}

export interface Customer {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  address?: string;
  referencePoint?: string;
  cpf?: string;
  points: number;
  isLoyaltyParticipant?: boolean;
  createdAt: number;
}

export interface StoreSettings {
  isStoreOpen?: boolean;
  isDeliveryActive: boolean;
  isTableOrderActive: boolean;
  isCommandOrderActive?: boolean;
  isCounterPickupActive: boolean;
  isKitchenActive?: boolean;
  isTvPanelActive?: boolean;
  isCashbackActive?: boolean;
  cashbackPercentage?: number;
  minCashbackToUse?: number;
  storeName: string;
  cnpj?: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  canWaitstaffFinishOrder: boolean;
  canWaitstaffCancelItems: boolean;
  thermalPrinterWidth: '80mm' | '58mm';
  printWidthPx?: number;
  address?: string;
  whatsapp?: string;
  couponName?: string;
  couponDiscount?: number;
  isCouponActive?: boolean;
  isCouponForAllProducts?: boolean;
  applicableProductIds?: string[];
  lastUpdate?: number;
  pixQrCodeUrl?: string;
  usbPrinterVendorId?: number;
  usbPrinterProductId?: number;
  minDeliveryOrderValue?: number;
  requirePosFinalization?: boolean;
  autoApproveDeliveries?: boolean;
  waitstaffCommissions?: Record<string, number>;
  isDeliveryFeeActive?: boolean;
  freeDeliveryToleranceKm?: number;
  deliveryFeeRules?: { upToKm: number; fee: number }[];
  
  // Integrações
  focusNfeToken?: string;
  focusNfeEnvironment?: 'production' | 'homologation';
  focusNfeCertificate?: string;
  onlinePaymentProvider?: 'mercado_pago' | 'pagseguro' | 'asaas';
  onlinePaymentAccessToken?: string;
  onlinePaymentPublicKey?: string;
  isOnlinePaymentActive?: boolean;
}
