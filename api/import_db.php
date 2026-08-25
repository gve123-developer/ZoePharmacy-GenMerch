<?php
// Temporary script to import the database schema to JawsDB
error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once '../includes/db_connect.php';

$sqlFile = '../inventory_system_setup.sql';

if (!file_exists($sqlFile)) {
    die("Error: SQL file 'inventory_system_setup.sql' not found in the root directory.");
}

$sql = file_get_contents($sqlFile);

echo "<h3>Importing Database...</h3>";

if ($conn->multi_query($sql)) {
    do {
        // Store first result set (if any) to prevent "Commands out of sync" error
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
?>
