<?php
header('Content-Type: application/json');
$path = '/etc/pki/tls/certs/ca-bundle.crt';
$exists = file_exists($path);
$content = $exists ? @file_get_contents($path) : false;
$len = $content !== false ? strlen($content) : 0;
echo json_encode(['path' => $path, 'exists' => $exists, 'readable' => $content !== false, 'length' => $len]);
