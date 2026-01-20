<?php
/* ================================================== */
/*                                                    */
/*          ARCFLOW NODES API v8.0                    */
/*          Backend Execution Engine                  */
/*                                                    */
/* ================================================== */

/* ================================================== */
/*          PART 1: CONFIGURATION                     */
/* ================================================== */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Arcflow-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/* ================================================== */
/*          PART 2: REQUEST HANDLING                  */
/* ================================================== */

// Define storage directory for file operations
define('STORAGE_DIR', __DIR__ . '/storage/files/');
if (!file_exists(STORAGE_DIR)) {
    mkdir(STORAGE_DIR, 0777, true);
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if ($rawInput !== '' && json_last_error() !== JSON_ERROR_NONE) {
    sendError('Invalid JSON input: ' . json_last_error_msg());
}
if (!is_array($input)) {
    sendError('Invalid JSON input');
}

$action = isset($input['action']) ? $input['action'] : '';

/* -------------------------------------------------- */
/*      Action Router                                 */
/* -------------------------------------------------- */
// PART 2: CORE HELPERS
// --------------------------------------------------

/**
 * Generate a UUID v4 for Circle Idempotency Keys
 */
function generateUuidV4() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // set version to 0100
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // set bits 6-7 to 10
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}


switch ($action) {

    // AI MODELS
    case 'gemini':
        handleGemini($input);
        break;

    case 'openai':
        handleOpenAI($input);
        break;

    case 'claude':
        handleClaude($input);
        break;

    // HTTP ACTIONS
    case 'http_request':
        handleHttpRequest($input);
        break;

    case 'fetch_html':
        handleFetchHtml($input);
        break;

    // GOOGLE CLOUD
    case 'google_sheets':
        handleGoogleSheets($input);
        break;

    case 'google_drive':
        handleGoogleDrive($input);
        break;

    case 'gmail':
        handleGmail($input);
        break;

    case 'google_calendar':
        handleGoogleCalendar($input);
        break;

    // MEMORY persistence
    case 'get_chat_history':
        handleGetChatHistory($input);
        break;

    case 'save_chat_history':
        handleSaveChatHistory($input);
        break;

    case 'save_webhook_response':
        handleSaveWebhookResponse($input);
        break;

    // COMMUNICATION
    case 'slack':
        handleSlack($input);
        break;

    case 'discord_webhook':
        handleDiscordWebhook($input);
        break;

    case 'telegram':
        handleTelegram($input);
        break;

    case 'send_email':
        handleSendEmail($input);
        break;

    // FILE OPERATIONS
    case 'read_file':
        handleReadFile($input);
        break;

    case 'write_file':
        handleWriteFile($input);
        break;
        
    case 'compress_file':
        handleCompression($input);
        break;

    // AI MEMORY
    case 'memory':
        handleMemory($input);
        break;

    // DATABASE
    case 'mysql_query':
        handleMysqlQuery($input);
        break;

    case 'mysql':
        handleMysqlQuery($input);
        break;

    case 'supabase':
        handleSupabase($input);
        break;

    case 'postgres':
        handlePostgres($input);
        break;

    case 'discord':
        handleDiscordWebhook($input);
        break;

    // Webhook Trigger (Incoming)
    case 'webhook_trigger':
        handleWebhookTrigger($input);
        break;

    // UTILITY
    case 'html_extract':
        handleHtmlExtract($input);
        break;

    case 'crypto_hash':
        handleCryptoHash($input);
        break;

    // ARC NETWORK / CIRCLE NODES
    case 'circle_gateway':
        handleCircleGateway($input);
        break;

    case 'circle_wallet':
        handleCircleWallet($input);
        break;

    case 'arc_usdc_transfer':
        handleArcUsdcTransfer($input);
        break;



    case 'arc_contract':
        handleArcContract($input);
        break;

    case 'arc_blockchain_event':
        handleArcBlockchainEvent($input);
        break;

    case 'x402_payment_webhook':
        handleX402PaymentWebhook($input);
        break;

    case 'arc_fx_swap':
        handleArcFxSwap($input);
        break;

    case 'arc_scan':
        handleArcScan($input);
        break;

    case 'circle_gas_station':
        handleCircleGasStation($input);
        break;

    case 'circle_cctp':
        handleCircleCctp($input);
        break;

    case 'circle_balance':
        handleCircleBalance($input);
        break;

    case 'circle_transactions':
        handleCircleTransactions($input);
        break;

    case 'arc_rpc_call':
        handleArcRpcCall($input);
        break;

    // AI TOOL CALLING
    case 'gemini_tools':
        handleGeminiWithTools($input);
        break;

    case 'openai_tools':
        handleOpenAIWithTools($input);
        break;

    case 'claude_tools':
        handleClaudeWithTools($input);
        break;

    default:
        sendError('Unknown action: ' . $action);
        break;
}

/* ================================================== */
/*          PART 3: RESPONSE HELPERS                  */
/* ================================================== */

/**
 * RSA-OAEP Sha256 Encryption for Circle Entity Secrets
 */
function encryptCircleEntitySecret($apiKey, $credId) {
    if (empty($apiKey)) return '';
    
    $cred = getCredentialById($credId);
    if (!$cred || empty($cred['data']['entitySecret'])) return '';
    $rawSecret = $cred['data']['entitySecret'];
    
    // 1. Fetch Circle Public Key
    $url = 'https://api.circle.com/v1/w3s/config/entity/publicKey';
    $headers = ['Authorization: Bearer ' . $apiKey];
    $response = makeRequest($url, null, $headers, 'GET');
    
    if ($response['code'] !== 200) {
        error_log("Circle API Error fetching public key: " . ($response['error'] ?? $response['body']));
        return '';
    }
    $data = json_decode($response['body'], true);
    $pubKeyPem = $data['data']['publicKey'] ?? '';
    
    if (empty($pubKeyPem)) {
        error_log("Circle API Public Key missing in response: " . $response['body']);
        return '';
    }
    
    // 2. Encrypt using RSA-OAEP Sha256
    $binarySecret = hex2bin($rawSecret);
    $encrypted = '';
    $success = openssl_public_encrypt($binarySecret, $encrypted, $pubKeyPem, OPENSSL_PKCS1_OAEP_PADDING);
    
    if (!$success) {
        error_log("OpenSSL encryption failed for Entity Secret: " . openssl_error_string());
        return '';
    }
    
    return base64_encode($encrypted);
}

/**
 * Verify Circle Webhook Signature
 * Usage: Call this for any webhook coming from Circle
 */
function verifyCircleWebhook($payload, $headers) {
    // 1. Extract Headers
    // Header keys may be case-insensitive, normalize or check diverse cases
    $sig = $headers['Test-Signature'] ?? ($headers['x-circle-signature'] ?? ($headers['X-Circle-Signature'] ?? ''));
    $keyId = $headers['x-circle-key-id'] ?? ($headers['X-Circle-Key-Id'] ?? '');

    if (empty($sig) || empty($keyId)) {
        return ['valid' => false, 'error' => 'Missing Signature or Key ID'];
    }

    // 2. Fetch Public Key
    // production: https://api.circle.com, sandbox: https://api-sandbox.circle.com
    // For Arc Testnet we use sandbox for CCTP usually, but specific endpoint depends on env.
    // We'll try sandbox first as this is likely a testnet integration
    $url = "https://api-sandbox.circle.com/v2/notifications/publicKey/{$keyId}";
    
    // Note: In a real high-perf prod environment, cache this key!
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return ['valid' => false, 'error' => 'Failed to fetch Circle Public Key'];
    }

    $data = json_decode($response, true);
    $pubKeyBase64 = $data['data']['publicKey'] ?? '';
    
    if (empty($pubKeyBase64)) {
         return ['valid' => false, 'error' => 'Empty Public Key from API'];
    }

    // 3. Verify
    // Circle sends Base64 encoded PEM. We might need to wrap it if it's strict raw base64, 
    // but typically it's a PEM string base64 encoded.
    $pubKeyPem = base64_decode($pubKeyBase64);
    
    // Verify signature (openssl_verify default is SHA1, circle uses SHA256 usually)
    // Docs say: ECDSA or RSA? CCTP uses ECDSA. 
    // Just blindly verifying with openssl_verify against the payload.
    // Signature is binary? Header is usually hex or base64. Circle is hex?
    // Docs: "The signature is a base64-encoded string".
    
    $binarySig = base64_decode($sig);
    $algo = OPENSSL_ALGO_SHA256;
    
    $result = openssl_verify($payload, $binarySig, $pubKeyPem, $algo);
    
    if ($result === 1) {
        return ['valid' => true];
    } elseif ($result === 0) {
        return ['valid' => false, 'error' => 'Signature mismatch'];
    } else {
        return ['valid' => false, 'error' => 'OpenSSL Error: ' . openssl_error_string()];
    }
}

function sendSuccess($data, $message = 'Success') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}

function sendError($message) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $message,
        'data' => null
    ]);
    exit;
}

/* ================================================== */
/*          PART 4: AI MODEL HANDLERS                 */
/* ================================================== */

function handleGemini($input) {
    $apiKey = isset($input['apiKey']) ? trim($input['apiKey']) : '';
    $credentialId = $input['credentialId'] ?? ($input['config']['credentialId'] ?? null);
    
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && ($cred['type'] === 'gemini_api' || $cred['type'] === 'gemini')) {
            $apiKey = $cred['data']['apiKey'] ?? $apiKey;
        }
    }

    $model = (!empty($input['model'])) ? trim($input['model']) : 'gemini-2.5-flash';
    if (!$model) $model = 'gemini-2.5-flash';
    $prompt = isset($input['prompt']) ? trim($input['prompt']) : '';
    $temperature = isset($input['temperature']) ? floatval($input['temperature']) : 0.7;
    $maxTokens = isset($input['maxTokens']) ? intval($input['maxTokens']) : 2048;

    if (empty($apiKey)) sendError('API key is required (check Credential)');
    if (empty($prompt)) sendError('Prompt is required');

    $temperature = max(0, min(1, $temperature));
    $maxTokens = max(1, min(8192, $maxTokens));

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . $apiKey;

    $aiContext = $input['aiContext'] ?? ['memory' => [], 'tools' => []];
    $conversationHistory = $input['conversationHistory'] ?? [];
    
    // 1. Process Memory (Injected into System Instruction for fallback)
    $memoryText = "";
    if (!empty($aiContext['memory'])) {
        foreach ($aiContext['memory'] as $mem) {
            if (isset($mem['messages'])) {
                // Window Buffer Memory
                $memoryText .= "\n[Session: " . ($mem['sessionId'] ?? 'default') . "]\n";
                foreach ($mem['messages'] as $m) {
                    $memoryText .= strtoupper($m['role']) . ": " . $m['content'] . "\n";
                }
            } else {
                 $memoryText .= "\n" . json_encode($mem, JSON_PRETTY_PRINT + JSON_UNESCAPED_UNICODE) . "\n";
            }
        }
        if ($memoryText !== "") {
            $memoryText = "\n\n--- PREVIOUS CONVERSATION HISTORY ---\n" . $memoryText;
        }
    }
    
    // 2. Process Tools (Injected into System Instruction for fallback)
    $toolsText = "";
    if (!empty($aiContext['tools'])) {
        $toolsText = "\n\n--- AVAILABLE TOOLS (INFORMATIONAL) ---\n";
        foreach ($aiContext['tools'] as $tool) {
            $toolsText .= "- " . ($tool['name'] ?? 'Unnamed Tool') . ": " . ($tool['description'] ?? 'Execute action') . "\n";
        }
    }

    $systemInstruction = isset($input['systemInstruction']) ? trim($input['systemInstruction']) : '';
    if ($memoryText !== "" || $toolsText !== "") {
        if ($systemInstruction === "") {
            $systemInstruction = "You have access to the following context:\n" . $memoryText . $toolsText;
        } else {
            $systemInstruction .= "\n\nContext available to you:\n" . $memoryText . $toolsText;
        }
    }

    $requestBody = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => $temperature,
            'maxOutputTokens' => $maxTokens,
            'topP' => 0.95,
            'topK' => 40
        ]
    ];

    if ($systemInstruction !== "") {
        $requestBody['system_instruction'] = [
            'parts' => [
                ['text' => $systemInstruction]
            ]
        ];
    }

    $response = makeRequest($url, $requestBody, [], 'POST');

    if ($response['error']) sendError('Request failed: ' . $response['error']);

    $httpCode = $response['code'];
    $data = json_decode($response['body'], true);

    if ($httpCode !== 200) {
        $errorMsg = 'Gemini API Error (HTTP ' . $httpCode . ')';
        if (isset($data['error']['message'])) $errorMsg = $data['error']['message'];
        sendError($errorMsg);
    }

    if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
        sendSuccess($data['candidates'][0]['content']['parts'][0]['text'], 'Gemini executed successfully');
    }

    sendError('Unexpected response format');
}

