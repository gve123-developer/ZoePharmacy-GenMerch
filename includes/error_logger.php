<?php
/**
 * error_logger.php
 * Global PHP error/exception/fatal error handler
 * Compatible with PostgreSQL using PDO.
 */

function db_log_error(
    string $source,
    string $level,
    string $message,
    string $file       = '',
    int    $line       = 0,
    string $stackTrace = '',
    string $url        = '',
    string $userName   = '',
    string $extra      = ''
): void {
    global $conn;

    // Make sure a PDO connection exists
    if (!isset($conn) || !($conn instanceof PDO)) {
        return;
    }

    try {
        $stmt = $conn->prepare(
            "INSERT INTO error_logs
            (source, level, message, file, line, stack_trace, url, user_name, extra)
            VALUES
            (:source, :level, :message, :file, :line, :stack_trace, :url, :user_name, :extra)"
        );

        if (!$stmt) {
            return;
        }

        $message    = mb_substr($message, 0, 5000);
        $file       = mb_substr($file, 0, 500);
        $stackTrace = mb_substr($stackTrace, 0, 10000);
        $url        = mb_substr($url, 0, 1000);
        $extra      = mb_substr($extra, 0, 5000);
        $userName   = mb_substr($userName, 0, 100);

        $stmt->execute([
            ':source'     => $source,
            ':level'      => $level,
            ':message'    => $message,
            ':file'       => $file,
            ':line'       => $line,
            ':stack_trace'=> $stackTrace,
            ':url'        => $url,
            ':user_name'  => $userName,
            ':extra'      => $extra
        ]);

    } catch (Throwable $t) {
        // Never allow the error logger to crash the application
        error_log(
            "[error_logger] Could not write to error_logs: " .
            $t->getMessage()
        );
    }
}

function php_error_level(int $errno): string {
    $map = [
        E_ERROR             => 'fatal',
        E_WARNING           => 'warning',
        E_NOTICE            => 'notice',
        E_USER_ERROR        => 'fatal',
        E_USER_WARNING      => 'warning',
        E_USER_NOTICE       => 'notice',
        E_RECOVERABLE_ERROR => 'error',
        E_DEPRECATED        => 'deprecated',
        E_USER_DEPRECATED   => 'deprecated',
    ];

    return $map[$errno] ?? 'error';
}


// PHP error handler
set_error_handler(
    function(
        int $errno,
        string $errstr,
        string $errfile,
        int $errline
    ): bool {

        if (!(error_reporting() & $errno)) {
            return false;
        }

        $level = php_error_level($errno);
        $url   = $_SERVER['REQUEST_URI'] ?? '';

        db_log_error(
            'php',
            $level,
            $errstr,
            $errfile,
            $errline,
            '',
            $url
        );

        error_log(
            "[PHP $level] $errstr in $errfile on line $errline"
        );

        return false;
    }
);


// Exception handler
set_exception_handler(
    function(Throwable $e): void {

        $trace = $e->getTraceAsString();
        $url   = $_SERVER['REQUEST_URI'] ?? '';
        $msg   = get_class($e) . ': ' . $e->getMessage();

        db_log_error(
            'php',
            'exception',
            $msg,
            $e->getFile(),
            $e->getLine(),
            $trace,
            $url
        );

        if (!headers_sent()) {
            http_response_code(500);
        }
    }
);


// Fatal error handler
register_shutdown_function(
    function(): void {

        $error = error_get_last();

        if (
            $error &&
            in_array(
                $error['type'],
                [
                    E_ERROR,
                    E_PARSE,
                    E_CORE_ERROR,
                    E_COMPILE_ERROR
                ],
                true
            )
        ) {

            $url = $_SERVER['REQUEST_URI'] ?? '';

            db_log_error(
                'php',
                'fatal',
                $error['message'],
                $error['file'],
                $error['line'],
                '',
                $url
            );
        }
    }
);