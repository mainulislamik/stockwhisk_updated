<?php
// Mounted as /var/www/html/config/config.inc.php so Roundcube actually loads it.
// Pre-initialise arrays that config.docker.inc.php merges into (it does
// array_merge($config['plugins'], ...) and expects it to already be an array).
$config = ['plugins' => []];

// Pull in the container's env-generated configuration (imap_host, smtp_host, db…).
if (file_exists(__DIR__ . '/config.docker.inc.php')) {
    include __DIR__ . '/config.docker.inc.php';
}

// SSO session sharing: don't bind the session to IP / user-agent.
$config['ip_check'] = false;
$config['ua_check'] = false;

// The mailserver uses a self-signed TLS cert on the internal Docker network.
// Accept it for both IMAP and SMTP (traffic never leaves the host).
$ssl_no_verify = [
    'ssl' => [
        'verify_peer'       => false,
        'verify_peer_name'  => false,
        'allow_self_signed' => true,
    ],
];
$config['imap_conn_options'] = $ssl_no_verify;
$config['smtp_conn_options'] = $ssl_no_verify;
