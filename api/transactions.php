<?php

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

    $payload = [
        'success' => false,
        'message' => $message
    ];

    if ($debug !== '') {
        $payload['debug'] = $debug;
        error_log("[transactions.php] $message | $debug");
    }

    echo json_encode($payload);
    exit();
}


// ============================================================
// GET: Fetch all transactions
// ============================================================
if ($method === 'GET') {

    try {

        $stmt = $conn->query(
            "SELECT
                t.id,
                t.transaction_date AS date,
                t.total_amount AS total,
                t.payment_method AS payment_method,
                u.full_name AS cashier,
                t.amount_received AS amount_received,
                t.change_amount AS change_amount,
                t.status
             FROM transactions t
             LEFT JOIN users u
                ON t.cashier_id = u.id
             ORDER BY t.transaction_date DESC"
        );

        $transactions = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $itemStmt = $conn->prepare(
                "SELECT
                    i.product_id,
                    p.name AS product_name,
                    i.quantity,
                    i.price_at_sale,
                    i.cost_at_sale
                 FROM transaction_items i
                 LEFT JOIN products p
                    ON i.product_id = p.id
                 WHERE i.transaction_id = :transaction_id
                 ORDER BY i.id"
            );

            $itemStmt->execute([
                ':transaction_id' => $row['id']
            ]);

            $items = [];

            while ($item = $itemStmt->fetch(PDO::FETCH_ASSOC)) {

                $items[] = [
                    'productId' => (string)$item['product_id'],
                    'productName' => $item['product_name'] ?? 'Unknown Product',
                    'quantity' => (int)$item['quantity'],
                    'price' => (float)$item['price_at_sale'],
                    'cost' => (float)$item['cost_at_sale']
                ];
            }

            $transactions[] = [
                'id' => (string)$row['id'],
                'date' => str_replace(' ', 'T', $row['date']),
                'items' => $items,
                'total' => (float)$row['total'],
                'paymentMethod' => $row['payment_method'],
                'cashier' => $row['cashier'] ?? 'Zoe Owner',
                'amountReceived' =>
                    $row['amount_received'] !== null
                    ? (float)$row['amount_received']
                    : null,
                'change' =>
                    $row['change_amount'] !== null
                    ? (float)$row['change_amount']
                    : null,
                'status' => $row['status'] ?? 'completed'
            ];
        }

        echo json_encode($transactions);

    } catch (Throwable $e) {

        apiError(
            500,
            'Failed to fetch transactions',
            $e->getMessage()
        );
    }
}


