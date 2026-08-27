<?php

/**
 * Email Sender Helper for Zoe Pharmacy & General Merchandise
 */

function send_reset_email($to_email, $to_name, $token)
{
    $subject = "Zoe Pharmacy POS - Password Reset Code";

    // Plain-text email body
    $message = "Hello " . $to_name . ",\r\n\r\n";
    $message .= "We received a request to reset your password.\r\n";
    $message .= "Use the verification code below to reset it:\r\n\r\n";
    $message .= "RESET CODE: " . $token . "\r\n\r\n";
    $message .= "This code will expire in 15 minutes.\r\n\r\n";
    $message .= "If you did not request this password reset, please ignore this email.\r\n\r\n";
    $message .= "Zoe Pharmacy & General Merchandise\r\n";

    // Load PHPMailer
    require_once __DIR__ . '/../PHPMailer/Exception.php';
    require_once __DIR__ . '/../PHPMailer/PHPMailer.php';
    require_once __DIR__ . '/../PHPMailer/SMTP.php';

    $smtpUsername = getenv('SMTP_USERNAME');
    $smtpPassword = getenv('SMTP_PASSWORD');

    if (!$smtpUsername || !$smtpPassword) {
        error_log(
            "[SMTP_CONFIG_ERROR] SMTP_USERNAME or SMTP_PASSWORD is missing."
        );

        return false;
    }

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);

    try {

        // SMTP configuration
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;

        // Credentials come from Heroku Config Vars
        $mail->Username = $smtpUsername;
        $mail->Password = $smtpPassword;

        $mail->SMTPSecure =
            PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;

        $mail->Port = 587;

        // Sender
        $mail->setFrom(
            $smtpUsername,
            'Zoe Pharmacy & General Merchandise'
        );

        // Recipient
        $mail->addAddress(
            $to_email,
            $to_name
        );

        // Email content
        $mail->isHTML(false);
        $mail->CharSet = 'UTF-8';
        $mail->Subject = $subject;
        $mail->Body = $message;

        $mail->send();

        return true;

    } catch (Throwable $e) {

        error_log(
            "[SMTP_MAIL_ERROR] " .
            $e->getMessage() .
            " | PHPMailer: " .
            $mail->ErrorInfo
        );

        return false;
    }
}