<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $cart            = isset($_POST['cart'])            ? json_decode($_POST['cart'], true) : [];
        $payment_method  = $_POST['payment_method']         ?? 'cash';
        $total_amount    = $_POST['total']                  ?? 0;
        $amount_received = isset($_POST['amount_received']) ? (float)$_POST['amount_received'] : null;
        $change_amount   = isset($_POST['change'])          ? (float)$_POST['change']          : null;
        $cashier_id = isset($_POST['cashier_id']) ? intval($_POST['cashier_id']) : null;

        // Fallback to the first available user ID if no valid cashier_id is provided
        if (empty($cashier_id)) {
            $user_q = $conn->query("SELECT id FROM users LIMIT 1");
            if ($user_row = $user_q->fetch_assoc()) {
                $cashier_id = intval($user_row['id']);
            }
        }

        if (empty($cart)) throw new RuntimeException("Cart is empty or missing");

        $stmt = $conn->prepare(
            "INSERT INTO transactions (cashier_id, total_amount, payment_method, amount_received, change_amount) VALUES (?, ?, ?, ?, ?)"
        );
        if (!$stmt) throw new RuntimeException("Prepare transaction: " . $conn->error);
        $stmt->bind_param("idsdd", $cashier_id, $total_amount, $payment_method, $amount_received, $change_amount);
        if (!$stmt->execute()) throw new RuntimeException("Insert transaction: " . $stmt->error);
        $transaction_id = $conn->insert_id;
        $stmt->close();

        $stmt_item  = $conn->prepare(
            "INSERT INTO transaction_items (transaction_id, product_id, quantity, price_at_sale, cost_at_sale) VALUES (?, ?, ?, ?, ?)"
        );
        if (!$stmt_item) throw new RuntimeException("Prepare item insert: " . $conn->error);

        foreach ($cart as $item) {
            $pid   = intval($item['id']);
            $qty   = intval($item['qty'] ?? 0);
            $price = floatval($item['price']);

            // Insert transaction item
            $cost_q = $conn->query("SELECT cost FROM products WHERE id = $pid");
            $cost = ($r = $cost_q->fetch_assoc()) ? (float)$r['cost'] : 0;
            $stmt_item->bind_param("iiidd", $transaction_id, $pid, $qty, $price, $cost);
            $stmt_item->execute();

            // --- SMART FEFO DEPLETION LOGIC ---
            $p_q = $conn->query("SELECT quantity, new_stock_quantity FROM products WHERE id = $pid");
            $p = $p_q->fetch_assoc();
            $old_q = (int)$p['quantity'];
            $new_q = (int)$p['new_stock_quantity'];

            $take_from_old = min($qty, $old_q);
            $remaining = $qty - $take_from_old;
            $take_from_new = min($remaining, $new_q);

            if ($take_from_old > 0) {
                $conn->query("UPDATE products SET quantity = quantity - $take_from_old WHERE id = $pid");
            }
            if ($take_from_new > 0) {
                $conn->query("UPDATE products SET new_stock_quantity = new_stock_quantity - $take_from_new WHERE id = $pid");
            }

            // --- AUTO-ROTATION: Promote New Stock if Old is 0 ---
            $check_q = $conn->query("SELECT quantity, new_stock_quantity, new_stock_expiry FROM products WHERE id = $pid");
            $c = $check_q->fetch_assoc();
            if ((int)$c['quantity'] <= 0 && (int)$c['new_stock_quantity'] > 0) {
                 $new_qty = (int)$c['new_stock_quantity'];
                 $new_exp = $c['new_stock_expiry'];
                 
                 $conn->query("UPDATE products SET 
                    quantity = $new_qty, 
                    expiry_date = " . ($new_exp ? "'$new_exp'" : "NULL") . ",
                    new_stock_quantity = 0,
                    new_stock_expiry = NULL 
                    WHERE id = $pid");
                 
                 error_log("[AUTO-ROTATE] Product ID $pid promoted from New Stock to Old Stock.");
            }

        }

        echo json_encode(['success' => true, 'id' => $transaction_id]);

    } catch (Exception $e) {
        error_log("[save_transaction.php] " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>
