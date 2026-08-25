<?php
// Report ALL errors including notices so the error logger captures everything
error_reporting(E_ALL);
ini_set('display_errors', '0');  // Don't show errors to browser — log them to DB instead
ini_set('log_errors', '1');

// Support Heroku JawsDB URL automatically
$jawsdb_url = getenv('JAWSDB_URL');

if ($jawsdb_url) {
    $dbparts = parse_url($jawsdb_url);
    $servername = $dbparts['host'];
    $username = $dbparts['user'];
    $password = $dbparts['pass'];
    $dbname = ltrim($dbparts['path'], '/');
    $port = isset($dbparts['port']) ? $dbparts['port'] : "3306";
} else {
    // Fallback for Localhost (XAMPP)
    $servername = getenv('DB_HOST') ?: "127.0.0.1";
    $username = getenv('DB_USER') ?: "root";
    $password = getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : "";
    $dbname = getenv('DB_NAME') ?: "pos_inventory_system_db";
    $port = getenv('DB_PORT') ?: "3306";
}

try {
    $conn = new mysqli($servername, $username, $password, $dbname, (int) $port);

    if ($conn->connect_error) {
        throw new RuntimeException("DB connection failed: " . $conn->connect_error);
    }

    $conn->set_charset("utf8mb4");
    $conn->query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    date_default_timezone_set('Asia/Manila');
    $conn->query("SET time_zone = '+08:00'");

} catch (RuntimeException $e) {
    error_log("[DB_CONNECT] " . $e->getMessage());
    if (!headers_sent()) {
        header("Content-Type: application/json; charset=UTF-8");
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection error. Check server logs.']);
    exit;
}

// Install global error/exception/fatal handlers → log everything to error_logs table
include_once __DIR__ . '/error_logger.php';
?>