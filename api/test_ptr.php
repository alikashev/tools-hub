<?php
// Test script — DELETE AFTER USE
require_once dirname(__DIR__) . '/config.php';
require_once dirname(__DIR__) . '/includes/database.php';

define('DNS_CACHE_TTL', 3600);

function dnsQuery($d, $t) { $r = @dns_get_record($d, $t); return $r ?: []; }
function array_column($arr, $key) { return array_map(function($e) use ($key) { return $e[$key]; }, $arr); }

// Clear cache
Database::execute('DELETE FROM dns_cache WHERE domain = ?', ['hulsewe-wazniewski.nl']);

$domain = 'hulsewe-wazniewski.nl';

// getAaaaRecords
$records = dnsQuery($domain, DNS_AAAA);
echo "getAaaaRecords output:\n";
foreach ($records as $r) {
    echo "  ipv6: " . json_encode($r['ipv6']) . "\n";
}

// getReverseDns inline
$PTR_OVERRIDES = [
    '185.182.56.12' => 'Redirect server Versio',
    '2a0b:7280:100::434:52ff:fe00:2046' => 'Redirect server Versio',
];

$aRecs = dnsQuery($domain, DNS_A);
$aaaaRecs = dnsQuery($domain, DNS_AAAA);

$aIps = array_column($aRecs, 'ip');
$aaaaIps = array_column($aaaaRecs, 'ipv6');

$allIps = array_merge($aIps, $aaaaIps);
echo "\nAll IPs from getReverseDns:\n";
foreach ($allIps as $ip) {
    echo "  " . json_encode($ip) . "\n";
}

$result = ['ptr_records' => []];
foreach ($allIps as $ip) {
    $hostname = null;
    $isV6 = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false;
    if (isset($PTR_OVERRIDES[$ip])) {
        $hostname = $PTR_OVERRIDES[$ip];
    } elseif (!$isV6) {
        $parts = explode('.', $ip);
        if (count($parts) === 4) {
            $reversed = implode('.', array_reverse($parts));
            $ptr = @dns_get_record("$reversed.in-addr.arpa.", DNS_PTR);
            if (!empty($ptr[0]['target'])) {
                $hostname = rtrim($ptr[0]['target'], '.');
            }
        }
    } else {
        $expanded = inet_pton($ip);
        if ($expanded !== false) {
            $hex = bin2hex($expanded);
            $nibbles = implode('.', array_reverse(str_split($hex)));
            $ptr = @dns_get_record("$nibbles.ip6.arpa.", DNS_PTR);
            if (!empty($ptr[0]['target'])) {
                $hostname = rtrim($ptr[0]['target'], '.');
            }
        }
    }
    if ($hostname) {
        $result['ptr_records'][] = ['ip' => $ip, 'hostname' => $hostname];
    }
}

echo "\nptr_records:\n";
echo json_encode($result['ptr_records'], JSON_PRETTY_PRINT) . "\n";

// Test format match
echo "\nFormat match test:\n";
foreach ($aaaaIps as $ip) {
    $found = false;
    foreach ($result['ptr_records'] as $p) {
        if ($p['ip'] === $ip) { $found = true; break; }
    }
    echo "  AAAA IP $ip → " . ($found ? 'FOUND in ptr_records' : 'MISSING from ptr_records') . "\n";
}
