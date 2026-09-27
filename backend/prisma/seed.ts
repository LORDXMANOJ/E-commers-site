/**
 * OPTIONAL demo data. The app works with an empty database; run this only to get a populated store.
 *
 *   npm run db:seed
 *
 * WARNING: wipes all existing data first. Refuses to run with NODE_ENV=production unless
 * SEED_FORCE=1 is set explicitly.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type OrderStatus, type PaymentMethod, type Product } from "@prisma/client";

const prisma = new PrismaClient();

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;
const rupees = (r: number) => Math.round(r * 100);

const categories = [
  { slug: "outerwear", name: "Outerwear", description: "Coats and jackets cut to layer through every season.", image: "1539533018447-63fcce2678e3" },
  { slug: "tops", name: "Tops & Shirts", description: "Tees, knits and shirting in natural fibres.", image: "1490481651871-ab68de25d43d" },
  { slug: "dresses", name: "Dresses", description: "From easy day dresses to evening silhouettes.", image: "1595777457583-95e059d581b8" },
  { slug: "trousers-denim", name: "Trousers & Denim", description: "Selvedge denim, tailoring and relaxed trousers.", image: "1604176354204-9268737828e4" },
  { slug: "footwear", name: "Footwear", description: "Leather shoes and boots built to be resoled.", image: "1614252235316-8c857d38b5f4" },
  { slug: "bags-accessories", name: "Bags & Accessories", description: "Leather goods, jewellery and finishing touches.", image: "1584917865442-de89df76afd3" },
];

type SeedProduct = {
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  stock: number;
  images: string[];
  featured?: boolean;
  description: string;
};

const products: SeedProduct[] = [
  // Outerwear
  { name: "Camel Wrap Coat", category: "outerwear", price: 12990, stock: 14, featured: true, images: ["1539533018447-63fcce2678e3", "1483985988355-763728e1935b"],
    description: "A double-faced wool blend coat with a self-tie belt and dropped shoulders. Unlined so it drapes softly, with deep side pockets and a length that sits just below the knee." },
  { name: "Tartan Wool Overcoat", category: "outerwear", price: 14490, compareAt: 17990, stock: 6, images: ["1485968579580-b6d095142e6e"],
    description: "Navy and forest tartan in a dense brushed wool. Notched lapels, a single-breasted front and a half lining in cupro for easy layering over knitwear." },
  { name: "Olive Utility Jacket", category: "outerwear", price: 6990, stock: 22, images: ["1544022613-e87ca75a784a"],
    description: "Garment-dyed cotton twill with four patch pockets and a two-way zip under a storm placket. Softens further with every wash." },
  { name: "Black Leather Biker", category: "outerwear", price: 18990, stock: 3, featured: true, images: ["1551028719-00167b16eac5"],
    description: "Vegetable-tanned lambskin with an asymmetric zip, snap-down lapels and belted hem. Stiff at first, then moulds to you over the years." },
  { name: "Cognac Moto Jacket", category: "outerwear", price: 16490, stock: 5, images: ["1487222477894-8943e31ef7b2"],
    description: "A warmer take on the biker in semi-aniline cognac leather, with quilted shoulders and a soft cotton lining." },
  { name: "Clay Bomber", category: "outerwear", price: 5490, compareAt: 6990, stock: 18, images: ["1591047139829-d91aecb6caea"],
    description: "Lightweight recycled nylon in a dusty clay shade, with ribbed cuffs and hem and a hidden inner pocket for your phone." },

  // Tops & Shirts
  { name: "Essential Crew Tee", category: "tops", price: 1290, stock: 80, images: ["1521572163474-6864f9cf17ab"],
    description: "Our everyday tee in 180 gsm combed Supima cotton. A close neckline that keeps its shape, and a length made for tucking or not." },
  { name: "Heavyweight Black Tee", category: "tops", price: 1690, stock: 64, images: ["1583743814966-8936f5b7be1a", "1576871337622-98d48d1cf531"],
    description: "A boxy 260 gsm tee with a thick ribbed collar. Pigment-dyed for a lived-in black that fades gracefully." },
  { name: "Marigold Sweatshirt", category: "tops", price: 3290, stock: 26, featured: true, images: ["1578587018452-892bacefd3f2"],
    description: "Loopback organic cotton in a saturated marigold. Raglan sleeves, a relaxed body and a soft brushed interior." },
  { name: "Cloud Fleece Crewneck", category: "tops", price: 2990, stock: 31, images: ["1620799140408-edc6dcb6d633"],
    description: "Airy brushed fleece in optic white with a clean, slightly cropped fit. The sweatshirt you will reach for first." },
  { name: "Ruffled Poplin Blouse", category: "tops", price: 3890, stock: 12, images: ["1609505848912-b7c3b8b4beda"],
    description: "Crisp cotton poplin with a tiered ruffle at the neckline that can be worn on or off the shoulder." },
  { name: "Chambray Work Shirt", category: "tops", price: 2790, stock: 40, images: ["1558171813-4c088753af8f"],
    description: "Light indigo chambray with twin chest pockets, a curved hem and corozo buttons. Gets better with every wash." },
  { name: "Crisp Poplin Shirt", category: "tops", price: 2490, stock: 2, images: ["1603252109303-2751441dd157", "1602810318383-e386cc2a3ccf"],
    description: "A sharp white shirt in two-ply cotton poplin with a semi-spread collar. Made for tailoring and just as good untucked." },
  { name: "Open-Knit Poncho", category: "tops", price: 3490, compareAt: 4290, stock: 9, images: ["1434389677669-e08b4cac3105"],
    description: "Hand-finished open knit in undyed cotton with a fringed hem. Throw it over a slip dress or a plain tee." },

  // Dresses
  { name: "Scarlet Maxi Dress", category: "dresses", price: 7490, stock: 8, featured: true, images: ["1595777457583-95e059d581b8"],
    description: "Fluid crêpe cut on the bias for a full, sweeping skirt. Halter neckline and an open back with a covered-button closure." },
  { name: "Floral Wrap Dress", category: "dresses", price: 4990, stock: 16, images: ["1496747611176-843222e1e57c"],
    description: "Printed viscose with a true wrap front, flutter sleeves and a midi hem that moves in the breeze." },
  { name: "Crimson Swing Dress", category: "dresses", price: 5490, compareAt: 6490, stock: 11, images: ["1572804013309-59a88b7e92f1"],
    description: "A fitted bodice and full swing skirt in printed cotton sateen, finished with a wide statement belt." },
  { name: "Plum Off-Shoulder Gown", category: "dresses", price: 9990, stock: 4, images: ["1566174053879-31528523f8ae"],
    description: "Stretch velvet with a structured off-shoulder neckline and a column skirt. For evenings that call for it." },
  { name: "Broderie Mini Dress", category: "dresses", price: 4290, stock: 0, images: ["1515372039744-b8f02a3ae446"],
    description: "White cotton broderie anglaise with an elasticated off-shoulder neckline and tiered skirt." },
  { name: "Olive Belted Playsuit", category: "dresses", price: 3690, stock: 13, images: ["1618932260643-eee4a2f652a6"],
    description: "Washed linen blend with adjustable straps and a self-belt. Pockets, of course." },

  // Trousers & Denim
  { name: "Selvedge Straight Jeans", category: "trousers-denim", price: 5990, stock: 35, featured: true, images: ["1604176354204-9268737828e4"],
    description: "13.5 oz Japanese selvedge denim, rinsed once. A straight leg with a mid rise that works with boots or trainers." },
  { name: "Raw Indigo Jeans", category: "trousers-denim", price: 4990, stock: 20, images: ["1624378439575-d8705ad7ae80"],
    description: "Unwashed indigo that will fade to your own pattern. Slim through the thigh with a slight taper." },
  { name: "Blush Satin Joggers", category: "trousers-denim", price: 3490, stock: 17, images: ["1594633312681-425c7b97ccd1"],
    description: "Soft-sheen satin with an elasticated waist and cuffs and pleats at the front. Dresses up or down." },
  { name: "Navy Tailored Trousers", category: "trousers-denim", price: 4490, stock: 24, images: ["1617137968427-85924c800a22"],
    description: "Wool-blend suiting with a flat front, side adjusters and a clean break. Pairs with the matching blazer." },

  // Footwear
  { name: "Cognac Leather Derby", category: "footwear", price: 8990, stock: 10, featured: true, images: ["1614252235316-8c857d38b5f4", "1614676471928-2ed0ad1061a4"],
    description: "Burnished calf leather on a Goodyear-welted sole, so it can be resoled for years. Open lacing, rounded toe." },
  { name: "Heritage Work Boots", category: "footwear", price: 10990, compareAt: 12990, stock: 7, images: ["1605812860427-4024433a70fd", "1479064555552-3ef4979f8908"],
    description: "Oiled nubuck with a padded collar, speed hooks and a lugged commando sole for grip in the rain." },
  { name: "Retro Runner Sneakers", category: "footwear", price: 6490, stock: 19, images: ["1560769629-975ec94e6a86"],
    description: "A chunky runner in mixed suede and mesh with pops of colour and a cushioned foam midsole." },
  { name: "Floral Stiletto Pumps", category: "footwear", price: 5790, stock: 1, images: ["1543163521-1bf539c55dd2"],
    description: "Printed satin on a 95 mm heel with a pointed toe and a cushioned leather footbed." },

  // Bags & Accessories
  { name: "Vermilion Top-Handle Bag", category: "bags-accessories", price: 11990, stock: 6, featured: true, images: ["1584917865442-de89df76afd3"],
    description: "Structured calf leather with a polished turn-lock, a detachable shoulder strap and a suede-lined interior." },
  { name: "Woven Rattan Handbag", category: "bags-accessories", price: 6490, stock: 9, images: ["1590874103328-eac38a683ce7"],
    description: "Hand-woven rattan with leather trims, a rolled handle and a cotton drawstring pouch inside." },
  { name: "Navy Commuter Backpack", category: "bags-accessories", price: 4290, stock: 28, images: ["1553062407-98eeb64c6a62"],
    description: "Water-resistant recycled canvas with a padded 15-inch laptop sleeve and a luggage pass-through." },
  { name: "Pearl Strand Necklace", category: "bags-accessories", price: 7990, stock: 5, images: ["1515562141207-7a88fb7ce338"],
    description: "Freshwater pearls hand-knotted on silk with a sterling silver clasp. Arrives in a lined keepsake box." },
  { name: "Gold Link Hoops", category: "bags-accessories", price: 2490, stock: 42, images: ["1617038220319-276d3cfab638"],
    description: "Chunky curb-link hoops in 18k gold-plated recycled brass. Light enough for all-day wear." },
  { name: "Round Metal Sunglasses", category: "bags-accessories", price: 3290, stock: 23, images: ["1511499767150-a48a237f0083"],
    description: "Thin gold wire frames with green-tinted UV400 lenses and adjustable nose pads." },
  { name: "Minimal Leather Watch", category: "bags-accessories", price: 6990, compareAt: 8490, stock: 12, images: ["1524592094714-0f0654e20314"],
    description: "A 38 mm brushed steel case, sapphire-coated glass and an Italian leather strap that softens with wear." },
  { name: "Saddle Leather Belt", category: "bags-accessories", price: 1990, stock: 37, images: ["1624222247344-550fb60583dc"],
    description: "Full-grain bridle leather with a brass roller buckle and hand-painted edges." },
];

const customers = [
  { email: "demo@aurelle.dev", name: "Demo Customer", password: "Demo1234" },
  { email: "priya.sharma@example.com", name: "Priya Sharma", password: "Customer123" },
  { email: "arjun.mehta@example.com", name: "Arjun Mehta", password: "Customer123" },
];

const addresses = [
  { fullName: "Demo Customer", phone: "9876543210", line1: "14, 2nd Cross, Indiranagar", line2: "", city: "Bengaluru", state: "Karnataka", postalCode: "560038", country: "India" },
  { fullName: "Priya Sharma", phone: "9820012345", line1: "B-702, Sea Breeze Apartments, Bandra West", line2: "", city: "Mumbai", state: "Maharashtra", postalCode: "400050", country: "India" },
  { fullName: "Arjun Mehta", phone: "9811098110", line1: "C-21, Hauz Khas", line2: "Near Deer Park", city: "New Delhi", state: "Delhi", postalCode: "110016", country: "India" },
];

// [customerIndex, daysAgo, status, payment, [productIndex, qty][]]
const sampleOrders: [number, number, OrderStatus, PaymentMethod, [number, number][]][] = [
  [0, 12, "DELIVERED", "CARD_SIMULATED", [[0, 1], [6, 2]]],
  [1, 10, "DELIVERED", "COD", [[14, 1]]],
  [2, 9, "DELIVERED", "CARD_SIMULATED", [[24, 1], [35, 1]]],
  [1, 7, "SHIPPED", "CARD_SIMULATED", [[29, 1], [32, 2]]],
  [0, 5, "SHIPPED", "COD", [[20, 1], [8, 1]]],
  [2, 4, "CONFIRMED", "CARD_SIMULATED", [[3, 1]]],
  [1, 3, "CANCELLED", "COD", [[17, 1]]],
  [2, 2, "CONFIRMED", "COD", [[26, 1], [7, 3]]],
  [0, 1, "PENDING", "COD", [[15, 1], [33, 1]]],
  [1, 0, "PENDING", "CARD_SIMULATED", [[9, 2], [11, 1]]],
];

const TIMELINE: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    throw new Error("Refusing to seed in production. Set SEED_FORCE=1 if you really mean it.");
  }

  console.log("Clearing existing data…");
  await prisma.$transaction([
    prisma.orderEvent.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.revokedToken.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("Creating users…");
  await prisma.user.create({
    data: { email: "admin@aurelle.dev", name: "Aurelle Admin", role: "ADMIN", passwordHash: await bcrypt.hash("Admin1234", 12) },
  });
  const users = [];
  for (const [i, c] of customers.entries()) {
    users.push(
      await prisma.user.create({
        data: { email: c.email, name: c.name, passwordHash: await bcrypt.hash(c.password, 12), address: addresses[i] },
      }),
    );
  }

  console.log("Creating categories and products…");
  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const created = await prisma.category.create({
      data: { name: c.name, slug: c.slug, description: c.description, imageUrl: img(c.image) },
    });
    categoryIds.set(c.slug, created.id);
  }

  const now = Date.now();
  const created: Product[] = [];
  for (const [i, p] of products.entries()) {
    created.push(
      await prisma.product.create({
        data: {
          name: p.name,
          slug: slugify(p.name),
          description: p.description,
          pricePaise: rupees(p.price),
          compareAtPaise: p.compareAt ? rupees(p.compareAt) : null,
          stock: p.stock,
          images: p.images.map(img),
          featured: p.featured ?? false,
          categoryId: categoryIds.get(p.category)!,
          // Stagger creation dates so "newest" sorting is meaningful.
          createdAt: new Date(now - (products.length - i) * 36 * 60 * 60 * 1000),
        },
      }),
    );
  }

  console.log("Creating sample orders…");
  for (const [n, [ci, daysAgo, status, paymentMethod, lines]] of sampleOrders.entries()) {
    const placedAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - (n % 5) * 60 * 60 * 1000);
    const items = lines.map(([pi, quantity]) => {
      const p = created[pi];
      return { productId: p.id, name: p.name, slug: p.slug, imageUrl: p.images[0], unitPaise: p.pricePaise, quantity, lineTotalPaise: p.pricePaise * quantity };
    });
    const subtotalPaise = items.reduce((s, i) => s + i.lineTotalPaise, 0);
    const shippingPaise = subtotalPaise >= 299_900 ? 0 : 9_900;

    const steps = status === "CANCELLED" ? (["PENDING", "CANCELLED"] as OrderStatus[]) : TIMELINE.slice(0, TIMELINE.indexOf(status) + 1);
    const paid = paymentMethod === "CARD_SIMULATED" || status === "DELIVERED";

    await prisma.order.create({
      data: {
        orderNumber: `AUR-${placedAt.toISOString().slice(2, 10).replace(/-/g, "")}-S${String(n + 1).padStart(5, "0")}`,
        userId: users[ci].id,
        status,
        subtotalPaise,
        shippingPaise,
        totalPaise: subtotalPaise + shippingPaise,
        shippingAddress: addresses[ci],
        shippingMethod: "STANDARD",
        paymentMethod,
        paymentStatus: status === "CANCELLED" ? (paymentMethod === "CARD_SIMULATED" ? "REFUNDED" : "UNPAID") : paid ? "PAID" : "UNPAID",
        cardLast4: paymentMethod === "CARD_SIMULATED" ? "4242" : null,
        createdAt: placedAt,
        items: { create: items },
        events: {
          create: steps.map((s, k) => ({
            status: s,
            note: s === "PENDING" ? "Order placed" : s === "CANCELLED" ? "Cancelled by customer" : undefined,
            createdAt: new Date(placedAt.getTime() + k * 20 * 60 * 60 * 1000),
          })),
        },
      },
    });

    if (status !== "CANCELLED") {
      for (const [pi, qty] of lines) {
        await prisma.product.update({ where: { id: created[pi].id }, data: { soldCount: { increment: qty } } });
      }
    }
  }

  console.log(`Seeded ${categories.length} categories, ${products.length} products, ${customers.length + 1} users, ${sampleOrders.length} orders.`);
  console.log("  Admin:    admin@aurelle.dev / Admin1234");
  console.log("  Customer: demo@aurelle.dev  / Demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
