<?php
declare(strict_types=1);

function ddproForwardWebsiteLead(array $lead): array
{
    $webhookUrl = getenv('DDPRO_WEBSITE_LEAD_WEBHOOK_URL');
    $secret = getenv('WEBSITE_WEBHOOK_SECRET');
    $urlParts = $webhookUrl ? parse_url($webhookUrl) : false;
    if (!$webhookUrl || !$secret || !$urlParts || ($urlParts['scheme'] ?? '') !== 'https' ||
        empty($urlParts['host']) || ($urlParts['path'] ?? '') !== '/webhooks/website/leads' ||
        isset($urlParts['user']) || isset($urlParts['pass']) || isset($urlParts['fragment'])) {
        throw new RuntimeException('Website lead forwarding is not configured.');
    }
    if (!function_exists('curl_init')) {
        throw new RuntimeException('Website lead forwarding requires PHP cURL.');
    }
    if (empty($lead['name']) && empty($lead['email']) && empty($lead['phone'])) {
        throw new InvalidArgumentException('A lead requires a name, email address, or phone number.');
    }

    $body = json_encode($lead, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($body === false || strlen($body) > 1_048_576) {
        throw new InvalidArgumentException('Website lead payload is invalid or too large.');
    }
    $signature = hash_hmac('sha256', $body, $secret);
    $handle = curl_init($webhookUrl);
    if ($handle === false) {
        throw new RuntimeException('Website lead forwarding could not start.');
    }

    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-DDPro-Signature: sha256=' . $signature,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $responseBody = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);

    if ($responseBody === false || $status < 200 || $status >= 300) {
        throw new RuntimeException('DDPro did not accept the website lead.');
    }
    $response = json_decode($responseBody, true);
    if (!is_array($response) || ($response['status'] ?? '') !== 'success') {
        throw new RuntimeException('DDPro returned an invalid website lead response.');
    }
    return [
        'status' => 'success',
        'duplicate' => (bool) ($response['duplicate'] ?? false),
    ];
}