// ============================================================
// POST: Save new transaction
// ============================================================
elseif ($method === 'POST') {

    try {

        $json = file_get_contents("php://input");
        $data = json_decode($json, true);

        if (!is_array($data)) {

            $cart =
                isset($_POST['cart'])
                ? json_decode($_POST['cart'], true)
                : [];

            $payment_method =
                $_POST['payment_method']
                ?? 'cash';

            $total_amount =
                (float)($_POST['total'] ?? 0);

            $amount_received =
                isset($_POST['amount_received'])
                ? (float)$_POST['amount_received']
                : null;

            $change_amount =
                isset($_POST['change'])
                ? (float)$_POST['change']
                : null;

            $cashier_id =
                isset($_POST['cashier_id'])
                ? (int)$_POST['cashier_id']
                : null;

        } else {

            $cart = $data['cart'] ?? [];

            $payment_method =
                $data['payment_method']
                ?? $data['paymentMethod']
                ?? 'cash';

            $total_amount =
                (float)($data['total'] ?? 0);

            $amount_received =
                isset($data['amount_received'])
                ? (float)$data['amount_received']
                : (
                    isset($data['amountReceived'])
                    ? (float)$data['amountReceived']
                    : null
                );

            $change_amount =
                isset($data['change'])
                ? (float)$data['change']
                : null;

            $cashier_id =
                isset($data['cashier_id'])
                ? (int)$data['cashier_id']
                : (
                    isset($data['cashierId'])
                    ? (int)$data['cashierId']
                    : null
                );
        }

        if (!is_array($cart) || empty($cart)) {
            throw new RuntimeException("Cart is empty");
        }

        $conn->beginTransaction();

        // Fallback user
        if (!$cashier_id) {

            $userStmt = $conn->query(
                "SELECT id
                 FROM users
                 ORDER BY id
                 LIMIT 1"
            );

            $cashier_id = $userStmt->fetchColumn();

            if (!$cashier_id) {
                throw new RuntimeException(
                    "No user available for cashier"
                );
            }
        }

        // Create transaction
        $transactionStmt = $conn->prepare(
            "INSERT INTO transactions
            (
                cashier_id,
                total_amount,
                payment_method,
                amount_received,
                change_amount,
                status
            )
            VALUES
            (
                :cashier_id,
                :total_amount,
                :payment_method,
                :amount_received,
                :change_amount,
                'completed'
            )
            RETURNING id"
        );

        $transactionStmt->execute([
            ':cashier_id' => $cashier_id,
            ':total_amount' => $total_amount,
            ':payment_method' => $payment_method,
            ':amount_received' => $amount_received,
            ':change_amount' => $change_amount
        ]);

        $transaction_id =
            $transactionStmt->fetchColumn();

        $productStmt = $conn->prepare(
            "SELECT
                id,
                quantity,
                cost
             FROM products
             WHERE id = :id
             FOR UPDATE"
        );

        $itemStmt = $conn->prepare(
            "INSERT INTO transaction_items
            (
                transaction_id,
                product_id,
                quantity,
                price_at_sale,
                cost_at_sale
            )
            VALUES
            (
                :transaction_id,
                :product_id,
                :quantity,
                :price_at_sale,
                :cost_at_sale
            )"
        );

        $stockStmt = $conn->prepare(
            "UPDATE products
             SET
                quantity = quantity - :quantity,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = :product_id"
        );

        foreach ($cart as $item) {

            $pid = (int)(
                $item['id']
                ?? $item['productId']
                ?? 0
            );

            $qty = (int)(
                $item['qty']
                ?? $item['quantity']
                ?? 0
            );

            $price = (float)(
                $item['price']
                ?? 0
            );

            if ($pid <= 0 || $qty <= 0) {
                throw new RuntimeException(
                    "Invalid product or quantity in cart"
                );
            }

            $productStmt->execute([
                ':id' => $pid
            ]);

            $product =
                $productStmt->fetch(PDO::FETCH_ASSOC);

            if (!$product) {
                throw new RuntimeException(
                    "Product ID $pid not found"
                );
            }

            if ((int)$product['quantity'] < $qty) {
                throw new RuntimeException(
                    "Insufficient stock for product ID $pid"
                );
            }

            $cost = (float)$product['cost'];

            $itemStmt->execute([
                ':transaction_id' => $transaction_id,
                ':product_id' => $pid,
                ':quantity' => $qty,
                ':price_at_sale' => $price,
                ':cost_at_sale' => $cost
            ]);

            $stockStmt->execute([
                ':quantity' => $qty,
                ':product_id' => $pid
            ]);
        }

        $conn->commit();

        echo json_encode([
            'success' => true,
            'id' => (string)$transaction_id
        ]);

    } catch (Throwable $e) {

        if (
            isset($conn) &&
            $conn instanceof PDO &&
            $conn->inTransaction()
        ) {
            $conn->rollBack();
        }

        apiError(
            500,
            'Failed to save transaction',
            $e->getMessage()
        );
    }
}