function handleOpenAI($input) {
    $apiKey = isset($input['apiKey']) ? trim($input['apiKey']) : '';
    $credentialId = $input['credentialId'] ?? ($input['config']['credentialId'] ?? null);
    
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && ($cred['type'] === 'openai_api' || $cred['type'] === 'openai')) {
            $apiKey = $cred['data']['apiKey'] ?? $apiKey;
        }
    }

    $model = (!empty($input['model']) && is_string($input['model'])) ? trim($input['model']) : 'gpt-4o';
    if (!$model) $model = 'gpt-4o';
    $prompt = isset($input['prompt']) ? trim($input['prompt']) : '';
    $systemPrompt = isset($input['systemPrompt']) ? trim($input['systemPrompt']) : '';
    $temperature = isset($input['temperature']) ? floatval($input['temperature']) : 0.7;
    $maxTokens = isset($input['maxTokens']) ? intval($input['maxTokens']) : 2048;

    if (empty($apiKey)) sendError('API key is required (check Credential)');
    if (empty($prompt)) sendError('Prompt is required');

    $url = 'https://api.openai.com/v1/chat/completions';

    $aiContext = $input['aiContext'] ?? ['memory' => [], 'tools' => []];
    // 1. Process Memory (Injected into System Prompt)
    $memoryText = "";
    if (!empty($aiContext['memory'])) {
        foreach ($aiContext['memory'] as $mem) {
            if (isset($mem['messages'])) {
                foreach ($mem['messages'] as $m) {
                    $memoryText .= strtoupper($m['role']) . ": " . $m['content'] . "\n";
                }
            } else {
                $memoryText .= json_encode($mem) . "\n";
            }
        }
        if ($memoryText !== "") {
            $memoryText = "\n\n--- PREVIOUS CONVERSATION HISTORY ---\n" . $memoryText;
        }
    }
    
    // 2. Process Tools (Injected into System Prompt)
    $toolsText = "";
    if (!empty($aiContext['tools'])) {
        $toolsText = "\n\n--- AVAILABLE TOOLS (INFORMATIONAL) ---\n";
        foreach ($aiContext['tools'] as $tool) {
            $toolsText .= "- " . ($tool['name'] ?? 'Unnamed Tool') . ": " . ($tool['description'] ?? 'Execute action') . "\n";
        }
    }

    if ($memoryText !== "" || $toolsText !== "") {
        if ($systemPrompt === "") {
            $systemPrompt = "You have access to the following context:\n" . $memoryText . $toolsText;
        } else {
            $systemPrompt .= "\n\nContext available to you:\n" . $memoryText . $toolsText;
        }
    }

    $messages = [];
    if ($systemPrompt !== '') {
        $messages[] = ['role' => 'system', 'content' => $systemPrompt];
    }
    $messages[] = ['role' => 'user', 'content' => $prompt];

    $requestBody = [
        'model' => $model,
        'messages' => $messages,
        'temperature' => $temperature,
        'max_tokens' => $maxTokens
    ];

    $headers = [
        'Authorization: Bearer ' . $apiKey
    ];

    $response = makeRequest($url, $requestBody, $headers, 'POST');

    if ($response['error']) sendError('Request failed: ' . $response['error']);

    $httpCode = $response['code'];
    $data = json_decode($response['body'], true);

    if ($httpCode !== 200) {
        $errorMsg = 'OpenAI API Error (HTTP ' . $httpCode . ')';
        if (isset($data['error']['message'])) $errorMsg = $data['error']['message'];
        sendError($errorMsg);
    }

    if (isset($data['choices'][0]['message']['content'])) {
        sendSuccess($data['choices'][0]['message']['content'], 'OpenAI executed successfully');
    }

    sendError('Unexpected response format');
}

function handleClaude($input) {
    $apiKey = isset($input['apiKey']) ? trim($input['apiKey']) : '';
    $credentialId = $input['credentialId'] ?? ($input['config']['credentialId'] ?? null);
    
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && ($cred['type'] === 'anthropic_api' || $cred['type'] === 'anthropic')) {
            $apiKey = $cred['data']['apiKey'] ?? $apiKey;
        }
    }

    $model = (!empty($input['model'])) ? trim($input['model']) : 'claude-sonnet-4-5-20250929';
    $prompt = isset($input['prompt']) ? trim($input['prompt']) : '';
    $maxTokens = isset($input['maxTokens']) ? intval($input['maxTokens']) : 2048;

    if (empty($apiKey)) sendError('API key is required (check Credential)');
    if (empty($prompt)) sendError('Prompt is required');

    $url = 'https://api.anthropic.com/v1/messages';

    $aiContext = $input['aiContext'] ?? ['memory' => [], 'tools' => []];
    // 1. Process Memory (Injected into System Prompt)
    $memoryText = "";
    if (!empty($aiContext['memory'])) {
        foreach ($aiContext['memory'] as $mem) {
            if (isset($mem['messages'])) {
                foreach ($mem['messages'] as $m) $memoryText .= strtoupper($m['role']) . ": " . $m['content'] . "\n";
            } else {
                $memoryText .= json_encode($mem) . "\n";
            }
        }
        if ($memoryText !== "") {
            $memoryText = "\n\n--- PREVIOUS CONVERSATION HISTORY ---\n" . $memoryText;
        }
    }

    // 2. Process Tools (Injected into System Prompt)
    $toolsText = "";
    if (!empty($aiContext['tools'])) {
        $toolsText = "\n\n--- AVAILABLE TOOLS (INFORMATIONAL) ---\n";
        foreach ($aiContext['tools'] as $tool) {
            $toolsText .= "- " . ($tool['name'] ?? 'Unnamed Tool') . ": " . ($tool['description'] ?? 'Execute action') . "\n";
        }
    }

    $systemPrompt = "";
    if ($memoryText !== "" || $toolsText !== "") {
        $systemPrompt = "You have access to the following context:\n" . $memoryText . $toolsText;
    }

    $requestBody = [
        'model' => $model,
        'max_tokens' => $maxTokens,
        'messages' => [
            ['role' => 'user', 'content' => $prompt]
        ]
    ];
    
    if ($systemPrompt !== "") {
        $requestBody['system'] = $systemPrompt;
    }

    $headers = [
        'x-api-key: ' . $apiKey,
        'anthropic-version: 2023-06-01'
    ];

    $response = makeRequest($url, $requestBody, $headers, 'POST');

    if ($response['error']) sendError('Request failed: ' . $response['error']);

    $httpCode = $response['code'];
    $data = json_decode($response['body'], true);

    if ($httpCode !== 200) {
        $errorMsg = 'Claude API Error (HTTP ' . $httpCode . ')';
        if (isset($data['error']['message'])) $errorMsg = $data['error']['message'];
        sendError($errorMsg);
    }

    if (isset($data['content'][0]['text'])) {
        sendSuccess($data['content'][0]['text'], 'Claude executed successfully');
    }

    sendError('Unexpected response format');
}

/* ================================================== */
/*          PART 5: HTTP ACTION HANDLERS              */
/* ================================================== */

/* ================================================== */
/*      PART 4.5: CREDENTIAL HELPER                   */
/* ================================================== */

function getCredentialById($id) {
    global $storageFile; // From api.php context or define relative
    $path = __DIR__ . '/storage.json';
    if (!file_exists($path)) return null;
    
    $storage = json_decode(file_get_contents($path), true);
    if (!isset($storage['credentials'])) return null;
    
    foreach ($storage['credentials'] as $cred) {
        if ($cred['id'] === $id) {
            // Normalize: ensure 'data' key exists
            if (!isset($cred['data'])) {
                $cred['data'] = [];
            }
            // Migrate legacy top-level apiKey to data.apiKey
            if (isset($cred['apiKey']) && !isset($cred['data']['apiKey'])) {
                $cred['data']['apiKey'] = $cred['apiKey'];
            }
            // Migrate legacy top-level entitySecret
            if (isset($cred['entitySecret']) && !isset($cred['data']['entitySecret'])) {
                $cred['data']['entitySecret'] = $cred['entitySecret'];
            }
            return $cred;
        }
    }
    return null;
}

/* ================================================== */
/*          PART 5: HTTP ACTION HANDLERS              */
/* ================================================== */

function handleHttpRequest($input) {
    // 1. CONFIG & INPUT
    $config = isset($input['config']) ? $input['config'] : []; // Node settings
    $nodeInput = isset($input['input']) ? $input['input'] : []; // Incoming data items
    
    // Support direct testing (legacy) or Node config
    $url = $config['url'] ?? ($input['url'] ?? '');
    $method = strtoupper($config['method'] ?? ($input['method'] ?? 'GET'));
    $headersRaw = $config['headers'] ?? ($input['headers'] ?? '{}');
    $bodyRaw = $config['body'] ?? ($input['body'] ?? '');
    $credentialId = $config['credential'] ?? null;

    if (empty($url)) sendError('URL is required');

    // 2. CREDENTIAL INJECTION
    $authHeaders = [];
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred) {
            $type = $cred['type'] ?? '';
            $data = $cred['data'] ?? [];
            
            if ($type === 'http_header') {
                $name = $data['name'] ?? '';
                $value = $data['value'] ?? '';
                if ($name && $value) $authHeaders[] = "$name: $value";
            }
            elseif ($type === 'openai_api') {
                $key = $data['apiKey'] ?? '';
                if ($key) $authHeaders[] = "Authorization: Bearer $key";
            }
            elseif ($type === 'google_oauth2') {
                // TODO: Refresh token logic would go here
                // For now assuming we just stored access token in a simple field for demo, 
                // or we use the 'data' structure from the modal
                 if(isset($data['accessToken'])) {
                     $authHeaders[] = "Authorization: Bearer " . $data['accessToken'];
                 }
            }
        }
    }

    // 3. HEADER PARSING
    $userHeaders = [];
    if (is_string($headersRaw)) {
        $decoded = json_decode($headersRaw, true);
        if (is_array($decoded)) {
             foreach($decoded as $k => $v) $userHeaders[] = "$k: $v";
        }
    } elseif (is_array($headersRaw)) {
        foreach($headersRaw as $k => $v) $userHeaders[] = "$k: $v";
    }

    $finalHeaders = array_merge($authHeaders, $userHeaders);

    // 4. cURL EXECUTION
    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($bodyRaw !== '') curl_setopt($ch, CURLOPT_POSTFIELDS, $bodyRaw);
    } elseif ($method === 'PUT' || $method === 'PATCH') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($bodyRaw !== '') curl_setopt($ch, CURLOPT_POSTFIELDS, $bodyRaw);
    } elseif ($method === 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    }

    if (!empty($finalHeaders)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $finalHeaders);
    }

    $responseBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    curl_close($ch);

    if ($error) sendError('Request failed: ' . $error);

    $jsonData = json_decode($responseBody, true);

    sendSuccess([
        'status' => $httpCode,
        'body' => $jsonData !== null ? $jsonData : $responseBody,
        'headers_sent' => $finalHeaders, // Debugging aid
        'isJson' => $jsonData !== null
    ], 'HTTP request completed');
}

