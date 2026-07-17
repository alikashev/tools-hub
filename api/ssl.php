<?php
/**
 * SSL/TLS Tools API
 *
 * GET /api/ssl?action=check&domain=example.com&port=443
 * GET /api/ssl?action=chain&domain=example.com&port=443
 * GET /api/ssl?action=tls&domain=example.com&port=443
 * GET /api/ssl?action=hsts&domain=example.com
 */

$calledDirectly = !defined('API_ROUTER_ACTIVE');
if ($calledDirectly) {
    require_once __DIR__ . '/../config.php';
    require_once __DIR__ . '/../includes/database.php';
    require_once __DIR__ . '/../includes/response.php';
    require_once __DIR__ . '/../includes/functions.php';
    cors();
}

@set_time_limit(90);

$action = $_GET['action'] ?? '';
$domain = isset($_GET['domain']) ? strtolower(trim($_GET['domain'])) : '';
$port   = isset($_GET['port']) ? (int) $_GET['port'] : 443;

if ($domain === '') {
    Response::validationError(['domain' => 'Domain is required.']);
}
if (!preg_match('/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/i', $domain)) {
    Response::validationError(['domain' => 'Invalid domain name.']);
}
if ($port < 1 || $port > 65535) {
    Response::validationError(['port' => 'Port must be between 1 and 65535.']);
}

switch ($action) {
    case 'check':
        doCertCheck($domain, $port);
        break;
    case 'chain':
        doChainCheck($domain, $port);
        break;
    case 'tls':
        doTlsCheck($domain, $port);
        break;
    case 'hsts':
        doHstsCheck($domain);
        break;
    case 'audit':
        doAudit($domain, $port);
        break;
    default:
        Response::validationError(['action' => 'Invalid action. Use: check, chain, tls, hsts, audit.']);
}

// ─── Certificate Checker ─────────────────────────────────────────────────────
function doCertCheck(string $domain, int $port): void
{
    $stream = @stream_context_create([
        'ssl' => [
            'capture_peer_cert'   => true,
            'capture_peer_cert_chain' => true,
            'verify_peer'         => false,
            'verify_peer_name'    => false,
            'allow_self_signed'   => true,
        ],
    ]);

    $errno = 0;
    $errstr = '';
    $conn = @stream_socket_client("ssl://{$domain}:{$port}", $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $stream);

    if (!$conn) {
        Response::error("Could not connect to {$domain}:{$port}. {$errstr}");
    }

    $cert = stream_context_get_params($stream);
    $peer = $cert['options']['ssl']['peer_certificate'] ?? null;

    if (!$peer) {
        fclose($conn);
        Response::error("No certificate returned from {$domain}:{$port}.");
    }

    $parsed = openssl_x509_parse($peer);
    if (!$parsed) {
        fclose($conn);
        Response::error('Failed to parse certificate.');
    }

    // Check expiry
    $now = time();
    $validFrom = $parsed['validFrom_time_t'] ?? 0;
    $validTo = $parsed['validTo_time_t'] ?? 0;
    $daysLeft = (int) floor(($validTo - $now) / 86400);
    $isValid = $now >= $validFrom && $now <= $validTo;

    // Subject info
    $subject = $parsed['subject'] ?? [];
    $issuer  = $parsed['issuer'] ?? [];

    $cn = $subject['CN'] ?? '';
    $o  = $subject['O'] ?? '';
    $ou = $subject['OU'] ?? '';
    $l  = $subject['L'] ?? '';
    $st = $subject['ST'] ?? '';
    $c  = $subject['C'] ?? '';

    $issuerCn = $issuer['CN'] ?? '';
    $issuerO  = $issuer['O'] ?? '';

    // SANs
    $sans = [];
    if (isset($parsed['extensions']['subjectAltName'])) {
        $sanStr = $parsed['extensions']['subjectAltName'];
        if (preg_match_all('/DNS:([^,]+)/', $sanStr, $m)) {
            $sans = array_map('trim', $m[1]);
        }
    }

    // Serial & fingerprint
    $serial = $parsed['serialNumberHex'] ?? $parsed['serialNumber'] ?? '';
    $fingerprint = '';
    if (isset($parsed['serialNumber'])) {
        $fingerprint = openssl_x509_fingerprint($peer, 'sha256');
    }

    // Signature algorithm
    $sigAlg = $parsed['signatureTypeSN'] ?? $parsed['signatureType'] ?? 'Unknown';

    $selfSigned = (strcasecmp($cn, $issuerCn) === 0 && $o === $issuerO);
    $coversDomain = false;
    foreach ($sans as $san) {
        if ($san === $domain) { $coversDomain = true; break; }
        if (str_starts_with($san, '*.')) {
            $wildcard = substr($san, 2);
            if ($domain === $wildcard || preg_match('/\.' . preg_quote($wildcard, '/') . '$/', $domain)) {
                $coversDomain = true;
                break;
            }
        }
    }

    fclose($conn);

    Response::success([
        'domain'       => $domain,
        'port'         => $port,
        'valid'        => $isValid,
        'self_signed'  => $selfSigned,
        'days_left'    => $daysLeft,
        'valid_from'   => gmdate('c', $validFrom),
        'valid_to'     => gmdate('c', $validTo),
        'subject'      => [
            'common_name'       => $cn,
            'organization'      => $o,
            'organizational_unit' => $ou,
            'city'              => $l,
            'state'             => $st,
            'country'           => $c,
        ],
        'issuer'       => [
            'common_name' => $issuerCn,
            'organization' => $issuerO,
        ],
        'sans'             => $sans,
        'covers_domain'    => $coversDomain,
        'serial'           => $serial,
        'fingerprint_sha256' => $fingerprint,
        'signature_algorithm' => $sigAlg,
    ]);
}

