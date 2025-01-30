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

// callback.php
session_start();

$clientId = '1095032107087-jpb28e0l3tjmuh0iseftcpoaqb0o5cpd.apps.googleusercontent.com';
$clientSecret = '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';
$redirectUri = 'https://dagobertapp.com/staging/callback.php';
$tokenUrl = 'https://oauth2.googleapis.com/token';

if (isset($_GET['code'])) {
    $code = $_GET['code'];
    
    // Az authorization code alapján token kérése
    $postFields = [
        'code' => $code,
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri' => $redirectUri,
        'grant_type' => 'authorization_code'
    ];

    $ch = curl_init($tokenUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postFields));

    $response = curl_exec($ch);
    $data = json_decode($response, true);
    curl_close($ch);

    // Ellenőrizzük, hogy van-e access token
    if (isset($data['access_token'])) {
        $_SESSION['access_token'] = $data['access_token'];
        $_SESSION['refresh_token'] = $data['refresh_token'] ?? null;

        // Az access token átadása a kliensnek a kezdőoldalra irányítva
        $accessToken = $data['access_token'];
        header("Location: /staging/index.html?access_token=" . urlencode($accessToken));
        exit;
    } else {
        echo "Token kérés sikertelen: " . json_encode($data);
    }
} else {
    echo "Nincs authorization code a lekérdezésben.";
}


?>