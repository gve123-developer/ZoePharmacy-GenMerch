<?php
// Verification: Antigravity is connected and syncing to your VS Code!
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function apiError(int $code, string $message, string $debug = ''): void
{
    http_response_code($code);
    $payload = ['success' => false, 'message' => $message];
    if ($debug !== '') {
        $payload['debug'] = $debug;
        error_log("[transactions.php] $message | $debug");
    }
    echo json_encode($payload);
    exit;
}

// ─── GET: Fetch all transactions ──────────────────────────────────────────────
if ($method === 'GET') {
    try {
        $sql = "SELECT t.id, t.transaction_date AS date, t.total_amount AS total,
                       t.payment_method AS paymentMethod, u.full_name AS cashier,
                       t.amount_received AS amountReceived, t.change_amount AS `change`,
                       t.status
                FROM transactions t
                LEFT JOIN users u ON t.cashier_id = u.id
                ORDER BY t.transaction_date DESC";
        $result = $conn->query($sql);
        if (!$result)
            throw new RuntimeException("Fetch transactions: " . $conn->error);

        $transactions = [];
        while ($row = $result->fetch_assoc()) {
            $trans_id = $row['id'];

            $item_sql = "SELECT i.product_id AS productId, p.name AS productName,
                                i.quantity, i.price_at_sale AS price, i.cost_at_sale AS cost
                         FROM transaction_items i
                         LEFT JOIN products p ON i.product_id = p.id
                         WHERE i.transaction_id = $trans_id";
            $item_res = $conn->query($item_sql);
            if (!$item_res)
                throw new RuntimeException("Fetch items for tx $trans_id: " . $conn->error);

            $items = [];
            while ($item_row = $item_res->fetch_assoc()) {
                $items[] = [
                    'productId' => (string) $item_row['productId'],
                    'productName' => $item_row['productName'],
                    'quantity' => (int) $item_row['quantity'],
                    'price' => (float) $item_row['price'],
                    'cost' => (float) $item_row['cost'],
                ];
            }

            $transactions[] = [
                'id' => (string) $row['id'],
                'date' => str_replace(' ', 'T', $row['date']),
                'items' => $items,
                'total' => (float) $row['total'],
                'paymentMethod' => $row['paymentMethod'],
                'cashier' => $row['cashier'] ?? 'Admin',
                'amountReceived' => $row['amountReceived'] !== null ? (float) $row['amountReceived'] : null,
                'change' => $row['change'] !== null ? (float) $row['change'] : null,
                'status' => $row['status'] ?? 'completed',
            ];
        }
        echo json_encode($transactions);

    } catch (Exception $e) {
        apiError(500, 'Failed to fetch transactions', $e->getMessage());
    }
}

