<?php
/**
 * log_action — Insert a row into audit_logs.
 * Failures are written to the PHP error log but never crash the caller.
 */
function log_action(mysqli $conn, string $user_name, string $action, string $details): void {
    try {
        $stmt = $conn->prepare("INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)");
        if (!$stmt) {
            throw new RuntimeException("Prepare audit log: " . $conn->error);
        }
        $stmt->bind_param("sss", $user_name, $action, $details);
        if (!$stmt->execute()) {
            throw new RuntimeException("Execute audit log: " . $stmt->error);
        }
        $stmt->close();
    } catch (Exception $e) {
        // Log to server error log — never bubble up to API response
        error_log("[audit_logger.php] Failed to write audit log: " . $e->getMessage());
    }
}
?>
