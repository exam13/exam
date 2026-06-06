<?php
/** get_user_info.php — Получить данные текущей сессии (GET). */
require_once 'db.php';

if (isset($_SESSION['user_id'])) {
    $stmt = $pdo->prepare('SELECT id, login, role, fio, phone, email FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if ($user) {
        json_response([
            'success'    => true,
            'user_id'    => $user['id'],
            'login'      => $user['login'],
            'role'       => $user['role'],
            'fio'        => $user['fio'],
            'phone'      => $user['phone'],
            'email'      => $user['email'],
            'csrf_token' => $_SESSION['csrf_token'],
        ]);
    }
}
json_response(['success' => false], 401);
