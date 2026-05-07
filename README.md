# Foodweb Project

This project is now a static HTML site plus a small Node server that gives `admin.html` and `menu.html` one shared product catalog.

## Run the project

1. Make sure Node.js is installed.
2. From the project root, run `npm start`.
3. Open `http://localhost:3000/admin.html` to manage products.
4. Open `http://localhost:3000/menu.html` to view the live menu.

When the server starts for the first time, it creates `data/products.json` automatically by seeding from the current menu page. After that, admin changes are written to that file, so the catalog is shared across refreshes, browser sessions, and devices using the same project/server.

## GitHub Pages testing

If you deploy this project to GitHub Pages or any other static host, `admin.html` and `menu.html` will still work, but they switch to browser storage mode automatically because static hosting cannot run `server.js` or write to `data/products.json`.

In browser storage mode:

- Admin add/edit/delete still works
- Menu reads the same saved catalog in that browser
- Changes persist across refreshes in the same browser
- Changes are not shared across different browsers, devices, or users
- `data/products.json` is not updated on GitHub Pages

## Structure

- `admin.html` - Admin dashboard for product management
- `menu.html` - Public menu page
- `server.js` - Dependency-free Node server and shared product API
- `data/products.json` - Shared catalog file created automatically on first run
- `assets/` - Static CSS, JavaScript, images, and fonts

## Notes

- If you open the HTML files directly without `npm start`, or deploy to a static host, the admin and menu can fall back to shared browser storage for testing.
- Uploaded admin images are saved into the shared catalog as resized data URLs so they can publish with the product data.
