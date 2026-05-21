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
  BURGER: "Proteins",
  SANDWITCH: "Sandwich",
  SANDWICH: "Sandwich",
  SHAKE: "Alcohol",
  ALCOHOL: "Alcohol",
  "ICE-CREAME": "Combo Meal",
  "ICE CREAM": "Combo Meal",
  "COMBO MEAL": "Combo Meal",
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
const SERVING_MODE_OPTIONS = [
  { value: "single", options: ["Standard Order"] },
  { value: "portion", options: ["Portion"] },
  { value: "half-full-portion", options: ["Half Portion", "Full Portion"] },
  { value: "plate", options: ["Plate"] },
  { value: "bowl", options: ["Bowl"] },
  { value: "piece", options: ["1 Piece"] },
  { value: "pack", options: ["Pack"] },
  { value: "cup", options: ["Cup"] },
  { value: "bottle", options: ["Bottle"] },
  { value: "tray", options: ["Tray"] },
  { value: "small-medium-large", options: ["Small", "Medium", "Large"] },
  { value: "small-large", options: ["Small", "Large"] },
  { value: "regular-large", options: ["Regular", "Large"] },
  { value: "custom", options: [] }
];

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
  const servingMode = normalizeServingMode(safeProduct.servingMode, category);
  const servingOptions = normalizeServingOptions(safeProduct.servingOptions, servingMode, category);
  const tags = normalizeTags(safeProduct.tags);
  const customizationGroups = normalizeCustomizationGroups(safeProduct.customizationGroups, category, name, tags, safeProduct.toppings);

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
    servingMode: servingMode,
    servingOptions,
    servingOptionPrices: normalizeServingOptionPrices(safeProduct.servingOptionPrices, servingOptions),
    tags: tags,
    toppings: normalizeToppings(safeProduct.toppings, category, name, tags, customizationGroups),
    allergens: normalizeAllergens(safeProduct.allergens, category, name, tags),
    spiceLevel: normalizeSpiceLevel(safeProduct.spiceLevel, category, name, tags),
    prepTimeMinutes: normalizePrepTimeMinutes(safeProduct.prepTimeMinutes, category, name, tags),
    customizationGroups: customizationGroups,
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

function normalizeMetadataList(values) {
  const seen = new Set();
  const list = Array.isArray(values) ? values : String(values || "").split(",");
  return list
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function normalizeCustomizationGroupOption(option) {
  const safeOption = option || {};
  let label;
  let price;

  if (typeof safeOption === "object" && !Array.isArray(safeOption)) {
    label = String(safeOption.label || safeOption.name || "").replace(/\s+/g, " ").trim();
    price = Math.max(0, safeNumber(safeOption.price));
    return label ? { label, price } : null;
  }

  label = String(safeOption || "").replace(/\s+/g, " ").trim();
  price = 0;

  if (label.includes("|")) {
    price = Math.max(0, safeNumber(label.split("|").slice(1).join("|")));
    label = label.split("|")[0].replace(/\s+/g, " ").trim();
  }

  return label ? { label, price } : null;
}

function normalizeCustomizationGroups(groups, category, name, tags, toppings) {
  const suggestedGroups = getSuggestedCustomizationGroups(category, name, tags, toppings);
  let source = groups;
  let normalizedGroups = [];

  if (typeof source === "string") {
    source = parseCustomizationGroupsInput(source);
  }

  if (Array.isArray(source)) {
    normalizedGroups = source
      .map((group, index) => {
        const safeGroup = group || {};
        const title = String(safeGroup.title || safeGroup.name || "").replace(/\s+/g, " ").trim();
        const options = Array.isArray(safeGroup.options) ? safeGroup.options : String(safeGroup.options || "").split(",");
        const seenOptions = new Set();
        const normalizedOptions = options
          .map(normalizeCustomizationGroupOption)
          .filter(Boolean)
          .filter((entry) => {
            const key = entry.label.toLowerCase();
            if (seenOptions.has(key)) {
              return false;
            }
            seenOptions.add(key);
            return true;
          });

        if (!title || !normalizedOptions.length) {
          return null;
        }

        return {
          id: slugify(safeGroup.id || title || `group-${index}`) || `group-${index}`,
          title,
          selectionType: "multiple",
          options: normalizedOptions
        };
      })
      .filter(Boolean);
  }

  return normalizedGroups.length ? normalizedGroups : suggestedGroups;
}

function parseCustomizationGroupsInput(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => {
      const safeLine = String(line || "").trim();
      const separatorIndex = safeLine.indexOf(":");
      let title;
      let options;

      if (!safeLine || separatorIndex === -1) {
        return null;
      }

      title = safeLine.slice(0, separatorIndex).trim();
      options = safeLine
        .slice(separatorIndex + 1)
        .split(",")
        .map((option) => normalizeCustomizationGroupOption(option))
        .filter(Boolean);

      if (!title || !options.length) {
        return null;
      }

      return {
        title,
        selectionType: "multiple",
        options
      };
    })
    .filter(Boolean);
}

