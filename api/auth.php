<?php
declare(strict_types=1);

$dataDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
$settingsFile = $dataDir . DIRECTORY_SEPARATOR . 'admin-settings.json';
$defaultUsername = 'admin';
$defaultPassword = getenv('FSQUARE_ADMIN_PASSWORD') ?: bin2hex(random_bytes(18));

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

session_name('fsquare_admin_session');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

try {
    if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true)) {
        send_json(500, ['error' => 'Settings data directory could not be created.']);
    }

    $settings = ensure_admin_settings($settingsFile, $defaultUsername, $defaultPassword);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        send_json(200, [
            'authenticated' => is_admin_authenticated(),
            'username' => is_admin_authenticated() ? ($settings['username'] ?? $defaultUsername) : '',
        ]);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        send_json(405, ['error' => 'Method not allowed.']);
    }

    $payload = read_json_body();
    $action = clean_string($payload['action'] ?? '');

    if ($action === 'login') {
        $username = clean_string($payload['username'] ?? '');
        $password = (string)($payload['password'] ?? '');

        if (hash_equals((string)$settings['username'], $username) && verify_admin_password($password, $settings)) {
            session_regenerate_id(true);
            $_SESSION['fsquare_admin_authenticated'] = true;
            $_SESSION['fsquare_admin_username'] = $username;
            send_json(200, ['authenticated' => true, 'username' => $username]);
        }

        send_json(401, ['error' => 'Invalid username or password.']);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool)$params['secure'], (bool)$params['httponly']);
        }
        session_destroy();
        send_json(200, ['authenticated' => false]);
    }

    if ($action === 'change-password') {
        require_admin_session();

        $currentPassword = (string)($payload['currentPassword'] ?? '');
        $newPassword = (string)($payload['newPassword'] ?? '');

        if (!verify_admin_password($currentPassword, $settings)) {
            send_json(400, ['error' => 'Current password is incorrect.']);
        }

        if (strlen($newPassword) < 6) {
            send_json(400, ['error' => 'New password must be at least 6 characters.']);
        }

        $settings['passwordHash'] = password_hash($newPassword, PASSWORD_DEFAULT);
        unset($settings['passwordSha256'], $settings['passwordSalt']);
        $settings['updatedAt'] = gmdate('c');
        write_json_file($settingsFile, $settings);
        send_json(200, ['success' => true]);
    }

    send_json(400, ['error' => 'Unknown auth action.']);
} catch (Throwable $error) {
    error_log($error->getMessage());
    send_json(500, ['error' => 'Internal server error.']);
}

function ensure_admin_settings(string $settingsFile, string $defaultUsername, string $defaultPassword): array
{
    if (file_exists($settingsFile)) {
        $payload = json_decode(file_get_contents($settingsFile) ?: '{}', true);
        if (is_array($payload) && !empty($payload['username']) && (!empty($payload['passwordHash']) || (!empty($payload['passwordSha256']) && !empty($payload['passwordSalt'])))) {
            return $payload;
        }
    }

    $settings = [
        'username' => $defaultUsername,
        'passwordHash' => password_hash($defaultPassword, PASSWORD_DEFAULT),
        'createdAt' => gmdate('c'),
        'updatedAt' => gmdate('c'),
    ];
    write_json_file($settingsFile, $settings);
    return $settings;
}

function verify_admin_password(string $password, array $settings): bool
{
    if (!empty($settings['passwordHash']) && password_verify($password, (string)$settings['passwordHash'])) {
        return true;
    }

    if (!empty($settings['passwordSha256']) && !empty($settings['passwordSalt'])) {
        $actualHash = hash('sha256', (string)$settings['passwordSalt'] . $password);
        return hash_equals((string)$settings['passwordSha256'], $actualHash);
    }

    return false;
}

function require_admin_session(): void
{
    if (!is_admin_authenticated()) {
        send_json(401, ['error' => 'Admin login required.']);
    }
}

function is_admin_authenticated(): bool
{
    return !empty($_SESSION['fsquare_admin_authenticated']);
}

function read_json_body(): array
{
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    return is_array($payload) ? $payload : [];
}

function write_json_file(string $file, array $payload): void
{
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($file, $json . PHP_EOL, LOCK_EX) === false) {
        send_json(500, ['error' => 'Settings could not be saved.']);
    }
}

function clean_string($value): string
{
    return trim(preg_replace('/\s+/', ' ', (string)$value) ?? '');
}

function send_json(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}
