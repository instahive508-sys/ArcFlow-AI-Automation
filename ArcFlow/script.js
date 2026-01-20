/* ================================================== */
/*             ARCFLOW MAIN SCRIPT                    */
/* ================================================== */

/* ================================================== */
/* UTILITY FUNCTIONS                                  */
/* ================================================== */

function generateId() {
    return 'arc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getUrlParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function showNotification(message, isError) {
    var notification = document.getElementById('notification');
    var icon = document.getElementById('notificationIcon');
    var msg = document.getElementById('notificationMessage');

    if (!notification) return;

    msg.textContent = message;

    if (isError) {
        notification.classList.add('error');
        icon.textContent = '✗';
    } else {
        notification.classList.remove('error');
        icon.textContent = '✓';
    }

    notification.classList.add('active');

    // Auto-hide after 3 seconds
    setTimeout(function () {
        notification.classList.remove('active');
    }, 3000);
}

/* ================================================== */
/* HAMBURGER MENU                                     */
/* ================================================== */

function initHamburger() {
    var hamburger = document.getElementById('hamburger');
    var mobileMenu = document.getElementById('mobileMenu');

    if (!hamburger || !mobileMenu) return;

    hamburger.addEventListener('click', function () {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    var links = mobileMenu.querySelectorAll('.mobile-link');
    for (var i = 0; i < links.length; i++) {
        links[i].addEventListener('click', function () {
            hamburger.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
}

/* ================================================== */
/* API FUNCTIONS                                      */
/* ================================================== */

function apiCall(action, data, callback) {
    var body = { action: action };

    if (data) {
        for (var key in data) {
            body[key] = data[key];
        }
    }

    return fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (result) {
            if (callback) callback(result);
            return result;
        })
        .catch(function (error) {
            console.error('API Error:', error);
            var errRes = { success: false, message: error.message };
            if (callback) callback(errRes);
            return errRes;
        });
}

/* ================================================== */
/* WORKFLOW FUNCTIONS                                 */
/* ================================================== */

function createWorkflow() {
    var workflow = {
        id: generateId(),
        name: 'Untitled Workflow',
        status: 'draft',
        nodes: [],
        connections: []
    };

    apiCall('create_workflow', { data: workflow }, function (result) {
        if (result.success) {
            window.location.href = 'landwork.html?id=' + workflow.id;
        } else {
            showNotification('Failed to create workflow', true);
        }
    });
}

function loadWorkflows() {
    var container = document.getElementById('workflowsContainer');
    var emptyState = document.getElementById('emptyState');

    if (!container) return;

    apiCall('get_workflows', null, function (result) {
        if (result.success && result.data && result.data.length > 0) {
            emptyState.style.display = 'none';
            container.innerHTML = '';

            for (var i = 0; i < result.data.length; i++) {
                var workflow = result.data[i];
                var bar = document.createElement('div');
                bar.className = 'item-bar';
                bar.setAttribute('data-id', workflow.id);

                bar.innerHTML =
                    '<div class="item-icon">⚡</div>' +
                    '<div class="item-info">' +
                    '<div class="item-name">' + workflow.name + '</div>' +
                    '<div class="item-id">' + workflow.id + '</div>' +
                    '</div>' +
                    '<span class="item-status status-' + workflow.status + '">' + workflow.status + '</span>' +
                    '<span class="item-arrow">→</span>';

                (function (id) {
                    bar.addEventListener('click', function () {
                        window.location.href = 'landwork.html?id=' + id;
                    });
                })(workflow.id);

                container.appendChild(bar);
            }
        } else {
            emptyState.style.display = 'block';
            container.innerHTML = '';
        }
    });
}

function loadWorkflowEditor() {
    var workflowId = getUrlParam('id');
    if (!workflowId) return;

    var idDisplay = document.getElementById('workflowId');
    if (idDisplay) {
        idDisplay.textContent = 'ID: ' + workflowId;
    }

    apiCall('get_workflow', { id: workflowId }, function (result) {
        if (result.success && result.data) {
            var titleInput = document.getElementById('workflowTitle');
            if (titleInput) {
                titleInput.value = result.data.name;
            }

            if (result.data.nodes && result.data.nodes.length > 0) {
                if (window.loadNodesFromData) {
                    window.loadNodesFromData(result.data.nodes);
                }
            }

            if (result.data.connections) {
                if (window.loadConnectionsFromData) {
                    window.loadConnectionsFromData(result.data.connections);
                }
            }

            if (result.data.pinnedData) {
                if (window.loadPinnedDataFromData) {
                    window.loadPinnedDataFromData(result.data.pinnedData);
                }
            }
        }
    });
}

function saveWorkflow() {
    var workflowId = getUrlParam('id');
    var titleInput = document.getElementById('workflowTitle');
    var name = titleInput ? titleInput.value : 'Untitled Workflow';

    var nodes = [];
    var connections = [];
    var pinnedData = {};

    if (typeof getCanvasNodes === 'function') {
        nodes = getCanvasNodes();
    }

    if (typeof getCanvasConnections === 'function') {
        connections = getCanvasConnections();
    }

    if (typeof getPinnedData === 'function') {
        pinnedData = getPinnedData();
    }

    return apiCall('update_workflow', {
        data: {
            id: workflowId,
            name: name,
            nodes: nodes,
            connections: connections,
            pinnedData: pinnedData
        }
    }, function (result) {
        if (result.success) {
            if (typeof clearUnsavedChanges === 'function') {
                clearUnsavedChanges();
            }
            showNotification('Workflow saved successfully!', false);
        } else {
            showNotification('Failed to save workflow', true);
        }
    });
}


function deleteWorkflow() {
    var workflowId = getUrlParam('id');

    apiCall('delete_workflow', { id: workflowId }, function (result) {
        if (result.success) {
            window.location.href = 'work.html';
        } else {
            showNotification('Failed to delete workflow', true);
        }
    });
}

/* ================================================== */
/* CREDENTIAL FUNCTIONS                               */
/* ================================================== */

function createCredential() {
    var credential = {
        id: generateId(),
        name: 'Untitled API Key',
        apiKey: '',
        description: ''
    };

    apiCall('create_credential', { data: credential }, function (result) {
        if (result.success) {
            window.location.href = 'landcredits.html?id=' + credential.id;
        } else {
            showNotification('Failed to create API key', true);
        }
    });
}

function loadCredentials() {
    var container = document.getElementById('credentialsContainer');
    var emptyState = document.getElementById('emptyState');

    if (!container) return;

    apiCall('get_credentials', null, function (result) {
        if (result.success && result.data && result.data.length > 0) {
            emptyState.style.display = 'none';
            container.innerHTML = '';

            for (var i = 0; i < result.data.length; i++) {
                var cred = result.data[i];
                var bar = document.createElement('div');
                bar.className = 'item-bar';
                bar.setAttribute('data-id', cred.id);

                bar.innerHTML =
                    '<div class="item-icon">🔑</div>' +
                    '<div class="item-info">' +
                    '<div class="item-name">' + cred.name + '</div>' +
                    '<div class="item-id">' + cred.id + '</div>' +
                    '</div>' +
                    '<span class="item-status status-active">saved</span>' +
                    '<span class="item-arrow">→</span>';

                (function (id) {
                    bar.addEventListener('click', function () {
                        window.location.href = 'landcredits.html?id=' + id;
                    });
                })(cred.id);

                container.appendChild(bar);
            }
        } else {
            emptyState.style.display = 'block';
            container.innerHTML = '';
        }
    });
}

function loadCredentialEditor() {
    var credId = getUrlParam('id');
    if (!credId) return;

    var idDisplay = document.getElementById('credentialId');
    if (idDisplay) {
        idDisplay.textContent = 'ID: ' + credId;
    }

    apiCall('get_credential', { id: credId }, function (result) {
        if (result.success && result.data) {
            var titleInput = document.getElementById('credentialTitle');
            var nameInput = document.getElementById('apiName');
            var keyInput = document.getElementById('apiKey');
            var descInput = document.getElementById('apiDesc');

            if (titleInput) titleInput.value = result.data.name;
            if (nameInput) nameInput.value = result.data.name;
            if (keyInput) keyInput.value = result.data.apiKey || '';
            if (descInput) descInput.value = result.data.description || '';
        }
    });
}

function saveCredential() {
    var credId = getUrlParam('id');
    var nameInput = document.getElementById('apiName');
    var keyInput = document.getElementById('apiKey');
    var descInput = document.getElementById('apiDesc');
    var titleInput = document.getElementById('credentialTitle');

    var name = nameInput ? nameInput.value : 'Untitled API Key';
    var apiKey = keyInput ? keyInput.value : '';
    var description = descInput ? descInput.value : '';

    apiCall('update_credential', {
        data: {
            id: credId,
            name: name,
            apiKey: apiKey,
            description: description
        }
    }, function (result) {
        if (result.success) {
            if (titleInput) titleInput.value = name;
            showNotification('API Key saved successfully!', false);
        } else {
            showNotification('Failed to save API key', true);
        }
    });
}

function deleteCredential() {
    var credId = getUrlParam('id');

    apiCall('delete_credential', { id: credId }, function (result) {
        if (result.success) {
            window.location.href = 'credits.html';
        } else {
            showNotification('Failed to delete API key', true);
        }
    });
}

function toggleKeyVisibility() {
    var keyInput = document.getElementById('apiKey');
    var toggleBtn = document.getElementById('toggleKey');

    if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.textContent = '🙈';
    } else {
        keyInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}

/* ================================================== */
/* MODAL FUNCTIONS                                    */
/* ================================================== */

function showDeleteModal() {
    var modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('active');
}

function hideDeleteModal() {
    var modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('active');
}

/* ================================================== */
/* INITIALIZATION                                     */
/* ================================================== */

document.addEventListener('DOMContentLoaded', function () {

    initHamburger();

    // Work page
    var createWorkflowBtn = document.getElementById('createWorkflowBtn');
    if (createWorkflowBtn) {
        createWorkflowBtn.addEventListener('click', createWorkflow);
        loadWorkflows();
    }

    // Credits page
    var createCredentialBtn = document.getElementById('createCredentialBtn');
    if (createCredentialBtn) {
        createCredentialBtn.addEventListener('click', createCredential);
        loadCredentials();
    }

    // Workflow editor page
    if (window.location.pathname.indexOf('landwork.html') !== -1) {
        loadWorkflowEditor();

        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveWorkflow);

        var deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) deleteBtn.addEventListener('click', showDeleteModal);

        var cancelDelete = document.getElementById('cancelDelete');
        if (cancelDelete) cancelDelete.addEventListener('click', hideDeleteModal);

        var confirmDelete = document.getElementById('confirmDelete');
        if (confirmDelete) confirmDelete.addEventListener('click', deleteWorkflow);
    }

    // Credential editor page logic is now handled wholly within landcredits.html
    // Legacy logic removed to prevent conflicts
    /*
    if (window.location.pathname.indexOf('landcredits.html') !== -1) {
        loadCredentialEditor();
        
        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveCredential);
        
        var deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) deleteBtn.addEventListener('click', showDeleteModal);
        
        var cancelDelete = document.getElementById('cancelDelete');
        if (cancelDelete) cancelDelete.addEventListener('click', hideDeleteModal);
        
        var confirmDelete = document.getElementById('confirmDelete');
        if (confirmDelete) confirmDelete.addEventListener('click', deleteCredential);
        
        var toggleKey = document.getElementById('toggleKey');
        if (toggleKey) toggleKey.addEventListener('click', toggleKeyVisibility);
    }
    */

});