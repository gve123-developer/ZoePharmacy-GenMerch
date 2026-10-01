<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
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
        error_log("[products.php] $message | $debug");
    }

    echo json_encode($payload);
    exit;
}


// GET: Fetch all products
if ($method === 'GET') {
    try {

        $sql = "
            SELECT
                p.id,
                p.name,
                p.sku,
                p.description,
                p.quantity,
                p.price,
                p.cost,
                p.reorder_level,
                p.expiry_date,
                p.new_stock_quantity,
                p.new_stock_expiry,
                c.name AS category
            FROM products p
            LEFT JOIN categories c
                ON p.category_id = c.id
            ORDER BY p.id DESC
        ";

        $stmt = $conn->query($sql);

        $products = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $products[] = [
                'id' => (string)$row['id'],
                'name' => $row['name'],
                'sku' => $row['sku'],
                'category' => $row['category'] ?? 'Uncategorized',
                'description' => $row['description'],
                'quantity' => (int)$row['quantity'],
                'price' => (float)$row['price'],
                'cost' => (float)$row['cost'],
                'reorderLevel' => (int)$row['reorder_level'],
                'expiryDate' => $row['expiry_date'],
                'newStockQuantity' => (int)($row['new_stock_quantity'] ?? 0),
                'newStockExpiry' => $row['new_stock_expiry']
            ];
        }

        echo json_encode($products);

    } catch (Throwable $e) {
        apiError(
            500,
            'Failed to fetch products',
            $e->getMessage()
        );
    }
}


// POST: Add new product
elseif ($method === 'POST') {
    try {

        $data = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (!$data) {
            throw new RuntimeException("Invalid JSON body");
        }

        $category_name = trim(
            $data['category'] ?? 'Uncategorized'
        );

        // Find category
        $cat_q = $conn->prepare(
            "SELECT id
             FROM categories
             WHERE name = :name
             LIMIT 1"
        );

        $cat_q->execute([
            ':name' => $category_name
        ]);

        $cat_row = $cat_q->fetch(PDO::FETCH_ASSOC);

        if ($cat_row) {

            $category_id = $cat_row['id'];

        } else {

            $ins_cat = $conn->prepare(
                "INSERT INTO categories (name)
                 VALUES (:name)
                 RETURNING id"
            );

            $ins_cat->execute([
                ':name' => $category_name
            ]);

            $category_id = $ins_cat->fetchColumn();
        }

        $sku = trim($data['sku'] ?? '');
        $name = trim($data['name'] ?? '');
        $desc = $data['description'] ?? '';

        $qty = (int)($data['quantity'] ?? 0);
        $price = (float)($data['price'] ?? 0);
        $cost = (float)($data['cost'] ?? 0);
        $reorder = (int)($data['reorderLevel'] ?? 0);

        $expiry =
            !empty($data['expiryDate'])
            ? $data['expiryDate']
            : null;

        $nb_qty =
            (int)($data['newStockQuantity'] ?? 0);

        $nb_expiry =
            !empty($data['newStockExpiry'])
            ? $data['newStockExpiry']
            : null;

        if ($sku === '' || $name === '') {
            throw new RuntimeException(
                "SKU and product name are required"
            );
        }

        $stmt = $conn->prepare(
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
                :new_stock_quantity,
                :new_stock_expiry
            )
            RETURNING id"
        );

        $stmt->execute([
            ':sku' => $sku,
            ':name' => $name,
            ':category_id' => $category_id,
            ':description' => $desc,
            ':quantity' => $qty,
            ':price' => $price,
            ':cost' => $cost,
            ':reorder_level' => $reorder,
            ':expiry_date' => $expiry,
            ':new_stock_quantity' => $nb_qty,
            ':new_stock_expiry' => $nb_expiry
        ]);

        $new_id = $stmt->fetchColumn();

        include_once '../includes/audit_logger.php';

        $user =
            $_SERVER['HTTP_X_USER_NAME']
            ?? 'Admin';

        log_action(
            $conn,
            $user,
            'Add Product',
            "Added product: $name (SKU: $sku)"
        );

        echo json_encode([
            'success' => true,
            'id' => (string)$new_id
        ]);

    } catch (Throwable $e) {
        apiError(
            500,
            'Failed to add product',
            $e->getMessage()
        );
    }
}