function getSuggestedProductInfo(category, name, tags) {
  const safeCategory = String(category || "").trim().toLowerCase();
  const safeName = String(name || "").trim().toLowerCase();
  const safeTags = normalizeTags(tags).map((tag) => String(tag || "").trim().toLowerCase());
  const presets = {
    pizza: { toppings: ["Extra Cheese", "Pepperoni", "Jalapeno"], allergens: ["Milk", "Gluten"], spiceLevel: "Medium", prepTimeMinutes: 18 },
    burger: { toppings: ["Cheese Slice", "Caramelized Onion", "Special Sauce"], allergens: ["Gluten", "Milk"], spiceLevel: "Medium", prepTimeMinutes: 14 },
    sandwich: { toppings: ["Cheese", "Fresh Lettuce", "Chili Mayo"], allergens: ["Gluten", "Milk"], spiceLevel: "Mild", prepTimeMinutes: 10 },
    alcohol: { toppings: ["Ice Cubes", "Lime Wedge", "Mint"], allergens: ["None"], spiceLevel: "Mild", prepTimeMinutes: 4 },
    "combo meal": { toppings: ["Fries", "Coleslaw", "Extra Sauce"], allergens: ["Gluten", "Eggs"], spiceLevel: "Medium", prepTimeMinutes: 15 },
    dessert: { toppings: ["Fresh Fruit", "Caramel Sauce", "Ice Cream Scoop"], allergens: ["Milk", "Eggs", "Gluten"], spiceLevel: "Mild", prepTimeMinutes: 7 },
    swallows: { toppings: ["Extra Ewedu", "Assorted Meat", "Ponmo"], allergens: ["Fish", "Crayfish"], spiceLevel: "Medium", prepTimeMinutes: 18 },
    soups: { toppings: ["Beef", "Stock Fish", "Scent Leaves"], allergens: ["Fish", "Crayfish"], spiceLevel: "Medium", prepTimeMinutes: 20 },
    "rice dishes": { toppings: ["Fried Plantain", "Boiled Egg", "Peppered Chicken"], allergens: ["Soy"], spiceLevel: "Medium", prepTimeMinutes: 16 },
    "small chops": { toppings: ["Extra Dip", "Pepper Sauce", "Party Mix"], allergens: ["Gluten", "Eggs"], spiceLevel: "Mild", prepTimeMinutes: 10 },
    proteins: { toppings: ["Pepper Sauce", "Onion Garnish", "Fried Plantain"], allergens: ["Soy"], spiceLevel: "Hot", prepTimeMinutes: 14 },
    "pepper soups": { toppings: ["Extra Pepper", "Scent Leaves", "Fresh Ginger"], allergens: ["Fish", "Crayfish"], spiceLevel: "Hot", prepTimeMinutes: 17 },
    beans: { toppings: ["Fried Plantain", "Pepper Sauce", "Smoked Fish"], allergens: ["Fish"], spiceLevel: "Mild", prepTimeMinutes: 15 },
    porridges: { toppings: ["Smoked Fish", "Crayfish", "Ugwu"], allergens: ["Fish", "Crayfish"], spiceLevel: "Medium", prepTimeMinutes: 18 },
    "snacks and pastries": { toppings: ["Chili Dip", "Ketchup", "Extra Filling"], allergens: ["Gluten", "Eggs"], spiceLevel: "Mild", prepTimeMinutes: 8 },
    "local beverages": { toppings: ["Citrus Slice", "Ice Cubes", "Mint"], allergens: ["None"], spiceLevel: "Mild", prepTimeMinutes: 4 },
    "sides and extra": { toppings: ["Pepper Drizzle", "Sesame Finish", "Extra Herbs"], allergens: ["Sesame"], spiceLevel: "Mild", prepTimeMinutes: 6 }
  };
  const defaults = presets[safeCategory] || { toppings: ["Chef Recommendation"], allergens: ["Ask Restaurant"], spiceLevel: "Medium", prepTimeMinutes: 12 };
  const suggested = {
    toppings: defaults.toppings.slice(),
    allergens: defaults.allergens.slice(),
    spiceLevel: defaults.spiceLevel,
    prepTimeMinutes: defaults.prepTimeMinutes
  };

  if ((safeName.includes("pepper") || safeCategory === "pepper soups") && suggested.spiceLevel !== "Hot") {
    suggested.spiceLevel = "Hot";
  }
  if (safeCategory === "alcohol" || safeName.includes("wine") || safeName.includes("whiskey") || safeName.includes("cocktail") || safeCategory === "dessert") {
    suggested.spiceLevel = "Mild";
  }
  if ((safeName.includes("fish") || safeName.includes("catfish") || safeName.includes("seafood")) && !suggested.allergens.includes("Fish")) {
    suggested.allergens.push("Fish");
  }
  if ((safeName.includes("chicken") || safeTags.includes("chicken")) && !suggested.toppings.includes("Extra Chicken") && ["rice dishes", "burger", "sandwich", "proteins"].includes(safeCategory)) {
    suggested.toppings.unshift("Extra Chicken");
  }

  suggested.toppings = normalizeMetadataList(suggested.toppings);
  suggested.allergens = normalizeMetadataList(suggested.allergens);
  return suggested;
}

