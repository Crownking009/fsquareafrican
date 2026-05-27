# F Square African Food Website

Production site for `fsquareafricanfood.com`. The public menu and admin dashboard share one catalog stored in `data/products.json`.

## Local testing with Node

1. Make sure Node.js is installed.
2. From the project root, run `npm start`.
3. Open `http://localhost:3000/admin.html` to manage products.
4. Open `http://localhost:3000/menu.html` to view the live menu.

Admin changes are written to `data/products.json`, so the catalog is shared across refreshes, browser sessions, and devices using the same server.

## Truehost cPanel deployment

1. Upload all project files and folders into the domain document root, usually `public_html`.
2. Keep `.htaccess`, `api/products.php`, and `data/products.json` in the upload. The `.htaccess` file routes `/api/products` to the PHP catalog API for shared hosting.
3. In cPanel File Manager, make sure `data/products.json` is writable by PHP. If saving from the admin fails, set the `data` folder to `755` and `data/products.json` to `664` or use the permission level recommended by Truehost support.
4. Turn on SSL for `https://fsquareafricanfood.com`.
5. Visit `https://fsquareafricanfood.com/api/products`. It should return `{"products":[]}` before products are added.
6. Open `https://fsquareafricanfood.com/admin-login.html` and sign in with the first-time credentials: username `admin`, password `admin1`.
7. Immediately change the password from the Settings panel inside the dashboard.
8. Add products through `https://fsquareafricanfood.com/admin.html`, then confirm they appear on `https://fsquareafricanfood.com/menu.html`.

The live password is stored by the server in `data/admin-settings.json` after first login. Do not delete that file after changing the password unless you intentionally want the login to reset to the first-time credentials.

Products must have an image before they can appear on the public menu. The admin can save products without images as drafts, but active/sold-out products without images are kept off the website.

Products can be sold by portion, unit, piece count, pack, cup, bottle, tray, half/full tray, small/medium/large size, regular/family size, weight, or custom options. Use “Serving Option Extra Prices” to add price differences for larger sizes or extra units.

## Static-only fallback

If the PHP API is unavailable, the admin can fall back to browser storage for testing. Browser-storage changes are not shared across devices and are not suitable for production.

## Structure

- `admin.html` - Admin dashboard for product management
- `admin-login.html` - Admin login screen
- `menu.html` - Public menu page
- `api/products.php` - cPanel-compatible PHP product API
- `api/auth.php` - cPanel-compatible admin login and password API
- `.htaccess` - Apache routing and production headers
- `server.js` - Dependency-free Node server for local testing
- `data/products.json` - Shared catalog file
- `robots.txt` and `sitemap.xml` - Search engine discovery files for `fsquareafricanfood.com`
- `assets/` - Static CSS, JavaScript, images, and fonts

## Notes

- Uploaded admin images are saved into the shared catalog as resized data URLs so they can publish with the product data.
- The production catalog starts empty. Categories remain visible on the menu page until real products are added.