// PUT: Update product
elseif ($method === 'PUT') {
    try {

        $data = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (!$data) {
            throw new RuntimeException(
                "Invalid JSON body"
            );
        }

        $id =
            isset($_GET['id'])
            ? (int)$_GET['id']
            : (int)($data['id'] ?? 0);

        if (!$id) {
            throw new RuntimeException(
                "Missing product ID"
            );
        }

        $category_name =
            trim(
                $data['category']
                ?? 'Uncategorized'
            );

        $cat_q = $conn->prepare(
            "SELECT id
             FROM categories
             WHERE name = :name
             LIMIT 1"
        );

        $cat_q->execute([
            ':name' => $category_name
        ]);

        $cat_row =
            $cat_q->fetch(PDO::FETCH_ASSOC);

        if ($cat_row) {

            $category_id =
                $cat_row['id'];

        } else {

            $ins_cat =
                $conn->prepare(
                    "INSERT INTO categories (name)
                     VALUES (:name)
                     RETURNING id"
                );

            $ins_cat->execute([
                ':name' => $category_name
            ]);

            $category_id =
                $ins_cat->fetchColumn();
        }

        $sku = trim($data['sku'] ?? '');
        $name = trim($data['name'] ?? '');
        $desc = $data['description'] ?? '';

        $qty =
            (int)($data['quantity'] ?? 0);

        $price =
            (float)($data['price'] ?? 0);

        $cost =
            (float)($data['cost'] ?? 0);

        $reorder =
            (int)($data['reorderLevel'] ?? 0);

        $expiry =
            !empty($data['expiryDate'])
            ? $data['expiryDate']
            : null;

        $nb_qty =
            (int)($data['newStockQuantity'] ?? 0);

        $nb_expiry =
            !empty($data['newStockExpiry'])
            ? $data['newStockExpiry']
            : null;

        $stmt = $conn->prepare(
            "UPDATE products
             SET
                sku = :sku,
                name = :name,
                category_id = :category_id,
                description = :description,
                quantity = :quantity,
                price = :price,
                cost = :cost,
                reorder_level = :reorder_level,
                expiry_date = :expiry_date,
                new_stock_quantity = :new_stock_quantity,
                new_stock_expiry = :new_stock_expiry,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = :id"
        );

        $stmt->execute([
            ':sku' => $sku,
            ':name' => $name,
            ':category_id' => $category_id,
            ':description' => $desc,
            ':quantity' => $qty,
            ':price' => $price,
            ':cost' => $cost,
            ':reorder_level' => $reorder,
            ':expiry_date' => $expiry,
            ':new_stock_quantity' => $nb_qty,
            ':new_stock_expiry' => $nb_expiry,
            ':id' => $id
        ]);

        include_once '../includes/audit_logger.php';

        $user =
            $_SERVER['HTTP_X_USER_NAME']
            ?? 'Admin';

        log_action(
            $conn,
            $user,
            'Edit Product',
            "Updated product: $name (ID: $id)"
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
            'Failed to update product',
            $e->getMessage()
        );
    }
}


// DELETE: Archive product
elseif ($method === 'DELETE') {
    try {

        $id =
            isset($_GET['id'])
            ? (int)$_GET['id']
            : 0;

        if (!$id) {
            throw new RuntimeException(
                "Missing product ID"
            );
        }

        include_once '../includes/audit_logger.php';

        $user =
            $_SERVER['HTTP_X_USER_NAME']
            ?? 'Admin';

        // Get product first
        $fetch = $conn->prepare(
            "SELECT
                p.id,
                p.sku,
                p.name,
                c.name AS category,
                p.description,
                p.quantity,
                p.price,
                p.cost,
                p.reorder_level,
                p.expiry_date
             FROM products p
             LEFT JOIN categories c
                ON p.category_id = c.id
             WHERE p.id = :id"
        );

        $fetch->execute([
            ':id' => $id
        ]);

        $p =
            $fetch->fetch(PDO::FETCH_ASSOC);

        if (!$p) {
            apiError(
                404,
                'Product not found'
            );
        }

        $conn->beginTransaction();

        try {

            // Archive
            $ins = $conn->prepare(
                "INSERT INTO deleted_products
                (
                    original_id,
                    sku,
                    name,
                    category,
                    description,
                    quantity,
                    price,
                    cost,
                    reorder_level,
                    expiry_date,
                    deleted_by
                )
                VALUES
                (
                    :original_id,
                    :sku,
                    :name,
                    :category,
                    :description,
                    :quantity,
                    :price,
                    :cost,
                    :reorder_level,
                    :expiry_date,
                    :deleted_by
                )"
            );

            $ins->execute([
                ':original_id' =>
                    $p['id'],

                ':sku' =>
                    $p['sku'],

                ':name' =>
                    $p['name'],

                ':category' =>
                    $p['category'],

                ':description' =>
                    $p['description'],

                ':quantity' =>
                    $p['quantity'],

                ':price' =>
                    $p['price'],

                ':cost' =>
                    $p['cost'],

                ':reorder_level' =>
                    $p['reorder_level'],

                ':expiry_date' =>
                    $p['expiry_date'],

                ':deleted_by' =>
                    $user
            ]);

            // Delete active product
            $del = $conn->prepare(
                "DELETE FROM products
                 WHERE id = :id"
            );

            $del->execute([
                ':id' => $id
            ]);

            $conn->commit();

        } catch (Throwable $e) {

            if ($conn->inTransaction()) {
                $conn->rollBack();
            }

            throw $e;
        }

        log_action(
            $conn,
            $user,
            'Archive Product',
            "Moved to recycle bin: {$p['name']}"
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
            'Failed to delete product',
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