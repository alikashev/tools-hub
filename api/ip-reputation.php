<?php
/**
 * IP Reputation Checker API
 *
 * GET /api/ip-reputation?ip=1.2.3.4
 *
 * Aggregates data from multiple sources:
 *   - ip-api.com (ASN, GeoIP, ISP)
 *   - Spamhaus DNSBL
 *   - TOR exit node list
 *   - AbuseIPDB (if API key configured)
 *   - VirusTotal (if API key configured)
 */

// Allow this endpoint to be included via router or called directly
$calledDirectly = !defined('API_ROUTER_ACTIVE');
if ($calledDirectly) {
    require_once __DIR__ . '/../config.php';
    require_once __DIR__ . '/../includes/database.php';
    require_once __DIR__ . '/../includes/response.php';
    require_once __DIR__ . '/../includes/functions.php';
    cors();
}

// ─── Auto-create cache table ────────────────────────────────────────────────
try {
    Database::execute('
        CREATE TABLE IF NOT EXISTS ip_cache (
            ip VARCHAR(45) NOT NULL,
            source VARCHAR(50) NOT NULL,
            data JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (ip, source),
            INDEX idx_ip_cache_created (created_at)
        ) ENGINE=InnoDB
    ');
} catch (Throwable $e) {
    // Table creation failed — will still work, just without caching
}

// ─── Config ──────────────────────────────────────────────────────────────────
// Set these in config.php after copying
$abuseIpDbKey  = defined('ABUSEIPDB_KEY') ? ABUSEIPDB_KEY : '';
$vtKey         = defined('VIRUSTOTAL_KEY') ? VIRUSTOTAL_KEY : '';

define('CACHE_TTL', 3600); // 1 hour
define('IP_API_URL', 'http://ip-api.com/json/%s?fields=status,message,country,countryCode,city,isp,org,as,asname,lat,lon,query,proxy,hosting,mobile');

// ─── Input ───────────────────────────────────────────────────────────────────
$ip = $_GET['ip'] ?? '';

if (!preg_match('/^[0-9a-fA-F:.\/]+$/', $ip) || !filter_var($ip, FILTER_VALIDATE_IP)) {
    Response::validationError(['ip' => 'A valid IPv4 or IPv6 address is required.']);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cacheGet(string $ip, string $source): ?array
{
    $row = Database::fetchOne(
        'SELECT data FROM ip_cache WHERE ip = ? AND source = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)',
        [$ip, $source, CACHE_TTL]
    );
    return $row ? json_decode($row['data'], true) : null;
}

function cacheSet(string $ip, string $source, array $data): void
{
    Database::execute(
        'REPLACE INTO ip_cache (ip, source, data, created_at) VALUES (?, ?, ?, NOW())',
        [$ip, $source, json_encode($data)]
    );
}

function httpGet(string $url, int $timeout = 10): ?array
{
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => $timeout,
            'header' => "User-Agent: ToolHub-IPReputation/1.0\r\n",
            'ignore_errors' => true,
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) return null;
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : null;
}

// ─── Source: ASN / GeoIP (ip-api.com) ──────────────────────────────────────
function getAsnInfo(string $ip): array
{
    $cached = cacheGet($ip, 'asn');
    if ($cached) return $cached;

    $data = httpGet(sprintf(IP_API_URL, $ip));
    if (!$data || ($data['status'] ?? '') === 'fail') {
        $result = [
            'error' => true,
            'message' => 'Could not resolve IP geolocation.',
        ];
        cacheSet($ip, 'asn', $result);
        return $result;
    }

    $result = [
        'asn'          => $data['as'] ?? 'N/A',
        'org'          => $data['org'] ?? 'N/A',
        'isp'          => $data['isp'] ?? 'N/A',
        'country'      => $data['country'] ?? 'N/A',
        'country_code' => $data['countryCode'] ?? 'N/A',
        'city'         => $data['city'] ?? 'N/A',
        'asname'       => $data['asname'] ?? 'N/A',
        'lat'          => $data['lat'] ?? null,
        'lon'          => $data['lon'] ?? null,
        'proxy'        => (bool)($data['proxy'] ?? false),
        'hosting'      => (bool)($data['hosting'] ?? false),
        'mobile'       => (bool)($data['mobile'] ?? false),
        'provider_type' => $data['hosting'] ? 'hosting' : ($data['proxy'] ? 'proxy' : ($data['mobile'] ? 'mobile' : 'isp')),
    ];

    cacheSet($ip, 'asn', $result);
    return $result;
}

// ─── Source: Spamhaus DNSBL ────────────────────────────────────────────────
function getSpamhausStatus(string $ip): array
{
    $cached = cacheGet($ip, 'spamhaus');
    if ($cached) return $cached;

    // Only works for IPv4
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $result = ['listed' => false, 'lists' => [], 'note' => 'IPv6 not supported by Spamhaus DNSBL.'];
        cacheSet($ip, 'spamhaus', $result);
        return $result;
    }

    $revIp = implode('.', array_reverse(explode('.', $ip)));
    $hosts = [
        'zen.spamhaus.org' => 'ZEN',
    ];

    $listed = false;
    $lists = [];

    foreach ($hosts as $zone => $label) {
        $query = "$revIp.$zone";
        $ips = dns_get_record($query, DNS_A);
        if ($ips && count($ips) > 0) {
            $listed = true;
            $returnCode = $ips[0]['ip'] ?? '';
            $lists[] = [
                'list' => $label,
                'return_code' => $returnCode,
                'description' => getSpamhausDescription($returnCode),
            ];
        }
    }

    $result = ['listed' => $listed, 'lists' => $lists];
    cacheSet($ip, 'spamhaus', $result);
    return $result;
}