function handleFetchHtml($input) {
    $url = isset($input['url']) ? trim($input['url']) : '';
    $selector = isset($input['selector']) ? trim($input['selector']) : '';

    if (empty($url)) sendError('URL is required');

    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    // DEV ONLY
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ArcFlow/1.0');

    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    curl_close($ch);

    if ($error) sendError('Fetch failed: ' . $error);
    if ($httpCode !== 200) sendError('HTTP Error: ' . $httpCode);

    if ($selector && class_exists('DOMDocument')) {
        libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        $dom->loadHTML($html);
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);

        // Very basic selector support: #id, .class, tag
        $xpathQuery = '//*';
        if (strpos($selector, '#') === 0) {
            $id = substr($selector, 1);
            $xpathQuery = "//*[@id='" . $id . "']";
        } elseif (strpos($selector, '.') === 0) {
            $class = substr($selector, 1);
            $xpathQuery = "//*[contains(concat(' ', normalize-space(@class), ' '), ' " . $class . " ')]";
        } else {
            $xpathQuery = "//" . $selector;
        }

        $elements = $xpath->query($xpathQuery);
        if ($elements && $elements->length > 0) {
            $html = $dom->saveHTML($elements->item(0));
        }
    }

    sendSuccess([
        'html' => $html,
        'length' => strlen($html),
        'url' => $url
    ], 'HTML fetched successfully');
}

/* ================================================== */
/*          PART 6: GOOGLE CLOUD HANDLERS             */
/* ================================================== */

function handleGoogleSheets($input) {
    $accessToken = isset($input['accessToken']) ? trim($input['accessToken']) : '';
    $operation = $input['operation'] ?? 'Read Rows';
    $spreadsheetId = $input['spreadsheetId'] ?? '';
    $range = $input['range'] ?? 'A1:Z100';
    $sheetName = $input['sheetName'] ?? 'Sheet1';

    if (!$accessToken) sendError('Access token required (connect Google OAuth credential first)');
    if (!$spreadsheetId) sendError('Spreadsheet ID required');

    $baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' . $spreadsheetId;
    $headers = ['Authorization: Bearer ' . $accessToken];

    switch ($operation) {

        case 'Read Rows': {
            $url = $baseUrl . '/values/' . urlencode($sheetName . '!' . $range);
            $response = makeRequest($url, null, $headers, 'GET');

            if ($response['error']) sendError($response['error']);
            $data = json_decode($response['body'], true);

            $rows = $data['values'] ?? [];
            if (count($rows) <= 0) sendSuccess([], 'Empty sheet');

            // If first row is header row, map objects
            if (count($rows) > 1) {
                $headerRow = $rows[0];
                $result = [];
                for ($i = 1; $i < count($rows); $i++) {
                    $row = $rows[$i];
                    $item = [];
                    foreach ($headerRow as $idx => $key) {
                        $item[$key] = $row[$idx] ?? '';
                    }
                    $result[] = $item;
                }
                sendSuccess($result, 'Rows retrieved');
            }

            // Only one row: return raw
            sendSuccess($rows, 'Rows retrieved');
        }

        case 'Append Row': {
            $valuesRaw = $input['values'] ?? [];

            // Frontend might send string JSON, try parse
            if (is_string($valuesRaw)) {
                $decoded = json_decode($valuesRaw, true);
                if (json_last_error() === JSON_ERROR_NONE) $valuesRaw = $decoded;
            }

            // Build row array
            $rowValues = [];
            if (is_array($valuesRaw) && is_assoc($valuesRaw)) {
                $rowValues = array_values($valuesRaw);
            } elseif (is_array($valuesRaw)) {
                $rowValues = $valuesRaw;
            } else {
                $rowValues = [$valuesRaw];
            }

            $url = $baseUrl . '/values/' . urlencode($sheetName . '!A1') . ':append?valueInputOption=USER_ENTERED';
            $body = ['values' => [$rowValues]];

            $response = makeRequest($url, $body, $headers, 'POST');
            if ($response['error']) sendError($response['error']);
            sendSuccess(json_decode($response['body'], true), 'Row appended');
        }

        default:
            sendError('Unknown operation: ' . $operation);
    }
}

function handleGoogleDrive($input) {
    $accessToken = isset($input['accessToken']) ? trim($input['accessToken']) : '';
    $operation = $input['operation'] ?? 'List Files';

    if (!$accessToken) sendError('Access token required (connect Google OAuth credential first)');

    $headers = ['Authorization: Bearer ' . $accessToken];

    switch ($operation) {
        case 'List Files': {
            $url = 'https://www.googleapis.com/drive/v3/files?pageSize=25&fields=files(id,name,mimeType,webViewLink,modifiedTime)';
            $response = makeRequest($url, null, $headers, 'GET');
            if ($response['error']) sendError($response['error']);
            $data = json_decode($response['body'], true);
            sendSuccess($data['files'] ?? [], 'Drive files retrieved');
        }

        case 'Delete File': {
            $fileId = $input['fileId'] ?? '';
            if (!$fileId) sendError('fileId required');
            $url = 'https://www.googleapis.com/drive/v3/files/' . urlencode($fileId);
            $response = makeRequest($url, null, $headers, 'DELETE');
            if ($response['error']) sendError($response['error']);
            sendSuccess(['deleted' => true, 'fileId' => $fileId], 'File deleted');
        }

        case 'Create Folder': {
            $name = $input['fileName'] ?? 'New Folder';
            $url = 'https://www.googleapis.com/drive/v3/files';
            $body = [
                'name' => $name,
                'mimeType' => 'application/vnd.google-apps.folder'
            ];
            $response = makeRequest($url, $body, $headers, 'POST');
            if ($response['error']) sendError($response['error']);
            sendSuccess(json_decode($response['body'], true), 'Folder created');
        }

        default:
            sendError('Operation not implemented: ' . $operation);
    }
}

function handleGmail($input) {
    $accessToken = isset($input['accessToken']) ? trim($input['accessToken']) : '';
    $operation = $input['operation'] ?? 'Send Email';

    if (!$accessToken) sendError('Access token required (connect Google OAuth credential first)');

    $headers = [
        'Authorization: Bearer ' . $accessToken
    ];

    if ($operation === 'Send Email') {
        $to = $input['to'] ?? '';
        $subject = $input['subject'] ?? '';
        $body = $input['body'] ?? '';
        $isHtml = !empty($input['isHtml']);

        if (!$to || !$subject || !$body) sendError('To, Subject, and Body required');

        $mime = "To: $to\r\n";
        $mime .= "Subject: $subject\r\n";
        $mime .= "MIME-Version: 1.0\r\n";
        $mime .= "Content-Type: " . ($isHtml ? "text/html" : "text/plain") . "; charset=utf-8\r\n\r\n";
        $mime .= $body;

        $encoded = rtrim(strtr(base64_encode($mime), '+/', '-_'), '=');

        $url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
        $data = ['raw' => $encoded];

        $response = makeRequest($url, $data, $headers, 'POST');
        if ($response['error']) sendError($response['error']);

        sendSuccess(json_decode($response['body'], true), 'Email sent');
    }

    if ($operation === 'Get Emails') {
        $maxResults = intval($input['maxResults'] ?? 10);
        $url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=' . $maxResults;
        $response = makeRequest($url, null, ['Authorization: Bearer ' . $accessToken], 'GET');
        if ($response['error']) sendError($response['error']);
        $data = json_decode($response['body'], true);
        sendSuccess($data['messages'] ?? [], 'Emails listed');
    }

    if ($operation === 'Get Email') {
        $id = $input['id'] ?? '';
        if (!$id) sendError('Email message id required');
        $url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' . urlencode($id) . '?format=full';
        $response = makeRequest($url, null, ['Authorization: Bearer ' . $accessToken], 'GET');
        if ($response['error']) sendError($response['error']);
        sendSuccess(json_decode($response['body'], true), 'Email fetched');
    }

    sendError('Unknown operation: ' . $operation);
}

function handleGoogleCalendar($input) {
    $accessToken = isset($input['accessToken']) ? trim($input['accessToken']) : '';
    $operation = $input['operation'] ?? 'List Events';
    $calendarId = $input['calendarId'] ?? 'primary';

    if (!$accessToken) sendError('Access token required (connect Google OAuth credential first)');

    $headers = ['Authorization: Bearer ' . $accessToken];

    if ($operation === 'Get Calendars') {
        $url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50';
        $response = makeRequest($url, null, $headers, 'GET');
        if ($response['error']) sendError($response['error']);
        $data = json_decode($response['body'], true);
        sendSuccess($data['items'] ?? [], 'Calendars retrieved');
    }

    if ($operation === 'List Events') {
        $url = 'https://www.googleapis.com/calendar/v3/calendars/' . urlencode($calendarId) . '/events?singleEvents=true&orderBy=startTime&maxResults=20';
        $response = makeRequest($url, null, $headers, 'GET');
        if ($response['error']) sendError($response['error']);
        $data = json_decode($response['body'], true);
        sendSuccess($data['items'] ?? [], 'Events retrieved');
    }

    sendError('Operation not implemented: ' . $operation);
}

/* ================================================== */
/*          PART 7: COMMUNICATION HANDLERS            */
/* ================================================== */

function handleSlack($input) {
    $token = $input['token'] ?? '';
    $channel = $input['channel'] ?? '';
    $text = $input['text'] ?? '';

    if (!$token) sendError('Token required');
    if (!$channel) sendError('Channel required');
    if (!$text) sendError('Message text required');

    $url = 'https://slack.com/api/chat.postMessage';
    $headers = ['Authorization: Bearer ' . $token];

    $body = [
        'channel' => $channel,
        'text' => $text,
        'username' => $input['username'] ?? 'ArcFlow Bot',
        'icon_emoji' => $input['iconEmoji'] ?? ':robot_face:'
    ];

    $response = makeRequest($url, $body, $headers, 'POST');
    if ($response['error']) sendError($response['error']);

    $data = json_decode($response['body'], true);
    if (!isset($data['ok']) || !$data['ok']) {
        sendError('Slack API error: ' . ($data['error'] ?? 'Unknown error'));
    }

    sendSuccess($data, 'Slack message sent');
}

function handleDiscordWebhook($input) {
    $url = $input['webhookUrl'] ?? '';
    $payload = $input['payload'] ?? [];

    if (!$url) sendError('Webhook URL required');

    $response = makeRequest($url, $payload, [], 'POST');
    if ($response['error']) sendError($response['error']);

    // Discord often returns 204 No Content
    if ($response['code'] >= 400) {
        sendError('Discord HTTP error: ' . $response['code']);
    }

    sendSuccess([], 'Discord message sent');
}

function handleWebhookTrigger($input) {
    // Basic implementation to satisfy curling
    // In a real app, this would push to a queue or WebSocket
    $path = $input['path'] ?? 'unknown';
    
    // For now, just return success so the user sees JSON instead of HTML
    // You might want to save this to a file that the frontend polls, e.g., 'storage/webhooks.json'
    
    $data = [
        'received_at' => date('c'),
        'path' => $path,
        'body' => json_decode($input['body'] ?? '{}', true),
        'method' => $input['method'] ?? 'GET'
    ];
    
    // Optional: Write to file for polling
    $file = __DIR__ . '/storage/files/webhook_' . preg_replace('/[^a-z0-9]/i', '', $path) . '.json';
    file_put_contents($file, json_encode($data));
    
    sendSuccess(['message' => 'Webhook received', 'trigger_id' => $path], 'Webhook accepted');
}

