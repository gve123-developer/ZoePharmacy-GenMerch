<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { http_response_code(200); exit(); }

function apiError(int $code, string $message, string $debug = ''): void {
    http_response_code($code);
    $payload = ['success' => false, 'message' => $message];
    if ($debug !== '') { $payload['debug'] = $debug; }
    echo json_encode($payload);
    exit;
}

if ($method === 'POST') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data) throw new RuntimeException("Invalid JSON body");

        $productId = (int)($data['productId'] ?? 0);
        $quantity = (int)($data['quantity'] ?? 0);
        $cost = (float)($data['cost'] ?? 0);
        $reason = $data['reason'] ?? 'Expired';

        if (!$productId || !$quantity) {
            throw new RuntimeException("Missing product ID or quantity");
        }

        $stmt = $conn->prepare(
            "INSERT INTO inventory_loss (product_id, quantity, cost_at_loss, reason) VALUES (?, ?, ?, ?)"
        );
        if (!$stmt) throw new RuntimeException("Prepare insert: " . $conn->error);
        $stmt->bind_param("iids", $productId, $quantity, $cost, $reason);

        if (!$stmt->execute()) throw new RuntimeException("Execute insert: " . $stmt->error);
        $stmt->close();

        // Also log this action
        include_once '../includes/audit_logger.php';
        $user = $_SERVER['HTTP_X_USER_NAME'] ?? 'Admin';
        log_action($conn, $user, 'Dispose Product', "Disposed $quantity unit(s) of product ID $productId ($reason)");

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        error_log("[inventory_loss.php POST] " . $e->getMessage());
        apiError(500, 'Failed to save inventory loss', $e->getMessage());
    }
} elseif ($method === 'GET') {
    try {
        $sql = "SELECT l.id, l.product_id, l.quantity, l.cost_at_loss, l.reason, l.loss_date, p.name AS product_name 
                FROM inventory_loss l 
                LEFT JOIN products p ON l.product_id = p.id 
                ORDER BY l.loss_date DESC";
        $result = $conn->query($sql);

        if (!$result) throw new RuntimeException("Query failed: " . $conn->error);

        $losses = [];
        while ($row = $result->fetch_assoc()) {
            $losses[] = [
                'id' => (string)$row['id'],
                'productId' => (string)$row['product_id'],
                'productName' => $row['product_name'] ?? 'Unknown/Deleted Product',
                'quantity' => (int)$row['quantity'],
                'cost' => (float)$row['cost_at_loss'],
                'totalLoss' => (float)($row['quantity'] * $row['cost_at_loss']),
                'date' => str_replace(' ', 'T', $row['loss_date']),
                'reason' => $row['reason']
            ];
        }

        echo json_encode($losses);
    } catch (Exception $e) {
        error_log("[inventory_loss.php GET] " . $e->getMessage());
        apiError(500, 'Failed to get inventory loss', $e->getMessage());
    }
} else {
    apiError(405, 'Method not allowed');
}
?>
