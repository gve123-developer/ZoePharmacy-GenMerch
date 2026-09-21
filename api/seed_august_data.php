<?php
/**
 * Zoe Pharmacy & General Merchandise
 * Seed August 3-25 Mock Sales Transactions
 *
 * Can be run via CLI or Web:
 * - CLI: php api/seed_august_data.php
 * - Web: /api/seed_august_data.php?passcode=383611
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/../includes/db_connect.php';

$isCli = (php_sapi_name() === 'cli');

if (!$isCli) {
    $passcode = $_GET['passcode'] ?? $_POST['passcode'] ?? '';
    // Require Owner Passcode
    if ($passcode !== '383611') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized: Valid Owner Passcode required (use ?passcode=383611)'
        ]);
        exit();
    }
}

try {
    $conn->beginTransaction();

    // 1. Wipe all existing transactions and items
    $conn->exec("DELETE FROM transaction_items");
    $conn->exec("DELETE FROM transactions");

    // Reset sequences
    try {
        $conn->exec("ALTER SEQUENCE transactions_id_seq RESTART WITH 1");
        $conn->exec("ALTER SEQUENCE transaction_items_id_seq RESTART WITH 1");
    } catch (Throwable $seqEx) {
        // In case sequences differ across installations
    }

    // 2. Fetch all existing active inventory products
    $products = $conn->query("SELECT id, name, price, cost FROM products WHERE price > 0 ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
    if (empty($products)) {
        throw new RuntimeException("No products found in inventory table to generate transactions.");
    }

    // 3. Fetch cashiers
    $users = $conn->query("SELECT id, username, full_name FROM users ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
    $cashierIds = !empty($users) ? array_column($users, 'id') : [1];

    $insertTxStmt = $conn->prepare("
        INSERT INTO transactions (
            cashier_id,
            total_amount,
            payment_method,
            amount_received,
            change_amount,
            status,
            transaction_date
        ) VALUES (
            :cashier_id,
            :total_amount,
            :payment_method,
            :amount_received,
            :change_amount,
            :status,
            :transaction_date
        ) RETURNING id
    ");

    $insertItemStmt = $conn->prepare("
        INSERT INTO transaction_items (
            transaction_id,
            product_id,
            quantity,
            price_at_sale,
            cost_at_sale
        ) VALUES (
            :transaction_id,
            :product_id,
            :quantity,
            :price_at_sale,
            :cost_at_sale
        )
    ");

    $dates = [];
    for ($day = 3; $day <= 25; $day++) {
        $dates[] = sprintf('2026-08-%02d', $day);
    }

    $totalTransactions = 0;
    $totalItems = 0;
    $totalRevenue = 0;
    $voidDates = ['2026-08-11', '2026-08-21'];

    foreach ($dates as $date) {
        // 3 to 6 transactions per day
        $txPerDay = rand(3, 6);

        // Generate timestamps chronologically
        $times = [];
        for ($i = 0; $i < $txPerDay; $i++) {
            $hour = rand(8, 20); // 8:00 AM to 8:59 PM
            $minute = rand(0, 59);
            $second = rand(0, 59);
            $times[] = sprintf('%02d:%02d:%02d', $hour, $minute, $second);
        }
        sort($times);

        $voidCreatedForDay = false;

        foreach ($times as $index => $time) {
            $fullTimestamp = "{$date} {$time}";

            // Pick 1 to 4 distinct products
            $itemCount = rand(1, 4);
            $selectedProductIndices = (array)array_rand($products, $itemCount);

            $lineItems = [];
            $txTotal = 0;

            foreach ($selectedProductIndices as $pIdx) {
                $prod = $products[$pIdx];
                $unitPrice = (float)$prod['price'];
                $unitCost = (float)$prod['cost'];

                // Quantity based on price tier
                if ($unitPrice < 30) {
                    $qty = rand(1, 6);
                } elseif ($unitPrice < 150) {
                    $qty = rand(1, 3);
                } else {
                    $qty = rand(1, 2);
                }

                $subtotal = round($qty * $unitPrice, 2);
                $txTotal += $subtotal;

                $lineItems[] = [
                    'product_id' => $prod['id'],
                    'quantity' => $qty,
                    'price_at_sale' => $unitPrice,
                    'cost_at_sale' => $unitCost,
                ];
            }

            $txTotal = round($txTotal, 2);

            // Void 1 transaction on voidDates
            $status = 'completed';
            if (in_array($date, $voidDates) && !$voidCreatedForDay && $index === 1) {
                $status = 'voided';
                $voidCreatedForDay = true;
            }

            // Payment method
            $isCash = rand(1, 100) <= 85;
            $paymentMethod = $isCash ? 'cash' : 'gcash';

            if ($isCash) {
                if ($txTotal <= 50) {
                    $denominations = [50, 100];
                } elseif ($txTotal <= 100) {
                    $denominations = [100, 200];
                } elseif ($txTotal <= 200) {
                    $denominations = [200, 500];
                } elseif ($txTotal <= 500) {
                    $denominations = [500, 1000];
                } else {
                    $denominations = [ceil($txTotal / 100) * 100, ceil($txTotal / 500) * 500, ceil($txTotal / 1000) * 1000];
                }

                if (rand(1, 4) === 1) {
                    $amountReceived = $txTotal;
                } else {
                    $possible = array_filter($denominations, fn($d) => $d >= $txTotal);
                    $amountReceived = !empty($possible) ? (float)min($possible) : (float)(ceil($txTotal / 100) * 100);
                }
                $changeAmount = round(max(0, $amountReceived - $txTotal), 2);
            } else {
                $amountReceived = $txTotal;
                $changeAmount = 0.00;
            }

            $cashierId = $cashierIds[array_rand($cashierIds)];

            // Insert transaction
            $insertTxStmt->execute([
                ':cashier_id' => $cashierId,
                ':total_amount' => $txTotal,
                ':payment_method' => $paymentMethod,
                ':amount_received' => $amountReceived,
                ':change_amount' => $changeAmount,
                ':status' => $status,
                ':transaction_date' => $fullTimestamp,
            ]);

            $txId = $insertTxStmt->fetchColumn();

            // Insert transaction items
            foreach ($lineItems as $item) {
                $insertItemStmt->execute([
                    ':transaction_id' => $txId,
                    ':product_id' => $item['product_id'],
                    ':quantity' => $item['quantity'],
                    ':price_at_sale' => $item['price_at_sale'],
                    ':cost_at_sale' => $item['cost_at_sale'],
                ]);
                $totalItems++;
            }

            $totalTransactions++;
            if ($status === 'completed') {
                $totalRevenue += $txTotal;
            }
        }
    }

    $conn->commit();

    $response = [
        'success' => true,
        'message' => "Successfully removed all historical transactions and seeded {$totalTransactions} transactions across August 3-25, 2026.",
        'details' => [
            'startDate' => '2026-08-03',
            'endDate' => '2026-08-25',
            'totalDays' => count($dates),
            'totalTransactions' => $totalTransactions,
            'totalItemsSold' => $totalItems,
            'completedRevenue' => round($totalRevenue, 2),
            'voidedCount' => count($voidDates),
        ]
    ];

    if ($isCli) {
        echo json_encode($response, JSON_PRETTY_PRINT) . PHP_EOL;
    } else {
        echo json_encode($response);
    }

} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    $error = [
        'success' => false,
        'error' => $e->getMessage()
    ];

    http_response_code(500);
    echo json_encode($error, $isCli ? JSON_PRETTY_PRINT : 0) . ($isCli ? PHP_EOL : '');
}