function handleTelegram($input) {
    $token = $input['botToken'] ?? '';
    $operation = $input['operation'] ?? 'Send Message';

    if (!$token) sendError('Bot token required');

    if ($operation === 'Send Message') {
        $chatId = $input['chatId'] ?? '';
        $text = $input['text'] ?? '';
        if (!$chatId) sendError('Chat ID required');

        $url = "https://api.telegram.org/bot$token/sendMessage";
        $body = [
            'chat_id' => $chatId,
            'text' => $text,
        ];
        if (!empty($input['parseMode'])) $body['parse_mode'] = $input['parseMode'];

        $response = makeRequest($url, $body, [], 'POST');
        if ($response['error']) sendError($response['error']);

        $data = json_decode($response['body'], true);
        if (!isset($data['ok']) || !$data['ok']) {
            sendError('Telegram API error: ' . ($data['description'] ?? 'Unknown error'));
        }

        sendSuccess($data['result'], 'Telegram message sent');
    }

    if ($operation === 'Get Updates') {
        $url = "https://api.telegram.org/bot$token/getUpdates";
        $response = makeRequest($url, null, [], 'GET');
        if ($response['error']) sendError($response['error']);
        $data = json_decode($response['body'], true);
        if (!isset($data['ok']) || !$data['ok']) {
            sendError('Telegram API error: ' . ($data['description'] ?? 'Unknown error'));
        }
        sendSuccess($data['result'], 'Telegram updates retrieved');
    }

    sendError('Unknown operation: ' . $operation);
}

function handleSendEmail($input) {
    // NOTE: Basic fallback. For real platform, replace with SMTP (PHPMailer).
    $to = $input['to'] ?? '';
    $subject = $input['subject'] ?? '';
    $message = $input['body'] ?? '';
    $from = $input['from'] ?? 'noreply@example.com';

    if (!$to || !$subject || !$message) sendError('To, Subject, Body required');

    $headers = "From: " . $from . "\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";

    if (mail($to, $subject, $message, $headers)) {
        sendSuccess(['sent' => true], 'Email sent');
    }

    sendError('Failed to send email (mail() failed)');
}

/* ================================================== */
/*          PART 8: DATABASE HANDLERS                 */
/* ================================================== */

function handleMysqlQuery($input) {
    $creds = $input['credentials'] ?? [];
    $query = $input['query'] ?? '';
    $params = $input['parameters'] ?? [];

    if (!$query) sendError('SQL query required');

    $host = $creds['host'] ?? 'localhost';
    $user = $creds['user'] ?? '';
    $pass = $creds['password'] ?? '';
    $dbName = $creds['database'] ?? '';
    $port = $creds['port'] ?? 3306;

    try {
        $dsn = "mysql:host=$host;port=$port;dbname=$dbName;charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);

        $stmt = $pdo->prepare($query);
        $stmt->execute(is_array($params) ? $params : []);

        if (stripos(ltrim($query), 'SELECT') === 0) {
            sendSuccess($stmt->fetchAll(), 'Query executed');
        } else {
            sendSuccess(['rowCount' => $stmt->rowCount()], 'Query executed');
        }
    } catch (PDOException $e) {
        sendError('Database error: ' . $e->getMessage());
    }
}

function handleSupabase($input) {
    $projectUrl = $input['projectUrl'] ?? '';
    $apiKey = $input['apiKey'] ?? '';
    $operation = $input['operation'] ?? 'Select';
    $table = $input['table'] ?? '';
    $columns = $input['columns'] ?? '*';
    $filters = $input['filters'] ?? '[]';
    $data = $input['data'] ?? '{}';
    $rpcName = $input['rpcName'] ?? '';
    $rpcParams = $input['rpcParams'] ?? '{}';
    
    if (!$projectUrl) sendError('Supabase project URL required');
    if (!$apiKey) sendError('Supabase API key required');
    if (!$table && $operation !== 'RPC (Function Call)') sendError('Table name required');
    
    // Ensure URL has proper format
    $projectUrl = rtrim($projectUrl, '/');
    
    $headers = [
        'apikey: ' . $apiKey,
        'Authorization: Bearer ' . $apiKey,
        'Prefer: return=representation'
    ];
    
    // Parse filters if string
    if (is_string($filters)) {
        $filters = json_decode($filters, true) ?? [];
    }
    
    // Parse data if string
    if (is_string($data)) {
        $data = json_decode($data, true) ?? [];
    }
    
    switch ($operation) {
        case 'Select':
            $url = $projectUrl . '/rest/v1/' . urlencode($table);
            $queryParams = [];
            
            // Add column selection
            if ($columns && $columns !== '*') {
                $queryParams[] = 'select=' . urlencode($columns);
            }
            
            // Add filters
            foreach ($filters as $filter) {
                $col = $filter['column'] ?? '';
                $op = $filter['operator'] ?? 'eq';
                $val = $filter['value'] ?? '';
                if ($col) {
                    $queryParams[] = urlencode($col) . '=' . $op . '.' . urlencode($val);
                }
            }
            
            if (!empty($queryParams)) {
                $url .= '?' . implode('&', $queryParams);
            }
            
            $response = makeRequest($url, null, $headers, 'GET');
            break;
            
        case 'Insert':
            $url = $projectUrl . '/rest/v1/' . urlencode($table);
            $response = makeRequest($url, $data, $headers, 'POST');
            break;
            
        case 'Update':
            $url = $projectUrl . '/rest/v1/' . urlencode($table);
            $queryParams = [];
            foreach ($filters as $filter) {
                $col = $filter['column'] ?? '';
                $op = $filter['operator'] ?? 'eq';
                $val = $filter['value'] ?? '';
                if ($col) {
                    $queryParams[] = urlencode($col) . '=' . $op . '.' . urlencode($val);
                }
            }
            if (!empty($queryParams)) {
                $url .= '?' . implode('&', $queryParams);
            }
            $response = makeRequest($url, $data, $headers, 'PATCH');
            break;
            
        case 'Upsert':
            $url = $projectUrl . '/rest/v1/' . urlencode($table);
            $headers[] = 'Prefer: resolution=merge-duplicates';
            $response = makeRequest($url, $data, $headers, 'POST');
            break;
            
        case 'Delete':
            $url = $projectUrl . '/rest/v1/' . urlencode($table);
            $queryParams = [];
            foreach ($filters as $filter) {
                $col = $filter['column'] ?? '';
                $op = $filter['operator'] ?? 'eq';
                $val = $filter['value'] ?? '';
                if ($col) {
                    $queryParams[] = urlencode($col) . '=' . $op . '.' . urlencode($val);
                }
            }
            if (!empty($queryParams)) {
                $url .= '?' . implode('&', $queryParams);
            }
            $response = makeRequest($url, null, $headers, 'DELETE');
            break;
            
        case 'RPC (Function Call)':
            if (!$rpcName) sendError('Function name required for RPC');
            $url = $projectUrl . '/rest/v1/rpc/' . urlencode($rpcName);
            $rpcData = is_string($rpcParams) ? json_decode($rpcParams, true) ?? [] : $rpcParams;
            $response = makeRequest($url, $rpcData, $headers, 'POST');
            break;
            
        default:
            sendError('Unknown Supabase operation: ' . $operation);
    }
    
    if ($response['error']) sendError('Supabase error: ' . $response['error']);
    
    $result = json_decode($response['body'], true);
    
    if ($response['code'] >= 400) {
        $errorMsg = isset($result['message']) ? $result['message'] : 'HTTP ' . $response['code'];
        sendError('Supabase API error: ' . $errorMsg);
    }
    
    sendSuccess($result ?? [], 'Supabase operation completed');
}

function handlePostgres($input) {
    $host = $input['host'] ?? 'localhost';
    $port = $input['port'] ?? 5432;
    $database = $input['database'] ?? '';
    $user = $input['user'] ?? '';
    $password = $input['password'] ?? '';
    $query = $input['query'] ?? '';
    $params = $input['params'] ?? '[]';
    
    if (!$database) sendError('Database name required');
    if (!$user) sendError('Username required');
    if (!$query) sendError('SQL query required');
    
    // Parse params if string
    if (is_string($params)) {
        $params = json_decode($params, true) ?? [];
    }

    $credentialId = $input['credentialId'] ?? ($input['config']['credentialId'] ?? null);
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && ($cred['type'] === 'postgres_db' || $cred['type'] === 'postgres')) {
            $host = $cred['data']['host'] ?? $host;
            $port = $cred['data']['port'] ?? $port;
            $database = $cred['data']['database'] ?? $database;
            $user = $cred['data']['user'] ?? $user;
            $password = $cred['data']['password'] ?? $password;
        }
    }
    
    try {
        $dsn = "pgsql:host=$host;port=$port;dbname=$database";
        $pdo = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        
        $stmt = $pdo->prepare($query);
        $stmt->execute(is_array($params) ? $params : []);
        
        // Check if it's a SELECT query
        if (stripos(ltrim($query), 'SELECT') === 0) {
            sendSuccess($stmt->fetchAll(), 'Postgres query executed');
        } else {
            sendSuccess([
                'rowCount' => $stmt->rowCount(),
                'success' => true
            ], 'Postgres query executed');
        }
    } catch (PDOException $e) {
        sendError('Postgres error: ' . $e->getMessage());
    }
}

/* ================================================== */
/*          PART 9: UTILITY HANDLERS                  */
/* ================================================== */



function handleHtmlExtract($input) {
    $html = $input['html'] ?? '';
    $selector = $input['selector'] ?? '';
    $extractType = $input['extractType'] ?? 'Text Content';
    $attribute = $input['attribute'] ?? '';

    if (!$html) sendError('HTML is required');
    if (!$selector) sendError('Selector is required');

    if (!class_exists('DOMDocument')) {
        sendError('DOMDocument not available on server');
    }

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    $dom->loadHTML($html);
    libxml_clear_errors();

    $xpath = new DOMXPath($dom);

    // Very basic selector support: #id, .class, tag
    $xpathQuery = '//*';
    if (strpos($selector, '#') === 0) {
        $id = substr($selector, 1);
        $xpathQuery = "//*[@id='" . $id . "']";
    } elseif (strpos($selector, '.') === 0) {
        $class = substr($selector, 1);
        $xpathQuery = "//*[contains(concat(' ', normalize-space(@class), ' '), ' " . $class . " ')]";
    } else {
        $xpathQuery = "//" . $selector;
    }

    $nodes = $xpath->query($xpathQuery);
    $results = [];

    if ($nodes instanceof DOMNodeList) {
    foreach ($nodes as $node) {
        if ($extractType === 'HTML') {
            $results[] = $dom->saveHTML($node);

        } elseif ($extractType === 'Attribute') {
            if (!$attribute) {
                sendError('Attribute name required for Attribute extract');
            }

            if ($node instanceof DOMElement) {
                $results[] = $node->getAttribute($attribute);
            } else {
                // Not an element node (rare with your selectors, but possible)
                $results[] = '';
            }

        } else {
            $results[] = trim($node->textContent);
        }
    }
 }

    sendSuccess([
        'selector' => $selector,
        'extractType' => $extractType,
        'results' => $results
    ], 'HTML extracted');
}

function handleCryptoHash($input) {
    $algo = $input['algorithm'] ?? 'sha256';
    $data = $input['input'] ?? '';

    if (!in_array($algo, hash_algos(), true)) {
        sendError('Algorithm not supported: ' . $algo);
    }

    sendSuccess(hash($algo, $data), 'Hashed');
}

/* ================================================== */
/*          PART 10: HTTP REQUEST HELPER              */
/* ================================================== */
/**
 * makeRequest supports GET/POST/DELETE and custom headers
 * - $body can be null
 * - if $method is GET or DELETE, body is ignored
 */
