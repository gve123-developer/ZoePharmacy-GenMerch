<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    exit();
}

try {

    /*
    |--------------------------------------------------------------------------
    | Accept both form-data and JSON
    |--------------------------------------------------------------------------
    */

    $raw = file_get_contents("php://input");
    $jsonData = json_decode($raw, true);

    if (is_array($jsonData)) {

        $cart = $jsonData['cart'] ?? [];

        $payment_method =
            $jsonData['payment_method']
            ?? $jsonData['paymentMethod']
            ?? 'cash';

        $total_amount =
            (float)($jsonData['total'] ?? 0);

        $amount_received =
            isset($jsonData['amount_received'])
            ? (float)$jsonData['amount_received']
            : (
                isset($jsonData['amountReceived'])
                ? (float)$jsonData['amountReceived']
                : null
            );

        $change_amount =
            isset($jsonData['change'])
            ? (float)$jsonData['change']
            : null;

        $cashier_id =
            isset($jsonData['cashier_id'])
            ? (int)$jsonData['cashier_id']
            : (
                isset($jsonData['cashierId'])
                ? (int)$jsonData['cashierId']
                : null
            );

    } else {

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
    }

    if (!is_array($cart) || empty($cart)) {
        throw new RuntimeException(
            "Cart is empty or missing"
        );
    }

    /*
    |--------------------------------------------------------------------------
    | PostgreSQL transaction
    |--------------------------------------------------------------------------
    */

    $conn->beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | Resolve cashier
    |--------------------------------------------------------------------------
    */

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
                "No cashier/user available"
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Insert transaction
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Prepared statements
    |--------------------------------------------------------------------------
    */

    $productStmt = $conn->prepare(
        "SELECT
            id,
            quantity,
            new_stock_quantity,
            expiry_date,
            new_stock_expiry,
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

    $updateStockStmt = $conn->prepare(
        "UPDATE products
         SET
            quantity = :quantity,
            new_stock_quantity = :new_stock_quantity,
            expiry_date = :expiry_date,
            new_stock_expiry = :new_stock_expiry,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = :id"
    );

    /*
    |--------------------------------------------------------------------------
    | Process cart
    |--------------------------------------------------------------------------
    */

    foreach ($cart as $item) {

        $pid =
            (int)(
                $item['id']
                ?? $item['productId']
                ?? 0
            );

        $qty =
            (int)(
                $item['qty']
                ?? $item['quantity']
                ?? 0
            );

        $price =
            (float)(
                $item['price']
                ?? 0
            );

        if ($pid <= 0 || $qty <= 0) {
            throw new RuntimeException(
                "Invalid product or quantity"
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Lock product row
        |--------------------------------------------------------------------------
        */

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

        $oldQty =
            (int)$product['quantity'];

        $newQty =
            (int)$product['new_stock_quantity'];

        $totalAvailable =
            $oldQty + $newQty;

        if ($totalAvailable < $qty) {
            throw new RuntimeException(
                "Insufficient stock for product ID $pid"
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Save transaction item
        |--------------------------------------------------------------------------
        */

        $itemStmt->execute([
            ':transaction_id' => $transaction_id,
            ':product_id' => $pid,
            ':quantity' => $qty,
            ':price_at_sale' => $price,
            ':cost_at_sale' => (float)$product['cost']
        ]);

        /*
        |--------------------------------------------------------------------------
        | FEFO-style two-batch depletion
        |--------------------------------------------------------------------------
        |
        | Existing behavior preserved:
        | - old/current batch consumed first
        | - then new batch
        |--------------------------------------------------------------------------
        */

        $takeFromOld =
            min($qty, $oldQty);

        $remaining =
            $qty - $takeFromOld;

        $takeFromNew =
            min($remaining, $newQty);

        $oldQty -= $takeFromOld;
        $newQty -= $takeFromNew;

        $expiryDate =
            $product['expiry_date'];

        $newStockExpiry =
            $product['new_stock_expiry'];

        /*
        |--------------------------------------------------------------------------
        | Auto rotation
        |--------------------------------------------------------------------------
        |
        | If old stock is fully depleted and new stock remains,
        | promote the new stock into the primary batch.
        |--------------------------------------------------------------------------
        */

        if ($oldQty <= 0 && $newQty > 0) {

            $oldQty = $newQty;
            $expiryDate = $newStockExpiry;

            $newQty = 0;
            $newStockExpiry = null;

            error_log(
                "[AUTO-ROTATE] Product ID $pid promoted from new stock."
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Update product
        |--------------------------------------------------------------------------
        */

        $updateStockStmt->execute([
            ':quantity' => $oldQty,
            ':new_stock_quantity' => $newQty,
            ':expiry_date' => $expiryDate,
            ':new_stock_expiry' => $newStockExpiry,
            ':id' => $pid
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Commit
    |--------------------------------------------------------------------------
    */

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

    error_log(
        "[save_transaction.php] " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>