/**
 * OPTIONAL demo data for the Aurelle women's-wear demo. The app works with an empty database; run this only
 * to get a populated store. Everything here is FICTIONAL: products, prices, customers and orders.
 *
 *   npm run db:seed
 *
 * WARNING: wipes all existing data first. Refuses to run with NODE_ENV=production unless
 * SEED_FORCE=1 is set explicitly. Never run it against a real store's database.
 *
 * Photos: Pexels (https://www.pexels.com/license/), free to use, no attribution required. They show models,
 * not real Aurelle products, and must be replaced with the store's own photography before going live.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type OrderStatus, type PaymentMethod, type Product, type ProductVariant, type Size } from "@prisma/client";

const prisma = new PrismaClient();

const img = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
const rupees = (r: number) => Math.round(r * 100);

const categories = [
  { slug: "sarees", name: "Sarees", description: "Handloom cottons, silks and organzas, each six yards draped with care.", image: 28943474 },
  { slug: "kurtas", name: "Kurtas & Kurtis", description: "Everyday and festive kurtas in block prints, chikankari and soft cottons.", image: 28213774 },
  { slug: "lehengas", name: "Lehengas", description: "Occasion lehengas with hand embroidery, mirror work and flowing dupattas.", image: 37628608 },
  { slug: "anarkalis", name: "Anarkalis & Gowns", description: "Floor-sweeping anarkalis and gowns for celebrations big and small.", image: 34673508 },
  { slug: "suit-sets", name: "Suit Sets & Dupattas", description: "Coordinated kurta sets, sharara sets and statement dupattas.", image: 13584935 },
  { slug: "jewellery", name: "Jewellery", description: "Jhumkas and earrings in temple gold, kundan and oxidised silver.", image: 13595577 },
];

const GARMENT: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];
const LEHENGA: Size[] = ["XS", "S", "M", "L", "XL"];

type SeedProduct = {
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  images: number[];
  featured?: boolean;
  description: string;
  /** Free Size stock (number) or stock per size. */
  stock: number | Partial<Record<Size, number>>;
};

/** Spreads a total across sizes, heavier in the middle, like a real size curve. */
function curve(sizes: Size[], total: number): Partial<Record<Size, number>> {
  const weights = sizes.map((_, i) => 1 + Math.min(i, sizes.length - 1 - i));
  const sum = weights.reduce((a, b) => a + b, 0);
  return Object.fromEntries(sizes.map((s, i) => [s, Math.max(0, Math.round((total * weights[i]) / sum))]));
}

