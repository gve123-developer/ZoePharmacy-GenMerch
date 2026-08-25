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

    $action = $data['action'] ?? '';

    // ─── ACTION 1: Request Reset Code ──────────────────────────────────────────
    if ($action === 'request') {
        $loginInput = trim($data['login'] ?? ''); // Can be email or username
        if ($loginInput === '') {
            throw new RuntimeException("Email or username is required");
        }

        // Find user by email or username
        $stmt = $conn->prepare("SELECT email, username, full_name FROM users WHERE email = ? OR username = ?");
        if (!$stmt) {
            throw new RuntimeException("Prepare select user: " . $conn->error);
        }
        $stmt->bind_param("ss", $loginInput, $loginInput);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$user) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No user account found with that email or username.']);
            exit();
        }

        $email = $user['email'];
        $fullName = $user['full_name'];

        // Generate a 6-digit reset code
        $token = sprintf("%06d", mt_rand(100000, 999999));

        // Delete any existing codes for this email first
        $del_stmt = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
        $del_stmt->bind_param("s", $email);
        $del_stmt->execute();
        $del_stmt->close();

        // Insert new token
        $ins_stmt = $conn->prepare("INSERT INTO password_resets (email, token) VALUES (?, ?)");
        if (!$ins_stmt) {
            throw new RuntimeException("Prepare insert reset: " . $conn->error);
        }
        $ins_stmt->bind_param("ss", $email, $token);
        if (!$ins_stmt->execute()) {
            throw new RuntimeException("Execute insert reset: " . $ins_stmt->error);
        }
        $ins_stmt->close();

        // Send email using helper
        include_once __DIR__ . '/../includes/send_email.php';
        send_reset_email($email, $fullName, $token);

        // 🟢 LOCAL DEBUG LOG: Always write to a local log file so the user can test easily!
        $logPath = __DIR__ . '/reset_emails.log';
        $logContent = "==================================================\n";
        $logContent .= "Timestamp: " . date('Y-m-d H:i:s') . "\n";
        $logContent .= "Recipient: $fullName ($email)\n";
        $logContent .= "Subject: Zoe Pharmacy POS - Password Reset Code\n";
        $logContent .= "Token: $token\n";
        $logContent .= "Message: Verification code: $token sent to email.\n";
        $logContent .= "==================================================\n\n";
        file_put_contents($logPath, $logContent, FILE_APPEND);

        echo json_encode([
            'success' => true,
            'email' => $email,
            'message' => 'Reset code has been sent to your email.'
        ]);
        exit();
    }

    // ─── ACTION 2: Verify Token & Reset Password ──────────────────────────────
    elseif ($action === 'reset') {
        $email = trim($data['email'] ?? '');
        $token = trim($data['token'] ?? '');
        $newPassword = $data['password'] ?? '';

        if ($email === '' || $token === '' || $newPassword === '') {
            throw new RuntimeException("Email, reset code, and new password are required");
        }

        // Verify token in DB (check if token matches and was created within 15 minutes)
        $stmt = $conn->prepare(
            "SELECT id FROM password_resets 
             WHERE email = ? AND token = ? AND created_at >= NOW() - INTERVAL 15 MINUTE"
        );
        if (!$stmt) {
            throw new RuntimeException("Prepare verify: " . $conn->error);
        }
        $stmt->bind_param("ss", $email, $token);
        $stmt->execute();
        $resetRecord = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$resetRecord) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid or expired reset code.']);
            exit();
        }

        // Hash new password
        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);

        // Update password in DB
        $up_stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
        if (!$up_stmt) {
            throw new RuntimeException("Prepare update: " . $conn->error);
        }
        $up_stmt->bind_param("ss", $passwordHash, $email);
        if (!$up_stmt->execute()) {
            throw new RuntimeException("Execute update: " . $up_stmt->error);
        }
        $up_stmt->close();

        // Get username to return to frontend so they can sync localStorage
        $user_stmt = $conn->prepare("SELECT username FROM users WHERE email = ?");
        $user_stmt->bind_param("s", $email);
        $user_stmt->execute();
        $userRow = $user_stmt->get_result()->fetch_assoc();
        $user_stmt->close();

        // Delete reset token so it cannot be reused
        $del_stmt = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
        $del_stmt->bind_param("s", $email);
        $del_stmt->execute();
        $del_stmt->close();

        echo json_encode([
            'success' => true,
            'username' => $userRow['username'] ?? '',
            'message' => 'Password reset successfully!'
        ]);
        exit();
    } else {
        throw new RuntimeException("Invalid action");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>