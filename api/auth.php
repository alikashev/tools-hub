<?php

$method = $_SERVER['REQUEST_METHOD'];
$parts = get_route_parts();
$action = $parts[1] ?? null;
$userId = $parts[2] ?? null;

switch ($action) {
    case 'login':
        if ($method !== 'POST') {
            Response::error('Method not allowed', 405);
        }
        $body = get_json_body();
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if ($username === '' || $password === '') {
            Response::validationError(['Username and password are required']);
        }

        $user = Database::fetchOne(
            'SELECT id, username, password_hash, display_name, is_active, is_admin FROM users WHERE username = ? OR email = ?',
            [$username, $username]
        );

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::error('Invalid username or password', 401);
        }

        if (!$user['is_active']) {
            Response::error('Account is disabled', 403);
        }

        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['display_name'] = $user['display_name'] ?: $user['username'];
        $_SESSION['is_admin'] = (bool) $user['is_admin'];
        session_regenerate_id(true);

        Response::success([
            'id' => (int) $user['id'],
            'username' => $user['username'],
            'display_name' => $user['display_name'] ?: $user['username'],
            'is_admin' => (bool) $user['is_admin'],
        ], 'Logged in successfully');
        break;

    case 'logout':
        if ($method !== 'POST') {
            Response::error('Method not allowed', 405);
        }

        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }

        session_destroy();
        Response::success(null, 'Logged out');
        break;

    case 'me':
        if ($method !== 'GET') {
            Response::error('Method not allowed', 405);
        }

        if (empty($_SESSION['user_id'])) {
            Response::error('Not authenticated', 401);
        }

        Response::success([
            'id' => (int) $_SESSION['user_id'],
            'username' => $_SESSION['username'] ?? '',
            'display_name' => $_SESSION['display_name'] ?? '',
            'is_admin' => (bool) ($_SESSION['is_admin'] ?? false),
        ]);
        break;

    case 'register':
        if ($method !== 'POST') {
            Response::error('Method not allowed', 405);
        }

        $count = Database::fetchOne('SELECT COUNT(*) as cnt FROM users');
        if ($count && (int) $count['cnt'] > 0) {
            Response::error('Registration is disabled. A user already exists.', 403);
        }

        $body = get_json_body();
        $username = trim($body['username'] ?? '');
        $email = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        $errors = [];
        if ($username === '') {
            $errors[] = 'Username is required';
        }
        if ($email === '') {
            $errors[] = 'Email is required';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Invalid email format';
        }
        if (strlen($password) < 6) {
            $errors[] = 'Password must be at least 6 characters';
        }
        if ($errors) {
            Response::validationError($errors);
        }

        $existing = Database::fetchOne(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [$username, $email]
        );
        if ($existing) {
            Response::error('Username or email already taken', 409);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $id = Database::insert(
            'INSERT INTO users (username, email, password_hash, display_name, is_active, is_admin) VALUES (?, ?, ?, ?, 1, 1)',
            [$username, $email, $hash, $username]
        );

        $_SESSION['user_id'] = (int) $id;
        $_SESSION['username'] = $username;
        $_SESSION['display_name'] = $username;
        $_SESSION['is_admin'] = true;
        session_regenerate_id(true);

        Response::success([
            'id' => (int) $id,
            'username' => $username,
            'display_name' => $username,
            'is_admin' => true,
        ], 'Account created', 201);
        break;

    // --- Admin-only user management ---

    case 'users':
        if (empty($_SESSION['user_id']) || empty($_SESSION['is_admin'])) {
            Response::error('Forbidden', 403);
        }

        if ($method === 'GET') {
            if ($userId) {
                $user = Database::fetchOne(
                    'SELECT id, username, email, display_name, is_active, is_admin, created_at, updated_at FROM users WHERE id = ?',
                    [$userId]
                );
                if (!$user) {
                    Response::notFound('User not found');
                }
                $user['is_admin'] = (bool) $user['is_admin'];
                $user['is_active'] = (bool) $user['is_active'];
                Response::success($user);
            } else {
                $users = Database::fetchAll(
                    'SELECT id, username, email, display_name, is_active, is_admin, created_at FROM users ORDER BY created_at ASC'
                );
                $users = array_map(function ($u) {
                    $u['is_admin'] = (bool) $u['is_admin'];
                    $u['is_active'] = (bool) $u['is_active'];
                    return $u;
                }, $users);
                Response::success($users);
            }
            break;
        }

        if ($method === 'POST') {
            // Create a user (admin only)
            $body = get_json_body();
            $username = trim($body['username'] ?? '');
            $email = trim($body['email'] ?? '');
            $password = $body['password'] ?? '';
            $isAdmin = !empty($body['is_admin']);

            $errors = [];
            if ($username === '') $errors[] = 'Username is required';
            if ($email === '') $errors[] = 'Email is required';
            elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Invalid email format';
            if (strlen($password) < 6) $errors[] = 'Password must be at least 6 characters';
            if ($errors) Response::validationError($errors);

            $existing = Database::fetchOne('SELECT id FROM users WHERE username = ? OR email = ?', [$username, $email]);
            if ($existing) Response::error('Username or email already taken', 409);

            $hash = password_hash($password, PASSWORD_BCRYPT);
            $id = Database::insert(
                'INSERT INTO users (username, email, password_hash, display_name, is_active, is_admin) VALUES (?, ?, ?, ?, 1, ?)',
                [$username, $email, $hash, $username, $isAdmin ? 1 : 0]
            );

            $created = Database::fetchOne('SELECT id, username, email, display_name, is_active, is_admin, created_at FROM users WHERE id = ?', [$id]);
            $created['is_admin'] = (bool) $created['is_admin'];
            $created['is_active'] = (bool) $created['is_active'];
            Response::created($created, 'User created');
            break;
        }

        if ($method === 'PUT') {
            if (!$userId) {
                Response::error('User ID required', 400);
            }

            $existing = Database::fetchOne('SELECT * FROM users WHERE id = ?', [$userId]);
            if (!$existing) {
                Response::notFound('User not found');
            }

            $body = get_json_body();
            $username = trim($body['username'] ?? $existing['username']);
            $email = trim($body['email'] ?? $existing['email']);
            $password = $body['password'] ?? null;
            $isAdmin = array_key_exists('is_admin', $body) ? !empty($body['is_admin']) : (bool) $existing['is_admin'];
            $isActive = array_key_exists('is_active', $body) ? !empty($body['is_active']) : (bool) $existing['is_active'];

            // Prevent removing your own admin
            if ((int) $userId === (int) $_SESSION['user_id'] && !$isAdmin) {
                Response::error('You cannot remove your own admin status', 403);
            }

            $errors = [];
            if ($username === '') $errors[] = 'Username is required';
            if ($email === '') $errors[] = 'Email is required';
            elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Invalid email format';
            if ($password !== null && strlen($password) < 6) $errors[] = 'Password must be at least 6 characters';
            if ($errors) Response::validationError($errors);

            // Check uniqueness (exclude current user)
            $dup = Database::fetchOne('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', [$username, $email, $userId]);
            if ($dup) Response::error('Username or email already taken', 409);

            if ($password) {
                $hash = password_hash($password, PASSWORD_BCRYPT);
                Database::execute(
                    'UPDATE users SET username = ?, email = ?, password_hash = ?, display_name = ?, is_admin = ?, is_active = ? WHERE id = ?',
                    [$username, $email, $hash, $username, $isAdmin ? 1 : 0, $isActive ? 1 : 0, $userId]
                );
            } else {
                Database::execute(
                    'UPDATE users SET username = ?, email = ?, display_name = ?, is_admin = ?, is_active = ? WHERE id = ?',
                    [$username, $email, $username, $isAdmin ? 1 : 0, $isActive ? 1 : 0, $userId]
                );
            }

            $updated = Database::fetchOne('SELECT id, username, email, display_name, is_active, is_admin, updated_at FROM users WHERE id = ?', [$userId]);
            $updated['is_admin'] = (bool) $updated['is_admin'];
            $updated['is_active'] = (bool) $updated['is_active'];
            Response::success($updated, 'User updated');
            break;
        }

        if ($method === 'DELETE') {
            if (!$userId) {
                Response::error('User ID required', 400);
            }

            if ((int) $userId === (int) $_SESSION['user_id']) {
                Response::error('You cannot delete your own account', 403);
            }

            $existing = Database::fetchOne('SELECT * FROM users WHERE id = ?', [$userId]);
            if (!$existing) {
                Response::notFound('User not found');
            }

            // Prevent deleting the last admin
            if ($existing['is_admin']) {
                $adminCount = Database::fetchOne('SELECT COUNT(*) as cnt FROM users WHERE is_admin = 1');
                if ($adminCount && (int) $adminCount['cnt'] <= 1) {
                    Response::error('Cannot delete the last admin account', 403);
                }
            }

            Database::execute('DELETE FROM users WHERE id = ?', [$userId]);
            Response::success(null, 'User deleted');
            break;
        }

        Response::error('Method not allowed', 405);
        break;

    default:
        Response::notFound('Auth endpoint not found');
}
