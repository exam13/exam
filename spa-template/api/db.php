<?php
/**
 * db.php — PDO-подключение для SPA API.
 * Безопасные сессии, CSRF, XSS-утилиты.
 */

ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_samesite', 'Strict');
if (!session_id()) session_start();

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

$DB_HOST = '127.0.0.1';
$DB_NAME = 'exam_project';
$DB_USER = 'root';
$DB_PASS = '';

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER, $DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'DB connection error']);
    exit;
}

/** Отправить JSON-ответ и завершить скрипт. */
function json_response(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Проверить CSRF-токен из заголовка X-CSRF-Token. */
function csrf_api_check(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($token) || !hash_equals($_SESSION['csrf_token'], $token)) {
        json_response(['success' => false, 'error' => 'Invalid CSRF token'], 403);
    }
}

/** Проверить что пользователь залогинен. */
function require_auth(): void {
    if (empty($_SESSION['user_id'])) {
        json_response(['success' => false, 'error' => 'Not authenticated'], 401);
    }
}