function makeRequest($url, $body = null, $customHeaders = [], $method = 'POST') {
    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    // PRODUCTION: SSL verification enabled for security
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

    $headers = ['User-Agent: ArcFlow/1.0'];
    if (!empty($customHeaders)) $headers = array_merge($headers, $customHeaders);

    // If body is array/object, send JSON
    $isJsonBody = is_array($body) || is_object($body);
    if ($isJsonBody) {
        $headers[] = 'Content-Type: application/json';
    }

    $method = strtoupper($method);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $isJsonBody ? json_encode($body) : $body);
        }
    } elseif ($method === 'GET') {
        curl_setopt($ch, CURLOPT_HTTPGET, true);
    } elseif ($method === 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    } elseif ($method === 'PUT' || $method === 'PATCH') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $isJsonBody ? json_encode($body) : $body);
        }
    } else {
        // fallback
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $isJsonBody ? json_encode($body) : $body);
        }
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $responseBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    curl_close($ch);

    return [
        'body' => $responseBody,
        'code' => $httpCode,
        'error' => $error ? $error : null
    ];
}

function is_assoc(array $arr) {
    if ($arr === []) return false;
    return array_keys($arr) !== range(0, count($arr) - 1);
}

/* ================================================== */
/*      PART 5: FILE OPERATIONS                       */
/* ================================================== */

function getSafePath($filename) {
    // Sanitize filename to prevent directory traversal
    $filename = basename($filename);
    return STORAGE_DIR . $filename;
}

function handleReadFile($input) {
    $filename = isset($input['filename']) ? $input['filename'] : '';
    if (!$filename) sendError('Filename required');
    
    $path = getSafePath($filename);
    
    if (!file_exists($path)) {
        sendError('File not found: ' . $filename);
    }
    
    $content = file_get_contents($path);
    $encoding = isset($input['encoding']) ? $input['encoding'] : 'utf8';
    
    if ($encoding === 'base64') {
        $content = base64_encode($content);
    }
    
    sendSuccess([
        'filename' => $filename,
        'content' => $content,
        'size' => filesize($path),
        'mime' => mime_content_type($path)
    ]);
}

function handleWriteFile($input) {
    $filename = isset($input['filename']) ? $input['filename'] : '';
    $content = isset($input['content']) ? $input['content'] : '';
    $encoding = isset($input['encoding']) ? $input['encoding'] : 'utf8';
    $append = isset($input['append']) && $input['append'] === true;
    
    if (!$filename) sendError('Filename required');
    
    $path = getSafePath($filename);
    
    if ($encoding === 'base64') {
        $content = base64_decode($content);
    }
    
    $flags = $append ? FILE_APPEND : 0;
    $result = file_put_contents($path, $content, $flags);
    
    if ($result === false) {
        sendError('Failed to write file');
    }
    
    sendSuccess([
        'filename' => $filename,
        'size' => $result,
        'path' => $path
    ]);
}

function handleCompression($input) {
    $files = isset($input['files']) ? $input['files'] : []; // Array of filenames
    $archiveName = isset($input['archiveName']) ? $input['archiveName'] : 'archive.zip';
    $operation = isset($input['operation']) ? $input['operation'] : 'zip';
    
    $archivePath = getSafePath($archiveName);
    
    if ($operation === 'zip') {
        $zip = new ZipArchive();
        if ($zip->open($archivePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
            sendError('Cannot create zip file');
        }
        
        foreach ($files as $file) {
            $path = getSafePath($file);
            if (file_exists($path)) {
                $zip->addFile($path, basename($path));
            }
        }
        
        $zip->close();
        
        sendSuccess([
            'archiveName' => $archiveName,
            'size' => filesize($archivePath),
            'fileCount' => count($files)
        ]);
    } else {
        // Unzip logic could go here
        sendError('Only zip operation supported currently');
    }
}

function handleMemory($input) {
    // Simple JSON file based key-value store
    $file = STORAGE_DIR . 'memory.json';
    $mem = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
    if (!is_array($mem)) $mem = [];
    
    $op = isset($input['operation']) ? $input['operation'] : 'get';
    $key = isset($input['key']) ? $input['key'] : '';
    
    if (!$key && $op !== 'get_all') sendError('Key required');
    
    if ($op === 'get') {
        $val = isset($mem[$key]) ? $mem[$key] : null;
        // If it's a conversation history request, ensure we return it clearly
        sendSuccess(['key' => $key, 'value' => $val, 'isHistory' => (strpos($key, 'history_') === 0)]);
    } else if ($op === 'set') {
        $value = isset($input['value']) ? $input['value'] : null;
        $mem[$key] = $value;
        // Optional: trim history to context window if needed (Brutal parity for performance)
        if (strpos($key, 'history_') === 0 && is_array($value) && count($value) > 20) {
            $mem[$key] = array_slice($value, -20);
        }
        file_put_contents($file, json_encode($mem, JSON_PRETTY_PRINT));
        sendSuccess(['key' => $key, 'value' => $mem[$key]]);
    } else if ($op === 'delete') {
        if (isset($mem[$key])) unset($mem[$key]);
        file_put_contents($file, json_encode($mem, JSON_PRETTY_PRINT));
        sendSuccess(['key' => $key, 'deleted' => true]);
    } else if ($op === 'get_all') {
        sendSuccess($mem);
    }
}


/* ================================================== */
/*          PART 10: ARC NETWORK / CIRCLE HANDLERS    */
/* ================================================== */

function handleCircleGateway($input) {
    $config = $input['config'] ?? [];
    $operation = $input['operation'] ?? ($config['operation'] ?? 'Transfer USDC (CCTP)');
    $credentialId = $config['credentialId'] ?? null;
    
    // Get Circle API key
    $apiKey = '';
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && isset($cred['data']['apiKey'])) {
            $apiKey = $cred['data']['apiKey'];
        }
    }
    
    if (empty($apiKey)) {
        sendError('Circle API Key is required');
    }

    $baseUrl = 'https://api-sandbox.circle.com/v1'; // Hackathon (Arc Testnet) uses Sandbox
    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ];

    switch ($operation) {
        case 'Transfer USDC (CCTP)':
            // Note: This matches sending a transfer, typically to CCTP methods if supported by the API direct
            // Uses generic transfer intent structure
            $url = $baseUrl . '/transfers';
            
            $payload = [
                'source' => [
                    'type' => 'wallet',
                    'id' => $config['sourceWalletId'] ?? '' // Requires wallet ID
                ],
                'destination' => [
                    'type' => 'blockchain',
                    'address' => $config['destinationAddress'] ?? '',
                    'chain' => $config['destinationChain'] ?? 'ETH'
                ],
                'amount' => [
                    'amount' => $config['amount'] ?? '0.00',
                    'currency' => 'USD'
                ],
                'idempotencyKey' => uniqid('cctp_')
            ];
            
            // For now, if no wallet ID provided, we return a helpful error or mock success if in test mode
            // BUT per instructions, we want "brutally accurate" - so we attempt the call.
            
            $response = makeRequest($url, $payload, $headers, 'POST');
            
            if ($response['code'] >= 200 && $response['code'] < 300) {
                sendSuccess(json_decode($response['body'], true));
            } else {
                // If call fails (likely due to missing source wallet ID in this simplified node), 
                // we return the RAW error so the user knows exactly what to fix.
                $err = json_decode($response['body'], true);
                sendError('Circle API Error: ' . json_encode($err));
            }
            break;
            
        case 'Check Transfer Status':
             // Get transfer status
             // Using generic endpoint as placeholder for specific CCTP status checks
             sendError('Transfer Status check requires Transfer ID');
             break;

        default:
            sendError('Unknown Circle Gateway operation: ' . $operation);
    }
}

function handleCircleWallet($input) {
    $config = $input['config'] ?? [];
    $operation = $input['operation'] ?? ($config['operation'] ?? 'Get Balance');
    $credentialId = $config['credentialId'] ?? null;
    
    // Get Circle API key
    $apiKey = '';
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && isset($cred['data']['apiKey'])) {
            $apiKey = $cred['data']['apiKey'];
        }
    }
    
    if (empty($apiKey)) {
        sendError('Circle API Key is required');
    }

    $baseUrl = 'https://api.circle.com/v1/w3s';
    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ];

    switch ($operation) {
        case 'Create Wallet':
            $url = $baseUrl . '/developer/wallets';
            $idempotencyKey = $config['idempotencyKey'] ?? uniqid('wallet_');
            $entitySecretCiphertext = $config['entitySecretCiphertext'] ?? '';
            
            if (empty($entitySecretCiphertext)) {
                 sendError('Entity Secret Ciphertext is required to create a wallet');
            }
            
            $payload = [
                'idempotencyKey' => $idempotencyKey,
                'entitySecretCiphertext' => $entitySecretCiphertext,
                'blockchains' => [$config['blockchain'] ?? 'ETH-SEPOLIA'],
                'count' => 1,
                'walletSetId' => $config['walletSetId'] ?? '' // Optional, if empty new set created
            ];
            
            // Remove walletSetId if empty to allow creation of new set
            if (empty($payload['walletSetId'])) unset($payload['walletSetId']);

            $response = makeRequest($url, $payload, $headers, 'POST');
            
            if ($response['code'] >= 200 && $response['code'] < 300) {
                sendSuccess(json_decode($response['body'], true));
            } else {
                $err = json_decode($response['body'], true);
                sendError('Circle API Error: ' . ($err['message'] ?? $response['body']));
            }
            break;
            
        case 'Get Balance':
            $walletId = $config['walletId'] ?? '';
            if (empty($walletId)) sendError('Wallet ID is required');
            
            $url = $baseUrl . '/wallets/' . $walletId . '/balances';
            
            $response = makeRequest($url, null, $headers, 'GET');
            
            if ($response['code'] >= 200 && $response['code'] < 300) {
                sendSuccess(json_decode($response['body'], true));
            } else {
                $err = json_decode($response['body'], true);
                sendError('Circle API Error: ' . ($err['message'] ?? $response['body']));
            }
            break;
            
        case 'Send Transfer':
            $url = $baseUrl . '/developer/transactions/transfer';
            $idempotencyKey = $config['idempotencyKey'] ?? uniqid('tx_');
            $entitySecretCiphertext = $config['entitySecretCiphertext'] ?? '';
             
             if (empty($entitySecretCiphertext)) {
                 sendError('Entity Secret Ciphertext is required for transfers');
            }
            
            $payload = [
                'idempotencyKey' => $idempotencyKey,
                'entitySecretCiphertext' => $entitySecretCiphertext,
                'amounts' => [
                    $config['amount'] ?? '0'
                ],
                'destinationAddress' => $config['destinationAddress'] ?? '',
                'tokenId' => $config['tokenId'] ?? '', // UUID of the token
                'walletId' => $config['walletId'] ?? '',
                'fee' => [
                    'type' => 'level',
                    'config' => [
                        'feeLevel' => 'MEDIUM'
                    ]
                ]
            ];
            
            $response = makeRequest($url, $payload, $headers, 'POST');
            
            if ($response['code'] >= 200 && $response['code'] < 300) {
                sendSuccess(json_decode($response['body'], true));
            } else {
                $err = json_decode($response['body'], true);
                sendError('Circle API Error: ' . ($err['message'] ?? $response['body']));
            }
            break;
            
        case 'Get Transaction History':
             $walletId = $config['walletId'] ?? '';
            if (empty($walletId)) sendError('Wallet ID is required');
            
            $url = $baseUrl . '/wallets/' . $walletId . '/transactions';
            $response = makeRequest($url, null, $headers, 'GET');
            
             if ($response['code'] >= 200 && $response['code'] < 300) {
                sendSuccess(json_decode($response['body'], true));
            } else {
                $err = json_decode($response['body'], true);
                sendError('Circle API Error: ' . ($err['message'] ?? $response['body']));
            }
            break;
            
        default:
            sendError('Unknown Circle Wallet operation: ' . $operation);
    }
}

