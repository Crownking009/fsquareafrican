jQuery(function ($) {
    "use strict";

    var CART_STORAGE_KEY = "foodweb_cart_state_v1";
    var DELIVERY_FEE = 3000;
    var PROMO_CODES = {
        SAVE500: {
            label: "Promo Discount",
            type: "fixed",
            amount: 500
        }
    };
    var state = loadState();

    window.FoodwebCart = {
        addItem: addItem,
        removeItem: removeItem,
        updateQuantity: updateQuantity,
        getState: function () {
            return cloneState(state);
        },
        clear: clearCart
    };

    bindEvents();
    renderAll();

    function bindEvents() {
        $(document).on("click", ".add-to-cart-trigger", handleAddToCartFromMenu);
        $(document).on("click", "#product-detail-cart-button", handleAddToCartFromDetails);
        $(document).on("click", ".productCart", function (e) {
            e.preventDefault();
            renderCartModal();
            openCartModal();
        });
        $(document).on("click", ".cart-modal-close", function (e) {
            e.preventDefault();
            closeCartModal();
        });
        $(document).on("click", ".cart-modal-wrapper", function (e) {
            if ($(e.target).is(".cart-modal-wrapper")) {
                closeCartModal();
            }
        });
        $(document).on("click", ".cart-modal-delete a", handleModalDelete);
        $(document).on("click", ".cart-remove-item", handleCartPageDelete);
        $(document).on("click", "#cart-table-body .qu-btn", handleCartPageQuantityButton);
        $(document).on("change", "#cart-table-body .qu-input", handleCartPageQuantityInput);
        $(document).on("submit", "#cart-coupon-form", handleCouponSubmit);
        $(document).on("click", "#cart-update-button", function (event) {
            event.preventDefault();
            saveState();
            setCartPageStatus("Cart updated successfully.");
        });
        $(document).on("change", "input[name='order-type']", handleOrderTypeChange);
        $(document).on("input", "#delivery-address, #delivery-phone, #delivery-location", handleDeliveryFieldInput);
        $(window).on("storage", function (event) {
            if (event.originalEvent && event.originalEvent.key === CART_STORAGE_KEY) {
                state = loadState();
                renderAll();
            }
        });
        $(document).on("keydown", function (event) {
            if (event.key === "Escape") {
                closeCartModal();
            }
        });
    }

    function openCartModal() {
        $(".cart-modal-wrapper").addClass("active");
        $(".cart-modal").addClass("active");
    }

    function closeCartModal() {
        $(".cart-modal-wrapper").removeClass("active");
        $(".cart-modal").removeClass("active");
    }

    function loadState() {
        try {
            return normalizeState(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "{}"));
        } catch (error) {
            return normalizeState({});
        }
    }

    function normalizeState(rawState) {
        var safeState = rawState || {};
        return {
            items: Array.isArray(safeState.items) ? safeState.items.map(normalizeItem).filter(Boolean) : [],
            orderType: normalizeOrderType(safeState.orderType),
            deliveryAddress: String(safeState.deliveryAddress || "").trim(),
            deliveryPhone: String(safeState.deliveryPhone || "").trim(),
            deliveryLocation: String(safeState.deliveryLocation || "").trim(),
            couponCode: normalizeCouponCode(safeState.couponCode)
        };
    }

    function normalizeItem(item) {
        var safeItem = item || {};
        var productId = String(safeItem.productId || "").trim();
        var sizeLabel = String(safeItem.sizeLabel || safeItem.optionLabel || "Standard Order").trim() || "Standard Order";
        var selectedAddOns = normalizeSelectedAddOns(safeItem.selectedAddOns);
        var optionLabel = buildOptionLabel(sizeLabel, selectedAddOns);

        if (!productId) {
            return null;
        }

        return {
            key: buildItemKey(productId, sizeLabel, selectedAddOns),
            productId: productId,
            name: String(safeItem.name || "Untitled Product").trim() || "Untitled Product",
            sku: String(safeItem.sku || productId).trim() || productId,
            image: String(safeItem.image || "assets/images/product-1.png").trim() || "assets/images/product-1.png",
            alt: String(safeItem.alt || safeItem.name || "Product image").trim() || "Product image",
            detailsUrl: String(safeItem.detailsUrl || ("shop-details.html?product=" + encodeURIComponent(productId))).trim(),
            price: safeNumber(safeItem.price),
            quantity: Math.max(1, Math.round(safeNumber(safeItem.quantity) || 1)),
            stock: Math.max(0, Math.round(safeNumber(safeItem.stock))),
            servingMode: String(safeItem.servingMode || "single").trim() || "single",
            sizeLabel: sizeLabel,
            selectedAddOns: selectedAddOns,
            optionLabel: optionLabel
        };
    }

    function normalizeOrderType(orderType) {
        var safeType = String(orderType || "").trim().toLowerCase();
        return ["takeaway", "dinein", "delivery"].indexOf(safeType) !== -1 ? safeType : "";
    }

    function normalizeCouponCode(couponCode) {
        var code = String(couponCode || "").trim().toUpperCase();
        return PROMO_CODES[code] ? code : "";
    }

    function cloneState(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeSelectedAddOns(selectedAddOns) {
        if (!Array.isArray(selectedAddOns)) {
            return [];
        }

        return selectedAddOns.map(function (entry) {
            return String(entry || "").replace(/\s+/g, " ").trim();
        }).filter(Boolean);
    }

    function buildOptionLabel(sizeLabel, selectedAddOns) {
        var segments = [];
        var normalizedAddOns = normalizeSelectedAddOns(selectedAddOns);

        if (sizeLabel) {
            segments.push("Size: " + sizeLabel);
        }

        if (normalizedAddOns.length) {
            segments.push("Add-ons: " + normalizedAddOns.join(", "));
        }

        return segments.join(" | ") || "Standard Order";
    }

    function buildItemKey(productId, sizeLabel, selectedAddOns) {
        return String(productId || "").trim() + "::" + buildOptionLabel(sizeLabel, selectedAddOns).toLowerCase();
    }

    function saveState() {
        persistStateOnly();
        renderAll();
    }

    function persistStateOnly() {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
        dispatchCartEvent();
    }

    function dispatchCartEvent() {
        document.dispatchEvent(new CustomEvent("foodweb:cart-updated", {
            detail: cloneState(state)
        }));
    }

    function clearCart() {
        state.items = [];
        state.couponCode = "";
        saveState();
    }

    function addItem(item) {
        var normalizedItem = normalizeItem(item);
        var existingItem;

        if (!normalizedItem) {
            return {
                ok: false
            };
        }

        existingItem = state.items.find(function (cartItem) {
            return cartItem.key === normalizedItem.key;
        });

        if (existingItem) {
            existingItem.price = normalizedItem.price;
            existingItem.quantity = clampQuantity(existingItem.quantity + normalizedItem.quantity, existingItem.stock);
            saveState();
            return {
                ok: true,
                merged: true,
                item: existingItem
            };
        }

        normalizedItem.quantity = clampQuantity(normalizedItem.quantity, normalizedItem.stock);
        state.items.push(normalizedItem);
        saveState();
        return {
            ok: true,
            merged: false,
            item: normalizedItem
        };
    }

    function removeItem(itemKey) {
        state.items = state.items.filter(function (item) {
            return item.key !== itemKey;
        });
        saveState();
    }

    function updateQuantity(itemKey, quantity) {
        var item = state.items.find(function (entry) {
            return entry.key === itemKey;
        });

        if (!item) {
            return;
        }

        item.quantity = clampQuantity(quantity, item.stock);
        saveState();
    }

    function clampQuantity(quantity, stock) {
        var safeQuantity = Math.max(1, Math.round(safeNumber(quantity) || 1));
        if (stock > 0) {
            return Math.min(safeQuantity, stock);
        }
        return safeQuantity;
    }

    function getItemCount() {
        return state.items.reduce(function (sum, item) {
            return sum + item.quantity;
        }, 0);
    }

    function calculateTotals() {
        var subtotal = state.items.reduce(function (sum, item) {
            return sum + (item.price * item.quantity);
        }, 0);
        var deliveryFee = state.orderType === "delivery" ? DELIVERY_FEE : 0;
        var discount = getDiscountAmount(subtotal, deliveryFee);
        var total = Math.max(0, subtotal + deliveryFee - discount);

        return {
            subtotal: subtotal,
            deliveryFee: deliveryFee,
            discount: discount,
            total: total
        };
    }

    function getDiscountAmount(subtotal) {
        var coupon = PROMO_CODES[state.couponCode];
        if (!coupon) {
            return 0;
        }

        if (coupon.type === "fixed") {
            return Math.min(subtotal, coupon.amount);
        }

        return 0;
    }

    function isDeliveryComplete() {
        return Boolean(state.deliveryAddress && state.deliveryPhone && state.deliveryLocation);
    }

    function canProceedToCheckout() {
        if (!state.items.length) {
            return false;
        }

        if (!state.orderType) {
            return false;
        }

        if (state.orderType === "delivery") {
            return isDeliveryComplete();
        }

        return true;
    }

    function renderAll() {
        updateCartBadges();
        renderCartModal();
        renderCartPage();
    }

    function updateCartBadges() {
        var count = getItemCount();

        $(".option-badge").text(String(count));
    }

    function renderCartModal() {
        var modal = $(".cart-modal");
        var modalBody = modal.find(".cart-modal-body");
        var totals = calculateTotals();

        if (!modal.length || !modalBody.length) {
            return;
        }

        modal.find(".cart-modal-header h3").text("Cart " + getItemCount());

        if (!state.items.length) {
            modalBody.html([
                '<h2 class="color-white">My Order</h2>',
                '<div class="modal-no-data active">',
                "<h3>No items in cart</h3>",
                '<p class="color-white">Add products from the menu or product details page to get started.</p>',
                "</div>",
                '<div class="cart-modal-button">',
                '<a href="menu.html" class="btn btn-yellow full-width">Browse Menu</a>',
                "</div>"
            ].join(""));
            return;
        }

        modalBody.html([
            '<h2 class="color-white">My Order</h2>',
            state.items.map(buildModalItemMarkup).join(""),
            buildCartModalTotalsMarkup(totals),
            '<div class="cart-modal-button">',
            '<a href="cart.html" class="btn btn-yellow full-width">View Shopping Cart</a>',
            "</div>"
        ].join(""));
    }

    function buildCartModalTotalsMarkup(totals) {
        var lines = ['<div class="cart-modal-summary">'];

        if (totals.deliveryFee > 0) {
            lines.push(
                '<div class="cart-modal-summary-line">',
                "<p>Items Price</p>",
                "<p>" + escapeHtml(formatCurrency(totals.subtotal)) + "</p>",
                "</div>",
                '<div class="cart-modal-summary-line">',
                "<p>Delivery Fee</p>",
                "<p>" + escapeHtml(formatCurrency(totals.deliveryFee)) + "</p>",
                "</div>"
            );
        }

        lines.push(
            '<div class="cart-modal-total">',
            "<p>Total</p>",
            "<h3>" + escapeHtml(formatCurrency(totals.total)) + "</h3>",
            "</div>",
            "</div>"
        );

        return lines.join("");
    }

    function buildModalItemMarkup(item) {
        return [
            '<div class="cart-modal-product">',
            '<div class="cart-modal-thumb">',
            '<a href="', escapeAttribute(item.detailsUrl), '">',
            '<img src="', escapeAttribute(item.image), '" alt="', escapeAttribute(item.alt), '">',
            "</a>",
            "</div>",
            '<div class="cart-modal-content">',
            '<h4><a href="', escapeAttribute(item.detailsUrl), '">', escapeHtml(item.name), "</a></h4>",
            '<span class="cart-modal-option">', escapeHtml("Size: " + item.sizeLabel), "</span>",
            (item.selectedAddOns.length ? '<span class="cart-modal-option">' + escapeHtml("Add-ons: " + item.selectedAddOns.join(", ")) + "</span>" : ""),
            '<div class="cart-modal-action">',
            '<div class="cart-modal-action-item">',
            '<div class="cart-modal-quantity">',
            "<p>", escapeHtml(String(item.quantity)), "</p>",
            "<p>x</p>",
            '<p class="cart-quantity-price">', escapeHtml(formatCurrency(item.price)), "</p>",
            "</div>",
            "</div>",
            '<div class="cart-modal-action-item">',
            '<div class="cart-modal-delete">',
            '<a href="#" data-cart-remove="', escapeAttribute(item.key), '"><i class="icofont-ui-delete"></i></a>',
            "</div>",
            "</div>",
            "</div>",
            "</div>",
            "</div>"
        ].join("");
    }

    function renderCartPage() {
        var tbody = $("#cart-table-body");
        var totals = calculateTotals();
        var checkoutButton = $("#cart-checkout-button");
        var orderTypeInputs = $("input[name='order-type']");
        var deliveryFields = $("#cart-delivery-fields");
        var deliveryAddress = $("#delivery-address");
        var deliveryPhone = $("#delivery-phone");
        var deliveryLocation = $("#delivery-location");
        var couponInput = $("#cart-coupon-input");
        var discountRow = $("#cart-discount-row");

        if (!tbody.length) {
            return;
        }

        if (!state.items.length) {
            tbody.html([
                '<tr><td class="cart-empty-state color-white" colspan="7">',
                "<h3>Your cart is empty</h3>",
                '<p>Add some products from the <a href="menu.html">menu page</a> to continue.</p>',
                "</td></tr>"
            ].join(""));
        } else {
            tbody.html(state.items.map(buildCartTableRow).join(""));
        }

        $("#cart-subtotal").text(formatCurrency(totals.subtotal));
        $("#cart-delivery-fee").text(formatCurrency(totals.deliveryFee));
        $("#cart-total").text(formatCurrency(totals.total));
        $("#cart-discount").text(formatCurrency(totals.discount));
        discountRow.prop("hidden", totals.discount <= 0);

        orderTypeInputs.prop("checked", false).filter("[value='" + escapeSelectorValue(state.orderType) + "']").prop("checked", true);
        deliveryFields.prop("hidden", state.orderType !== "delivery");
        deliveryAddress.val(state.deliveryAddress);
        deliveryPhone.val(state.deliveryPhone);
        deliveryLocation.val(state.deliveryLocation);
        couponInput.val(state.couponCode);

        if (canProceedToCheckout()) {
            checkoutButton.removeClass("disabled").attr("aria-disabled", "false").attr("href", "checkout.html");
        } else {
            checkoutButton.addClass("disabled").attr("aria-disabled", "true").attr("href", "#");
        }

        if (!state.items.length) {
            setCartPageStatus("Add at least one item to proceed to checkout.", true);
        } else if (!state.orderType) {
            setCartPageStatus("Select Take Away, Dine In or Delivery to proceed.", true);
        } else if (state.orderType === "delivery" && !isDeliveryComplete()) {
            setCartPageStatus("Enter delivery address, phone number, and location before checkout.", true);
        } else if (state.orderType === "delivery") {
            setCartPageStatus("Delivery fee of £3,000 has been added to your order.");
        } else {
            setCartPageStatus("Your cart is ready for checkout.");
        }
    }

    function buildCartTableRow(item) {
        var totalPrice = item.price * item.quantity;
        return [
            '<tr data-cart-key="', escapeAttribute(item.key), '">',
            '<td class="cancel"><a href="#" class="cart-remove-item" data-cart-remove="', escapeAttribute(item.key), '"><i class="flaticon-cancel"></i></a></td>',
            "<td>",
            '<div class="product-table-info">',
            '<div class="product-table-thumb"><img src="', escapeAttribute(item.image), '" alt="', escapeAttribute(item.alt), '"></div>',
            "</div>",
            "</td>",
            '<td class="td-product-name">', escapeHtml(item.name), '<span class="cart-line-option">', escapeHtml("Size: " + item.sizeLabel), "</span>", (item.selectedAddOns.length ? '<span class="cart-line-option">' + escapeHtml("Add-ons: " + item.selectedAddOns.join(", ")) + "</span>" : ""), "</td>",
            "<td>", escapeHtml(item.sku), "</td>",
            "<td>", escapeHtml(formatCurrency(item.price)), "</td>",
            "<td>",
            '<div class="cart-quantity">',
            '<button class="qu-btn dec" data-cart-key="', escapeAttribute(item.key), '">-</button>',
            '<input type="text" class="qu-input" data-cart-key="', escapeAttribute(item.key), '" value="', escapeAttribute(String(item.quantity)), '">',
            '<button class="qu-btn inc" data-cart-key="', escapeAttribute(item.key), '">+</button>',
            "</div>",
            "</td>",
            '<td class="td-total-price">', escapeHtml(formatCurrency(totalPrice)), "</td>",
            "</tr>"
        ].join("");
    }

    function handleAddToCartFromMenu(event) {
        event.preventDefault();
        var button = $(event.currentTarget);
        var payload = extractCartPayloadFromElement(button, 1, button.attr("data-cart-option"));
        var result = addItem(payload);

        if (result.ok) {
            flashButtonState(button, result.merged ? "Updated In Cart" : "Added To Cart");
        }
    }

    function handleAddToCartFromDetails(event) {
        var button = $(event.currentTarget);
        var selectedOption = $("#product-detail-serving-options li.active").first().text().trim() || "Standard Order";
        var selectedAddOns = getSelectedAddOnsFromDetails();
        var selectedAddOnLabels = selectedAddOns.map(function (entry) {
            return entry.label;
        });
        var quantityInput = button.closest(".product-quantity").find(".qu-input").first();
        var quantity = quantityInput.length ? quantityInput.val() : 1;
        var unitPrice = calculateSelectedUnitPrice(button, selectedOption, selectedAddOns);
        var payload;
        var result;

        if (button.prop("disabled")) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        payload = extractCartPayloadFromElement(button, quantity, selectedOption, selectedAddOnLabels, unitPrice);
        result = addItem(payload);

        if (result.ok) {
            flashButtonState(button, result.merged ? "Updated In Cart" : "Added To Cart");
        }
    }

    function getSelectedAddOnsFromDetails() {
        return $(".product-addon-checkbox:checked").map(function () {
            var checkbox = $(this);
            var groupName = String(checkbox.attr("data-addon-group") || "Add-on").trim() || "Add-on";
            var optionName = String(checkbox.val() || "").trim();
            return optionName ? {
                label: groupName + ": " + optionName,
                price: Math.max(0, safeNumber(checkbox.attr("data-addon-price")))
            } : null;
        }).get().filter(Boolean);
    }

    function calculateSelectedUnitPrice(element, optionLabel, selectedAddOns) {
        var basePrice = safeNumber(element.attr("data-cart-base-price") || element.attr("data-cart-price"));
        var priceMap = parsePriceMap(element.attr("data-cart-serving-prices"));
        var selectedOption = String(optionLabel || "").replace(/\s+/g, " ").trim();
        var servingPrice = selectedOption ? Math.max(0, safeNumber(priceMap[selectedOption])) : 0;
        var addOnPrice = (Array.isArray(selectedAddOns) ? selectedAddOns : []).reduce(function (sum, entry) {
            return sum + Math.max(0, safeNumber(entry && entry.price));
        }, 0);

        return basePrice + servingPrice + addOnPrice;
    }

    function parsePriceMap(value) {
        try {
            var parsed = JSON.parse(String(value || "{}"));
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function extractCartPayloadFromElement(element, quantity, optionLabel, selectedAddOns, overridePrice) {
        var productId = String(element.attr("data-cart-product-id") || "").trim();
        var fallbackName = String(element.attr("data-cart-name") || "Product").trim() || "Product";
        var selectedSize = String(optionLabel || element.attr("data-cart-option") || "Standard Order").trim() || "Standard Order";
        var chosenAddOns = normalizeSelectedAddOns(selectedAddOns);

        return {
            productId: productId,
            name: fallbackName,
            sku: String(element.attr("data-cart-sku") || productId).trim() || productId,
            price: typeof overridePrice === "number" ? safeNumber(overridePrice) : safeNumber(element.attr("data-cart-price")),
            image: String(element.attr("data-cart-image") || "assets/images/product-1.png").trim() || "assets/images/product-1.png",
            alt: String(element.attr("data-cart-alt") || fallbackName).trim() || fallbackName,
            stock: Math.max(0, Math.round(safeNumber(element.attr("data-cart-stock")))),
            quantity: Math.max(1, Math.round(safeNumber(quantity) || 1)),
            sizeLabel: selectedSize,
            selectedAddOns: chosenAddOns,
            servingMode: String(element.attr("data-cart-serving-mode") || "single").trim() || "single",
            detailsUrl: String(element.attr("data-cart-details-url") || ("shop-details.html?product=" + encodeURIComponent(productId))).trim()
        };
    }

    function flashButtonState(button, label) {
        var originalHtml = button.html();

        button.html(escapeHtml(label));
        window.setTimeout(function () {
            button.html(originalHtml);
        }, 1400);
    }

    function handleModalDelete(event) {
        event.preventDefault();
        removeItem(String($(event.currentTarget).attr("data-cart-remove") || ""));
    }

    function handleCartPageDelete(event) {
        event.preventDefault();
        removeItem(String($(event.currentTarget).attr("data-cart-remove") || ""));
    }

    function handleCartPageQuantityButton(event) {
        event.preventDefault();
        var button = $(event.currentTarget);
        var key = String(button.attr("data-cart-key") || "");
        var item = state.items.find(function (entry) {
            return entry.key === key;
        });
        var nextQuantity;

        if (!item) {
            return;
        }

        nextQuantity = button.hasClass("inc") ? item.quantity + 1 : item.quantity - 1;
        updateQuantity(key, Math.max(1, nextQuantity));
    }

    function handleCartPageQuantityInput(event) {
        var input = $(event.currentTarget);
        var key = String(input.attr("data-cart-key") || "");
        updateQuantity(key, input.val());
    }

    function handleCouponSubmit(event) {
        event.preventDefault();
        var input = $("#cart-coupon-input");
        var code = String(input.val() || "").trim().toUpperCase();

        if (!code) {
            state.couponCode = "";
            saveState();
            setCartPageStatus("Enter a valid coupon code to apply it.", true);
            return;
        }

        if (!PROMO_CODES[code]) {
            setCartPageStatus("That coupon code is not valid.", true);
            return;
        }

        state.couponCode = code;
        saveState();
        setCartPageStatus("Coupon applied successfully.");
    }

    function handleOrderTypeChange(event) {
        state.orderType = normalizeOrderType($(event.currentTarget).val());
        saveState();
    }

    function handleDeliveryFieldInput() {
        state.deliveryAddress = String($("#delivery-address").val() || "").trim();
        state.deliveryPhone = String($("#delivery-phone").val() || "").trim();
        state.deliveryLocation = String($("#delivery-location").val() || "").trim();
        persistStateOnly();
        updateCartPageCheckoutState();
    }

    function setCartPageStatus(message, isError) {
        var note = $("#cart-status-note");

        if (!note.length) {
            return;
        }

        note.text(message || "");
        note.toggleClass("cart-status-note", true);
        note.toggleClass("is-error", Boolean(isError));
    }

    function updateCartPageCheckoutState() {
        var totals = calculateTotals();
        var checkoutButton = $("#cart-checkout-button");

        if (!$("#cart-table-body").length) {
            return;
        }

        $("#cart-delivery-fee").text(formatCurrency(totals.deliveryFee));
        $("#cart-total").text(formatCurrency(totals.total));

        if (canProceedToCheckout()) {
            checkoutButton.removeClass("disabled").attr("aria-disabled", "false").attr("href", "checkout.html");
        } else {
            checkoutButton.addClass("disabled").attr("aria-disabled", "true").attr("href", "#");
        }

        if (!state.items.length) {
            setCartPageStatus("Add at least one item to proceed to checkout.", true);
        } else if (!state.orderType) {
            setCartPageStatus("Select Take Away, Dine In or Delivery to proceed.", true);
        } else if (state.orderType === "delivery" && !isDeliveryComplete()) {
            setCartPageStatus("Enter delivery address, phone number, and location before checkout.", true);
        } else if (state.orderType === "delivery") {
            setCartPageStatus("Delivery fee of £3,000 has been added to your order.");
        } else {
            setCartPageStatus("Your cart is ready for checkout.");
        }
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

    function escapeSelectorValue(value) {
        return String(value || "").replace(/"/g, '\\"');
    }
});
