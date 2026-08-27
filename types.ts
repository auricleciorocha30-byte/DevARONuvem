
export type OrderStatus = 'AGUARDANDO' | 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'PENDENTE' | 'PREPARANDO' | 'PRONTO' | 'ENVIADO_PARA_ENTREGA' | 'CHEGUEI_NA_ORIGEM' | 'SAIU_PARA_ENTREGA' | 'ENTREGUE' | 'RETORNANDO' | 'CANCELADO';
export type OrderType = 'MESA' | 'BALCAO' | 'ENTREGA' | 'COMANDA';
export type PaymentMethod = 'PIX' | 'CARTAO' | 'DINHEIRO' | 'DEBITO' | 'VALES' | 'CASHBACK' | 'MISTO' | 'A_PAGAR' | 'ONLINE' | 'MAQUININHA';

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
  phone?: string;
  role: 'GERENTE' | 'ATENDENTE' | 'ENTREGADOR';
}

export interface ComplementItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
}

export interface ComplementCategory {
  id: string;
  name: string;
  isRequired: boolean;
  minQuantity: number;
  maxQuantity: number;
  items: ComplementItem[];
}

export interface CartComplementItem {
  categoryId: string;
  categoryName: string;
  itemId: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
}

export interface ComboItem {
  productId: string;
  name: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  imageUrl2?: string;
  isActive: boolean;
  showInMenu?: boolean;
  featuredDay?: number;
  featuredDays?: number[];
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
  complements?: ComplementCategory[];
  isCombo?: boolean;
  comboItems?: ComboItem[];
  costPrice?: number;
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
  isCombo?: boolean;
  comboItems?: ComboItem[];
  fractionProducts?: {
    productId: string;
    name: string;
    price: number;
  }[];
  complements?: CartComplementItem[];
  returnedQuantity?: number;
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
  nfce_reference?: string;
  nfce_status?: string;
  customerCpf?: string;
  scheduledTime?: string;
  requiresDeliveryReturn?: boolean;
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
  id?: string;
  slug?: string;
  isStoreOpen?: boolean;
  isDeliveryActive: boolean;
  isTableOrderActive: boolean;
  isCommandOrderActive?: boolean;
  isCounterPickupActive: boolean;
  isKitchenActive?: boolean;
  isTvPanelActive?: boolean;
  isCashbackActive?: boolean;
  shiftAutomation?: boolean;
  operatingHours?: {
    [day: number]: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    };
  };
  businessHours?: string;
  cashbackPercentage?: number;
  minCashbackToUse?: number;
  storeName: string;
  cnpj?: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  tableCount?: number;
  commandCount?: number;
  canWaitstaffFinishOrder: boolean;
  canWaitstaffCancelItems: boolean;
  thermalPrinterWidth: '80mm' | '58mm';
  printWidthPx?: number;
  address?: string;
  cep?: string;
  whatsapp?: string;
  couponName?: string;
  couponDiscount?: number;
  isCouponActive?: boolean;
  isCouponForAllProducts?: boolean;
  applicableProductIds?: string[];
  cashbackScope?: 'all' | 'selected';
  cashbackProductIds?: string[];
  productSpecificDiscounts?: Record<string, number>;
  lastUpdate?: number;
  pixQrCodeUrl?: string;
  usbPrinterVendorId?: number;
  usbPrinterProductId?: number;
  minDeliveryOrderValue?: number;
  requirePosFinalization?: boolean;
  autoApproveDeliveries?: boolean;
  waitstaffCommissions?: Record<string, number>;
  waitstaffLastPaidAt?: Record<string, number>;
  isDeliveryFeeActive?: boolean;
  freeDeliveryToleranceKm?: number;
  deliveryFeeRules?: { upToKm: number; fee: number }[];
  isDeliveryReturnActive?: boolean;
  deliveryReturnPercentage?: number;
  digitalMenuPaymentMethods?: PaymentMethod[];
  allowSchedulingWhenClosed?: boolean;
  
  // Integrações
  focusNfeToken?: string;
  focusNfeEnvironment?: 'production' | 'homologation';
  focusNfeCertificate?: string;
  focusNfeTaxReformActive?: boolean;
  focusNfeIbsAliquot?: number;
  focusNfeCbsAliquot?: number;
  onlinePaymentProvider?: 'mercado_pago';
  onlinePaymentAccessToken?: string;
  onlinePaymentPublicKey?: string;
  mercadoPagoWebhookSecret?: string;
  isOnlinePaymentActive?: boolean;
  mercadoPagoPointDeviceId?: string;
  syncIntervals?: {
    pos?: number;
    waitress?: number;
    kitchen?: number;
    delivery?: number;
    tv?: number;
    admin?: number;
  };
  
  // Limites do Ecossistema
  maxOrdersPerMonth?: number;
  maxProducts?: number;
  maxUsers?: number;
  dataRetentionDays?: number;
  lockedFeatures?: ('ONLINE_PAYMENT' | 'NFE')[];
}
