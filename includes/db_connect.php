<?php

// Report ALL errors
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

date_default_timezone_set('Asia/Manila');

/*
|--------------------------------------------------------------------------
| PostgreSQL Database Connection
|--------------------------------------------------------------------------
| Supports:
| 1. DATABASE_URL - commonly used by Heroku/Render/etc.
| 2. Individual DB_* environment variables - useful for local PostgreSQL
|--------------------------------------------------------------------------
*/

try {

    $databaseUrl = getenv('DATABASE_URL');

    if ($databaseUrl) {

        // PostgreSQL connection URL
        $dbparts = parse_url($databaseUrl);

        $host = $dbparts['host'] ?? '127.0.0.1';
        $port = $dbparts['port'] ?? '5432';
        $dbname = isset($dbparts['path'])
            ? ltrim($dbparts['path'], '/')
            : 'zoe_pos_system_db';

        $username = $dbparts['user'] ?? '';
        $password = getenv('DB_PASSWORD') ?: 'postgres';

    } else {

        // Local PostgreSQL configuration
        $host = getenv('DB_HOST') ?: '127.0.0.1';
        $port = getenv('DB_PORT') ?: '5432';
        $dbname = getenv('DB_NAME') ?: 'zoe_pos_system_db';
        $username = getenv('DB_USER') ?: 'postgres';
        $password = getenv('DB_PASSWORD') ?: 'postgres';
     }

    /*
    |--------------------------------------------------------------------------
    | PDO PostgreSQL Connection
    |--------------------------------------------------------------------------
    */

    $dsn = "pgsql:host={$host};port={$port};dbname={$dbname}";

    $conn = new PDO(
        $dsn,
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

} catch (PDOException $e) {

    error_log("[DB_CONNECT] " . $e->getMessage());

    if (!headers_sent()) {
        header("Content-Type: application/json; charset=UTF-8");
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Database connection error. Check server logs.'
    ]);

    exit;
}

// Install global error/exception/fatal handlers
include_once __DIR__ . '/error_logger.php';

?>