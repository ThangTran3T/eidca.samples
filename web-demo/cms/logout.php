<?php
/**
 * EIDCA CMS – Logout
 */
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';
if (isLoggedIn()) logActivity('logout');
doLogout();
