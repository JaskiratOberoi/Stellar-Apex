<?php
require_once __DIR__ . '/config.php';

// AES-256-GCM at-rest encryption for Aadhaar / PAN / bank account.
// Stored layout (VARBINARY): [ iv(12) | authTag(16) | ciphertext ].

function enc_key(): string {
    $key = hex2bin(app_config()['enc_key_hex']);
    if ($key === false || strlen($key) !== 32) {
        throw new RuntimeException('ENC_KEY must be 32 bytes (64 hex chars)');
    }
    return $key;
}

function encrypt_value(?string $plain): ?string {
    if ($plain === null || $plain === '') return null;
    $iv = random_bytes(12);
    $tag = '';
    $ct = openssl_encrypt($plain, 'aes-256-gcm', enc_key(), OPENSSL_RAW_DATA, $iv, $tag);
    if ($ct === false) throw new RuntimeException('encryption failed');
    return $iv . $tag . $ct;
}

function decrypt_value(?string $blob): ?string {
    if ($blob === null || strlen($blob) < 28) return null;
    $iv  = substr($blob, 0, 12);
    $tag = substr($blob, 12, 16);
    $ct  = substr($blob, 28);
    $pt = openssl_decrypt($ct, 'aes-256-gcm', enc_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return $pt === false ? null : $pt;
}
