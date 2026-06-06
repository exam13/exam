<?php
/**
 * register.php — Регистрация (SPA API).
 * POST: fio, phone, email, login, password → JSON
 */
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$fio      = trim($_POST['fio'] ?? '');
$phone    = trim($_POST['phone'] ?? '');
$email    = trim($_POST['email'] ?? '');
$login    = trim($_POST['login'] ?? '');
$password = $_POST['password'] ?? '';

// --- Валидация ---
if ($fio === '' || $login === '' || $email === '' || $password === '') {
    json_response(['success' => false, 'error' => 'Все обязательные поля должны быть заполнены.']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['success' => false, 'error' => 'Введите корректный Email.']);
}
if (mb_strlen($password) < 8) {
    json_response(['success' => false, 'error' => 'Пароль должен быть не менее 8 символов.']);
}
if (!preg_match('/[A-Za-zА-Яа-яЁё]/u', $password) || !preg_match('/[0-9]/', $password)) {
    json_response(['success' => false, 'error' => 'Пароль должен содержать буквы и цифры.']);
}

// --- Уникальность ---
$stmt = $pdo->prepare('SELECT id FROM users WHERE login = ? OR email = ?');
$stmt->execute([$login, $email]);
if ($stmt->fetch()) {
    json_response(['success' => false, 'error' => 'Логин или Email уже заняты.']);
}

// --- Вставка ---
$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('INSERT INTO users (login, password, role, fio, phone, email) VALUES (?,?,?,?,?,?)');
$stmt->execute([$login, $hash, 'client', $fio, $phone, $email]);

session_regenerate_id(true);
$_SESSION['user_id'] = $pdo->lastInsertId();
$_SESSION['role']    = 'client';
$_SESSION['fio']     = $fio;

json_response([
    'success'    => true,
    'login'      => $login,
    'role'       => 'client',
    'fio'        => $fio,
    'phone'      => $phone,
    'email'      => $email,
    'csrf_token' => $_SESSION['csrf_token'],
]);