// ─── Chain Validator ─────────────────────────────────────────────────────────
function doChainCheck(string $domain, int $port): void
{
    $stream = @stream_context_create([
        'ssl' => [
            'capture_peer_cert'       => true,
            'capture_peer_cert_chain' => true,
            'verify_peer'             => false,
            'verify_peer_name'        => false,
            'allow_self_signed'       => true,
        ],
    ]);

    $errno = 0;
    $errstr = '';
    $conn = @stream_socket_client("ssl://{$domain}:{$port}", $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $stream);

    if (!$conn) {
        Response::error("Could not connect to {$domain}:{$port}. {$errstr}");
    }

    $params = stream_context_get_params($stream);
    $peerCert  = $params['options']['ssl']['peer_certificate'] ?? null;
    $peerChain = $params['options']['ssl']['peer_certificate_chain'] ?? [];

    fclose($conn);

    if (!$peerCert) {
        Response::error("No certificate returned from {$domain}:{$port}.");
    }

    $chain = [];
    $certs = $peerChain ?: [$peerCert];
    foreach ($certs as $idx => $certPem) {
        $parsed = openssl_x509_parse($certPem);
        if (!$parsed) continue;

        $subject = $parsed['subject'] ?? [];
        $issuer  = $parsed['issuer'] ?? [];
        $now = time();

        $pemOut = '';
        @openssl_x509_export($certPem, $pemOut);

        $chain[] = [
            'index'          => $idx,
            'common_name'    => $subject['CN'] ?? '',
            'organization'   => $subject['O'] ?? '',
            'issuer_cn'      => $issuer['CN'] ?? '',
            'issuer_org'     => $issuer['O'] ?? '',
            'valid_from'     => gmdate('c', $parsed['validFrom_time_t'] ?? 0),
            'valid_to'       => gmdate('c', $parsed['validTo_time_t'] ?? 0),
            'is_valid'       => $now >= ($parsed['validFrom_time_t'] ?? 0) && $now <= ($parsed['validTo_time_t'] ?? 0),
            'is_self_signed' => (strcasecmp($subject['CN'] ?? '', $issuer['CN'] ?? '') === 0
                                && ($subject['O'] ?? '') === ($issuer['O'] ?? '')),
            'fingerprint_sha256' => openssl_x509_fingerprint($certPem, 'sha256'),
            'serial'         => $parsed['serialNumberHex'] ?? $parsed['serialNumber'] ?? '',
            '_pem'           => $pemOut,
        ];
    }

    // Verify chain linking using openssl_x509_verify with PEM strings (pure PHP)
    $chainValid = true;
    $chainErrors = [];
    for ($i = 0; $i < count($chain) - 1; $i++) {
        if (!empty($chain[$i]['_pem']) && !empty($chain[$i + 1]['_pem'])) {
            $r = @openssl_x509_verify($chain[$i]['_pem'], $chain[$i + 1]['_pem']);
            if ($r !== 1) {
                $chainValid = false;
                $chainErrors[] = "Cert #{$i} ({$chain[$i]['common_name']}) signature could not be verified against cert #" . ($i + 1) . " ({$chain[$i + 1]['common_name']}).";
            }
        } else {
            $cnMatch = strcasecmp($chain[$i]['issuer_cn'], $chain[$i+1]['common_name']) === 0;
            $orgMatch = strcasecmp($chain[$i]['issuer_org'], $chain[$i+1]['organization']) === 0;
            $hasCnInfo = !empty($chain[$i]['issuer_cn']) || !empty($chain[$i+1]['common_name']);
            $hasOrgInfo = !empty($chain[$i]['issuer_org']) || !empty($chain[$i+1]['organization']);
            if ($hasCnInfo && !$cnMatch && ($hasOrgInfo ? !$orgMatch : true)) {
                $chainValid = false;
                $chainErrors[] = "Cert #{$i} ({$chain[$i]['common_name']}) issuer doesn't match cert #" . ($i + 1) . " ({$chain[$i+1]['common_name']}).";
            }
        }
    }

    // Check if root is self-signed or issuer is in the CA bundle
    $rootSelfSigned = end($chain)['is_self_signed'] ?? false;
    $verifyWithCAs = null;
    if (!$rootSelfSigned) {
        $caBundle = '/etc/ssl/certs/ca-certificates.crt';
        if (!file_exists($caBundle)) $caBundle = '/etc/pki/tls/certs/ca-bundle.crt';
        if (!file_exists($caBundle) || !($caContent = @file_get_contents($caBundle))) {
            $caBundle = '/home/admin/tmp/ca-bundle.crt';
        }
        if (file_exists($caBundle)) {
            $caContent = @file_get_contents($caBundle);
            if ($caContent !== false) {
                $lastCert = end($chain);
                $issuerCN = $lastCert['issuer_cn'] ?? '';
                $verifyWithCAs = !empty($issuerCN) && strpos($caContent, $issuerCN) !== false;
            }
        }
    }

    // If chain doesn't reach a root and issuer is not in the CA bundle, mark as invalid
    if (!$rootSelfSigned && $verifyWithCAs === false) {
        $chainValid = false;
        $chainErrors[] = "Chain does not reach a trusted root CA and could not be verified against the system CA bundle.";
    }

    Response::success([
        'domain'            => $domain,
        'port'              => $port,
        'chain_length'      => count($chain),
        'chain'             => array_map(function($c) { unset($c['_pem']); return $c; }, $chain),
        'chain_valid'       => $chainValid,
        'chain_errors'      => $chainErrors,
        'root_self_signed'  => $rootSelfSigned,
        'verified_with_cas' => $verifyWithCAs,
    ]);
}

