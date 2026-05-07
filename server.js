const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "products.json");
const MENU_HTML_FILE = path.join(ROOT_DIR, "menu.html");
const PORT = Number(process.env.PORT) || 3000;
const LEGACY_ENTITY_PRICE = 8358;
const LEGACY_COMPARE_PRICE_THRESHOLD = 100;
const LEGACY_REPAIR_RATIO = 0.5;
const MAX_REQUEST_BYTES = 25 * 1024 * 1024;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const CATEGORY_NAME_MAP = {
  PIZZA: "Pizza",
  BURGER: "Burger",
  SANDWITCH: "Sandwich",
  SANDWICH: "Sandwich",
  SHAKE: "Shake",
  "ICE-CREAME": "Ice Cream",
  "ICE CREAM": "Ice Cream",
  DESSERT: "Dessert",
  SWALLOWS: "Swallows",
  SOUPS: "Soups",
  "RICE DISHES": "Rice Dishes",
  "SMALL CHOPS": "Small Chops",
  PROTEINS: "Proteins",
  "PEPPER SOUPS": "Pepper Soups",
  BEANS: "Beans",
  PORRIDGES: "Porridges",
  "SNACKS & PASTRIES": "Snacks and Pastries",
  "SNACKS AND PASTRIES": "Snacks and Pastries",
  "LOCAL BEVERAGES": "Local Beverages",
  "SIDES & EXTRA": "Sides and Extra",
  "SIDES AND EXTRA": "Sides and Extra"
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === "/api/products") {
      await handleProductsApi(request, response);
      return;
    }

    await serveStaticFile(pathname, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Foodweb server running at http://localhost:${PORT}`);
});

async function handleProductsApi(request, response) {
  if (request.method === "GET") {
    const products = ensureCatalogFile();
    sendJson(response, 200, { products });
    return;
  }

  if (request.method === "PUT") {
    const payload = await readJsonBody(request);
    const products = Array.isArray(payload) ? payload : payload && payload.products;

    if (!Array.isArray(products)) {
      sendJson(response, 400, { error: "Request body must contain a products array." });
      return;
    }

    const normalizedProducts = products.map((product) => normalizeProduct(product));
    writeProductsToFile(normalizedProducts);
    sendJson(response, 200, { products: normalizedProducts });
    return;
  }

  response.setHeader("Allow", "GET, PUT");
  sendJson(response, 405, { error: "Method not allowed" });
}

async function serveStaticFile(pathname, response) {
  let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let filePath = path.resolve(ROOT_DIR, relativePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.statusCode = 404;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end("Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader("Content-Type", MIME_TYPES[extension] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(response);
}

function ensureCatalogFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    const seededProducts = seedProductsFromMenuHtml();
    writeProductsToFile(seededProducts);
    return seededProducts;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const payload = JSON.parse(raw);
    const products = Array.isArray(payload) ? payload : payload && payload.products;
    if (!Array.isArray(products)) {
      throw new Error("Catalog file is not an array.");
    }
    const normalizedProducts = products.map((product) => normalizeProduct(product));
    const repairedProducts = maybeRepairLegacySeedPrices(normalizedProducts);
    if (repairedProducts) {
      console.log("Repaired legacy seeded catalog prices in data/products.json.");
      writeProductsToFile(repairedProducts);
      return repairedProducts;
    }
    return normalizedProducts;
  } catch (error) {
    console.warn("Catalog file was invalid. Rebuilding from menu.html.", error.message);
    const seededProducts = seedProductsFromMenuHtml();
    writeProductsToFile(seededProducts);
    return seededProducts;
  }
}