const products: SeedProduct[] = [
  // Sarees (Free Size)
  { name: "Saffron Organza Saree", category: "sarees", price: 8490, stock: 9, featured: true, images: [28943474],
    description: "Sheer saffron organza with a woven zari border and a contrast pallu. Comes with an unstitched blouse piece. Dry clean only." },
  { name: "Ivory Kasavu Tissue Saree", category: "sarees", price: 6990, stock: 12, images: [37054322, 37123882],
    description: "Kerala-style kasavu in soft tissue cotton with a gold border. Light enough for a long day of celebrations." },
  { name: "Crimson Banarasi Saree", category: "sarees", price: 12490, compareAt: 14990, stock: 5, featured: true, images: [20161456],
    description: "Pure silk Banarasi in deep crimson with a silver-toned zari border. A wedding-season classic that drapes beautifully." },
  { name: "Midnight Zari Border Saree", category: "sarees", price: 9290, stock: 7, images: [30004204],
    description: "Black chanderi silk with a broad mustard-gold border. Pairs with a solid gold or black blouse." },
  { name: "Marigold Cotton Saree", category: "sarees", price: 3490, stock: 24, images: [40290281],
    description: "Breathable handloom cotton in a sunny marigold, finished with a thin red border. An easy everyday drape." },
  { name: "Teal Mul Cotton Saree", category: "sarees", price: 4290, stock: 15, images: [7176430, 7176438],
    description: "Feather-light mul cotton in teal with a silver tissue border. Softens with every wash." },
  { name: "Indigo Ajrakh Saree", category: "sarees", price: 5890, stock: 8, images: [34368242],
    description: "Hand block-printed ajrakh in natural indigo and madder. Each piece varies slightly, as hand prints do." },
  { name: "Magenta Paithani Saree", category: "sarees", price: 15990, stock: 2, images: [7326221],
    description: "Silk Paithani in magenta with a peacock-motif pallu, woven on a traditional handloom." },
  { name: "Maroon Kanjivaram Silk Saree", category: "sarees", price: 18490, stock: 3, images: [17040985],
    description: "Heavy Kanjivaram silk in maroon with a temple border in antique gold zari. An heirloom piece." },
  { name: "Aubergine Handloom Silk Saree", category: "sarees", price: 7290, stock: 10, images: [28058186, 7920188],
    description: "Aubergine handloom silk with a subtle self-woven texture and a teal-edged pallu." },
  { name: "Sky Blue Chiffon Saree", category: "sarees", price: 2990, stock: 30, images: [35867845],
    description: "Flowing chiffon in sky blue with a fine sequinned edge. Packs small and drapes in minutes." },
  { name: "Wine Georgette Saree", category: "sarees", price: 4790, stock: 0, images: [11629757],
    description: "Wine georgette with a delicate satin border. Back in the next production run." },

  // Kurtas
  { name: "Rose Chikankari Kurta", category: "kurtas", price: 3290, stock: curve(GARMENT, 28), featured: true, images: [35445207],
    description: "Hand-embroidered Lucknowi chikankari on rose cotton, with a straight hem and side slits. Pairs with white palazzos." },
  { name: "Mustard Ajrakh A-Line Kurta", category: "kurtas", price: 2690, stock: curve(GARMENT, 34), images: [28213774, 28213745],
    description: "Block-printed ajrakh in mustard and indigo with a flared A-line cut, three-quarter sleeves and a keyhole neck." },
  { name: "Fuchsia Floral Straight Kurta", category: "kurtas", price: 1990, stock: curve(GARMENT, 40), images: [35504991],
    description: "Soft rayon with an all-over fuchsia floral print. Works with jeans for college or with leggings for the office." },
  { name: "Mint Floral Kurti", category: "kurtas", price: 1690, compareAt: 2190, stock: curve(GARMENT, 26), images: [35504999],
    description: "A short kurti in cotton cambric with teal florals and cuffed sleeves. Machine washable." },
  { name: "Peach Printed Kurta", category: "kurtas", price: 1890, stock: { S: 3, M: 6, L: 4, XL: 0 }, images: [12279088],
    description: "Peach cotton with a fine white print and pin-tucked yoke. Size XL is sold out." },
  { name: "Dove Grey Cotton Kurta", category: "kurtas", price: 1590, stock: curve(GARMENT, 22), images: [13554746],
    description: "A minimal grey kurta in khadi-finish cotton with a mandarin collar. Our quietest everyday piece." },
  { name: "Lime Embroidered Kurta", category: "kurtas", price: 2290, stock: { XS: 1, S: 2, M: 1, L: 0, XL: 1, XXL: 0 }, images: [33824989],
    description: "Lime cotton silk with tonal thread embroidery at the yoke. Only a few left in each size." },

  // Lehengas
  { name: "Rani Pink Sequin Lehenga", category: "lehengas", price: 32990, compareAt: 38990, stock: curve(LEHENGA, 9), featured: true, images: [37628608, 37628619],
    description: "Georgette lehenga in rani pink with all-over sequin and thread work, a matching blouse and a sheer net dupatta." },
  { name: "Blush Mirror-Work Lehenga", category: "lehengas", price: 24990, stock: curve(LEHENGA, 8), images: [33343591],
    description: "Blush pink with mirror and gota detailing on the choli and hem. The dupatta has a scalloped border." },
  { name: "Ivory Chikankari Lehenga", category: "lehengas", price: 21490, stock: curve(LEHENGA, 6), images: [35637857],
    description: "Ivory georgette with chikankari and sequin highlights. A daytime wedding favourite." },
  { name: "Ruby Velvet Lehenga", category: "lehengas", price: 28990, stock: { S: 1, M: 2, L: 1 }, images: [12062663],
    description: "Ruby velvet skirt with zardozi embroidery and a net dupatta with a heavy border. Limited sizes." },
  { name: "Rose Brocade Lehenga", category: "lehengas", price: 18990, stock: curve(LEHENGA, 10), images: [16803130],
    description: "Rose brocade skirt with a contrast gold dupatta, light enough for sangeet nights." },
  { name: "Mocha Printed Lehenga Set", category: "lehengas", price: 9990, stock: curve(LEHENGA, 12), images: [38526708],
    description: "A printed cotton-silk lehenga set in mocha and rust, ideal for festive lunches and mehendi." },

  // Anarkalis & Gowns
  { name: "Violet Angrakha Anarkali", category: "anarkalis", price: 5490, stock: curve(GARMENT, 18), featured: true, images: [34673508],
    description: "Deep violet angrakha anarkali with silver thread work and a flared kali skirt." },
  { name: "Amber Gota Anarkali", category: "anarkalis", price: 8990, stock: curve(GARMENT, 14), images: [5922737, 5922734],
    description: "Amber georgette anarkali with gota patti detailing and a sheer matching dupatta." },
  { name: "Ivory Block-Print Anarkali", category: "anarkalis", price: 4990, stock: curve(GARMENT, 20), images: [18380705],
    description: "Cotton anarkali in ivory with indigo block prints, paired with a printed dupatta." },
  { name: "Sunflower Georgette Anarkali", category: "anarkalis", price: 6290, stock: curve(GARMENT, 16), images: [34658495],
    description: "Sunflower yellow georgette that swirls when you move, with a thin gold lace at the hem." },
  { name: "Scarlet Bandhani Anarkali", category: "anarkalis", price: 6790, compareAt: 7990, stock: curve(GARMENT, 15), images: [30268121, 30268123],
    description: "Scarlet bandhani anarkali with mirror-work cuffs and a matching dupatta." },
  { name: "Lilac Flared Gown", category: "anarkalis", price: 7490, stock: curve(GARMENT, 11), images: [12796269],
    description: "A lilac gown with a fitted bodice and a full skirt, finished with a plum stole." },
  { name: "Old Rose Embroidered Gown", category: "anarkalis", price: 11990, stock: { S: 2, M: 3, L: 2, XL: 1 }, images: [39299500],
    description: "Old rose net gown with tonal embroidery and a soft inner lining." },
  { name: "Powder Blue Net Gown", category: "anarkalis", price: 13490, stock: curve(LEHENGA, 7), images: [8538848],
    description: "Powder blue net gown with silver resham embroidery and a matching dupatta." },

  // Suit sets & dupattas
  { name: "Emerald Silk Kurta Set", category: "suit-sets", price: 6490, stock: curve(GARMENT, 16), featured: true, images: [31861623],
    description: "Emerald raw-silk kurta and straight pants with a striped silk dupatta in ochre and indigo." },
  { name: "Fuchsia Suit with Floral Dupatta", category: "suit-sets", price: 4490, stock: curve(GARMENT, 20), images: [13584935],
    description: "Fuchsia cotton kurta and pants with a printed floral mulmul dupatta." },
  { name: "Scarlet Suit with Zari Dupatta", category: "suit-sets", price: 4790, stock: curve(GARMENT, 18), images: [13584942],
    description: "Scarlet kurta and pants with a bottle-green dupatta striped in zari." },
  { name: "Ivory Kurta Set with Printed Dupatta", category: "suit-sets", price: 3990, stock: curve(GARMENT, 22), images: [20788501],
    description: "Ivory cotton kurta set with a terracotta block-printed dupatta." },
  { name: "Coral Suit with Bloom Dupatta", category: "suit-sets", price: 4290, stock: curve(GARMENT, 14), images: [13584934],
    description: "Coral anarkali-cut kurta with pants and a bold bloom-print chiffon dupatta." },
  { name: "Blush Suit with Cobalt Dupatta", category: "suit-sets", price: 3890, stock: curve(GARMENT, 12), images: [13584972],
    description: "Blush sleeveless kurta and pants with a cobalt bandhani dupatta." },
  { name: "Silver Sharara Set", category: "suit-sets", price: 10990, stock: curve(LEHENGA, 8), images: [8031939],
    description: "Grey-silver embroidered kurta with a flared sharara and an organza dupatta." },
  { name: "Saffron Phulkari Dupatta", category: "suit-sets", price: 2490, stock: 18, images: [34251604],
    description: "A saffron dupatta with Punjabi phulkari embroidery in silk thread. Free Size." },

  // Jewellery (Free Size)
  { name: "Kundan Pearl Drop Jhumkas", category: "jewellery", price: 3490, stock: 14, featured: true, images: [13595577],
    description: "Kundan jhumkas with pink and green stones and pearl drops. Gold-plated brass, push-back closure." },
  { name: "Temple Gold Jhumkas", category: "jewellery", price: 2890, stock: 20, images: [29415954, 37601639],
    description: "Temple-style jhumkas with ruby-tone stones in antique gold plating." },
  { name: "Oxidised Silver Mirror Earrings", category: "jewellery", price: 1290, stock: 35, images: [20850030],
    description: "Oxidised silver-tone earrings with mirror inlay and pearl fringes. Light for all-day wear." },
  { name: "Silver Jhumka Duo", category: "jewellery", price: 990, stock: 4, images: [11203816],
    description: "Two everyday pairs of oxidised jhumkas with enamel detail." },
];

