<?php
// Request/response helpers.

function json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function json_error(string $message, int $status = 400): void {
    json_response(['error' => $message], $status);
}

// Parsed JSON body (or empty array).
function json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Read a request header case-insensitively, coping with SAPIs that don't expose
// getallheaders() and Apache setups that rename Authorization.
function request_header(string $name): ?string {
    $name = strtolower($name);
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            if (strtolower($k) === $name) return $v;
        }
    }
    $server = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (isset($_SERVER[$server])) return $_SERVER[$server];
    if ($name === 'authorization' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    return null;
}

function client_ip(): ?string {
    return $_SERVER['REMOTE_ADDR'] ?? null;
}