// ─── TLS Version Tester ─────────────────────────────────────────────────────
function doTlsCheck(string $domain, int $port): void
{
    $versions = [
        'TLSv1'   => ['min' => 'TLSv1',   'label' => 'TLS 1.0'],
        'TLSv1.1' => ['min' => 'TLSv1.1', 'label' => 'TLS 1.1'],
        'TLSv1.2' => ['min' => 'TLSv1.2', 'label' => 'TLS 1.2'],
        'TLSv1.3' => ['min' => 'TLSv1.3', 'label' => 'TLS 1.3'],
    ];

    $methodMap = [
        'TLSv1'   => STREAM_CRYPTO_METHOD_TLSv1_0_CLIENT,
        'TLSv1.1' => STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT,
        'TLSv1.2' => STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT,
        'TLSv1.3' => STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT,
    ];

    $results = [];

    foreach ($versions as $key => $info) {
        $ctx = @stream_context_create([
            'ssl' => [
                'crypto_method'     => $methodMap[$key],
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true,
            ],
        ]);

        $errno = 0;
        $errstr = '';
        $start = microtime(true);
        $conn = @stream_socket_client("ssl://{$domain}:{$port}", $errno, $errstr, 8, STREAM_CLIENT_CONNECT, $ctx);
        $elapsed = round((microtime(true) - $start) * 1000);

        $supported = false;
        $negotiatedVersion = '';
        $cipher = '';
        $bits = 0;

        if ($conn) {
            $supported = true;
            $meta = stream_get_meta_data($conn);
            $crypto = $meta['crypto'] ?? [];
            $negotiatedVersion = $crypto['protocol'] ?? '';
            $cipher = $crypto['cipher_name'] ?? '';
            $bits = (int) ($crypto['cipher_bits'] ?? 0);
            fclose($conn);
        }

        $results[] = [
            'key'               => $key,
            'label'             => $info['label'],
            'supported'         => $supported,
            'negotiated'        => $negotiatedVersion,
            'cipher'            => $cipher,
            'bits'              => $bits,
            'connect_time_ms'   => $elapsed,
            'error'             => !$supported ? $errstr : '',
        ];
    }

    $recommended = 'TLSv1.2';
    $securityNotes = [];
    $hasTls13 = false;
    $hasTls10or11 = false;
    foreach ($results as $r) {
        if ($r['key'] === 'TLSv1.3' && $r['supported']) $hasTls13 = true;
        if (in_array($r['key'], ['TLSv1', 'TLSv1.1']) && $r['supported']) $hasTls10or11 = true;
    }
    if ($hasTls13) $recommended = 'TLSv1.3';
    if ($hasTls10or11) $securityNotes[] = 'TLS 1.0 and/or 1.1 detected — these are deprecated and should be disabled.';
    if (!$hasTls13) $securityNotes[] = 'TLS 1.3 not supported — consider upgrading your server configuration.';
    if (!$hasTls10or11 && $hasTls13) $securityNotes[] = 'Excellent! Only modern TLS versions are supported.';

    Response::success([
        'domain'          => $domain,
        'port'            => $port,
        'versions'        => $results,
        'recommended'     => $recommended,
        'security_notes'  => $securityNotes,
    ]);
}

