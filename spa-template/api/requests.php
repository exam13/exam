<?php
/**
 * requests.php — CRUD API для заявок (SPA).
 * GET: получить заявки (клиент — свои, админ — все).
 * POST: создать заявку (только клиент).
 * PUT: изменить статус (только админ).
 */
require_once 'db.php';
require_auth();

$user_id = $_SESSION['user_id'];
$role    = $_SESSION['role'];
$method  = $_SERVER['REQUEST_METHOD'];

// =====================
// GET — Список заявок
// =====================
if ($method === 'GET') {
    if ($role === 'admin') {
        $rows = $pdo->query('
            SELECT r.*, u.fio, u.phone, s.title AS service_title
            FROM requests r
            JOIN users u    ON r.user_id = u.id
            JOIN services s ON r.service_id = s.id
            ORDER BY r.created_at DESC
        ')->fetchAll();
    } else {
        $stmt = $pdo->prepare('
            SELECT r.*, s.title AS service_title, s.price
            FROM requests r
            JOIN services s ON r.service_id = s.id
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
        ');
        $stmt->execute([$user_id]);
        $rows = $stmt->fetchAll();
    }
    json_response(['success' => true, 'data' => $rows]);
}

// =====================
// POST — Создать заявку
// =====================
if ($method === 'POST') {
    csrf_api_check();

    $service_id = (int) ($_POST['service_id'] ?? 0);
    $details    = trim($_POST['details'] ?? '');

    if ($service_id <= 0 || $details === '') {
        json_response(['success' => false, 'error' => 'Заполните все поля.']);
    }

    $stmt = $pdo->prepare('INSERT INTO requests (user_id, service_id, details) VALUES (?,?,?)');
    $stmt->execute([$user_id, $service_id, $details]);

    json_response(['success' => true, 'id' => $pdo->lastInsertId()]);
}

// =====================
// PUT — Обновить статус (Админ)
// =====================
if ($method === 'PUT') {
    csrf_api_check();

    if ($role !== 'admin') {
        json_response(['success' => false, 'error' => 'Доступ запрещен.'], 403);
    }

    $input  = json_decode(file_get_contents('php://input'), true);
    $req_id = (int) ($input['request_id'] ?? 0);
    $status = $input['status'] ?? '';
    $valid  = ['new', 'in_progress', 'completed', 'canceled'];

    if ($req_id <= 0 || !in_array($status, $valid, true)) {
        json_response(['success' => false, 'error' => 'Некорректные данные.']);
    }

    $stmt = $pdo->prepare('UPDATE requests SET status = ? WHERE id = ?');
    $stmt->execute([$status, $req_id]);

    json_response(['success' => true]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
