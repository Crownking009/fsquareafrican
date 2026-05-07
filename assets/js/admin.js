(function () {
    "use strict";

    var STORAGE_KEYS = {
        activity: "foodweb_admin_activity_v1",
        catalog: "foodweb_catalog_products_v1",
        draft: "foodweb_admin_draft_v1"
    };
    var PRODUCTS_API_URL = "/api/products";

    var APPROX_LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;
    var LOW_STOCK_THRESHOLD = 5;
    var MAX_ACTIVITY_ITEMS = 12;
    var DEFAULT_CATEGORIES = [
        "Pizza",
        "Burger",
        "Sandwich",
        "Shake",
        "Ice Cream",
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
        { label: "Pepperoni Pizza", value: "assets/images/pizza-receipe-1.png" },
        { label: "Beef Burger", value: "assets/images/burger-receipe-2.png" },
        { label: "Chicken Sandwich", value: "assets/images/sandwitch-receipe-3.png" },
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
        { value: "cup", label: "Cup", helper: "Use for drinks, desserts, or ice cream sold per cup.", options: ["Cup"] },
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
        dom.productServingHelper = document.getElementById("product-serving-helper");
        dom.productSku = document.getElementById("product-sku");
        dom.productTags = document.getElementById("product-tags");
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
        dom.previewDescription = document.getElementById("preview-description");
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
            saveDraftFromForm();
            renderPreviewFromForm();
        });
        dom.productCategoryCustom.addEventListener("input", function () {
            if (!dom.productSku.dataset.userTouched) {
                dom.productSku.value = buildSuggestedSku(dom.productName.value, getResolvedCategoryValue());
            }
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
            dom.productSku,
            dom.productTags,
            dom.productDescription,
            dom.productImageAlt,
            dom.productFeatured
        ].forEach(function (field) {
            var eventName = field.type === "checkbox" || field.tagName === "SELECT" ? "change" : "input";
            field.addEventListener(eventName, function () {
                if (field === dom.productName && !dom.productSku.dataset.userTouched) {
                    dom.productSku.value = buildSuggestedSku(dom.productName.value, getResolvedCategoryValue());
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
            console.warn("Shared catalog server unavailable. Falling back to browser storage.", error);
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
            makeStarterProduct("Pepperoni Pizza", "Pizza", 4.59, 7.59, 18, "Spicy pepperoni pizza with mozzarella and tomato sauce.", "assets/images/pizza-receipe-1.png", ["pizza", "promo"], true, "active"),
            makeStarterProduct("Beefka Burger", "Burger", 5.12, 6.59, 12, "Grilled beef burger with cheese and signature sauce.", "assets/images/burger-receipe-2.png", ["burger", "beef"], true, "active"),
            makeStarterProduct("Chicken Sandwich", "Sandwich", 6.57, 7.12, 9, "Crispy chicken sandwich with lettuce, tomato, and sauce.", "assets/images/sandwitch-receipe-3.png", ["sandwich", "chicken"], false, "active"),
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
            shake: "small-medium-large",
            "ice cream": "cup",
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

    function formatServingSummary(product) {
        var config = getServingModeConfig(product && product.servingMode);
        var options = Array.isArray(product && product.servingOptions) ? product.servingOptions : [];
        return config.label + (options.length ? ": " + options.join(", ") : "");
    }

    function normalizeProduct(product) {
        var safeProduct = product || {};
        var name = String(safeProduct.name || "Untitled Product").trim();
        var category = String(safeProduct.category || DEFAULT_CATEGORIES[0]).trim();
        var createdAt = safeProduct.createdAt || new Date().toISOString();
        var updatedAt = safeProduct.updatedAt || createdAt;
        var servingMode = normalizeServingMode(safeProduct.servingMode, category);
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
            servingOptions: normalizeServingOptions(safeProduct.servingOptions, servingMode, category),
            tags: normalizeTags(safeProduct.tags),
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

    async function persistProducts() {
        if (state.catalogMode === "browser") {
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
        if (state.catalogMode === "browser") {
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
        var sku = dom.productSku.value.trim() || buildSuggestedSku(name, category);
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
                product.tags.join(" ")
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
            '<div class="admin-chip-list mt-2">', renderTagBadges(product.tags), "</div>",
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
            "</div>",
            "</div>",
            '<div class="admin-preview-meta mb-2">',
            '<span class="admin-badge ', getStatusBadgeClass(product.status), '">', escapeHtml(labelizeStatus(product.status)), "</span>",
            product.featured ? '<span class="admin-badge admin-badge-primary">Featured</span>' : "",
            '<span class="admin-badge ', product.stock <= LOW_STOCK_THRESHOLD ? "admin-badge-warning" : "admin-badge-success", '">', escapeHtml(String(product.stock)), " in stock</span>",
            "</div>",
            '<div class="mb-2">', buildPriceMarkup(product), "</div>",
            '<p class="admin-row-meta">', escapeHtml(product.description || "No description provided."), "</p>",
            '<div class="admin-chip-list mb-3">', renderTagBadges(product.tags), "</div>",
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
        var current = '<strong>' + escapeHtml(formatCurrency(product.price)) + "</strong>";
        var compare = product.comparePrice > 0 ? ' <span class="admin-label-muted"><del>' + escapeHtml(formatCurrency(product.comparePrice)) + "</del></span>" : "";
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
        dom.productCategory.value = product.category;
        dom.productPrice.value = product.price;
        dom.productComparePrice.value = product.comparePrice || "";
        dom.productStock.value = product.stock;
        dom.productStatus.value = product.status;
        dom.productServingMode.value = product.servingMode;
        dom.productServingOptions.value = product.servingOptions.join(", ");
        applyServingModePreset(true);
        dom.productSku.value = product.sku;
        dom.productSku.dataset.userTouched = product.sku ? "true" : "";
        dom.productTags.value = product.tags.join(", ");
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
            category: dom.productCategory.value,
            price: dom.productPrice.value,
            comparePrice: dom.productComparePrice.value,
            stock: dom.productStock.value,
            status: dom.productStatus.value,
            servingMode: dom.productServingMode.value,
            servingOptions: dom.productServingOptions.value,
            sku: dom.productSku.value,
            tags: dom.productTags.value,
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
        dom.productCategory.value = draft.category || DEFAULT_CATEGORIES[0];
        dom.productPrice.value = draft.price || "";
        dom.productComparePrice.value = draft.comparePrice || "";
        dom.productStock.value = draft.stock || "";
        dom.productStatus.value = draft.status || "active";
        dom.productServingMode.value = draft.servingMode || inferServingMode(draft.category || DEFAULT_CATEGORIES[0]);
        dom.productServingOptions.value = draft.servingOptions || "";
        applyServingModePreset(true);
        dom.productSku.value = draft.sku || "";
        dom.productSku.dataset.userTouched = draft.sku ? "true" : "";
        dom.productTags.value = draft.tags || "";
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
        dom.productCategory.value = DEFAULT_CATEGORIES[0];
        dom.productStatus.value = "active";
        dom.productServingMode.value = inferServingMode(dom.productCategory.value);
        dom.productServingOptions.value = "";
        applyServingModePreset();
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
        dom.productCategory.value = DEFAULT_CATEGORIES[0];
        dom.productServingMode.value = inferServingMode(dom.productCategory.value);
        dom.productServingOptions.value = "";
        applyServingModePreset();
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
        var category = dom.productCategory.value.trim() || "Category";
        var sku = dom.productSku.value.trim() || buildSuggestedSku(name, category);
        var status = labelizeStatus(dom.productStatus.value);
        var servingMode = dom.productServingMode.value || inferServingMode(category);
        var servingOptions = normalizeServingOptions(dom.productServingOptions.value, servingMode, category);
        var description = dom.productDescription.value.trim() || "Your product description will appear here as you type.";
        var price = safeNumber(dom.productPrice.value);
        var comparePrice = safeNumber(dom.productComparePrice.value);
        var image = dom.productImageUrl.value.trim() || "assets/images/product-1.png";

        dom.previewName.textContent = name;
        dom.previewCategory.textContent = category;
        dom.previewStatus.textContent = status;
        dom.previewSku.textContent = "SKU: " + sku;
        dom.previewServing.textContent = "Sold as: " + getServingModeConfig(servingMode).label + " - " + servingOptions.join(", ");
        dom.previewDescription.textContent = description;
        dom.previewCardImage.src = image;
        dom.previewCardImage.alt = dom.productImageAlt.value.trim() || name;
        dom.previewFeatured.hidden = !dom.productFeatured.checked;

        dom.previewPrice.innerHTML = escapeHtml(formatCurrency(price)) + (comparePrice > 0 ? ' <del>' + escapeHtml(formatCurrency(comparePrice)) + "</del>" : "");
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
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
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
