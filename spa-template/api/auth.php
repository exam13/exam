<?php
/**
 * auth.php — Авторизация (SPA API).
 * POST: login, password → JSON {success, role, fio, email, phone, csrf_token}
 */
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$login    = trim($_POST['login'] ?? '');
$password = $_POST['password'] ?? '';

if ($login === '' || $password === '') {
    json_response(['success' => false, 'error' => 'Заполните все поля.']);
}

$stmt = $pdo->prepare('SELECT * FROM users WHERE login = ?');
$stmt->execute([$login]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    json_response(['success' => false, 'error' => 'Неверный логин или пароль.']);
}

session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];
$_SESSION['role']    = $user['role'];
$_SESSION['fio']     = $user['fio'];

json_response([
    'success'    => true,
    'login'      => $user['login'],
    'role'       => $user['role'],
    'fio'        => $user['fio'],
    'phone'      => $user['phone'],
    'email'      => $user['email'],
    'csrf_token' => $_SESSION['csrf_token'],
]);