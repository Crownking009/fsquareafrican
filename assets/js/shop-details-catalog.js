jQuery(function ($) {
    "use strict";

    var PRODUCTS_API_URL = "/api/products";
    var FALLBACK_PRODUCTS_URL = "data/products.json";
    var BROWSER_CATALOG_KEY = "foodweb_catalog_products_v1";
    var SELECTED_PRODUCT_KEY = "foodweb_selected_product_id";
    var DETAILS_FOR = $(".product-details-for");
    var DETAILS_NAV = $(".product-details-nav");
    var RELATED_GRID = $("#related-products-grid");
    var SERVING_MODE_OPTIONS = [
        { value: "single", label: "Single Item", options: ["Standard Order"] },
        { value: "portion", label: "Portion", options: ["Portion"] },
        { value: "half-full-portion", label: "Half / Full Portion", options: ["Half Portion", "Full Portion"] },
        { value: "plate", label: "Plate", options: ["Plate"] },
        { value: "bowl", label: "Bowl", options: ["Bowl"] },
        { value: "piece", label: "Piece", options: ["1 Piece"] },
        { value: "pack", label: "Pack", options: ["Pack"] },
        { value: "cup", label: "Cup", options: ["Cup"] },
        { value: "bottle", label: "Bottle", options: ["Bottle"] },
        { value: "tray", label: "Tray", options: ["Tray"] },
        { value: "small-medium-large", label: "Small / Medium / Large", options: ["Small", "Medium", "Large"] },
        { value: "small-large", label: "Small / Large", options: ["Small", "Large"] },
        { value: "regular-large", label: "Regular / Large", options: ["Regular", "Large"] },
        { value: "custom", label: "Custom Options", options: [] }
    ];
    var REVIEWER_NAMES = [
        { name: "Amara James", role: "Weekend Customer", image: "assets/images/client-1.jpg" },
        { name: "Tobi Kareem", role: "Office Lunch Order", image: "assets/images/client-2.jpg" },
        { name: "Kemi Lawson", role: "Family Table", image: "assets/images/client-3.jpg" },
        { name: "Daniel Obi", role: "Repeat Customer", image: "assets/images/client-1.jpg" }
    ];

    if (!DETAILS_FOR.length || !DETAILS_NAV.length || !RELATED_GRID.length) {
        return;
    }

    hydrateProductDetails();

    async function hydrateProductDetails() {
        try {
            var catalog = await fetchProductsCatalog();
            var products = catalog.products.filter(function (product) {
                return product.status === "active" || product.status === "sold-out";
            });

            if (!products.length) {
                return;
            }

            var product = resolveSelectedProduct(products);
            renderProductDetails(product, products);
        } catch (error) {
            window.console && console.warn("Shared product catalog unavailable, using shop details fallback markup.", error);
        }
    }

    async function fetchProductsCatalog() {
        try {
            return {
                mode: "server",
                products: await fetchProductsFromApi()
            };
        } catch (error) {
            try {
                return {
                    mode: "file",
                    products: await fetchProductsFromJsonFile()
                };
            } catch (fileError) {
                // Keep the existing browser-storage fallback when the JSON file is not reachable.
            }

            var browserProducts = readProductsFromBrowserStorage();
            if (browserProducts.length) {
                return {
                    mode: "browser",
                    products: browserProducts
                };
            }
            throw error;
        }
    }

    async function fetchProductsFromApi() {
        var response = await fetch(PRODUCTS_API_URL, {
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Unable to load shared product catalog.");
        }

        var payload = await response.json();
        var products = Array.isArray(payload) ? payload : payload.products;
        return Array.isArray(products) ? products.map(normalizeProduct) : [];
    }

    async function fetchProductsFromJsonFile() {
        var response = await fetch(FALLBACK_PRODUCTS_URL, {
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Unable to load product catalog fallback.");
        }

        var payload = await response.json();
        var products = Array.isArray(payload) ? payload : payload.products;
        return Array.isArray(products) ? products.map(normalizeProduct) : [];
    }

    function readProductsFromBrowserStorage() {
        try {
            var stored = JSON.parse(localStorage.getItem(BROWSER_CATALOG_KEY) || "[]");
            return Array.isArray(stored) ? stored.map(normalizeProduct) : [];
        } catch (error) {
            return [];
        }
    }

    function normalizeProduct(product) {
        var safeProduct = product || {};
        var name = String(safeProduct.name || "Untitled Product").trim();
        var category = normalizeCategoryName(safeProduct.category);
        var servingMode = normalizeServingMode(safeProduct.servingMode, category);
        var servingOptions = normalizeServingOptions(safeProduct.servingOptions, servingMode, category);
        var tags = normalizeTags(safeProduct.tags);
        var customizationGroups = normalizeCustomizationGroups(safeProduct.customizationGroups, category, name, tags, safeProduct.toppings);

        return {
            id: String(safeProduct.id || "").trim(),
            name: name,
            category: category,
            price: safeNumber(safeProduct.price),
            comparePrice: safeNumber(safeProduct.comparePrice),
            stock: Math.max(0, Math.round(safeNumber(safeProduct.stock))),
            status: normalizeStatus(safeProduct.status),
            featured: Boolean(safeProduct.featured),
            description: String(safeProduct.description || "").trim(),
            image: String(safeProduct.image || "").trim() || "assets/images/menu-1.png",
            alt: String(safeProduct.alt || name).trim() || name,
            updatedAt: safeProduct.updatedAt || safeProduct.createdAt || "",
            sku: String(safeProduct.sku || "").trim(),
            servingMode: servingMode,
            servingOptions: servingOptions,
            servingOptionPrices: normalizeServingOptionPrices(safeProduct.servingOptionPrices, servingOptions),
            tags: tags,
            toppings: normalizeToppings(safeProduct.toppings, category, name, tags, customizationGroups),
            allergens: normalizeAllergens(safeProduct.allergens, category, name, tags),
            spiceLevel: normalizeSpiceLevel(safeProduct.spiceLevel, category, name, tags),
            prepTimeMinutes: normalizePrepTimeMinutes(safeProduct.prepTimeMinutes, category, name, tags),
            customizationGroups: customizationGroups
        };
    }

    function normalizeStatus(status) {
        var safeStatus = String(status || "active").trim().toLowerCase();
        return ["active", "sold-out", "draft", "archived"].indexOf(safeStatus) === -1 ? "active" : safeStatus;
    }

    function normalizeCategoryName(category) {
        var safeCategory = String(category || "Menu").replace(/\s+/g, " ").trim();
        var key = safeCategory.toLowerCase();
        var aliases = {
            rice: "Rice Dishes",
            combo: "Combo Meal",
            "combo meal": "Combo Meal",
            "combo meals": "Combo Meal",
            "small chop": "Small Chops",
            "pepper soup": "Pepper Soups",
            "traditional snack": "Traditional Snacks",
            "traditional treat": "Traditional Treats",
            "sides & extra": "Sides and Extra"
        };
        if (aliases[key]) {
            return aliases[key];
        }

        return safeCategory || "Menu";
    }

    function normalizeTags(tags) {
        if (Array.isArray(tags)) {
            return tags.map(function (tag) {
                return String(tag || "").trim();
            }).filter(Boolean);
        }

        return String(tags || "").split(",").map(function (tag) {
            return tag.trim();
        }).filter(Boolean);
    }

    function normalizeMetadataList(values) {
        var seen = {};
        var list = Array.isArray(values) ? values : String(values || "").split(",");
        return list.map(function (value) {
            return String(value || "").replace(/\s+/g, " ").trim();
        }).filter(Boolean).filter(function (value) {
            var key = value.toLowerCase();
            if (seen[key]) {
                return false;
            }
            seen[key] = true;
            return true;
        });
    }

    function normalizeServingOptionPrices(prices, servingOptions) {
        var normalizedOptions = Array.isArray(servingOptions) ? servingOptions : [];
        var parsedPrices = {};
        var entries;

        if (Array.isArray(prices)) {
            entries = prices.map(function (value, index) {
                return {
                    key: normalizedOptions[index] || "",
                    value: value
                };
            });
        } else if (prices && typeof prices === "object") {
            entries = Object.keys(prices).map(function (key) {
                return {
                    key: key,
                    value: prices[key]
                };
            });
        } else {
            entries = String(prices || "").split(",").map(function (chunk) {
                var safeChunk = String(chunk || "").trim();
                var separatorIndex = safeChunk.indexOf(":");

                if (!safeChunk || separatorIndex === -1) {
                    return null;
                }

                return {
                    key: safeChunk.slice(0, separatorIndex).trim(),
                    value: safeChunk.slice(separatorIndex + 1).trim()
                };
            }).filter(Boolean);
        }

        entries.forEach(function (entry) {
            var key = String(entry && entry.key || "").replace(/\s+/g, " ").trim();
            var value = Math.max(0, safeNumber(entry && entry.value));

            if (key && normalizedOptions.indexOf(key) !== -1) {
                parsedPrices[key] = value;
            }
        });

        normalizedOptions.forEach(function (option) {
            if (!Object.prototype.hasOwnProperty.call(parsedPrices, option)) {
                parsedPrices[option] = 0;
            }
        });

        return parsedPrices;
    }

    function normalizeCustomizationGroupOption(option) {
        var safeOption = option || {};
        var label;
        var price;

        if (typeof safeOption === "object" && !Array.isArray(safeOption)) {
            label = String(safeOption.label || safeOption.name || "").replace(/\s+/g, " ").trim();
            price = Math.max(0, safeNumber(safeOption.price));
            return label ? { label: label, price: price } : null;
        }

        label = String(safeOption || "").replace(/\s+/g, " ").trim();
        price = 0;

        if (label.indexOf("|") !== -1) {
            price = Math.max(0, safeNumber(label.split("|").slice(1).join("|")));
            label = label.split("|")[0].replace(/\s+/g, " ").trim();
        }

        return label ? { label: label, price: price } : null;
    }

    function normalizeCustomizationGroups(groups, category, name, tags, toppings) {
        var suggestedGroups = getSuggestedCustomizationGroups(category, name, tags, toppings);
        var source = groups;
        var normalizedGroups = [];

        if (typeof source === "string") {
            source = parseCustomizationGroupsInput(source);
        }

        if (Array.isArray(source)) {
            normalizedGroups = source.map(function (group, index) {
                var safeGroup = group || {};
                var title = String(safeGroup.title || safeGroup.name || "").replace(/\s+/g, " ").trim();
                var options = Array.isArray(safeGroup.options) ? safeGroup.options : String(safeGroup.options || "").split(",");
                var seenOptions = {};
                var normalizedOptions = options.map(normalizeCustomizationGroupOption).filter(Boolean).filter(function (entry) {
                    var key = entry.label.toLowerCase();
                    if (seenOptions[key]) {
                        return false;
                    }
                    seenOptions[key] = true;
                    return true;
                });

                if (!title || !normalizedOptions.length) {
                    return null;
                }

                return {
                    id: slugify(safeGroup.id || title || ("group-" + index)) || ("group-" + index),
                    title: title,
                    selectionType: "multiple",
                    options: normalizedOptions
                };
            }).filter(Boolean);
        }

        return normalizedGroups.length ? normalizedGroups : suggestedGroups;
    }

    function parseCustomizationGroupsInput(value) {
        return String(value || "").split(/\r?\n/).map(function (line) {
            var safeLine = String(line || "").trim();
            var separatorIndex = safeLine.indexOf(":");
            var title;
            var options;

            if (!safeLine || separatorIndex === -1) {
                return null;
            }

            title = safeLine.slice(0, separatorIndex).trim();
            options = safeLine.slice(separatorIndex + 1).split(",").map(function (option) {
                return normalizeCustomizationGroupOption(option);
            }).filter(Boolean);

            if (!title || !options.length) {
                return null;
            }

            return {
                title: title,
                selectionType: "multiple",
                options: options
            };
        }).filter(Boolean);
    }

    function getSuggestedProductInfo(category, name, tags) {
        var safeCategory = String(category || "").trim().toLowerCase();
        var safeName = String(name || "").trim().toLowerCase();
        var safeTags = normalizeTags(tags).map(function (tag) {
            return String(tag || "").trim().toLowerCase();
        });
        var presets = {
            alcohol: { toppings: ["Extra Chill", "Calabash Serve", "Citrus Slice"], allergens: ["None"], spiceLevel: "Mild", prepTimeMinutes: 4 },
            "combo meal": { toppings: ["Fried Plantain", "Moi Moi", "Ata Din Din"], allergens: ["Eggs"], spiceLevel: "Medium", prepTimeMinutes: 15 },
            swallows: { toppings: ["Extra Ewedu", "Assorted Meat", "Ponmo"], allergens: ["Fish", "Crayfish"], spiceLevel: "Medium", prepTimeMinutes: 18 },
            soups: { toppings: ["Beef", "Stock Fish", "Scent Leaves"], allergens: ["Fish", "Crayfish"], spiceLevel: "Medium", prepTimeMinutes: 20 },
            "rice dishes": { toppings: ["Fried Plantain", "Boiled Egg", "Peppered Chicken"], allergens: ["Soy"], spiceLevel: "Medium", prepTimeMinutes: 16 },
            "small chops": { toppings: ["Extra Dip", "Pepper Sauce", "Party Mix"], allergens: ["Gluten", "Eggs"], spiceLevel: "Mild", prepTimeMinutes: 10 },
            proteins: { toppings: ["Pepper Sauce", "Onion Garnish", "Fried Plantain"], allergens: ["Soy"], spiceLevel: "Hot", prepTimeMinutes: 14 },
            "pepper soups": { toppings: ["Extra Pepper", "Scent Leaves", "Fresh Ginger"], allergens: ["Fish", "Crayfish"], spiceLevel: "Hot", prepTimeMinutes: 17 },
            beans: { toppings: ["Fried Plantain", "Pepper Sauce", "Smoked Fish"], allergens: ["Fish"], spiceLevel: "Mild", prepTimeMinutes: 15 },
            porridges: { toppings: ["Smoked Fish", "Crayfish", "Ugwu"], allergens: ["Fish", "Crayfish"], spiceLevel: "Medium", prepTimeMinutes: 18 },
            "traditional snacks": { toppings: ["Pepper Dip", "Groundnut", "Extra Pack"], allergens: ["Groundnut"], spiceLevel: "Mild", prepTimeMinutes: 8 },
            "traditional treats": { toppings: ["Roasted Groundnut", "Coconut Flakes", "Sesame Sprinkle"], allergens: ["Groundnut", "Sesame"], spiceLevel: "Mild", prepTimeMinutes: 5 },
            "local beverages": { toppings: ["Citrus Slice", "Ice Cubes", "Mint"], allergens: ["None"], spiceLevel: "Mild", prepTimeMinutes: 4 },
            "nigerian refreshments": { toppings: ["Extra Chill", "Ice Cubes", "Citrus Slice"], allergens: ["None"], spiceLevel: "Mild", prepTimeMinutes: 3 },
            "sides and extra": { toppings: ["Pepper Drizzle", "Sesame Finish", "Extra Herbs"], allergens: ["Sesame"], spiceLevel: "Mild", prepTimeMinutes: 6 }
        };
        var defaults = presets[safeCategory] || { toppings: ["Chef Recommendation"], allergens: ["Ask Restaurant"], spiceLevel: "Medium", prepTimeMinutes: 12 };
        var suggested = {
            toppings: defaults.toppings.slice(),
            allergens: defaults.allergens.slice(),
            spiceLevel: defaults.spiceLevel,
            prepTimeMinutes: defaults.prepTimeMinutes
        };

        if ((safeName.indexOf("pepper") !== -1 || safeCategory === "pepper soups") && suggested.spiceLevel !== "Hot") {
            suggested.spiceLevel = "Hot";
        }
        if (
            safeCategory === "alcohol" ||
            safeCategory === "traditional treats" ||
            safeCategory === "local beverages" ||
            safeCategory === "nigerian refreshments" ||
            safeName.indexOf("palm wine") !== -1 ||
            safeName.indexOf("burukutu") !== -1 ||
            safeName.indexOf("pito") !== -1 ||
            safeName.indexOf("ogogoro") !== -1 ||
            safeName.indexOf("zobo") !== -1 ||
            safeName.indexOf("kunu") !== -1 ||
            safeName.indexOf("chapman") !== -1 ||
            safeName.indexOf("malt") !== -1
        ) {
            suggested.spiceLevel = "Mild";
        }
        if ((safeName.indexOf("fish") !== -1 || safeName.indexOf("catfish") !== -1 || safeName.indexOf("seafood") !== -1) && suggested.allergens.indexOf("Fish") === -1) {
            suggested.allergens.push("Fish");
        }
        if ((safeName.indexOf("chicken") !== -1 || safeTags.indexOf("chicken") !== -1) && suggested.toppings.indexOf("Extra Chicken") === -1 && ["rice dishes", "combo meal", "proteins"].indexOf(safeCategory) !== -1) {
            suggested.toppings.unshift("Extra Chicken");
        }

        suggested.toppings = normalizeMetadataList(suggested.toppings);
        suggested.allergens = normalizeMetadataList(suggested.allergens);
        return suggested;
    }

    function getSuggestedCustomizationGroups(category, name, tags, toppings) {
        var safeCategory = String(category || "").trim().toLowerCase();
        var info = getSuggestedProductInfo(category, name, tags);
        var summaryToppings = normalizeMetadataList(toppings);
        var categoryGroups = {
            alcohol: [
                { title: "Serving Style", options: ["Chilled Bottle", "Calabash Serve", "Shared Pot", "Citrus Slice"] },
                { title: "Pair With", options: ["Asun Bites", "Suya Bites", "Peppered Beef", "Fried Fish"] }
            ],
            "combo meal": [
                { title: "Extra Proteins", options: ["Chicken", "Peppered Beef", "Turkey", "Fried Fish"] },
                { title: "Drinks", options: ["Water", "Zobo Drink", "Chapman", "Maltina", "Kunu Aya"] },
                { title: "Toppings & Sides", options: ["Fried Plantain", "Moi Moi", "Ata Din Din", "Extra Stew"] }
            ],
            swallows: [
                { title: "Extra Proteins", options: ["Assorted Meat", "Beef", "Goat Meat", "Chicken", "Fish", "Turkey", "Ponmo", "Cow Leg"] },
                { title: "Drinks", options: ["Water", "Zobo Drink", "Chapman", "Kunu Aya", "Maltina"] },
                { title: "Toppings & Sides", options: ["Extra Ewedu", "Extra Gbegiri", "Extra Soup", "Boiled Egg", "Fried Plantain", "Extra Stew"] }
            ],
            soups: [
                { title: "Extra Proteins", options: ["Assorted Meat", "Beef", "Goat Meat", "Chicken", "Fish", "Turkey", "Stock Fish"] },
                { title: "Drinks", options: ["Water", "Zobo Drink", "Kunu Aya", "Chapman", "Maltina"] },
                { title: "Toppings & Sides", options: ["Extra Soup", "Scent Leaves", "Crayfish", "Boiled Egg", "Fried Plantain"] }
            ],
            "rice dishes": [
                { title: "Extra Proteins", options: ["Chicken", "Turkey", "Beef", "Fish", "Goat Meat", "Assorted Meat"] },
                { title: "Drinks", options: ["Water", "Zobo Drink", "Chapman", "Kunu Aya", "Maltina"] },
                { title: "Toppings & Sides", options: ["Fried Plantain", "Boiled Egg", "Ata Din Din", "Moi Moi", "Extra Stew"] }
            ],
            "small chops": [
                { title: "Extra Pieces", options: ["Puff Puff", "Suya", "Asun", "Gizdodo", "Akara"] },
                { title: "Drinks", options: ["Water", "Zobo Drink", "Chapman", "Maltina", "Kunu Aya"] },
                { title: "Dips & Extras", options: ["Pepper Sauce", "Ata Din Din", "Chili Dip", "Extra Pack"] }
            ],
            proteins: [
                { title: "Extra Proteins", options: ["Chicken", "Turkey", "Beef", "Fish", "Goat Meat"] },
                { title: "Drinks", options: ["Water", "Zobo Drink", "Chapman", "Maltina"] },
                { title: "Toppings & Sides", options: ["Pepper Sauce", "Fried Plantain", "Extra Stew", "Onion Garnish", "Moi Moi"] }
            ],
            "pepper soups": [
                { title: "Extra Proteins", options: ["Goat Meat", "Chicken", "Fish", "Assorted Meat", "Turkey"] },
                { title: "Drinks", options: ["Water", "Maltina", "Chapman", "Zobo Drink"] },
                { title: "Soup Add-Ons", options: ["Extra Pepper", "Scent Leaves", "Fresh Ginger", "Stock Fish"] }
            ],
            beans: [
                { title: "Extra Proteins", options: ["Fish", "Beef", "Chicken", "Assorted Meat"] },
                { title: "Drinks", options: ["Water", "Maltina", "Zobo Drink", "Kunu Aya"] },
                { title: "Toppings & Sides", options: ["Fried Plantain", "Boiled Egg", "Pepper Sauce", "Extra Stew"] }
            ],
            porridges: [
                { title: "Extra Proteins", options: ["Fish", "Chicken", "Beef", "Turkey"] },
                { title: "Drinks", options: ["Water", "Maltina", "Zobo Drink", "Kunu Aya"] },
                { title: "Toppings & Sides", options: ["Crayfish", "Ugwu", "Pepper Sauce", "Boiled Egg"] }
            ],
            "traditional snacks": [
                { title: "Extra Pieces", options: ["Akara", "Boli", "Kokoro", "Plantain Chips"] },
                { title: "Drinks", options: ["Water", "Zobo Drink", "Chapman", "Maltina"] },
                { title: "Dips & Extras", options: ["Pepper Dip", "Groundnut", "Extra Pack"] }
            ],
            "traditional treats": [
                { title: "Add-Ons", options: ["Roasted Groundnut", "Coconut Flakes", "Sesame Sprinkle", "Extra Pack"] },
                { title: "Pair With", options: ["Zobo Drink", "Kunu Aya", "Chapman", "Maltina"] }
            ],
            "local beverages": [
                { title: "Add-Ins", options: ["Ice Cubes", "Mint", "Citrus Slice", "Extra Chill"] },
                { title: "Pair With", options: ["Akara Basket", "Chin Chin Crunch", "Puff Puff Basket", "Boli & Groundnut"] }
            ],
            "nigerian refreshments": [
                { title: "Add-Ins", options: ["Extra Chill", "Ice Cubes", "Citrus Slice"] },
                { title: "Pair With", options: ["Suya Bites", "Akara Basket", "Fried Plantain", "Puff Puff Basket"] }
            ],
            "sides and extra": [
                { title: "Extra Proteins", options: ["Chicken", "Beef", "Fish", "Turkey"] },
                { title: "Drinks", options: ["Water", "Maltina", "Zobo Drink"] },
                { title: "Toppings & Sides", options: ["Pepper Drizzle", "Extra Stew", "Ata Din Din", "Fried Plantain"] }
            ]
        };
        return (categoryGroups[safeCategory] || [
            { title: "Extras", options: ["Chef Recommendation", "Extra Stew", "Boiled Egg"] },
            { title: "Drinks", options: ["Water", "Zobo Drink", "Maltina"] }
        ]).map(function (group, index) {
            return {
                id: slugify(group.title) || ("addon-group-" + index),
                title: group.title,
                selectionType: "multiple",
                options: normalizeMetadataList((index === 0 ? group.options.concat(summaryToppings) : group.options).concat(index === 0 ? info.toppings : [])).map(function (option) {
                    return {
                        label: option,
                        price: 0
                    };
                })
            };
        }).filter(function (group) {
            return group.options.length > 0;
        });
    }

    function normalizeToppings(toppings, category, name, tags, customizationGroups) {
        var normalized = normalizeMetadataList(toppings);
        if (normalized.length) {
            return normalized;
        }

        if (Array.isArray(customizationGroups) && customizationGroups.length) {
            return customizationGroups.reduce(function (list, group) {
                var groupTitle = String(group.title || "").toLowerCase();
                if (groupTitle.indexOf("topping") !== -1 || groupTitle.indexOf("side") !== -1) {
                    return list.concat(group.options.map(function (option) {
                        return option.label;
                    }));
                }
                return list;
            }, []).slice(0, 8);
        }

        return getSuggestedProductInfo(category, name, tags).toppings;
    }

    function normalizeAllergens(allergens, category, name, tags) {
        var normalized = normalizeMetadataList(allergens);
        return normalized.length ? normalized : getSuggestedProductInfo(category, name, tags).allergens;
    }

    function normalizeSpiceLevel(spiceLevel, category, name, tags) {
        var safeValue = String(spiceLevel || "").trim().toLowerCase();
        var allowed = {
            mild: "Mild",
            medium: "Medium",
            hot: "Hot"
        };
        return allowed[safeValue] || getSuggestedProductInfo(category, name, tags).spiceLevel;
    }

    function normalizePrepTimeMinutes(value, category, name, tags) {
        var parsed = Math.max(0, Math.round(safeNumber(value)));
        return parsed > 0 ? parsed : getSuggestedProductInfo(category, name, tags).prepTimeMinutes;
    }

    function getServingModeConfig(mode) {
        var safeMode = String(mode || "").trim().toLowerCase();
        return SERVING_MODE_OPTIONS.find(function (option) {
            return option.value === safeMode;
        }) || SERVING_MODE_OPTIONS[0];
    }

    function inferServingMode(category) {
        var safeCategory = String(category || "").trim().toLowerCase();
        var categoryMap = {
            alcohol: "bottle",
            "combo meal": "plate",
            swallows: "portion",
            soups: "portion",
            "rice dishes": "portion",
            "small chops": "pack",
            proteins: "piece",
            "pepper soups": "bowl",
            beans: "portion",
            porridges: "bowl",
            "traditional snacks": "pack",
            "traditional treats": "pack",
            "local beverages": "bottle",
            "nigerian refreshments": "bottle",
            "sides and extra": "portion"
        };

        return categoryMap[safeCategory] || "single";
    }

    function normalizeServingMode(mode, category) {
        var requestedMode = String(mode || "").trim().toLowerCase();
        var config = getServingModeConfig(requestedMode);
        if (requestedMode && config.value === requestedMode) {
            return config.value;
        }
        return inferServingMode(category);
    }

    function normalizeServingOptions(options, servingMode, category) {
        var normalizedMode = normalizeServingMode(servingMode, category);
        var config = getServingModeConfig(normalizedMode);
        var list = Array.isArray(options) ? options : String(options || "").split(",");
        var normalized = list.map(function (option) {
            return String(option || "").replace(/\s+/g, " ").trim();
        }).filter(Boolean);

        if (normalized.length) {
            return normalized;
        }

        if (config.options.length) {
            return config.options.slice();
        }

        return ["Custom Order"];
    }

    function resolveSelectedProduct(products) {
        var params = new URLSearchParams(window.location.search);
        var requestedId = String(params.get("product") || readSelectedProductId() || "").trim();
        var selectedProduct = products.find(function (product) {
            return product.id === requestedId;
        });

        if (!selectedProduct) {
            selectedProduct = products[0];
        }

        persistSelectedProduct(selectedProduct.id);
        return selectedProduct;
    }

    function readSelectedProductId() {
        try {
            return sessionStorage.getItem(SELECTED_PRODUCT_KEY) || "";
        } catch (error) {
            return "";
        }
    }

    function persistSelectedProduct(productId) {
        try {
            sessionStorage.setItem(SELECTED_PRODUCT_KEY, String(productId || ""));
        } catch (error) {
            return;
        }
    }

    function renderProductDetails(product, products) {
        var description = product.description || "Freshly prepared and ready to order.";
        var relatedProducts = getRelatedProducts(products, product);
        var reviews = generateProductReviews(product);
        var reviewSummary = summarizeReviews(reviews);

        destroyProductDetailsSlider();

        DETAILS_FOR.html(buildGalleryMarkup(product));
        DETAILS_NAV.html(buildGalleryNavMarkup(product));

        $("#product-detail-status")
            .removeClass("product-status-danger product-status-warning")
            .addClass(getStatusClassName(product))
            .text(getStatusLabel(product));
        $("#product-detail-name").text(product.name);
        $("#product-detail-id").text("SKU: " + (product.sku || product.id));
        $("#product-detail-price").html(buildPriceMarkup(product, product.servingOptions[0], []));
        $("#product-detail-summary").text(description);
        $("#product-detail-meta-list").html(buildProductMetaMarkup(product));
        $("#product-detail-customization-groups").html(buildCustomizationGroupsMarkup(product));
        $("#product-detail-description").html(buildDescriptionMarkup(product));
        $("#product-detail-serving-title").text(getServingSectionTitle(product));
        $("#product-detail-serving-options").html(buildServingOptionsMarkup(product));
        $("#product-detail-review-stars").html(buildReviewStarsMarkup(reviewSummary.average));
        $("#product-detail-review-count").text("(" + reviews.length + " Reviews)");
        $("#product-detail-review-tab-count").text("(" + reviews.length + ")");
        $("#product-detail-review-list").html(reviews.map(buildReviewMarkup).join(""));
        $("#product-detail-cart-button")
            .prop("disabled", product.status === "sold-out")
            .toggleClass("disabled", product.status === "sold-out")
            .attr("data-cart-product-id", product.id)
            .attr("data-cart-name", product.name)
            .attr("data-cart-sku", product.sku || product.id)
            .attr("data-cart-price", String(product.price))
            .attr("data-cart-base-price", String(product.price))
            .attr("data-cart-serving-prices", JSON.stringify(product.servingOptionPrices || {}))
            .attr("data-cart-image", product.image)
            .attr("data-cart-alt", product.alt || product.name)
            .attr("data-cart-stock", String(product.stock))
            .attr("data-cart-serving-mode", product.servingMode || "single")
            .attr("data-cart-details-url", buildProductDetailsUrl(product))
            .html((product.status === "sold-out" ? "Currently Sold Out" : "Add To Cart") + ' <i class="flaticon-shopping-cart-black-shape"></i>');
        $("#product-detail-wishlist-link")
            .attr("href", "wishlist.html?product=" + encodeURIComponent(product.id || ""))
            .attr("aria-label", "Add " + product.name + " to wishlist");
        RELATED_GRID.html(relatedProducts.length ? relatedProducts.map(buildRelatedProductMarkup).join("") : buildEmptyRelatedMarkup());

        bindServingOptionSelection(product);
        bindCustomizationSelection(product);
        updateDisplayedProductPrice(product);

        if (document.title) {
            document.title = product.name + " - Shop Details";
        }

        initProductDetailsSlider();
        initPopupGallery();
    }

    function buildGalleryMarkup(product) {
        return [
            '<div class="product-for-item">',
            '<a href="', escapeAttribute(product.image), '"><img src="', escapeAttribute(product.image), '" alt="', escapeAttribute(product.alt || product.name), '"></a>',
            "</div>",
            '<div class="product-for-item">',
            '<a href="', escapeAttribute(product.image), '"><img src="', escapeAttribute(product.image), '" alt="', escapeAttribute(product.alt || product.name), '"></a>',
            "</div>",
            '<div class="product-for-item">',
            '<a href="', escapeAttribute(product.image), '"><img src="', escapeAttribute(product.image), '" alt="', escapeAttribute(product.alt || product.name), '"></a>',
            "</div>"
        ].join("");
    }

    function buildGalleryNavMarkup(product) {
        return [
            '<div class="product-nav-item"><div class="product-nav-item-inner"><img src="', escapeAttribute(product.image), '" alt="', escapeAttribute(product.alt || product.name), '"></div></div>',
            '<div class="product-nav-item"><div class="product-nav-item-inner"><img src="', escapeAttribute(product.image), '" alt="', escapeAttribute(product.alt || product.name), '"></div></div>',
            '<div class="product-nav-item"><div class="product-nav-item-inner"><img src="', escapeAttribute(product.image), '" alt="', escapeAttribute(product.alt || product.name), '"></div></div>'
        ].join("");
    }

    function buildPriceMarkup(product, selectedOption, selectedAddOns) {
        var totalPrice = calculateSelectedUnitPrice(product, selectedOption, selectedAddOns);
        var comparePrice = product.comparePrice > 0 ? product.comparePrice + getServingOptionPriceAdjustment(product, selectedOption) + getSelectedAddOnPriceTotal(selectedAddOns) : 0;
        return [
            "<h4>",
            escapeHtml(formatCurrency(totalPrice)),
            comparePrice > 0 ? "<del>" + escapeHtml(formatCurrency(comparePrice)) + "</del>" : "",
            "</h4>"
        ].join("");
    }

    function buildDescriptionMarkup(product) {
        var paragraphs = [
            product.description || "Freshly prepared and ready to order.",
            buildProductStory(product),
            buildServingStory(product),
            buildKitchenNotesStory(product)
        ].filter(Boolean);

        return paragraphs.map(function (paragraph) {
            return "<p>" + escapeHtml(paragraph) + "</p>";
        }).join("");
    }

    function buildProductStory(product) {
        var tagText = product.tags.length ? " Popular notes include " + product.tags.join(", ") + "." : "";
        var featuredText = product.featured ? " It is one of the highlighted items on the menu because it consistently performs well with returning guests." : "";
        return product.name + " sits in our " + product.category + " selection and is prepared to stay balanced, flavorful, and easy to enjoy from the first bite to the last." + tagText + featuredText;
    }

    function buildServingStory(product) {
        var config = getServingModeConfig(product.servingMode);
        var optionsText = product.servingOptions.join(", ");
        return "This item is sold as " + config.label.toLowerCase() + (optionsText ? " with options such as " + optionsText + "." : ".") + " If you are ordering for a group, pair it with related sides or drinks from the same category for a more complete table.";
    }

    function buildKitchenNotesStory(product) {
        var toppingsText = product.toppings.length ? " Optional toppings include " + product.toppings.join(", ") + "." : "";
        var allergensText = product.allergens.length ? " Main allergen notes: " + product.allergens.join(", ") + "." : "";
        return "Kitchen timing is usually around " + product.prepTimeMinutes + " minutes and the spice profile is " + product.spiceLevel.toLowerCase() + "." + toppingsText + allergensText;
    }

    function getServingSectionTitle(product) {
        var sizeModes = ["small-medium-large", "small-large", "regular-large"];
        return sizeModes.indexOf(product.servingMode) !== -1 ? "Sizes:" : "Sold As:";
    }

    function buildServingOptionsMarkup(product) {
        return product.servingOptions.map(function (option, index) {
            return '<li' + (index === 0 ? ' class="active"' : "") + ">" + escapeHtml(option) + "</li>";
        }).join("");
    }

    function buildProductMetaMarkup(product) {
        return [
            "<li>Prep " + escapeHtml(String(product.prepTimeMinutes)) + " mins</li>",
            "<li>Spice " + escapeHtml(product.spiceLevel) + "</li>",
            "<li>Allergens " + escapeHtml(product.allergens.join(", ")) + "</li>"
        ].join("");
    }

    function buildCustomizationGroupsMarkup(product) {
        if (!product.customizationGroups.length) {
            return [
                "<h4>Optional Toppings:</h4>",
                '<ul class="product-size-list" id="product-detail-toppings-list">',
                product.toppings.map(function (topping) {
                    return "<li>" + escapeHtml(topping) + "</li>";
                }).join(""),
                "</ul>"
            ].join("");
        }

        return product.customizationGroups.map(function (group, groupIndex) {
            return [
                '<div class="product-customization-group mb-20" data-customization-group="', escapeAttribute(group.id || ("group-" + groupIndex)), '">',
                "<h4>", escapeHtml(group.title), ":</h4>",
                '<div class="row g-2 product-customization-options">',
                group.options.map(function (option, optionIndex) {
                    var inputId = "product-addon-" + escapeAttribute(group.id || ("group-" + groupIndex)) + "-" + String(optionIndex);
                    var label = option.label || "";
                    var price = Math.max(0, safeNumber(option.price));
                    return [
                        '<div class="col-sm-6">',
                        '<div class="form-check">',
                        '<input class="form-check-input product-addon-checkbox" type="checkbox" id="', inputId, '" data-addon-group="', escapeAttribute(group.title), '" data-addon-price="', escapeAttribute(String(price)), '" value="', escapeAttribute(label), '">',
                        '<label class="form-check-label color-white" for="', inputId, '">', escapeHtml(label), (price > 0 ? ' <span class="color-yellow">(' + escapeHtml(formatCurrency(price)) + ')</span>' : ""), "</label>",
                        "</div>",
                        "</div>"
                    ].join("");
                }).join(""),
                "</div>",
                "</div>"
            ].join("");
        }).join("");
    }

    function bindServingOptionSelection(product) {
        $("#product-detail-serving-options li").off("click.shopDetailsServing").on("click.shopDetailsServing", function () {
            $(this).addClass("active").siblings().removeClass("active");
            updateDisplayedProductPrice(product);
        });
    }

    function bindCustomizationSelection(product) {
        $(".product-addon-checkbox").off("change.shopDetailsAddons").on("change.shopDetailsAddons", function () {
            $(this).closest(".form-check").toggleClass("active", $(this).is(":checked"));
            updateDisplayedProductPrice(product);
        });
    }

    function getServingOptionPriceAdjustment(product, optionLabel) {
        var safeOption = String(optionLabel || "").replace(/\s+/g, " ").trim();
        var priceMap = normalizeServingOptionPrices(product && product.servingOptionPrices, product && product.servingOptions);
        return safeOption ? Math.max(0, safeNumber(priceMap[safeOption])) : 0;
    }

    function getSelectedAddOnsFromForm() {
        return $(".product-addon-checkbox:checked").map(function () {
            var checkbox = $(this);
            return {
                group: String(checkbox.attr("data-addon-group") || "Add-on").trim() || "Add-on",
                label: String(checkbox.val() || "").trim(),
                price: Math.max(0, safeNumber(checkbox.attr("data-addon-price")))
            };
        }).get().filter(function (entry) {
            return entry.label;
        });
    }

    function getSelectedAddOnPriceTotal(selectedAddOns) {
        return (Array.isArray(selectedAddOns) ? selectedAddOns : []).reduce(function (sum, entry) {
            return sum + Math.max(0, safeNumber(entry && entry.price));
        }, 0);
    }

    function calculateSelectedUnitPrice(product, selectedOption, selectedAddOns) {
        return safeNumber(product && product.price) + getServingOptionPriceAdjustment(product, selectedOption) + getSelectedAddOnPriceTotal(selectedAddOns);
    }

    function updateDisplayedProductPrice(product) {
        var selectedOption = $("#product-detail-serving-options li.active").first().text().trim() || (product.servingOptions[0] || "Standard Order");
        var selectedAddOns = getSelectedAddOnsFromForm();
        $("#product-detail-price").html(buildPriceMarkup(product, selectedOption, selectedAddOns));
    }

    function generateProductReviews(product) {
        var profileSeed = hashString(product.id || product.name);
        var reviewerOne = REVIEWER_NAMES[profileSeed % REVIEWER_NAMES.length];
        var reviewerTwo = REVIEWER_NAMES[(profileSeed + 1) % REVIEWER_NAMES.length];
        var reviewTexts = [
            "The " + product.name + " arrived fresh and well finished. The " + getPrimaryServingText(product).toLowerCase() + " felt satisfying and the flavor matched the menu description.",
            "I would order this again because the texture and seasoning stayed balanced throughout. It works especially well if you already enjoy " + product.category.toLowerCase() + " dishes.",
            product.featured ? "I can see why this item is featured. It tastes like something the kitchen has refined over time and the presentation is consistently neat." : "This one feels dependable on a busy day. It is easy to recommend when you want something familiar, filling, and well prepared."
        ];

        return [
            {
                name: reviewerOne.name,
                role: reviewerOne.role,
                image: reviewerOne.image,
                rating: 5,
                text: reviewTexts[0]
            },
            {
                name: reviewerTwo.name,
                role: reviewerTwo.role,
                image: reviewerTwo.image,
                rating: 4,
                text: reviewTexts[1]
            },
            {
                name: REVIEWER_NAMES[(profileSeed + 2) % REVIEWER_NAMES.length].name,
                role: REVIEWER_NAMES[(profileSeed + 2) % REVIEWER_NAMES.length].role,
                image: REVIEWER_NAMES[(profileSeed + 2) % REVIEWER_NAMES.length].image,
                rating: product.featured ? 5 : 4,
                text: reviewTexts[2]
            }
        ];
    }

    function summarizeReviews(reviews) {
        var total = reviews.reduce(function (sum, review) {
            return sum + review.rating;
        }, 0);
        return {
            average: reviews.length ? total / reviews.length : 0
        };
    }

    function buildReviewMarkup(review) {
        return [
            '<div class="testimonial-carousel-item bg-main product-review-item">',
            '<p class="carousel-para">', escapeHtml(review.text), "</p>",
            '<div class="carousel-info-grid">',
            '<div class="carousel-thumb"><img src="', escapeAttribute(review.image), '" alt="', escapeAttribute(review.name), '"></div>',
            '<div class="carousel-info text-end">',
            '<div class="review-star"><ul class="justify-content-end">', buildReviewStarsMarkup(review.rating), "</ul></div>",
            '<h3 class="carousel-name">', escapeHtml(review.name), "</h3>",
            '<h4 class="carousel-designation">', escapeHtml(review.role), "</h4>",
            "</div>",
            "</div>",
            "</div>"
        ].join("");
    }

    function buildReviewStarsMarkup(rating) {
        var fullStars = Math.max(0, Math.min(5, Math.round(rating)));
        var stars = [];
        var index;

        for (index = 0; index < 5; index += 1) {
            if (index < fullStars) {
                stars.push('<li class="full-star"><i class="flaticon-star-1"></i></li>');
            } else {
                stars.push('<li><i class="flaticon-star-2"></i></li>');
            }
        }

        return stars.join("");
    }

    function getPrimaryServingText(product) {
        return product.servingOptions[0] || getServingModeConfig(product.servingMode).label;
    }

    function getRelatedProducts(products, currentProduct) {
        var currentCategory = normalizeComparableValue(currentProduct.category);
        var currentTags = getComparableTags(currentProduct).filter(function (tag) {
            return tag !== currentCategory;
        });

        return products
            .filter(function (product) {
                return product.id !== currentProduct.id;
            })
            .map(function (product) {
                var productCategory = normalizeComparableValue(product.category);
                var productTags = getComparableTags(product).filter(function (tag) {
                    return tag !== productCategory;
                });
                var sharedTags = currentTags.filter(function (tag) {
                    return productTags.indexOf(tag) !== -1;
                });
                var categoryMatch = productCategory === currentCategory;
                var score = 0;

                if (categoryMatch) {
                    score += 100;
                }

                if (sharedTags.length) {
                    score += sharedTags.length * 25;
                }

                if (product.featured) {
                    score += 5;
                }

                return {
                    product: product,
                    score: score,
                    categoryMatch: categoryMatch,
                    sharedTags: sharedTags,
                    updatedAt: String(product.updatedAt || "")
                };
            })
            .filter(function (entry) {
                return entry.score > 0;
            })
            .sort(function (left, right) {
                if (right.score !== left.score) {
                    return right.score - left.score;
                }

                if (right.sharedTags.length !== left.sharedTags.length) {
                    return right.sharedTags.length - left.sharedTags.length;
                }

                if (right.categoryMatch !== left.categoryMatch) {
                    return right.categoryMatch ? 1 : -1;
                }

                if (right.updatedAt !== left.updatedAt) {
                    return right.updatedAt.localeCompare(left.updatedAt);
                }

                return left.product.name.localeCompare(right.product.name);
            })
            .slice(0, 6)
            .map(function (entry) {
                return entry.product;
            });
    }

    function getComparableTags(product) {
        var tags = Array.isArray(product.tags) ? product.tags : [];

        return tags.map(function (tag) {
            return normalizeComparableValue(tag);
        }).filter(Boolean);
    }

    function normalizeComparableValue(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function buildRelatedProductMarkup(product) {
        var detailsUrl = buildProductDetailsUrl(product);
        return [
            '<div class="receipe-item receipe-item-black pb-30">',
            '<div class="receipe-item-inner">',
            '<div class="receipe-image">',
            '<a href="', escapeAttribute(detailsUrl), '" data-product-id="', escapeAttribute(product.id), '">',
            '<img src="', escapeAttribute(product.image), '" alt="', escapeAttribute(product.alt || product.name), '">',
            "</a>",
            "</div>",
            '<div class="receipe-content">',
            '<div class="receipe-info">',
            '<h3><a href="', escapeAttribute(detailsUrl), '" data-product-id="', escapeAttribute(product.id), '">', escapeHtml(product.name), "</a></h3>",
            "<h4>",
            escapeHtml(formatCurrency(product.price)),
            product.comparePrice > 0 ? "<del>" + escapeHtml(formatCurrency(product.comparePrice)) + "</del>" : "",
            "</h4>",
            "</div>",
            '<div class="receipe-cart receipe-cart-main">',
            '<a href="wishlist.html?product=', escapeAttribute(product.id), '">',
            '<i class="flaticon-supermarket-basket"></i>',
            '<i class="flaticon-supermarket-basket"></i>',
            "</a>",
            "</div>",
            "</div>",
            "</div>",
            "</div>"
        ].join("");
    }

    function buildEmptyRelatedMarkup() {
        return [
            '<div class="receipe-item receipe-item-black pb-30">',
            '<div class="receipe-item-inner">',
            '<div class="receipe-content">',
            '<div class="receipe-info">',
            "<h3>No related items found</h3>",
            "<h4>Check back for more menu suggestions.</h4>",
            "</div>",
            "</div>",
            "</div>",
            "</div>"
        ].join("");
    }

    function destroyProductDetailsSlider() {
        if (DETAILS_FOR.hasClass("slick-initialized")) {
            DETAILS_FOR.slick("unslick");
        }
        if (DETAILS_NAV.hasClass("slick-initialized")) {
            DETAILS_NAV.slick("unslick");
        }
    }

    function initProductDetailsSlider() {
        if (!$.fn.slick) {
            return;
        }

        DETAILS_FOR.slick({
            slidesToShow: 1,
            slidesToScroll: 1,
            arrows: false,
            asNavFor: ".product-details-nav",
            speed: 1200,
            infinite: false
        });

        DETAILS_NAV.slick({
            slidesToShow: Math.min(3, Math.max(1, DETAILS_NAV.children().length)),
            slidesToScroll: 1,
            asNavFor: ".product-details-for",
            dots: false,
            arrows: false,
            focusOnSelect: true,
            speed: 1200,
            margin: 30,
            infinite: false,
            responsive: [
                {
                    breakpoint: 767,
                    settings: {
                        slidesToShow: Math.min(2, Math.max(1, DETAILS_NAV.children().length)),
                        slidesToScroll: 1
                    }
                }
            ]
        });
    }

    function initPopupGallery() {
        if (!$.fn.magnificPopup || DETAILS_FOR.data("magnificPopup")) {
            return;
        }

        DETAILS_FOR.magnificPopup({
            delegate: "a",
            type: "image",
            tLoading: "Loading image #%curr%..."
        });
    }

    function getStatusClassName(product) {
        return product.status === "sold-out" ? "product-status-warning" : "product-status-danger";
    }

    function getStatusLabel(product) {
        if (product.status === "sold-out") {
            return "Sold Out";
        }
        return product.featured ? "Featured" : "Available";
    }

    function buildProductDetailsUrl(product) {
        return "shop-details.html?product=" + encodeURIComponent(product.id || "");
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(safeNumber(value));
    }

    function safeNumber(value) {
        var parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function slugify(value) {
        return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }

    function hashString(value) {
        return String(value || "").split("").reduce(function (hash, character) {
            return ((hash << 5) - hash) + character.charCodeAt(0);
        }, 0) >>> 0;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/`/g, "&#96;");
    }
});
