<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') { http_response_code(200); exit(); }

if ($method === 'GET') {
    try {
        $sql = "SELECT id, user_name, action, details, created_at
                FROM audit_logs
                ORDER BY id DESC
                LIMIT 500";
        $result = $conn->query($sql);
        if (!$result) throw new RuntimeException("Fetch audit logs: " . $conn->error);

        $logs = [];
        while ($row = $result->fetch_assoc()) {
            $logs[] = [
                'id'        => (string)$row['id'],
                'userName'  => $row['user_name'],
                'action'    => $row['action'],
                'details'   => $row['details'],
                'timestamp' => $row['created_at'],
            ];
        }
        echo json_encode($logs);

    } catch (Exception $e) {
        error_log("[audit_logs.php] " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch audit logs', 'debug' => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