function getSpamhausDescription(string $code): string
{
    return match ($code) {
        '127.0.0.2' => 'SBL – Spamhaus SBL Data',
        '127.0.0.3' => 'SBL – Spamhaus SBL CSS Data',
        '127.0.0.4' => 'XBL – CBL Data',
        '127.0.0.5' => 'XBL – CBL+ Data',
        '127.0.0.6' => 'XBL – Custom',
        '127.0.0.7' => 'XBL – Custom',
        '127.0.0.8' => 'XBL – Custom',
        '127.0.0.9' => 'DBL – Spamhaus DBL Data',
        '127.0.0.10' => 'PBL – Spamhaus PBL Data',
        '127.0.0.11' => 'PBL – Spamhaus PBL Data',
        default => 'Listed on Spamhaus',
    };
}

// ─── Source: TOR Exit Nodes ─────────────────────────────────────────────────
function getTorStatus(string $ip): array
{
    $cached = cacheGet($ip, 'tor');
    if ($cached) return $cached;

    // Use Dan.me.uk TOR exit node list (updated hourly)
    $data = httpGet('https://www.dan.me.uk/torlist/?exit', 5); // shorter timeout

    $isTor = false;
    if ($data !== null && is_string($data)) {
        $lines = explode("\n", $data);
        $isTor = in_array($ip, array_map('trim', $lines), true);
    }

    $result = [
        'is_tor' => $isTor,
        'source' => 'dan.me.uk/torlist',
    ];

    cacheSet($ip, 'tor', $result);
    return $result;
}

// ─── Source: AbuseIPDB ──────────────────────────────────────────────────────
function getAbuseIpDb(string $ip, string $apiKey): array
{
    if (empty($apiKey)) {
        return ['enabled' => false, 'error' => 'AbuseIPDB API key not configured. Add define(\'ABUSEIPDB_KEY\', \'your_key\') to config.php.'];
    }

    $cached = cacheGet($ip, 'abuseipdb');
    if ($cached) return $cached;

    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'header' => "Key: $apiKey\r\nAccept: application/json\r\n",
        ],
    ]);

    $body = @file_get_contents("https://api.abuseipdb.com/api/v2/check?ipAddress=$ip&maxAgeInDays=90&verbose", false, $ctx);
    if ($body === false) {
        return ['enabled' => true, 'error' => 'Failed to query AbuseIPDB.'];
    }

    $json = json_decode($body, true);
    $d = $json['data'] ?? [];
    $score = (int)($d['abuseConfidenceScore'] ?? 0);

    $result = [
        'enabled'            => true,
        'confidence_score'   => $score,
        'total_reports'      => (int)($d['totalReports'] ?? 0),
        'last_reported_at'   => $d['lastReportedAt'] ?? null,
        'categories'         => $d['reports'] ?? [],
        'reputation_status'  => $score >= 80 ? 'malicious' : ($score >= 30 ? 'suspicious' : 'clean'),
        'country_code'       => $d['countryCode'] ?? '',
        'domain'             => $d['domain'] ?? '',
        'hostnames'          => $d['hostnames'] ?? [],
        'is_whitelisted'     => (bool)($d['isWhitelisted'] ?? false),
    ];

    cacheSet($ip, 'abuseipdb', $result);
    return $result;
}

