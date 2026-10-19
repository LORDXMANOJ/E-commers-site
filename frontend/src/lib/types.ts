export type Role = "CUSTOMER" | "ADMIN";
export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type PaymentMethod = "COD" | "CARD_SIMULATED" | "RAZORPAY";
export type PaymentStatus = "UNPAID" | "PAID" | "REFUND_PENDING" | "REFUNDED";
export type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "FREE_SIZE";
export type Variant = { id: string; size: Size; stock: number };
export type ShippingMethod = "STANDARD" | "EXPRESS";

export type Address = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  address: Address | null;
  createdAt: string;
};

export type CategoryRef = { id: string; name: string; slug: string };

export type Category = CategoryRef & {
  description: string | null;
  imageUrl: string | null;
  productCount: number;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  pricePaise: number;
  compareAtPaise: number | null;
  stock: number;
  images: string[];
  featured: boolean;
  createdAt: string;
  category: CategoryRef;
  /** Sizes in display order. Product.stock is the total across sizes. */
  variants: Variant[];
};

export type AdminProduct = Product & { active: boolean; soldCount: number; categoryId: string; updatedAt: string };

export type Paginated<T> = { items: T[]; page: number; limit: number; total: number; totalPages: number };

/** In a cart line, stock is the stock of the chosen size. */
export type CartProduct = Pick<Product, "id" | "name" | "slug" | "pricePaise" | "compareAtPaise" | "stock" | "images">;

export type CartLine = {
  productId: string;
  variantId: string;
  size: Size;
  quantity: number;
  available: boolean;
  product: CartProduct;
  lineTotalPaise: number;
};

export type Cart = { items: CartLine[]; itemCount: number; subtotalPaise: number };

export type OrderItem = {
  id: string;
  productId: string | null;
  variantId: string | null;
  size: Size | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPaise: number;
  quantity: number;
  lineTotalPaise: number;
};

export type OrderEvent = { id: string; status: OrderStatus; note: string | null; createdAt: string };

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  shippingAddress: Address;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cardLast4: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpayRefundId?: string | null;
  paymentExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderEvent[];
  user?: { id: string; name: string; email: string };
};

export type OrderSummary = Omit<Order, "items" | "events"> & {
  items: Pick<OrderItem, "name" | "imageUrl" | "quantity" | "size">[];
  _count: { items: number };
};

export type AdminOrderRow = Omit<Order, "items" | "events"> & {
  user: { id: string; name: string; email: string };
  _count: { items: number };
};

export type ShippingOptions = {
  freeShippingThresholdPaise: number;
  methods: { id: ShippingMethod; label: string; eta: string; pricePaise: number }[];
};

export type AdminStats = {
  revenuePaise: number;
  orderCount: number;
  pendingCount: number;
  customerCount: number;
  averageOrderPaise: number;
  lowStockThreshold: number;
  lowStock: { id: string; name: string; slug: string; stock: number; images: string[] }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalPaise: number;
    createdAt: string;
    user: { name: string; email: string };
  }[];
  sales: { date: string; revenuePaise: number; orders: number }[];
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  orderCount: number;
  totalSpentPaise: number;
};

/** Returned by checkout (RAZORPAY) and /orders/:id/pay. Public values only, never a secret. */
export type PaymentSession = {
  keyId: string;
  mode: "test" | "live" | "off";
  razorpayOrderId: string;
  amountPaise: number;
  currency: "INR";
  orderId: string;
  orderNumber: string;
  expiresAt: string | null;
};

export type PlacedOrder = Order & { payment?: PaymentSession };

export type StoreConfig = {
  demo: boolean;
  payments: { razorpay: boolean; mode: "test" | "live" | "off"; simulatedCard: boolean; cod: boolean };
  uploads: { enabled: boolean };
};
