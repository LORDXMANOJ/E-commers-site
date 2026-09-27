export type Role = "CUSTOMER" | "ADMIN";
export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type PaymentMethod = "COD" | "CARD_SIMULATED";
export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";
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
};

export type AdminProduct = Product & { active: boolean; soldCount: number; categoryId: string; updatedAt: string };

export type Paginated<T> = { items: T[]; page: number; limit: number; total: number; totalPages: number };

export type CartProduct = Pick<Product, "id" | "name" | "slug" | "pricePaise" | "compareAtPaise" | "stock" | "images">;

export type CartLine = {
  productId: string;
  quantity: number;
  available: boolean;
  product: CartProduct;
  lineTotalPaise: number;
};

export type Cart = { items: CartLine[]; itemCount: number; subtotalPaise: number };

export type OrderItem = {
  id: string;
  productId: string | null;
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
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderEvent[];
  user?: { id: string; name: string; email: string };
};

export type OrderSummary = Omit<Order, "items" | "events"> & {
  items: Pick<OrderItem, "name" | "imageUrl" | "quantity">[];
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
