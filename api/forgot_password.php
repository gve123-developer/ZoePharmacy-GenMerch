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


    // =========================================================
    // ACTION 1: REQUEST RESET CODE
    // =========================================================
    if ($action === 'request') {

        $loginInput =
            trim($data['login'] ?? '');

        if ($loginInput === '') {
            throw new RuntimeException(
                "Email or username is required"
            );
        }

        // Find user using either email or username
        $stmt = $conn->prepare(
            "SELECT
                email,
                username,
                full_name
             FROM users
             WHERE email = :email
                OR username = :username
             LIMIT 1"
        );

        $stmt->execute([
            ':email' => $loginInput,
            ':username' => $loginInput
        ]);

        $user =
            $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {

            http_response_code(404);

            echo json_encode([
                'success' => false,
                'message' =>
                    'No user account found with that email or username.'
            ]);

            exit();
        }

        $email = $user['email'];
        $fullName = $user['full_name'];

        // Generate secure 6-digit reset code
        $token = (string)random_int(
            100000,
            999999
        );

        /*
        |--------------------------------------------------------------------------
        | Replace any existing token for this email
        |--------------------------------------------------------------------------
        */

        $conn->beginTransaction();

        try {

            $deleteStmt = $conn->prepare(
                "DELETE FROM password_resets
                 WHERE email = :email"
            );

            $deleteStmt->execute([
                ':email' => $email
            ]);

            $insertStmt = $conn->prepare(
                "INSERT INTO password_resets
                (
                    email,
                    token
                )
                VALUES
                (
                    :email,
                    :token
                )"
            );

            $insertStmt->execute([
                ':email' => $email,
                ':token' => $token
            ]);

            $conn->commit();

        } catch (Throwable $e) {

            if ($conn->inTransaction()) {
                $conn->rollBack();
            }

            throw $e;
        }

        /*
        |--------------------------------------------------------------------------
        | Send reset email
        |--------------------------------------------------------------------------
        */

        include_once __DIR__ . '/../includes/send_email.php';

        send_reset_email(
            $email,
            $fullName,
            $token
        );

        /*
        |--------------------------------------------------------------------------
        | Local debug log
        |--------------------------------------------------------------------------
        */

        $logPath =
            __DIR__ . '/reset_emails.log';

        $logContent =
            "==================================================\n";

        $logContent .=
            "Timestamp: " .
            date('Y-m-d H:i:s') .
            "\n";

        $logContent .=
            "Recipient: $fullName ($email)\n";

        $logContent .=
            "Subject: Zoe Pharmacy POS - Password Reset Code\n";

        $logContent .=
            "Token: $token\n";

        $logContent .=
            "Message: Verification code: $token sent to email.\n";

        $logContent .=
            "==================================================\n\n";

        file_put_contents(
            $logPath,
            $logContent,
            FILE_APPEND
        );

        echo json_encode([
            'success' => true,
            'email' => $email,
            'message' =>
                'Reset code has been sent to your email.'
        ]);

        exit();
    }


    // =========================================================
    // ACTION 2: VERIFY TOKEN AND RESET PASSWORD
    // =========================================================
    elseif ($action === 'reset') {

        $email =
            trim($data['email'] ?? '');

        $token =
            trim($data['token'] ?? '');

        $newPassword =
            $data['password'] ?? '';

        if (
            $email === '' ||
            $token === '' ||
            $newPassword === ''
        ) {
            throw new RuntimeException(
                "Email, reset code, and new password are required"
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Verify reset token
        |--------------------------------------------------------------------------
        */

        $stmt = $conn->prepare(
            "SELECT id
             FROM password_resets
             WHERE email = :email
               AND token = :token
               AND created_at >=
                   CURRENT_TIMESTAMP - INTERVAL '15 minutes'
             ORDER BY created_at DESC
             LIMIT 1"
        );

        $stmt->execute([
            ':email' => $email,
            ':token' => $token
        ]);

        $resetRecord =
            $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$resetRecord) {

            http_response_code(400);

            echo json_encode([
                'success' => false,
                'message' =>
                    'Invalid or expired reset code.'
            ]);

            exit();
        }

        $passwordHash =
            password_hash(
                $newPassword,
                PASSWORD_BCRYPT
            );

        /*
        |--------------------------------------------------------------------------
        | Update password and delete token atomically
        |--------------------------------------------------------------------------
        */

        $conn->beginTransaction();

        try {

            $updateStmt = $conn->prepare(
                "UPDATE users
                 SET
                    password_hash = :password_hash,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE email = :email"
            );

            $updateStmt->execute([
                ':password_hash' => $passwordHash,
                ':email' => $email
            ]);

            if ($updateStmt->rowCount() === 0) {
                throw new RuntimeException(
                    "User account not found"
                );
            }

            $userStmt = $conn->prepare(
                "SELECT username
                 FROM users
                 WHERE email = :email
                 LIMIT 1"
            );

            $userStmt->execute([
                ':email' => $email
            ]);

            $userRow =
                $userStmt->fetch(PDO::FETCH_ASSOC);

            $deleteStmt = $conn->prepare(
                "DELETE FROM password_resets
                 WHERE email = :email"
            );

            $deleteStmt->execute([
                ':email' => $email
            ]);

            $conn->commit();

        } catch (Throwable $e) {

            if ($conn->inTransaction()) {
                $conn->rollBack();
            }

            throw $e;
        }

        echo json_encode([
            'success' => true,
            'username' =>
                $userRow['username'] ?? '',
            'message' =>
                'Password reset successfully!'
        ]);

        exit();
    }


    else {
        throw new RuntimeException(
            "Invalid action"
        );
    }

} catch (Throwable $e) {

    error_log(
        "[forgot_password.php] " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>