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

// ─── Helper: send error response ─────────────────────────────────────────────
function apiError(int $code, string $message, string $debug = ''): void
{
    http_response_code($code);
    $payload = ['success' => false, 'message' => $message];
    if ($debug !== '') {
        $payload['debug'] = $debug;
        error_log("[products.php] $message | $debug");
    }
    echo json_encode($payload);
    exit;
}

// ─── GET: Fetch all products ──────────────────────────────────────────────────
if ($method === 'GET') {
    try {
        $sql = "SELECT p.id, p.name, p.sku, p.description, p.quantity, p.price,
                       p.cost, p.reorder_level, p.expiry_date, p.new_stock_quantity, p.new_stock_expiry, c.name AS category
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id";
        $result = $conn->query($sql);

        if (!$result) {
            throw new RuntimeException("Query failed: " . $conn->error);
        }

        $products = [];
        while ($row = $result->fetch_assoc()) {
            $products[] = [
                'id' => (string) $row['id'],
                'name' => $row['name'],
                'sku' => $row['sku'],
                'category' => $row['category'] ?? 'Uncategorized',
                'description' => $row['description'],
                'quantity' => (int) $row['quantity'],
                'price' => (float) $row['price'],
                'cost' => (float) $row['cost'],
                'reorderLevel' => (int) $row['reorder_level'],
                'expiryDate' => $row['expiry_date'],
                'newStockQuantity' => (int) ($row['new_stock_quantity'] ?? 0),
                'newStockExpiry' => $row['new_stock_expiry'],
            ];
        }
        echo json_encode($products);

    } catch (Exception $e) {
        file_put_contents('../debug_error.log', "Error at " . date('Y-m-d H:i:s') . "\nMessage: " . $e->getMessage() . "\nStack trace: " . $e->getTraceAsString() . "\n\n", FILE_APPEND);
        apiError(500, 'Failed to fetch products', $e->getMessage());
    }
}

// ─── POST: Add new product ────────────────────────────────────────────────────
elseif ($method === 'POST') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data)
            throw new RuntimeException("Invalid JSON body");

        // Resolve or create category
        $category_name = $data['category'] ?? 'Uncategorized';
        $cat_q = $conn->prepare("SELECT id FROM categories WHERE name = ?");
        if (!$cat_q)
            throw new RuntimeException("Prepare category query: " . $conn->error);
        $cat_q->bind_param("s", $category_name);
        $cat_q->execute();
        $cat_row = $cat_q->get_result()->fetch_assoc();
        $cat_q->close();

        if ($cat_row) {
            $category_id = $cat_row['id'];
        } else {
            $ins_cat = $conn->prepare("INSERT INTO categories (name) VALUES (?)");
            if (!$ins_cat)
                throw new RuntimeException("Prepare insert category: " . $conn->error);
            $ins_cat->bind_param("s", $category_name);
            if (!$ins_cat->execute())
                throw new RuntimeException("Insert category: " . $ins_cat->error);
            $category_id = $conn->insert_id;
            $ins_cat->close();
        }

        $sku = $data['sku'] ?? '';
        $name = $data['name'] ?? '';
        $desc = $data['description'] ?? '';
        $qty = (int) ($data['quantity'] ?? 0);
        $price = (float) ($data['price'] ?? 0);
        $cost = (float) ($data['cost'] ?? 0);
        $reorder = (int) ($data['reorderLevel'] ?? 0);
        $expiry = !empty($data['expiryDate']) ? $data['expiryDate'] : null;
        $nb_qty = (int) ($data['newStockQuantity'] ?? 0);
        $nb_expiry = !empty($data['newStockExpiry']) ? $data['newStockExpiry'] : null;

        error_log("[POST] Attempting insert: $name | SKU: $sku | NewStock: $nb_qty");
        
        $stmt = $conn->prepare(
            "INSERT INTO products (sku, name, category_id, description, quantity, price, cost, reorder_level, expiry_date, new_stock_quantity, new_stock_expiry)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        if (!$stmt) {
            error_log("[POST] Prepare failed: " . $conn->error);
            throw new RuntimeException("Prepare insert product: " . $conn->error);
        }
        
        $stmt->bind_param("ssisiddisis", $sku, $name, $category_id, $desc, $qty, $price, $cost, $reorder, $expiry, $nb_qty, $nb_expiry);

        if (!$stmt->execute()) {
            error_log("[POST] Execute failed: " . $stmt->error);
            throw new RuntimeException("Insert product: " . $stmt->error);
        }
        $new_id = $conn->insert_id;
        $stmt->close();

        include_once '../includes/audit_logger.php';
        $user = $_SERVER['HTTP_X_USER_NAME'] ?? 'Admin';
        log_action($conn, $user, 'Add Product', "Added product: $name (SKU: $sku)");

        echo json_encode(['success' => true, 'id' => (string) $new_id]);

    } catch (Exception $e) {
        apiError(500, 'Failed to add product', $e->getMessage());
    }
}

