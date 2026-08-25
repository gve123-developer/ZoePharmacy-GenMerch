<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

try {
    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data) {
        throw new RuntimeException("Invalid JSON body");
    }

    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if ($username === '' || $password === '') {
        throw new RuntimeException("Username and Password are required");
    }

    // Query user from DB
    $stmt = $conn->prepare("SELECT id, username, password_hash, full_name as name, email FROM users WHERE username = ?");
    if (!$stmt) {
        throw new RuntimeException("Database prepare error: " . $conn->error);
    }
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($user && password_verify($password, $user['password_hash'])) {
        // Success: Update last login time
        $up_stmt = $conn->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?");
        $up_stmt->bind_param("i", $user['id']);
        $up_stmt->execute();
        $up_stmt->close();

        // Return user info (excluding password hash)
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => (string) $user['id'],
                'username' => $user['username'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => 'admin', // Default role mapping
                'lastLogin' => date('Y-m-d H:i:s')
            ],
            'message' => 'Login successful'
        ]);
        exit();
    } else {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Incorrect username or password.'
        ]);
        exit();
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
