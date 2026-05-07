document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector(".floating-whatsapp")) {
        return;
    }

    var button = document.createElement("a");
    button.href = "https://wa.me/2349048239391";
    button.className = "floating-whatsapp";
    button.target = "_blank";
    button.rel = "noopener";
    button.setAttribute("aria-label", "Chat us now on WhatsApp");
    button.innerHTML = [
        '<span class="floating-whatsapp-icon"><i class="icofont-brand-whatsapp"></i></span>',
        '<span class="floating-whatsapp-text">Chat Us Now</span>'
    ].join("");

    document.body.appendChild(button);
});