// ─── POST: Save new transaction ───────────────────────────────────────────────
elseif ($method === 'POST') {
    try {
        $json = file_get_contents("php://input");
        $data = json_decode($json, true);

        if (!$data) {
            $cart = isset($_POST['cart']) ? json_decode($_POST['cart'], true) : [];
            $payment_method = $_POST['payment_method'] ?? 'cash';
            $total_amount = $_POST['total'] ?? 0;
            $amount_received = $_POST['amount_received'] ?? null;
            $change_amount = $_POST['change'] ?? null;
        } else {
            $cart = $data['cart'] ?? [];
            $payment_method = $data['payment_method'] ?? 'cash';
            $total_amount = $data['total'] ?? 0;
            $amount_received = $data['amount_received'] ?? null;
            $change_amount = $data['change'] ?? null;
        }

        if (empty($cart))
            throw new RuntimeException("Cart is empty");

        $conn->begin_transaction();

        $cashier_id = isset($_POST['cashier_id']) ? intval($_POST['cashier_id']) : ($data['cashier_id'] ?? null);

        // Fallback to the first available user ID if no valid cashier_id is provided
        if (empty($cashier_id)) {
            $user_q = $conn->query("SELECT id FROM users LIMIT 1");
            if ($user_row = $user_q->fetch_assoc()) {
                $cashier_id = intval($user_row['id']);
            }
        }

        $stmt = $conn->prepare("INSERT INTO transactions (cashier_id, total_amount, payment_method, amount_received, change_amount, status) VALUES (?, ?, ?, ?, ?, 'completed')");
        $stmt->bind_param("idsdd", $cashier_id, $total_amount, $payment_method, $amount_received, $change_amount);
        $stmt->execute();
        $transaction_id = $conn->insert_id;
        $stmt->close();

        $stmt_item = $conn->prepare("INSERT INTO transaction_items (transaction_id, product_id, quantity, price_at_sale, cost_at_sale) VALUES (?, ?, ?, ?, ?)");
        $stmt_stock = $conn->prepare("UPDATE products SET quantity = quantity - ? WHERE id = ?");

        foreach ($cart as $item) {
            $pid = intval($item['id'] ?? $item['productId'] ?? 0);
            $qty = intval($item['qty'] ?? $item['quantity'] ?? 0);
            $price = floatval($item['price']);

            $cost_q = $conn->query("SELECT cost FROM products WHERE id = $pid");
            $cost = ($cost_row = $cost_q->fetch_assoc()) ? (float) $cost_row['cost'] : 0;

            $stmt_item->bind_param("iiidd", $transaction_id, $pid, $qty, $price, $cost);
            $stmt_item->execute();

            $stmt_stock->bind_param("ii", $qty, $pid);
            $stmt_stock->execute();
        }

        $conn->commit();
        echo json_encode(['success' => true, 'id' => (string) $transaction_id]);

    } catch (Exception $e) {
        if ($conn->in_transaction)
            $conn->rollback();
        apiError(500, 'Failed to save transaction', $e->getMessage());
    }
}

// ─── PATCH: Void/Refund a transaction ──────────────────────────────────────────
elseif ($method === 'PATCH') {
    try {
        $json = file_get_contents("php://input");
        $data = json_decode($json, true);

        $transaction_id = intval($data['id'] ?? 0);
        $action = $data['action'] ?? '';
        $user_name = $_SERVER['HTTP_X_USER_NAME'] ?? 'Admin';

        if ($transaction_id <= 0 || $action !== 'void')
            throw new RuntimeException("Invalid request");

        $conn->begin_transaction();

        $check_q = $conn->query("SELECT status, total_amount FROM transactions WHERE id = $transaction_id");
        $tx = $check_q->fetch_assoc();
        if (!$tx || $tx['status'] === 'voided')
            throw new RuntimeException("Cannot void this order");

        $conn->query("UPDATE transactions SET status = 'voided' WHERE id = $transaction_id");

        $items_q = $conn->query("SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $transaction_id");
        $restored = [];
        while ($item = $items_q->fetch_assoc()) {
            $pid = $item['product_id'];
            $qty = $item['quantity'];
            $conn->query("UPDATE products SET quantity = quantity + $qty WHERE id = $pid");

            $name_q = $conn->query("SELECT name FROM products WHERE id = $pid");
            $restored[] = (($nr = $name_q->fetch_assoc()) ? $nr['name'] : "ID:$pid") . " x$qty";
        }

        $summary = "Voided #$transaction_id. Sum: ₱" . number_format($tx['total_amount'], 2) . ". Restored items: " . implode(", ", $restored);
        $stmt_log = $conn->prepare("INSERT INTO audit_logs (user_name, action, details) VALUES (?, 'Void Transaction', ?)");
        $stmt_log->bind_param("ss", $user_name, $summary);
        $stmt_log->execute();
        $stmt_log->close();

        $conn->commit();
        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        try {
            $conn->rollback();
        } catch (Exception $re) {
        }
        apiError(500, 'Void failed', $e->getMessage());
    }
} else {
    apiError(405, 'Method not allowed');
}
?>