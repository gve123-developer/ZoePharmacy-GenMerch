<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/../includes/db_connect.php';

$isCli = (php_sapi_name() === 'cli');

if (!$isCli) {
    $passcode = $_GET['passcode'] ?? $_POST['passcode'] ?? '';
    if ($passcode !== '383611') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized: Valid Owner Passcode required (use ?passcode=383611)'
        ]);
        exit();
    }
}

$action = $_GET['action'] ?? $_POST['action'] ?? ($argv[1] ?? 'seed');

if ($action === 'check') {
    $stmt = $conn->query("
        SELECT 
            min(transaction_date) as earliest_date,
            max(transaction_date) as latest_date,
            count(*) as total_count,
            count(CASE WHEN transaction_date >= '2026-07-02' AND transaction_date <= '2026-08-02 23:59:59' THEN 1 END) as july_count
        FROM transactions
    ");
    $info = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'info' => $info], JSON_PRETTY_PRINT);
    exit();
}

// Clean any previous test rows for July 2 - August 2
$conn->exec("DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE transaction_date >= '2026-07-02' AND transaction_date <= '2026-08-02 23:59:59')");
$conn->exec("DELETE FROM transactions WHERE transaction_date >= '2026-07-02' AND transaction_date <= '2026-08-02 23:59:59'");

$dataFile = __DIR__ . '/july_transactions_seed.json';
if (!file_exists($dataFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => "Data file not found: {$dataFile}"]);
    exit(1);
}

$data = json_decode(file_get_contents($dataFile), true);
$julTxs = $data['july_transactions'] ?? [];

$conn->beginTransaction();

try {
    $txInsert = $conn->prepare("INSERT INTO transactions (cashier_id, total_amount, payment_method, amount_received, change_amount, status, transaction_date) VALUES (:cashier_id, :total_amount, :payment_method, :amount_received, :change_amount, :status, :transaction_date) RETURNING id");

    $itemInsert = $conn->prepare("INSERT INTO transaction_items (transaction_id, product_id, quantity, price_at_sale, cost_at_sale, status) VALUES (:transaction_id, :product_id, :quantity, :price_at_sale, :cost_at_sale, :status)");

    $insertedCount = 0;
    $itemsCount = 0;

    foreach ($julTxs as $tx) {
        $txInsert->execute([
            ':cashier_id' => 1,
            ':total_amount' => $tx['total_sale'],
            ':payment_method' => strtolower($tx['payment_method']),
            ':amount_received' => $tx['cash_received'],
            ':change_amount' => $tx['change_due'],
            ':status' => strtolower($tx['status']),
            ':transaction_date' => $tx['date_time']
        ]);
        $txId = $txInsert->fetchColumn();
        $insertedCount++;

        foreach ($tx['items'] as $item) {
            preg_match('/(\d+)/', $item['sku'], $m);
            $prodId = isset($m[1]) ? (int)$m[1] : 0;

            $itemInsert->execute([
                ':transaction_id' => $txId,
                ':product_id' => $prodId,
                ':quantity' => $item['qty'],
                ':price_at_sale' => $item['unit_price'],
                ':cost_at_sale' => $item['unit_cost'],
                ':status' => strtolower($item['status'])
            ]);
            $itemsCount++;
        }
    }

    $conn->commit();
    echo json_encode([
        'success' => true,
        'message' => "Successfully seeded {$insertedCount} July transactions with {$itemsCount} items into database.",
        'details' => [
            'insertedTransactions' => $insertedCount,
            'insertedItems' => $itemsCount,
            'dateRange' => '2026-07-02 to 2026-08-02'
        ]
    ], JSON_PRETTY_PRINT) . ($isCli ? PHP_EOL : '');
} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT) . ($isCli ? PHP_EOL : '');
}