function getSuggestedCustomizationGroups(category, name, tags, toppings) {
  const safeCategory = String(category || "").trim().toLowerCase();
  const info = getSuggestedProductInfo(category, name, tags);
  const summaryToppings = normalizeMetadataList(toppings);
  const categoryGroups = {
    pizza: [
      { title: "Extra Proteins", options: ["Chicken", "Pepperoni", "Beef", "Turkey"] },
      { title: "Drinks", options: ["Coke", "Fanta", "Sprite", "Water", "Malt"] },
      { title: "Toppings & Sides", options: ["Extra Cheese", "Jalapeno", "Mushroom", "Onion", "Olives", "Fried Plantain"] }
    ],
    burger: [
      { title: "Extra Proteins", options: ["Chicken", "Beef Patty", "Turkey", "Bacon Style Beef"] },
      { title: "Drinks", options: ["Coke", "Fanta", "Sprite", "Water", "Milkshake"] },
      { title: "Toppings & Sides", options: ["Cheese Slice", "Caramelized Onion", "Lettuce", "Tomato", "Special Sauce", "Fries"] }
    ],
    sandwich: [
      { title: "Extra Proteins", options: ["Chicken", "Beef", "Turkey", "Fish"] },
      { title: "Drinks", options: ["Coke", "Fanta", "Sprite", "Water", "Chapman"] },
      { title: "Toppings & Sides", options: ["Cheese", "Chili Mayo", "Fresh Lettuce", "Tomato", "Cucumber", "Fries"] }
    ],
    alcohol: [
      { title: "Mixers", options: ["Tonic Water", "Soda Water", "Orange Juice", "Cranberry Juice", "Ginger Ale", "Ice Cubes"] },
      { title: "Pair With", options: ["Peppered Beef", "Grilled Chicken", "Small Chops", "Fried Fish"] }
    ],
    "combo meal": [
      { title: "Extra Proteins", options: ["Chicken", "Peppered Beef", "Turkey", "Fried Fish"] },
      { title: "Drinks", options: ["Water", "Coke", "Fanta", "Sprite", "Malt", "Chapman"] },
      { title: "Toppings & Sides", options: ["Fries", "Plantain", "Coleslaw", "Extra Sauce", "Salad", "Moi Moi"] }
    ],
    dessert: [
      { title: "Toppings", options: ["Ice Cream Scoop", "Fresh Fruit", "Caramel Sauce", "Chocolate Drizzle", "Cookie Crumbs", "Whipped Cream"] },
      { title: "Pair With", options: ["Water", "Chapman", "Cabernet Red Wine", "Tropical Rum Cocktail"] }
    ],
    swallows: [
      { title: "Extra Proteins", options: ["Assorted Meat", "Beef", "Goat Meat", "Chicken", "Fish", "Turkey", "Ponmo", "Cow Leg"] },
      { title: "Drinks", options: ["Water", "Coke", "Fanta", "Sprite", "Malt", "Zobo Drink", "Chapman"] },
      { title: "Toppings & Sides", options: ["Extra Ewedu", "Extra Gbegiri", "Extra Soup", "Boiled Egg", "Fried Plantain", "Extra Sauce"] }
    ],
    soups: [
      { title: "Extra Proteins", options: ["Assorted Meat", "Beef", "Goat Meat", "Chicken", "Fish", "Turkey", "Stock Fish"] },
      { title: "Drinks", options: ["Water", "Coke", "Fanta", "Malt", "Zobo Drink", "Chapman"] },
      { title: "Toppings & Sides", options: ["Extra Soup", "Scent Leaves", "Crayfish", "Boiled Egg", "Fried Plantain"] }
    ],
    "rice dishes": [
      { title: "Extra Proteins", options: ["Chicken", "Turkey", "Beef", "Fish", "Goat Meat", "Assorted Meat"] },
      { title: "Drinks", options: ["Water", "Coke", "Fanta", "Sprite", "Malt", "Chapman", "Zobo Drink"] },
      { title: "Toppings & Sides", options: ["Fried Plantain", "Boiled Egg", "Extra Sauce", "Salad", "Moi Moi", "Coleslaw"] }
    ],
    "small chops": [
      { title: "Extra Pieces", options: ["Samosa", "Spring Roll", "Puff Puff", "Meat Pie", "Chicken Pie"] },
      { title: "Drinks", options: ["Water", "Coke", "Fanta", "Sprite", "Chapman", "Zobo Drink"] },
      { title: "Dips & Extras", options: ["Pepper Sauce", "Ketchup", "Chili Dip", "Extra Pack"] }
    ],
    proteins: [
      { title: "Extra Proteins", options: ["Chicken", "Turkey", "Beef", "Fish", "Goat Meat"] },
      { title: "Drinks", options: ["Water", "Coke", "Fanta", "Malt", "Chapman"] },
      { title: "Toppings & Sides", options: ["Pepper Sauce", "Fried Plantain", "Extra Sauce", "Onion Garnish", "Coleslaw"] }
    ],
    "pepper soups": [
      { title: "Extra Proteins", options: ["Goat Meat", "Chicken", "Fish", "Assorted Meat", "Turkey"] },
      { title: "Drinks", options: ["Water", "Malt", "Chapman", "Zobo Drink"] },
      { title: "Soup Add-Ons", options: ["Extra Pepper", "Scent Leaves", "Fresh Ginger", "Stock Fish"] }
    ],
    beans: [
      { title: "Extra Proteins", options: ["Fish", "Beef", "Chicken", "Assorted Meat"] },
      { title: "Drinks", options: ["Water", "Coke", "Malt", "Zobo Drink"] },
      { title: "Toppings & Sides", options: ["Fried Plantain", "Boiled Egg", "Pepper Sauce", "Extra Stew"] }
    ],
    porridges: [
      { title: "Extra Proteins", options: ["Fish", "Chicken", "Beef", "Turkey"] },
      { title: "Drinks", options: ["Water", "Coke", "Malt", "Zobo Drink"] },
      { title: "Toppings & Sides", options: ["Crayfish", "Ugwu", "Pepper Sauce", "Boiled Egg"] }
    ],
    "snacks and pastries": [
      { title: "Extra Pieces", options: ["Sausage Roll", "Chicken Pie", "Fish Roll", "Doughnut Bites"] },
      { title: "Drinks", options: ["Water", "Coke", "Fanta", "Sprite", "Chapman"] },
      { title: "Dips & Extras", options: ["Chili Dip", "Ketchup", "Extra Filling"] }
    ],
    "local beverages": [
      { title: "Add-Ins", options: ["Ice Cubes", "Mint", "Citrus Slice", "Extra Chill"] },
      { title: "Pair With", options: ["Doughnut Bites", "Sausage Roll", "Fish Roll", "Chicken Pie"] }
    ],
    "sides and extra": [
      { title: "Extra Proteins", options: ["Chicken", "Beef", "Fish", "Turkey"] },
      { title: "Drinks", options: ["Water", "Coke", "Fanta", "Malt"] },
      { title: "Toppings & Sides", options: ["Pepper Drizzle", "Extra Sauce", "Sesame Finish", "Fried Plantain"] }
    ]
  };
  return (categoryGroups[safeCategory] || [
    { title: "Extras", options: ["Chef Recommendation", "Extra Sauce", "Boiled Egg"] },
    { title: "Drinks", options: ["Water", "Coke", "Fanta"] }
  ])
    .map((group, index) => ({
      id: slugify(group.title) || `addon-group-${index}`,
      title: group.title,
      selectionType: "multiple",
      options: normalizeMetadataList((index === 0 ? group.options.concat(summaryToppings) : group.options).concat(index === 0 ? info.toppings : [])).map((option) => ({
        label: option,
        price: 0
      }))
    }))
    .filter((group) => group.options.length > 0);
}

