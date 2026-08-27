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

    // =========================================================
    // GET: Fetch all users
    // =========================================================
    if ($method === 'GET') {

        $stmt = $conn->query(
            "SELECT
                id,
                username,
                full_name AS name,
                email,
                last_login_at AS last_login
             FROM users
             ORDER BY id"
        );

        $users = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $users[] = [
                'id' => (string)$row['id'],
                'username' => $row['username'],
                'name' => $row['name'],
                'email' => $row['email'],
                'role' => 'admin',
                'lastLogin' => $row['last_login']
            ];
        }

        echo json_encode($users);
        exit();
    }


    // =========================================================
    // POST: CRUD actions
    // =========================================================
    if ($method === 'POST') {

        $data = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (!is_array($data)) {
            throw new RuntimeException(
                "Invalid JSON body"
            );
        }

        $action = $data['action'] ?? '';


        // =====================================================
        // ADD USER
        // =====================================================
        if ($action === 'add') {

            $username =
                trim($data['username'] ?? '');

            $name =
                trim($data['name'] ?? '');

            $email =
                trim($data['email'] ?? '');

            $password =
                $data['password'] ?? 'password';

            if (
                $username === '' ||
                $name === '' ||
                $email === ''
            ) {
                throw new RuntimeException(
                    "Username, Full Name, and Email are required"
                );
            }

            // Check duplicate username
            $checkStmt = $conn->prepare(
                "SELECT id
                 FROM users
                 WHERE username = :username
                 LIMIT 1"
            );

            $checkStmt->execute([
                ':username' => $username
            ]);

            if ($checkStmt->fetch(PDO::FETCH_ASSOC)) {

                http_response_code(400);

                echo json_encode([
                    'success' => false,
                    'message' => 'Username already exists'
                ]);

                exit();
            }

            // Check duplicate email
            $emailStmt = $conn->prepare(
                "SELECT id
                 FROM users
                 WHERE email = :email
                 LIMIT 1"
            );

            $emailStmt->execute([
                ':email' => $email
            ]);

            if ($emailStmt->fetch(PDO::FETCH_ASSOC)) {

                http_response_code(400);

                echo json_encode([
                    'success' => false,
                    'message' => 'Email already exists'
                ]);

                exit();
            }

            $passwordHash =
                password_hash(
                    $password,
                    PASSWORD_BCRYPT
                );

            $stmt = $conn->prepare(
                "INSERT INTO users
                (
                    username,
                    password_hash,
                    full_name,
                    email
                )
                VALUES
                (
                    :username,
                    :password_hash,
                    :full_name,
                    :email
                )
                RETURNING id"
            );

            $stmt->execute([
                ':username' => $username,
                ':password_hash' => $passwordHash,
                ':full_name' => $name,
                ':email' => $email
            ]);

            $newId = $stmt->fetchColumn();

            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => (string)$newId,
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


        // =====================================================
        // EDIT USER
        // =====================================================
        elseif ($action === 'edit') {

            $id =
                (int)($data['id'] ?? 0);

            $username =
                trim($data['username'] ?? '');

            $name =
                trim($data['name'] ?? '');

            $email =
                trim($data['email'] ?? '');

            $password =
                $data['password'] ?? '';

            if (
                $id <= 0 ||
                $username === '' ||
                $name === '' ||
                $email === ''
            ) {
                throw new RuntimeException(
                    "ID, Username, Full Name, and Email are required"
                );
            }

            // Check duplicate username on another user
            $checkStmt = $conn->prepare(
                "SELECT id
                 FROM users
                 WHERE username = :username
                   AND id <> :id
                 LIMIT 1"
            );

            $checkStmt->execute([
                ':username' => $username,
                ':id' => $id
            ]);

            if ($checkStmt->fetch(PDO::FETCH_ASSOC)) {

                http_response_code(400);

                echo json_encode([
                    'success' => false,
                    'message' => 'Username already exists'
                ]);

                exit();
            }

            // Check duplicate email
            $emailStmt = $conn->prepare(
                "SELECT id
                 FROM users
                 WHERE email = :email
                   AND id <> :id
                 LIMIT 1"
            );

            $emailStmt->execute([
                ':email' => $email,
                ':id' => $id
            ]);

            if ($emailStmt->fetch(PDO::FETCH_ASSOC)) {

                http_response_code(400);

                echo json_encode([
                    'success' => false,
                    'message' => 'Email already exists'
                ]);

                exit();
            }

            if ($password !== '') {

                $passwordHash =
                    password_hash(
                        $password,
                        PASSWORD_BCRYPT
                    );

                $stmt = $conn->prepare(
                    "UPDATE users
                     SET
                        username = :username,
                        full_name = :full_name,
                        email = :email,
                        password_hash = :password_hash,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = :id"
                );

                $stmt->execute([
                    ':username' => $username,
                    ':full_name' => $name,
                    ':email' => $email,
                    ':password_hash' => $passwordHash,
                    ':id' => $id
                ]);

            } else {

                $stmt = $conn->prepare(
                    "UPDATE users
                     SET
                        username = :username,
                        full_name = :full_name,
                        email = :email,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = :id"
                );

                $stmt->execute([
                    ':username' => $username,
                    ':full_name' => $name,
                    ':email' => $email,
                    ':id' => $id
                ]);
            }

            echo json_encode([
                'success' => true,
                'message' => 'User updated successfully'
            ]);

            exit();
        }


        // =====================================================
        // DELETE USER
        // =====================================================
        elseif ($action === 'delete') {

            $id =
                (int)($data['id'] ?? 0);

            if ($id <= 0) {
                throw new RuntimeException(
                    "User ID is required for deletion"
                );
            }

            $stmt = $conn->prepare(
                "DELETE FROM users
                 WHERE id = :id"
            );

            $stmt->execute([
                ':id' => $id
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'User deleted successfully'
            ]);

            exit();
        }


        else {
            throw new RuntimeException(
                "Invalid action parameter"
            );
        }
    }


    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);

} catch (Throwable $e) {

    error_log(
        "[users.php] " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>