<?php
// Temporary script to import the database schema to JawsDB
error_reporting(E_ALL);
ini_set('display_errors', '1');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    require_once '../includes/db_connect.php';

    $sqlFile = '../inventory_system_setup.sql';
    if (!file_exists($sqlFile)) {
        die("Error: SQL file 'inventory_system_setup.sql' not found.");
    }
    
    $sql = file_get_contents($sqlFile);
    echo "<h3>Importing Database...</h3>";

    if ($conn->multi_query($sql)) {
        do {
            if ($result = $conn->store_result()) {
                $result->free();
            }
        } while ($conn->more_results() && $conn->next_result());
        echo "<h2 style='color:green;'>✅ Database imported successfully!</h2>";
        echo "<p>You can now go back to your app.</p>";
    } else {
        echo "<h2 style='color:red;'>❌ Error importing database:</h2>";
        echo "<p>" . $conn->error . "</p>";
    }

    $conn->close();
} catch (Exception $e) {
    http_response_code(200); // Prevent 500 error so we can read it
    echo "<h1>Exception Caught:</h1><pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
} catch (Error $e) {
    http_response_code(200);
    echo "<h1>Fatal Error Caught:</h1><pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
}
?>
