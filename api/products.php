<?php
declare(strict_types=1);

$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'products.json';
$maxRequestBytes = 25 * 1024 * 1024;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
session_name('fsquare_admin_session');
session_start();

try {
    if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true)) {
        send_json(500, ['error' => 'Catalog data directory could not be created.']);
    }

    if (!file_exists($dataFile)) {
        write_catalog($dataFile, []);
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        send_json(200, ['products' => read_catalog($dataFile)]);
    }

    if ($method === 'PUT' || $method === 'POST') {
        require_admin_session();

        $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength > $maxRequestBytes) {
            send_json(413, ['error' => 'Catalog payload is too large.']);
        }

        $rawBody = file_get_contents('php://input');
        $payload = json_decode($rawBody ?: '', true);
        $products = is_array($payload) && is_list_array($payload)
            ? $payload
            : ($payload['products'] ?? null);

        if (!is_array($products)) {
            send_json(400, ['error' => 'Request body must contain a products array.']);
        }

        $normalizedProducts = array_map('normalize_product', $products);
        write_catalog($dataFile, $normalizedProducts);
        send_json(200, ['products' => $normalizedProducts]);
    }

    header('Allow: GET, PUT, POST');
    send_json(405, ['error' => 'Method not allowed.']);
} catch (Throwable $error) {
    error_log($error->getMessage());
    send_json(500, ['error' => 'Internal server error.']);
}

function read_catalog(string $dataFile): array
{
    $raw = file_get_contents($dataFile);
    $payload = json_decode($raw ?: '[]', true);
    $products = is_array($payload) && is_list_array($payload)
        ? $payload
        : ($payload['products'] ?? []);

    if (!is_array($products)) {
        return [];
    }

    return array_map('normalize_product', $products);
}

function write_catalog(string $dataFile, array $products): void
{
    $json = json_encode($products, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        send_json(500, ['error' => 'Catalog could not be encoded.']);
    }

    $handle = fopen($dataFile, 'c+');
    if (!$handle) {
        send_json(500, ['error' => 'Catalog file could not be opened for writing.']);
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        send_json(500, ['error' => 'Catalog file could not be locked.']);
    }

    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, $json . PHP_EOL);
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
}

function normalize_product($product): array
{
    $safe = is_array($product) ? $product : [];
    $name = clean_string($safe['name'] ?? 'Untitled Product');
    $category = normalize_category($safe['category'] ?? 'Menu');
    $servingMode = clean_string($safe['servingMode'] ?? infer_serving_mode($category));
    $servingOptions = normalize_list($safe['servingOptions'] ?? []);
    $image = clean_string($safe['image'] ?? '');
    $status = normalize_status($safe['status'] ?? 'active');

    if (!$servingOptions) {
        $servingOptions = default_serving_options($servingMode);
    }

    if ($image === '' && ($status === 'active' || $status === 'sold-out')) {
        $status = 'draft';
    }

    return [
        'id' => clean_string($safe['id'] ?? create_id()),
        'name' => $name,
        'category' => $category,
        'price' => safe_number($safe['price'] ?? 0),
        'comparePrice' => safe_number($safe['comparePrice'] ?? 0),
        'stock' => max(0, (int)round(safe_number($safe['stock'] ?? 0))),
        'sku' => clean_string($safe['sku'] ?? ''),
        'status' => $status,
        'featured' => !empty($safe['featured']),
        'description' => clean_string($safe['description'] ?? ''),
        'image' => $image,
        'alt' => clean_string($safe['alt'] ?? $name),
        'tags' => normalize_list($safe['tags'] ?? []),
        'servingMode' => $servingMode,
        'servingOptions' => $servingOptions,
        'servingOptionPrices' => normalize_price_map($safe['servingOptionPrices'] ?? [], $servingOptions),
        'toppings' => normalize_list($safe['toppings'] ?? []),
        'allergens' => normalize_list($safe['allergens'] ?? []),
        'spiceLevel' => clean_string($safe['spiceLevel'] ?? 'medium'),
        'prepTimeMinutes' => max(0, (int)round(safe_number($safe['prepTimeMinutes'] ?? 20))),
        'customizationGroups' => is_array($safe['customizationGroups'] ?? null) ? $safe['customizationGroups'] : [],
        'createdAt' => clean_string($safe['createdAt'] ?? gmdate('c')),
        'updatedAt' => clean_string($safe['updatedAt'] ?? gmdate('c')),
    ];
}

