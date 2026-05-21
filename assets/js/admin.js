(function () {
    "use strict";

    var STORAGE_KEYS = {
        activity: "foodweb_admin_activity_v1",
        catalog: "foodweb_catalog_products_v1",
        draft: "foodweb_admin_draft_v1"
    };
    var PRODUCTS_API_URL = "/api/products";
    var FALLBACK_PRODUCTS_URL = "data/products.json";

    var APPROX_LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;
    var LOW_STOCK_THRESHOLD = 5;
    var MAX_ACTIVITY_ITEMS = 12;
    var DEFAULT_CATEGORIES = [
        "Alcohol",
        "Combo Meal",
        "Dessert",
        "Swallows",
        "Soups",
        "Rice Dishes",
        "Small Chops",
        "Proteins",
        "Pepper Soups",
        "Beans",
        "Porridges",
        "Snacks and Pastries",
        "Local Beverages",
        "Sides and Extra"
    ];
    var IMAGE_PRESETS = [
        { label: "Amala, Gbegiri & Ewedu", value: "assets/images/pizza-receipe-1.png" },
        { label: "Ofada Rice & Ayamase", value: "assets/images/burger-receipe-2.png" },
        { label: "Jollof Rice with Chicken", value: "assets/images/sandwitch-receipe-3.png" },
        { label: "Jollof Rice", value: "assets/images/product-4.png" },
        { label: "Catfish Pepper Soup", value: "assets/images/blog-nav-4.jpg" },
        { label: "Pounded Yam", value: "assets/images/product-1.png" },
        { label: "Zobo Drink", value: "assets/images/shake-receipe-4.png" },
        { label: "Doughnut Bites", value: "assets/images/dessert-receipe-5.png" }
    ];
    var SERVING_MODE_OPTIONS = [
        { value: "single", label: "Single Item", helper: "One standard order with no size selection.", options: ["Standard Order"] },
        { value: "portion", label: "Portion", helper: "Use for meals sold as one regular portion.", options: ["Portion"] },
        { value: "half-full-portion", label: "Half / Full Portion", helper: "Use when customers can choose a half or full serving.", options: ["Half Portion", "Full Portion"] },
        { value: "plate", label: "Plate", helper: "Use for dishes sold as plated meals.", options: ["Plate"] },
        { value: "bowl", label: "Bowl", helper: "Use for soups, porridges, and similar bowl servings.", options: ["Bowl"] },
        { value: "piece", label: "Piece", helper: "Use for pastries, proteins, and snacks sold per piece.", options: ["1 Piece"] },
        { value: "pack", label: "Pack", helper: "Use when the product is sold as a bundle or snack pack.", options: ["Pack"] },
        { value: "cup", label: "Cup", helper: "Use for drinks or desserts sold per cup.", options: ["Cup"] },
        { value: "bottle", label: "Bottle", helper: "Use for bottled beverages.", options: ["Bottle"] },
        { value: "tray", label: "Tray", helper: "Use for catering or family tray servings.", options: ["Tray"] },
        { value: "small-medium-large", label: "Small / Medium / Large", helper: "Use when the product has three size choices.", options: ["Small", "Medium", "Large"] },
        { value: "small-large", label: "Small / Large", helper: "Use when the product has only small and large sizes.", options: ["Small", "Large"] },
        { value: "regular-large", label: "Regular / Large", helper: "Use for two-size products with regular and large options.", options: ["Regular", "Large"] },
        { value: "custom", label: "Custom Options", helper: "Type your own options separated by commas.", options: [] }
    ];

    var state = {
        products: [],
        activity: [],
        catalogMode: "server",
        catalogNoticeShown: false,
        selectedIds: new Set(),
        editingId: null,
        draftLoaded: false
    };

    var dom = {};

    document.addEventListener("DOMContentLoaded", function () {
        init().catch(function (error) {
            console.error(error);
            showToast("Admin could not start correctly.", "error");
            applyDefaultFormState();
            renderAll();
            renderPreviewFromForm();
        });
    });

    async function init() {
        cacheDom();
        renderSidebarCategories();
        bindEvents();
        await loadState();
        populateCategoryInputs();
        populateImagePresetOptions();
        populateServingModeOptions();
        renderAll();
        maybeAnnounceCatalogMode();
        if (!restoreDraft()) {
            applyDefaultFormState();
        }
        renderPreviewFromForm();
    }

    function cacheDom() {
        dom.form = document.getElementById("product-form");
        dom.productId = document.getElementById("product-id");
        dom.productName = document.getElementById("product-name");
        dom.productCategory = document.getElementById("product-category");
        dom.productCategoryCustom = document.getElementById("product-category-custom");
        dom.productPrice = document.getElementById("product-price");
        dom.productComparePrice = document.getElementById("product-compare-price");
        dom.productStock = document.getElementById("product-stock");
        dom.productStatus = document.getElementById("product-status");
        dom.productServingMode = document.getElementById("product-serving-mode");
        dom.productServingOptions = document.getElementById("product-serving-options");
        dom.productServingPrices = document.getElementById("product-serving-prices");
        dom.productServingHelper = document.getElementById("product-serving-helper");
        dom.productSku = document.getElementById("product-sku");
        dom.productTags = document.getElementById("product-tags");
        dom.productToppings = document.getElementById("product-toppings");
        dom.productAllergens = document.getElementById("product-allergens");
        dom.productSpiceLevel = document.getElementById("product-spice-level");
        dom.productPrepTime = document.getElementById("product-prep-time");
        dom.productCustomizationGroups = document.getElementById("product-customization-groups");
        dom.productDescription = document.getElementById("product-description");
        dom.productImagePreset = document.getElementById("product-image-preset");
        dom.productImageUrl = document.getElementById("product-image-url");
        dom.productImageAlt = document.getElementById("product-image-alt");
        dom.productImageFile = document.getElementById("product-image-file");
        dom.productFeatured = document.getElementById("product-featured");
        dom.imagePreview = document.getElementById("product-image-preview-tag");
        dom.imagePlaceholder = document.getElementById("product-image-placeholder");
        dom.formModeBadge = document.getElementById("form-mode-badge");
        dom.draftIndicator = document.getElementById("draft-indicator");
        dom.resetFormBtn = document.getElementById("reset-form-btn");
        dom.clearImageBtn = document.getElementById("clear-image-btn");
        dom.clearDraftBtn = document.getElementById("clear-draft-btn");
        dom.loadStarterBtn = document.getElementById("load-starter-data");
        dom.exportProductsBtn = document.getElementById("export-products-btn");
        dom.importProductsBtn = document.getElementById("import-products-btn");
        dom.clearAllProductsBtn = document.getElementById("clear-all-products-btn");
        dom.importFileInput = document.getElementById("import-file-input");
        dom.importMode = document.getElementById("import-mode");
        dom.catalogSearch = document.getElementById("catalog-search");
        dom.catalogCategoryFilter = document.getElementById("catalog-category-filter");
        dom.catalogStatusFilter = document.getElementById("catalog-status-filter");
        dom.catalogSort = document.getElementById("catalog-sort");
        dom.selectAllProducts = document.getElementById("select-all-products");
        dom.bulkFeatureBtn = document.getElementById("bulk-feature-btn");
        dom.bulkActivateBtn = document.getElementById("bulk-activate-btn");
        dom.bulkArchiveBtn = document.getElementById("bulk-archive-btn");
        dom.bulkDeleteBtn = document.getElementById("bulk-delete-btn");
        dom.productsTableBody = document.getElementById("products-table-body");
        dom.productsCardList = document.getElementById("products-card-list");
        dom.productsEmptyState = document.getElementById("products-empty-state");
        dom.selectionSummary = document.getElementById("selection-summary");
        dom.storageUsageText = document.getElementById("storage-usage-text");
        dom.storageUsageBar = document.getElementById("storage-usage-bar");
        dom.categoryBreakdownList = document.getElementById("category-breakdown-list");
        dom.activityList = document.getElementById("activity-list");
        dom.previewCardImage = document.getElementById("preview-card-image");
        dom.previewCategory = document.getElementById("preview-category");
        dom.previewStatus = document.getElementById("preview-status");
        dom.previewFeatured = document.getElementById("preview-featured");
        dom.previewName = document.getElementById("preview-name");
        dom.previewSku = document.getElementById("preview-sku");
        dom.previewServing = document.getElementById("preview-serving");
        dom.previewExtra = document.getElementById("preview-extra");
        dom.previewDescription = document.getElementById("preview-description");
        dom.previewToppings = document.getElementById("preview-toppings");
        dom.previewCustomizations = document.getElementById("preview-customizations");
        dom.previewPrice = document.getElementById("preview-price");
        dom.sidebarCategoryChips = document.getElementById("sidebar-category-chips");
        dom.toastRegion = document.getElementById("toast-region");
        dom.statProducts = document.getElementById("stat-products");
        dom.statFeatured = document.getElementById("stat-featured");
        dom.statLowStock = document.getElementById("stat-low-stock");
        dom.statCategories = document.getElementById("stat-categories");
        dom.statStock = document.getElementById("stat-stock");
    }

    function bindEvents() {
        dom.form.addEventListener("submit", handleFormSubmit);
        dom.resetFormBtn.addEventListener("click", function () {
            resetForm();
            showToast("Form cleared. You can start a fresh product.", "success");
        });
        dom.clearImageBtn.addEventListener("click", function () {
            dom.productImageUrl.value = "";
            dom.productImageAlt.value = "";
            dom.productImageFile.value = "";
            syncImagePresetSelection("");
            renderImagePreview("");
            saveDraftFromForm();
            renderPreviewFromForm();
        });
        dom.clearDraftBtn.addEventListener("click", function () {
            clearDraft();
            showToast("Draft removed from this browser.", "success");
        });
        dom.loadStarterBtn.addEventListener("click", handleResetStarterCatalog);
        dom.exportProductsBtn.addEventListener("click", exportProducts);
        dom.importProductsBtn.addEventListener("click", function () {
            dom.importFileInput.click();
        });
        dom.importFileInput.addEventListener("change", handleImportProducts);
        dom.clearAllProductsBtn.addEventListener("click", clearAllProducts);
        dom.productImageFile.addEventListener("change", handleImageUpload);
        dom.productCategory.addEventListener("change", function () {
            toggleCategoryCustomField();
            if (!dom.productSku.dataset.userTouched) {
                dom.productSku.value = buildSuggestedSku(dom.productName.value, getResolvedCategoryValue());
            }
            applyProductInfoPreset(true);
            saveDraftFromForm();
            renderPreviewFromForm();
        });
        dom.productCategoryCustom.addEventListener("input", function () {
            if (!dom.productSku.dataset.userTouched) {
                dom.productSku.value = buildSuggestedSku(dom.productName.value, getResolvedCategoryValue());
            }
            applyProductInfoPreset(true);
            saveDraftFromForm();
            renderPreviewFromForm();
        });
        dom.productServingMode.addEventListener("change", function () {
            applyServingModePreset();
            saveDraftFromForm();
            renderPreviewFromForm();
        });
        dom.productImagePreset.addEventListener("change", function () {
            applySelectedImagePreset();
            saveDraftFromForm();
            renderPreviewFromForm();
        });
        dom.productImageUrl.addEventListener("input", function () {
            syncImagePresetSelection(dom.productImageUrl.value.trim());
            renderImagePreview(dom.productImageUrl.value.trim());
            saveDraftFromForm();
            renderPreviewFromForm();
        });

        [
            dom.productName,
            dom.productPrice,
            dom.productComparePrice,
            dom.productStock,
            dom.productStatus,
            dom.productServingOptions,
            dom.productServingPrices,
            dom.productSku,
            dom.productTags,
            dom.productToppings,
            dom.productAllergens,
            dom.productSpiceLevel,
            dom.productPrepTime,
            dom.productCustomizationGroups,
            dom.productDescription,
            dom.productImageAlt,
            dom.productFeatured
        ].forEach(function (field) {
            var eventName = field.type === "checkbox" || field.tagName === "SELECT" ? "change" : "input";
            field.addEventListener(eventName, function () {
                if (field === dom.productName && !dom.productSku.dataset.userTouched) {
                    dom.productSku.value = buildSuggestedSku(dom.productName.value, getResolvedCategoryValue());
                }
                if (field === dom.productName) {
                    applyProductInfoPreset(true);
                }
                if (field === dom.productServingOptions) {
                    syncServingOptionPriceInput(true);
                }
                saveDraftFromForm();
                renderPreviewFromForm();
            });
        });

        dom.productSku.addEventListener("input", function () {
            dom.productSku.dataset.userTouched = dom.productSku.value.trim() ? "true" : "";
        });

        dom.catalogSearch.addEventListener("input", renderProductViews);
        dom.catalogCategoryFilter.addEventListener("change", renderProductViews);
        dom.catalogStatusFilter.addEventListener("change", renderProductViews);
        dom.catalogSort.addEventListener("change", renderProductViews);
        dom.selectAllProducts.addEventListener("change", toggleSelectAllVisibleProducts);
        dom.bulkFeatureBtn.addEventListener("click", function () {
            updateSelectedProducts(function (product) {
                product.featured = true;
            }, "Selected products marked as featured.");
        });
        dom.bulkActivateBtn.addEventListener("click", function () {
            updateSelectedProducts(function (product) {
                product.status = "active";
            }, "Selected products activated.");
        });
        dom.bulkArchiveBtn.addEventListener("click", function () {
            updateSelectedProducts(function (product) {
                product.status = "archived";
            }, "Selected products archived.");
        });
        dom.bulkDeleteBtn.addEventListener("click", bulkDeleteProducts);
        dom.productsTableBody.addEventListener("click", handleProductActionClick);
        dom.productsCardList.addEventListener("click", handleProductActionClick);
        dom.productsTableBody.addEventListener("change", handleSelectionToggle);
        dom.productsCardList.addEventListener("change", handleSelectionToggle);
    }

    async function loadState() {
        state.activity = parseJson(localStorage.getItem(STORAGE_KEYS.activity), []).slice(0, MAX_ACTIVITY_ITEMS);
        var catalog = await loadProductsCatalog();
        state.catalogMode = catalog.mode;
        state.products = catalog.products.map(function (product) {
            return normalizeProduct(product);
        });
    }

    async function loadProductsCatalog() {
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
                console.warn("Shared catalog server unavailable. Falling back to browser storage.", error);
            }
            var browserProducts = readProductsFromBrowserStorage();
            if (!browserProducts.length) {
                browserProducts = getStarterProducts();
                writeProductsToBrowserStorage(browserProducts);
            }
            return {
                mode: "browser",
                products: browserProducts
            };
        }
    }

    function getStarterProducts() {
        return [
            makeStarterProduct("Amala, Gbegiri & Ewedu", "Swallows", 4.59, 7.59, 18, "Soft amala served with silky ewedu and rich gbegiri for a true Yoruba classic.", "assets/images/pizza-receipe-1.png", ["swallows", "amala", "gbegiri"], true, "active"),
            makeStarterProduct("Ofada Rice & Ayamase", "Rice Dishes", 5.12, 6.59, 12, "Local ofada rice matched with green ayamase sauce and tender beef.", "assets/images/burger-receipe-2.png", ["rice", "ofada", "ayamase"], true, "active"),
            makeStarterProduct("Jollof Rice with Chicken", "Rice Dishes", 6.57, 7.12, 9, "Smoky jollof rice served with juicy chicken and full party-style flavour.", "assets/images/sandwitch-receipe-3.png", ["rice", "jollof", "chicken"], false, "active"),
            makeStarterProduct("Jollof Rice", "Rice Dishes", 6.80, 7.60, 15, "Smoky jollof rice with rich pepper and tomato flavor.", "assets/images/product-4.png", ["rice", "party"], true, "active"),
            makeStarterProduct("Catfish Pepper Soup", "Pepper Soups", 8.25, 9.35, 4, "Aromatic catfish pepper soup with warming native spice.", "assets/images/blog-nav-4.jpg", ["soup", "catfish"], false, "active"),
            makeStarterProduct("Pounded Yam", "Swallows", 6.40, 7.20, 8, "Soft swallow prepared to pair with rich native soups.", "assets/images/product-1.png", ["swallow", "classic"], false, "active"),
            makeStarterProduct("Zobo Drink", "Local Beverages", 3.95, 4.60, 21, "Refreshing hibiscus drink with spice notes and chilled finish.", "assets/images/shake-receipe-4.png", ["drink", "zobo"], true, "active"),
            makeStarterProduct("Doughnut Bites", "Snacks and Pastries", 4.55, 5.15, 6, "Soft sweet doughnut bites for quick dessert and snack orders.", "assets/images/dessert-receipe-5.png", ["snack", "pastry"], false, "draft")
        ];
    }

    function makeStarterProduct(name, category, price, comparePrice, stock, description, image, tags, featured, status) {
        var now = new Date().toISOString();
        return normalizeProduct({
            id: createId(),
            name: name,
            category: category,
            price: price,
            comparePrice: comparePrice,
            stock: stock,
            sku: buildSuggestedSku(name, category),
            status: status,
            featured: featured,
            description: description,
            image: image,
            alt: name,
            tags: tags,
            createdAt: now,
            updatedAt: now
        });
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

    function serializeServingOptionPrices(priceMap, servingOptions) {
        var normalizedOptions = Array.isArray(servingOptions) ? servingOptions : [];
        var normalizedMap = normalizeServingOptionPrices(priceMap, normalizedOptions);

        return normalizedOptions.map(function (option) {
            return option + ": " + String(safeNumber(normalizedMap[option]));
        }).join(", ");
    }

    function getServingOptionPriceAdjustment(product, optionLabel) {
        var safeOption = String(optionLabel || "").replace(/\s+/g, " ").trim();
        var priceMap = normalizeServingOptionPrices(product && product.servingOptionPrices, product && product.servingOptions);
        return safeOption ? Math.max(0, safeNumber(priceMap[safeOption])) : 0;
    }

    function hasServingOptionPriceAdjustments(product) {
        return (Array.isArray(product && product.servingOptions) ? product.servingOptions : []).some(function (option) {
            return getServingOptionPriceAdjustment(product, option) > 0;
        });
    }

    function getProductPriceRange(product) {
        var basePrice = safeNumber(product && product.price);
        var maxAdjustment = (Array.isArray(product && product.servingOptions) ? product.servingOptions : []).reduce(function (highest, option) {
            return Math.max(highest, getServingOptionPriceAdjustment(product, option));
        }, 0);

        return {
            min: basePrice,
            max: basePrice + maxAdjustment
        };
    }

    function formatServingSummary(product) {
        var config = getServingModeConfig(product && product.servingMode);
        var options = Array.isArray(product && product.servingOptions) ? product.servingOptions : [];
        return config.label + (options.length ? ": " + options.join(", ") : "");
    }

    function formatCustomizationGroupSummary(groups) {
        if (!Array.isArray(groups) || !groups.length) {
            return "No add-on groups";
        }

        return groups.map(function (group) {
            return group.title + " (" + group.options.length + ")";
        }).join(" | ");
    }

    function formatProductInfoSummary(product) {
        return "Prep " + product.prepTimeMinutes + " mins / Spice " + product.spiceLevel;
    }

    function formatAllergenSummary(product) {
        return product.allergens.length ? product.allergens.join(", ") : "None";
    }

    function normalizeCategoryName(category) {
        var safeCategory = String(category || DEFAULT_CATEGORIES[0]).replace(/\s+/g, " ").trim();
        var key = safeCategory.toLowerCase();
        var aliases = {
            burger: "Proteins",
            shake: "Alcohol",
            sandwitch: "Sandwich",
            sandwich: "Sandwich",
            "ice-creame": "Combo Meal",
            "ice cream": "Combo Meal",
            combo: "Combo Meal",
            "combo meal": "Combo Meal",
            "snacks & pastries": "Snacks and Pastries",
            "sides & extra": "Sides and Extra"
        };

        if (aliases[key]) {
            return aliases[key];
        }

        return safeCategory || DEFAULT_CATEGORIES[0];
    }

    function normalizeProduct(product) {
        var safeProduct = product || {};
        var name = String(safeProduct.name || "Untitled Product").trim();
        var category = normalizeCategoryName(safeProduct.category || DEFAULT_CATEGORIES[0]);
        var createdAt = safeProduct.createdAt || new Date().toISOString();
        var updatedAt = safeProduct.updatedAt || createdAt;
        var servingMode = normalizeServingMode(safeProduct.servingMode, category);
        var servingOptions = normalizeServingOptions(safeProduct.servingOptions, servingMode, category);
        var tags = normalizeTags(safeProduct.tags);
        var customizationGroups = normalizeCustomizationGroups(safeProduct.customizationGroups, category, name, tags, safeProduct.toppings);
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
            servingOptions: servingOptions,
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
        var safeStatus = String(status || "active").trim().toLowerCase();
        var allowed = ["active", "draft", "sold-out", "archived"];
        return allowed.indexOf(safeStatus) === -1 ? "active" : safeStatus;
    }

    function normalizeTags(tags) {
        if (Array.isArray(tags)) {
            return tags
                .map(function (tag) {
                    return String(tag).trim();
                })
                .filter(Boolean);
        }

        return String(tags || "")
            .split(",")
            .map(function (tag) {
                return tag.trim();
            })
            .filter(Boolean);
    }

    function normalizeMetadataList(values) {
        var seen = {};
        var list = Array.isArray(values) ? values : String(values || "").split(",");
        return list
            .map(function (value) {
                return String(value || "").replace(/\s+/g, " ").trim();
            })
            .filter(Boolean)
            .filter(function (value) {
                var key = value.toLowerCase();
                if (seen[key]) {
                    return false;
                }
                seen[key] = true;
                return true;
            });
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
            var separatorIndex;
            var title;
            var options;

            if (!safeLine) {
                return null;
            }

            separatorIndex = safeLine.indexOf(":");
            if (separatorIndex === -1) {
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

    function serializeCustomizationGroups(groups) {
        if (!Array.isArray(groups) || !groups.length) {
            return "";
        }

        return groups.map(function (group) {
            return group.title + ": " + group.options.map(function (option) {
                return option.label + (option.price > 0 ? "|" + String(option.price) : "");
            }).join(", ");
        }).join("\n");
    }

    function getSuggestedProductInfo(category, name, tags) {
        var safeCategory = String(category || "").trim().toLowerCase();
        var safeName = String(name || "").trim().toLowerCase();
        var safeTags = normalizeTags(tags).map(function (tag) {
            return String(tag || "").trim().toLowerCase();
        });
        var presets = {
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
        if (safeCategory === "alcohol" || safeName.indexOf("wine") !== -1 || safeName.indexOf("whiskey") !== -1 || safeName.indexOf("cocktail") !== -1 || safeCategory === "dessert") {
            suggested.spiceLevel = "Mild";
        }
        if ((safeName.indexOf("fish") !== -1 || safeName.indexOf("catfish") !== -1 || safeName.indexOf("seafood") !== -1) && suggested.allergens.indexOf("Fish") === -1) {
            suggested.allergens.push("Fish");
        }
        if ((safeName.indexOf("chicken") !== -1 || safeTags.indexOf("chicken") !== -1) && suggested.toppings.indexOf("Extra Chicken") === -1 && ["rice dishes", "burger", "sandwich", "proteins"].indexOf(safeCategory) !== -1) {
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
        var groups = (categoryGroups[safeCategory] || [
            { title: "Extras", options: ["Chef Recommendation", "Extra Sauce", "Boiled Egg"] },
            { title: "Drinks", options: ["Water", "Coke", "Fanta"] }
        ]).map(function (group, index) {
            var mergedOptions = normalizeMetadataList((index === 0 ? group.options.concat(summaryToppings) : group.options).concat(index === 0 ? info.toppings : []));
            return {
                id: slugify(group.title) || ("addon-group-" + index),
                title: group.title,
                selectionType: "multiple",
                options: mergedOptions.map(function (option) {
                    return {
                        label: option,
                        price: 0
                    };
                })
            };
        });

        return groups.filter(function (group) {
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
                if (String(group.title || "").toLowerCase().indexOf("topping") !== -1 || String(group.title || "").toLowerCase().indexOf("side") !== -1) {
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

    function parseJson(value, fallback) {
        try {
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            return fallback;
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
            throw new Error("Unable to load shared catalog.");
        }

        var payload = await response.json();
        var products = Array.isArray(payload) ? payload : payload.products;
        return Array.isArray(products) ? products : [];
    }

    async function fetchProductsFromJsonFile() {
        var response = await fetch(FALLBACK_PRODUCTS_URL, {
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Unable to load shared catalog fallback.");
        }

        var payload = await response.json();
        var products = Array.isArray(payload) ? payload : payload.products;
        return Array.isArray(products) ? products : [];
    }

    async function persistProducts() {
        if (state.catalogMode !== "server") {
            writeProductsToBrowserStorage(state.products);
            state.products = readProductsFromBrowserStorage().map(function (product) {
                return normalizeProduct(product);
            });
            return;
        }

        var response = await fetch(PRODUCTS_API_URL, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                products: state.products
            })
        });

        if (!response.ok) {
            throw new Error("Unable to save shared catalog.");
        }

        var payload = await response.json();
        var products = Array.isArray(payload.products) ? payload.products : state.products;
        state.products = products.map(function (product) {
            return normalizeProduct(product);
        });
    }

    function readProductsFromBrowserStorage() {
        var stored = parseJson(localStorage.getItem(STORAGE_KEYS.catalog), []);
        return Array.isArray(stored) ? stored : [];
    }

    function writeProductsToBrowserStorage(products) {
        localStorage.setItem(STORAGE_KEYS.catalog, JSON.stringify(products));
    }

    function maybeAnnounceCatalogMode() {
        if (state.catalogNoticeShown) {
            return;
        }

        state.catalogNoticeShown = true;
        if (state.catalogMode !== "server") {
            showToast("Static-host mode active. Catalog changes are saved in this browser for GitHub Pages testing.", "warning");
        }
    }

    async function runCatalogMutation(mutator) {
        var previousProducts = parseJson(JSON.stringify(state.products), []);
        var previousSelectedIds = new Set(Array.from(state.selectedIds));
        var previousEditingId = state.editingId;
        var previousCatalogMode = state.catalogMode;

        try {
            mutator();
            try {
                await persistProducts();
            } catch (error) {
                if (state.catalogMode === "server") {
                    console.warn("Shared catalog save failed. Switching to browser storage.", error);
                    state.catalogMode = "browser";
                    writeProductsToBrowserStorage(state.products);
                    state.products = readProductsFromBrowserStorage().map(function (product) {
                        return normalizeProduct(product);
                    });
                    showToast("Shared server unavailable. Changes were saved in this browser instead.", "warning");
                    maybeAnnounceCatalogMode();
                    return true;
                }
                throw error;
            }
            return true;
        } catch (error) {
            state.products = previousProducts.map(function (product) {
                return normalizeProduct(product);
            });
            state.selectedIds = new Set(Array.from(previousSelectedIds));
            state.editingId = previousEditingId;
            state.catalogMode = previousCatalogMode;
            throw error;
        }
    }

    function persistActivity() {
        localStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(state.activity.slice(0, MAX_ACTIVITY_ITEMS)));
    }

    function addActivity(message) {
        state.activity.unshift({
            id: createId(),
            message: message,
            timestamp: new Date().toISOString()
        });
        state.activity = state.activity.slice(0, MAX_ACTIVITY_ITEMS);
        persistActivity();
        renderActivity();
    }

    function populateCategoryInputs() {
        var currentCategory = getResolvedCategoryValue();
        var categories = getAllKnownCategories();
        dom.productCategory.innerHTML = [
            '<option value="">Select a category</option>',
            categories.map(function (category) {
                return '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + "</option>";
            }).join(""),
            '<option value="__new__">Add New Category</option>'
        ].join("");
        setCategoryValue(currentCategory || DEFAULT_CATEGORIES[0]);

        dom.catalogCategoryFilter.innerHTML = '<option value="all">All Categories</option>' + categories.map(function (category) {
            return '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + "</option>";
        }).join("");
    }

    function setCategoryValue(category) {
        var safeCategory = String(category || "").trim();
        var categories = getAllKnownCategories();

        if (safeCategory && categories.indexOf(safeCategory) !== -1) {
            dom.productCategory.value = safeCategory;
            dom.productCategoryCustom.value = "";
        } else if (safeCategory) {
            dom.productCategory.value = "__new__";
            dom.productCategoryCustom.value = safeCategory;
        } else {
            dom.productCategory.value = DEFAULT_CATEGORIES[0];
            dom.productCategoryCustom.value = "";
        }

        toggleCategoryCustomField();
    }

    function getResolvedCategoryValue() {
        if (!dom.productCategory) {
            return "";
        }

        if (dom.productCategory.value === "__new__") {
            return dom.productCategoryCustom.value.trim();
        }

        return dom.productCategory.value.trim();
    }

    function toggleCategoryCustomField() {
        var isNewCategory = dom.productCategory.value === "__new__";
        dom.productCategoryCustom.hidden = !isNewCategory;
        dom.productCategoryCustom.required = isNewCategory;

        if (isNewCategory) {
            dom.productCategoryCustom.focus();
        }
    }

    function getAllKnownCategories() {
        var categoryMap = {};
        DEFAULT_CATEGORIES.concat(state.products.map(function (product) {
            return product.category;
        })).forEach(function (category) {
            if (category) {
                categoryMap[category] = true;
            }
        });
        return Object.keys(categoryMap).sort(function (a, b) {
            return a.localeCompare(b);
        });
    }

    function renderSidebarCategories() {
        dom.sidebarCategoryChips.innerHTML = DEFAULT_CATEGORIES.map(function (category) {
            return '<span class="admin-chip">' + escapeHtml(category) + "</span>";
        }).join("");
    }

    function populateImagePresetOptions() {
        var currentImage = dom.productImageUrl.value.trim();

        dom.productImagePreset.innerHTML = [
            '<option value="">Custom Image Path or Upload</option>',
            IMAGE_PRESETS.map(function (preset) {
                return '<option value="' + escapeAttribute(preset.value) + '">' + escapeHtml(preset.label) + "</option>";
            }).join("")
        ].join("");

        syncImagePresetSelection(currentImage);
    }

    function applySelectedImagePreset() {
        var selectedImage = dom.productImagePreset.value;
        if (!selectedImage) {
            return;
        }

        var matchingPreset = IMAGE_PRESETS.find(function (preset) {
            return preset.value === selectedImage;
        });

        dom.productImageUrl.value = selectedImage;
        if (!dom.productImageAlt.value.trim() && matchingPreset) {
            dom.productImageAlt.value = matchingPreset.label;
        }
        renderImagePreview(selectedImage);
    }

    function syncImagePresetSelection(imageSource) {
        var safeImageSource = String(imageSource || "").trim();
        var matchingPreset = IMAGE_PRESETS.find(function (preset) {
            return preset.value === safeImageSource;
        });

        dom.productImagePreset.value = matchingPreset ? matchingPreset.value : "";
    }

    function populateServingModeOptions() {
        dom.productServingMode.innerHTML = SERVING_MODE_OPTIONS.map(function (option) {
            return '<option value="' + escapeAttribute(option.value) + '">' + escapeHtml(option.label) + "</option>";
        }).join("");
        applyServingModePreset(true);
    }

    function applyServingModePreset(preserveExisting) {
        var config = getServingModeConfig(dom.productServingMode.value);
        if (!config) {
            return;
        }

        dom.productServingHelper.textContent = config.helper;
        dom.productServingOptions.placeholder = config.options.length ? config.options.join(", ") : "Type custom options separated by commas";

        if (!preserveExisting || !dom.productServingOptions.value.trim()) {
            dom.productServingOptions.value = config.options.join(", ");
        }
        syncServingOptionPriceInput(preserveExisting);
    }

    function syncServingOptionPriceInput(preserveExisting) {
        var nextOptions = normalizeServingOptions(dom.productServingOptions.value, dom.productServingMode.value, getResolvedCategoryValue());
        var normalizedPrices = normalizeServingOptionPrices(dom.productServingPrices.value, nextOptions);

        dom.productServingPrices.placeholder = nextOptions.length ? serializeServingOptionPrices({}, nextOptions) : "Option:0, Option:0";

        if (!preserveExisting || !dom.productServingPrices.value.trim()) {
            dom.productServingPrices.value = serializeServingOptionPrices(normalizedPrices, nextOptions);
            return;
        }

        dom.productServingPrices.value = serializeServingOptionPrices(normalizedPrices, nextOptions);
    }

    function applyProductInfoPreset(preserveExisting) {
        var preset = getSuggestedProductInfo(getResolvedCategoryValue(), dom.productName.value, dom.productTags.value);
        var customizationPreset = getSuggestedCustomizationGroups(getResolvedCategoryValue(), dom.productName.value, dom.productTags.value, dom.productToppings.value);

        if (!preserveExisting || !dom.productToppings.value.trim()) {
            dom.productToppings.value = preset.toppings.join(", ");
        }
        if (!preserveExisting || !dom.productAllergens.value.trim()) {
            dom.productAllergens.value = preset.allergens.join(", ");
        }
        if (!preserveExisting || !dom.productSpiceLevel.value) {
            dom.productSpiceLevel.value = preset.spiceLevel;
        }
        if (!preserveExisting || !String(dom.productPrepTime.value || "").trim()) {
            dom.productPrepTime.value = String(preset.prepTimeMinutes);
        }
        if (!preserveExisting || !dom.productCustomizationGroups.value.trim()) {
            dom.productCustomizationGroups.value = serializeCustomizationGroups(customizationPreset);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();

        var formData = collectFormData();
        if (!formData) {
            return;
        }

        try {
            var existingProduct = state.products.find(function (product) {
                return product.id === formData.id;
            });

            if (existingProduct) {
                formData.createdAt = existingProduct.createdAt;
                formData.updatedAt = new Date().toISOString();
                await runCatalogMutation(function () {
                    state.products = state.products.map(function (product) {
                        return product.id === formData.id ? formData : product;
                    });
                });
                addActivity('Updated "' + formData.name + '".');
                showToast('Updated "' + formData.name + '".', "success");
            } else {
                formData.id = createId();
                formData.createdAt = new Date().toISOString();
                formData.updatedAt = formData.createdAt;
                await runCatalogMutation(function () {
                    state.products.unshift(formData);
                });
                addActivity('Added "' + formData.name + '".');
                showToast('Added "' + formData.name + '".', "success");
            }

            clearDraft();
            populateCategoryInputs();
            renderAll();
            resetForm();
        } catch (error) {
            console.error(error);
            showToast("Product changes could not be saved to the shared catalog.", "error");
        }
    }

    function collectFormData() {
        var name = dom.productName.value.trim();
        var category = getResolvedCategoryValue();
        var price = safeNumber(dom.productPrice.value);
        var comparePrice = safeNumber(dom.productComparePrice.value);
        var stock = Math.max(0, Math.round(safeNumber(dom.productStock.value)));
        var status = normalizeStatus(dom.productStatus.value);
        var servingMode = dom.productServingMode.value;
        var servingOptions = dom.productServingOptions.value.trim();
        var servingOptionPrices = dom.productServingPrices.value.trim();
        var sku = dom.productSku.value.trim() || buildSuggestedSku(name, category);
        var toppings = dom.productToppings.value.trim();
        var allergens = dom.productAllergens.value.trim();
        var spiceLevel = dom.productSpiceLevel.value;
        var prepTimeMinutes = dom.productPrepTime.value;
        var customizationGroups = dom.productCustomizationGroups.value.trim();
        var description = dom.productDescription.value.trim();
        var image = dom.productImageUrl.value.trim();
        var alt = dom.productImageAlt.value.trim() || name;
        var tags = normalizeTags(dom.productTags.value);

        if (!name) {
            showToast("Product name is required.", "warning");
            dom.productName.focus();
            return null;
        }

        if (!category) {
            showToast("Category is required.", "warning");
            if (dom.productCategory.value === "__new__") {
                dom.productCategoryCustom.focus();
            } else {
                dom.productCategory.focus();
            }
            return null;
        }

        if (!price && price !== 0) {
            showToast("Price is required.", "warning");
            dom.productPrice.focus();
            return null;
        }

        if (!image) {
            showToast("Please provide an image path or upload an image.", "warning");
            dom.productImageUrl.focus();
            return null;
        }

        return normalizeProduct({
            id: dom.productId.value || createId(),
            name: name,
            category: category,
            price: price,
            comparePrice: comparePrice,
            stock: stock,
            sku: sku,
            status: status,
            featured: dom.productFeatured.checked,
            description: description,
            servingMode: servingMode,
            servingOptions: servingOptions,
            servingOptionPrices: servingOptionPrices,
            toppings: toppings,
            allergens: allergens,
            spiceLevel: spiceLevel,
            prepTimeMinutes: prepTimeMinutes,
            customizationGroups: customizationGroups,
            image: image,
            alt: alt,
            tags: tags
        });
    }

    function renderAll() {
        renderStats();
        renderProductViews();
        renderCategoryBreakdown();
        renderActivity();
        renderStorageUsage();
        renderSelectionSummary();
    }

    function renderStats() {
        var categories = {};
        var totalStock = 0;
        var featuredCount = 0;
        var lowStockCount = 0;

        state.products.forEach(function (product) {
            categories[product.category] = true;
            totalStock += product.stock;
            featuredCount += product.featured ? 1 : 0;
            lowStockCount += product.stock <= LOW_STOCK_THRESHOLD ? 1 : 0;
        });

        dom.statProducts.textContent = String(state.products.length);
        dom.statFeatured.textContent = String(featuredCount);
        dom.statLowStock.textContent = String(lowStockCount);
        dom.statCategories.textContent = String(Object.keys(categories).length);
        dom.statStock.textContent = String(totalStock);
    }

    function renderProductViews() {
        var visibleProducts = getFilteredProducts();

        dom.productsTableBody.innerHTML = visibleProducts.map(function (product) {
            return buildTableRow(product);
        }).join("");

        dom.productsCardList.innerHTML = visibleProducts.map(function (product) {
            return buildProductCard(product);
        }).join("");

        dom.productsEmptyState.hidden = visibleProducts.length !== 0;
        dom.selectAllProducts.checked = visibleProducts.length > 0 && visibleProducts.every(function (product) {
            return state.selectedIds.has(product.id);
        });
        renderSelectionSummary();
    }

    function getFilteredProducts() {
        var searchTerm = dom.catalogSearch.value.trim().toLowerCase();
        var categoryFilter = dom.catalogCategoryFilter.value;
        var statusFilter = dom.catalogStatusFilter.value;
        var sortMode = dom.catalogSort.value;

        var filtered = state.products.filter(function (product) {
            var haystack = [
                product.name,
                product.category,
                product.sku,
                product.description,
                formatServingSummary(product),
                formatProductInfoSummary(product),
                formatAllergenSummary(product),
                product.tags.join(" "),
                product.toppings.join(" "),
                product.allergens.join(" "),
                formatCustomizationGroupSummary(product.customizationGroups)
            ].join(" ").toLowerCase();

            var matchesSearch = !searchTerm || haystack.indexOf(searchTerm) !== -1;
            var matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
            var matchesStatus = statusFilter === "all" || product.status === statusFilter;
            return matchesSearch && matchesCategory && matchesStatus;
        });

        filtered.sort(function (a, b) {
            if (sortMode === "name-asc") {
                return a.name.localeCompare(b.name);
            }

            if (sortMode === "price-desc") {
                return b.price - a.price;
            }

            if (sortMode === "price-asc") {
                return a.price - b.price;
            }

            if (sortMode === "stock-asc") {
                return a.stock - b.stock;
            }

            if (sortMode === "featured-first") {
                if (a.featured === b.featured) {
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                }
                return a.featured ? -1 : 1;
            }

            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        return filtered;
    }

    function buildTableRow(product) {
        var isSelected = state.selectedIds.has(product.id);
        return [
            '<tr data-product-id="', escapeHtml(product.id), '">',
            '<td><input class="product-select" type="checkbox" data-product-id="', escapeHtml(product.id), '" ', isSelected ? "checked" : "", ' aria-label="Select ', escapeHtml(product.name), '"></td>',
            '<td>',
            '<div class="admin-row-title">',
            '<div class="admin-row-thumb"><img src="', escapeAttribute(product.image || "assets/images/product-1.png"), '" alt="', escapeAttribute(product.alt || product.name), '"></div>',
            '<div>',
            '<div class="admin-row-name">', escapeHtml(product.name), "</div>",
            '<div class="admin-row-meta">', escapeHtml(product.category), " / ", escapeHtml(product.sku), "</div>",
            '<div class="admin-row-meta">Sold as: ', escapeHtml(formatServingSummary(product)), "</div>",
            '<div class="admin-row-meta">', escapeHtml(formatProductInfoSummary(product)), " / Allergens: ", escapeHtml(formatAllergenSummary(product)), "</div>",
            '<div class="admin-row-meta">Checkbox groups: ', escapeHtml(formatCustomizationGroupSummary(product.customizationGroups)), "</div>",
            '<div class="admin-chip-list mt-2">', renderTagBadges(product.tags), renderFoodInfoBadges(product), "</div>",
            "</div>",
            "</div>",
            "</td>",
            "<td>",
            buildPriceMarkup(product),
            "</td>",
            "<td>",
            '<span class="admin-badge ', product.stock <= LOW_STOCK_THRESHOLD ? "admin-badge-warning" : "admin-badge-success", '">', escapeHtml(String(product.stock)), " units</span>",
            "</td>",
            "<td>",
            '<span class="admin-badge ', getStatusBadgeClass(product.status), '">', escapeHtml(labelizeStatus(product.status)), "</span>",
            product.featured ? ' <span class="admin-badge admin-badge-primary mt-2 mt-md-0">Featured</span>' : "",
            "</td>",
            '<td class="admin-label-muted">', escapeHtml(formatDateTime(product.updatedAt)), "</td>",
            "<td>",
            '<div class="admin-table-actions">',
            '<button class="btn btn-sm btn-outline-light" type="button" data-action="edit" data-product-id="', escapeHtml(product.id), '">Edit</button>',
            '<button class="btn btn-sm btn-outline-light" type="button" data-action="duplicate" data-product-id="', escapeHtml(product.id), '">Duplicate</button>',
            '<button class="btn btn-sm btn-outline-warning" type="button" data-action="toggle-featured" data-product-id="', escapeHtml(product.id), '">', product.featured ? "Unfeature" : "Feature", "</button>",
            '<button class="btn btn-sm btn-outline-danger" type="button" data-action="delete" data-product-id="', escapeHtml(product.id), '">Delete</button>',
            "</div>",
            "</td>",
            "</tr>"
        ].join("");
    }

    function buildProductCard(product) {
        var isSelected = state.selectedIds.has(product.id);
        return [
            '<div class="admin-product-card" data-product-id="', escapeHtml(product.id), '">',
            '<div class="admin-product-card-head">',
            '<input class="product-select" type="checkbox" data-product-id="', escapeHtml(product.id), '" ', isSelected ? "checked" : "", ' aria-label="Select ', escapeHtml(product.name), '">',
            '<div class="admin-row-thumb"><img src="', escapeAttribute(product.image || "assets/images/product-1.png"), '" alt="', escapeAttribute(product.alt || product.name), '"></div>',
            '<div class="admin-product-card-copy">',
            "<h4>", escapeHtml(product.name), "</h4>",
            '<p class="admin-row-meta mb-0">', escapeHtml(product.category), " / ", escapeHtml(product.sku), "</p>",
            '<p class="admin-row-meta mb-0">Sold as: ', escapeHtml(formatServingSummary(product)), "</p>",
            '<p class="admin-row-meta mb-0">', escapeHtml(formatProductInfoSummary(product)), "</p>",
            '<p class="admin-row-meta mb-0">Checkbox groups: ', escapeHtml(formatCustomizationGroupSummary(product.customizationGroups)), "</p>",
            "</div>",
            "</div>",
            '<div class="admin-preview-meta mb-2">',
            '<span class="admin-badge ', getStatusBadgeClass(product.status), '">', escapeHtml(labelizeStatus(product.status)), "</span>",
            product.featured ? '<span class="admin-badge admin-badge-primary">Featured</span>' : "",
            '<span class="admin-badge ', product.stock <= LOW_STOCK_THRESHOLD ? "admin-badge-warning" : "admin-badge-success", '">', escapeHtml(String(product.stock)), " in stock</span>",
            "</div>",
            '<div class="mb-2">', buildPriceMarkup(product), "</div>",
            '<p class="admin-row-meta">', escapeHtml(product.description || "No description provided."), "</p>",
            '<p class="admin-row-meta">Allergens: ', escapeHtml(formatAllergenSummary(product)), "</p>",
            '<p class="admin-row-meta">Toppings: ', escapeHtml(product.toppings.join(", ")), "</p>",
            '<p class="admin-row-meta">Checkbox groups: ', escapeHtml(formatCustomizationGroupSummary(product.customizationGroups)), "</p>",
            '<div class="admin-chip-list mb-3">', renderTagBadges(product.tags), renderFoodInfoBadges(product), "</div>",
            '<div class="admin-table-actions">',
            '<button class="btn btn-sm btn-outline-light" type="button" data-action="edit" data-product-id="', escapeHtml(product.id), '">Edit</button>',
            '<button class="btn btn-sm btn-outline-light" type="button" data-action="duplicate" data-product-id="', escapeHtml(product.id), '">Duplicate</button>',
            '<button class="btn btn-sm btn-outline-warning" type="button" data-action="toggle-featured" data-product-id="', escapeHtml(product.id), '">', product.featured ? "Unfeature" : "Feature", "</button>",
            '<button class="btn btn-sm btn-outline-danger" type="button" data-action="delete" data-product-id="', escapeHtml(product.id), '">Delete</button>',
            "</div>",
            "</div>"
        ].join("");
    }

    function buildPriceMarkup(product) {
        var range = getProductPriceRange(product);
        var hasAdjustments = hasServingOptionPriceAdjustments(product);
        var currentText = hasAdjustments ? (formatCurrency(range.min) + " - " + formatCurrency(range.max)) : formatCurrency(product.price);
        var compareText = "";

        if (product.comparePrice > 0) {
            compareText = hasAdjustments
                ? formatCurrency(product.comparePrice) + " - " + formatCurrency(product.comparePrice + (range.max - range.min))
                : formatCurrency(product.comparePrice);
        }

        var current = '<strong>' + escapeHtml(currentText) + "</strong>";
        var compare = compareText ? ' <span class="admin-label-muted"><del>' + escapeHtml(compareText) + "</del></span>" : "";
        return current + compare;
    }

    function renderTagBadges(tags) {
        if (!tags.length) {
            return '<span class="admin-badge">No tags</span>';
        }

        return tags.slice(0, 3).map(function (tag) {
            return '<span class="admin-badge">' + escapeHtml(tag) + "</span>";
        }).join("");
    }

    function renderFoodInfoBadges(product) {
        return [
            '<span class="admin-badge">', escapeHtml(product.spiceLevel), "</span>",
            '<span class="admin-badge">Prep ', escapeHtml(String(product.prepTimeMinutes)), " mins</span>",
            '<span class="admin-badge">', escapeHtml(String(product.toppings.length)), " toppings</span>"
        ].join("");
    }

    async function handleProductActionClick(event) {
        var actionButton = event.target.closest("[data-action]");
        if (!actionButton) {
            return;
        }

        var action = actionButton.getAttribute("data-action");
        var productId = actionButton.getAttribute("data-product-id");
        var product = state.products.find(function (item) {
            return item.id === productId;
        });

        if (!product) {
            return;
        }

        if (action === "edit") {
            loadProductIntoForm(product);
            return;
        }

        if (action === "duplicate") {
            await duplicateProduct(product);
            return;
        }

        if (action === "toggle-featured") {
            try {
                await runCatalogMutation(function () {
                    product.featured = !product.featured;
                    product.updatedAt = new Date().toISOString();
                });
                addActivity((product.featured ? "Featured " : "Removed featured flag from ") + '"' + product.name + '".');
                renderAll();
                showToast('Updated "' + product.name + '".', "success");
            } catch (error) {
                console.error(error);
                showToast("Featured status could not be updated.", "error");
            }
            return;
        }

        if (action === "delete") {
            await deleteProduct(product);
        }
    }

    function handleSelectionToggle(event) {
        var checkbox = event.target.closest(".product-select");
        if (!checkbox) {
            return;
        }

        var productId = checkbox.getAttribute("data-product-id");
        if (checkbox.checked) {
            state.selectedIds.add(productId);
        } else {
            state.selectedIds.delete(productId);
        }
        renderSelectionSummary();
    }

    function toggleSelectAllVisibleProducts() {
        var visibleProductIds = getFilteredProducts().map(function (product) {
            return product.id;
        });

        if (dom.selectAllProducts.checked) {
            visibleProductIds.forEach(function (productId) {
                state.selectedIds.add(productId);
            });
        } else {
            visibleProductIds.forEach(function (productId) {
                state.selectedIds.delete(productId);
            });
        }

        renderProductViews();
    }

    function renderSelectionSummary() {
        var selectedCount = state.selectedIds.size;
        dom.selectionSummary.textContent = selectedCount ? selectedCount + " product(s) selected for bulk actions." : "No products selected.";
        dom.bulkFeatureBtn.disabled = !selectedCount;
        dom.bulkActivateBtn.disabled = !selectedCount;
        dom.bulkArchiveBtn.disabled = !selectedCount;
        dom.bulkDeleteBtn.disabled = !selectedCount;
    }

    async function updateSelectedProducts(mutator, successMessage) {
        if (!state.selectedIds.size) {
            showToast("Select at least one product first.", "warning");
            return;
        }

        try {
            await runCatalogMutation(function () {
                state.products = state.products.map(function (product) {
                    if (state.selectedIds.has(product.id)) {
                        mutator(product);
                        product.updatedAt = new Date().toISOString();
                    }
                    return normalizeProduct(product);
                });
            });
            addActivity(successMessage);
            renderAll();
            showToast(successMessage, "success");
        } catch (error) {
            console.error(error);
            showToast("Bulk changes could not be saved.", "error");
        }
    }

    async function bulkDeleteProducts() {
        if (!state.selectedIds.size) {
            showToast("Select products to delete first.", "warning");
            return;
        }

        if (!window.confirm("Delete the selected products from the shared catalog?")) {
            return;
        }

        try {
            await runCatalogMutation(function () {
                state.products = state.products.filter(function (product) {
                    return !state.selectedIds.has(product.id);
                });
                state.selectedIds.clear();
            });
            addActivity("Deleted selected products.");
            renderAll();
            showToast("Selected products deleted.", "success");
        } catch (error) {
            console.error(error);
            showToast("Selected products could not be deleted.", "error");
        }
    }

    function loadProductIntoForm(product) {
        state.editingId = product.id;
        dom.productId.value = product.id;
        dom.productName.value = product.name;
        setCategoryValue(product.category);
        dom.productPrice.value = product.price;
        dom.productComparePrice.value = product.comparePrice || "";
        dom.productStock.value = product.stock;
        dom.productStatus.value = product.status;
        dom.productServingMode.value = product.servingMode;
        dom.productServingOptions.value = product.servingOptions.join(", ");
        applyServingModePreset(true);
        dom.productServingPrices.value = serializeServingOptionPrices(product.servingOptionPrices, product.servingOptions);
        dom.productSku.value = product.sku;
        dom.productSku.dataset.userTouched = product.sku ? "true" : "";
        dom.productTags.value = product.tags.join(", ");
        dom.productToppings.value = product.toppings.join(", ");
        dom.productAllergens.value = product.allergens.join(", ");
        dom.productSpiceLevel.value = product.spiceLevel;
        dom.productPrepTime.value = product.prepTimeMinutes;
        dom.productCustomizationGroups.value = serializeCustomizationGroups(product.customizationGroups);
        dom.productDescription.value = product.description;
        dom.productImageUrl.value = product.image;
        dom.productImageAlt.value = product.alt;
        dom.productImageFile.value = "";
        dom.productFeatured.checked = product.featured;
        renderImagePreview(product.image);
        renderPreviewFromForm();
        dom.formModeBadge.textContent = "Editing Product";
        dom.formModeBadge.className = "admin-badge admin-badge-warning";
        dom.productName.focus();
        dom.form.scrollIntoView({ behavior: "smooth", block: "start" });
        saveDraftFromForm();
    }

    async function duplicateProduct(product) {
        var copy = normalizeProduct({
            id: createId(),
            name: product.name + " Copy",
            category: product.category,
            price: product.price,
            comparePrice: product.comparePrice,
            stock: product.stock,
            sku: product.sku + "-COPY",
            status: "draft",
            featured: false,
            description: product.description,
            servingMode: product.servingMode,
            servingOptions: product.servingOptions,
            servingOptionPrices: product.servingOptionPrices,
            toppings: product.toppings,
            allergens: product.allergens,
            spiceLevel: product.spiceLevel,
            prepTimeMinutes: product.prepTimeMinutes,
            customizationGroups: product.customizationGroups,
            image: product.image,
            alt: product.alt,
            tags: product.tags
        });
        copy.createdAt = new Date().toISOString();
        copy.updatedAt = copy.createdAt;
        try {
            await runCatalogMutation(function () {
                state.products.unshift(copy);
            });
            addActivity('Duplicated "' + product.name + '" as "' + copy.name + '".');
            populateCategoryInputs();
            renderAll();
            showToast('Duplicated "' + product.name + '".', "success");
        } catch (error) {
            console.error(error);
            showToast("Product could not be duplicated.", "error");
        }
    }

    async function deleteProduct(product) {
        if (!window.confirm('Delete "' + product.name + '" from the catalog?')) {
            return;
        }

        try {
            var shouldResetForm = state.editingId === product.id;
            await runCatalogMutation(function () {
                state.products = state.products.filter(function (item) {
                    return item.id !== product.id;
                });
                state.selectedIds.delete(product.id);
                if (state.editingId === product.id) {
                    state.editingId = null;
                }
            });
            if (shouldResetForm) {
                resetForm();
            }
            addActivity('Deleted "' + product.name + '".');
            renderAll();
            showToast('Deleted "' + product.name + '".', "success");
        } catch (error) {
            console.error(error);
            showToast("Product could not be deleted.", "error");
        }
    }

    function exportProducts() {
        var json = JSON.stringify(state.products, null, 2);
        var blob = new Blob([json], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "foodweb-products-backup.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addActivity("Exported product catalog.");
        showToast("Catalog exported as JSON.", "success");
    }

    function handleImportProducts(event) {
        var file = event.target.files[0];
        if (!file) {
            return;
        }

        var reader = new FileReader();
        reader.onload = async function () {
            try {
                var imported = JSON.parse(reader.result);
                if (!Array.isArray(imported)) {
                    throw new Error("Invalid file format.");
                }

                var normalized = imported.map(normalizeProduct);
                if (dom.importMode.value === "replace") {
                    if (!window.confirm("Replace the current catalog with the imported file?")) {
                        dom.importFileInput.value = "";
                        return;
                    }
                    await runCatalogMutation(function () {
                        state.products = normalized;
                        state.selectedIds.clear();
                        state.editingId = null;
                    });
                } else {
                    await runCatalogMutation(function () {
                        var productMap = {};
                        state.products.forEach(function (product) {
                            productMap[product.id] = product;
                        });
                        normalized.forEach(function (product) {
                            productMap[product.id] = product;
                        });
                        state.products = Object.keys(productMap).map(function (key) {
                            return productMap[key];
                        });
                    });
                }

                populateCategoryInputs();
                renderAll();
                addActivity("Imported product catalog.");
                showToast("Catalog imported successfully.", "success");
            } catch (error) {
                console.error(error);
                showToast("Import failed. Please use a valid JSON product backup.", "error");
            } finally {
                dom.importFileInput.value = "";
            }
        };
        reader.readAsText(file);
    }

    async function clearAllProducts() {
        if (!window.confirm("Delete every product from the shared catalog?")) {
            return;
        }

        try {
            await runCatalogMutation(function () {
                state.products = [];
                state.selectedIds.clear();
                state.editingId = null;
            });
            addActivity("Cleared all products.");
            renderAll();
            resetForm();
            showToast("All products removed.", "success");
        } catch (error) {
            console.error(error);
            showToast("Catalog could not be cleared.", "error");
        }
    }

    async function handleResetStarterCatalog() {
        if (!window.confirm("Replace the current catalog with the starter catalog?")) {
            return;
        }

        try {
            await runCatalogMutation(function () {
                state.products = getStarterProducts();
                state.selectedIds.clear();
                state.editingId = null;
            });
            addActivity("Reset catalog to starter products.");
            populateCategoryInputs();
            renderAll();
            resetForm();
            showToast("Starter catalog restored.", "success");
        } catch (error) {
            console.error(error);
            showToast("Starter catalog could not be restored.", "error");
        }
    }

    function handleImageUpload(event) {
        var file = event.target.files[0];
        if (!file) {
            return;
        }

        if (!file.type.match(/^image\//)) {
            showToast("Please upload a valid image file.", "warning");
            event.target.value = "";
            return;
        }

        var reader = new FileReader();
        reader.onload = function () {
            var image = new Image();
            image.onload = function () {
                try {
                    var resizedDataUrl = resizeImage(image);
                    dom.productImageUrl.value = resizedDataUrl;
                    if (!dom.productImageAlt.value.trim()) {
                        dom.productImageAlt.value = dom.productName.value.trim() || file.name.replace(/\.[^.]+$/, "");
                    }
                    renderImagePreview(resizedDataUrl);
                    saveDraftFromForm();
                    renderPreviewFromForm();
                    showToast("Image uploaded and prepared for the shared catalog.", "success");
                } catch (error) {
                    showToast("The image could not be prepared for storage.", "error");
                }
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    }

    function resizeImage(image) {
        var maxSize = 960;
        var width = image.width;
        var height = image.height;
        var scale = Math.min(1, maxSize / Math.max(width, height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        var context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.82);
    }

    function saveDraftFromForm() {
        var draft = {
            id: dom.productId.value,
            name: dom.productName.value,
            category: getResolvedCategoryValue(),
            price: dom.productPrice.value,
            comparePrice: dom.productComparePrice.value,
            stock: dom.productStock.value,
            status: dom.productStatus.value,
            servingMode: dom.productServingMode.value,
            servingOptions: dom.productServingOptions.value,
            servingOptionPrices: dom.productServingPrices.value,
            sku: dom.productSku.value,
            tags: dom.productTags.value,
            toppings: dom.productToppings.value,
            allergens: dom.productAllergens.value,
            spiceLevel: dom.productSpiceLevel.value,
            prepTimeMinutes: dom.productPrepTime.value,
            customizationGroups: dom.productCustomizationGroups.value,
            description: dom.productDescription.value,
            image: dom.productImageUrl.value,
            alt: dom.productImageAlt.value,
            featured: dom.productFeatured.checked
        };
        try {
            localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
            dom.draftIndicator.textContent = "Draft saved automatically";
        } catch (error) {
            dom.draftIndicator.textContent = "Draft could not be saved";
            showToast("Draft could not be saved in this browser.", "warning");
        }
    }

    function restoreDraft() {
        var rawDraft = localStorage.getItem(STORAGE_KEYS.draft);
        if (!rawDraft) {
            dom.draftIndicator.textContent = "No unsaved draft";
            return false;
        }

        var draft = parseJson(rawDraft, null);
        if (!draft) {
            dom.draftIndicator.textContent = "No unsaved draft";
            return false;
        }

        dom.productId.value = draft.id || "";
        dom.productName.value = draft.name || "";
        setCategoryValue(draft.category || DEFAULT_CATEGORIES[0]);
        dom.productPrice.value = draft.price || "";
        dom.productComparePrice.value = draft.comparePrice || "";
        dom.productStock.value = draft.stock || "";
        dom.productStatus.value = draft.status || "active";
        dom.productServingMode.value = draft.servingMode || inferServingMode(getResolvedCategoryValue());
        dom.productServingOptions.value = draft.servingOptions || "";
        applyServingModePreset(true);
        dom.productServingPrices.value = draft.servingOptionPrices || "";
        dom.productSku.value = draft.sku || "";
        dom.productSku.dataset.userTouched = draft.sku ? "true" : "";
        dom.productTags.value = draft.tags || "";
        dom.productToppings.value = draft.toppings || "";
        dom.productAllergens.value = draft.allergens || "";
        dom.productSpiceLevel.value = draft.spiceLevel || "";
        dom.productPrepTime.value = draft.prepTimeMinutes || "";
        dom.productCustomizationGroups.value = draft.customizationGroups || "";
        applyProductInfoPreset(true);
        dom.productDescription.value = draft.description || "";
        dom.productImageUrl.value = draft.image || "";
        dom.productImageAlt.value = draft.alt || "";
        dom.productFeatured.checked = Boolean(draft.featured);
        renderImagePreview(dom.productImageUrl.value);
        state.editingId = draft.id || null;
        if (state.editingId) {
            dom.formModeBadge.textContent = "Editing Draft";
            dom.formModeBadge.className = "admin-badge admin-badge-warning";
        }
        dom.draftIndicator.textContent = "Unsaved draft restored";
        state.draftLoaded = true;
        return true;
    }

    function applyDefaultFormState() {
        setCategoryValue(DEFAULT_CATEGORIES[0]);
        dom.productStatus.value = "active";
        dom.productServingMode.value = inferServingMode(getResolvedCategoryValue());
        dom.productServingOptions.value = "";
        applyServingModePreset();
        dom.productServingPrices.value = "";
        dom.productToppings.value = "";
        dom.productAllergens.value = "";
        dom.productSpiceLevel.value = "";
        dom.productPrepTime.value = "";
        dom.productCustomizationGroups.value = "";
        applyProductInfoPreset();
        dom.productFeatured.checked = false;
        dom.productSku.value = "";
        dom.productSku.dataset.userTouched = "";
        renderImagePreview("");
    }

    function clearDraft() {
        localStorage.removeItem(STORAGE_KEYS.draft);
        dom.draftIndicator.textContent = "No unsaved draft";
    }

    function resetForm() {
        dom.form.reset();
        dom.productId.value = "";
        dom.productStatus.value = "active";
        dom.productSku.dataset.userTouched = "";
        setCategoryValue(DEFAULT_CATEGORIES[0]);
        dom.productServingMode.value = inferServingMode(getResolvedCategoryValue());
        dom.productServingOptions.value = "";
        applyServingModePreset();
        dom.productServingPrices.value = "";
        dom.productToppings.value = "";
        dom.productAllergens.value = "";
        dom.productSpiceLevel.value = "";
        dom.productPrepTime.value = "";
        dom.productCustomizationGroups.value = "";
        applyProductInfoPreset();
        state.editingId = null;
        dom.formModeBadge.textContent = "Adding New";
        dom.formModeBadge.className = "admin-badge admin-badge-primary";
        renderImagePreview("");
        clearDraft();
        renderPreviewFromForm();
    }

    function renderImagePreview(imageSource) {
        if (imageSource) {
            dom.imagePreview.src = imageSource;
            dom.imagePreview.hidden = false;
            dom.imagePlaceholder.hidden = true;
        } else {
            dom.imagePreview.src = "";
            dom.imagePreview.hidden = true;
            dom.imagePlaceholder.hidden = false;
        }
    }

    function renderPreviewFromForm() {
        var name = dom.productName.value.trim() || "New Product";
        var category = getResolvedCategoryValue() || "Category";
        var previewProduct = normalizeProduct({
            id: dom.productId.value || createId(),
            name: name,
            category: category,
            price: dom.productPrice.value,
            comparePrice: dom.productComparePrice.value,
            stock: dom.productStock.value,
            sku: dom.productSku.value.trim() || buildSuggestedSku(name, category),
            status: dom.productStatus.value,
            featured: dom.productFeatured.checked,
            description: dom.productDescription.value.trim() || "Your product description will appear here as you type.",
            servingMode: dom.productServingMode.value || inferServingMode(category),
            servingOptions: dom.productServingOptions.value,
            servingOptionPrices: dom.productServingPrices.value,
            toppings: dom.productToppings.value,
            allergens: dom.productAllergens.value,
            spiceLevel: dom.productSpiceLevel.value,
            prepTimeMinutes: dom.productPrepTime.value,
            customizationGroups: dom.productCustomizationGroups.value,
            image: dom.productImageUrl.value.trim() || "assets/images/product-1.png",
            alt: dom.productImageAlt.value.trim() || name,
            tags: dom.productTags.value
        });

        dom.previewName.textContent = previewProduct.name;
        dom.previewCategory.textContent = previewProduct.category;
        dom.previewStatus.textContent = labelizeStatus(previewProduct.status);
        dom.previewSku.textContent = "SKU: " + previewProduct.sku;
        dom.previewServing.textContent = "Sold as: " + formatServingSummary(previewProduct);
        dom.previewExtra.textContent = "Prep: " + previewProduct.prepTimeMinutes + " mins / Spice: " + previewProduct.spiceLevel + " / Allergens: " + formatAllergenSummary(previewProduct);
        dom.previewDescription.textContent = previewProduct.description || "Your product description will appear here as you type.";
        dom.previewToppings.textContent = "Toppings: " + (previewProduct.toppings.length ? previewProduct.toppings.join(", ") : "No toppings added yet.");
        dom.previewCustomizations.textContent = "Checkbox groups: " + formatCustomizationGroupSummary(previewProduct.customizationGroups);
        dom.previewCardImage.src = previewProduct.image || "assets/images/product-1.png";
        dom.previewCardImage.alt = previewProduct.alt || previewProduct.name;
        dom.previewFeatured.hidden = !previewProduct.featured;

        dom.previewPrice.innerHTML = buildPriceMarkup(previewProduct);
    }

    function renderCategoryBreakdown() {
        if (!state.products.length) {
            dom.categoryBreakdownList.innerHTML = '<div class="admin-empty"><p>No products available yet.</p></div>';
            return;
        }

        var counts = {};
        state.products.forEach(function (product) {
            counts[product.category] = (counts[product.category] || 0) + 1;
        });

        var highestCount = Math.max.apply(null, Object.keys(counts).map(function (category) {
            return counts[category];
        }));

        var markup = Object.keys(counts)
            .sort(function (a, b) {
                return counts[b] - counts[a];
            })
            .map(function (category) {
                var width = Math.round((counts[category] / highestCount) * 100);
                return [
                    '<div class="admin-breakdown-item">',
                    '<div class="d-flex justify-content-between gap-3">',
                    "<strong>", escapeHtml(category), "</strong>",
                    '<span class="admin-label-muted">', escapeHtml(String(counts[category])), " items</span>",
                    "</div>",
                    '<div class="admin-breakdown-track"><div class="admin-breakdown-fill" style="width:', String(width), '%"></div></div>',
                    "</div>"
                ].join("");
            })
            .join("");

        dom.categoryBreakdownList.innerHTML = markup;
    }

    function renderActivity() {
        if (!state.activity.length) {
            dom.activityList.innerHTML = '<div class="admin-empty"><p>No activity logged yet.</p></div>';
            return;
        }

        dom.activityList.innerHTML = state.activity.map(function (item) {
            return [
                '<div class="admin-activity-item">',
                "<strong>", escapeHtml(item.message), "</strong>",
                '<div class="admin-activity-time mt-2">', escapeHtml(formatRelativeTime(item.timestamp)), "</div>",
                "</div>"
            ].join("");
        }).join("");
    }

    function renderStorageUsage() {
        var productBytes = estimateJsonBytes(state.products);
        var activityBytes = estimateJsonBytes(state.activity);
        var draftBytes = estimateJsonBytes(parseJson(localStorage.getItem(STORAGE_KEYS.draft), {}));
        var totalBytes = productBytes + activityBytes + draftBytes;
        var percent = Math.min(100, Math.round((totalBytes / APPROX_LOCAL_STORAGE_LIMIT) * 100));
        var modeCopy = state.catalogMode === "server" ? "Project file sync" : "Browser-only sync";

        dom.storageUsageText.textContent = formatBytes(totalBytes) + " used of about " + formatBytes(APPROX_LOCAL_STORAGE_LIMIT) + " / " + modeCopy;
        dom.storageUsageBar.style.width = String(percent) + "%";
        dom.storageUsageBar.setAttribute("aria-valuenow", String(percent));
    }

    function estimateJsonBytes(value) {
        try {
            return new TextEncoder().encode(JSON.stringify(value || {})).length;
        } catch (error) {
            return JSON.stringify(value || {}).length;
        }
    }

    function createId() {
        return "prod-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
    }

    function buildSuggestedSku(name, category) {
        var prefix = slugify(category || "menu").slice(0, 4).toUpperCase() || "MENU";
        var suffix = slugify(name || "item").slice(0, 6).toUpperCase() || "ITEM";
        return prefix + "-" + suffix;
    }

    function slugify(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function safeNumber(value) {
        var parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(safeNumber(value));
    }

    function formatDateTime(value) {
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "Unknown";
        }
        return date.toLocaleString("en-NG", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatRelativeTime(value) {
        var now = Date.now();
        var then = new Date(value).getTime();
        if (!then) {
            return "Just now";
        }

        var diffMs = now - then;
        var diffMinutes = Math.round(diffMs / 60000);
        if (diffMinutes < 1) {
            return "Just now";
        }
        if (diffMinutes < 60) {
            return diffMinutes + " minute" + (diffMinutes === 1 ? "" : "s") + " ago";
        }

        var diffHours = Math.round(diffMinutes / 60);
        if (diffHours < 24) {
            return diffHours + " hour" + (diffHours === 1 ? "" : "s") + " ago";
        }

        var diffDays = Math.round(diffHours / 24);
        return diffDays + " day" + (diffDays === 1 ? "" : "s") + " ago";
    }

    function formatBytes(bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        }
        if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + " KB";
        }
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    function labelizeStatus(status) {
        return String(status || "")
            .split("-")
            .map(function (part) {
                return part.charAt(0).toUpperCase() + part.slice(1);
            })
            .join(" ");
    }

    function getStatusBadgeClass(status) {
        if (status === "active") {
            return "admin-badge-success";
        }
        if (status === "sold-out") {
            return "admin-badge-warning";
        }
        if (status === "archived") {
            return "admin-badge";
        }
        return "admin-badge-primary";
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

    function showToast(message, type) {
        var toast = document.createElement("div");
        toast.className = "admin-toast admin-toast-" + (type || "success");
        toast.textContent = message;
        dom.toastRegion.appendChild(toast);

        window.setTimeout(function () {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-6px)";
        }, 2600);

        window.setTimeout(function () {
            toast.remove();
        }, 3200);
    }
})();