// ─── HSTS Checker ────────────────────────────────────────────────────────────
function doHstsCheck(string $domain): void
{
    $urls = [
        "https://{$domain}/",
        "http://{$domain}/",
    ];

    $hstsInfo = null;

    foreach ($urls as $url) {
        $ctx = @stream_context_create([
            'http' => [
                'method'         => 'HEAD',
                'timeout'        => 10,
                'follow_location'=> false,
                'header'         => "User-Agent: ficksie-ssl-checker/1.0\r\n",
                'ignore_errors'  => true,
            ],
            'ssl' => [
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true,
            ],
        ]);

        $headers = @get_headers($url, true, $ctx);

        if ($headers === false) continue;

        // Normalize headers
        $hdrs = [];
        foreach ($headers as $key => $val) {
            if (is_int($key)) continue;
            $hdrs[strtolower($key)] = is_array($val) ? end($val) : $val;
        }

        $hsts = $hdrs['strict-transport-security'] ?? '';
        if ($hsts !== '' && $hstsInfo === null) {
            $maxAge = 0;
            $includeSubdomains = false;
            $preload = false;

            if (preg_match('/max-age=(\d+)/i', $hsts, $m)) {
                $maxAge = (int) $m[1];
            }
            $includeSubdomains = stripos($hsts, 'includeSubDomains') !== false;
            $preload = stripos($hsts, 'preload') !== false;

            $hstsInfo = [
                'header_present'       => true,
                'raw'                  => $hsts,
                'max_age'              => $maxAge,
                'include_subdomains'   => $includeSubdomains,
                'preload'              => $preload,
                'source_url'           => $url,
            ];
        }
    }

    if ($hstsInfo === null) {
        $hstsInfo = [
            'header_present'       => false,
            'raw'                  => '',
            'max_age'              => 0,
            'include_subdomains'   => false,
            'preload'              => false,
            'source_url'           => '',
        ];
    }

    // Evaluate
    $score = 0;
    $recommendations = [];

    if ($hstsInfo['header_present']) {
        if ($hstsInfo['max_age'] >= 31536000) {
            $score += 40;
        } elseif ($hstsInfo['max_age'] >= 2592000) {
            $score += 25;
            $recommendations[] = 'Increase max-age to at least 31536000 (1 year).';
        } elseif ($hstsInfo['max_age'] > 0) {
            $score += 10;
            $recommendations[] = 'max-age is too low. Use at least 31536000 (1 year).';
        }

        if ($hstsInfo['include_subdomains']) $score += 20;
        else $recommendations[] = 'Add includeSubDomains directive.';

        if ($hstsInfo['preload']) $score += 10;
        else $recommendations[] = 'Consider adding preload for browser HSTS preload list.';

        // HSTS should only be served over HTTPS
        if (str_starts_with($hstsInfo['source_url'], 'https://')) {
            $score += 10;
        } elseif (str_starts_with($hstsInfo['source_url'], 'http://')) {
            $recommendations[] = 'HSTS header should only be served over HTTPS, not HTTP.';
        }
    } else {
        $recommendations[] = 'No HSTS header found. Add Strict-Transport-Security header.';
        $recommendations[] = 'Recommended: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload';
    }

    $grade = match(true) {
        $score >= 80 => 'A',
        $score >= 60 => 'B',
        $score >= 40 => 'C',
        $score >= 20 => 'D',
        default       => 'F',
    };

    Response::success([
        'domain'           => $domain,
        'hsts'             => $hstsInfo,
        'score'            => $score,
        'grade'            => $grade,
        'recommendations'  => $recommendations,
    ]);
}

