<?php
// router.php - Handles routing for ArcFlow including webhook requests

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve static files if they exist
if (file_exists(__DIR__ . $uri) && !is_dir(__DIR__ . $uri)) {
    // Check if it's a PHP file, if so let it execute
    if (pathinfo($uri, PATHINFO_EXTENSION) === 'php') {
        return false;
    }
    return false; // Serve file as-is
}

// Route webhook requests
if (preg_match('#^/webhook/(.+)$#', $uri, $matches) || preg_match('#^/webhook-test/(.+)$#', $uri, $matches)) {
    // This is a webhook request
    $webhookPath = $matches[1];
    $isTest = strpos($uri, '/webhook-test/') === 0;
    
    // Read raw body BEFORE including nodes1.php
    $rawBody = file_get_contents('php://input');
    $bodyData = json_decode($rawBody, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $bodyData = $rawBody; // Keep as string if not valid JSON
    }
    
    // Set headers for JSON response + Production Security
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    
    // Handle OPTIONS preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
    
    // Build webhook trigger data (to be used for workflow execution)
    $webhookTriggerData = [
        'id' => uniqid('wh_'),
        'path' => $webhookPath,
        'method' => $_SERVER['REQUEST_METHOD'],
        'headers' => getallheaders(),
        'query' => $_GET,
        'body' => $bodyData,
        'timestamp' => date('c'),
        'isTest' => $isTest,
        'executed' => false
    ];
    
    // Save to storage for frontend polling (this triggers execution on frontend)
    $storageDir = __DIR__ . '/storage/files/';
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }
    
    // Save webhook trigger for frontend to pick up and execute
    $triggerFile = $storageDir . 'webhook_trigger_' . $webhookPath . '.json';
    file_put_contents($triggerFile, json_encode($webhookTriggerData, JSON_PRETTY_PRINT), LOCK_EX);
    
    // Also append to a queue file for multiple triggers (Atomic Operations)
    $queueFile = $storageDir . 'webhook_queue.json';
    $fp = fopen($queueFile, 'c+');
    if ($fp) {
        if (flock($fp, LOCK_EX)) {
            $content = stream_get_contents($fp);
            $queue = json_decode($content, true) ?: [];
            $queue[] = $webhookTriggerData;
            
            // Keep only last 50 triggers
            if (count($queue) > 50) {
                $queue = array_slice($queue, -50);
            }
            
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }
    
    // Wait for response file if needed (Parity with n8n "Respond to Webhook" node)
    $triggerId = $webhookTriggerData['id'];
    $responseFile = $storageDir . 'webhook_response_' . $triggerId . '.json';
    $maxWait = 10; // 10 seconds timeout
    $startTime = time();
    $customResponse = null;

    while (time() - $startTime < $maxWait) {
        if (file_exists($responseFile)) {
            $customResponse = json_decode(file_get_contents($responseFile), true);
            unlink($responseFile); // Clean up
            break;
        }
        usleep(100000); // 100ms
    }

    if ($customResponse) {
        $statusCode = $customResponse['statusCode'] ?? 200;
        $body = $customResponse['body'] ?? '';
        $respHeaders = $customResponse['headers'] ?? [];

        http_response_code($statusCode);
        foreach ($respHeaders as $name => $value) {
            header("$name: $value");
        }
        
        if (is_array($body) || is_object($body)) {
            echo json_encode($body);
        } else {
            // Check if it's already JSON string
            if (json_decode($body) !== null) {
                header('Content-Type: application/json');
            }
            echo $body;
        }
    } else {
        // Output standard JSON response
        $webhookResponse = [
            'success' => true,
            'message' => 'Webhook received and queued for execution',
            'data' => [
                'triggerId' => $webhookTriggerData['id'],
                'path' => $webhookPath,
                'method' => $_SERVER['REQUEST_METHOD'],
                'body' => $bodyData,
                'timestamp' => $webhookTriggerData['timestamp'],
                'queuedForExecution' => true
            ]
        ];
        header('Content-Type: application/json');
        echo json_encode($webhookResponse);
    }
    exit;
}

// API endpoint to check for pending webhook triggers (called by frontend)
if ($uri === '/api/webhook-triggers' || $uri === '/webhook-triggers') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    
    $storageDir = __DIR__ . '/storage/files/';
    $queueFile = $storageDir . 'webhook_queue.json';
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Return pending triggers
        $queue = [];
        if (file_exists($queueFile)) {
            $queue = json_decode(file_get_contents($queueFile), true) ?: [];
        }
        echo json_encode(['success' => true, 'triggers' => $queue]);
        exit;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        // Clear the queue (after execution)
        file_put_contents($queueFile, '[]');
        echo json_encode(['success' => true, 'message' => 'Queue cleared']);
        exit;
    }
    
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Handle /api/* routes by forwarding to api.php
if (strpos($uri, '/api') === 0) {
    include __DIR__ . '/api.php';
    exit;
}

// Default: Serve index.html for SPA routing or landwork.html for editor
if ($uri === '/' || $uri === '/index.html') {
    include 'index.html';
    exit;
}

// Check for HTML files
if (file_exists(__DIR__ . $uri . '.html')) {
    include __DIR__ . $uri . '.html';
    exit;
}

// Default fallback
include 'index.html';
?>