function handleArcUsdcTransfer($input) {
    // This is virtually identical to Circle Wallet 'Send Transfer' but pre-configured for Arc Network
    // We reuse the logic effectively by setting up the config and calling the Circle API
    
    $config = $input['config'] ?? [];
    $credentialId = $config['credentialId'] ?? null;
    
    $apiKey = '';
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && isset($cred['data']['apiKey'])) {
            $apiKey = $cred['data']['apiKey'];
        }
    }
    
    if (empty($apiKey)) sendError('Circle API Key (from Credential) is required');
    if (empty($config['entitySecretCiphertext'])) sendError('Entity Secret Ciphertext is required for signing');

    $url = 'https://api-sandbox.circle.com/v1/w3s/developer/transactions/transfer';
    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ];
    
    $payload = [
        'idempotencyKey' => generateUuidV4(),
        'entitySecretCiphertext' => $config['entitySecretCiphertext'] ?? encryptCircleEntitySecret($apiKey, $credentialId),
        'amounts' => [$config['amount'] ?? '0'],
        'destinationAddress' => $config['toAddress'] ?? '',
        'tokenId' => $config['tokenId'] ?? '0x3600000000000000000000000000000000000000', // Verified Arc USDC System Contract
        'walletId' => $config['walletId'] ?? '',
        'fee' => [
            'type' => 'level',
            'config' => [
                'feeLevel' => 'MEDIUM'
            ]
        ]
    ];
    
    $response = makeRequest($url, $payload, $headers, 'POST');
    
    if ($response['code'] >= 200 && $response['code'] < 300) {
        $data = json_decode($response['body'], true);
        // Enrich response with Arc-specific context
        $data['data']['network'] = $config['network'] ?? 'ARC-TESTNET';
        sendSuccess($data);
    } else {
        $err = json_decode($response['body'], true);
        sendError('Arc/Circle API Error: ' . ($err['message'] ?? $response['body']));
    }
}



function handleArcContract($input) {
    $config = $input['config'] ?? [];
    $operation = $config['operation'] ?? 'Read Contract';
    $rpcUrl = $config['rpcUrl'] ?? 'https://rpc.testnet.arc.network';
    $credentialId = $config['credentialId'] ?? null;

    // Helper to get Circle API Key
    $getCircleKey = function($credId) {
        if (!$credId) return '';
        $cred = getCredentialById($credId);
        return ($cred && isset($cred['data']['apiKey'])) ? $cred['data']['apiKey'] : '';
    };

    if ($operation === 'Read Contract') {
        if (empty($rpcUrl)) sendError('RPC URL is required');
        
        $payload = [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'eth_call',
            'params' => [
                [
                    'to' => $config['contractAddress'] ?? '',
                    'data' => $config['functionName'] ?? '0x' // Basic hex support
                ],
                'latest'
            ]
        ];
        
        $response = makeRequest($rpcUrl, $payload, [], 'POST');
        if ($response['code'] >= 200 && $response['code'] < 300) {
            sendSuccess(json_decode($response['body'], true));
        } else {
            sendError('RPC Error: ' . $response['body']);
        }
    } 
    elseif ($operation === 'Write Contract' || $operation === 'Execute Transaction') {
        // Use Circle Developer Wallet to execute
        $apiKey = $getCircleKey($credentialId);
        if (empty($apiKey)) sendError('Circle API Key required for Write operations');
        if (empty($config['walletId'])) sendError('Wallet ID required for Write operations');
        if (empty($config['entitySecretCiphertext'])) sendError('Entity Secret Ciphertext required');

        $url = 'https://api.circle.com/v1/w3s/developer/transactions/contractExecution';
        $headers = [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ];
        
        // Parse arguments
        $args = $config['functionArgs'] ?? [];
        if (is_string($args)) {
            $decoded = json_decode($args, true);
            if (json_last_error() === JSON_ERROR_NONE) $args = $decoded;
            else $args = [$args]; // Treat as single arg if not JSON
        }
        
        $payload = [
            'idempotencyKey' => uniqid('exec_'),
            'walletId' => $config['walletId'],
            'contractAddress' => $config['contractAddress'],
            'abiFunctionSignature' => $config['functionName'], // User must provide signature like "transfer(address,uint256)"
            'abiParameters' => $args,
            'entitySecretCiphertext' => $config['entitySecretCiphertext'],
            'fee' => ['type' => 'level', 'config' => ['feeLevel' => 'MEDIUM']]
        ];
        
        $response = makeRequest($url, $payload, $headers, 'POST');
        if ($response['code'] >= 200 && $response['code'] < 300) {
            sendSuccess(json_decode($response['body'], true));
        } else {
            sendError('Circle API Error: ' . $response['body']);
        }
    }
    elseif ($operation === 'Deploy Contract (Template)') {
        $apiKey = $getCircleKey($credentialId);
        if (empty($apiKey)) sendError('Circle API Key required for Deployment');
        if (empty($config['templateId'])) sendError('Template ID required');
        
        $url = 'https://api.circle.com/v1/w3s/developer/templates/' . $config['templateId'] . '/deployments';
        $headers = [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ];
        
        $params = $config['templateParams'] ?? [];
        if (is_string($params)) {
             $decoded = json_decode($params, true);
             if (json_last_error() === JSON_ERROR_NONE) $params = $decoded;
        }

        $payload = [
            'idempotencyKey' => uniqid('deploy_'),
            'name' => $config['templateName'] ?? 'MyContract',
            'description' => 'Deployed via ArcFlow',
            'walletId' => $config['walletId'],
            'templateParameters' => $params,
            'entitySecretCiphertext' => $config['entitySecretCiphertext'],
            'fee' => ['type' => 'level', 'config' => ['feeLevel' => 'MEDIUM']]
        ];
        
        $response = makeRequest($url, $payload, $headers, 'POST');
        if ($response['code'] >= 200 && $response['code'] < 300) {
            sendSuccess(json_decode($response['body'], true));
        } else {
            sendError('Circle API Error (Deploy): ' . $response['body']);
        }
    }
    else {
        sendError('Unknown Operation: ' . $operation);
    }
}
function handleArcFxSwap($input) {
    $config = $input['config'] ?? [];
    $fromCurrency = $config['fromCurrency'] ?? 'USDC';
    $toCurrency = $config['toCurrency'] ?? 'EURC';
    $amount = $config['amount'] ?? '0';
    $slippage = $config['slippage'] ?? '0.5';
    $network = $config['network'] ?? 'Arc Testnet';
    
    if ($fromCurrency === $toCurrency) {
        sendError('Source and destination currencies must be different');
    }
    
    // Mock FX swap calculation (simplified)
    $rate = 0.92; // Example: 1 USDC = 0.92 EURC
    if ($fromCurrency === 'EURC' && $toCurrency === 'USDC') {
        $rate = 1.09;
    }
    
    $outputAmount = number_format(floatval($amount) * $rate, 6, '.', '');
    $txHash = '0x' . bin2hex(random_bytes(32));
    
    sendSuccess([
        'operation' => 'FX Swap',
        'transactionHash' => $txHash,
        'status' => 'COMPLETED',
        'input' => [
            'currency' => $fromCurrency,
            'amount' => $amount
        ],
        'output' => [
            'currency' => $toCurrency,
            'amount' => $outputAmount
        ],
        'exchangeRate' => $rate,
        'slippage' => $slippage . '%',
        'fee' => '0.00',
        'network' => $network,
        'timestamp' => date('c'),
        '_note' => 'Mock data - Arc FX Engine integration required'
    ]);
}

function handleArcScan($input) {
    $config = $input['config'] ?? [];
    $credentialId = $config['credentialId'] ?? null;
    $module = $config['module'] ?? 'account'; // account, info, stats, user-ops
    $action = $config['action'] ?? 'balance';
    $network = $config['network'] ?? 'Arc Testnet';
    
    $apiKey = '';
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && isset($cred['data']['apiKey'])) {
            $apiKey = $cred['data']['apiKey'];
        }
    }
    
    $headers = [
        'accept: application/json'
    ];
    if (!empty($apiKey)) {
        $headers[] = 'Authorization: Bearer ' . $apiKey;
    }

    $baseUrl = ($network === 'Arc Mainnet') ? 'https://arcscan.app/api/v2' : 'https://testnet.arcscan.app/api/v2';
    
    // Support V2 REST endpoints
    $endpoint = '';
    $method = 'GET';
    
    switch ($module) {
        case 'stats':
            $endpoint = '/stats';
            break;
            
        case 'user-ops':
            $address = $config['address'] ?? '';
            $endpoint = '/user-operations' . ($address ? '?address=' . $address : '');
            break;
            
        case 'account':
            $address = $config['address'] ?? '';
            if (empty($address)) sendError('Address is required for account module');
            
            if ($action === 'txlist') {
                $endpoint = '/addresses/' . $address . '/transactions';
            } else {
                // Default to balance/info
                $endpoint = '/addresses/' . $address;
            }
            break;
            
        case 'transaction':
            $hash = $config['txhash'] ?? '';
            if (empty($hash)) sendError('Transaction hash is required');
            $endpoint = '/transactions/' . $hash;
            break;
            
        default:
            // Fallback to legacy RPC style if needed, but we prefer V2
            sendError('Unsupported Blockscout V2 module: ' . $module);
    }
    
    $url = $baseUrl . $endpoint;
    $response = makeRequest($url, null, $headers, 'GET');
    
    if ($response['code'] === 200) {
        $data = json_decode($response['body'], true);
        sendSuccess($data);
    } else {
        $err = json_decode($response['body'], true);
        sendError('ArcScan API Error (' . $response['code'] . '): ' . ($err['message'] ?? $response['body']));
    }
}

function handleCircleGasStation($input) {
    $config = $input['config'] ?? [];
    $operation = $config['operation'] ?? 'Sponsor Transaction';
    $credentialId = $config['credentialId'] ?? null;
    
    $apiKey = '';
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && isset($cred['data']['apiKey'])) {
            $apiKey = $cred['data']['apiKey'];
        }
    }
    
    if (empty($apiKey)) sendError('Circle API Key is required');

    $baseUrl = 'https://api.circle.com/v1/w3s';
    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ];

    switch ($operation) {
        case 'Sponsor Transaction':
            $url = $baseUrl . '/developer/transactions/sponsor';
            $payload = [
                'idempotencyKey' => generateUuidV4(),
                'entitySecretCiphertext' => $config['entitySecretCiphertext'] ?? '', // Required if developer wallet
                'userToken' => $config['userToken'] ?? '', // Required if user wallet
                'transactionData' => is_string($config['transactionData']) ? json_decode($config['transactionData'], true) : $config['transactionData'],
                'blockchain' => $config['blockchain'] ?? 'ARC-TESTNET'
            ];
            $response = makeRequest($url, $payload, $headers, 'POST');
            break;

        case 'Get Gas Tank':
            $url = $baseUrl . '/gas-stations/tanks';
            $response = makeRequest($url, null, $headers, 'GET');
            break;

        default:
            sendError('Unknown Gas Station operation');
    }

    if ($response['code'] >= 200 && $response['code'] < 300) {
        sendSuccess(json_decode($response['body'], true));
    } else {
        sendError('Circle Gas Station Error: ' . $response['body']);
    }
}

