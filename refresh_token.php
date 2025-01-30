<?php

ini_set('session.gc_maxlifetime', 3600 * 24 * 30); // 30 napos session időtartam
session_set_cookie_params([
    'lifetime' => 3600 * 24 * 30, // Cookie élettartama 30 nap
    'path' => '/',
    'domain' => $_SERVER['HTTP_HOST'], // Az aktuális domain
    'secure' => true, // Csak HTTPS esetén működjön
    'httponly' => true, // JavaScript ne férjen hozzá
    'samesite' => 'Lax' // CSRF támadások elleni védelem
]);

// refresh_token.php
session_start();

function refreshToken($refreshToken) {
    $clientId = '1095032107087-jpb28e0l3tjmuh0iseftcpoaqb0o5cpd.apps.googleusercontent.com';
    $clientSecret = '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';
    $tokenUrl = 'https://oauth2.googleapis.com/token';

    $postFields = [
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'refresh_token' => $refreshToken,
        'grant_type' => 'refresh_token'
    ];

    $ch = curl_init($tokenUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postFields));

    $response = curl_exec($ch);
    curl_close($ch);

    return json_decode($response, true);
}

if (isset($_SESSION['refresh_token'])) {
    $tokenData = refreshToken($_SESSION['refresh_token']);
    
    if (isset($tokenData['access_token'])) {
        $_SESSION['access_token'] = $tokenData['access_token'];
        echo json_encode(['access_token' => $tokenData['access_token']]);
    } else {
        echo json_encode(['error' => 'Token frissítés sikertelen']);
    }
} else {
    echo json_encode(['error' => 'Nincs refresh token']);
}


?>