function normalize_list($value): array
{
    $items = is_array($value) ? $value : explode(',', (string)$value);
    $cleaned = [];

    foreach ($items as $item) {
        $text = clean_string((string)$item);
        if ($text !== '') {
            $cleaned[] = $text;
        }
    }

    return array_values(array_unique($cleaned));
}

function normalize_price_map($value, array $options): array
{
    $result = [];

    if (is_array($value)) {
        foreach ($value as $key => $price) {
            $label = is_int($key) ? ($options[$key] ?? '') : clean_string((string)$key);
            if ($label !== '' && in_array($label, $options, true)) {
                $result[$label] = max(0, safe_number($price));
            }
        }
    }

    foreach ($options as $option) {
        if (!array_key_exists($option, $result)) {
            $result[$option] = 0;
        }
    }

    return $result;
}

function normalize_category($category): string
{
    $text = clean_string((string)$category);
    $key = strtolower($text);
    $aliases = [
        'rice' => 'Rice Dishes',
        'combo' => 'Combo Meal',
        'combo meals' => 'Combo Meal',
        'small chop' => 'Small Chops',
        'pepper soup' => 'Pepper Soups',
        'traditional snack' => 'Traditional Snacks',
        'traditional treat' => 'Traditional Treats',
        'sides & extra' => 'Sides and Extra',
    ];

    if (isset($aliases[$key])) {
        return $aliases[$key];
    }

    return ucwords(strtolower($text ?: 'Menu'));
}

function infer_serving_mode(string $category): string
{
    $map = [
        'Combo Meal' => 'plate',
        'Pepper Soups' => 'bowl',
        'Proteins' => 'piece',
        'Small Chops' => 'pack',
        'Traditional Snacks' => 'pack',
        'Traditional Treats' => 'pack',
        'Local Beverages' => 'bottle',
        'Alcohol' => 'bottle',
        'Nigerian Refreshments' => 'bottle',
        'Catering' => 'half-full-tray',
    ];

    return $map[$category] ?? 'portion';
}

function default_serving_options(string $mode): array
{
    $map = [
        'single' => ['Standard Order'],
        'unit' => ['1 Unit'],
        'portion' => ['Portion'],
        'half-full-portion' => ['Half Portion', 'Full Portion'],
        'plate' => ['Plate'],
        'bowl' => ['Bowl'],
        'piece' => ['1 Piece'],
        'piece-count' => ['1 Piece', '2 Pieces', '4 Pieces'],
        'pack' => ['Pack'],
        'cup' => ['Cup'],
        'bottle' => ['Bottle'],
        'tray' => ['Tray'],
        'half-full-tray' => ['Half Tray', 'Full Tray'],
        'small-medium-large' => ['Small', 'Medium', 'Large'],
        'small-large' => ['Small', 'Large'],
        'regular-large' => ['Regular', 'Large'],
        'family-size' => ['Regular', 'Family Size'],
        'weight' => ['500g', '1kg'],
        'custom' => ['Custom Order'],
    ];

    return $map[$mode] ?? ['Standard Order'];
}

function normalize_status($status): string
{
    $value = strtolower(clean_string((string)$status));
    return in_array($value, ['active', 'sold-out', 'draft', 'archived'], true) ? $value : 'active';
}

function is_list_array(array $value): bool
{
    if ($value === []) {
        return true;
    }

    return array_keys($value) === range(0, count($value) - 1);
}

function require_admin_session(): void
{
    if (empty($_SESSION['fsquare_admin_authenticated'])) {
        send_json(401, ['error' => 'Admin login required.']);
    }
}

function safe_number($value): float
{
    return is_numeric($value) ? (float)$value : 0.0;
}

function clean_string($value): string
{
    return trim(preg_replace('/\s+/', ' ', (string)$value) ?? '');
}

function create_id(): string
{
    return 'prod-' . bin2hex(random_bytes(6));
}

function send_json(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}