// ─── PUT: Update product ──────────────────────────────────────────────────────
elseif ($method === 'PUT') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data)
            throw new RuntimeException("Invalid JSON body");

        $id = isset($_GET['id']) ? (int) $_GET['id'] : (int) ($data['id'] ?? 0);
        if (!$id)
            throw new RuntimeException("Missing product ID");

        $category_name = $data['category'] ?? 'Uncategorized';
        $cat_q = $conn->prepare("SELECT id FROM categories WHERE name = ?");
        if (!$cat_q)
            throw new RuntimeException("Prepare category query: " . $conn->error);
        $cat_q->bind_param("s", $category_name);
        $cat_q->execute();
        $cat_row = $cat_q->get_result()->fetch_assoc();
        $cat_q->close();

        if ($cat_row) {
            $category_id = $cat_row['id'];
        } else {
            $ins_cat = $conn->prepare("INSERT INTO categories (name) VALUES (?)");
            if (!$ins_cat)
                throw new RuntimeException("Prepare insert category: " . $conn->error);
            $ins_cat->bind_param("s", $category_name);
            if (!$ins_cat->execute())
                throw new RuntimeException("Insert category: " . $ins_cat->error);
            $category_id = $conn->insert_id;
            $ins_cat->close();
        }

        $sku = $data['sku'] ?? '';
        $name = $data['name'] ?? '';
        $desc = $data['description'] ?? '';
        $qty = (int) ($data['quantity'] ?? 0);
        $price = (float) ($data['price'] ?? 0);
        $cost = (float) ($data['cost'] ?? 0);
        $reorder = (int) ($data['reorderLevel'] ?? 0);
        $expiry = !empty($data['expiryDate']) ? $data['expiryDate'] : null;
        $nb_qty = (int) ($data['newStockQuantity'] ?? 0);
        $nb_expiry = !empty($data['newStockExpiry']) ? $data['newStockExpiry'] : null;

        $stmt = $conn->prepare(
            "UPDATE products SET sku=?, name=?, category_id=?, description=?, quantity=?,
             price=?, cost=?, reorder_level=?, expiry_date=?, new_stock_quantity=?, new_stock_expiry=? WHERE id=?"
        );
        if (!$stmt)
            throw new RuntimeException("Prepare update: " . $conn->error);
        $stmt->bind_param("ssisiddisisi", $sku, $name, $category_id, $desc, $qty, $price, $cost, $reorder, $expiry, $nb_qty, $nb_expiry, $id);

        if (!$stmt->execute())
            throw new RuntimeException("Update product: " . $stmt->error);
        $stmt->close();

        include_once '../includes/audit_logger.php';
        $user = $_SERVER['HTTP_X_USER_NAME'] ?? 'Admin';
        log_action($conn, $user, 'Edit Product', "Updated product: $name (ID: $id)");

        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        $code = str_contains($e->getMessage(), 'Missing') ? 400 : 500;
        apiError($code, 'Failed to update product', $e->getMessage());
    }
}

// ─── DELETE: Archive product ──────────────────────────────────────────────────
elseif ($method === 'DELETE') {
    try {
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        if (!$id)
            throw new RuntimeException("Missing product ID");

        include_once '../includes/audit_logger.php';
        $user = $_SERVER['HTTP_X_USER_NAME'] ?? 'Admin';

        // Load full product row before deletion
        $fetch = $conn->prepare(
            "SELECT p.id, p.sku, p.name, c.name AS category, p.description,
                    p.quantity, p.price, p.cost, p.reorder_level, p.expiry_date
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.id = ?"
        );
        if (!$fetch)
            throw new RuntimeException("Prepare fetch: " . $conn->error);
        $fetch->bind_param("i", $id);
        $fetch->execute();
        $res = $fetch->get_result();
        $fetch->close();

        if (!$res || $res->num_rows === 0) {
            apiError(404, 'Product not found');
        }

        $p = $res->fetch_assoc();

        // Archive into deleted_products
        $ins = $conn->prepare(
            "INSERT INTO deleted_products
                (original_id, sku, name, category, description, quantity, price, cost, reorder_level, expiry_date, deleted_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        if (!$ins)
            throw new RuntimeException("Prepare archive insert: " . $conn->error);
        $ins->bind_param(
            "issssididss",
            $p['id'],
            $p['sku'],
            $p['name'],
            $p['category'],
            $p['description'],
            $p['quantity'],
            $p['price'],
            $p['cost'],
            $p['reorder_level'],
            $p['expiry_date'],
            $user
        );
        if (!$ins->execute())
            throw new RuntimeException("Archive insert: " . $ins->error);
        $ins->close();

        // Remove from active tables
        $del = $conn->prepare("DELETE FROM products WHERE id=?");
        if (!$del)
            throw new RuntimeException("Prepare delete: " . $conn->error);
        $del->bind_param("i", $id);
        if (!$del->execute())
            throw new RuntimeException("Delete product: " . $del->error);
        $del->close();

        log_action($conn, $user, 'Archive Product', "Moved to recycle bin: {$p['name']}");
        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        $code = str_contains($e->getMessage(), 'Missing') ? 400 : 500;
        apiError($code, 'Failed to delete product', $e->getMessage());
    }
} else {
    apiError(405, 'Method not allowed');
}
?>