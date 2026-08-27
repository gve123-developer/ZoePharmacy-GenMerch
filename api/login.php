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
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
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

    // Find user using PostgreSQL PDO
    $stmt = $conn->prepare(
        "SELECT id, username, password_hash, full_name AS name, email
         FROM users
         WHERE username = :username
         LIMIT 1"
    );

    $stmt->execute([
        ':username' => $username
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Verify password
    if ($user && password_verify($password, $user['password_hash'])) {

        // Update last login
        $up_stmt = $conn->prepare(
            "UPDATE users
             SET last_login_at = CURRENT_TIMESTAMP
             WHERE id = :id"
        );

        $up_stmt->execute([
            ':id' => $user['id']
        ]);

        // Successful login
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => (string) $user['id'],
                'username' => $user['username'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => 'admin',
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

} catch (Throwable $e) {

    error_log("[LOGIN] " . $e->getMessage());

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Login error: ' . $e->getMessage()
    ]);
}
?>