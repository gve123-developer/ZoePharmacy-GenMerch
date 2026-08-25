/**
 * Sends an audit log entry to the database via the PHP API.
 * @param userName - the name of the currently logged-in user
 * @param action - short action label, e.g. 'Login', 'POS Sale', 'Delete Product'
 * @param details - longer description of what happened
 */
export async function logAuditAction(
  userName: string,
  action: string,
  details: string
): Promise<void> {
  try {
    await fetch('/api/log_action.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, action, details }),
    });
  } catch (e) {
    // Silently fail — audit logging should not break the UI
    console.warn('Audit log failed:', e);
  }
}
