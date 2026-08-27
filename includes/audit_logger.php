<?php
/**
 * log_action — Insert a row into audit_logs.
 * Failures are written to the PHP error log but never crash the caller.
 */

function log_action(PDO $conn, string $user_name, string $action, string $details): void
{
    try {

        $stmt = $conn->prepare(
            "INSERT INTO audit_logs (user_name, action, details)
             VALUES (:user_name, :action, :details)"
        );

        $stmt->execute([
            ':user_name' => $user_name,
            ':action' => $action,
            ':details' => $details
        ]);

    } catch (Exception $e) {

        // Log to server error log — never bubble up to API response
        error_log(
            "[audit_logger.php] Failed to write audit log: " .
            $e->getMessage()
        );
    }
}
?>