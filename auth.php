<?php

session_start();

$clientId = '1095032107087-jpb28e0l3tjmuh0iseftcpoaqb0o5cpd.apps.googleusercontent.com';
$redirectUri = 'https://dagobertapp.com/staging/callback.php';  // A szerver oldali callback URL
$scopes = 'https://www.googleapis.com/auth/drive.file';

// Ellenőrizzük, hogy van-e "prompt" paraméter az URL-ben
$prompt = isset($_GET['prompt']) ? $_GET['prompt'] : 'none';

$authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" . http_build_query([
    'response_type' => 'code',
    'client_id' => $clientId,
    'redirect_uri' => $redirectUri,
    'scope' => $scopes,
    'access_type' => 'offline',
    'prompt' => $prompt
]);

// Átirányítjuk a felhasználót a Google bejelentkezési oldalára
header("Location: $authUrl");
exit;

?>