const customers = [
  { email: "demo@aurelle.dev", name: "Demo Customer", password: "Demo1234" },
  { email: "ananya.iyer@example.com", name: "Ananya Iyer", password: "Customer123" },
  { email: "meera.nair@example.com", name: "Meera Nair", password: "Customer123" },
  { email: "kavya.reddy@example.com", name: "Kavya Reddy", password: "Customer123" },
];

// Fictional addresses. Phone numbers are placeholders in a valid format, not real people.
const addresses = [
  { fullName: "Demo Customer", phone: "9876543210", line1: "14, 2nd Cross, Indiranagar", line2: "", city: "Bengaluru", state: "Karnataka", postalCode: "560038", country: "India" },
  { fullName: "Ananya Iyer", phone: "9820012345", line1: "B-702, Sea Breeze Apartments, Bandra West", line2: "", city: "Mumbai", state: "Maharashtra", postalCode: "400050", country: "India" },
  { fullName: "Meera Nair", phone: "9811098110", line1: "C-21, Hauz Khas", line2: "Near Deer Park", city: "New Delhi", state: "Delhi", postalCode: "110016", country: "India" },
  { fullName: "Kavya Reddy", phone: "9900011223", line1: "Plot 41, Road No. 12, Banjara Hills", line2: "", city: "Hyderabad", state: "Telangana", postalCode: "500034", country: "India" },
];

