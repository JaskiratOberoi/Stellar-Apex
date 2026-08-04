<?php
// Masking — mirrors src/lib/utils.js so list/detail carry only masked values.

function mask_aadhaar(?string $v): ?string {
    return $v ? 'XXXX XXXX ' . substr($v, -4) : null;
}
function mask_pan(?string $v): ?string {
    return $v ? substr($v, 0, 2) . 'XXXXX' . substr($v, -3) : null;
}
function mask_account(?string $v): ?string {
    return $v ? '••••••' . substr($v, -4) : null;
}
