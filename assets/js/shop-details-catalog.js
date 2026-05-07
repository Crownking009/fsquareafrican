jQuery(function ($) {
    "use strict";

    var PRODUCTS_API_URL = "/api/products";
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
            image: String(safeProduct.image || "").trim() || "assets/images/product-1.png",
            alt: String(safeProduct.alt || name).trim() || name,
            updatedAt: safeProduct.updatedAt || safeProduct.createdAt || "",
            sku: String(safeProduct.sku || "").trim(),
            servingMode: servingMode,
            servingOptions: normalizeServingOptions(safeProduct.servingOptions, servingMode, category),
            tags: normalizeTags(safeProduct.tags)
        };
    }

    function normalizeStatus(status) {
        var safeStatus = String(status || "active").trim().toLowerCase();
        return ["active", "sold-out", "draft", "archived"].indexOf(safeStatus) === -1 ? "active" : safeStatus;
    }

    function normalizeCategoryName(category) {
        var safeCategory = String(category || "Menu").replace(/\s+/g, " ").trim();
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
        $("#product-detail-price").html(buildPriceMarkup(product));
        $("#product-detail-summary").text(description);
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

        bindServingOptionSelection();

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

    function buildPriceMarkup(product) {
        return [
            "<h4>",
            escapeHtml(formatCurrency(product.price)),
            product.comparePrice > 0 ? "<del>" + escapeHtml(formatCurrency(product.comparePrice)) + "</del>" : "",
            "</h4>"
        ].join("");
    }

    function buildDescriptionMarkup(product) {
        var paragraphs = [
            product.description || "Freshly prepared and ready to order.",
            buildProductStory(product),
            buildServingStory(product)
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

    function getServingSectionTitle(product) {
        var sizeModes = ["small-medium-large", "small-large", "regular-large"];
        return sizeModes.indexOf(product.servingMode) !== -1 ? "Sizes:" : "Sold As:";
    }

    function buildServingOptionsMarkup(product) {
        return product.servingOptions.map(function (option, index) {
            return '<li' + (index === 0 ? ' class="active"' : "") + ">" + escapeHtml(option) + "</li>";
        }).join("");
    }

    function bindServingOptionSelection() {
        $("#product-detail-serving-options li").off("click.shopDetailsServing").on("click.shopDetailsServing", function () {
            $(this).addClass("active").siblings().removeClass("active");
        });
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
        var sameCategory = products.filter(function (product) {
            return product.id !== currentProduct.id && product.category === currentProduct.category;
        });
        var otherCategories = products.filter(function (product) {
            return product.id !== currentProduct.id && product.category !== currentProduct.category;
        });
        return sameCategory.concat(otherCategories).slice(0, 6);
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
