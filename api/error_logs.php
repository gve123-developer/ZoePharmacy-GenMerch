<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-User-Name");
header("Content-Type: application/json; charset=UTF-8");

include '../includes/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    exit();
}


// ============================================================
// GET: Fetch error logs
// ============================================================
if ($method === 'GET') {

    try {

        $source = $_GET['source'] ?? 'all';

        $limit = (int)($_GET['limit'] ?? 200);

        if ($limit <= 0) {
            $limit = 200;
        }

        if ($limit > 500) {
            $limit = 500;
        }

        if ($source !== 'all') {

            $stmt = $conn->prepare(
                "SELECT
                    id,
                    source,
                    level,
                    message,
                    file,
                    line,
                    stack_trace,
                    url,
                    user_name,
                    extra,
                    created_at
                 FROM error_logs
                 WHERE source = :source
                 ORDER BY id DESC
                 LIMIT :limit"
            );

            $stmt->bindValue(
                ':source',
                $source,
                PDO::PARAM_STR
            );

            $stmt->bindValue(
                ':limit',
                $limit,
                PDO::PARAM_INT
            );

            $stmt->execute();

        } else {

            $stmt = $conn->prepare(
                "SELECT
                    id,
                    source,
                    level,
                    message,
                    file,
                    line,
                    stack_trace,
                    url,
                    user_name,
                    extra,
                    created_at
                 FROM error_logs
                 ORDER BY id DESC
                 LIMIT :limit"
            );

            $stmt->bindValue(
                ':limit',
                $limit,
                PDO::PARAM_INT
            );

            $stmt->execute();
        }

        $logs = [];

        while (
            $row =
            $stmt->fetch(PDO::FETCH_ASSOC)
        ) {

            $logs[] = [
                'id' => (string)$row['id'],
                'source' => $row['source'],
                'level' => $row['level'],
                'message' => $row['message'],
                'file' => $row['file'],
                'line' =>
                    $row['line'] !== null
                    ? (int)$row['line']
                    : null,
                'stackTrace' => $row['stack_trace'],
                'url' => $row['url'],
                'userName' => $row['user_name'],
                'extra' => $row['extra'],
                'createdAt' => $row['created_at']
            ];
        }

        echo json_encode($logs);

    } catch (Throwable $e) {

        error_log(
            "[error_logs.php GET] " .
            $e->getMessage()
        );

        http_response_code(500);

        echo json_encode([
            'success' => false,
            'message' => 'Failed to fetch error logs',
            'debug' => $e->getMessage()
        ]);
    }
}


// ============================================================
// POST: Receive frontend / JavaScript error
// ============================================================
elseif ($method === 'POST') {

    try {

        $data = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (!is_array($data)) {
            throw new RuntimeException(
                "Invalid JSON body"
            );
        }

        $source = 'javascript';

        $level =
            $data['level']
            ?? 'error';

        $message =
            $data['message']
            ?? 'Unknown JS error';

        $file =
            $data['file']
            ?? '';

        $line =
            isset($data['line'])
            ? (int)$data['line']
            : 0;

        $stackTrace =
            $data['stackTrace']
            ?? '';

        $url =
            $data['url']
            ?? '';

        $userName =
            $data['userName']
            ?? '';

        $extra =
            isset($data['extra'])
            ? json_encode($data['extra'])
            : '';

        db_log_error(
            $source,
            $level,
            $message,
            $file,
            $line,
            $stackTrace,
            $url,
            $userName,
            $extra
        );

        echo json_encode([
            'success' => true
        ]);

    } catch (Throwable $e) {

        error_log(
            "[error_logs.php POST] " .
            $e->getMessage()
        );

        http_response_code(500);

        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}


// ============================================================
// DELETE: Clear error logs
// ============================================================
elseif ($method === 'DELETE') {

    try {

        $conn->exec(
            "TRUNCATE TABLE error_logs
             RESTART IDENTITY"
        );

        echo json_encode([
            'success' => true,
            'message' => 'Error logs cleared'
        ]);

    } catch (Throwable $e) {

        error_log(
            "[error_logs.php DELETE] " .
            $e->getMessage()
        );

        http_response_code(500);

        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
}


else {

    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
}
?>