function seedProductsFromMenuHtml() {
  if (!fs.existsSync(MENU_HTML_FILE)) {
    return buildFallbackProducts();
  }

  const html = fs.readFileSync(MENU_HTML_FILE, "utf8");
  const thumbBlock = extractDivBlockByClass(html, "menu-main-thumb-nav");
  const detailBlock = extractDivBlockByClass(html, "menu-main-details-for");

  if (!thumbBlock || !detailBlock) {
    return buildFallbackProducts();
  }

  const categoryLabels = [];
  const thumbPattern = /<div class="menu-main-thumb-item[\s\S]*?<p>([\s\S]*?)<\/p>/gi;
  let thumbMatch;
  while ((thumbMatch = thumbPattern.exec(thumbBlock.html))) {
    const rawLabel = cleanText(thumbMatch[1]).toUpperCase();
    categoryLabels.push(normalizeCategoryName(rawLabel));
  }

  const detailItems = [];
  let searchFrom = 0;
  while (true) {
    const detailItem = extractDivBlockByClass(detailBlock.html, "menu-main-details-item", searchFrom);
    if (!detailItem) {
      break;
    }
    detailItems.push(detailItem.html);
    searchFrom = detailItem.end;
  }

  const products = [];
  const now = new Date().toISOString();

  detailItems.forEach((itemHtml, categoryIndex) => {
    const category = categoryLabels[categoryIndex] || `Category ${categoryIndex + 1}`;
    const cardPattern = /<div class="col-6[\s\S]*?<img src="([^"]+)" alt="([^"]*)"[\s\S]*?<h3><a[^>]*>([\s\S]*?)<\/a><\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<h4 class="product-price">([\s\S]*?)<\/h4>/gi;
    let cardMatch;
    let indexInCategory = 0;

    while ((cardMatch = cardPattern.exec(itemHtml))) {
      const name = cleanText(cardMatch[3]) || `${category} Item ${indexInCategory + 1}`;
      const prices = extractPriceValues(cardMatch[5]);
      products.push(
        normalizeProduct({
          id: createId(),
          name: name,
          category: category,
          price: prices.price,
          comparePrice: prices.comparePrice,
          stock: 12,
          sku: buildSuggestedSku(name, category),
          status: "active",
          featured: indexInCategory === 0,
          description: cleanText(cardMatch[4]),
          image: cleanText(cardMatch[1]),
          alt: cleanText(cardMatch[2]) || name,
          tags: [category.toLowerCase(), slugify(name).split("-")[0]].filter(Boolean),
          createdAt: now,
          updatedAt: now
        })
      );
      indexInCategory += 1;
    }
  });

  return products.length ? products : buildFallbackProducts();
}

function maybeRepairLegacySeedPrices(products) {
  if (!Array.isArray(products) || !products.length) {
    return null;
  }

  const suspiciousProducts = products.filter((product) => isLegacySeedPrice(product));
  if (!suspiciousProducts.length || suspiciousProducts.length / products.length < LEGACY_REPAIR_RATIO) {
    return null;
  }

  const seededProducts = seedProductsFromMenuHtml();
  const seededPriceMap = new Map(
    seededProducts.map((product) => [buildLegacyRepairKey(product), product])
  );

  let changed = false;
  const repairedProducts = products.map((product) => {
    if (!isLegacySeedPrice(product)) {
      return product;
    }

    const seededProduct = seededPriceMap.get(buildLegacyRepairKey(product));
    if (!seededProduct) {
      return product;
    }

    changed = true;
    return normalizeProduct({
      ...product,
      price: seededProduct.price,
      comparePrice: seededProduct.comparePrice,
      updatedAt: product.updatedAt || seededProduct.updatedAt
    });
  });

  return changed ? repairedProducts : null;
}

function isLegacySeedPrice(product) {
  return (
    safeNumber(product && product.price) === LEGACY_ENTITY_PRICE &&
    safeNumber(product && product.comparePrice) > 0 &&
    safeNumber(product && product.comparePrice) < LEGACY_COMPARE_PRICE_THRESHOLD
  );
}

function buildLegacyRepairKey(product) {
  return `${normalizeCategoryName(product && product.category)}::${cleanText(product && product.name).toLowerCase()}`;
}

