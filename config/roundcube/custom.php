<?php
// Tell RoundCube it lives at /webmail/ so its redirects and links use the right base path
$config['http_path'] = '/webmail/';

// Allow embedding in iframes from any origin (we control the proxy)
$config['x_frame_options'] = '';
