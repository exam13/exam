<?php
/** reviews.php — CRUD API для отзывов (GET/POST — публичные, PUT/DELETE — только админ). */
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

// =====================
// GET — Получить список отзывов
// =====================
if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM reviews ORDER BY created_at DESC')->fetchAll();
    json_response($rows);
}

// =====================
// POST — Создать отзыв
// =====================
if ($method === 'POST') {
    // В отличие от админских действий, здесь проверим CSRF-токен, если он передан, либо разрешим публичную отправку
    $text = trim($_POST['text'] ?? '');
    $rating = (int) ($_POST['rating'] ?? 5);

    if (isset($_SESSION['user_id'])) {
        $stmt = $pdo->prepare('SELECT fio FROM users WHERE id = ?');
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        $user_fio = $user ? $user['fio'] : 'Клиент';
    } else {
        $user_fio = trim($_POST['user_fio'] ?? 'Гость');
    }

    if ($user_fio === '') $user_fio = 'Гость';
    if ($text === '') {
        json_response(['success' => false, 'error' => 'Текст отзыва не может быть пустым.']);
    }

    if ($rating < 1 || $rating > 5) $rating = 5;

    $stmt = $pdo->prepare('INSERT INTO reviews (user_fio, rating, text) VALUES (?, ?, ?)');
    $stmt->execute([$user_fio, $rating, $text]);

    json_response(['success' => true, 'id' => $pdo->lastInsertId()]);
}

// Все остальные методы (PUT, DELETE) требуют авторизации админа
require_auth();
if ($_SESSION['role'] !== 'admin') {
    json_response(['success' => false, 'error' => 'Доступ запрещен.'], 403);
}

// =====================
// PUT — Обновить отзыв (Админ)
// =====================
if ($method === 'PUT') {
    csrf_api_check();

    $input = json_decode(file_get_contents('php://input'), true);
    $id = (int) ($input['id'] ?? 0);
    $user_fio = trim($input['user_fio'] ?? '');
    $rating = (int) ($input['rating'] ?? 5);
    $text = trim($input['text'] ?? '');

    if ($id <= 0 || $user_fio === '' || $text === '') {
        json_response(['success' => false, 'error' => 'Некорректные данные для отзыва.']);
    }

    if ($rating < 1 || $rating > 5) $rating = 5;

    $stmt = $pdo->prepare('UPDATE reviews SET user_fio = ?, rating = ?, text = ? WHERE id = ?');
    $stmt->execute([$user_fio, $rating, $text, $id]);

    json_response(['success' => true]);
}

// =====================
// DELETE — Удалить отзыв (Админ)
// =====================
if ($method === 'DELETE') {
    csrf_api_check();

    $input = json_decode(file_get_contents('php://input'), true);
    $id = (int) ($input['id'] ?? 0);

    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Не указан ID отзыва.']);
    }

    $stmt = $pdo->prepare('DELETE FROM reviews WHERE id = ?');
    $stmt->execute([$id]);

    json_response(['success' => true]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
