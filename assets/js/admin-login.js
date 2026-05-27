(function () {
    "use strict";

    var AUTH_API_URL = "/api/auth";
    var form = document.getElementById("admin-login-form");
    var username = document.getElementById("admin-username");
    var password = document.getElementById("admin-password");
    var status = document.getElementById("admin-login-status");
    var submit = document.getElementById("admin-login-submit");

    checkExistingSession();

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        setStatus("Checking details...", "");
        submit.disabled = true;

        try {
            var response = await fetch(AUTH_API_URL, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    action: "login",
                    username: username.value.trim(),
                    password: password.value
                })
            });
            var payload = await response.json().catch(function () {
                return {};
            });

            if (!response.ok || !payload.authenticated) {
                throw new Error(payload.error || "Login failed.");
            }

            setStatus("Login successful. Opening dashboard...", "success");
            window.location.href = "admin.html";
        } catch (error) {
            setStatus(error.message || "Invalid username or password.", "error");
            submit.disabled = false;
        }
    });

    async function checkExistingSession() {
        try {
            var response = await fetch(AUTH_API_URL, {
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });
            var payload = await response.json();
            if (response.ok && payload.authenticated) {
                window.location.href = "admin.html";
            }
        } catch (error) {
            // Keep the form available if the auth endpoint is temporarily unavailable.
        }
    }

    function setStatus(message, type) {
        status.textContent = message;
        status.className = "login-status mb-3" + (type ? " " + type : "");
    }
}());
