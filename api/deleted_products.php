<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';
include_once '../includes/audit_logger.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') { http_response_code(200); exit(); }



// ─── GET: List archived products ──────────────────────────────────────────────
if ($method === 'GET') {
    try {
        $result = $conn->query("SELECT * FROM deleted_products ORDER BY deleted_at DESC");
        if (!$result) throw new RuntimeException("Fetch deleted_products: " . $conn->error);

        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = [
                'id'          => (string)$row['id'],
                'originalId'  => (string)$row['original_id'],
                'sku'         => $row['sku'],
                'name'        => $row['name'],
                'category'    => $row['category'] ?? 'Uncategorized',
                'description' => $row['description'],
                'quantity'    => (int)$row['quantity'],
                'price'       => (float)$row['price'],
                'cost'        => (float)$row['cost'],
                'reorderLevel'=> (int)$row['reorder_level'],
                'expiryDate'  => $row['expiry_date'],
                'deletedBy'   => $row['deleted_by'],
                'deletedAt'   => $row['deleted_at'],
            ];
        }
        echo json_encode($items);

    } catch (Exception $e) {
        apiError(500, 'Failed to fetch archived products', $e->getMessage());
    }
}

// ─── POST: Restore a product ──────────────────────────────────────────────────
elseif ($method === 'POST') {
    try {
        $data    = json_decode(file_get_contents("php://input"), true);
        $dump_id = (int)($data['id'] ?? 0);
        if (!$dump_id) throw new RuntimeException("Missing dump ID");

        $fetch = $conn->prepare("SELECT * FROM deleted_products WHERE id=?");
        if (!$fetch) throw new RuntimeException("Prepare fetch: " . $conn->error);
        $fetch->bind_param("i", $dump_id);
        $fetch->execute();
        $res = $fetch->get_result();
        $fetch->close();

        if (!$res || $res->num_rows === 0) apiError(404, 'Archived product not found');

        $p = $res->fetch_assoc();

        // Resolve category
        $cat_q = $conn->prepare("SELECT id FROM categories WHERE name = ?");
        if (!$cat_q) throw new RuntimeException("Prepare category query: " . $conn->error);
        $cat_q->bind_param("s", $p['category']);
        $cat_q->execute();
        $cat_row = $cat_q->get_result()->fetch_assoc();
        $cat_q->close();

        if ($cat_row) {
            $category_id = $cat_row['id'];
        } else {
            $ins_cat = $conn->prepare("INSERT INTO categories (name) VALUES (?)");
            if (!$ins_cat) throw new RuntimeException("Prepare insert category: " . $conn->error);
            $ins_cat->bind_param("s", $p['category']);
            if (!$ins_cat->execute()) throw new RuntimeException("Insert category: " . $ins_cat->error);
            $category_id = $conn->insert_id;
            $ins_cat->close();
        }

        // Re-insert into active products
        $ins = $conn->prepare(
            "INSERT INTO products (sku, name, category_id, description, quantity, price, cost, reorder_level, expiry_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        if (!$ins) throw new RuntimeException("Prepare product insert: " . $conn->error);
        $ins->bind_param(
            "ssisiddis",
            $p['sku'], $p['name'], $category_id, $p['description'],
            $p['quantity'], $p['price'], $p['cost'], $p['reorder_level'], $p['expiry_date']
        );
        if (!$ins->execute()) throw new RuntimeException("Restore insert: " . $ins->error);
        $ins->close();

        // Remove from dump table
        $del = $conn->prepare("DELETE FROM deleted_products WHERE id=?");
        if (!$del) throw new RuntimeException("Prepare delete from dump: " . $conn->error);
        $del->bind_param("i", $dump_id);
        if (!$del->execute()) throw new RuntimeException("Delete from dump: " . $del->error);
        $del->close();

        $user = $_SERVER['HTTP_X_USER_NAME'] ?? 'Admin';
        log_action($conn, $user, 'Restore Product', "Restored from archive: {$p['name']}");

        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        $code = str_contains($e->getMessage(), 'Missing') ? 400 : 500;
        apiError($code, 'Failed to restore product', $e->getMessage());
    }
}

// ─── DELETE: Permanently purge from archive ───────────────────────────────────
elseif ($method === 'DELETE') {
    try {
        $dump_id = (int)($_GET['id'] ?? 0);
        if (!$dump_id) throw new RuntimeException("Missing ID");

        $fetch = $conn->prepare("SELECT name FROM deleted_products WHERE id=?");
        if (!$fetch) throw new RuntimeException("Prepare fetch name: " . $conn->error);
        $fetch->bind_param("i", $dump_id);
        $fetch->execute();
        $row = $fetch->get_result()->fetch_assoc();
        $fetch->close();
        $name = $row['name'] ?? "ID $dump_id";

        $del = $conn->prepare("DELETE FROM deleted_products WHERE id=?");
        if (!$del) throw new RuntimeException("Prepare purge: " . $conn->error);
        $del->bind_param("i", $dump_id);
        if (!$del->execute()) throw new RuntimeException("Purge: " . $del->error);
        $del->close();

        $user = $_SERVER['HTTP_X_USER_NAME'] ?? 'Admin';
        log_action($conn, $user, 'Purge Product', "Permanently purged: $name");

        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        $code = str_contains($e->getMessage(), 'Missing') ? 400 : 500;
        apiError($code, 'Failed to purge product', $e->getMessage());
    }
}

else {
    apiError(405, 'Method not allowed');
}
?>
