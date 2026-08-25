<?php
/**
 * Email Sender Helper for Zoe Pharmacy POS
 */

function send_reset_email($to_email, $to_name, $token) {
    $subject = "Zoe Pharmacy POS - Password Reset Code";
    
    // Email body content
    $message = "Hello " . htmlspecialchars($to_name) . ",\r\n\r\n";
    $message .= "We received a request to reset your password. Use the code below to reset it:\r\n\r\n";
    $message .= "RESET CODE: $token\r\n\r\n";
    $message .= "This code will expire in 15 minutes.\r\n\r\n";
    $message .= "If you did not request this, please ignore this email.\r\n";

    // =========================================================================
    // METHOD 1: Standard PHP mail() (Default fallback, often blocked by hosts)
    // =========================================================================
    $headers = "From: no-reply@zoepharmacy.com\r\n";
    $headers .= "Reply-To: support@zoepharmacy.com\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();
    
    $sent = @mail($to_email, $subject, $message, $headers);

    // =========================================================================
    // METHOD 2: Resend API (Highly Recommended for production)
    // To use this: Signup for a free account at https://resend.com, get an API Key,
    // and uncomment the block below.
    // =========================================================================
    /*
    $resend_api_key = "re_your_api_key_here"; // Put your API Key here
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.resend.com/emails');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'from' => 'Zoe Pharmacy <onboarding@resend.dev>', // Update to your domain sender once verified
        'to' => [$to_email],
        'subject' => $subject,
        'text' => $message,
        'html' => nl2br(htmlspecialchars($message))
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $resend_api_key,
        'Content-Type: application/json'
    ]);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $sent = ($http_code === 200 || $http_code === 201);
    */

    // =========================================================================
    // METHOD 3: SMTP with PHPMailer (Alternative)
    // To use this, you'll need to upload the PHPMailer src folder to your project root.
    // =========================================================================
    
    require_once __DIR__ . '/../PHPMailer/Exception.php';
    require_once __DIR__ . '/../PHPMailer/PHPMailer.php';
    require_once __DIR__ . '/../PHPMailer/SMTP.php';
    
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com'; // Gmail SMTP server
        $mail->SMTPAuth   = true;
        $mail->Username   = 'gipayavincee@gmail.com';
        $mail->Password   = 'bagt woar asln lszz'; // Google App Password, not regular password
        $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom('gipayavincee@gmail.com', 'Zoe Pharmacy POS');
        $mail->addAddress($to_email, $to_name);

        $mail->isHTML(false);
        $mail->Subject = $subject;
        $mail->Body    = $message;

        $mail->send();
        $sent = true;
    } catch (Exception $e) {
        error_log("[SMTP_MAIL_ERROR] " . $mail->ErrorInfo);
        $sent = false;
    }
    

    return $sent;
}
