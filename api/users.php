<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // ─── GET: Fetch All Users ────────────────────────────────────────────────
    if ($method === 'GET') {
        $query = "SELECT id, username, full_name as name, email, last_login_at as lastLogin FROM users";
        $result = $conn->query($query);
        if (!$result) {
            throw new RuntimeException("Database query error: " . $conn->error);
        }

        $users = [];
        while ($row = $result->fetch_assoc()) {
            // Stringify the ID to match frontend User expectations
            $row['id'] = (string)$row['id'];
            // Fill default role 'admin' for UI mapping
            $row['role'] = 'admin';
            $users[] = $row;
        }

        echo json_encode($users);
        exit();
    }

    // ─── POST: CRUD Actions ──────────────────────────────────────────────────
    if ($method === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data) {
            throw new RuntimeException("Invalid JSON body");
        }

        $action = $data['action'] ?? '';

        // Action: ADD USER
        if ($action === 'add') {
            $username = trim($data['username'] ?? '');
            $name = trim($data['name'] ?? '');
            $email = trim($data['email'] ?? '');
            $password = $data['password'] ?? 'password';

            if ($username === '' || $name === '' || $email === '') {
                throw new RuntimeException("Username, Full Name, and Email are required");
            }

            // Check if username already exists
            $check_stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
            $check_stmt->bind_param("s", $username);
            $check_stmt->execute();
            if ($check_stmt->get_result()->fetch_assoc()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Username already exists']);
                exit();
            }
            $check_stmt->close();

            // Check if email already exists
            $email_stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
            $email_stmt->bind_param("s", $email);
            $email_stmt->execute();
            if ($email_stmt->get_result()->fetch_assoc()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Email already exists']);
                exit();
            }
            $email_stmt->close();

            // Hash password
            $passwordHash = password_hash($password, PASSWORD_BCRYPT);

            // Insert user
            $stmt = $conn->prepare("INSERT INTO users (username, password_hash, full_name, email) VALUES (?, ?, ?, ?)");
            if (!$stmt) {
                throw new RuntimeException("Prepare insert error: " . $conn->error);
            }
            $stmt->bind_param("ssss", $username, $passwordHash, $name, $email);
            if (!$stmt->execute()) {
                throw new RuntimeException("Execute insert error: " . $stmt->error);
            }
            $newId = (string)$stmt->insert_id;
            $stmt->close();

            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => $newId,
                    'username' => $username,
                    'name' => $name,
                    'email' => $email,
                    'role' => 'admin',
                    'lastLogin' => null
                ],
                'message' => 'User added successfully'
            ]);
            exit();
        }

        // Action: EDIT USER
        elseif ($action === 'edit') {
            $id = (int)($data['id'] ?? 0);
            $username = trim($data['username'] ?? '');
            $name = trim($data['name'] ?? '');
            $email = trim($data['email'] ?? '');
            $password = $data['password'] ?? '';

            if ($id === 0 || $username === '' || $name === '' || $email === '') {
                throw new RuntimeException("ID, Username, Full Name, and Email are required");
            }

            // Check username duplicate for other users
            $check_stmt = $conn->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
            $check_stmt->bind_param("si", $username, $id);
            $check_stmt->execute();
            if ($check_stmt->get_result()->fetch_assoc()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Username already exists']);
                exit();
            }
            $check_stmt->close();

            // Check email duplicate for other users
            $email_stmt = $conn->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
            $email_stmt->bind_param("si", $email, $id);
            $email_stmt->execute();
            if ($email_stmt->get_result()->fetch_assoc()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Email already exists']);
                exit();
            }
            $email_stmt->close();

            // Perform update
            if ($password !== '') {
                $passwordHash = password_hash($password, PASSWORD_BCRYPT);
                $stmt = $conn->prepare("UPDATE users SET username = ?, full_name = ?, email = ?, password_hash = ? WHERE id = ?");
                $stmt->bind_param("ssssi", $username, $name, $email, $passwordHash, $id);
            } else {
                $stmt = $conn->prepare("UPDATE users SET username = ?, full_name = ?, email = ? WHERE id = ?");
                $stmt->bind_param("sssi", $username, $name, $email, $id);
            }

            if (!$stmt) {
                throw new RuntimeException("Prepare update error: " . $conn->error);
            }
            if (!$stmt->execute()) {
                throw new RuntimeException("Execute update error: " . $stmt->error);
            }
            $stmt->close();

            echo json_encode([
                'success' => true,
                'message' => 'User updated successfully'
            ]);
            exit();
        }

        // Action: DELETE USER
        elseif ($action === 'delete') {
            $id = (int)($data['id'] ?? 0);
            if ($id === 0) {
                throw new RuntimeException("User ID is required for deletion");
            }

            $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
            if (!$stmt) {
                throw new RuntimeException("Prepare delete error: " . $conn->error);
            }
            $stmt->bind_param("i", $id);
            if (!$stmt->execute()) {
                throw new RuntimeException("Execute delete error: " . $stmt->error);
            }
            $stmt->close();

            echo json_encode([
                'success' => true,
                'message' => 'User deleted successfully'
            ]);
            exit();
        }

        else {
            throw new RuntimeException("Invalid action parameter");
        }
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
