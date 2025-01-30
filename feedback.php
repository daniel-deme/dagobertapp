<?php
// A Google Apps Script Web App URL-je
$webAppUrl = "https://script.google.com/macros/s/AKfycbwHbPkKcnslhPKT-xBh_JkEXnu0gv3x61xRMCpHfWdtWRfVSQ6OtIHp42oRgfxPSEPE/exec";

// Feedback adat meghatározása
$feedback = $_POST['feedback'] ?? "This is a test feedback"; // Ha nincs feedback, használjunk fix értéket

// A Google Apps Script-hez való kérés beállítása
$options = [
    "http" => [
        "header" => "Content-Type: application/x-www-form-urlencoded\r\n",
        "method" => "POST",
        "content" => http_build_query(['feedback' => $feedback]),
    ]
];

$context = stream_context_create($options);
$result = file_get_contents($webAppUrl, false, $context);

// Ellenőrizzük, hogy a kérés sikeres volt-e
if ($result === FALSE) {
    echo "Error: Unable to reach Google Apps Script.";
    exit;
}

// CORS fejléc beállítása a válaszhoz
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Visszaadjuk a Google Apps Script válaszát a kliensnek
echo $result;