// ============================================================
// PATCH: Void/refund transaction
// ============================================================
elseif ($method === 'PATCH') {

    try {

        $json = file_get_contents("php://input");
        $data = json_decode($json, true);

        if (!is_array($data)) {
            throw new RuntimeException(
                "Invalid JSON body"
            );
        }

        $transaction_id =
            (int)($data['id'] ?? 0);

        $action =
            $data['action'] ?? '';

        $user_name =
            $_SERVER['HTTP_X_USER_NAME']
            ?? 'Admin';

        if (
            $transaction_id <= 0 ||
            $action !== 'void'
        ) {
            throw new RuntimeException(
                "Invalid request"
            );
        }

        $conn->beginTransaction();

        // Lock transaction
        $checkStmt = $conn->prepare(
            "SELECT
                status,
                total_amount
             FROM transactions
             WHERE id = :id
             FOR UPDATE"
        );

        $checkStmt->execute([
            ':id' => $transaction_id
        ]);

        $tx =
            $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$tx) {
            throw new RuntimeException(
                "Transaction not found"
            );
        }

        if ($tx['status'] === 'voided') {
            throw new RuntimeException(
                "Cannot void this order"
            );
        }

        // Check if item-level partial void was requested
        $itemsToVoid = $data['itemsToVoid'] ?? null;
        $isFullVoidExplicit = $data['isFullVoid'] ?? null;

        // Fetch all existing transaction items
        $itemsStmt = $conn->prepare(
            "SELECT
                ti.id AS item_id,
                ti.product_id,
                ti.quantity,
                ti.price_at_sale,
                p.name
             FROM transaction_items ti
             LEFT JOIN products p
                ON ti.product_id = p.id
             WHERE ti.transaction_id = :transaction_id
             FOR UPDATE"
        );

        $itemsStmt->execute([
            ':transaction_id' => $transaction_id
        ]);

        $existingItems = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($existingItems)) {
            // No items left, mark voided
            $voidStmt = $conn->prepare("UPDATE transactions SET status = 'voided', total_amount = 0 WHERE id = :id");
            $voidStmt->execute([':id' => $transaction_id]);
            $conn->commit();
            echo json_encode(['success' => true, 'type' => 'full']);
            exit();
        }

        $restoreStmt = $conn->prepare(
            "UPDATE products
             SET
                quantity = quantity + :quantity,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = :product_id"
        );

        // Determine if this is a Full Void or Partial Void
        $shouldFullVoid = ($isFullVoidExplicit === true) || !is_array($itemsToVoid) || empty($itemsToVoid) || count($itemsToVoid) >= count($existingItems);

        // If itemsToVoid is specified, double-check if all existing items are included
        if (!$shouldFullVoid && is_array($itemsToVoid)) {
            $toVoidPids = array_map(function($it) { return (string)($it['productId'] ?? ''); }, $itemsToVoid);
            $existingPids = array_map(function($it) { return (string)$it['product_id']; }, $existingItems);
            $diff = array_diff($existingPids, $toVoidPids);
            if (empty($diff)) {
                $shouldFullVoid = true;
            }
        }

        if ($shouldFullVoid) {
            // FULL VOID: Cancel entire transaction
            $voidStmt = $conn->prepare(
                "UPDATE transactions
                 SET status = 'voided'
                 WHERE id = :id"
            );
            $voidStmt->execute([':id' => $transaction_id]);

            $restored = [];
            foreach ($existingItems as $item) {
                $restoreStmt->execute([
                    ':quantity' => (int)$item['quantity'],
                    ':product_id' => (int)$item['product_id']
                ]);

                $productName = $item['name'] ?? "ID:{$item['product_id']}";
                $restored[] = $productName . " x" . $item['quantity'];
            }

            $summary = "Voided Transaction #$transaction_id (Full Void). Sum: ₱" .
                number_format((float)$tx['total_amount'], 2) .
                ". Restored items: " . implode(", ", $restored);

            $logStmt = $conn->prepare(
                "INSERT INTO audit_logs (user_name, action, details)
                 VALUES (:user_name, 'Void Transaction', :details)"
            );
            $logStmt->execute([
                ':user_name' => $user_name,
                ':details' => $summary
            ]);

            $conn->commit();

            echo json_encode([
                'success' => true,
                'type' => 'full',
                'id' => (string)$transaction_id
            ]);
            exit();

        } else {
            // PARTIAL VOID: Void only selected items
            $totalRefund = 0.0;
            $restored = [];

            // Prepare statements for updating/deleting transaction_items
            $deleteItemStmt = $conn->prepare("DELETE FROM transaction_items WHERE id = :item_id");
            $updateItemQtyStmt = $conn->prepare("UPDATE transaction_items SET quantity = quantity - :void_qty WHERE id = :item_id");

            // Index existing items by product_id
            $existingByPid = [];
            foreach ($existingItems as $row) {
                $existingByPid[(string)$row['product_id']] = $row;
            }

            foreach ($itemsToVoid as $voidReq) {
                $vPid = (string)($voidReq['productId'] ?? '');
                if (!isset($existingByPid[$vPid])) {
                    continue;
                }

                $matchedItem = $existingByPid[$vPid];
                $reqQty = isset($voidReq['quantity']) ? (int)$voidReq['quantity'] : (int)$matchedItem['quantity'];
                $voidQty = min($reqQty, (int)$matchedItem['quantity']);

                if ($voidQty <= 0) {
                    continue;
                }

                // Restore stock
                $restoreStmt->execute([
                    ':quantity' => $voidQty,
                    ':product_id' => (int)$matchedItem['product_id']
                ]);

                $lineRefund = $voidQty * (float)$matchedItem['price_at_sale'];
                $totalRefund += $lineRefund;

                $prodName = $matchedItem['name'] ?? "ID:{$matchedItem['product_id']}";
                $restored[] = $prodName . " x" . $voidQty . " (₱" . number_format($lineRefund, 2) . ")";

                if ($voidQty >= (int)$matchedItem['quantity']) {
                    $deleteItemStmt->execute([':item_id' => $matchedItem['item_id']]);
                } else {
                    $updateItemQtyStmt->execute([
                        ':void_qty' => $voidQty,
                        ':item_id' => $matchedItem['item_id']
                    ]);
                }
            }

            // Check if any items remain in this transaction
            $checkRemainingStmt = $conn->prepare("SELECT COUNT(*) FROM transaction_items WHERE transaction_id = :id");
            $checkRemainingStmt->execute([':id' => $transaction_id]);
            $remainingCount = (int)$checkRemainingStmt->fetchColumn();

            $newTotal = 0.0;
            $type = 'partial';

            if ($remainingCount === 0) {
                // All items ended up deleted -> mark as voided
                $voidAllStmt = $conn->prepare("UPDATE transactions SET status = 'voided', total_amount = 0 WHERE id = :id");
                $voidAllStmt->execute([':id' => $transaction_id]);
                $type = 'full';
            } else {
                // Deduct refunded amount from transaction total
                $updateTotalStmt = $conn->prepare(
                    "UPDATE transactions
                     SET total_amount = GREATEST(0, total_amount - :refund)
                     WHERE id = :id
                     RETURNING total_amount"
                );
                $updateTotalStmt->execute([
                    ':refund' => $totalRefund,
                    ':id' => $transaction_id
                ]);
                $newTotal = (float)$updateTotalStmt->fetchColumn();
            }

            $summary = "Partial Void on Transaction #$transaction_id. Refunded: ₱" .
                number_format($totalRefund, 2) .
                ". Restored items: " . implode(", ", $restored) .
                ($type === 'full' ? ". Order is now completely voided." : ". Remaining Total: ₱" . number_format($newTotal, 2));

            $logStmt = $conn->prepare(
                "INSERT INTO audit_logs (user_name, action, details)
                 VALUES (:user_name, 'Partial Void', :details)"
            );
            $logStmt->execute([
                ':user_name' => $user_name,
                ':details' => $summary
            ]);

            $conn->commit();

            echo json_encode([
                'success' => true,
                'type' => $type,
                'id' => (string)$transaction_id,
                'refundAmount' => $totalRefund,
                'newTotal' => $newTotal
            ]);
            exit();
        }

    } catch (Throwable $e) {

        if (
            isset($conn) &&
            $conn instanceof PDO &&
            $conn->inTransaction()
        ) {
            $conn->rollBack();
        }

        apiError(
            500,
            'Void failed',
            $e->getMessage()
        );
    }
}


else {

    apiError(
        405,
        'Method not allowed'
    );
}
?>