<?php
/** services.php — CRUD API для услуг (GET — публичный, POST/PUT/DELETE — только админ). */
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

// =====================
// GET — Получить список услуг
// =====================
if ($method === 'GET') {
    $rows = $pdo->query('
        SELECT s.id, s.title, s.price, s.category_id, c.name AS category
        FROM services s JOIN categories c ON s.category_id = c.id
        ORDER BY c.name, s.title
    ')->fetchAll();
    json_response($rows);
}

// Все остальные методы требуют авторизации админа
require_auth();
if ($_SESSION['role'] !== 'admin') {
    json_response(['success' => false, 'error' => 'Доступ запрещен.'], 403);
}

// =====================
// POST — Создать услугу
// =====================
if ($method === 'POST') {
    csrf_api_check();

    $title = trim($_POST['title'] ?? '');
    $price = (float) ($_POST['price'] ?? 0.0);
    $category_name = trim($_POST['category_name'] ?? '');

    if ($title === '' || $price <= 0 || $category_name === '') {
        json_response(['success' => false, 'error' => 'Заполните все поля (название, цена, категория).']);
    }

    // Поиск или создание категории
    $cat_stmt = $pdo->prepare('SELECT id FROM categories WHERE name = ?');
    $cat_stmt->execute([$category_name]);
    $cat = $cat_stmt->fetch();

    if ($cat) {
        $category_id = $cat['id'];
    } else {
        $ins_stmt = $pdo->prepare('INSERT INTO categories (name) VALUES (?)');
        $ins_stmt->execute([$category_name]);
        $category_id = $pdo->lastInsertId();
    }

    $stmt = $pdo->prepare('INSERT INTO services (category_id, title, price) VALUES (?, ?, ?)');
    $stmt->execute([$category_id, $title, $price]);

    json_response(['success' => true, 'id' => $pdo->lastInsertId()]);
}

// =====================
// PUT — Обновить услугу
// =====================
if ($method === 'PUT') {
    csrf_api_check();

    $input = json_decode(file_get_contents('php://input'), true);
    $id = (int) ($input['id'] ?? 0);
    $title = trim($input['title'] ?? '');
    $price = (float) ($input['price'] ?? 0.0);
    $category_name = trim($input['category_name'] ?? '');

    if ($id <= 0 || $title === '' || $price <= 0 || $category_name === '') {
        json_response(['success' => false, 'error' => 'Некорректные данные для обновления услуги.']);
    }

    // Поиск или создание категории
    $cat_stmt = $pdo->prepare('SELECT id FROM categories WHERE name = ?');
    $cat_stmt->execute([$category_name]);
    $cat = $cat_stmt->fetch();

    if ($cat) {
        $category_id = $cat['id'];
    } else {
        $ins_stmt = $pdo->prepare('INSERT INTO categories (name) VALUES (?)');
        $ins_stmt->execute([$category_name]);
        $category_id = $pdo->lastInsertId();
    }

    $stmt = $pdo->prepare('UPDATE services SET category_id = ?, title = ?, price = ? WHERE id = ?');
    $stmt->execute([$category_id, $title, $price, $id]);

    json_response(['success' => true]);
}

// =====================
// DELETE — Удалить услугу
// =====================
if ($method === 'DELETE') {
    csrf_api_check();

    $input = json_decode(file_get_contents('php://input'), true);
    $id = (int) ($input['id'] ?? 0);

    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Не указан ID услуги.']);
    }

    $stmt = $pdo->prepare('DELETE FROM services WHERE id = ?');
    $stmt->execute([$id]);

    json_response(['success' => true]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