function normalizeToppings(toppings, category, name, tags, customizationGroups) {
  const normalized = normalizeMetadataList(toppings);
  if (normalized.length) {
    return normalized;
  }

  if (Array.isArray(customizationGroups) && customizationGroups.length) {
    return customizationGroups
      .reduce((list, group) => {
        const groupTitle = String(group.title || "").toLowerCase();
        if (groupTitle.includes("topping") || groupTitle.includes("side")) {
          return list.concat(group.options.map((option) => option.label));
        }
        return list;
      }, [])
      .slice(0, 8);
  }

  return getSuggestedProductInfo(category, name, tags).toppings;
}

function normalizeAllergens(allergens, category, name, tags) {
  const normalized = normalizeMetadataList(allergens);
  return normalized.length ? normalized : getSuggestedProductInfo(category, name, tags).allergens;
}

function normalizeSpiceLevel(spiceLevel, category, name, tags) {
  const safeValue = String(spiceLevel || "").trim().toLowerCase();
  const allowed = {
    mild: "Mild",
    medium: "Medium",
    hot: "Hot"
  };
  return allowed[safeValue] || getSuggestedProductInfo(category, name, tags).spiceLevel;
}

function normalizePrepTimeMinutes(value, category, name, tags) {
  const parsed = Math.max(0, Math.round(safeNumber(value)));
  return parsed > 0 ? parsed : getSuggestedProductInfo(category, name, tags).prepTimeMinutes;
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

function getServingModeConfig(mode) {
  const safeMode = String(mode || "").trim().toLowerCase();
  return SERVING_MODE_OPTIONS.find((option) => option.value === safeMode) || SERVING_MODE_OPTIONS[0];
}

function inferServingMode(category) {
  const safeCategory = String(category || "").trim().toLowerCase();
  const categoryMap = {
    pizza: "small-medium-large",
    burger: "single",
    sandwich: "single",
    alcohol: "bottle",
    "combo meal": "plate",
    dessert: "portion",
    swallows: "portion",
    soups: "portion",
    "rice dishes": "portion",
    "small chops": "pack",
    proteins: "piece",
    "pepper soups": "bowl",
    beans: "portion",
    porridges: "bowl",
    "snacks and pastries": "piece",
    "local beverages": "bottle",
    "sides and extra": "portion"
  };

  return categoryMap[safeCategory] || "single";
}

function normalizeServingMode(mode, category) {
  const requestedMode = String(mode || "").trim().toLowerCase();
  const config = getServingModeConfig(requestedMode);
  if (requestedMode && config.value === requestedMode) {
    return config.value;
  }
  return inferServingMode(category);
}

function normalizeServingOptions(options, servingMode, category) {
  const normalizedMode = normalizeServingMode(servingMode, category);
  const config = getServingModeConfig(normalizedMode);
  const list = Array.isArray(options) ? options : String(options || "").split(",");
  const normalized = list
    .map((option) => String(option || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (normalized.length) {
    return normalized;
  }

  if (config.options.length) {
    return config.options.slice();
  }

  return ["Custom Order"];
}

function normalizeServingOptionPrices(prices, servingOptions) {
  const normalizedOptions = Array.isArray(servingOptions) ? servingOptions : [];
  let entries;
  const parsedPrices = {};

  if (Array.isArray(prices)) {
    entries = prices.map((value, index) => ({
      key: normalizedOptions[index] || "",
      value
    }));
  } else if (prices && typeof prices === "object") {
    entries = Object.keys(prices).map((key) => ({
      key,
      value: prices[key]
    }));
  } else {
    entries = String(prices || "")
      .split(",")
      .map((chunk) => {
        const safeChunk = String(chunk || "").trim();
        const separatorIndex = safeChunk.indexOf(":");
        if (!safeChunk || separatorIndex === -1) {
          return null;
        }

        return {
          key: safeChunk.slice(0, separatorIndex).trim(),
          value: safeChunk.slice(separatorIndex + 1).trim()
        };
      })
      .filter(Boolean);
  }

  entries.forEach((entry) => {
    const key = String((entry && entry.key) || "").replace(/\s+/g, " ").trim();
    const value = Math.max(0, safeNumber(entry && entry.value));
    if (key && normalizedOptions.includes(key)) {
      parsedPrices[key] = value;
    }
  });

  normalizedOptions.forEach((option) => {
    if (!Object.prototype.hasOwnProperty.call(parsedPrices, option)) {
      parsedPrices[option] = 0;
    }
  });

  return parsedPrices;
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
