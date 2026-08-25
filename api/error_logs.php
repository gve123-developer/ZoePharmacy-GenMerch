<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') { http_response_code(200); exit(); }

// ─── GET: Fetch error logs ────────────────────────────────────────────────────
if ($method === 'GET') {
    try {
        $source = $_GET['source'] ?? 'all';  // all | php | javascript
        $limit  = min((int)($_GET['limit'] ?? 200), 500);

        if ($source !== 'all') {
            $stmt = $conn->prepare(
                "SELECT id, source, level, message, file, line, stack_trace, url, user_name, extra, created_at
                 FROM error_logs WHERE source = ? ORDER BY id DESC LIMIT ?"
            );
            if (!$stmt) throw new RuntimeException("Prepare: " . $conn->error);
            $stmt->bind_param("si", $source, $limit);
            $stmt->execute();
            $result = $stmt->get_result();
            $stmt->close();
        } else {
            $stmt = $conn->prepare(
                "SELECT id, source, level, message, file, line, stack_trace, url, user_name, extra, created_at
                 FROM error_logs ORDER BY id DESC LIMIT ?"
            );
            if (!$stmt) throw new RuntimeException("Prepare: " . $conn->error);
            $stmt->bind_param("i", $limit);
            $stmt->execute();
            $result = $stmt->get_result();
            $stmt->close();
        }

        $logs = [];
        while ($row = $result->fetch_assoc()) {
            $logs[] = [
                'id'         => (string)$row['id'],
                'source'     => $row['source'],
                'level'      => $row['level'],
                'message'    => $row['message'],
                'file'       => $row['file'],
                'line'       => $row['line'] ? (int)$row['line'] : null,
                'stackTrace' => $row['stack_trace'],
                'url'        => $row['url'],
                'userName'   => $row['user_name'],
                'extra'      => $row['extra'],
                'createdAt'  => $row['created_at'],
            ];
        }
        echo json_encode($logs);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch error logs', 'debug' => $e->getMessage()]);
    }
}

// ─── POST: Receive a JS/frontend error ───────────────────────────────────────
elseif ($method === 'POST') {
    try {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data) throw new RuntimeException("Invalid JSON body");

        $source     = 'javascript';
        $level      = $data['level']      ?? 'error';
        $message    = $data['message']    ?? 'Unknown JS error';
        $file       = $data['file']       ?? null;
        $line       = isset($data['line']) ? (int)$data['line'] : null;
        $stackTrace = $data['stackTrace'] ?? null;
        $url        = $data['url']        ?? null;
        $userName   = $data['userName']   ?? null;
        $extra      = isset($data['extra']) ? json_encode($data['extra']) : null;

        db_log_error($source, $level, $message, $file ?? '', $line ?? 0, $stackTrace ?? '', $url ?? '', $userName ?? '', $extra ?? '');
        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

// ─── DELETE: Clear all error logs ────────────────────────────────────────────
elseif ($method === 'DELETE') {
    try {
        $conn->query("TRUNCATE TABLE error_logs");
        echo json_encode(['success' => true, 'message' => 'Error logs cleared']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