// [customerIndex, daysAgo, status, payment, [productIndex, size, qty][]]
const sampleOrders: [number, number, OrderStatus, PaymentMethod, [number, Size, number][]][] = [
  [0, 13, "DELIVERED", "CARD_SIMULATED", [[0, "FREE_SIZE", 1], [41, "FREE_SIZE", 1]]],
  [1, 11, "DELIVERED", "COD", [[12, "M", 1]]],
  [2, 10, "DELIVERED", "CARD_SIMULATED", [[18, "S", 1]]],
  [3, 8, "SHIPPED", "COD", [[25, "L", 1], [43, "FREE_SIZE", 2]]],
  [1, 7, "SHIPPED", "CARD_SIMULATED", [[2, "FREE_SIZE", 1]]],
  [0, 5, "CONFIRMED", "COD", [[13, "M", 2]]],
  [2, 4, "CANCELLED", "COD", [[32, "L", 1]]],
  [3, 3, "CONFIRMED", "CARD_SIMULATED", [[26, "M", 1], [42, "FREE_SIZE", 1]]],
  [1, 2, "DELIVERED", "COD", [[14, "S", 1], [15, "M", 1]]],
  [0, 1, "PENDING", "COD", [[33, "M", 1]]],
  [2, 0, "PENDING", "CARD_SIMULATED", [[4, "FREE_SIZE", 2]]],
];

