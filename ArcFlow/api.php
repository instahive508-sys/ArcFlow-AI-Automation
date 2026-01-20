<?php
// api.php - API Endpoint for ArcFlow Unified Storage
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Storage Path - Unified storage.json
$storage_file = __DIR__ . '/storage.json';

// Helper: Get All Data
function getAllData() {
    global $storage_file;
    if (!file_exists($storage_file)) {
        return ['workflows' => [], 'credentials' => [], 'executions' => []];
    }
    $content = file_get_contents($storage_file);
    return json_decode($content, true) ?: ['workflows' => [], 'credentials' => [], 'executions' => []];
}

// Helper: Save All Data
function saveAllData($data) {
    global $storage_file;
    file_put_contents($storage_file, json_encode($data, JSON_PRETTY_PRINT));
}

// Parse Input
$inputData = file_get_contents('php://input');
if (!$inputData && php_sapi_name() === 'cli') {
    $inputData = file_get_contents('php://stdin');
}
$input = json_decode($inputData, true);
$action = $input['action'] ?? ($_GET['action'] ?? '');

$dataStore = getAllData();

switch ($action) {
    // --- WORKFLOW ACTIONS ---
    case 'get_workflows':
        echo json_encode(['success' => true, 'data' => $dataStore['workflows']]);
        break;

    case 'get_workflow':
        $id = $input['id'] ?? ($_GET['id'] ?? '');
        $found = null;
        foreach ($dataStore['workflows'] as $w) {
            if ($w['id'] === $id) {
                $found = $w;
                break;
            }
        }
        if ($found) {
            echo json_encode(['success' => true, 'data' => $found]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Workflow not found']);
        }
        break;

    case 'create_workflow':
        $newWorkflow = $input['data'] ?? [];
        if (empty($newWorkflow['id'])) $newWorkflow['id'] = uniqid('arc_');
        $dataStore['workflows'][] = $newWorkflow;
        saveAllData($dataStore);
        echo json_encode(['success' => true, 'message' => 'Workflow created', 'id' => $newWorkflow['id']]);
        break;

    case 'update_workflow':
        $updateData = $input['data'] ?? [];
        $id = $updateData['id'] ?? '';
        $found = false;
        foreach ($dataStore['workflows'] as &$w) {
            if ($w['id'] === $id) {
                $w = array_merge($w, $updateData);
                $found = true;
                break;
            }
        }
        if ($found) {
            saveAllData($dataStore);
            echo json_encode(['success' => true, 'message' => 'Workflow updated']);
        } else {
            // If not found, create it (compatibility)
            $dataStore['workflows'][] = $updateData;
            saveAllData($dataStore);
            echo json_encode(['success' => true, 'message' => 'Workflow created (upsert)']);
        }
        break;

    case 'delete_workflow':
        $id = $input['id'] ?? '';
        $dataStore['workflows'] = array_values(array_filter($dataStore['workflows'], function($w) use ($id) {
            return $w['id'] !== $id;
        }));
        saveAllData($dataStore);
        echo json_encode(['success' => true, 'message' => 'Workflow deleted']);
        break;

    // --- CREDENTIAL ACTIONS ---
    case 'get_credentials':
        echo json_encode(['success' => true, 'data' => $dataStore['credentials']]);
        break;

    case 'get_credential':
        $id = $input['id'] ?? ($_GET['id'] ?? '');
        $found = null;
        foreach ($dataStore['credentials'] as $c) {
            if ($c['id'] === $id) {
                $found = $c;
                break;
            }
        }
        if ($found) {
            echo json_encode(['success' => true, 'data' => $found]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Credential not found']);
        }
        break;

    case 'create_credential':
        $newCred = $input['data'] ?? [];
        if (empty($newCred['id'])) $newCred['id'] = uniqid('cred_');
        $dataStore['credentials'][] = $newCred;
        saveAllData($dataStore);
        echo json_encode(['success' => true, 'message' => 'Credential created', 'id' => $newCred['id']]);
        break;

    case 'update_credential':
    case 'save_credential':
        // Primary keys
        $id = $input['id'] ?? ($input['data']['id'] ?? '');
        $name = $input['name'] ?? ($input['data']['name'] ?? 'Untitled Credential');
        $type = $input['type'] ?? ($input['data']['type'] ?? '');
        $payload = $input['data'] ?? [];

        // Determine if it's a "modern" call (payload is the data) or "legacy" (payload has a 'data' sub-key)
        $actualData = $payload;
        if (isset($payload['data']) && is_array($payload['data'])) {
            $actualData = $payload['data'];
        }
        
        // Clean payload from metadata for storage in 'data'
        $dataToStore = $actualData;
        unset($dataToStore['id'], $dataToStore['name'], $dataToStore['type']);

        $found = false;
        foreach ($dataStore['credentials'] as &$c) {
            if ($c['id'] === $id) {
                $c['name'] = $name;
                if ($type) $c['type'] = $type;
                
                // Always update the 'data' object (modern source of truth)
                $c['data'] = array_merge($c['data'] ?? [], $dataToStore);
                
                // Mirror legacy fields to top level if they exist in the payload
                if (isset($actualData['apiKey'])) $c['apiKey'] = $actualData['apiKey'];
                if (isset($actualData['description'])) $c['description'] = $actualData['description'];
                
                $c['updated'] = date('c');
                $found = true;
                break;
            }
        }
        
        if (!$found) {
            $newC = [
                'id' => $id ?: uniqid('cred_'),
                'name' => $name,
                'type' => $type,
                'data' => $dataToStore,
                'updated' => date('c')
            ];
            // Mirror legacy fields
            if (isset($actualData['apiKey'])) $newC['apiKey'] = $actualData['apiKey'];
            if (isset($actualData['description'])) $newC['description'] = $actualData['description'];
            
            $dataStore['credentials'][] = $newC;
            $id = $newC['id'];
        }
        
        saveAllData($dataStore);
        echo json_encode(['success' => true, 'message' => 'Credential saved', 'id' => $id]);
        break;

    case 'delete_credential':
        $id = $input['id'] ?? '';
        $dataStore['credentials'] = array_values(array_filter($dataStore['credentials'], function($c) use ($id) {
            return $c['id'] !== $id;
        }));
        saveAllData($dataStore);
        echo json_encode(['success' => true, 'message' => 'Credential deleted']);
        break;

    case 'refresh_google_token':
        $credId = $input['credentialId'] ?? '';
        $result = refreshGoogleAccessToken($credId, $dataStore);
        if ($result['success']) {
            saveAllData($dataStore);
        }
        echo json_encode($result);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Invalid action: ' . $action]);
        break;
}

/**
 * Refresh Google OAuth2 access token using refresh_token
 */
function refreshGoogleAccessToken($credentialId, &$dataStore) {
    if (empty($credentialId)) {
        return ['success' => false, 'message' => 'Credential ID required'];
    }
    
    // Find credential
    $credIndex = -1;
    foreach ($dataStore['credentials'] as $i => $c) {
        if ($c['id'] === $credentialId) {
            $credIndex = $i;
            break;
        }
    }
    
    if ($credIndex === -1) {
        return ['success' => false, 'message' => 'Credential not found'];
    }
    
    $cred = $dataStore['credentials'][$credIndex];
    $data = $cred['data'] ?? [];
    
    $clientId = $data['clientId'] ?? '';
    $clientSecret = $data['clientSecret'] ?? '';
    $refreshToken = $data['refreshToken'] ?? '';
    
    if (empty($refreshToken)) {
        return ['success' => false, 'message' => 'No refresh token available'];
    }
    
    // Call Google token endpoint
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'refresh_token' => $refreshToken,
            'grant_type' => 'refresh_token'
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $result = json_decode($response, true);
    
    if ($httpCode === 200 && isset($result['access_token'])) {
        // Update credential with new access token
        $dataStore['credentials'][$credIndex]['data']['accessToken'] = $result['access_token'];
        if (isset($result['expires_in'])) {
            $dataStore['credentials'][$credIndex]['data']['expiresAt'] = time() + $result['expires_in'];
        }
        return [
            'success' => true, 
            'accessToken' => $result['access_token'],
            'expiresIn' => $result['expires_in'] ?? 3600
        ];
    }
    
    return [
        'success' => false, 
        'message' => $result['error_description'] ?? 'Token refresh failed'
    ];
}
?>