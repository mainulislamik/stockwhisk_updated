<?php
// Custom Roundcube config: disable session validation that breaks SSO
// ip_check must be PHP boolean false, not string 'false'
$config['ip_check'] = false;
// Also disable user-agent check for SSO compatibility
$config['ua_check'] = false;

// Mailserver uses a self-signed TLS cert on the internal network — accept it
// for both IMAP and SMTP connections (traffic never leaves the host).
$ssl_no_verify = [
    'ssl' => [
        'verify_peer'       => false,
        'verify_peer_name'  => false,
        'allow_self_signed' => true,
    ],
];
$config['imap_conn_options'] = $ssl_no_verify;
$config['smtp_conn_options'] = $ssl_no_verify;