// ─── Combined Audit ──────────────────────────────────────────────────────────
function doAudit(string $domain, int $port): void
{
    $certData = null;
    $chainData = null;
    $tlsData = null;
    $hstsData = null;

    // Cert check
    $stream = @stream_context_create([
        'ssl' => [
            'capture_peer_cert'       => true,
            'capture_peer_cert_chain' => true,
            'verify_peer'             => false,
            'verify_peer_name'        => false,
            'allow_self_signed'       => true,
        ],
    ]);
    $errno = 0; $errstr = '';
    $conn = @stream_socket_client("ssl://{$domain}:{$port}", $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $stream);
    if ($conn) {
        $cert = stream_context_get_params($stream);
        $peer = $cert['options']['ssl']['peer_certificate'] ?? null;
        $peerChain = $cert['options']['ssl']['peer_certificate_chain'] ?? [];
        if ($peer) {
            $parsed = openssl_x509_parse($peer);
            if ($parsed) {
                $now = time();
                $validFrom = $parsed['validFrom_time_t'] ?? 0;
                $validTo = $parsed['validTo_time_t'] ?? 0;
                $subject = $parsed['subject'] ?? [];
                $issuer = $parsed['issuer'] ?? [];
                $cn = $subject['CN'] ?? '';
                $issuerCn = $issuer['CN'] ?? '';
                $sans = [];
                if (isset($parsed['extensions']['subjectAltName'])) {
                    if (preg_match_all('/DNS:([^,]+)/', $parsed['extensions']['subjectAltName'], $m)) {
                        $sans = array_map('trim', $m[1]);
                    }
                }
                $coversDomain = false;
                foreach ($sans as $san) {
                    if ($san === $domain) { $coversDomain = true; break; }
                    if (str_starts_with($san, '*.')) {
                        $wildcard = substr($san, 2);
                        if ($domain === $wildcard || preg_match('/\.' . preg_quote($wildcard, '/') . '$/', $domain)) {
                            $coversDomain = true; break;
                        }
                    }
                }
                $certData = [
                    'domain'       => $domain,
                    'port'         => $port,
                    'valid'        => $now >= $validFrom && $now <= $validTo,
                    'self_signed'  => (strcasecmp($cn, $issuerCn) === 0 && ($subject['O'] ?? '') === ($issuer['O'] ?? '')),
                    'days_left'    => (int) floor(($validTo - $now) / 86400),
                    'valid_from'   => gmdate('c', $validFrom),
                    'valid_to'     => gmdate('c', $validTo),
                    'subject'      => [
                        'common_name' => $cn,
                        'organization' => $subject['O'] ?? '',
                        'organizational_unit' => $subject['OU'] ?? '',
                        'city' => $subject['L'] ?? '',
                        'state' => $subject['ST'] ?? '',
                        'country' => $subject['C'] ?? '',
                    ],
                    'issuer'       => [
                        'common_name' => $issuerCn,
                        'organization' => $issuer['O'] ?? '',
                    ],
                    'sans'             => $sans,
                    'covers_domain'    => $coversDomain,
                    'serial'           => $parsed['serialNumberHex'] ?? $parsed['serialNumber'] ?? '',
                    'fingerprint_sha256' => isset($parsed['serialNumber']) ? openssl_x509_fingerprint($peer, 'sha256') : '',
                    'signature_algorithm' => $parsed['signatureTypeSN'] ?? $parsed['signatureType'] ?? 'Unknown',
                ];

                // Chain from same connection
                $chain = [];
                $certs = $peerChain ?: [$peer];
                foreach ($certs as $idx => $certPem) {
                    $cp = openssl_x509_parse($certPem);
                    if (!$cp) continue;
                    $cs = $cp['subject'] ?? [];
                    $ci = $cp['issuer'] ?? [];
                    $chain[] = [
                        'index' => $idx,
                        'common_name' => $cs['CN'] ?? '',
                        'organization' => $cs['O'] ?? '',
                        'issuer_cn' => $ci['CN'] ?? '',
                        'issuer_org' => $ci['O'] ?? '',
                        'valid_from' => gmdate('c', $cp['validFrom_time_t'] ?? 0),
                        'valid_to' => gmdate('c', $cp['validTo_time_t'] ?? 0),
                        'is_valid' => $now >= ($cp['validFrom_time_t'] ?? 0) && $now <= ($cp['validTo_time_t'] ?? 0),
                        'is_self_signed' => (strcasecmp($cs['CN'] ?? '', $ci['CN'] ?? '') === 0 && ($cs['O'] ?? '') === ($ci['O'] ?? '')),
                        'fingerprint_sha256' => openssl_x509_fingerprint($certPem, 'sha256'),
                        'serial' => $cp['serialNumberHex'] ?? $cp['serialNumber'] ?? '',
                        '_pem' => (openssl_x509_export($certPem, $pemOut) ? $pemOut : ''),
                    ];
                }
                // Verify chain linking using openssl_x509_verify with PEM strings (pure PHP, no exec needed)
                $chainValid = true;
                $chainErrors = [];
                $allCertsPem = [];
                foreach ($chain as $c) {
                    $certPem = '';
                    if (isset($c['_pem'])) { $certPem = $c['_pem']; }
                    $allCertsPem[] = $certPem;
                }
                for ($i = 0; $i < count($chain) - 1; $i++) {
                    if (!empty($allCertsPem[$i]) && !empty($allCertsPem[$i + 1])) {
                        $r = @openssl_x509_verify($allCertsPem[$i], $allCertsPem[$i + 1]);
                        if ($r !== 1) {
                            $chainValid = false;
                            $chainErrors[] = "Cert #{$i} ({$chain[$i]['common_name']}) signature could not be verified against cert #" . ($i + 1) . " ({$chain[$i + 1]['common_name']}).";
                        }
                    } else {
                        $cnMatch = strcasecmp($chain[$i]['issuer_cn'], $chain[$i+1]['common_name']) === 0;
                        $orgMatch = strcasecmp($chain[$i]['issuer_org'], $chain[$i+1]['organization']) === 0;
                        $hasCnInfo = !empty($chain[$i]['issuer_cn']) || !empty($chain[$i+1]['common_name']);
                        $hasOrgInfo = !empty($chain[$i]['issuer_org']) || !empty($chain[$i+1]['organization']);
                        if ($hasCnInfo && !$cnMatch && ($hasOrgInfo ? !$orgMatch : true)) {
                            $chainValid = false;
                            $chainErrors[] = "Cert #{$i} ({$chain[$i]['common_name']}) issuer doesn't match cert #" . ($i+1) . " ({$chain[$i+1]['common_name']}).";
                        }
                    }
                }
                // Check if last cert is self-signed or its issuer is in the CA bundle
                $lastCert = end($chain);
                $chainReachesRoot = $lastCert['is_self_signed'] ?? false;
                $verifyWithCAs = null;
                if (!$chainReachesRoot) {
                    $caBundlePath = '/etc/ssl/certs/ca-certificates.crt';
                    if (!file_exists($caBundlePath)) $caBundlePath = '/etc/pki/tls/certs/ca-bundle.crt';
                    if (!file_exists($caBundlePath) || !($caContent = @file_get_contents($caBundlePath))) {
                        $caBundlePath = '/home/admin/tmp/ca-bundle.crt';
                    }
                    if (file_exists($caBundlePath)) {
                        $caContent = @file_get_contents($caBundlePath);
                        if ($caContent !== false) {
                            $issuerCN = $lastCert['issuer_cn'] ?? '';
                            $issuerOrg = $lastCert['issuer_org'] ?? '';
                            $verifyWithCAs = !empty($issuerCN) && strpos($caContent, $issuerCN) !== false;
                        }
                    }
                }
                if (!$chainReachesRoot && $verifyWithCAs === false) {
                    $chainValid = false;
                    $chainErrors[] = "Chain does not reach a trusted root CA. Last cert ({$lastCert['common_name']}) is not self-signed.";
                    $chainErrors[] = "Certificate could not be verified against the system CA bundle. The issuing root may be missing or not widely trusted.";
                }
                $chainData = [
                    'chain_length' => count($chain),
                    'chain' => array_map(function($c) { unset($c['_pem']); return $c; }, $chain),
                    'chain_valid' => $chainValid,
                    'chain_errors' => $chainErrors,
                    'root_self_signed' => $chainReachesRoot,
                    'verified_with_cas' => $verifyWithCAs,
                ];
            }
        }
        fclose($conn);
    }

    if (!$certData) {
        $certData = ['error' => "Could not connect to {$domain}:{$port}. {$errstr}"];
    }

    // TLS check
    $versions = [
        'TLSv1'   => ['min' => 'TLSv1',   'label' => 'TLS 1.0'],
        'TLSv1.1' => ['min' => 'TLSv1.1', 'label' => 'TLS 1.1'],
        'TLSv1.2' => ['min' => 'TLSv1.2', 'label' => 'TLS 1.2'],
        'TLSv1.3' => ['min' => 'TLSv1.3', 'label' => 'TLS 1.3'],
    ];
    $tlsResults = [];
    $methodMap = [
        'TLSv1'   => STREAM_CRYPTO_METHOD_TLSv1_0_CLIENT,
        'TLSv1.1' => STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT,
        'TLSv1.2' => STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT,
        'TLSv1.3' => STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT,
    ];
    foreach ($versions as $key => $info) {
        $ctx = @stream_context_create([
            'ssl' => [
                'crypto_method' => $methodMap[$key],
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ],
        ]);
        $errno = 0; $errstr = '';
        $start = microtime(true);
        $conn = @stream_socket_client("ssl://{$domain}:{$port}", $errno, $errstr, 8, STREAM_CLIENT_CONNECT, $ctx);
        $elapsed = round((microtime(true) - $start) * 1000);
        $supported = false; $negotiatedVersion = ''; $cipher = ''; $bits = 0;
        if ($conn) {
            $supported = true;
            $meta = stream_get_meta_data($conn);
            $crypto = $meta['crypto'] ?? [];
            $negotiatedVersion = $crypto['protocol'] ?? '';
            $cipher = $crypto['cipher_name'] ?? '';
            $bits = (int) ($crypto['cipher_bits'] ?? 0);
            fclose($conn);
        }
        $tlsResults[] = [
            'key' => $key, 'label' => $info['label'], 'supported' => $supported,
            'negotiated' => $negotiatedVersion, 'cipher' => $cipher, 'bits' => $bits,
            'connect_time_ms' => $elapsed, 'error' => !$supported ? $errstr : '',
        ];
    }
    $securityNotes = [];
    $hasTls13 = false; $hasTls10or11 = false;
    foreach ($tlsResults as $r) {
        if ($r['key'] === 'TLSv1.3' && $r['supported']) $hasTls13 = true;
        if (in_array($r['key'], ['TLSv1', 'TLSv1.1']) && $r['supported']) $hasTls10or11 = true;
    }
    if ($hasTls10or11) $securityNotes[] = 'TLS 1.0 and/or 1.1 detected — these are deprecated and should be disabled.';
    if (!$hasTls13) $securityNotes[] = 'TLS 1.3 not supported — consider upgrading your server configuration.';
    if (!$hasTls10or11 && $hasTls13) $securityNotes[] = 'Excellent! Only modern TLS versions are supported.';
    $tlsData = [
        'versions' => $tlsResults,
        'recommended' => $hasTls13 ? 'TLSv1.3' : 'TLSv1.2',
        'security_notes' => $securityNotes,
    ];

    // HSTS check
    $hstsInfo = null;
    foreach (["https://{$domain}/", "http://{$domain}/"] as $url) {
        $ctx = @stream_context_create([
            'http' => [
                'method' => 'HEAD', 'timeout' => 10,
                'follow_location' => false,
                'header' => "User-Agent: ficksie-ssl-checker/1.0\r\n",
                'ignore_errors' => true,
            ],
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true],
        ]);
        $headers = @get_headers($url, true, $ctx);
        if ($headers === false) continue;
        $hdrs = [];
        foreach ($headers as $key => $val) {
            if (is_int($key)) continue;
            $hdrs[strtolower($key)] = is_array($val) ? end($val) : $val;
        }
        $hsts = $hdrs['strict-transport-security'] ?? '';
        if ($hsts !== '' && $hstsInfo === null) {
            $maxAge = 0;
            if (preg_match('/max-age=(\d+)/i', $hsts, $m)) $maxAge = (int) $m[1];
            $hstsInfo = [
                'header_present' => true, 'raw' => $hsts, 'max_age' => $maxAge,
                'include_subdomains' => stripos($hsts, 'includeSubDomains') !== false,
                'preload' => stripos($hsts, 'preload') !== false,
                'source_url' => $url,
            ];
        }
    }
    if ($hstsInfo === null) {
        $hstsInfo = ['header_present' => false, 'raw' => '', 'max_age' => 0,
            'include_subdomains' => false, 'preload' => false, 'source_url' => ''];
    }
    $score = 0; $recommendations = [];
    if ($hstsInfo['header_present']) {
        if ($hstsInfo['max_age'] >= 31536000) { $score += 40; }
        elseif ($hstsInfo['max_age'] >= 2592000) { $score += 25; $recommendations[] = 'Increase max-age to at least 31536000 (1 year).'; }
        elseif ($hstsInfo['max_age'] > 0) { $score += 10; $recommendations[] = 'max-age is too low. Use at least 31536000 (1 year).'; }
        if ($hstsInfo['include_subdomains']) $score += 20; else $recommendations[] = 'Add includeSubDomains directive.';
        if ($hstsInfo['preload']) $score += 10; else $recommendations[] = 'Consider adding preload for browser HSTS preload list.';
        if (str_starts_with($hstsInfo['source_url'], 'https://')) { $score += 10; }
        elseif (str_starts_with($hstsInfo['source_url'], 'http://')) { $recommendations[] = 'HSTS header should only be served over HTTPS, not HTTP.'; }
    } else {
        $recommendations[] = 'No HSTS header found. Add Strict-Transport-Security header.';
        $recommendations[] = 'Recommended: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload';
    }
    $hstsGrade = match(true) {
        $score >= 80 => 'A', $score >= 60 => 'B', $score >= 40 => 'C', $score >= 20 => 'D', default => 'F',
    };
    $hstsData = ['hsts' => $hstsInfo, 'score' => $score, 'grade' => $hstsGrade, 'recommendations' => $recommendations];

    Response::success([
        'domain' => $domain,
        'port'   => $port,
        'cert'   => $certData,
        'chain'  => $chainData,
        'tls'    => $tlsData,
        'hsts'   => $hstsData,
    ]);
}
