<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';
include_once '../includes/audit_logger.php';

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
        error_log("[deleted_products.php] $message | $debug");
    }

    echo json_encode($payload);
    exit();
}


// ============================================================
// GET: List archived products
// ============================================================
if ($method === 'GET') {

    try {

        $stmt = $conn->query(
            "SELECT *
             FROM deleted_products
             ORDER BY deleted_at DESC"
        );

        $items = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $items[] = [
                'id' => (string)$row['id'],
                'originalId' => (string)$row['original_id'],
                'sku' => $row['sku'],
                'name' => $row['name'],
                'category' => $row['category'] ?? 'Uncategorized',
                'description' => $row['description'],
                'quantity' => (int)$row['quantity'],
                'price' => (float)$row['price'],
                'cost' => (float)$row['cost'],
                'reorderLevel' => (int)$row['reorder_level'],
                'expiryDate' => $row['expiry_date'],
                'deletedBy' => $row['deleted_by'],
                'deletedAt' => $row['deleted_at']
            ];
        }

        echo json_encode($items);

    } catch (Throwable $e) {

        apiError(
            500,
            'Failed to fetch archived products',
            $e->getMessage()
        );
    }
}


// ============================================================
// POST: Restore archived product
// ============================================================
elseif ($method === 'POST') {

    try {

        $data = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (!is_array($data)) {
            throw new RuntimeException("Invalid JSON body");
        }

        $dump_id = (int)($data['id'] ?? 0);

        if ($dump_id <= 0) {
            throw new RuntimeException("Missing dump ID");
        }

        $conn->beginTransaction();

        // Fetch archived product
        $fetch = $conn->prepare(
            "SELECT *
             FROM deleted_products
             WHERE id = :id
             FOR UPDATE"
        );

        $fetch->execute([
            ':id' => $dump_id
        ]);

        $p = $fetch->fetch(PDO::FETCH_ASSOC);

        if (!$p) {
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }

            apiError(
                404,
                'Archived product not found'
            );
        }

        // Resolve category
        $categoryName =
            trim(
                $p['category']
                ?? 'Uncategorized'
            );

        $catStmt = $conn->prepare(
            "SELECT id
             FROM categories
             WHERE name = :name
             LIMIT 1"
        );

        $catStmt->execute([
            ':name' => $categoryName
        ]);

        $category_id =
            $catStmt->fetchColumn();

        if (!$category_id) {

            $insertCategoryStmt =
                $conn->prepare(
                    "INSERT INTO categories (name)
                     VALUES (:name)
                     RETURNING id"
                );

            $insertCategoryStmt->execute([
                ':name' => $categoryName
            ]);

            $category_id =
                $insertCategoryStmt->fetchColumn();
        }

        // Prevent duplicate active SKU
        $skuCheck = $conn->prepare(
            "SELECT id
             FROM products
             WHERE sku = :sku
             LIMIT 1"
        );

        $skuCheck->execute([
            ':sku' => $p['sku']
        ]);

        if ($skuCheck->fetchColumn()) {
            throw new RuntimeException(
                "Cannot restore product because SKU '{$p['sku']}' already exists"
            );
        }

        // Restore product
        //
        // We do NOT force original_id back into products.id here,
        // because that ID may already have been reused. PostgreSQL
        // will safely assign a new active product ID.
        $insertProduct = $conn->prepare(
            "INSERT INTO products
            (
                sku,
                name,
                category_id,
                description,
                quantity,
                price,
                cost,
                reorder_level,
                expiry_date,
                new_stock_quantity,
                new_stock_expiry
            )
            VALUES
            (
                :sku,
                :name,
                :category_id,
                :description,
                :quantity,
                :price,
                :cost,
                :reorder_level,
                :expiry_date,
                0,
                NULL
            )
            RETURNING id"
        );

        $insertProduct->execute([
            ':sku' => $p['sku'],
            ':name' => $p['name'],
            ':category_id' => $category_id,
            ':description' => $p['description'],
            ':quantity' => (int)$p['quantity'],
            ':price' => (float)$p['price'],
            ':cost' => (float)$p['cost'],
            ':reorder_level' => (int)$p['reorder_level'],
            ':expiry_date' => $p['expiry_date']
        ]);

        $restoredProductId =
            $insertProduct->fetchColumn();

        // Remove from archive
        $deleteArchive = $conn->prepare(
            "DELETE FROM deleted_products
             WHERE id = :id"
        );

        $deleteArchive->execute([
            ':id' => $dump_id
        ]);

        $conn->commit();

        $user =
            $_SERVER['HTTP_X_USER_NAME']
            ?? 'Admin';

        log_action(
            $conn,
            $user,
            'Restore Product',
            "Restored from archive: {$p['name']} (New ID: $restoredProductId)"
        );

        echo json_encode([
            'success' => true,
            'id' => (string)$restoredProductId
        ]);

    } catch (Throwable $e) {

        if (
            isset($conn) &&
            $conn instanceof PDO &&
            $conn->inTransaction()
        ) {
            $conn->rollBack();
        }

        $code =
            str_contains(
                $e->getMessage(),
                'Missing'
            )
            ? 400
            : 500;

        apiError(
            $code,
            'Failed to restore product',
            $e->getMessage()
        );
    }
}


// ============================================================
// DELETE: Permanently purge archived product
// ============================================================
elseif ($method === 'DELETE') {

    try {

        $dump_id =
            (int)($_GET['id'] ?? 0);

        if ($dump_id <= 0) {
            throw new RuntimeException(
                "Missing ID"
            );
        }

        $fetch = $conn->prepare(
            "SELECT name
             FROM deleted_products
             WHERE id = :id"
        );

        $fetch->execute([
            ':id' => $dump_id
        ]);

        $row =
            $fetch->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            apiError(
                404,
                'Archived product not found'
            );
        }

        $name =
            $row['name']
            ?? "ID $dump_id";

        $deleteStmt = $conn->prepare(
            "DELETE FROM deleted_products
             WHERE id = :id"
        );

        $deleteStmt->execute([
            ':id' => $dump_id
        ]);

        $user =
            $_SERVER['HTTP_X_USER_NAME']
            ?? 'Admin';

        log_action(
            $conn,
            $user,
            'Purge Product',
            "Permanently purged: $name"
        );

        echo json_encode([
            'success' => true
        ]);

    } catch (Throwable $e) {

        $code =
            str_contains(
                $e->getMessage(),
                'Missing'
            )
            ? 400
            : 500;

        apiError(
            $code,
            'Failed to purge product',
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