const TIMELINE: OrderStatus[] = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const sizeLabel = (s: Size) => (s === "FREE_SIZE" ? "Free Size" : s);

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    throw new Error("Refusing to seed in production. Set SEED_FORCE=1 if you really mean it.");
  }

  console.log("Clearing existing data…");
  await prisma.$transaction([
    prisma.webhookEvent.deleteMany(),
    prisma.orderEvent.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.revokedToken.deleteMany(),
    prisma.productVariant.deleteMany(),
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
  const created: (Product & { variants: ProductVariant[] })[] = [];
  for (const [i, p] of products.entries()) {
    const variants =
      typeof p.stock === "number"
        ? [{ size: "FREE_SIZE" as Size, stock: p.stock }]
        : (Object.entries(p.stock) as [Size, number][]).map(([size, stock]) => ({ size, stock }));
    created.push(
      await prisma.product.create({
        data: {
          name: p.name,
          slug: slugify(p.name),
          description: p.description,
          pricePaise: rupees(p.price),
          compareAtPaise: p.compareAt ? rupees(p.compareAt) : null,
          stock: variants.reduce((n, v) => n + v.stock, 0),
          images: p.images.map(img),
          featured: p.featured ?? false,
          categoryId: categoryIds.get(p.category)!,
          variants: { create: variants },
          // Stagger creation dates (interleaving categories) so "newest" sorting is meaningful.
          createdAt: new Date(now - (((i * 7) % products.length) + 1) * 36 * 60 * 60 * 1000),
        },
        include: { variants: true },
      }),
    );
  }

  console.log("Creating sample orders…");
  for (const [n, [ci, daysAgo, status, paymentMethod, lines]] of sampleOrders.entries()) {
    const placedAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - (n % 5) * 60 * 60 * 1000);
    const items = lines.map(([pi, size, quantity]) => {
      const p = created[pi];
      const variant = p.variants.find((v) => v.size === size);
      if (!variant) throw new Error(`Seed order ${n + 1}: ${p.name} has no size ${sizeLabel(size)}`);
      return {
        productId: p.id,
        variantId: variant.id,
        size,
        name: p.name,
        slug: p.slug,
        imageUrl: p.images[0],
        unitPaise: p.pricePaise,
        quantity,
        lineTotalPaise: p.pricePaise * quantity,
      };
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

    // Sold counts drive "popular" sorting. Stock levels above are the current shelf, after these sales.
    if (status !== "CANCELLED") {
      for (const [pi, , qty] of lines) {
        await prisma.product.update({ where: { id: created[pi].id }, data: { soldCount: { increment: qty } } });
      }
    }
  }

  console.log(`Seeded ${categories.length} categories, ${products.length} products, ${customers.length + 1} users, ${sampleOrders.length} orders.`);
  console.log("  Admin:    admin@aurelle.dev / Admin1234   (local demo only)");
  console.log("  Customer: demo@aurelle.dev  / Demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
