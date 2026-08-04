<?php
// Minimal dependency-free JWT (HS256) — no composer needed on shared hosting.

function b64url(string $d): string {
    return rtrim(strtr(base64_encode($d), '+/', '-_'), '=');
}
function b64url_decode(string $d): string {
    return base64_decode(strtr($d, '-_', '+/')) ?: '';
}

function jwt_sign(array $payload, string $secret): string {
    $header = b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $body   = b64url(json_encode($payload));
    $sig    = b64url(hash_hmac('sha256', "$header.$body", $secret, true));
    return "$header.$body.$sig";
}

// Returns the payload array, or null if invalid/expired.
function jwt_verify(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $body, $sig] = $parts;
    $expected = b64url(hash_hmac('sha256', "$header.$body", $secret, true));
    if (!hash_equals($expected, $sig)) return null;
    $payload = json_decode(b64url_decode($body), true);
    if (!is_array($payload)) return null;
    if (isset($payload['exp']) && time() >= (int) $payload['exp']) return null;
    return $payload;
}
