<?php
/**
 * EIDCA CMS – index.php
 * Redirect về dashboard hoặc login
 */
require_once __DIR__ . '/includes/auth.php';

if (isLoggedIn()) {
    header('Location: ' . _base() . '/dashboard.php');
} else {
    header('Location: ' . _base() . '/login.php');
}
exit;
