<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/config.php';

function issue_token(array $user): string {
    $c = app_config();
    return jwt_sign([
        'uid'    => (int) $user['id'],
        'role'   => $user['role'],
        'entity' => $user['entity_id'],
        'iat'    => time(),
        'exp'    => time() + $c['jwt_ttl'],
    ], $c['jwt_secret']);
}

// Returns the authenticated user row, or sends 401 and exits.
function require_auth(): array {
    $header = request_header('Authorization') ?? '';
    if (stripos($header, 'Bearer ') !== 0) json_error('Missing token', 401);
    $token = substr($header, 7);
    $payload = jwt_verify($token, app_config()['jwt_secret']);
    if (!$payload) json_error('Invalid or expired token', 401);

    $stmt = db()->prepare('SELECT id, email, name, role, entity_id, is_active FROM users WHERE id = ?');
    $stmt->execute([$payload['uid']]);
    $user = $stmt->fetch();
    if (!$user || !$user['is_active']) json_error('Invalid session', 401);
    return $user;
}

function require_role(array $user, string ...$roles): void {
    if (!in_array($user['role'], $roles, true)) json_error('Forbidden', 403);
}

/**
 * The tenant key for this request — the ONLY place entity scope is decided.
 *  - entity_admin / entity_hr / viewer: their own entity, always (client can't
 *    override; the X-Entity header is ignored for them).
 *  - super_admin: must name an entity via X-Entity (validated).
 * Sends an error + exits if scope can't be resolved.
 */
function resolve_entity(array $user): string {
    if ($user['role'] === 'super_admin') {
        $chosen = request_header('X-Entity');
        if (!$chosen) json_error('super_admin must select an entity (X-Entity header)', 400);
        $stmt = db()->prepare('SELECT id FROM entities WHERE id = ?');
        $stmt->execute([$chosen]);
        if (!$stmt->fetch()) json_error('Unknown entity', 400);
        return $chosen;
    }
    return $user['entity_id'];
}