function extractPriceValues(priceMarkup) {
  const matches = decodeHtml(String(priceMarkup || "")).match(/[0-9]+(?:\.[0-9]+)?/g) || [];
  const numericValues = matches
    .map((value) => safeNumber(value))
    .filter((value) => value > 0 && value !== LEGACY_ENTITY_PRICE);

  return {
    price: numericValues[0] || 0,
    comparePrice: numericValues[1] || 0
  };
}

function buildFallbackProducts() {
  const now = new Date().toISOString();
  return [
    normalizeProduct({
      id: createId(),
      name: "Pepperoni Pizza",
      category: "Pizza",
      price: 4.59,
      comparePrice: 7.59,
      stock: 18,
      sku: "PIZZ-PEPPER",
      status: "active",
      featured: true,
      description: "Classic pizza with pepperoni, mozzarella and tomato sauce.",
      image: "assets/images/pizza-receipe-1.png",
      alt: "Pepperoni Pizza",
      tags: ["pizza", "classic"],
      createdAt: now,
      updatedAt: now
    })
  ];
}

function extractDivBlockByClass(html, className, startIndex = 0) {
  const marker = `class="${className}"`;
  const markerIndex = html.indexOf(marker, startIndex);
  if (markerIndex === -1) {
    return null;
  }

  const divStart = html.lastIndexOf("<div", markerIndex);
  if (divStart === -1) {
    return null;
  }

  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = divStart;
  let depth = 0;
  let match;

  while ((match = tagPattern.exec(html))) {
    if (match[0].startsWith("</")) {
      depth -= 1;
    } else {
      depth += 1;
    }

    if (depth === 0) {
      return {
        html: html.slice(divStart, tagPattern.lastIndex),
        start: divStart,
        end: tagPattern.lastIndex
      };
    }
  }

  return null;
}

function normalizeProduct(product) {
  const safeProduct = product || {};
  const name = String(safeProduct.name || "Untitled Product").trim();
  const category = normalizeCategoryName(String(safeProduct.category || "Menu").trim());
  const createdAt = safeProduct.createdAt || new Date().toISOString();
  const updatedAt = safeProduct.updatedAt || createdAt;

  return {
    id: String(safeProduct.id || createId()),
    name: name,
    category: category,
    price: safeNumber(safeProduct.price),
    comparePrice: safeNumber(safeProduct.comparePrice),
    stock: Math.max(0, Math.round(safeNumber(safeProduct.stock))),
    sku: String(safeProduct.sku || buildSuggestedSku(name, category)).trim(),
    status: normalizeStatus(safeProduct.status),
    featured: Boolean(safeProduct.featured),
    description: String(safeProduct.description || "").trim(),
    image: String(safeProduct.image || "").trim(),
    alt: String(safeProduct.alt || name).trim(),
    tags: normalizeTags(safeProduct.tags),
    createdAt: createdAt,
    updatedAt: updatedAt
  };
}

function normalizeStatus(status) {
  const safeStatus = String(status || "active").trim().toLowerCase();
  const allowedStatuses = new Set(["active", "draft", "sold-out", "archived"]);
  return allowedStatuses.has(safeStatus) ? safeStatus : "active";
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }

  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeCategoryName(category) {
  const cleanCategory = cleanText(category).replace(/\s+/g, " ").trim();
  const mappedCategory = CATEGORY_NAME_MAP[cleanCategory.toUpperCase()];
  if (mappedCategory) {
    return mappedCategory;
  }

  return cleanCategory
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Menu";
}

function cleanText(value) {
  return decodeHtml(String(value || ""))
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function buildSuggestedSku(name, category) {
  const prefix = slugify(category || "menu").slice(0, 4).toUpperCase() || "MENU";
  const suffix = slugify(name || "item").slice(0, 6).toUpperCase() || "ITEM";
  return `${prefix}-${suffix}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createId() {
  return `prod-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function writeProductsToFile(products) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const normalizedProducts = products.map((product) => normalizeProduct(product));
  const tempPath = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(normalizedProducts, null, 2));
  fs.renameSync(tempPath, DATA_FILE);
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;

    request.on("data", (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_REQUEST_BYTES) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("utf8").trim();
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}
