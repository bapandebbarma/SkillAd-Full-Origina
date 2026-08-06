<?php
/**
 * Server-side Open Graph / Twitter / JSON-LD for shared provider links.
 * Used when the marketing site is hosted on Apache (Hostinger) separately from the API.
 * Browsers still load the SPA; crawlers are rewritten here via .htaccess.
 */
declare(strict_types=1);

header('X-Content-Type-Options: nosniff');

$id = isset($_GET['id']) ? trim((string) $_GET['id']) : '';
if ($id === '' || !preg_match('/^[A-Za-z0-9_-]{1,64}$/', $id)) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Provider unavailable | SkillAd</title></head><body><p>Provider unavailable.</p></body></html>';
    exit;
}

$apiBase = getenv('SKILLAD_API_URL') ?: 'https://api.skillad.in';
$apiBase = rtrim($apiBase, '/');
$url = $apiBase . '/api/providers/' . rawurlencode($id) . '/public/preview';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_CONNECTTIMEOUT => 4,
    CURLOPT_HTTPHEADER => [
        'Accept: text/html',
        'User-Agent: SkillAd-Hostinger-OG/1.0',
    ],
]);
$html = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($html === false || $status < 200 || $status >= 500 || $html === '') {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: public, max-age=60');
    $safe = htmlspecialchars($err !== '' ? 'Temporarily unavailable.' : 'Provider unavailable.', ENT_QUOTES, 'UTF-8');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Provider unavailable | SkillAd</title>'
        . '<meta property="og:title" content="Provider unavailable | SkillAd" />'
        . '<meta property="og:description" content="This provider is no longer available on SkillAd." />'
        . '<meta property="og:site_name" content="SkillAd" />'
        . '</head><body><p>' . $safe . '</p><p><a href="https://skillad.in/">Open SkillAd</a></p></body></html>';
    exit;
}

http_response_code($status >= 200 && $status < 400 ? $status : 404);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=120');
echo $html;
