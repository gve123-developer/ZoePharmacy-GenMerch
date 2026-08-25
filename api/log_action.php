<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';
include '../includes/audit_logger.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data) throw new RuntimeException("Invalid or empty JSON body");

        $user_name = $data['userName'] ?? 'Unknown';
        $action    = $data['action']   ?? 'Unknown Action';
        $details   = $data['details']  ?? '';

        log_action($conn, $user_name, $action, $details);
        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        error_log("[log_action.php] " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to log action', 'debug' => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
