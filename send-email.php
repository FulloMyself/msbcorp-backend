<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Get JSON input
$json = file_get_contents('php://input');
$data = json_decode($json, true);

// Validate input
if (!isset($data['to']) || !isset($data['subject']) || !isset($data['message'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

// Email configuration
$to = $data['to'];
$subject = $data['subject'];
$message = $data['message'];

// Additional headers
$headers = array(
    'From: MSB Finance <info@msbfinance.co.za>',
    'Reply-To: info@msbfinance.co.za',
    'X-Mailer: PHP/' . phpversion(),
    'Content-Type: text/html; charset=UTF-8'
);

try {
    // Send email using PHP's mail function
    $sent = mail($to, $subject, $message, implode("\r\n", $headers));
    
    if ($sent) {
        echo json_encode([
            'success' => true,
            'message' => 'Email sent successfully'
        ]);
    } else {
        throw new Exception('Failed to send email');
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Email sending failed',
        'message' => $e->getMessage()
    ]);
}
?>