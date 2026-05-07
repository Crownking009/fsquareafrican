jQuery(function ($) {
    "use strict";

    var WISHLIST_STORAGE_KEY = "foodweb_wishlist_state_v1";
    var WISHLIST_TRIGGER_SELECTOR = [
        ".wishlist-trigger",
        ".product-card-button a[href*='wishlist.html']",
        ".receipe-cart a[href*='wishlist.html']",
        "#product-detail-wishlist-link"
    ].join(", ");
    var wishlist = loadWishlist();

    window.FoodwebWishlist = {
        addItem: addItem,
        removeItem: removeItem,
        hasItem: hasItem,
        toggleItem: toggleItem,
        getItemCount: getItemCount,
        getState: function () {
            return cloneValue(wishlist);
        }
    };

    bindEvents();
    renderAll();
    scheduleTriggerRefresh();

    function bindEvents() {
        $(document).on("click", WISHLIST_TRIGGER_SELECTOR, handleWishlistTrigger);
        $(document).on("click", ".wishlist-remove-item", handleWishlistRemove);
        $(document).on("click", ".wishlist-add-to-cart", handleWishlistAddToCart);
        $(window).on("storage", function (event) {
            if (event.originalEvent && event.originalEvent.key === WISHLIST_STORAGE_KEY) {
                wishlist = loadWishlist();
                renderAll();
            }
        });
    }

    function scheduleTriggerRefresh() {
        [250, 1000, 2500].forEach(function (delay) {
            window.setTimeout(updateWishlistTriggers, delay);
        });
    }

    function loadWishlist() {
        try {
            return normalizeWishlist(JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || "[]"));
        } catch (error) {
            return [];
        }
    }

    function normalizeWishlist(items) {
        if (!Array.isArray(items)) {
            return [];
        }

        return items.map(normalizeWishlistItem).filter(Boolean);
    }

    function normalizeWishlistItem(item) {
        var safeItem = item || {};
        var productId = String(safeItem.productId || "").trim();

        if (!productId) {
            return null;
        }

        return {
            productId: productId,
            name: String(safeItem.name || "Untitled Product").trim() || "Untitled Product",
            sku: String(safeItem.sku || productId).trim() || productId,
            price: safeNumber(safeItem.price),
            image: String(safeItem.image || "assets/images/product-1.png").trim() || "assets/images/product-1.png",
            alt: String(safeItem.alt || safeItem.name || "Product image").trim() || "Product image",
            detailsUrl: String(safeItem.detailsUrl || ("shop-details.html?product=" + encodeURIComponent(productId))).trim(),
            stock: Math.max(0, Math.round(safeNumber(safeItem.stock))),
            optionLabel: String(safeItem.optionLabel || "Standard Order").trim() || "Standard Order",
            servingMode: String(safeItem.servingMode || "single").trim() || "single"
        };
    }

    function saveWishlist() {
        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
        document.dispatchEvent(new CustomEvent("foodweb:wishlist-updated", {
            detail: cloneValue(wishlist)
        }));
        renderAll();
    }

    function addItem(item) {
        var normalizedItem = normalizeWishlistItem(item);
        var existingIndex;

        if (!normalizedItem) {
            return {
                ok: false
            };
        }

        existingIndex = wishlist.findIndex(function (entry) {
            return entry.productId === normalizedItem.productId;
        });

        if (existingIndex !== -1) {
            wishlist[existingIndex] = normalizedItem;
        } else {
            wishlist.push(normalizedItem);
        }

        saveWishlist();

        return {
            ok: true,
            active: true,
            item: normalizedItem
        };
    }

    function removeItem(productId) {
        var safeId = String(productId || "").trim();

        wishlist = wishlist.filter(function (entry) {
            return entry.productId !== safeId;
        });

        saveWishlist();

        return {
            ok: true,
            active: false,
            productId: safeId
        };
    }

    function toggleItem(item) {
        var normalizedItem = normalizeWishlistItem(item);

        if (!normalizedItem) {
            return {
                ok: false
            };
        }

        if (hasItem(normalizedItem.productId)) {
            return removeItem(normalizedItem.productId);
        }

        return addItem(normalizedItem);
    }

    function hasItem(productId) {
        var safeId = String(productId || "").trim();

        return wishlist.some(function (entry) {
            return entry.productId === safeId;
        });
    }

    function getItemCount() {
        return wishlist.length;
    }

    function renderAll() {
        ensureFloatingWhatsAppButton();
        hydrateMobileNavAccountLink();
        updateWishlistBadges();
        updateWishlistTriggers();
        renderWishlistPage();
    }

    function ensureFloatingWhatsAppButton() {
        if ($(".floating-whatsapp").length) {
            return;
        }

        $("body").append([
            '<a href="https://wa.me/2349048239391" class="floating-whatsapp" target="_blank" rel="noopener" aria-label="Chat us now on WhatsApp">',
            '<span class="floating-whatsapp-icon"><i class="icofont-brand-whatsapp"></i></span>',
            '<span class="floating-whatsapp-text">Chat Us Now</span>',
            "</a>"
        ].join(""));
    }

    function hydrateMobileNavAccountLink() {
        $(".mobile-nav .navbar-option-dots .dropdown-menu").each(function () {
            var dropdown = $(this);

            if (dropdown.find(".navbar-option-auth-mobile-link-item").length) {
                return;
            }

            dropdown.prepend([
                '<div class="navbar-option-item navbar-option-auth-mobile-link-item">',
                '<a href="my-account.html" class="navbar-option-auth-mobile-link" aria-label="Open my account"><i class="flaticon-add-user"></i></a>',
                "</div>"
            ].join(""));
        });
    }

    function updateWishlistBadges() {
        $(".wishlist-badge").text(String(getItemCount()));
    }

    function updateWishlistTriggers() {
        $(WISHLIST_TRIGGER_SELECTOR).each(function () {
            var trigger = $(this);
            var payload = extractWishlistPayloadFromTrigger(trigger);
            var active = payload ? hasItem(payload.productId) : false;

            applyTriggerState(trigger, active);
        });
    }

    function applyTriggerState(trigger, active) {
        var defaultLabel = trigger.attr("data-wishlist-default-label");
        var activeLabel = trigger.attr("data-wishlist-active-label");

        if (typeof defaultLabel === "undefined") {
            defaultLabel = trigger.text().replace(/\s+/g, " ").trim();
            trigger.attr("data-wishlist-default-label", defaultLabel);
        }

        if (typeof activeLabel === "undefined") {
            activeLabel = "In Wishlist";
            trigger.attr("data-wishlist-active-label", activeLabel);
        }

        trigger.toggleClass("wishlist-trigger-active", active);
        trigger.attr("aria-pressed", active ? "true" : "false");

        if (trigger.is("#product-detail-wishlist-link")) {
            trigger.html('<i class="flaticon-heart"></i>' + escapeHtml(active ? activeLabel : defaultLabel));
            return;
        }

        if (trigger.closest(".product-card-button").length) {
            trigger.text(active ? activeLabel : defaultLabel);
            return;
        }

        trigger.attr("title", active ? activeLabel : (defaultLabel || "Add To Wishlist"));
        trigger.attr("aria-label", active ? activeLabel : (defaultLabel || "Add To Wishlist"));
    }

    function renderWishlistPage() {
        var tbody = $("#wishlist-table-body");

        if (!tbody.length) {
            return;
        }

        if (!wishlist.length) {
            tbody.html([
                '<tr><td class="cart-empty-state color-white" colspan="6">',
                "<h3>Your wishlist is empty</h3>",
                '<p>Save your favorite meals from the <a href="menu.html">menu page</a> and they will appear here.</p>',
                "</td></tr>"
            ].join(""));
            return;
        }

        tbody.html(wishlist.map(buildWishlistRowMarkup).join(""));
    }

    function buildWishlistRowMarkup(item) {
        return [
            "<tr>",
            '<td class="cancel"><a href="#" class="wishlist-remove-item" data-wishlist-remove="', escapeAttribute(item.productId), '"><i class="flaticon-cancel"></i></a></td>',
            "<td>",
            '<div class="product-table-info">',
            '<div class="product-table-thumb">',
            '<a href="', escapeAttribute(item.detailsUrl), '"><img src="', escapeAttribute(item.image), '" alt="', escapeAttribute(item.alt), '"></a>',
            "</div>",
            "</div>",
            "</td>",
            '<td class="td-product-name"><a href="', escapeAttribute(item.detailsUrl), '" class="wishlist-product-link">', escapeHtml(item.name), "</a></td>",
            "<td>", escapeHtml(item.sku), "</td>",
            "<td>", escapeHtml(formatCurrency(item.price)), "</td>",
            '<td><a href="cart.html" class="btn wishlist-add-to-cart" data-wishlist-add="', escapeAttribute(item.productId), '">Add To Cart <i class="flaticon-shopping-cart-black-shape"></i></a></td>',
            "</tr>"
        ].join("");
    }

    function handleWishlistTrigger(event) {
        var trigger = $(event.currentTarget);
        var payload = extractWishlistPayloadFromTrigger(trigger);

        event.preventDefault();
        event.stopPropagation();

        if (!payload) {
            return;
        }

        toggleItem(payload);
    }

    function handleWishlistRemove(event) {
        event.preventDefault();
        removeItem($(event.currentTarget).attr("data-wishlist-remove"));
    }

    function handleWishlistAddToCart(event) {
        var trigger = $(event.currentTarget);
        var productId = String(trigger.attr("data-wishlist-add") || "").trim();
        var item = wishlist.find(function (entry) {
            return entry.productId === productId;
        });
        var result;

        if (!item) {
            return;
        }

        event.preventDefault();

        if (!window.FoodwebCart || typeof window.FoodwebCart.addItem !== "function") {
            window.location.href = "cart.html";
            return;
        }

        result = window.FoodwebCart.addItem({
            productId: item.productId,
            name: item.name,
            sku: item.sku,
            price: item.price,
            image: item.image,
            alt: item.alt,
            stock: item.stock,
            quantity: 1,
            optionLabel: item.optionLabel,
            servingMode: item.servingMode,
            detailsUrl: item.detailsUrl
        });

        if (result && result.ok) {
            flashButtonState(trigger, result.merged ? "Updated In Cart" : "Added To Cart");
        }
    }

    function extractWishlistPayloadFromTrigger(trigger) {
        if (!trigger || !trigger.length) {
            return null;
        }

        if (trigger.is("#product-detail-wishlist-link")) {
            return extractProductDetailsPayload(trigger);
        }

        return extractExplicitPayload(trigger)
            || extractProductCardPayload(trigger.closest(".product-card"))
            || extractReceipePayload(trigger.closest(".receipe-item"));
    }

    function extractExplicitPayload(trigger) {
        var productId = String(trigger.attr("data-wishlist-product-id") || "").trim();

        if (!productId) {
            return null;
        }

        return normalizeWishlistItem({
            productId: productId,
            name: trigger.attr("data-wishlist-name"),
            sku: trigger.attr("data-wishlist-sku"),
            price: trigger.attr("data-wishlist-price"),
            image: trigger.attr("data-wishlist-image"),
            alt: trigger.attr("data-wishlist-alt"),
            detailsUrl: trigger.attr("data-wishlist-details-url"),
            stock: trigger.attr("data-wishlist-stock"),
            optionLabel: trigger.attr("data-wishlist-option"),
            servingMode: trigger.attr("data-wishlist-serving-mode")
        });
    }

    function extractProductDetailsPayload() {
        var cartButton = $("#product-detail-cart-button");
        var productId = String(cartButton.attr("data-cart-product-id") || getQueryParam("product") || slugify($("#product-detail-name").text())).trim();
        var optionLabel = $("#product-detail-serving-options li.active").first().text().replace(/\s+/g, " ").trim() || "Standard Order";

        if (!productId) {
            return null;
        }

        return normalizeWishlistItem({
            productId: productId,
            name: $("#product-detail-name").text(),
            sku: String(cartButton.attr("data-cart-sku") || productId).trim() || productId,
            price: parseCurrencyText($("#product-detail-price").text()),
            image: $(".product-details-for img").first().attr("src"),
            alt: $(".product-details-for img").first().attr("alt") || $("#product-detail-name").text(),
            detailsUrl: buildDetailsUrl(productId),
            stock: cartButton.attr("data-cart-stock"),
            optionLabel: optionLabel,
            servingMode: cartButton.attr("data-cart-serving-mode")
        });
    }

    function extractProductCardPayload(card) {
        var anchor;
        var detailsUrl;
        var productId;
        var price;

        if (!card || !card.length) {
            return null;
        }

        anchor = card.find(".add-to-cart-trigger").first();
        detailsUrl = String(card.find(".product-card-surface").attr("href") || card.find(".product-card-content h3 a").attr("href") || "").trim();
        productId = String(anchor.attr("data-cart-product-id") || card.find(".product-card-surface").attr("data-product-id") || getProductIdFromUrl(detailsUrl) || slugify(card.find(".product-card-content h3").text())).trim();
        price = anchor.attr("data-cart-price");

        if (!productId) {
            return null;
        }

        return normalizeWishlistItem({
            productId: productId,
            name: card.find(".product-card-content h3").first().text(),
            sku: String(anchor.attr("data-cart-sku") || productId).trim() || productId,
            price: price || parseCurrencyText(card.find(".product-price").first().text()),
            image: card.find("img").first().attr("src"),
            alt: card.find("img").first().attr("alt") || card.find(".product-card-content h3").first().text(),
            detailsUrl: detailsUrl || buildDetailsUrl(productId),
            stock: anchor.attr("data-cart-stock"),
            optionLabel: anchor.attr("data-cart-option") || "Standard Order",
            servingMode: anchor.attr("data-cart-serving-mode") || "single"
        });
    }

    function extractReceipePayload(receipeItem) {
        var detailsLink;
        var name;
        var productId;

        if (!receipeItem || !receipeItem.length) {
            return null;
        }

        detailsLink = receipeItem.find(".receipe-info h3 a").first();
        name = detailsLink.text() || receipeItem.find(".receipe-info h3").first().text();
        productId = String(detailsLink.attr("data-product-id") || getProductIdFromUrl(detailsLink.attr("href")) || slugify(name)).trim();

        if (!productId) {
            return null;
        }

        return normalizeWishlistItem({
            productId: productId,
            name: name,
            sku: productId,
            price: parseCurrencyText(receipeItem.find(".receipe-info h4").first().text()),
            image: receipeItem.find("img").first().attr("src"),
            alt: receipeItem.find("img").first().attr("alt") || name,
            detailsUrl: String(detailsLink.attr("href") || buildDetailsUrl(productId)).trim(),
            stock: 0,
            optionLabel: "Standard Order",
            servingMode: "single"
        });
    }

    function flashButtonState(button, label) {
        var originalHtml = button.html();

        button.html(escapeHtml(label));
        window.setTimeout(function () {
            button.html(originalHtml);
        }, 1400);
    }

    function getProductIdFromUrl(url) {
        var safeUrl = String(url || "").trim();
        var match;

        if (!safeUrl) {
            return "";
        }

        match = safeUrl.match(/[?&]product=([^&#]+)/i);
        return match ? decodeURIComponent(match[1]) : "";
    }

    function getQueryParam(name) {
        try {
            return new URLSearchParams(window.location.search).get(name) || "";
        } catch (error) {
            return "";
        }
    }

    function buildDetailsUrl(productId) {
        return "shop-details.html?product=" + encodeURIComponent(String(productId || "").trim());
    }

    function parseCurrencyText(text) {
        var normalized = String(text || "").replace(/,/g, "");
        var match = normalized.match(/-?\d+(?:\.\d+)?/);

        return match ? safeNumber(match[0]) : 0;
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
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function cloneValue(value) {
        return JSON.parse(JSON.stringify(value));
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