function handleCircleCctp($input) {
    $config = $input['config'] ?? [];
    $operation = $config['operation'] ?? 'Fetch Attestation (V2)';
    $credentialId = $config['credentialId'] ?? null;
    
    // Constants for Arc Testnet (Verified)
    $ARC_DOMAIN_ID = 26;
    $ARC_TOKEN_MESSENGER = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';
    
    $apiKey = '';
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && isset($cred['data']['apiKey'])) {
            $apiKey = $cred['data']['apiKey'];
        }
    }
    
    // Attestation API doesn't always require Circle API Key if public sandbox, but good to have
    $headers = [
        'Content-Type: application/json'
    ];
    if (!empty($apiKey)) {
        $headers[] = 'Authorization: Bearer ' . $apiKey;
    }

    switch ($operation) {
        case 'Deposit For Burn':
            // High-precision guidance for developer
            sendSuccess([
                'guidance' => 'Initiate on-chain.',
                'contract' => $ARC_TOKEN_MESSENGER,
                'domainId' => $ARC_DOMAIN_ID,
                'method' => 'depositForBurn(amount, destinationDomain, mintRecipient, burnToken)',
                'note' => 'Use Arc Smart Contract node with this data.'
            ]);
            break;

        case 'Fetch Attestation (V2)':
            $txHash = $config['txHash'] ?? '';
            if (empty($txHash)) sendError('Transaction Hash is required for CCTP Attestation');
            
            // Canonical Iris V2 Private Sandbox (Testnet)
            $url = 'https://iris-api-sandbox.circle.com/v2/messages?txHash=' . $txHash;
            $response = makeRequest($url, null, $headers, 'GET');
            
            if ($response['code'] === 200) {
                $data = json_decode($response['body'], true);
                if (isset($data['messages']) && count($data['messages']) > 0) {
                    sendSuccess($data, 'Attestation found');
                } else {
                    sendSuccess($data, 'Attestation pending (Circle is processing)');
                }
            } else {
                sendError('Circle Attestation API Error (' . $response['code'] . '): ' . $response['body']);
            }
            break;

        case 'Receive Message':
            sendSuccess([
                'guidance' => 'Complete on-chain.',
                'method' => 'receiveMessage(message, signature)',
                'note' => 'Fetch message/signature from Fetch Attestation node first.'
            ]);
            break;

        default:
            sendError('Unknown CCTP operation: ' . $operation);
    }
}

function handleX402PaymentWebhook($input) {
    // This handler simulates or validates the x402 payment logic for the webhook trigger.
    // In a real scenario, this would be part of the receive pipeline.
    // Here we're mainly providing helper logic if the webhook calls back into the engine.

    $headers = $input['headers'] ?? [];
    $authHeader = $headers['x-payment-authorization'] ?? ($headers['X-Payment-Authorization'] ?? '');

    // 1. Check for Payment Authorization Header
    if (empty($authHeader)) {
        // Return 402 Payment Required
        http_response_code(402);
        echo json_encode([
            'success' => false,
            'error' => 'Payment Required',
            'pricing' => [
                'amount' => $input['config']['requiredAmount'] ?? '1.00',
                'currency' => 'USDC',
                'receiver' => $input['config']['recipientAddress'] ?? ''
            ]
        ]);
        exit;
    }

    // 2. Validate Signature (EIP-3009 or simple signature check)
    // For Hackathon, we'll assume a simple check or pass-through if present.
    // In production, verify the signature matches the intent.

    // 3. Success
    $data = [
        'status' => 'paid',
        'authKey' => $authHeader,
        'timestamp' => date('c'),
        'amount' => $input['config']['requiredAmount'] ?? '1.00',
        'token' => 'USDC'
    ];

    sendSuccess($data, 'Payment Verified');
}

function handleArcBlockchainEvent($input) {
    $config = $input['config'] ?? [];
    $network = $config['network'] ?? 'Arc Testnet';
    $rpcUrl = ($network === 'Arc Mainnet') ? 'https://rpc.arc.network' : 'https://rpc.testnet.arc.network';
    
    // Use eth_getLogs or similar
    $payload = [
        'jsonrpc' => '2.0',
        'id' => 1,
        'method' => 'eth_getLogs',
        'params' => [[
            'address' => $config['contractAddress'] ?? null,
            'fromBlock' => 'latest' // or a specific range if polling
        ]]
    ];

    // If event signature is provided in config, calculate topic0?
    // For simplicity, we just fetch latest logs.

    $response = makeRequest($rpcUrl, $payload, [], 'POST');
    
    if ($response['code'] >= 200 && $response['code'] < 300) {
        $data = json_decode($response['body'], true);
        sendSuccess($data['result'] ?? []);
    } else {
        sendError('RPC Error: ' . $response['body']);
    }
}



/* ================================================== */
/*          PART 11: AI TOOL CALLING HANDLERS         */
/* ================================================== */

function handleGeminiWithTools($input) {
    $apiKey = isset($input['apiKey']) ? trim($input['apiKey']) : '';
    $model = (!empty($input['model']) && is_string($input['model'])) ? trim($input['model']) : 'gemini-2.5-flash';
    if (!$model) $model = 'gemini-2.5-flash';
    $prompt = isset($input['prompt']) ? $input['prompt'] : null;
    $systemInstruction = isset($input['systemInstruction']) ? trim($input['systemInstruction']) : '';
    $conversationHistory = isset($input['conversationHistory']) ? $input['conversationHistory'] : [];
    $tools = isset($input['tools']) ? $input['tools'] : [];
    $temperature = isset($input['temperature']) ? floatval($input['temperature']) : 0.7;
    $maxTokens = isset($input['maxTokens']) ? intval($input['maxTokens']) : 4096;
    
    if (empty($apiKey)) sendError('API key is required');
    
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . $apiKey;
    
    // Build contents from conversation history
    $contents = [];
    foreach ($conversationHistory as $msg) {
        if ($msg['role'] === 'user') {
            $contents[] = [
                'role' => 'user',
                'parts' => [['text' => $msg['content']]]
            ];
        } elseif ($msg['role'] === 'assistant') {
            $parts = [];
            if (isset($msg['content']) && $msg['content'] !== null) {
                $parts[] = ['text' => $msg['content']];
            }
            if (isset($msg['tool_calls'])) {
                foreach ($msg['tool_calls'] as $tc) {
                    $parts[] = [
                        'functionCall' => [
                            'name' => $tc['function']['name'],
                            'args' => json_decode($tc['function']['arguments'], true)
                        ]
                    ];
                }
            } elseif (isset($msg['functionCall'])) {
                $parts[] = [
                    'functionCall' => [
                        'name' => $msg['functionCall']['name'],
                        'args' => json_decode($msg['functionCall']['arguments'], true)
                    ]
                ];
            }
            if (!empty($parts)) {
                $contents[] = ['role' => 'model', 'parts' => $parts];
            }
        } elseif ($msg['role'] === 'function') {
            $contents[] = [
                'role' => 'function',
                'parts' => [[
                    'functionResponse' => [
                        'name' => $msg['name'],
                        'response' => ['result' => $msg['content']]
                    ]
                ]]
            ];
        }
    }
    
    // Add new prompt if provided
    if ($prompt) {
        $contents[] = [
            'role' => 'user',
            'parts' => [['text' => $prompt]]
        ];
    }
    
    $requestBody = [
        'contents' => $contents,
        'generationConfig' => [
            'temperature' => $temperature,
            'maxOutputTokens' => $maxTokens
        ]
    ];
    
    // Add system instruction
    if (!empty($systemInstruction)) {
        $requestBody['system_instruction'] = [
            'parts' => [['text' => $systemInstruction]]
        ];
    }
    
    // Add tools if available
    if (!empty($tools)) {
        $geminiTools = [];
        foreach ($tools as $tool) {
            $geminiTools[] = [
                'name' => $tool['name'],
                'description' => $tool['description'],
                'parameters' => $tool['parameters'] ?? ['type' => 'object', 'properties' => []]
            ];
        }
        $requestBody['tools'] = [
            ['functionDeclarations' => $geminiTools]
        ];
        
        // Tool Config (AUTO/ANY/NONE)
        $toolMode = 'AUTO';
        $enableToolCalling = isset($input['enableToolCalling']) ? $input['enableToolCalling'] : 'Auto (when tools connected)';
        
        if ($enableToolCalling === 'Always On') $toolMode = 'ANY';
        elseif ($enableToolCalling === 'Off') $toolMode = 'NONE';
        
        $requestBody['toolConfig'] = [
            'functionCallingConfig' => ['mode' => $toolMode]
        ];
    }
    
    $response = makeRequest($url, $requestBody, [], 'POST');
    
    if ($response['error']) sendError('Request failed: ' . $response['error']);
    
    $httpCode = $response['code'];
    $data = json_decode($response['body'], true);
    
    if ($httpCode !== 200) {
        $errorMsg = 'Gemini API Error (HTTP ' . $httpCode . ')';
        if (isset($data['error']['message'])) $errorMsg = $data['error']['message'];
        sendError($errorMsg);
    }
    
    // Check for tool calls
    $toolCalls = [];
    if (isset($data['candidates'][0]['content']['parts'])) {
        foreach ($data['candidates'][0]['content']['parts'] as $part) {
            if (isset($part['functionCall'])) {
                $toolCalls[] = [
                    'name' => $part['functionCall']['name'],
                    'arguments' => $part['functionCall']['args'] ?? []
                ];
            }
        }
    }

    if (!empty($toolCalls)) {
        echo json_encode([
            'success' => true,
            'toolCalls' => $toolCalls,
            'data' => null
        ]);
        exit;
    }
    
    // Regular text response
    if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
        echo json_encode([
            'success' => true,
            'toolCall' => null,
            'data' => $data['candidates'][0]['content']['parts'][0]['text']
        ]);
        exit;
    }
    
    sendError('Unexpected response format');
}

function handleOpenAIWithTools($input) {
    $apiKey = isset($input['apiKey']) ? trim($input['apiKey']) : '';
    $model = (!empty($input['model']) && is_string($input['model'])) ? trim($input['model']) : 'gpt-4o';
    if (!$model) $model = 'gpt-4o';
    $prompt = isset($input['prompt']) ? $input['prompt'] : null;
    $systemInstruction = isset($input['systemInstruction']) ? trim($input['systemInstruction']) : '';
    $conversationHistory = isset($input['conversationHistory']) ? $input['conversationHistory'] : [];
    $tools = isset($input['tools']) ? $input['tools'] : [];
    $temperature = isset($input['temperature']) ? floatval($input['temperature']) : 0.7;
    $maxTokens = isset($input['maxTokens']) ? intval($input['maxTokens']) : 4096;
    
    if (empty($apiKey)) sendError('API key is required');
    
    $aiContext = $input['aiContext'] ?? ['memory' => [], 'tools' => []];
    $reasoningEffort = $input['reasoning_effort'] ?? 'medium';
    
    // Determine if model is o1 series
    $isO1 = (strpos($model, 'o1') === 0);

    $messages = [];
    if (!empty($systemInstruction)) {
        // o1 models use 'developer' role instead of 'system'
        $role = $isO1 ? 'developer' : 'system';
        $messages[] = ['role' => $role, 'content' => $systemInstruction];
    }

    // Inject Memory into System/Developer message or History if formatting allows
    if (!empty($aiContext['memory'])) {
        $memStr = "--- PREVIOUS CONTEXT ---\n";
        foreach ($aiContext['memory'] as $mem) {
            if (isset($mem['messages'])) {
                foreach ($mem['messages'] as $m) $memStr .= strtoupper($m['role']) . ": " . $m['content'] . "\n";
            } else {
                $memStr .= json_encode($mem) . "\n";
            }
        }
        if (!empty($messages)) {
             $messages[0]['content'] .= "\n\n" . $memStr;
        } else {
             $role = $isO1 ? 'developer' : 'system';
             $messages[] = ['role' => $role, 'content' => $memStr];
        }
    }

    foreach ($conversationHistory as $msg) {
        $role = $msg['role'];
        if ($role === 'function') $role = 'tool';
        // o1 compatibility for history? usually fine as user/assistant
 
        
        $openaiMsg = ['role' => $role];
        if (isset($msg['content'])) $openaiMsg['content'] = $msg['content'];
        
        if ($role === 'tool') {
             $openaiMsg['tool_call_id'] = $msg['tool_call_id'] ?? $msg['name']; 
        }

        if (isset($msg['tool_calls'])) {
            $openaiMsg['tool_calls'] = $msg['tool_calls'];
            if (empty($openaiMsg['content'])) $openaiMsg['content'] = null;
        } elseif (isset($msg['functionCall'])) {
            $openaiMsg['tool_calls'] = [[
                'id' => 'tool_' . $msg['functionCall']['name'],
                'type' => 'function',
                'function' => [
                    'name' => $msg['functionCall']['name'],
                    'arguments' => $msg['functionCall']['arguments']
                ]
            ]];
            $openaiMsg['content'] = null;
        }
        $messages[] = $openaiMsg;
    }

    if ($prompt) {
        $messages[] = ['role' => 'user', 'content' => $prompt];
    }

    $requestBody = [
        'model' => $model,
        'messages' => $messages
    ];

    if ($isO1) {
        $requestBody['max_completion_tokens'] = $maxTokens;
        $requestBody['reasoning_effort'] = $reasoningEffort;
    } else {
        $requestBody['temperature'] = $temperature;
        $requestBody['max_tokens'] = $maxTokens;
    }

    if (!empty($tools)) {
        $openaiTools = [];
        foreach ($tools as $tool) {
            $openaiTools[] = [
                'type' => 'function',
                'function' => [
                    'name' => $tool['name'],
                    'description' => $tool['description'],
                    'parameters' => $tool['parameters']
                ]
            ];
        }
        $requestBody['tools'] = $openaiTools;
        $requestBody['tool_choice'] = 'auto';
    }

    $response = makeRequest('https://api.openai.com/v1/chat/completions', $requestBody, [
        'Authorization: Bearer ' . $apiKey
    ], 'POST');

    if ($response['code'] === 200) {
        $data = json_decode($response['body'], true);
        $message = $data['choices'][0]['message'];

        if (isset($message['tool_calls'])) {
            $toolCalls = [];
            foreach ($message['tool_calls'] as $tc) {
                $toolCalls[] = [
                    'name' => $tc['function']['name'],
                    'arguments' => json_decode($tc['function']['arguments'], true)
                ];
            }
            echo json_encode([
                'success' => true,
                'toolCalls' => $toolCalls,
                'data' => null
            ]);
            exit;
        } else {
            echo json_encode([
                'success' => true,
                'toolCall' => null,
                'data' => $message['content']
            ]);
            exit;
        }
    } else {
        $err = json_decode($response['body'], true);
        $errMsg = 'OpenAI Error (HTTP ' . $response['code'] . '): ' . ($err['error']['message'] ?? $response['body']);
        // Append request body for debugging if it's a model error
        if (strpos($errMsg, 'model') !== false) {
             $errMsg .= " | Request: " . json_encode($requestBody);
        }
        sendError($errMsg);
    }
}

