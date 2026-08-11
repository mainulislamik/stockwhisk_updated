<?php
// Custom Roundcube config: disable session validation that breaks SSO
// ip_check must be PHP boolean false, not string 'false'
$config['ip_check'] = false;
// Also disable user-agent check for SSO compatibility
$config['ua_check'] = false;
