jQuery(function ($) {
    "use strict";

    var PRODUCTS_API_URL = "/api/products";
    var BROWSER_CATALOG_KEY = "foodweb_catalog_products_v1";
    var CATEGORY_ORDER = [
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
    var CATEGORY_META = {
        pizza: { image: "assets/images/menu-2.png", label: "PIZZA" },
        burger: { image: "assets/images/menu-1.png", label: "BURGER" },
        sandwich: { image: "assets/images/menu-3.png", label: "SANDWICH" },
        shake: { image: "assets/images/menu-4.png", label: "SHAKE" },
        "ice-cream": { image: "assets/images/menu-5.png", label: "ICE CREAM" },
        dessert: { image: "assets/images/menu-6.png", label: "DESSERT" },
        swallows: { image: "assets/images/menu-1.png", label: "SWALLOWS" },
        soups: { image: "assets/images/menu-2.png", label: "SOUPS" },
        "rice-dishes": { image: "assets/images/menu-3.png", label: "RICE<br>DISHES" },
        "small-chops": { image: "assets/images/menu-4.png", label: "SMALL<br>CHOPS" },
        proteins: { image: "assets/images/menu-5.png", label: "PROTEINS" },
        "pepper-soups": { image: "assets/images/menu-6.png", label: "PEPPER<br>SOUPS" },
        beans: { image: "assets/images/menu-1.png", label: "BEANS" },
        porridges: { image: "assets/images/menu-2.png", label: "PORRIDGES" },
        "snacks-and-pastries": { image: "assets/images/menu-3.png", label: "SNACKS &amp;<br>PASTRIES" },
        "local-beverages": { image: "assets/images/menu-4.png", label: "LOCAL<br>BEVERAGES" },
        "sides-and-extra": { image: "assets/images/menu-5.png", label: "SIDES &amp;<br>EXTRA" }
    };
    var FALLBACK_THUMB_IMAGES = [
        "assets/images/menu-1.png",
        "assets/images/menu-2.png",
        "assets/images/menu-3.png",
        "assets/images/menu-4.png",
        "assets/images/menu-5.png",
        "assets/images/menu-6.png"
    ];
    var CATALOG_REFRESH_INTERVAL_MS = 5000;
    var REFRESH_DEBOUNCE_MS = 500;

    var dom = {
        thumbNav: $(".menu-main-thumb-nav"),
        detailsFor: $(".menu-main-details-for"),
        searchInput: $("#menu-search-input"),
        searchForm: $("#menu-search-form"),
        sortSelect: $("#menu-sort-select"),
        rangeSlider: $("#range-slider"),
        priceAmount: $("#price-amount")
    };
    var refreshTimer = null;
    var catalogSignature = "";
    var catalogMode = "server";

    if (!dom.thumbNav.length || !dom.detailsFor.length || !dom.searchInput.length || !dom.sortSelect.length || !dom.rangeSlider.length) {
        return;
    }

    hydrateMenuFromCatalog({ force: true });
    window.setInterval(function () {
        if (!document.hidden) {
            hydrateMenuFromCatalog();
        }
    }, CATALOG_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) {
            hydrateMenuFromCatalog({ force: true });
        }
    });
    window.addEventListener("storage", function (event) {
        if (event.key === BROWSER_CATALOG_KEY) {
            hydrateMenuFromCatalog({ force: true });
        }
    });

    async function hydrateMenuFromCatalog(options) {
        var settings = options || {};
        try {
            var catalog = await fetchProductsCatalog();
            catalogMode = catalog.mode;
            var products = catalog.products;
            var nextSignature = buildProductsSignature(products);
            if (!settings.force && nextSignature === catalogSignature) {
                return;
            }

            renderSharedMenu(products, {
                preserveCategory: getActiveCategoryName()
            });
            catalogSignature = nextSignature;
        } catch (error) {
            window.console && console.warn("Shared catalog unavailable, using menu fallback markup.", error);
        }
    }

    async function fetchProductsCatalog() {
        try {
            return {
                mode: "server",
                products: await fetchProductsFromApi()
            };
        } catch (error) {
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
            throw new Error("Unable to load shared menu catalog.");
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
        return {
            id: String(safeProduct.id || ""),
            name: name,
            category: category,
            price: safeNumber(safeProduct.price),
            comparePrice: safeNumber(safeProduct.comparePrice),
            stock: Math.max(0, Math.round(safeNumber(safeProduct.stock))),
            sku: String(safeProduct.sku || "").trim(),
            status: normalizeStatus(safeProduct.status),
            featured: Boolean(safeProduct.featured),
            description: String(safeProduct.description || "").trim(),
            image: String(safeProduct.image || "").trim() || "assets/images/product-1.png",
            alt: String(safeProduct.alt || name).trim() || name,
            updatedAt: safeProduct.updatedAt || safeProduct.createdAt || "",
            servingMode: normalizeServingMode(safeProduct.servingMode, category),
            servingOptions: normalizeServingOptions(safeProduct.servingOptions, safeProduct.servingMode, category),
            tags: normalizeTags(safeProduct.tags)
        };
    }

    function normalizeStatus(status) {
        var safeStatus = String(status || "active").trim().toLowerCase();
        return ["active", "sold-out", "draft", "archived"].indexOf(safeStatus) === -1 ? "active" : safeStatus;
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

    function normalizeServingMode(mode, category) {
        var requestedMode = String(mode || "").trim().toLowerCase();
        var inferredMode = inferServingMode(category);
        var allowedModes = [
            "single",
            "portion",
            "half-full-portion",
            "plate",
            "bowl",
            "piece",
            "pack",
            "cup",
            "bottle",
            "tray",
            "small-medium-large",
            "small-large",
            "regular-large",
            "custom"
        ];

        return allowedModes.indexOf(requestedMode) !== -1 ? requestedMode : inferredMode;
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

    function normalizeServingOptions(options, mode, category) {
        var normalizedMode = normalizeServingMode(mode, category);
        var list = Array.isArray(options) ? options : String(options || "").split(",");
        var normalized = list.map(function (option) {
            return String(option || "").replace(/\s+/g, " ").trim();
        }).filter(Boolean);

        if (normalized.length) {
            return normalized;
        }

        var defaults = {
            single: ["Standard Order"],
            portion: ["Portion"],
            "half-full-portion": ["Half Portion", "Full Portion"],
            plate: ["Plate"],
            bowl: ["Bowl"],
            piece: ["1 Piece"],
            pack: ["Pack"],
            cup: ["Cup"],
            bottle: ["Bottle"],
            tray: ["Tray"],
            "small-medium-large": ["Small", "Medium", "Large"],
            "small-large": ["Small", "Large"],
            "regular-large": ["Regular", "Large"],
            custom: ["Custom Order"]
        };

        return defaults[normalizedMode] || ["Standard Order"];
    }

    function normalizeCategoryName(category) {
        var safeCategory = String(category || "Menu").replace(/\s+/g, " ").trim();
        var key = safeCategory.toLowerCase();
        var aliases = {
            sandwitch: "Sandwich",
            sandwich: "Sandwich",
            "ice-creame": "Ice Cream",
            "ice cream": "Ice Cream",
            "snacks & pastries": "Snacks and Pastries",
            "sides & extra": "Sides and Extra"
        };
        if (aliases[key]) {
            return aliases[key];
        }

        return safeCategory.split(" ").map(function (part) {
            return part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : "";
        }).join(" ").trim() || "Menu";
    }

    function renderSharedMenu(products, options) {
        var settings = options || {};
        var visibleProducts = products.filter(function (product) {
            return product.status === "active" || product.status === "sold-out";
        });
        var groupedProducts = groupProductsByCategory(visibleProducts);

        destroyMenuMainCarousel();

        if (!groupedProducts.length) {
            dom.thumbNav.html(buildEmptyThumbMarkup());
            dom.detailsFor.html(buildEmptyDetailsMarkup());
        } else {
            dom.thumbNav.html(groupedProducts.map(function (group, index) {
                return buildThumbMarkup(group.category, index);
            }).join(""));
            dom.detailsFor.html(groupedProducts.map(function (group) {
                return buildCategorySlideMarkup(group.category, group.products);
            }).join(""));
        }

        bindMenuControls();
        syncDefaultOrder();
        initMenuMainCarousel();
        initPriceSlider(getMaximumPrice());
        applyCurrentSortAndFilter();
        restoreActiveCategory(settings.preserveCategory);
    }

    function groupProductsByCategory(products) {
        var groupedMap = {};
        var groupedList = [];

        products.forEach(function (product) {
            var category = product.category;
            if (!groupedMap[category]) {
                groupedMap[category] = [];
            }
            groupedMap[category].push(product);
        });

        Object.keys(groupedMap).sort(function (a, b) {
            var aIndex = CATEGORY_ORDER.indexOf(a);
            var bIndex = CATEGORY_ORDER.indexOf(b);

            if (aIndex !== -1 || bIndex !== -1) {
                if (aIndex === -1) {
                    return 1;
                }
                if (bIndex === -1) {
                    return -1;
                }
                return aIndex - bIndex;
            }

            return a.localeCompare(b);
        }).forEach(function (category) {
            groupedList.push({
                category: category,
                products: groupedMap[category]
            });
        });

        return groupedList;
    }

    function buildThumbMarkup(category, index) {
        var meta = getCategoryMeta(category, index);
        return [
            '<div class="menu-main-thumb-item menu-main-thumb-black">',
            '<div class="menu-main-thumb-inner">',
            '<img src="', escapeAttribute(meta.image), '" alt="', escapeAttribute(category), '">',
            "<p>", meta.label, "</p>",
            "</div>",
            "</div>"
        ].join("");
    }

    function buildCategorySlideMarkup(category, products) {
        return [
            '<div class="menu-main-details-item" data-category-name="', escapeAttribute(category), '">',
            '<div class="row g-4">',
            products.map(buildProductCardMarkup).join(""),
            "</div>",
            "</div>"
        ].join("");
    }

    function buildProductCardMarkup(product) {
        var isSoldOut = product.status === "sold-out";
        var detailsUrl = buildProductDetailsUrl(product);
        var primaryAction = isSoldOut
            ? '<a href="javascript:void(0)" class="btn" aria-disabled="true" tabindex="-1">Sold Out</a>'
            : '<a href="cart.html" class="btn btn-yellow add-to-cart-trigger" data-cart-product-id="' + escapeAttribute(product.id) + '" data-cart-name="' + escapeAttribute(product.name) + '" data-cart-sku="' + escapeAttribute(product.sku || product.id) + '" data-cart-price="' + escapeAttribute(String(product.price)) + '" data-cart-image="' + escapeAttribute(product.image) + '" data-cart-alt="' + escapeAttribute(product.alt || product.name) + '" data-cart-stock="' + escapeAttribute(String(product.stock)) + '" data-cart-option="' + escapeAttribute((product.servingOptions[0] || "Standard Order")) + '" data-cart-serving-mode="' + escapeAttribute(product.servingMode || "single") + '" data-cart-details-url="' + escapeAttribute(detailsUrl) + '">Add To Cart</a>';

        return [
            '<div class="col-6 col-md-6 col-lg-4" data-menu-category="', escapeAttribute(slugify(product.category)), '">',
            '<div class="product-card product-card-dark h-100">',
            '<a class="product-card-surface" href="', escapeAttribute(detailsUrl), '" data-product-id="', escapeAttribute(product.id), '">',
            '<div class="product-card-thumb">',
            '<div class="product-card-thumb-inner" style="aspect-ratio:1 / 1; padding:20px; display:grid; place-items:center;">',
            '<img src="', escapeAttribute(product.image), '" alt="', escapeAttribute(product.alt || product.name), '" style="width:100%; height:100%; object-fit:cover; border-radius:10px;">',
            "</div>",
            "</div>",
            '<div class="product-card-content">',
            "<h3>", escapeHtml(product.name), "</h3>",
            "<p>", escapeHtml(product.description || "Freshly prepared and ready to order."), "</p>",
            '<h4 class="product-price">', escapeHtml(formatCurrency(product.price)),
            product.comparePrice > 0 ? " <del>" + escapeHtml(formatCurrency(product.comparePrice)) + "</del>" : "",
            "</h4>",
            "</div>",
            "</a>",
            '<div class="product-card-button">',
            primaryAction,
            '<a href="#" class="btn wishlist-trigger" data-wishlist-default-label="Wishlist" data-wishlist-active-label="In Wishlist" data-wishlist-product-id="' + escapeAttribute(product.id) + '" data-wishlist-name="' + escapeAttribute(product.name) + '" data-wishlist-sku="' + escapeAttribute(product.sku || product.id) + '" data-wishlist-price="' + escapeAttribute(String(product.price)) + '" data-wishlist-image="' + escapeAttribute(product.image) + '" data-wishlist-alt="' + escapeAttribute(product.alt || product.name) + '" data-wishlist-details-url="' + escapeAttribute(detailsUrl) + '" data-wishlist-stock="' + escapeAttribute(String(product.stock)) + '" data-wishlist-option="' + escapeAttribute((product.servingOptions[0] || "Standard Order")) + '" data-wishlist-serving-mode="' + escapeAttribute(product.servingMode || "single") + '">Wishlist</a>',
            "</div>",
            "</div>",
            "</div>"
        ].join("");
    }

    function buildEmptyThumbMarkup() {
        return [
            '<div class="menu-main-thumb-item menu-main-thumb-black">',
            '<div class="menu-main-thumb-inner">',
            '<img src="assets/images/menu-1.png" alt="Menu">',
            "<p>MENU</p>",
            "</div>",
            "</div>"
        ].join("");
    }

    function buildEmptyDetailsMarkup() {
        return [
            '<div class="menu-main-details-item">',
            '<div class="row g-4 justify-content-center">',
            '<div class="col-12 col-lg-8">',
            '<div class="product-card product-card-dark h-100">',
            '<div class="product-card-content text-center p-5">',
            "<h3>No menu items are live right now</h3>",
            "<p>Add or activate products in the admin page to publish them here.</p>",
            "</div>",
            "</div>",
            "</div>",
            "</div>",
            "</div>"
        ].join("");
    }

    function getCategoryMeta(category, index) {
        var key = slugify(category);
        var meta = CATEGORY_META[key];
        if (meta) {
            return meta;
        }

        return {
            image: FALLBACK_THUMB_IMAGES[index % FALLBACK_THUMB_IMAGES.length],
            label: escapeHtml(category.toUpperCase())
        };
    }

    function bindMenuControls() {
        dom.searchInput.off("input").on("input.menuCatalog", scheduleFilter);
        dom.searchForm.off("submit").on("submit.menuCatalog", function (event) {
            event.preventDefault();
            filterMenuItems();
        });
        dom.sortSelect.off("change").on("change.menuCatalog", function () {
            applyCurrentSortAndFilter();
        });
    }

    function scheduleFilter() {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(function () {
            filterMenuItems();
        }, REFRESH_DEBOUNCE_MS);
    }

    function destroyMenuMainCarousel() {
        if (dom.detailsFor.hasClass("slick-initialized")) {
            dom.detailsFor.slick("unslick");
        }
        if (dom.thumbNav.hasClass("slick-initialized")) {
            dom.thumbNav.slick("unslick");
        }
    }

    function initMenuMainCarousel() {
        if (!$.fn.slick || !dom.detailsFor.length || !dom.thumbNav.length) {
            return;
        }

        dom.detailsFor.slick({
            slidesToShow: 1,
            slidesToScroll: 1,
            arrows: false,
            infinite: false,
            draggable: false,
            asNavFor: ".menu-main-thumb-nav",
            speed: 1500
        });

        dom.thumbNav.slick({
            slidesToShow: Math.min(6, Math.max(1, dom.thumbNav.children().length)),
            slidesToScroll: 1,
            asNavFor: ".menu-main-details-for",
            dots: false,
            focusOnSelect: true,
            arrows: false,
            infinite: false,
            draggable: false,
            responsive: [
                {
                    breakpoint: 991,
                    settings: {
                        slidesToShow: Math.min(4, Math.max(1, dom.thumbNav.children().length)),
                        slidesToScroll: 1,
                        arrows: true,
                        draggable: true,
                        infinite: true,
                        prevArrow: '<i class="flaticon-left-arrow-2 prev-arrow"></i>',
                        nextArrow: '<i class="flaticon-right-arrow-3 next-arrow"></i>'
                    }
                },
                {
                    breakpoint: 767,
                    settings: {
                        slidesToShow: Math.min(3, Math.max(1, dom.thumbNav.children().length)),
                        slidesToScroll: 1,
                        arrows: true,
                        draggable: true,
                        infinite: true,
                        prevArrow: '<i class="flaticon-left-arrow-2 prev-arrow"></i>',
                        nextArrow: '<i class="flaticon-right-arrow-3 next-arrow"></i>'
                    }
                },
                {
                    breakpoint: 480,
                    settings: {
                        slidesToShow: Math.min(2, Math.max(1, dom.thumbNav.children().length)),
                        slidesToScroll: 1,
                        arrows: true,
                        draggable: true,
                        infinite: true,
                        prevArrow: '<i class="flaticon-left-arrow-2 prev-arrow"></i>',
                        nextArrow: '<i class="flaticon-right-arrow-3 next-arrow"></i>'
                    }
                }
            ]
        });
    }

    function initPriceSlider(maxPrice) {
        var safeMax = Math.max(1, Math.ceil(maxPrice));

        if (dom.rangeSlider.hasClass("ui-slider") || dom.rangeSlider.hasClass("ui-slider-horizontal")) {
            dom.rangeSlider.slider("destroy");
        }

        dom.rangeSlider.slider({
            range: true,
            min: 0,
            max: safeMax,
            values: [0, safeMax],
            slide: function (event, ui) {
                updatePriceAmount(ui.values[0], ui.values[1]);
                filterMenuItems();
            }
        });

        updatePriceAmount(0, safeMax);
    }

    function updatePriceAmount(min, max) {
        dom.priceAmount.val(formatCurrency(min) + " - " + formatCurrency(max));
    }

    function applyCurrentSortAndFilter() {
        sortMenuItems(dom.sortSelect.val());
        filterMenuItems();
    }

    function syncDefaultOrder() {
        dom.detailsFor.find(".menu-main-details-item .row").each(function () {
            $(this).children(".col-6").each(function (index) {
                $(this).attr("data-order", index);
            });
        });
    }

    function getMaximumPrice() {
        var highestPrice = 0;

        dom.detailsFor.find(".menu-main-details-item .col-6").each(function () {
            highestPrice = Math.max(highestPrice, getMenuCardPrice($(this)));
        });

        return highestPrice;
    }

    function getMenuCardPrice(card) {
        var text = card.find(".product-price").first().text();
        return parseFloat(text.replace(/[^0-9.]/g, "")) || 0;
    }

    function getMenuCardSearchText(card) {
        var name = card.find(".product-card-content h3").first().text().trim();
        var description = card.find(".product-card-content p").first().text().trim();
        var altText = card.find(".product-card-thumb img").first().attr("alt") || "";
        return [name, description, altText].join(" ").toLowerCase();
    }

    function focusFirstMatchingMenuGroup() {
        var firstVisibleGroup = dom.detailsFor.find(".menu-main-details-item").filter(function () {
            return $(this).find(".col-6:visible").length > 0;
        }).first();

        if (!firstVisibleGroup.length) {
            return;
        }

        var targetIndex = firstVisibleGroup.index();
        if (dom.detailsFor.hasClass("slick-initialized")) {
            dom.detailsFor.slick("slickGoTo", targetIndex);
        }
    }

    function getActiveCategoryName() {
        var slides = dom.detailsFor.find(".menu-main-details-item");
        if (!slides.length) {
            return "";
        }

        if (dom.detailsFor.hasClass("slick-initialized")) {
            var currentIndex = dom.detailsFor.slick("slickCurrentSlide");
            return slides.eq(currentIndex).attr("data-category-name") || "";
        }

        return slides.first().attr("data-category-name") || "";
    }

    function restoreActiveCategory(categoryName) {
        if (!categoryName) {
            return;
        }

        var slides = dom.detailsFor.find(".menu-main-details-item");
        var targetSlide = slides.filter(function () {
            return $(this).attr("data-category-name") === categoryName;
        }).first();

        if (!targetSlide.length) {
            return;
        }

        if (dom.detailsFor.find(".col-6:visible").length && !targetSlide.find(".col-6:visible").length) {
            return;
        }

        if (dom.detailsFor.hasClass("slick-initialized")) {
            dom.detailsFor.slick("slickGoTo", targetSlide.index());
        }
    }

    function filterMenuItems() {
        var term = dom.searchInput.val().toLowerCase().trim();
        var values = dom.rangeSlider.slider("values");
        var min = values[0];
        var max = values[1];

        dom.detailsFor.find(".menu-main-details-item .col-6").each(function () {
            var card = $(this);
            var content = getMenuCardSearchText(card);
            var price = getMenuCardPrice(card);
            var matchesText = !term || content.indexOf(term) !== -1;
            var matchesPrice = price >= min && price <= max;
            card.toggle(matchesText && matchesPrice);
        });

        focusFirstMatchingMenuGroup();
    }

    function sortMenuItems(order) {
        dom.detailsFor.find(".menu-main-details-item .row").each(function () {
            var row = $(this);
            var items = row.children(".col-6").get();

            items.sort(function (a, b) {
                var cardA = $(a);
                var cardB = $(b);
                var priceA = getMenuCardPrice(cardA);
                var priceB = getMenuCardPrice(cardB);
                var nameA = cardA.find(".product-card-content h3").text().trim().toLowerCase();
                var nameB = cardB.find(".product-card-content h3").text().trim().toLowerCase();

                if (order === "lowtohigh") {
                    return priceA - priceB;
                }
                if (order === "hightolow") {
                    return priceB - priceA;
                }
                if (order === "nameaz") {
                    return nameA.localeCompare(nameB);
                }
                if (order === "nameza") {
                    return nameB.localeCompare(nameA);
                }

                return (cardA.data("order") || 0) - (cardB.data("order") || 0);
            });

            $.each(items, function (_, item) {
                row.append(item);
            });
        });
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
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

    function buildProductsSignature(products) {
        return products.map(function (product) {
            return [
                product.id,
                product.name,
                product.category,
                product.price,
                product.comparePrice,
                product.status,
                product.updatedAt
            ].join("|");
        }).join("||");
    }

    function buildProductDetailsUrl(product) {
        return "shop-details.html?product=" + encodeURIComponent(product.id || "");
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