// ─── Source: VirusTotal ─────────────────────────────────────────────────────
function getVirusTotal(string $ip, string $apiKey): array
{
    if (empty($apiKey)) {
        return ['enabled' => false, 'error' => 'VirusTotal API key not configured. Add define(\'VIRUSTOTAL_KEY\', \'your_key\') to config.php.'];
    }

    $cached = cacheGet($ip, 'virustotal');
    if ($cached) return $cached;

    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'header' => "x-apikey: $apiKey\r\nAccept: application/json\r\n",
        ],
    ]);

    $body = @file_get_contents("https://www.virustotal.com/api/v3/ip_addresses/$ip", false, $ctx);
    if ($body === false) {
        return ['enabled' => true, 'error' => 'Failed to query VirusTotal.'];
    }

    $json = json_decode($body, true);
    $attrs = $json['data']['attributes'] ?? [];

    $lastStats = $attrs['last_analysis_stats'] ?? [];
    $results   = $attrs['last_analysis_results'] ?? [];
    $harmless  = $lastStats['harmless'] ?? 0;
    $malicious = $lastStats['malicious'] ?? 0;
    $suspicious = $lastStats['suspicious'] ?? 0;
    $undetected = $lastStats['undetected'] ?? 0;
    $total     = $harmless + $malicious + $suspicious + $undetected;

    $result = [
        'enabled'            => true,
        'reputation_score'   => $attrs['reputation'] ?? 0,
        'detection_ratio'    => $total > 0 ? "$malicious/$total" : '0/0',
        'malicious'          => $malicious,
        'suspicious'         => $suspicious,
        'harmless'           => $harmless,
        'undetected'         => $undetected,
        'total_engines'      => $total,
        'last_analysis_date' => $attrs['last_analysis_date'] ?? null,
        'country'            => $attrs['country'] ?? '',
        'network'            => $attrs['network'] ?? '',
        'tags'               => $attrs['tags'] ?? [],
    ];

    cacheSet($ip, 'virustotal', $result);
    return $result;
}

// ─── Aggregate ──────────────────────────────────────────────────────────────
$asn       = getAsnInfo($ip);
$spamhaus  = getSpamhausStatus($ip);
$tor       = getTorStatus($ip);
$abuse     = getAbuseIpDb($ip, $abuseIpDbKey);
$vt        = getVirusTotal($ip, $vtKey);

// ─── Proxy / VPN Detection ──────────────────────────────────────────────────
$proxyVpn = [
    'is_proxy'   => $asn['proxy'] ?? false,
    'is_vpn'     => false,
    'is_hosting' => $asn['hosting'] ?? false,
    'is_tor'     => $tor['is_tor'],
    'is_mobile'  => $asn['mobile'] ?? false,
    'provider'   => $asn['org'] ?? 'Unknown',
    'confidence' => 'medium',
];

// Heuristic: if Spamhaus lists it as proxy, mark as proxy
if ($spamhaus['listed']) {
    $proxyVpn['is_proxy'] = true;
    $proxyVpn['confidence'] = 'high';
}

$asnType = $asn['provider_type'] ?? 'isp';

// ─── Summary / Risk Score ────────────────────────────────────────────────────
$riskScore = 0;
$reasons = [];

if ($asn['proxy'] ?? false)       $riskScore += 20;
if ($tor['is_tor'])               $riskScore += 35;
if ($spamhaus['listed'])          $riskScore += 30;
if ($abuse['enabled'] ?? false)   $riskScore += min(35, $abuse['confidence_score'] * 0.35);
if ($vt['enabled'] ?? false)      $riskScore += min(30, ($vt['malicious'] ?? 0) * 10);

$riskScore = min(100, $riskScore);

$reputation = match (true) {
    $riskScore >= 70 => 'malicious',
    $riskScore >= 30 => 'suspicious',
    default          => 'safe',
};

// ─── Response ───────────────────────────────────────────────────────────────
Response::success([
    'ip'       => $ip,
    'query_time' => gmdate('c'),
    'summary'  => [
        'risk_score'    => $riskScore,
        'reputation'    => $reputation,
        'country'       => $asn['country'] ?? 'N/A',
        'country_code'  => $asn['country_code'] ?? '',
        'asn'           => $asn['asn'] ?? 'N/A',
        'asname'        => $asn['asname'] ?? '',
        'org'           => $asn['org'] ?? 'N/A',
        'provider_type' => $asnType,
        'isp'           => $asn['isp'] ?? 'N/A',
        'city'          => $asn['city'] ?? 'N/A',
    ],
    'abuseipdb'   => $abuse,
    'spamhaus'    => $spamhaus,
    'virustotal'  => $vt,
    'tor'         => $tor,
    'proxy_vpn'   => $proxyVpn,
    'asn'         => $asn,
]);
