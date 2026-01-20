<?php
/* ================================================== */
/*          OAUTH CALLBACK HANDLER                     */
/*          Receives Google OAuth authorization code   */
/* ================================================== */

header('Content-Type: text/html; charset=utf-8');

// Get authorization code and state from Google
$code = isset($_GET['code']) ? $_GET['code'] : '';
$state = isset($_GET['state']) ? $_GET['state'] : '';
$error = isset($_GET['error']) ? $_GET['error'] : '';

// Handle errors
if ($error) {
    outputResult(false, 'Authorization denied: ' . $error);
    exit;
}

if (!$code) {
    outputResult(false, 'No authorization code received');
    exit;
}

// Parse state to get credential ID
$stateData = json_decode($state, true);
$credentialId = isset($stateData['credId']) ? $stateData['credId'] : '';

// Load storage to get client credentials
$storagePath = __DIR__ . '/storage.json';
$storage = [];
if (file_exists($storagePath)) {
    $storage = json_decode(file_get_contents($storagePath), true) ?: [];
}

// Find the credential to get client ID and secret
$credential = null;
if (isset($storage['credentials']) && is_array($storage['credentials'])) {
    foreach ($storage['credentials'] as $cred) {
        if (isset($cred['id']) && $cred['id'] === $credentialId) {
            $credential = $cred;
            break;
        }
    }
}

// If we don't have credentials stored yet, check session/temporary storage
// For now, we'll use query params or skip token exchange (let frontend handle it)

if ($credential && isset($credential['data']['clientId']) && isset($credential['data']['clientSecret'])) {
    // Exchange code for tokens
    $clientId = $credential['data']['clientId'];
    $clientSecret = $credential['data']['clientSecret'];
    $redirectUri = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') 
                   . '://' . $_SERVER['HTTP_HOST'] . '/oauth-callback.php';
    
    $tokenUrl = 'https://oauth2.googleapis.com/token';
    $postData = [
        'code' => $code,
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri' => $redirectUri,
        'grant_type' => 'authorization_code'
    ];
    
    $ch = curl_init($tokenUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $tokens = json_decode($response, true);
    
    if ($httpCode === 200 && isset($tokens['access_token'])) {
        // Save tokens to credential
        if (!isset($credential['data'])) {
            $credential['data'] = [];
        }
        $credential['data']['accessToken'] = $tokens['access_token'];
        $credential['data']['refreshToken'] = isset($tokens['refresh_token']) ? $tokens['refresh_token'] : '';
        $credential['data']['tokenExpiry'] = time() + (isset($tokens['expires_in']) ? intval($tokens['expires_in']) : 3600);
        $credential['data']['isConnected'] = true;
        $credential['data']['connectedAt'] = date('c');
        
        // Update storage
        foreach ($storage['credentials'] as &$storedCred) {
            if ($storedCred['id'] === $credentialId) {
                $storedCred = $credential;
                break;
            }
        }
        
        file_put_contents($storagePath, json_encode($storage, JSON_PRETTY_PRINT));
        
        outputResult(true, 'Google account connected successfully!');
    } else {
        $errorMsg = isset($tokens['error_description']) ? $tokens['error_description'] : 'Token exchange failed';
        outputResult(false, $errorMsg);
    }
} else {
    // Fallback: Just signal success to close popup
    // Frontend will handle the actual token exchange
    outputResult(true, 'Authorization received. Please save your credential to complete setup.');
}

function outputResult($success, $message) {
    $statusClass = $success ? 'success' : 'error';
    $icon = $success ? '✓' : '✗';
    
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OAuth Callback - ArcFlow</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            background: rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .icon.success { color: #10b981; }
        .icon.error { color: #ef4444; }
        h2 { margin-bottom: 15px; font-weight: 600; }
        p { color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 20px; }
        .close-btn {
            background: linear-gradient(135deg, #8b5cf6, #6366f1);
            color: white;
            border: none;
            padding: 12px 32px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .close-btn:hover { transform: scale(1.05); }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon {$statusClass}">{$icon}</div>
        <h2>{$message}</h2>
        <p>This window will close automatically...</p>
        <button class="close-btn" onclick="window.close()">Close Window</button>
    </div>
    <script>
        // Notify parent window
        if (window.opener) {
            window.opener.postMessage({
                type: 'oauth-complete',
                success: {$success},
                message: '{$message}'
            }, '*');
        }
        
        // Auto-close after 3 seconds
        setTimeout(function() {
            window.close();
        }, 3000);
    </script>
</body>
</html>
HTML;
}
?>
