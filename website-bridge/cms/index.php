<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function ddproIsSecureRequest(): bool
{
    $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
    return ($https !== '' && $https !== 'off' && $https !== '0') ||
        (string) ($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function ddproRespond(int $status, $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ddproError(int $status, string $message): void
{
    ddproRespond($status, ['status' => 'error', 'message' => $message]);
}

if (!ddproIsSecureRequest()) {
    ddproError(400, 'HTTPS is required.');
}

$configuredToken = getenv('WEBSITE_CMS_API_TOKEN');
if (!$configuredToken) {
    ddproError(503, 'CMS provider is not configured.');
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$normalizedHeaders = [];
foreach ($headers as $name => $value) {
    $normalizedHeaders[strtolower($name)] = $value;
}
$authorization = $normalizedHeaders['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
if (!preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches) ||
    !hash_equals($configuredToken, $matches[1])) {
    ddproError(401, 'CMS authorization failed.');
}

$adapterPath = getenv('DDPRO_CMS_ADAPTER_FILE');
$adapterRealPath = $adapterPath ? realpath($adapterPath) : false;
$documentRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');
if (!$adapterRealPath || !$documentRoot ||
    $adapterRealPath === $documentRoot ||
    strpos($adapterRealPath, rtrim($documentRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR) === 0 ||
    !is_file($adapterRealPath) || !is_readable($adapterRealPath)) {
    ddproError(503, 'CMS storage adapter is not configured.');
}

try {
    require_once $adapterRealPath;
} catch (Throwable $error) {
    error_log('DDPro CMS adapter could not be loaded.');
    ddproError(503, 'CMS storage adapter is unavailable.');
}

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$scriptDirectory = trim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$requestPath = trim((string) $requestPath, '/');
if ($scriptDirectory !== '' && strpos($requestPath, $scriptDirectory . '/') === 0) {
    $requestPath = substr($requestPath, strlen($scriptDirectory) + 1);
}
$segments = explode('/', $requestPath);
$contentType = $segments[0] ?? '';
$id = count($segments) === 2 ? rawurldecode($segments[1]) : null;
$allowedContentTypes = ['pages', 'products', 'references'];
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? '');

if (!in_array($contentType, $allowedContentTypes, true) ||
    count($segments) > 2 ||
    ($id !== null && ($id === '' || strlen($id) > 500 || preg_match('/[\x00-\x1F\x7F]/', $id)))) {
    ddproError(404, 'CMS resource was not found.');
}

if (!in_array($method, ['GET', 'POST', 'PATCH'], true) ||
    ($method === 'POST' && $id !== null) ||
    ($method === 'PATCH' && $id === null)) {
    header('Allow: GET, POST, PATCH');
    ddproError(405, 'CMS method is not supported for this resource.');
}

$body = null;
if ($method === 'POST' || $method === 'PATCH') {
    $rawBody = file_get_contents('php://input', false, null, 0, 1_048_577);
    if ($rawBody === false || strlen($rawBody) > 1_048_576) {
        ddproError(413, 'CMS request body is too large.');
    }
    $decoded = json_decode($rawBody);
    if (json_last_error() !== JSON_ERROR_NONE || !is_object($decoded)) {
        ddproError(400, 'CMS request body must be a JSON object.');
    }
    $body = get_object_vars($decoded);
}

try {
    if ($method === 'GET' && $id === null && function_exists('ddproCmsList')) {
        $result = ddproCmsList($contentType);
    } elseif ($method === 'GET' && function_exists('ddproCmsGet')) {
        $result = ddproCmsGet($contentType, $id);
        if ($result === null) {
            ddproError(404, 'CMS record was not found.');
        }
    } elseif ($method === 'POST' && function_exists('ddproCmsCreate')) {
        $result = ddproCmsCreate($contentType, $body);
    } elseif ($method === 'PATCH' && function_exists('ddproCmsUpdate')) {
        $result = ddproCmsUpdate($contentType, $id, $body);
    } else {
        ddproError(503, 'CMS storage adapter does not implement the required operation.');
    }
} catch (Throwable $error) {
    error_log('DDPro CMS storage operation failed.');
    ddproError(500, 'CMS operation failed.');
}

if ($method === 'POST') {
    ddproRespond(201, $result);
}
if ($method === 'PATCH') {
    ddproRespond(200, $result);
}
ddproRespond(200, $result);
