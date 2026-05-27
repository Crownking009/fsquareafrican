<?php
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo 'Method not allowed.';
    exit;
}

$name = clean_text($_POST['name'] ?? '');
$email = filter_var(trim((string)($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL);
$subject = clean_text($_POST['msg_subject'] ?? 'Website enquiry');
$phone = clean_text($_POST['phone_number'] ?? '');
$message = clean_textarea($_POST['message'] ?? '');

if ($name === '' || !$email || $message === '') {
    http_response_code(400);
    echo 'Please enter your name, a valid email address, and a message.';
    exit;
}

$to = 'info@fsquareafricanfood.com';
$mailSubject = 'Website enquiry: ' . ($subject !== '' ? $subject : 'F-Square African Food');
$body = implode("\n", [
    'New enquiry from fsquareafricanfood.com',
    '',
    'Name: ' . $name,
    'Email: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : 'Not provided'),
    'Subject: ' . ($subject !== '' ? $subject : 'Not provided'),
    '',
    'Message:',
    $message,
]);

$headers = [
    'From: F-Square African Food <no-reply@fsquareafricanfood.com>',
    'Reply-To: ' . $name . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: PHP/' . phpversion(),
];

if (@mail($to, $mailSubject, $body, implode("\r\n", $headers))) {
    echo 'success';
    exit;
}

http_response_code(500);
echo 'Message could not be sent. Please call or WhatsApp us instead.';

function clean_text($value): string
{
    return trim(preg_replace('/[\r\n\t]+/', ' ', strip_tags((string)$value)) ?? '');
}

function clean_textarea($value): string
{
    return trim(strip_tags((string)$value));
}
