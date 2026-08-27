<?php
// Temporary script to import the PostgreSQL database schema

error_reporting(E_ALL);
ini_set('display_errors', '1');

try {

    require_once '../includes/db_connect.php';

    // PostgreSQL-compatible SQL file
    $sqlFile = '../inventory_system_setup_postgresql.sql';

    if (!file_exists($sqlFile)) {
        die(
            "Error: SQL file 'inventory_system_setup_postgresql.sql' not found."
        );
    }

    $sql = file_get_contents($sqlFile);

    if ($sql === false) {
        die("Error: Unable to read PostgreSQL SQL file.");
    }

    echo "<h3>Importing PostgreSQL Database...</h3>";

    // Execute the complete PostgreSQL script
    $conn->exec($sql);

    echo "<h2 style='color:green;'>✅ PostgreSQL database imported successfully!</h2>";
    echo "<p>The database schema and initial data have been created.</p>";

} catch (PDOException $e) {

    http_response_code(200);

    echo "<h2 style='color:red;'>❌ PostgreSQL Database Error</h2>";
    echo "<pre>" .
        htmlspecialchars($e->getMessage()) .
        "</pre>";

} catch (Throwable $e) {

    http_response_code(200);

    echo "<h2 style='color:red;'>❌ Error</h2>";
    echo "<pre>" .
        htmlspecialchars($e->getMessage()) .
        "</pre>";
}
?>