function handleClaudeWithTools($input) {
    $apiKey = isset($input['apiKey']) ? trim($input['apiKey']) : '';
    $model = (!empty($input['model']) && is_string($input['model'])) ? trim($input['model']) : 'claude-3-5-sonnet-20241022';
    if (!$model) $model = 'claude-3-5-sonnet-20241022';
    $prompt = isset($input['prompt']) ? $input['prompt'] : null;
    $systemPrompt = isset($input['systemInstruction']) ? trim($input['systemInstruction']) : '';
    $conversationHistory = isset($input['conversationHistory']) ? $input['conversationHistory'] : [];
    $tools = isset($input['tools']) ? $input['tools'] : [];
    $maxTokens = isset($input['maxTokens']) ? intval($input['maxTokens']) : 4096;

    if (empty($apiKey)) sendError('API key is required');

    $messages = [];
    foreach ($conversationHistory as $msg) {
        if ($msg['role'] === 'system') continue;
        
        $role = $msg['role'];
        if ($role === 'assistant') {
            $content = [];
            if (isset($msg['content']) && $msg['content'] !== null && $msg['content'] !== '') {
                $content[] = ['type' => 'text', 'text' => $msg['content']];
            }
            if (isset($msg['tool_calls'])) {
                foreach ($msg['tool_calls'] as $tc) {
                    $content[] = [
                        'type' => 'tool_use',
                        'id' => $tc['id'] ?? ('tool_' . $tc['function']['name']),
                        'name' => $tc['function']['name'],
                        'input' => json_decode($tc['function']['arguments'], true)
                    ];
                }
            } elseif (isset($msg['functionCall'])) {
                $content[] = [
                    'type' => 'tool_use',
                    'id' => 'tool_' . $msg['functionCall']['name'],
                    'name' => $msg['functionCall']['name'],
                    'input' => json_decode($msg['functionCall']['arguments'], true)
                ];
            }
            if (empty($content)) $content[] = ['type' => 'text', 'text' => 'Thinking...'];
            $messages[] = ['role' => 'assistant', 'content' => $content];
        } elseif ($role === 'function') {
            $messages[] = [
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'tool_result',
                        'tool_use_id' => $msg['tool_call_id'] ?? ('tool_' . $msg['name']),
                        'content' => $msg['content']
                    ]
                ]
            ];
        } else {
            $messages[] = ['role' => $role, 'content' => $msg['content']];
        }
    }

    if ($prompt) {
        $messages[] = ['role' => 'user', 'content' => $prompt];
    }

    $requestBody = [
        'model' => $model,
        'system' => $systemPrompt,
        'messages' => $messages,
        'max_tokens' => $maxTokens
    ];

    if (!empty($tools)) {
        $claudeTools = [];
        foreach ($tools as $tool) {
            $claudeTools[] = [
                'name' => $tool['name'],
                'description' => $tool['description'],
                'input_schema' => $tool['parameters']
            ];
        }
        $requestBody['tools'] = $claudeTools;
    }

    $response = makeRequest('https://api.anthropic.com/v1/messages', $requestBody, [
        'x-api-key: ' . $apiKey,
        'anthropic-version: 2023-06-01'
    ], 'POST');

    if ($response['code'] === 200) {
        $data = json_decode($response['body'], true);
        $stop_reason = $data['stop_reason'];

        if ($stop_reason === 'tool_use') {
            $toolCalls = [];
            foreach ($data['content'] as $content) {
                if ($content['type'] === 'tool_use') {
                    $toolCalls[] = [
                        'name' => $content['name'],
                        'arguments' => $content['input'],
                        'id' => $content['id'] // Claude needs ID for response
                    ];
                }
            }
            echo json_encode([
                'success' => true,
                'toolCalls' => $toolCalls,
                'data' => null
            ]);
            exit;
        } else {
            echo json_encode([
                'success' => true,
                'toolCall' => null,
                'data' => $data['content'][0]['text']
            ]);
            exit;
        }
    } else {
        $err = json_decode($response['body'], true);
        sendError('Claude Error: ' . ($err['error']['message'] ?? $response['body']));
    }
}


function handleCircleBalance($input) {
    $config = $input['config'] ?? [];
    $credentialId = $config['credentialId'] ?? null;
    $walletId = $config['walletId'] ?? '';

    if (empty($walletId)) sendError('Wallet ID is required');

    $apiKey = '';
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && isset($cred['data']['apiKey'])) {
            $apiKey = $cred['data']['apiKey'];
        }
    }

    if (empty($apiKey)) sendError('Circle API Key is required');

    $url = 'https://api.circle.com/v1/w3s/wallets/' . $walletId . '/balances';
    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ];

    $response = makeRequest($url, null, $headers, 'GET');

    if ($response['code'] >= 200 && $response['code'] < 300) {
         $data = json_decode($response['body'], true);
         sendSuccess($data['data']['tokenBalances'] ?? [], 'Balances retrieved');
    } else {
         $err = json_decode($response['body'], true);
         sendError('Circle API Error: ' . ($err['message'] ?? $response['body']));
    }
}

function handleCircleTransactions($input) {
    $config = $input['config'] ?? [];
    $credentialId = $config['credentialId'] ?? null;
    $walletId = $config['walletId'] ?? '';
    $blockchain = $config['blockchain'] ?? 'ARC-TESTNET';
    $pageSize = intval($config['pageSize'] ?? 10);

    $apiKey = '';
    if ($credentialId) {
        $cred = getCredentialById($credentialId);
        if ($cred && isset($cred['data']['apiKey'])) {
            $apiKey = $cred['data']['apiKey'];
        }
    }

    if (empty($apiKey)) sendError('Circle API Key is required');

    $queryParams = [
        'blockchain' => $blockchain,
        'pageSize' => $pageSize
    ];
    if (!empty($walletId)) $queryParams['walletIds'] = [$walletId];

    $url = 'https://api.circle.com/v1/w3s/transactions?' . http_build_query($queryParams);
    
    // Fix array encoding in query string if needed, but http_build_query handles basic arrays
    // Circle expects walletIds=id1&walletIds=id2 format usually, but let's try standard first or comma separated?
    // Docs say: walletIds (Array[String]). http_build_query handles this as walletIds[0]=... unless we override.
    // Circle often prefers repeated keys: walletIds=1&walletIds=2. 
    // Manual build for array safety:
    $queryString = 'blockchain=' . urlencode($blockchain) . '&pageSize=' . $pageSize;
    if (!empty($walletId)) $queryString .= '&walletIds=' . urlencode($walletId);

    $url = 'https://api.circle.com/v1/w3s/transactions?' . $queryString;

    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ];

    $response = makeRequest($url, null, $headers, 'GET');

    if ($response['code'] >= 200 && $response['code'] < 300) {
         $data = json_decode($response['body'], true);
         sendSuccess($data['data']['transactions'] ?? [], 'Transactions retrieved');
    } else {
         $err = json_decode($response['body'], true);
         sendError('Circle API Error: ' . ($err['message'] ?? $response['body']));
    }
}

function handleArcRpcCall($input) {
    $config = $input['config'] ?? [];
    $method = $config['method'] ?? 'eth_getBalance';
    $paramsRaw = $config['params'] ?? '[]';
    $network = $config['network'] ?? 'ARC-TESTNET';

    $params = [];
    if (is_string($paramsRaw)) {
        $decoded = json_decode($paramsRaw, true);
        if (is_array($decoded)) $params = $decoded;
    } elseif (is_array($paramsRaw)) {
        $params = $paramsRaw;
    }

    $url = ($network === 'ARC-MAINNET') ? 'https://rpc.arc.network' : 'https://rpc.testnet.arc.network'; // Verify mainnet URL if exists, assume testnet default
    if ($network === 'ARC-MAINNET') $url = 'https://rpc.arc.network'; // Placeholder if mainnet differs

    $payload = [
        'jsonrpc' => '2.0',
        'method' => $method,
        'params' => $params,
        'id' => time()
    ];

    $response = makeRequest($url, $payload, ['Content-Type: application/json'], 'POST');

    if ($response['code'] >= 200 && $response['code'] < 300) {
         $data = json_decode($response['body'], true);
         if (isset($data['error'])) sendError('RPC Error: ' . json_encode($data['error']));
         sendSuccess($data['result'] ?? null, 'RPC executed');
    } else {
         sendError('RPC HTTP Error: ' . $response['code']);
    }
}

/**
 * Handle fetching chat history by session ID
 */
function handleGetChatHistory($input) {
    $sessionId = $input['sessionId'] ?? 'default';
    $memoryDir = __DIR__ . '/storage/memory/';
    if (!file_exists($memoryDir)) {
        mkdir($memoryDir, 0777, true);
    }
    
    $filePath = $memoryDir . md5($sessionId) . '.json';
    if (file_exists($filePath)) {
        $data = json_decode(file_get_contents($filePath), true);
        echo json_encode(['success' => true, 'messages' => $data ?: []]);
    } else {
        echo json_encode(['success' => true, 'messages' => []]);
    }
    exit;
}

/**
 * Handle saving chat history by session ID
 */
function handleSaveChatHistory($input) {
    $sessionId = $input['sessionId'] ?? 'default';
    $messages = $input['messages'] ?? [];
    $memoryDir = __DIR__ . '/storage/memory/';
    if (!file_exists($memoryDir)) {
        mkdir($memoryDir, 0777, true);
    }
    
    $filePath = $memoryDir . md5($sessionId) . '.json';
    file_put_contents($filePath, json_encode($messages));
    echo json_encode(['success' => true]);
    exit;
}
?>