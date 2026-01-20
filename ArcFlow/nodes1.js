/* ================================================== */
/* ================================================== */
/*                                                    */
/*          ARCFLOW ENGINE v7.0                       */
/*          Complete N8N Clone - Production Ready     */
/*          Built for Arc.Network Hackathon           */
/*                                                    */
/* ================================================== */
/* ================================================== */
/*      SECTION 22: EXECUTION HISTORY UI              */
/* ================================================== */

function setupExecutionHistoryUI() {
    var sidebar = document.querySelector('.editor-sidebar');
    if (!sidebar) return;

    var btn = document.createElement('button');
    btn.className = 'sidebar-item'; // Match existing class usually 'sidebar-item' or 'sidebar-btn'
    btn.innerHTML = '<span class="sidebar-icon">📜</span>';
    btn.title = 'Execution History';
    btn.onclick = openExecutionHistory;

    // Find where to insert (after nodes button)
    var nodesBtn = document.getElementById('nodesToggle');
    if (nodesBtn && nodesBtn.parentNode === sidebar) {
        sidebar.insertBefore(btn, nodesBtn.nextSibling);
    } else {
        // Try sidebar-top container
        var top = sidebar.querySelector('.sidebar-top');
        if (top) top.appendChild(btn);
        else sidebar.appendChild(btn);
    }
}

// Call in init
function initArcFlow() {
    // Only init on workflow editor page
    if (window.location.pathname.indexOf('landwork.html') === -1) return;

    console.log('%c ArcFlow Engine v8.0 ', 'background: #8b5cf6; color: white; font-size: 14px; padding: 5px 10px; border-radius: 5px;');
    console.log('Built for Arc.Network Hackathon');

    setupCanvas();
    setupNodePanel();
    setupViewportControls();
    setupKeyboardShortcuts();
    setupExecutionControls();
    setupUnsavedChangesWarning();
    setupExecutionHistoryUI(); // NEW

    renderNodePanel();
    createNodeModal();
    createDataEditorModal();
    createExpressionHelpModal();

    console.log('✓ Loaded ' + Object.keys(NodeDefinitions).length + ' node types');
}

function saveExecutionLog(context, success, executedNodes) {
    var execData = {
        id: 'exec_' + Date.now(),
        workflowId: context.workflowId,
        startedAt: new Date(context.startTime).toISOString(),
        executionTime: Date.now() - context.startTime,
        status: success ? 'success' : 'error',
        nodes: executedNodes // Summary or full ids
    };

    fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_execution', data: execData })
    }).catch(e => console.error('Failed to save log', e));
}

function openExecutionHistory() {
    // Create modal if not exists
    var modal = document.getElementById('historyModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'historyModal';
        modal.className = 'custom-modal';
        modal.innerHTML = `
            <div class="custom-modal-content" style="width: 700px;">
                <div class="custom-modal-header">
                    <h3>Execution History</h3>
                    <button class="custom-modal-close" onclick="closeHistoryModal()">×</button>
                </div>
                <div class="custom-modal-body">
                    <div id="execList" class="exec-list">Loading...</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add specific styles
        var style = document.createElement('style');
        style.textContent = `
            .exec-list { max-height: 400px; overflow-y: auto; }
            .exec-item { display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-color); }
            .exec-item:hover { background: var(--bg-primary); cursor: pointer; }
            .exec-status { width: 10px; height: 10px; border-radius: 50%; margin-right: 10px; }
            .exec-status.success { background: #10b981; }
            .exec-status.error { background: #ef4444; }
            .exec-time { color: var(--text-secondary); font-size: 12px; }
        `;
        document.head.appendChild(style);
    }

    document.getElementById('historyModal').classList.add('active');
    loadExecutionsList();
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

function loadExecutionsList() {
    var list = document.getElementById('execList');
    list.innerHTML = 'Loading...';

    fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_executions' })
    })
        .then(r => r.json())
        .then(res => {
            if (!res.success || !res.data) {
                list.innerHTML = 'Error loading history';
                return;
            }

            if (res.data.length === 0) {
                list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-secondary);">No executions recorded yet.</div>';
                return;
            }

            list.innerHTML = '';
            res.data.forEach(ex => {
                var item = document.createElement('div');
                item.className = 'exec-item';

                var date = new Date(ex.startedAt).toLocaleString();
                var duration = ex.executionTime + 'ms';

                item.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <span class="exec-status ${ex.status}"></span>
                    <div>
                        <div style="font-weight:500;">Execution ${ex.id.substring(5, 10)}...</div>
                        <div class="exec-time">${date}</div>
                    </div>
                </div>
                <div class="exec-time">${duration}</div>
            `;

                item.onclick = function () {
                    // Future: Open detail view
                    showNotification('Viewing details for ' + ex.id + ' (Not implemented)');
                };

                list.appendChild(item);
            });
        });
}


/* ================================================== */
/*                                                    */
/*      SECTION 1: GLOBAL STATE                       */
/*                                                    */
/* ================================================== */

window.ArcFlow = {
    // Core data
    nodes: [],
    connections: [],

    // Selection state
    selectedNodeId: null,
    selectedConnectionId: null,
    editingNameId: null,

    // Viewport
    zoom: 1.0,
    panX: 0,
    panY: 0,

    // Interaction states
    isDraggingNode: false,
    isPanning: false,
    isConnecting: false,
    isSpacePressed: false,
    isDraggingField: false,

    // Drag data
    draggedNode: null,
    dragOffset: { x: 0, y: 0 },
    lastMouseX: 0,
    lastMouseY: 0,

    // Connection drag
    connectionStartNodeId: null,
    connectionStartPos: { x: 0, y: 0 },
    pendingConnectionNodeId: null,

    // Field drag
    draggedFieldData: null,

    // Execution state
    executionData: {},
    pinnedData: {},
    lastExecutionResult: null,
    isExecuting: false,

    // Node counter
    nodeCounter: 0,

    // Unsaved changes
    hasUnsavedChanges: false,

    // Modal state
    currentModalNodeId: null,
    currentModalViewMode: 'json',
    currentSelectedInputNode: null,

    // Data editor state
    editingDataType: null,
    editingTargetNodeId: null,
    editingOriginalData: null,

    // Workflow metadata
    workflow: {
        id: null,
        name: 'Untitled Workflow',
        active: false
    },

    // Static variables (like n8n $vars)
    vars: {},

    // Environment variables
    env: {}
};





/* ================================================== */
/*                                                    */
/*      SECTION 2: COMPLETE EXPRESSION ENGINE         */
/*      N8N-Style with Full Node Access               */
/*                                                    */
/* ================================================== */


/**
 * Main expression processor
 * Handles all {{ }} expressions with full context
 */
function processExpression(template, inputData, context, options) {
    // Return non-string values as-is
    if (template === null || template === undefined) return template;
    if (typeof template !== 'string') return template;

    options = options || {};

    // Return if no expressions
    if (!hasExpression(template)) return template;

    var exprContext = buildFullExpressionContext(context.nodeId, inputData);

    // CRITICAL: If the template is purely one expression {{ ... }}, return the raw evaluated value (Object, Array, etc.)
    // This matches n8n behavior where {{ $json }} returns the object, not "[object Object]"
    var singleExprMatch = template.match(/^\s*\{\{([\s\S]*?)\}\}\s*$/);
    if (singleExprMatch) {
        var expr = singleExprMatch[1].trim();

        // Special case for AI Managed fields
        if (expr === '$ai_managed') {
            return '[Managed by AI]';
        }

        try {
            return evaluateExpressionSafe(expr, exprContext);
        } catch (error) {
            console.error('Expression error:', singleExprMatch[1], error);
            return '[ERROR: ' + error.message + ']';
        }
    }

    // Otherwise, process as string interpolation
    var result = template.replace(/\{\{([\s\S]*?)\}\}/g, function (match, expression) {
        var expr = expression.trim();
        if (!expr) return '';

        try {
            var value = evaluateExpressionSafe(expr, exprContext);

            // Handle different return types for interpolation
            if (value === undefined) {
                // Only show [undefined] if explicitly requested (e.g. for UI previews)
                return (options && options.showUndefined) ? '[undefined]' : '';
            }
            if (value === null) return 'null';
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);

        } catch (error) {
            console.error('Expression error:', expr, error);
            return '[ERROR: ' + error.message + ']';
        }
    });

    return result;
}


/**
 * Build complete expression context with access to ALL nodes
 */
function buildFullExpressionContext(currentNodeId, inputData) {
    // Normalize input data
    var items = normalizeToArray(inputData);
    var firstItem = items[0] || {};

    // Build $node object with ALL workflow nodes
    var $node = {};
    ArcFlow.nodes.forEach(function (node) {
        var nodeOutput = getNodeOutputData(node.id);
        var nodeItems = normalizeToArray(nodeOutput);
        var firstNodeItem = nodeItems[0] || {};

        $node[node.name] = {
            // Primary accessors
            json: firstNodeItem,
            data: nodeItems,

            // Array-style access
            first: function () { return nodeItems[0]; },
            last: function () { return nodeItems[nodeItems.length - 1]; },
            all: function () { return nodeItems; },
            item: function (index) { return nodeItems[index]; },

            // Metadata
            id: node.id,
            name: node.name,
            type: node.type,

            // Parameter access
            params: node.config || {},
            parameter: node.config || {}
        };
    });

    // Build $items function
    function $items(nodeName, outputIndex, runIndex) {
        if (!nodeName) return items;

        var node = ArcFlow.nodes.find(function (n) {
            return n.name === nodeName || n.id === nodeName;
        });

        if (!node) return [];

        var nodeOutput = getNodeOutputData(node.id);
        return normalizeToArray(nodeOutput);
    }

    // Build $input object
    var $input = {
        item: firstItem,
        first: function () { return items[0]; },
        last: function () { return items[items.length - 1]; },
        all: function () { return items; }
    };

    // Date helpers with Luxon-style methods
    var $now = createEnhancedDate(new Date());
    var $today = createEnhancedDate(new Date(new Date().setHours(0, 0, 0, 0)));

    // Build complete context
    return {
        // Current data
        $json: firstItem,
        $item: firstItem,
        $items: $items,
        $input: $input,

        // Node access
        $node: $node,

        // Metadata
        $workflow: {
            id: ArcFlow.workflow.id || getUrlParam('id') || 'workflow_' + Date.now(),
            name: ArcFlow.workflow.name || document.getElementById('workflowTitle')?.value || 'Untitled',
            active: ArcFlow.workflow.active
        },
        $execution: {
            id: 'exec_' + Date.now(),
            mode: 'manual',
            resumeUrl: window.location.href
        },

        // Date/Time
        $now: $now,
        $today: $today,
        DateTime: {
            now: function () { return createEnhancedDate(new Date()); },
            fromISO: function (str) { return createEnhancedDate(new Date(str)); },
            fromMillis: function (ms) { return createEnhancedDate(new Date(ms)); }
        },

        // Variables
        $vars: ArcFlow.vars,
        $env: ArcFlow.env,

        // Utilities (JavaScript built-ins)
        Math: Math,
        Object: Object,
        Array: Array,
        String: String,
        Number: Number,
        Boolean: Boolean,
        JSON: JSON,
        Date: Date,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite,
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
        encodeURI: encodeURI,
        decodeURI: decodeURI,
        btoa: typeof btoa !== 'undefined' ? btoa : function (s) { return s; },
        atob: typeof atob !== 'undefined' ? atob : function (s) { return s; },

        // Console for debugging
        console: {
            log: function () { console.log.apply(console, arguments); }
        }
    };
}


/**
 * Gather connected context for AI Agents (Memory, Tools)
 */
async function getAIContext(nodeId, inputData, context) {
    var memory = [];
    var tools = [];
    var memoryNodeId = null;

    console.log('[AI Context] Gathering context for node:', nodeId);

    // Scan all connections in the workflow
    // In ArcFlow, specialized connections (memory, tools) might be dragged from Source to AI 
    // or AI to Source. We check BOTH directions to be robust.
    var nodeConns = ArcFlow.connections.filter(c => c.to === nodeId || c.from === nodeId);
    console.log('[AI Context] Found relevant connections:', nodeConns.length);

    for (const conn of nodeConns) {
        // Determine which node is the "provider" (Tool/Memory)
        var otherNodeId = (conn.to === nodeId) ? conn.from : conn.to;
        var fromNode = getNodeById(otherNodeId);

        if (!fromNode) {
            console.warn('[AI Context] Other node not found for connection:', otherNodeId);
            continue;
        }

        // Only process if it's a specialized connection type
        // standard 'data' connections must follow the (to === nodeId) rule
        if (conn.type === 'data' && conn.to !== nodeId) continue;

        console.log('[AI Context] Processing connection with:', fromNode.name, '(' + fromNode.type + ') type:', conn.type);

        // Branch by connection type
        if (conn.type === 'memory') {
            memoryNodeId = fromNode.id;
            // Get the output data that was stored in this memory node
            var output = getNodeOutputData(fromNode.id);

            // If no output, execute it now!
            if (!output) {
                console.log('[AI Context] Memory node has no output, executing:', fromNode.name);
                var definition = NodeDefinitions[fromNode.type];
                if (definition && definition.execute) {
                    // Sync common data (sessionId, etc) from current context
                    var result = await definition.execute([], fromNode.config || {}, {
                        nodeId: fromNode.id,
                        nodeName: fromNode.name,
                        workflowId: ArcFlow.workflow.id || ArcFlow.workflowId,
                        sessionId: context.sessionId,
                        executionId: context.executionId
                    });
                    if (result.success) {
                        output = result.output;
                        // Store it so it's available for next iterations
                        if (!ArcFlow.executionData[fromNode.id]) ArcFlow.executionData[fromNode.id] = {};
                        ArcFlow.executionData[fromNode.id].output = output;
                        ArcFlow.executionData[fromNode.id].status = 'success';
                        setNodeStatus(fromNode.id, 'success');
                    } else {
                        console.error('[AI Context] Memory node execution failed:', result.error);
                    }
                }
            }

            if (output) {
                var items = normalizeToArray(output);
                console.log('[AI Context] Found memory items:', items.length);
                items.forEach(function (item) {
                    if (item.json) memory.push(item.json);
                    else if (item.messages) memory.push(item); // Handle Window Buffer Memory structure
                    else memory.push(item);
                });
            }
        } else if (conn.type === 'tool') {
            // Get the tool configuration
            var toolDef = fromNode.config || {};
            var appearance = (NodeDefinitions[fromNode.type] || {}).appearance || {};
            console.log('[AI Context] Adding tool:', fromNode.name);
            tools.push({
                id: fromNode.id,
                type: fromNode.type,
                name: fromNode.name,
                icon: appearance.icon || '🛠️',
                description: toolDef.description || 'Executes ' + fromNode.name,
                config: toolDef
            });
        }
    }

    console.log('[AI Context] Final context:', { memoryCount: memory.length, toolsCount: tools.length });
    return { memory: memory, tools: tools, memoryNodeId: memoryNodeId };
}


/**
 * Execute a connected tool node and return its output
 * Used by AI agents when tool calling is enabled
 */
function executeToolNode(toolId, toolArgs) {
    return new Promise(function (resolve) {
        var toolNode = getNodeById(toolId);
        if (!toolNode) {
            resolve({ success: false, error: 'Tool node not found: ' + toolId });
            return;
        }

        var definition = NodeDefinitions[toolNode.type];
        if (!definition || !definition.execute) {
            resolve({ success: false, error: 'Tool node has no execute function: ' + toolNode.type });
            return;
        }

        // Merge tool args with existing config
        var toolConfig = Object.assign({}, toolNode.config || {}, toolArgs || {});
        var toolContext = {
            nodeId: toolId,
            nodeName: toolNode.name,
            workflowId: ArcFlow.workflowId
        };

        // Execute the tool
        highlightNode(toolId, '#10b981');
        definition.execute([toolArgs], toolConfig, toolContext)
            .then(function (result) {
                clearHighlight(toolId);
                resolve(result);
            })
            .catch(function (err) {
                clearHighlight(toolId);
                resolve({ success: false, error: 'Tool execution failed: ' + err.message });
            });
    });
}


/**
 * Build tool definitions in Gemini function calling format
 */
function buildToolDefinitions(tools) {
    return tools.map(function (tool) {
        // Create function name from node name (sanitize for API)
        var funcName = (tool.name || 'unnamed_tool')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 63);

        // Build parameters based on tool type using NodeDefinitions settings
        var parameters = { type: 'object', properties: {}, required: [] };
        var toolDesc = tool.description || 'Executes the ' + (tool.name || tool.type) + ' node';

        // Use Custom Tool Definition if provided by node
        if (typeof NodeDefinitions !== 'undefined' && NodeDefinitions[tool.type]) {
            var nodeDef = NodeDefinitions[tool.type];

            if (nodeDef.getToolDefinition) {
                var customDef = nodeDef.getToolDefinition(tool.config || {});
                if (customDef) {
                    funcName = (customDef.name || funcName).toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    toolDesc = customDef.description || toolDesc;
                    parameters = customDef.parameters || parameters;

                    return {
                        name: funcName,
                        description: toolDesc,
                        parameters: parameters,
                        _nodeId: tool.id,
                        _nodeName: tool.name
                    };
                }
            }

            // Enrich description from node definition if missing
            if (nodeDef.appearance && nodeDef.appearance.description) {
                toolDesc = nodeDef.appearance.description + ' (via ' + tool.name + ')';
            }

            if (nodeDef.settings) {
                nodeDef.settings.forEach(function (setting) {
                    // Skip credentials and display-only fields
                    if (setting.type === 'credential' || setting.type === 'display') return;

                    // Map settings to AI parameters with richer context
                    var propName = setting.name;
                    var propDesc = setting.label;
                    if (setting.description) propDesc += ': ' + setting.description;

                    // Add hints about expected values
                    if (setting.options) {
                        var optionsStr = setting.options.map(function (o) { return typeof o === 'string' ? o : (o.label || o.value); }).join(', ');
                        propDesc += ' (Available options: ' + optionsStr + ')';
                    }

                    parameters.properties[propName] = {
                        type: setting.type === 'number' ? 'number' : 'string',
                        description: propDesc
                    };

                    if (setting.required) {
                        parameters.required.push(propName);
                    }
                });
            }
        }

        // Fallback: Add generic input if no specific settings found
        if (Object.keys(parameters.properties).length === 0) {
            parameters.properties = {
                input: { type: 'string', description: 'Input data or raw JSON for the tool' }
            };
        }

        return {
            name: funcName,
            description: toolDesc,
            parameters: parameters,
            _nodeId: tool.id,
            _nodeName: tool.name
        };
    });
}


/**
 * Execute AI with tool calling loop
 * This implements the agentic pattern where AI can call tools iteratively
 */
/**
 * Highlight a node with a glowing border
 */
function highlightNode(nodeId, color) {
    const nodeEl = document.querySelector(`.canvas-node[data-id="${nodeId}"]`);
    if (nodeEl) {
        nodeEl.classList.add('active-node-glow');
        nodeEl.style.setProperty('--glow-color', color || '#10b981');
    }
}

/**
 * Remove highlight from a node
 */
function clearHighlight(nodeId) {
    const nodeEl = document.querySelector(`.canvas-node[data-id="${nodeId}"]`);
    if (nodeEl) {
        nodeEl.classList.remove('active-node-glow');
    }
}

/**
 * Show AI step indicator tooltip on a node (n8n parity)
 * Displays a floating label showing what the AI is doing
 */
function showAIStepIndicator(message, nodeId) {
    // Remove any existing indicator for this node
    hideAIStepIndicator(nodeId);

    const nodeEl = document.querySelector(`.canvas-node[data-id="${nodeId}"]`);
    if (!nodeEl) return;

    // Create floating indicator
    const indicator = document.createElement('div');
    indicator.className = 'ai-step-indicator';
    indicator.dataset.nodeId = nodeId;
    indicator.innerHTML = `<span class="ai-step-icon">⚡</span><span class="ai-step-text">${message}</span>`;

    // Style the indicator
    indicator.style.cssText = `
        position: absolute;
        top: -35px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        animation: aiStepPulse 1.5s ease-in-out infinite;
        display: flex;
        align-items: center;
        gap: 6px;
    `;

    nodeEl.style.position = 'relative';
    nodeEl.appendChild(indicator);

    // Add animation keyframes if not present
    if (!document.getElementById('ai-step-styles')) {
        const style = document.createElement('style');
        style.id = 'ai-step-styles';
        style.textContent = `
            @keyframes aiStepPulse {
                0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
                50% { opacity: 0.85; transform: translateX(-50%) scale(1.02); }
            }
            .ai-step-icon { font-size: 14px; }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Hide AI step indicator from a node
 */
function hideAIStepIndicator(nodeId) {
    const indicator = document.querySelector(`.ai-step-indicator[data-node-id="${nodeId}"]`);
    if (indicator) {
        indicator.remove();
    }
}

function executeAIWithToolCalling(apiKey, config, inputData, context, aiContext, provider) {
    highlightNode(context.nodeId, '#3b82f6');
    return new Promise(function (resolve) {
        var maxIterations = 10;
        var iteration = 0;
        var toolCallHistory = [];
        var conversationHistory = [];

        // Process initial prompt
        var processedPrompt = processExpression(config.prompt || '', inputData, context);
        var processedSystem = processExpression(config.systemInstruction || config.systemPrompt || '', inputData, context);

        // Build tool definitions
        var toolDefs = buildToolDefinitions(aiContext.tools);

        console.log('[AI Engine] Starting iteration', iteration);
        console.log('[AI Engine] Context memory items:', aiContext.memory.length);
        console.log('[AI Engine] Defined tools:', toolDefs.length);

        // Process memory context
        var memoryObj = aiContext.memory && aiContext.memory[0];
        if (memoryObj && memoryObj.type === 'window-buffer-memory') {
            console.log('[AI Engine] Loading window buffer memory:', memoryObj.sessionId);
            highlightNode(aiContext.memoryNodeId, '#06b6d4');
            showAIStepIndicator('📚 Loading memory...', aiContext.memoryNodeId);
            setTimeout(function () {
                clearHighlight(aiContext.memoryNodeId);
                hideAIStepIndicator(aiContext.memoryNodeId);
            }, 1500);

            // Limit messages by contextWindow
            var windowSize = parseInt(memoryObj.contextWindow) || 10;
            var history = (memoryObj.messages || []).slice(-windowSize);
            console.log('[AI Engine] Injecting history turns:', history.length);

            // structured messages from memory should be first in history!
            if (history.length > 0) {
                history.forEach(function (msg) {
                    if (msg.role && msg.content) {
                        conversationHistory.push(msg);
                    }
                });
            }
        }

        // Add tool instructions
        if (toolDefs.length > 0) {
            var toolInstructions = '\n\n--- AVAILABLE TOOLS ---\n';
            toolInstructions += 'You have access to the following tools. Call them when needed:\n';
            toolDefs.forEach(function (t) {
                toolInstructions += '- ' + t.name + ': ' + t.description + '\n';
            });
            processedSystem = (processedSystem || '') + toolInstructions;
        }

        // Initialize conversation
        // Initialize conversation from memory if available
        // Initial conversation history is already built from memory above

        // Add initial prompt if this is a new conversation
        if (conversationHistory.length === 0 || conversationHistory[conversationHistory.length - 1].content !== processedPrompt) {
            conversationHistory.push({
                role: 'user',
                content: processedPrompt
            });
        }

        // Recursive function to handle tool calling loop
        function callAI() {
            iteration++;

            // Show iteration progress (n8n parity)
            showExecutionNotification('running', '🤖 Thinking... (Step ' + iteration + '/' + maxIterations + ')');

            if (iteration > maxIterations) {
                finalizeExecution('Max iterations reached.');
                return;
            }

            // Build request
            var requestBody = {
                action: provider === 'openai' ? 'openai_tools' : (provider === 'claude' ? 'claude_tools' : 'gemini_tools'),
                apiKey: apiKey,
                model: (config.model && config.model.trim() !== '') ? config.model : (provider === 'openai' ? 'gpt-4o' : (provider === 'claude' ? 'claude-3-5-sonnet-20241022' : 'gemini-2.0-flash')),
                prompt: null, // Prompt is already in history
                systemInstruction: processedSystem,
                conversationHistory: conversationHistory,
                tools: toolDefs,
                temperature: parseFloat(config.temperature) || 0.7,
                maxTokens: parseInt(config.maxTokens) || 4096,
                reasoning_effort: config.reasoning_effort, // OpenAI
                enableToolCalling: config.enableToolCalling // Gemini
            };

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (!result.success) {
                        resolve({
                            success: false,
                            error: result.message || 'AI API request failed',
                            errorType: 'API_ERROR'
                        });
                        return;
                    }

                    // Check if AI wants to call tools (Parallel Support)
                    var toolCalls = result.toolCalls || (result.toolCall ? [result.toolCall] : null);

                    if (toolCalls && toolCalls.length > 0) {
                        // Prepare parallel execution
                        var promises = toolCalls.map(function (toolCall) {
                            var toolDef = toolDefs.find(function (t) {
                                return t.name === toolCall.name;
                            });

                            if (!toolDef) {
                                return Promise.resolve({
                                    toolCall: toolCall,
                                    success: false,
                                    error: 'Unknown tool: ' + toolCall.name
                                });
                            }

                            highlightNode(toolDef._nodeId, '#10b981');
                            showAIStepIndicator('🔧 Calling: ' + toolDef.name, toolDef._nodeId);
                            return executeToolNode(toolDef._nodeId, toolCall.arguments)
                                .then(function (res) {
                                    clearHighlight(toolDef._nodeId);
                                    hideAIStepIndicator(toolDef._nodeId);
                                    return {
                                        toolCall: toolCall,
                                        toolDef: toolDef,
                                        success: res.success,
                                        data: res.output || res.data,
                                        error: res.error
                                    };
                                });
                        });

                        Promise.all(promises).then(function (results) {
                            // Add Assistant message with ALL tool calls
                            var assistantMsg = {
                                role: 'assistant',
                                content: null,
                                tool_calls: toolCalls.map(function (tc) {
                                    return {
                                        id: tc.id || 'tool_' + Math.random().toString(36).substr(2, 9),
                                        type: 'function',
                                        function: {
                                            name: tc.name,
                                            arguments: JSON.stringify(tc.arguments)
                                        }
                                    };
                                })
                            };

                            // Compatibility for Gemini/n8n format
                            assistantMsg.functionCall = assistantMsg.tool_calls[0].function;
                            conversationHistory.push(assistantMsg);

                            // Add results for EACH tool
                            results.forEach(function (res) {
                                var resStr = res.success ? JSON.stringify(res.data || {}) : ('Error: ' + (res.error || 'Unknown'));

                                conversationHistory.push({
                                    role: 'function',
                                    name: res.toolCall.name,
                                    content: resStr,
                                    tool_call_id: assistantMsg.tool_calls.find(tc => tc.function.name === res.toolCall.name)?.id
                                });

                                // Record for history
                                toolCallHistory.push({
                                    tool: res.toolDef ? res.toolDef._nodeName : res.toolCall.name,
                                    arguments: res.toolCall.arguments,
                                    result: res.success ? res.data : null,
                                    error: res.success ? null : res.error
                                });
                            });

                            // Continue loop
                            callAI();
                        });
                    } else {
                        // Final Text Response
                        finalizeExecution(result.data);
                    }
                });
        }

        function finalizeExecution(finalResponse) {
            clearHighlight(context.nodeId);

            // Add Assistant response to history
            conversationHistory.push({ role: 'assistant', content: finalResponse });

            // "Brutal" Persistence: Save the whole sequence back to the session
            var memoryNode = aiContext.memory && aiContext.memory[0];
            var activeSessionId = (memoryNode && memoryNode.sessionId) || 'default';

            // Show memory saving indicator (n8n parity)
            if (aiContext.memoryNodeId) {
                highlightNode(aiContext.memoryNodeId, '#06b6d4');
                showAIStepIndicator('💾 Saving to memory...', aiContext.memoryNodeId);
                setTimeout(function () {
                    clearHighlight(aiContext.memoryNodeId);
                    hideAIStepIndicator(aiContext.memoryNodeId);
                }, 1500);
            }

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_chat_history',
                    sessionId: activeSessionId,
                    messages: conversationHistory.slice(-20) // Keep last 20 for window
                })
            });

            resolve({
                success: true,
                output: [{
                    text: finalResponse,
                    response: finalResponse,
                    toolCalls: toolCallHistory,
                    iterations: iteration,
                    model: config.model,
                    prompt: processedPrompt,
                    timestamp: new Date().toISOString()
                }]
            });
        }

        callAI();
    });
}


/**
 * Create enhanced date with Luxon-style methods
 */
function createEnhancedDate(date) {
    if (!date || !(date instanceof Date)) {
        date = new Date();
    }

    // Clone date to avoid mutation
    var d = new Date(date.getTime());

    // Add methods
    d.toISO = function () {
        return this.toISOString();
    };

    d.toFormat = function (format) {
        var self = this;
        var tokens = {
            'yyyy': self.getFullYear(),
            'yy': String(self.getFullYear()).slice(-2),
            'MMMM': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][self.getMonth()],
            'MMM': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][self.getMonth()],
            'MM': String(self.getMonth() + 1).padStart(2, '0'),
            'M': self.getMonth() + 1,
            'dd': String(self.getDate()).padStart(2, '0'),
            'd': self.getDate(),
            'EEEE': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][self.getDay()],
            'EEE': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][self.getDay()],
            'HH': String(self.getHours()).padStart(2, '0'),
            'H': self.getHours(),
            'hh': String(self.getHours() % 12 || 12).padStart(2, '0'),
            'h': self.getHours() % 12 || 12,
            'mm': String(self.getMinutes()).padStart(2, '0'),
            'm': self.getMinutes(),
            'ss': String(self.getSeconds()).padStart(2, '0'),
            's': self.getSeconds(),
            'a': self.getHours() < 12 ? 'AM' : 'PM'
        };

        var result = format;
        // Sort by length descending to replace longer tokens first
        var sortedKeys = Object.keys(tokens).sort(function (a, b) { return b.length - a.length; });
        sortedKeys.forEach(function (token) {
            result = result.replace(new RegExp(token, 'g'), tokens[token]);
        });
        return result;
    };

    d.plus = function (duration) {
        var newDate = new Date(this.getTime());
        if (duration.years) newDate.setFullYear(newDate.getFullYear() + duration.years);
        if (duration.months) newDate.setMonth(newDate.getMonth() + duration.months);
        if (duration.weeks) newDate.setDate(newDate.getDate() + (duration.weeks * 7));
        if (duration.days) newDate.setDate(newDate.getDate() + duration.days);
        if (duration.hours) newDate.setHours(newDate.getHours() + duration.hours);
        if (duration.minutes) newDate.setMinutes(newDate.getMinutes() + duration.minutes);
        if (duration.seconds) newDate.setSeconds(newDate.getSeconds() + duration.seconds);
        return createEnhancedDate(newDate);
    };

    d.minus = function (duration) {
        var inverted = {};
        Object.keys(duration).forEach(function (key) {
            inverted[key] = -duration[key];
        });
        return this.plus(inverted);
    };

    d.startOf = function (unit) {
        var newDate = new Date(this.getTime());
        switch (unit) {
            case 'year':
                newDate.setMonth(0);
            // fall through
            case 'month':
                newDate.setDate(1);
            // fall through
            case 'day':
                newDate.setHours(0, 0, 0, 0);
                break;
            case 'hour':
                newDate.setMinutes(0, 0, 0);
                break;
            case 'minute':
                newDate.setSeconds(0, 0);
                break;
        }
        return createEnhancedDate(newDate);
    };

    d.endOf = function (unit) {
        var newDate = new Date(this.getTime());
        switch (unit) {
            case 'year':
                newDate.setMonth(11);
                newDate.setDate(31);
                newDate.setHours(23, 59, 59, 999);
                break;
            case 'month':
                newDate.setMonth(newDate.getMonth() + 1, 0);
                newDate.setHours(23, 59, 59, 999);
                break;
            case 'day':
                newDate.setHours(23, 59, 59, 999);
                break;
        }
        return createEnhancedDate(newDate);
    };

    d.diff = function (other, unit) {
        var diffMs = this.getTime() - other.getTime();
        switch (unit) {
            case 'years': return diffMs / (1000 * 60 * 60 * 24 * 365);
            case 'months': return diffMs / (1000 * 60 * 60 * 24 * 30);
            case 'weeks': return diffMs / (1000 * 60 * 60 * 24 * 7);
            case 'days': return diffMs / (1000 * 60 * 60 * 24);
            case 'hours': return diffMs / (1000 * 60 * 60);
            case 'minutes': return diffMs / (1000 * 60);
            case 'seconds': return diffMs / 1000;
            default: return diffMs;
        }
    };

    return d;
}


/**
 * Safe expression evaluator with full context
 */
function evaluateExpressionSafe(expression, context) {
    // Create function argument names and values
    var argNames = Object.keys(context);
    var argValues = argNames.map(function (key) { return context[key]; });

    try {
        // Create function with all context variables
        var fnBody = 'return (' + expression + ');';
        var fn = new Function(argNames.join(','), fnBody);
        return fn.apply(null, argValues);
    } catch (e) {
        throw new Error('Invalid expression: ' + e.message);
    }
}


/**
 * Check if string contains expressions
 */
function hasExpression(str) {
    if (!str || typeof str !== 'string') return false;
    return /\{\{[\s\S]*?\}\}/.test(str);
}


/**
 * Normalize any value to n8n-style item array format
 * [{ json: { ... } }, { json: { ... } }]
 */
function normalizeToArray(data) {
    if (data === null || data === undefined) return [{ json: {} }];

    var items = [];
    if (Array.isArray(data)) {
        items = data.length > 0 ? data : [{ json: {} }];
    } else {
        items = [data];
    }

    // Ensure n8n structure
    return items.map(function (item) {
        if (item && typeof item === 'object' && item.json) {
            return item;
        }
        return { json: item || {} };
    });
}


/**
 * Get expression for dragging from a specific node
 * This creates the correct expression based on source node
 */
function buildDragExpression(sourceNodeId, path, currentNodeId) {
    var sourceNode = getNodeById(sourceNodeId);
    if (!sourceNode) return '{{ $json.' + path + ' }}';

    // If dragging from the direct input node, use $json
    var directInput = getDirectInputNode(currentNodeId);
    if (directInput && directInput.id === sourceNodeId) {
        return '{{ $json.' + path + ' }}';
    }

    // For any other node (including 2, 3, or more nodes back), use $node["Name"]
    return '{{ $node["' + sourceNode.name + '"].json.' + path + ' }}';
}


/**
 * Validate an expression without executing
 */
function validateExpression(expression, inputData, context) {
    var result = {
        valid: true,
        value: null,
        errors: [],
        warnings: []
    };

    if (!expression || typeof expression !== 'string') {
        result.value = expression;
        return result;
    }

    if (!hasExpression(expression)) {
        result.value = expression;
        return result;
    }

    try {
        result.value = processExpression(expression, inputData, context);

        // Check for error markers in result
        if (typeof result.value === 'string' && result.value.includes('[ERROR:')) {
            result.valid = false;
            result.errors.push({
                message: result.value,
                expression: expression
            });
        }

        // Check for null/undefined results
        if (result.value === '' || result.value === 'null' || result.value === 'undefined') {
            result.warnings.push({
                message: 'Expression returned empty/null value',
                expression: expression
            });
        }

    } catch (e) {
        result.valid = false;
        result.errors.push({
            message: e.message,
            expression: expression
        });
    }

    return result;
}





/* ================================================== */
/*                                                    */
/*      SECTION 3: NODE DEFINITIONS                   */
/*                                                    */
/* ================================================== */

var NodeDefinitions = {};


/* -------------------------------------------------- */
/*      3.1: TRIGGER NODES                            */
/* -------------------------------------------------- */

NodeDefinitions['manual-trigger'] = {
    appearance: {
        name: 'Manual Trigger',
        icon: '⚡',
        color: '#f59e0b',
        category: 'trigger',
        section: 'Triggers',
        description: 'Start workflow manually'
    },
    settings: [],
    connectors: { hasInput: false, hasOutput: true },
    defaultData: [
        {
            timestamp: new Date().toISOString(),
            trigger: 'manual',
            executionId: 'exec_' + Date.now()
        }
    ],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            // Use pinned data if available
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            resolve({
                success: true,
                output: [
                    {
                        timestamp: new Date().toISOString(),
                        trigger: 'manual',
                        executionId: 'exec_' + Date.now(),
                        workflow: {
                            id: context.workflowId || 'unknown',
                            name: context.workflowName || 'Untitled'
                        }
                    }
                ]
            });
        });
    }
};

NodeDefinitions['webhook-trigger'] = {
    appearance: {
        name: 'Webhook',
        icon: '🔗',
        color: '#e24d42',
        category: 'trigger',
        section: 'Triggers',
        description: 'Start workflow when webhook is called'
    },
    settings: [
        { name: 'webhookUrl', label: 'Webhook URL', type: 'display', computed: true },
        { name: 'path', label: 'Path', type: 'text', placeholder: 'my-webhook', required: true, default: 'abcd-1234' },
        { name: 'httpMethod', label: 'HTTP Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'], default: 'GET' },
        { name: 'auth', label: 'Authentication', type: 'select', options: ['None', 'Basic Auth', 'Header Auth'], default: 'None' },
        { name: 'responseMode', label: 'Respond', type: 'select', options: ['Immediately', 'When Last Node Finishes', 'Using Respond to Webhook Node'], default: 'Immediately' }
    ],
    getWebhookUrl: function (config) {
        var host = window.location.host;
        var protocol = window.location.protocol;
        var path = (config.path || 'webhook').replace(/^\/+/, '');
        return protocol + '//' + host + '/webhook/' + path;
    },

    connectors: { hasInput: false, hasOutput: true },
    getWebhookUrls: function (config) {
        var host = window.location.host;
        var protocol = window.location.protocol;
        var path = (config.path || 'webhook').replace(/^\/+/, '');
        var isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.');
        var productionDomain = localStorage.getItem('arcflow_webhook_domain') || '';
        var productionProtocol = 'https://';
        var testUrl = protocol + '//' + host + '/webhook-test/' + path;
        var productionUrl = productionDomain ? (productionProtocol + productionDomain + '/webhook/' + path) : (protocol + '//' + host + '/webhook/' + path);
        return { test: testUrl, production: productionUrl, isLocalhost: isLocalhost, method: config.httpMethod || 'GET' };
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            // Use real webhook data if provided (via pollWebhookTriggers -> runFromTrigger)
            if (inputData && (Array.isArray(inputData) ? inputData.length > 0 : !!inputData)) {
                resolve({ success: true, output: normalizeToArray(inputData) });
            } else {
                // Formatting for manual triggering without data
                resolve({ success: true, output: [{ body: { message: 'Webhook triggered manually' }, query: {}, headers: {}, method: config.httpMethod || 'GET' }] });
            }
        });
    }
};

NodeDefinitions['respond-webhook'] = {
    appearance: {
        name: 'Respond to Webhook',
        icon: '📤',
        color: '#e24d42',
        category: 'core',
        section: 'Webhooks',
        description: 'Send a specific response to the webhook call'
    },
    settings: [
        { name: 'responseCode', label: 'HTTP Response Code', type: 'number', default: '200' },
        { name: 'responseBody', label: 'Response Body', type: 'expression', placeholder: '{"success": true}', default: '{"success": true}' },
        {
            name: 'options', label: 'Options', type: 'collection', placeholder: 'Add Option', options: [
                { name: 'responseHeaders', label: 'Response Headers', type: 'expression', placeholder: '{"Content-Type": "application/json"}' }
            ]
        }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var body = processExpression(config.responseBody || '{}', inputData, context);
            var code = parseInt(config.responseCode) || 200;
            var headers = {};

            try {
                if (config.options && config.options.responseHeaders) {
                    headers = JSON.parse(processExpression(config.options.responseHeaders, inputData, context));
                }
            } catch (e) { }

            // Find the trigger ID from the input data (if it came from a webhook)
            var triggerId = null;
            var input = normalizeToArray(inputData);
            if (input.length > 0 && input[0].triggerId) {
                triggerId = input[0].triggerId;
            } else if (input.length > 0 && input[0].id && String(input[0].id).startsWith('wh_')) {
                triggerId = input[0].id;
            }

            if (triggerId) {
                console.log('Saving webhook response for ID:', triggerId);
                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'save_webhook_response',
                        triggerId: triggerId,
                        response: {
                            statusCode: code,
                            body: body,
                            headers: headers
                        }
                    })
                });
            }

            // Continue workflow with input data
            resolve({ success: true, output: inputData });
        });
    }
};


NodeDefinitions['schedule-trigger'] = {
    appearance: {
        name: 'Schedule',
        icon: '⏰',
        color: '#f59e0b',
        category: 'trigger',
        section: 'Triggers',
        description: 'Time-based trigger'
    },
    settings: [
        { name: 'mode', label: 'Trigger Mode', type: 'select', options: ['Interval', 'Cron'], default: 'Interval' },
        { name: 'interval', label: 'Interval (minutes)', type: 'number', placeholder: '5', default: '5' },
        { name: 'cron', label: 'Cron Expression', type: 'text', placeholder: '0 9 * * 1-5' },
        { name: 'timezone', label: 'Timezone', type: 'select', options: ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai'], default: 'UTC' }
    ],
    connectors: { hasInput: false, hasOutput: true },
    defaultData: [
        {
            timestamp: new Date().toISOString(),
            trigger: 'schedule',
            schedule: { mode: 'interval', interval: 5 }
        }
    ],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            resolve({
                success: true,
                output: [
                    {
                        timestamp: new Date().toISOString(),
                        trigger: 'schedule',
                        schedule: {
                            mode: config.mode || 'interval',
                            interval: parseInt(config.interval) || 5,
                            cron: config.cron || '',
                            timezone: config.timezone || 'UTC'
                        }
                    }
                ]
            });
        });
    }
};

NodeDefinitions['slack-trigger'] = {
    appearance: {
        name: 'Slack Trigger',
        icon: '💬',
        color: '#4a154b',
        category: 'trigger',
        section: 'Triggers',
        description: 'Trigger on Slack events'
    },
    settings: [
        { name: 'credentialId', label: 'Slack Bot Token', type: 'credential', credentialType: 'slack', required: true },
        { name: 'event', label: 'Trigger On', type: 'select', options: ['New Message', 'Bot/App Mentioned', 'Reaction Added', 'New Public Channel', 'User Joined Channel', 'File Shared'], default: 'New Message' },
        { name: 'channelIds', label: 'Channel IDs (comma-separated, leave empty for all)', type: 'expression', placeholder: 'C1234567890,C0987654321' },
        { name: 'downloadAttachments', label: 'Download Attachments', type: 'select', options: ['No', 'Yes'], default: 'No' }
    ],
    connectors: { hasInput: false, hasOutput: true },
    defaultData: [
        {
            event: 'message',
            channel: 'C1234567890',
            user: 'U1234567890',
            text: 'Hello from Slack!',
            ts: '1234567890.123456',
            timestamp: new Date().toISOString()
        }
    ],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            // In production, this would be triggered by Slack's Event API
            resolve({
                success: true,
                output: [
                    {
                        event: config.event || 'New Message',
                        channel: 'C1234567890',
                        user: 'U1234567890',
                        text: 'Sample Slack message',
                        ts: String(Date.now() / 1000),
                        timestamp: new Date().toISOString(),
                        _triggerType: 'slack'
                    }
                ]
            });
        });
    }
};

NodeDefinitions['email-trigger'] = {
    appearance: {
        name: 'Email Trigger (IMAP)',
        icon: '📨',
        color: '#f59e0b',
        category: 'trigger',
        section: 'Triggers',
        description: 'Trigger on incoming emails'
    },
    settings: [
        { name: 'credentialId', label: 'IMAP Credential', type: 'credential', credentialType: 'imap', required: true },
        { name: 'mailbox', label: 'Mailbox', type: 'text', placeholder: 'INBOX', default: 'INBOX' },
        { name: 'action', label: 'After Processing', type: 'select', options: ['Mark as Read', 'Delete', 'Do Nothing'], default: 'Mark as Read' },
        { name: 'downloadAttachments', label: 'Download Attachments', type: 'select', options: ['No', 'Yes'], default: 'No' },
        { name: 'forceReconnect', label: 'Force Reconnect (mins)', type: 'number', placeholder: '60', default: '60' },
        { name: 'filterBySender', label: 'Filter By Sender (regex)', type: 'expression', placeholder: '.*@example.com' },
        { name: 'filterBySubject', label: 'Filter By Subject (regex)', type: 'expression', placeholder: '.*urgent.*' },
        { name: 'unseen', label: 'Only Unseen Emails', type: 'select', options: ['Yes', 'No'], default: 'Yes' }
    ],
    connectors: { hasInput: false, hasOutput: true },
    defaultData: [
        {
            from: 'sender@example.com',
            to: 'you@example.com',
            subject: 'Test Email',
            body: 'This is a test email body.',
            date: new Date().toISOString(),
            hasAttachments: false
        }
    ],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            // In production, this would poll the IMAP server
            resolve({
                success: true,
                output: [
                    {
                        from: 'sender@example.com',
                        to: 'you@example.com',
                        subject: 'Sample Email',
                        body: 'This is a sample email body for testing.',
                        date: new Date().toISOString(),
                        hasAttachments: false,
                        mailbox: config.mailbox || 'INBOX',
                        _triggerType: 'email'
                    }
                ]
            });
        });
    }
};

NodeDefinitions['form-trigger'] = {
    appearance: {
        name: 'Form Trigger',
        icon: '📋',
        color: '#f59e0b',
        category: 'trigger',
        section: 'Triggers',
        description: 'Trigger when a form is submitted'
    },
    settings: [
        { name: 'formTitle', label: 'Form Title', type: 'text', placeholder: 'Contact Form', default: 'Submit Form' },
        { name: 'formDescription', label: 'Form Description', type: 'expression', placeholder: 'Please fill out this form' },
        { name: 'submitButtonText', label: 'Submit Button Text', type: 'text', placeholder: 'Submit', default: 'Submit' },
        { name: 'responseMode', label: 'Response Mode', type: 'select', options: ['Immediately', 'When Last Node Finishes'], default: 'Immediately' },
        { name: 'formFields', label: 'Form Fields (JSON)', type: 'expression', placeholder: '[{"name":"email","label":"Email","type":"email","required":true},{"name":"message","label":"Message","type":"textarea"}]', default: '[{"name":"email","label":"Email","type":"email","required":true}]' }
    ],
    connectors: { hasInput: false, hasOutput: true },
    defaultData: [
        {
            email: 'user@example.com',
            message: 'Sample message from form',
            submittedAt: new Date().toISOString()
        }
    ],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            resolve({
                success: true,
                output: [
                    {
                        formTitle: config.formTitle || 'Submit Form',
                        email: 'sample@example.com',
                        submittedAt: new Date().toISOString(),
                        _triggerType: 'form'
                    }
                ]
            });
        });
    }
};

NodeDefinitions['x402-payment-webhook'] = {
    appearance: {
        name: 'x402 Payment Webhook',
        icon: '💳',
        color: '#e24d42',
        category: 'trigger',
        section: 'Triggers',
        description: 'Receive x402 crypto payments (USDC/EURC)'
    },
    settings: [
        { name: 'webhookUrl', label: 'Webhook URL', type: 'display', computed: true },
        { name: 'path', label: 'Path', type: 'text', placeholder: 'my-payment-hook', required: true, default: 'pay-hook' },
        { name: 'paymentNetwork', label: 'Payment Network', type: 'select', options: ['Arc Testnet', 'Arc Mainnet', 'Ethereum Mainnet', 'Base Mainnet', 'Polygon Mainnet'], default: 'Arc Testnet' },
        { name: 'acceptedTokens', label: 'Accepted Tokens', type: 'select', options: ['USDC', 'EURC', 'Both'], default: 'USDC' },
        { name: 'requiredAmount', label: 'Required Amount', type: 'number', placeholder: '5.00', required: true },
        { name: 'recipientAddress', label: 'Recipient Address', type: 'text', placeholder: '0x...', required: true },
        { name: 'paymentProtocol', label: 'Protocol', type: 'select', options: ['x402 (Standard)', 'EIP-3009 (Gasless)'], default: 'x402 (Standard)' }
    ],
    connectors: { hasInput: false, hasOutput: true },
    getWebhookUrls: function (config) {
        var host = window.location.host;
        var protocol = window.location.protocol;
        var path = (config.path || 'webhook').replace(/^\/+/, '');
        var isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
        var testUrl = protocol + '//' + host + '/webhook-test/' + path;
        // In production, x402 might allow localhost for testing if tunnelled, but typically needs public URL
        return { test: testUrl, production: protocol + '//' + host + '/webhook/' + path, isLocalhost: isLocalhost, method: 'POST' };
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            // Triggered via webhook usually
            if (inputData && Array.isArray(inputData) && inputData.length > 0) {
                resolve({ success: true, output: normalizeToArray(inputData) });
            } else {
                resolve({
                    success: true, output: [{
                        paymentStatus: 'paid',
                        amount: config.requiredAmount,
                        token: 'USDC',
                        payer: '0x0000000000000000000000000000000000000000',
                        txHash: '0x...'
                    }]
                });
            }
        });
    }
};

// NOTE: arc-blockchain-event is defined in the Arc Network section below (line ~1993)



/* -------------------------------------------------- */
/*      3.2: AI NODES                                 */
/* -------------------------------------------------- */

NodeDefinitions['gemini-ai'] = {
    appearance: {
        name: 'Gemini AI',
        icon: '🤖',
        color: '#3b82f6',
        category: 'ai',
        section: 'AI Models',
        description: 'Google Gemini API with Tool Calling'
    },
    settings: [
        { name: 'credentialId', label: 'API Key', type: 'credential', credentialType: 'gemini', required: true },
        { name: 'model', label: 'Model', type: 'select', options: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'], default: 'gemini-2.5-flash' },
        { name: 'prompt', label: 'Prompt', type: 'expression', placeholder: 'Enter your prompt... Use {{ $json.field }} for dynamic data', required: true },
        { name: 'systemInstruction', label: 'System Instruction', type: 'expression', placeholder: 'You are a helpful assistant...' },
        { name: 'enableToolCalling', label: 'Enable Tool Calling', type: 'select', options: ['Auto (when tools connected)', 'Always On', 'Off'], default: 'Auto (when tools connected)' },
        { name: 'temperature', label: 'Temperature', type: 'number', placeholder: '0.7', default: '0.7' },
        { name: 'maxTokens', label: 'Max Output Tokens', type: 'number', placeholder: '8192', default: '8192' },
        { name: 'topP', label: 'Top P', type: 'number', placeholder: '0.95', default: '0.95' },
        { name: 'topK', label: 'Top K', type: 'number', placeholder: '40', default: '40' }
    ],
    connectors: { hasInput: true, hasOutput: true, hasToolInput: true, hasMemoryInput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'API Key is required.', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            var processedPrompt = processExpression(config.prompt || '', inputData, context);
            if (!processedPrompt || processedPrompt.trim() === '') {
                resolve({ success: false, error: 'Prompt is empty.', errorType: 'VALIDATION_ERROR' });
                return;
            }

            getAIContext(context.nodeId, inputData, context).then(function (aiContext) {
                var useToolCalling = false;
                if (config.enableToolCalling === 'Always On') useToolCalling = true;
                else if (config.enableToolCalling === 'Off') useToolCalling = false;
                else useToolCalling = aiContext.tools.length > 0;

                getCredentialById(config.credentialId, function (cred) {
                    var apiKey = cred ? (typeof cred === 'string' ? cred : (cred.apiKey || (cred.data && cred.data.apiKey))) : null;
                    if (!apiKey) {
                        resolve({ success: false, error: 'Failed to load API key.', errorType: 'CREDENTIAL_ERROR' });
                        return;
                    }

                    if ((useToolCalling && aiContext.tools.length > 0) || aiContext.memory.length > 0) {
                        executeAIWithToolCalling(apiKey, config, inputData, context, aiContext, 'gemini')
                            .then(resolve)
                            .catch(function (err) {
                                resolve({ success: false, error: 'Agent Error: ' + err.message, errorType: 'AGENT_ERROR' });
                            });
                    } else {
                        // Standard Request
                        fetch('nodes1.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'gemini',
                                apiKey: apiKey,
                                model: config.model || 'gemini-1.5-pro',
                                prompt: processedPrompt,
                                systemInstruction: processExpression(config.systemInstruction || '', inputData, context),
                                temperature: parseFloat(config.temperature) || 0.7,
                                maxTokens: parseInt(config.maxTokens) || 2048,
                                aiContext: aiContext
                            })
                        })
                            .then(function (res) { return res.json(); })
                            .then(function (result) {
                                if (result.success) {
                                    resolve({
                                        success: true,
                                        output: [{
                                            text: result.data,
                                            response: result.data,
                                            model: config.model || 'gemini-1.5-pro',
                                            prompt: processedPrompt,
                                            timestamp: new Date().toISOString()
                                        }]
                                    });
                                } else {
                                    resolve({ success: false, error: result.message || 'API request failed' });
                                }
                            })
                            .catch(function (err) {
                                resolve({ success: false, error: 'Network error: ' + err.message });
                            });
                    }
                });
            }).catch(function (err) {
                resolve({ success: false, error: 'Context error: ' + err.message });
            });
        });
    }
};

NodeDefinitions['openai-gpt'] = {
    appearance: {
        name: 'OpenAI GPT',
        icon: '🧠',
        color: '#3b82f6',
        category: 'ai',
        section: 'AI Models',
        description: 'ChatGPT & GPT-4 Models'
    },
    settings: [
        { name: 'credentialId', label: 'API Key', type: 'credential', credentialType: 'openai', required: true },
        { name: 'model', label: 'Model', type: 'select', options: ['o3', 'o3-mini', 'o1', 'gpt-4o', 'gpt-4o-mini'], default: 'gpt-4o' },
        { name: 'systemPrompt', label: 'System Message', type: 'expression', placeholder: 'You are a helpful assistant...' },
        { name: 'prompt', label: 'User Message', type: 'expression', placeholder: 'Enter your message...', required: true },
        { name: 'temperature', label: 'Temperature', type: 'number', placeholder: '0.7', default: '0.7' },
        { name: 'maxTokens', label: 'Max Tokens', type: 'number', placeholder: '2048', default: '2048' },
        { name: 'reasoning_effort', label: 'Reasoning Effort (o1 models)', type: 'select', options: ['low', 'medium', 'high'], default: 'medium' }
    ],
    connectors: { hasInput: true, hasOutput: true, hasToolInput: true, hasMemoryInput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'API Key is required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            var processedPrompt = processExpression(config.prompt || '', inputData, context);
            if (!processedPrompt || processedPrompt.trim() === '') {
                resolve({ success: false, error: 'User message is required', errorType: 'VALIDATION_ERROR' });
                return;
            }

            getAIContext(context.nodeId, inputData, context).then(function (aiContext) {
                getCredentialById(config.credentialId, function (cred) {
                    var apiKey = cred ? (typeof cred === 'string' ? cred : (cred.apiKey || (cred.data && cred.data.apiKey))) : null;
                    if (!apiKey) {
                        resolve({ success: false, error: 'Failed to load API key', errorType: 'CREDENTIAL_ERROR' });
                        return;
                    }
                    if (!config.model) config.model = 'gpt-4o';

                    var useToolCalling = aiContext.tools.length > 0;
                    if (useToolCalling || aiContext.memory.length > 0) {
                        executeAIWithToolCalling(apiKey, config, inputData, context, aiContext, 'openai')
                            .then(resolve)
                            .catch(function (err) {
                                resolve({ success: false, error: 'Agent Error: ' + err.message, errorType: 'AGENT_ERROR' });
                            });
                    } else {
                        // Standard Request
                        fetch('nodes1.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'openai',
                                apiKey: apiKey,
                                model: config.model || 'gpt-4o',
                                prompt: processedPrompt,
                                systemInstruction: processExpression(config.systemPrompt || '', inputData, context),
                                temperature: parseFloat(config.temperature) || 0.7,
                                maxTokens: parseInt(config.maxTokens) || 2048,
                                aiContext: aiContext
                            })
                        })
                            .then(function (res) { return res.json(); })
                            .then(function (result) {
                                if (result.success) {
                                    resolve({
                                        success: true,
                                        output: [{
                                            text: result.data,
                                            response: result.data,
                                            model: config.model || 'gpt-4o',
                                            prompt: processedPrompt,
                                            timestamp: new Date().toISOString()
                                        }]
                                    });
                                } else {
                                    resolve({ success: false, error: result.message || 'API request failed' });
                                }
                            })
                            .catch(function (err) {
                                resolve({ success: false, error: 'Network error: ' + err.message });
                            });
                    }
                });
            }).catch(function (err) {
                resolve({ success: false, error: 'Context error: ' + err.message });
            });
        });
    }
};

NodeDefinitions['claude-ai'] = {
    appearance: {
        name: 'Claude AI',
        icon: '💭',
        color: '#3b82f6',
        category: 'ai',
        section: 'AI Models',
        description: 'Anthropic Claude API with Tool Calling'
    },
    settings: [
        { name: 'credentialId', label: 'API Key', type: 'credential', credentialType: 'anthropic', required: true },
        { name: 'model', label: 'Model', type: 'select', options: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251124', 'claude-haiku-4-5-20251015', 'claude-3-5-sonnet-20241022'], default: 'claude-sonnet-4-5-20250929' },
        { name: 'prompt', label: 'Prompt', type: 'expression', placeholder: 'Enter your prompt...', required: true },
        { name: 'systemInstruction', label: 'System Instruction', type: 'expression', placeholder: 'You are a helpful assistant...' },
        { name: 'temperature', label: 'Temperature', type: 'number', placeholder: '0.7', default: '0.7' },
        { name: 'maxTokens', label: 'Max Output Tokens', type: 'number', placeholder: '4096', default: '4096' }
    ],
    connectors: { hasInput: true, hasOutput: true, hasToolInput: true, hasMemoryInput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'API Key is required.', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            var processedPrompt = processExpression(config.prompt || '', inputData, context);
            if (!processedPrompt || processedPrompt.trim() === '') {
                resolve({ success: false, error: 'Prompt is empty.', errorType: 'VALIDATION_ERROR' });
                return;
            }

            getAIContext(context.nodeId, inputData, context).then(function (aiContext) {
                getCredentialById(config.credentialId, function (cred) {
                    var apiKey = cred ? (typeof cred === 'string' ? cred : (cred.apiKey || (cred.data && cred.data.apiKey))) : null;
                    if (!apiKey) {
                        resolve({ success: false, error: 'Failed to load API key.', errorType: 'CREDENTIAL_ERROR' });
                        return;
                    }

                    var useToolCalling = aiContext.tools.length > 0;
                    if (useToolCalling || aiContext.memory.length > 0) {
                        executeAIWithToolCalling(apiKey, config, inputData, context, aiContext, 'claude')
                            .then(resolve)
                            .catch(function (err) {
                                resolve({ success: false, error: 'Agent Error: ' + err.message, errorType: 'AGENT_ERROR' });
                            });
                    } else {
                        // Standard Request
                        fetch('nodes1.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'claude',
                                apiKey: apiKey,
                                model: config.model || 'claude-3-5-sonnet',
                                prompt: processedPrompt,
                                systemInstruction: processExpression(config.systemPrompt || '', inputData, context),
                                temperature: parseFloat(config.temperature) || 0.7,
                                maxTokens: parseInt(config.maxTokens) || 2048,
                                aiContext: aiContext
                            })
                        })
                            .then(function (res) { return res.json(); })
                            .then(function (result) {
                                if (result.success) {
                                    resolve({
                                        success: true,
                                        output: [{
                                            text: result.data,
                                            response: result.data,
                                            model: config.model || 'claude-3-5-sonnet',
                                            prompt: processedPrompt,
                                            timestamp: new Date().toISOString()
                                        }]
                                    });
                                } else {
                                    resolve({ success: false, error: result.message || 'API request failed' });
                                }
                            })
                            .catch(function (err) {
                                resolve({ success: false, error: 'Network error: ' + err.message });
                            });
                    }
                });
            }).catch(function (err) {
                resolve({ success: false, error: 'Context error: ' + err.message });
            });
        });
    }
};


/* -------------------------------------------------- */
/*      3.2.5: ARC NETWORK NODES                      */
/*      Circle + Arc Blockchain Integration           */
/* -------------------------------------------------- */

NodeDefinitions['x402-webhook'] = {
    appearance: {
        name: 'x402 Payment Webhook',
        icon: '💳',
        color: '#00D395',
        category: 'trigger',
        section: 'Arc Network',
        description: 'Receive x402 payment requests from AI agents'
    },
    settings: [
        { name: 'webhookUrl', label: 'Webhook URL', type: 'display', computed: true },
        { name: 'path', label: 'Path', type: 'text', placeholder: 'x402-payment', default: 'x402-payment-' + Math.random().toString(36).substring(2, 8) },
        { name: 'acceptedToken', label: 'Accepted Token', type: 'select', options: ['USDC', 'EURC', 'Any'], default: 'USDC' },
        { name: 'paymentNetwork', label: 'Network', type: 'select', options: ['Arc Testnet', 'Arc Mainnet', 'Base', 'Ethereum', 'Polygon'], default: 'Arc Testnet' },
        { name: 'requiredAmount', label: 'Required Amount', type: 'expression', placeholder: '0.01', default: '0.01' },
        { name: 'paymentDescription', label: 'Payment Description', type: 'expression', placeholder: 'API access fee' },
        { name: 'verifyPayment', label: 'Verify EIP-3009 Signature', type: 'select', options: ['Yes', 'No'], default: 'Yes' },
        { name: 'recipientAddress', label: 'Recipient Wallet Address', type: 'expression', required: true }
    ],
    connectors: { hasInput: false, hasOutput: true },
    getWebhookUrl: function (config) {
        var host = window.location.host;
        var protocol = window.location.protocol;
        var path = (config.path || 'x402-payment').replace(/^\/+/, '');
        return protocol + '//' + host + '/webhook/' + path;
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (inputData && (Array.isArray(inputData) ? inputData.length > 0 : !!inputData)) {
                // Real webhook data received
                resolve({ success: true, output: normalizeToArray(inputData) });
            } else {
                // Manual trigger - return sample x402 payment request
                resolve({
                    success: true,
                    output: [{
                        x402Version: '1',
                        paymentRequired: true,
                        paymentInfo: {
                            scheme: 'exact',
                            network: config.paymentNetwork || 'Arc Testnet',
                            maxAmountRequired: config.requiredAmount || '0.01',
                            resource: config.path,
                            description: config.paymentDescription || 'API access fee',
                            mimeType: 'application/json',
                            payTo: config.recipientAddress,
                            maxTimeoutSeconds: 300,
                            asset: config.acceptedToken === 'EURC' ? 'EURC' : 'USDC'
                        },
                        timestamp: new Date().toISOString(),
                        _triggerType: 'x402'
                    }]
                });
            }
        });
    }
};

NodeDefinitions['arc-blockchain-event'] = {
    appearance: {
        name: 'Arc Blockchain Event',
        icon: '⛓️',
        color: '#00D395',
        category: 'trigger',
        section: 'Arc Network',
        description: 'Monitor Arc blockchain events'
    },
    settings: [
        { name: 'eventType', label: 'Event Type', type: 'select', options: ['USDC Transfer', 'Contract Event', 'New Block', 'Wallet Activity'], default: 'USDC Transfer' },
        { name: 'network', label: 'Network', type: 'select', options: ['Arc Testnet', 'Arc Mainnet'], default: 'Arc Testnet' },
        { name: 'contractAddress', label: 'Contract Address (for Contract Event)', type: 'expression', placeholder: '0x...' },
        { name: 'watchAddress', label: 'Watch Address (for Wallet Activity)', type: 'expression', placeholder: '0x...' },
        { name: 'minAmount', label: 'Min Amount (for USDC Transfer)', type: 'expression', placeholder: '0' },
        { name: 'pollingInterval', label: 'Polling Interval (seconds)', type: 'number', default: '30' }
    ],
    connectors: { hasInput: false, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            // Sample Arc blockchain event
            resolve({
                success: true,
                output: [{
                    eventType: config.eventType || 'USDC Transfer',
                    network: config.network || 'Arc Testnet',
                    blockNumber: 1234567,
                    transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
                    from: '0x' + Math.random().toString(16).substring(2, 42),
                    to: config.watchAddress || '0x' + Math.random().toString(16).substring(2, 42),
                    amount: '10.00',
                    token: 'USDC',
                    timestamp: new Date().toISOString(),
                    _triggerType: 'arc_blockchain'
                }]
            });
        });
    }
};

NodeDefinitions['circle-gateway'] = {
    appearance: {
        name: 'Circle Gateway',
        icon: '🌉',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Cross-chain USDC Transfer (CCTP). Use this tool to send USDC between different blockchains supported by Circle.'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Transfer USDC (CCTP)', 'Check Transfer Status', 'Get Deposit Address'], default: 'Transfer USDC (CCTP)' },
        { name: 'amount', label: 'Amount (USDC)', type: 'expression', placeholder: '10.00' },
        { name: 'sourceChain', label: 'Source Chain', type: 'select', options: ['ETH', 'AVAX', 'OP', 'ARB', 'BASE', 'SOL'], default: 'ETH' },
        { name: 'destinationChain', label: 'Destination Chain', type: 'select', options: ['ETH', 'AVAX', 'OP', 'ARB', 'BASE', 'SOL'], default: 'BASE' },
        { name: 'destinationAddress', label: 'Destination Wallet Address', type: 'expression', placeholder: '0x...', required: true },
        { name: 'messageBytes', label: 'Message Bytes (for Status)', type: 'expression', placeholder: 'Hex string from transfer...' },
        { name: 'messageHash', label: 'Message Hash (for Status)', type: 'expression', placeholder: '0x...' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var operation = config.operation || 'Transfer USDC (CCTP)';

            // Evaluate expressions, prioritize tool arguments from AI
            var toolArgs = (inputData && inputData[0]) || {};
            var evalConfig = Object.assign({}, config);
            ['amount', 'destinationAddress', 'messageBytes', 'messageHash', 'sourceChain', 'destinationChain'].forEach(function (k) {
                evalConfig[k] = (toolArgs[k] !== undefined) ? toolArgs[k] : (config[k] ? processExpression(config[k], inputData, context) : '');
            });

            // Call backend
            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'circle_gateway',
                    operation: operation,
                    config: evalConfig,
                    input: normalizeToArray(inputData)
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) {
                        resolve({ success: true, output: normalizeToArray(result.data) });
                    } else {
                        resolve({ success: false, error: result.message || 'Circle CCTP error', errorType: 'API_ERROR' });
                    }
                })
                .catch(function (err) {
                    resolve({ success: false, error: 'Network error: ' + err.message, errorType: 'NETWORK_ERROR' });
                });
        });
    }
};

NodeDefinitions['circle-wallet'] = {
    appearance: {
        name: 'Circle Wallet',
        icon: '👛',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Create & manage Circle Programmable Wallets'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Create Wallet', 'Get Balance', 'Send Transfer', 'Get Transaction History'], default: 'Get Balance' },
        { name: 'blockchain', label: 'Blockchain', type: 'select', options: ['ETH-SEPOLIA', 'ETH-MAINNET', 'BASE-SEPOLIA', 'BASE-MAINNET', 'MATIC-AMOY', 'MATIC-MAINNET', 'ARC-TESTNET'], default: 'ETH-SEPOLIA' },
        { name: 'walletId', label: 'Wallet ID', type: 'expression', placeholder: 'c6f3... (UUID for balance/history)' },
        { name: 'entitySecretCiphertext', label: 'Entity Secret Ciphertext', type: 'expression', placeholder: 'Required for Create/Send...' },
        { name: 'walletSetId', label: 'Wallet Set ID (Optional)', type: 'expression', placeholder: 'UUID' },
        { name: 'tokenId', label: 'Token ID (UUID)', type: 'expression', placeholder: 'e.g. USDC Token UUID', default: '' },
        { name: 'destinationAddress', label: 'Destination Address', type: 'expression', placeholder: '0x...' },
        { name: 'amount', label: 'Amount', type: 'expression', placeholder: '1.00' },
        { name: 'idempotencyKey', label: 'Idempotency Key', type: 'expression', placeholder: 'Auto-generated if empty' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            // Evaluate expressions, prioritize tool arguments from AI
            var toolArgs = (inputData && inputData[0]) || {};
            var evalConfig = Object.assign({}, config);
            ['walletId', 'entitySecretCiphertext', 'walletSetId', 'tokenId', 'destinationAddress', 'amount', 'idempotencyKey', 'blockchain'].forEach(function (k) {
                evalConfig[k] = (toolArgs[k] !== undefined) ? toolArgs[k] : (config[k] ? processExpression(config[k], inputData, context) : '');
            });

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'circle_wallet',
                    operation: config.operation || 'Get Balance',
                    config: evalConfig,
                    input: normalizeToArray(inputData)
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) {
                        resolve({ success: true, output: normalizeToArray(result.data) });
                    } else {
                        resolve({ success: false, error: result.message || 'Circle Wallet error', errorType: 'API_ERROR' });
                    }
                })
                .catch(function (err) {
                    resolve({ success: false, error: 'Network error: ' + err.message, errorType: 'NETWORK_ERROR' });
                });
        });
    }
};

NodeDefinitions['arc-usdc-transfer'] = {
    appearance: {
        name: 'Arc USDC Transfer',
        icon: '💵',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Transfer native USDC on the Arc Network. Use this tool for fast, low-cost payments within the Arc ecosystem.'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential (WaaS)', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'walletId', label: 'From Wallet ID', type: 'expression', placeholder: 'Circle Wallet UUID', required: true },
        { name: 'network', label: 'Network', type: 'select', options: ['ARC-TESTNET', 'ARC-MAINNET'], default: 'ARC-TESTNET' },
        { name: 'toAddress', label: 'To Address', type: 'expression', placeholder: '0x...', required: true },
        { name: 'amount', label: 'Amount (USDC)', type: 'expression', placeholder: '10.00', required: true },
        { name: 'tokenId', label: 'Token ID (Contract)', type: 'expression', placeholder: '0x3600000000000000000000000000000000000000', default: '0x3600000000000000000000000000000000000000' },
        { name: 'memo', label: 'Memo / Note', type: 'expression', placeholder: 'Payment for...' },
        { name: 'gasless', label: 'Gasless (USDC pays gas)', type: 'select', options: ['Yes', 'No'], default: 'Yes' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            // Evaluate expressions, prioritize tool arguments from AI
            var toolArgs = (inputData && inputData[0]) || {};
            var evalConfig = Object.assign({}, config);
            ['toAddress', 'amount', 'memo', 'walletId', 'network', 'tokenId'].forEach(function (k) {
                evalConfig[k] = (toolArgs[k] !== undefined) ? toolArgs[k] : (config[k] ? processExpression(config[k], inputData, context) : '');
            });

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'arc_usdc_transfer',
                    config: evalConfig,
                    input: normalizeToArray(inputData)
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) {
                        resolve({ success: true, output: normalizeToArray(result.data) });
                    } else {
                        resolve({ success: false, error: result.message || 'Arc transfer error', errorType: 'API_ERROR' });
                    }
                })
                .catch(function (err) {
                    resolve({ success: false, error: 'Network error: ' + err.message, errorType: 'NETWORK_ERROR' });
                });
        });
    }
};

NodeDefinitions['arc-balance-tool'] = {
    appearance: {
        name: 'Check Arc Balance',
        icon: '💰',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Check USDC/ETH balance (Tool)'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'walletId', label: 'Wallet ID (UUID)', type: 'expression', placeholder: 'c6f3...', required: true }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var payload = Object.assign({}, config, { operation: 'Get Balance' });

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'circle_gateway',
                    config: payload,
                    operation: 'Get Balance'
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) resolve({ success: true, output: normalizeToArray(result.data) });
                    else resolve({ success: false, error: result.message });
                })
                .catch(function (err) { resolve({ success: false, error: err.message }); });
        });
    }
};

NodeDefinitions['arc-contract'] = {
    appearance: {
        name: 'Arc Smart Contract',
        icon: '📜',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Execute read/write functions on any Arc Smart Contract. Use this tool to interact with dApps or query custom contract state.'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential', type: 'credential', credentialType: 'circle_developer' },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Read Contract', 'Write Contract', 'Execute Transaction', 'Deploy Contract (Template)'], default: 'Read Contract' },
        { name: 'rpcUrl', label: 'RPC URL', type: 'expression', placeholder: 'https://...', default: 'https://rpc.testnet.arc.network' },
        { name: 'contractAddress', label: 'Contract Address', type: 'expression', placeholder: '0x...' },
        // Deploy Template Fields
        { name: 'templateId', label: 'Template ID (for Deploy)', type: 'expression', placeholder: 'UUID' },
        { name: 'templateName', label: 'Contract Name (for Deploy)', type: 'text', placeholder: 'MyToken' },
        { name: 'templateParams', label: 'Template Params (JSON)', type: 'expression', placeholder: '{"name": "MyToken", "defaultAdmin": "0x..."}' },
        { name: 'walletId', label: 'Wallet ID (for Write/Deploy)', type: 'expression', placeholder: 'Circle Wallet UUID' },
        { name: 'entitySecretCiphertext', label: 'Entity Secret Ciphertext (for Write/Deploy)', type: 'expression', placeholder: 'Base64 string' },

        { name: 'abi', label: 'Contract ABI (JSON)', type: 'expression', placeholder: '[{"name":"balanceOf","type":"function",...}]' },
        { name: 'functionName', label: 'Function Name', type: 'expression', placeholder: 'balanceOf' },
        { name: 'functionArgs', label: 'Function Arguments (JSON array)', type: 'expression', placeholder: '["0x..."]' },
        { name: 'network', label: 'Network', type: 'select', options: ['ARC-TESTNET', 'ARC-MAINNET'], default: 'ARC-TESTNET' },
        { name: 'value', label: 'Value (for payable functions)', type: 'expression', placeholder: '0' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            // Evaluate expressions, prioritize tool arguments from AI
            var toolArgs = (inputData && inputData[0]) || {};
            var evalConfig = Object.assign({}, config);
            ['contractAddress', 'abi', 'functionName', 'functionArgs', 'value', 'rpcUrl', 'templateId', 'templateName', 'templateParams', 'walletId', 'entitySecretCiphertext'].forEach(function (k) {
                evalConfig[k] = (toolArgs[k] !== undefined) ? toolArgs[k] : (config[k] ? processExpression(config[k], inputData, context) : '');
            });

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'arc_contract',
                    config: evalConfig,
                    input: normalizeToArray(inputData)
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) {
                        resolve({ success: true, output: normalizeToArray(result.data) });
                    } else {
                        resolve({ success: false, error: result.message || 'Contract interaction failed', errorType: 'API_ERROR' });
                    }
                })
                .catch(function (err) {
                    resolve({ success: false, error: 'Network error: ' + err.message, errorType: 'NETWORK_ERROR' });
                });
        });
    }
};

NodeDefinitions['arc-fx-swap'] = {
    appearance: {
        name: 'Arc FX Swap',
        icon: '💱',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Currency swap via Arc FX Engine'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'fromCurrency', label: 'From Currency', type: 'select', options: ['USDC', 'EURC', 'USDT'], default: 'USDC' },
        { name: 'toCurrency', label: 'To Currency', type: 'select', options: ['USDC', 'EURC', 'USDT'], default: 'EURC' },
        { name: 'amount', label: 'Amount', type: 'expression', placeholder: '100.00', required: true },
        { name: 'slippage', label: 'Max Slippage (%)', type: 'number', placeholder: '0.5', default: '0.5' },
        { name: 'network', label: 'Network', type: 'select', options: ['ARC-TESTNET', 'ARC-MAINNET'], default: 'ARC-TESTNET' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'arc_fx_swap',
                    config: config,
                    input: normalizeToArray(inputData)
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) {
                        resolve({ success: true, output: normalizeToArray(result.data) });
                    } else {
                        resolve({ success: false, error: result.message || 'FX Swap failed', errorType: 'API_ERROR' });
                    }
                })
                .catch(function (err) {
                    resolve({ success: false, error: 'Network error: ' + err.message, errorType: 'NETWORK_ERROR' });
                });
        });
    }
};

NodeDefinitions['arc-scan'] = {
    appearance: {
        name: 'ArcScan Explorer',
        icon: '🔍',
        color: '#F0B90B',
        category: 'arc',
        section: 'Arc Network',
        description: 'Fetch data from ArcScan (Blockscout)'
    },
    settings: [
        { name: 'credentialId', label: 'ArcScan API Key', type: 'credential', credentialType: 'arcscan', required: true },
        { name: 'module', label: 'Module', type: 'select', options: ['account', 'contract', 'transaction', 'block', 'stats'], default: 'account' },
        { name: 'action', label: 'Action', type: 'select', options: ['balance', 'txlist', 'getabi', 'getsourcecode', 'eth_getTransactionByHash'], default: 'balance' },
        { name: 'address', label: 'Address', type: 'expression', placeholder: '0x...' },
        { name: 'txhash', label: 'Transaction Hash', type: 'expression', placeholder: '0x...' },
        { name: 'network', label: 'Network', type: 'select', options: ['ARC-TESTNET', 'ARC-MAINNET'], default: 'ARC-TESTNET' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            // Evaluate expressions, prioritize tool arguments from AI
            // ... (rest of arc-scan execute) ...
            var toolArgs = (inputData && inputData[0]) || {};
            var evalConfig = Object.assign({}, config);
            ['address', 'txhash', 'module', 'action'].forEach(function (k) {
                evalConfig[k] = (toolArgs[k] !== undefined) ? toolArgs[k] : (config[k] ? processExpression(config[k], inputData, context) : '');
            });

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'arc_scan',
                    config: evalConfig,
                    input: normalizeToArray(inputData)
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) resolve({ success: true, output: normalizeToArray(result.data) });
                    else resolve({ success: false, error: result.message });
                })
                .catch(function (err) { resolve({ success: false, error: err.message }); });
        });
    }
};

NodeDefinitions['circle-balance'] = {
    appearance: {
        name: 'Circle Balance',
        icon: '💰',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Check Programmable Wallet Balances'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'walletId', label: 'Wallet ID', type: 'expression', placeholder: 'Enter Wallet ID', required: true },
        { name: 'includeAll', label: 'Include All Tokens', type: 'boolean', default: true }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) { resolve({ success: true, output: getPinnedOutput(context.nodeId) }); return; }
            var evalConfig = Object.assign({}, config);
            if (config.walletId) evalConfig.walletId = processExpression(config.walletId, inputData, context);
            fetch('nodes1.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'circle_balance', config: evalConfig, input: normalizeToArray(inputData) })
            }).then(r => r.json()).then(res => resolve({ success: res.success, output: res.success ? normalizeToArray(res.data) : [], error: res.message })).catch(e => resolve({ success: false, error: e.message }));
        });
    }
};

NodeDefinitions['circle-transactions'] = {
    appearance: {
        name: 'Circle Transactions',
        icon: '📜',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Get Wallet Transaction History'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Credential', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'walletId', label: 'Wallet ID', type: 'expression', placeholder: 'Optional filter' },
        { name: 'blockchain', label: 'Blockchain', type: 'select', options: ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA'], default: 'ARC-TESTNET' },
        { name: 'pageSize', label: 'Limit', type: 'number', default: 10 }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) { resolve({ success: true, output: getPinnedOutput(context.nodeId) }); return; }
            var evalConfig = Object.assign({}, config);
            if (config.walletId) evalConfig.walletId = processExpression(config.walletId, inputData, context);
            fetch('nodes1.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'circle_transactions', config: evalConfig, input: normalizeToArray(inputData) })
            }).then(r => r.json()).then(res => resolve({ success: res.success, output: res.success ? normalizeToArray(res.data) : [], error: res.message })).catch(e => resolve({ success: false, error: e.message }));
        });
    }
};

NodeDefinitions['arc-rpc'] = {
    appearance: {
        name: 'Arc Generic RPC',
        icon: '⚡',
        color: '#F0B90B',
        category: 'arc',
        section: 'Arc Network',
        description: 'Execute Any JSON-RPC Method'
    },
    settings: [
        { name: 'method', label: 'RPC Method', type: 'text', placeholder: 'eth_getBalance', default: 'eth_getBalance' },
        { name: 'params', label: 'Params (JSON Array)', type: 'expression', placeholder: '["0x...", "latest"]' },
        { name: 'network', label: 'Network', type: 'select', options: ['ARC-TESTNET', 'ARC-MAINNET'], default: 'ARC-TESTNET' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) { resolve({ success: true, output: getPinnedOutput(context.nodeId) }); return; }
            var evalConfig = Object.assign({}, config);
            if (config.params) evalConfig.params = processExpression(config.params, inputData, context);
            fetch('nodes1.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'arc_rpc_call', config: evalConfig, input: normalizeToArray(inputData) })
            }).then(r => r.json()).then(res => resolve({ success: res.success, output: res.success ? normalizeToArray(res.data) : [], error: res.message })).catch(e => resolve({ success: false, error: e.message }));
        });
    }
};

NodeDefinitions['circle-gas-station'] = {
    appearance: {
        name: 'Circle Gas Station',
        icon: '⛽',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Sponsor gas fees for Arc transactions'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Sponsor Transaction', 'Get Gas Tank', 'Estimate Fee Sponsorship'], default: 'Sponsor Transaction' },
        { name: 'userToken', label: 'User Token (WaaS)', type: 'expression', placeholder: 'For user-controlled wallets' },
        { name: 'transactionData', label: 'Transaction Data (JSON)', type: 'expression', placeholder: '{"to": "0x...", "data": "0x..."}' },
        { name: 'blockchain', label: 'Blockchain', type: 'select', options: ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA'], default: 'ARC-TESTNET' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var evalConfig = Object.assign({}, config);
            ['userToken', 'transactionData'].forEach(function (k) {
                if (config[k]) evalConfig[k] = processExpression(config[k], inputData, context);
            });

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'circle_gas_station',
                    config: evalConfig,
                    input: normalizeToArray(inputData)
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) resolve({ success: true, output: normalizeToArray(result.data) });
                    else resolve({ success: false, error: result.message });
                })
                .catch(function (err) { resolve({ success: false, error: err.message }); });
        });
    }
};

NodeDefinitions['circle-cctp'] = {
    appearance: {
        name: 'Circle CCTP',
        icon: '🌉',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Cross-Chain Transfer Protocol (USDC Bridging)'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Deposit For Burn', 'Fetch Attestation (V2)', 'Receive Message'], default: 'Deposit For Burn' },
        { name: 'sourceBlockchain', label: 'Source Blockchain', type: 'select', options: ['ARC-TESTNET', 'ETH-SEPOLIA', 'BASE-SEPOLIA', 'AVALANCHE-FUJI'], default: 'ARC-TESTNET' },
        { name: 'destinationBlockchain', label: 'Destination Blockchain', type: 'select', options: ['ETH-SEPOLIA', 'BASE-SEPOLIA', 'AVALANCHE-FUJI', 'ARC-TESTNET'], default: 'ETH-SEPOLIA' },
        { name: 'amount', label: 'Amount', type: 'expression', placeholder: '10.0' },
        { name: 'destinationAddress', label: 'Destination Wallet Address', type: 'expression', placeholder: '0x...' },
        { name: 'txHash', label: 'Transaction Hash (txHash)', type: 'expression', placeholder: '0x...' },
        { name: 'attestation', label: 'Attestation (for Receive)', type: 'expression', placeholder: '0x...' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var evalConfig = Object.assign({}, config);
            ['amount', 'destinationAddress', 'txHash', 'attestation'].forEach(function (k) {
                if (config[k]) evalConfig[k] = processExpression(config[k], inputData, context);
            });

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'circle_cctp',
                    config: evalConfig,
                    input: normalizeToArray(inputData)
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) resolve({ success: true, output: normalizeToArray(result.data) });
                    else resolve({ success: false, error: result.message });
                })
                .catch(function (err) { resolve({ success: false, error: err.message }); });
        });
    }
};

NodeDefinitions['arc-cctp-transfer'] = {
    appearance: {
        name: 'Arc CCTP Transfer',
        icon: '🌉',
        color: '#00D395',
        category: 'arc',
        section: 'Arc Network',
        description: 'Cross-Chain USDC Transfer via Circle CCTP (Mint/Burn) for automated commerce.'
    },
    settings: [
        { name: 'credentialId', label: 'Circle Developer Credential', type: 'credential', credentialType: 'circle_developer', required: true },
        { name: 'walletId', label: 'Source Wallet ID', type: 'expression', placeholder: 'c6f3...', required: true },
        { name: 'amount', label: 'Amount (USDC)', type: 'expression', placeholder: '100.00', required: true },
        { name: 'destinationChain', label: 'Destination Chain', type: 'select', options: ['ETH', 'AVAX', 'SOL'], default: 'ETH' },
        { name: 'destinationAddress', label: 'Destination Address', type: 'expression', placeholder: '0x...', required: true }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var evalConfig = Object.assign({}, config);
            ['walletId', 'amount', 'destinationAddress'].forEach(function (k) {
                if (config[k]) evalConfig[k] = processExpression(config[k], inputData, context);
            });

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'circle_gateway',
                    config: evalConfig,
                    operation: 'Transfer USDC (CCTP)'
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) resolve({ success: true, output: normalizeToArray(result.data) });
                    else resolve({ success: false, error: result.message });
                })
                .catch(function (err) { resolve({ success: false, error: err.message }); });
        });
    }
};


/* -------------------------------------------------- */
/*      3.3: HTTP & ACTION NODES                      */
/* -------------------------------------------------- */

NodeDefinitions['http-request'] = {
    appearance: {
        name: 'HTTP Request',
        icon: '🌐',
        color: '#10b981',
        category: 'action',
        section: 'Actions',
        description: 'Make HTTP/API requests'
    },
    settings: [
        { name: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'], default: 'GET' },
        { name: 'url', label: 'URL', type: 'expression', placeholder: 'https://api.example.com/endpoint', required: true },
        { name: 'authentication', label: 'Authentication', type: 'select', options: ['None', 'Predefined Credential', 'Header Auth', 'Basic Auth', 'Bearer Token', 'Query Auth', 'Digest Auth', 'OAuth2'], default: 'None' },
        { name: 'credentialId', label: 'Credential', type: 'credential', credentialType: 'http-header' },
        { name: 'headerAuthName', label: 'Header Name (for Header Auth)', type: 'text', placeholder: 'X-API-Key' },
        { name: 'headerAuthValue', label: 'Header Value (for Header Auth)', type: 'expression', placeholder: 'your-api-key' },
        { name: 'basicAuthUser', label: 'Username (for Basic Auth)', type: 'expression', placeholder: 'username' },
        { name: 'basicAuthPass', label: 'Password (for Basic Auth)', type: 'expression', placeholder: 'password' },
        { name: 'bearerToken', label: 'Bearer Token', type: 'expression', placeholder: 'your-bearer-token' },
        { name: 'queryAuthName', label: 'Query Param Name (for Query Auth)', type: 'text', placeholder: 'api_key' },
        { name: 'queryAuthValue', label: 'Query Param Value (for Query Auth)', type: 'expression', placeholder: 'your-api-key' },
        { name: 'sendHeaders', label: 'Send Headers', type: 'select', options: ['No', 'Yes'], default: 'No' },
        { name: 'headers', label: 'Headers (JSON)', type: 'expression', placeholder: '{"Content-Type": "application/json", "Authorization": "Bearer {{$json.token}}"}' },
        { name: 'sendQueryParams', label: 'Send Query Parameters', type: 'select', options: ['No', 'Yes'], default: 'No' },
        { name: 'queryParams', label: 'Query Parameters (JSON)', type: 'expression', placeholder: '{"page": 1, "limit": 10}' },
        { name: 'sendBody', label: 'Send Body', type: 'select', options: ['No', 'Yes'], default: 'No' },
        { name: 'bodyContentType', label: 'Body Content Type', type: 'select', options: ['JSON', 'Form URL Encoded', 'Form Data', 'Raw'], default: 'JSON' },
        { name: 'body', label: 'Request Body', type: 'expression', placeholder: '{"key": "{{$json.value}}"}' },
        { name: 'responseType', label: 'Response Type', type: 'select', options: ['Autodetect', 'JSON', 'Text', 'Binary'], default: 'Autodetect' },
        { name: 'timeout', label: 'Timeout (ms)', type: 'number', placeholder: '10000', default: '10000' },
        { name: 'followRedirects', label: 'Follow Redirects', type: 'select', options: ['Yes', 'No'], default: 'Yes' },
        { name: 'ignoreSSL', label: 'Ignore SSL Issues', type: 'select', options: ['No', 'Yes'], default: 'No' },
        { name: 'splitIntoItems', label: 'Split Response Into Items', type: 'select', options: ['No', 'Yes'], default: 'No' },
        { name: 'continueOnFail', label: 'Continue On Fail', type: 'select', options: ['No', 'Yes'], default: 'No' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var processedUrl = processExpression(config.url || '', inputData, context);

            if (!processedUrl || processedUrl.trim() === '') {
                resolve({ success: false, error: 'URL is required', errorType: 'VALIDATION_ERROR' });
                return;
            }

            // Validate URL format
            if (!processedUrl.match(/^https?:\/\/.+/)) {
                resolve({ success: false, error: 'Invalid URL format. Must start with http:// or https://', errorType: 'VALIDATION_ERROR' });
                return;
            }

            var processedHeaders = processExpression(config.headers || '{}', inputData, context);
            var processedBody = processExpression(config.body || '', inputData, context);

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'http_request',
                    url: processedUrl,
                    method: config.method || 'GET',
                    headers: processedHeaders,
                    body: processedBody
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) {
                        var output = result.data;
                        // Wrap in array if not already
                        if (!Array.isArray(output)) {
                            output = [output];
                        }
                        resolve({ success: true, output: output });
                    } else {
                        resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                    }
                })
                .catch(function (err) {
                    resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                });
        });
    }
};


/* -------------------------------------------------- */
/*      3.4: DATA TRANSFORMATION NODES                */
/* -------------------------------------------------- */

NodeDefinitions['set-data'] = {
    appearance: {
        name: 'Set',
        icon: '📝',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Set or transform data fields'
    },
    settings: [
        { name: 'mode', label: 'Mode', type: 'select', options: ['Manual Mapping', 'JSON'], default: 'JSON' },
        { name: 'data', label: 'Data (JSON with expressions)', type: 'expression', placeholder: '{\n  "name": "{{ $json.firstName }} {{ $json.lastName }}",\n  "processed": true\n}' },
        { name: 'keepOnlySet', label: 'Keep Only Set Fields', type: 'select', options: ['No (Merge)', 'Yes (Replace)'], default: 'No (Merge)' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            try {
                var dataStr = config.data || '{}';
                var processed = processExpression(dataStr, inputData, context);

                if (processed.includes('[ERROR:')) {
                    resolve({ success: false, error: 'Expression error: ' + processed, errorType: 'EXPRESSION_ERROR' });
                    return;
                }

                var newData;
                try {
                    newData = JSON.parse(processed);
                } catch (parseErr) {
                    resolve({ success: false, error: 'Invalid JSON: ' + parseErr.message, errorType: 'PARSE_ERROR' });
                    return;
                }

                var items = normalizeToArray(inputData);
                var output;

                if (config.keepOnlySet === 'Yes (Replace)') {
                    output = [newData];
                } else {
                    // Merge with first input item
                    output = [Object.assign({}, items[0], newData)];
                }

                resolve({ success: true, output: output });

            } catch (e) {
                resolve({ success: false, error: e.message, errorType: 'EXECUTION_ERROR' });
            }
        });
    }
};

NodeDefinitions['code'] = {
    appearance: {
        name: 'Code',
        icon: '💻',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Run custom JavaScript code'
    },
    settings: [
        { name: 'mode', label: 'Mode', type: 'select', options: ['Run Once for All Items', 'Run Once for Each Item'], default: 'Run Once for All Items' },
        { name: 'code', label: 'JavaScript Code', type: 'code', placeholder: '// Available variables:\n// - items: Array of all input items\n// - $json: First input item\n// - $node: Access other nodes\n// - $now, $today: Date helpers\n\n// Return an array of items:\nreturn items.map(item => ({\n  ...item,\n  processed: true\n}));' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            try {
                var items = normalizeToArray(inputData);
                var $json = items[0] || {};
                var exprContext = buildFullExpressionContext(context.nodeId, inputData);

                // Create the function with full context
                var code = config.code || 'return items;';
                var fn = new Function(
                    'items', '$json', '$node', '$input', '$now', '$today', '$workflow',
                    'Math', 'Object', 'Array', 'JSON', 'String', 'Number', 'Date',
                    'console',
                    code
                );

                var result = fn(
                    items,
                    $json,
                    exprContext.$node,
                    exprContext.$input,
                    exprContext.$now,
                    exprContext.$today,
                    exprContext.$workflow,
                    Math, Object, Array, JSON, String, Number, Date,
                    console
                );

                // Validate result
                if (result === undefined || result === null) {
                    resolve({
                        success: false,
                        error: 'Code must return a value. Got: ' + (result === null ? 'null' : 'undefined'),
                        errorType: 'RETURN_ERROR'
                    });
                    return;
                }

                // Normalize to array
                if (!Array.isArray(result)) {
                    result = [result];
                }

                resolve({ success: true, output: result });

            } catch (e) {
                resolve({
                    success: false,
                    error: 'Code execution error: ' + e.message,
                    errorType: 'CODE_ERROR'
                });
            }
        });
    }
};

NodeDefinitions['filter'] = {
    appearance: {
        name: 'Filter',
        icon: '🔍',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Filter items by condition'
    },
    settings: [
        { name: 'conditions', label: 'Filter Mode', type: 'select', options: ['Keep Matching', 'Remove Matching'], default: 'Keep Matching' },
        { name: 'field', label: 'Field to Check', type: 'expression', placeholder: '{{ $json.status }}' },
        { name: 'operation', label: 'Operation', type: 'select', options: ['equals', 'not equals', 'contains', 'not contains', 'starts with', 'ends with', 'greater than', 'less than', 'is empty', 'is not empty', 'is true', 'is false'], default: 'equals' },
        { name: 'value', label: 'Value to Compare', type: 'expression', placeholder: 'active' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);

            var filtered = items.filter(function (item) {
                var itemContext = { nodeId: context.nodeId };
                var val1 = processExpression(config.field || '', [item], itemContext);
                var val2 = processExpression(config.value || '', [item], itemContext);
                var matches = false;

                switch (config.operation) {
                    case 'equals':
                        matches = val1 == val2;
                        break;
                    case 'not equals':
                        matches = val1 != val2;
                        break;
                    case 'contains':
                        matches = String(val1).toLowerCase().includes(String(val2).toLowerCase());
                        break;
                    case 'not contains':
                        matches = !String(val1).toLowerCase().includes(String(val2).toLowerCase());
                        break;
                    case 'starts with':
                        matches = String(val1).toLowerCase().startsWith(String(val2).toLowerCase());
                        break;
                    case 'ends with':
                        matches = String(val1).toLowerCase().endsWith(String(val2).toLowerCase());
                        break;
                    case 'greater than':
                        matches = parseFloat(val1) > parseFloat(val2);
                        break;
                    case 'less than':
                        matches = parseFloat(val1) < parseFloat(val2);
                        break;
                    case 'is empty':
                        matches = !val1 || val1 === '' || val1 === 'null' || val1 === 'undefined';
                        break;
                    case 'is not empty':
                        matches = val1 && val1 !== '' && val1 !== 'null' && val1 !== 'undefined';
                        break;
                    case 'is true':
                        matches = val1 === true || val1 === 'true' || val1 === '1' || val1 === 1;
                        break;
                    case 'is false':
                        matches = val1 === false || val1 === 'false' || val1 === '0' || val1 === 0;
                        break;
                    default:
                        matches = true;
                }

                return config.conditions === 'Remove Matching' ? !matches : matches;
            });

            resolve({
                success: true,
                output: filtered.length > 0 ? filtered : [],
                info: 'Filtered ' + items.length + ' items to ' + filtered.length
            });
        });
    }
};

NodeDefinitions['aggregate'] = {
    appearance: {
        name: 'Aggregate',
        icon: '📊',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Aggregate data (sum, average, count, etc.)'
    },
    settings: [
        { name: 'operation', label: 'Operation', type: 'select', options: ['Sum', 'Average', 'Count', 'Min', 'Max', 'Concatenate', 'First', 'Last'], default: 'Sum' },
        { name: 'field', label: 'Field to Aggregate', type: 'expression', placeholder: '{{ $json.amount }}', required: true },
        { name: 'groupBy', label: 'Group By Field', type: 'expression', placeholder: '{{ $json.category }}' },
        { name: 'outputFieldName', label: 'Output Field Name', type: 'text', placeholder: 'result', default: 'result' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var groups = {};

            items.forEach(function (item) {
                var groupKey = config.groupBy ? processExpression(config.groupBy, [item], context) : '_all';
                var value = processExpression(config.field || '', [item], context);

                if (!groups[groupKey]) {
                    groups[groupKey] = { values: [], items: [] };
                }
                groups[groupKey].values.push(parseFloat(value) || 0);
                groups[groupKey].items.push(item);
            });

            var results = [];
            var outputField = config.outputFieldName || 'result';

            Object.keys(groups).forEach(function (groupKey) {
                var values = groups[groupKey].values;
                var groupItems = groups[groupKey].items;
                var result = {};

                if (groupKey !== '_all') {
                    result.group = groupKey;
                }

                switch (config.operation) {
                    case 'Sum':
                        result[outputField] = values.reduce(function (a, b) { return a + b; }, 0);
                        break;
                    case 'Average':
                        result[outputField] = values.length > 0 ? values.reduce(function (a, b) { return a + b; }, 0) / values.length : 0;
                        break;
                    case 'Count':
                        result[outputField] = values.length;
                        break;
                    case 'Min':
                        result[outputField] = Math.min.apply(null, values);
                        break;
                    case 'Max':
                        result[outputField] = Math.max.apply(null, values);
                        break;
                    case 'First':
                        result = Object.assign({}, groupItems[0]);
                        break;
                    case 'Last':
                        result = Object.assign({}, groupItems[groupItems.length - 1]);
                        break;
                    case 'Concatenate':
                        result[outputField] = values.join(', ');
                        break;
                }

                results.push(result);
            });

            resolve({ success: true, output: results });
        });
    }
};

NodeDefinitions['sort'] = {
    appearance: {
        name: 'Sort',
        icon: '🔤',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Sort items by field(s)'
    },
    settings: [
        { name: 'sortField', label: 'Sort By Field', type: 'expression', placeholder: '{{ $json.name }}', required: true },
        { name: 'sortOrder', label: 'Sort Order', type: 'select', options: ['Ascending', 'Descending'], default: 'Ascending' },
        { name: 'sortType', label: 'Sort Type', type: 'select', options: ['String', 'Number', 'Date'], default: 'String' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var isDescending = config.sortOrder === 'Descending';

            var sorted = items.slice().sort(function (a, b) {
                var valA = processExpression(config.sortField || '', [a], context);
                var valB = processExpression(config.sortField || '', [b], context);

                if (config.sortType === 'Number') {
                    valA = parseFloat(valA) || 0;
                    valB = parseFloat(valB) || 0;
                } else if (config.sortType === 'Date') {
                    valA = new Date(valA).getTime();
                    valB = new Date(valB).getTime();
                } else {
                    valA = String(valA).toLowerCase();
                    valB = String(valB).toLowerCase();
                }

                var comparison = valA < valB ? -1 : (valA > valB ? 1 : 0);
                return isDescending ? -comparison : comparison;
            });

            resolve({ success: true, output: sorted });
        });
    }
};

NodeDefinitions['limit'] = {
    appearance: {
        name: 'Limit',
        icon: '✂️',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Limit number of items'
    },
    settings: [
        { name: 'maxItems', label: 'Max Items', type: 'number', placeholder: '10', default: '10', required: true },
        { name: 'keepFrom', label: 'Keep From', type: 'select', options: ['Beginning', 'End'], default: 'Beginning' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var maxItems = parseInt(config.maxItems) || 10;
            var output;

            if (config.keepFrom === 'End') {
                output = items.slice(-maxItems);
            } else {
                output = items.slice(0, maxItems);
            }

            resolve({ success: true, output: output, info: 'Limited from ' + items.length + ' to ' + output.length + ' items' });
        });
    }
};

NodeDefinitions['remove-duplicates'] = {
    appearance: {
        name: 'Remove Duplicates',
        icon: '🔄',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Remove duplicate items'
    },
    settings: [
        { name: 'compareField', label: 'Compare By Field', type: 'expression', placeholder: '{{ $json.id }}', required: true },
        { name: 'keepWhen', label: 'When Duplicates Found, Keep', type: 'select', options: ['First Occurrence', 'Last Occurrence'], default: 'First Occurrence' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var seen = {};
            var output;

            if (config.keepWhen === 'Last Occurrence') {
                // Reverse, dedupe, reverse back
                var reversed = items.slice().reverse();
                output = reversed.filter(function (item) {
                    var key = processExpression(config.compareField || '', [item], context);
                    if (seen[key]) return false;
                    seen[key] = true;
                    return true;
                }).reverse();
            } else {
                output = items.filter(function (item) {
                    var key = processExpression(config.compareField || '', [item], context);
                    if (seen[key]) return false;
                    seen[key] = true;
                    return true;
                });
            }

            resolve({ success: true, output: output, info: 'Removed ' + (items.length - output.length) + ' duplicates' });
        });
    }
};

NodeDefinitions['date-time'] = {
    appearance: {
        name: 'Date & Time',
        icon: '📅',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Format, calculate, and parse dates'
    },
    settings: [
        { name: 'operation', label: 'Operation', type: 'select', options: ['Format Date', 'Add/Subtract Time', 'Parse Date', 'Get Current Time', 'Calculate Difference'], default: 'Format Date' },
        { name: 'inputDate', label: 'Input Date', type: 'expression', placeholder: '{{ $json.date }}' },
        { name: 'outputFormat', label: 'Output Format', type: 'select', options: ['ISO 8601', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMMM D, YYYY', 'Unix Timestamp', 'Custom'], default: 'ISO 8601' },
        { name: 'customFormat', label: 'Custom Format', type: 'text', placeholder: 'yyyy-MM-dd HH:mm:ss' },
        { name: 'amount', label: 'Amount to Add/Subtract', type: 'number', placeholder: '1' },
        { name: 'unit', label: 'Time Unit', type: 'select', options: ['Seconds', 'Minutes', 'Hours', 'Days', 'Weeks', 'Months', 'Years'], default: 'Days' },
        { name: 'addOrSubtract', label: 'Add or Subtract', type: 'select', options: ['Add', 'Subtract'], default: 'Add' },
        { name: 'timezone', label: 'Timezone', type: 'select', options: ['UTC', 'Local', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'], default: 'UTC' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var results = items.map(function (item) {
                var result = Object.assign({}, item);
                var date;

                switch (config.operation) {
                    case 'Get Current Time':
                        date = new Date();
                        break;
                    case 'Parse Date':
                    case 'Format Date':
                    case 'Add/Subtract Time':
                    case 'Calculate Difference':
                        var inputStr = processExpression(config.inputDate || '', [item], context);
                        date = new Date(inputStr);
                        if (isNaN(date.getTime())) {
                            result._dateError = 'Invalid date: ' + inputStr;
                            return result;
                        }
                        break;
                }

                if (config.operation === 'Add/Subtract Time') {
                    var amount = parseInt(config.amount) || 0;
                    if (config.addOrSubtract === 'Subtract') amount = -amount;

                    switch (config.unit) {
                        case 'Seconds': date.setSeconds(date.getSeconds() + amount); break;
                        case 'Minutes': date.setMinutes(date.getMinutes() + amount); break;
                        case 'Hours': date.setHours(date.getHours() + amount); break;
                        case 'Days': date.setDate(date.getDate() + amount); break;
                        case 'Weeks': date.setDate(date.getDate() + (amount * 7)); break;
                        case 'Months': date.setMonth(date.getMonth() + amount); break;
                        case 'Years': date.setFullYear(date.getFullYear() + amount); break;
                    }
                }

                // Format the date
                switch (config.outputFormat) {
                    case 'ISO 8601':
                        result.date = date.toISOString();
                        break;
                    case 'YYYY-MM-DD':
                        result.date = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
                        break;
                    case 'MM/DD/YYYY':
                        result.date = String(date.getMonth() + 1).padStart(2, '0') + '/' + String(date.getDate()).padStart(2, '0') + '/' + date.getFullYear();
                        break;
                    case 'DD/MM/YYYY':
                        result.date = String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0') + '/' + date.getFullYear();
                        break;
                    case 'MMMM D, YYYY':
                        var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                        result.date = months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
                        break;
                    case 'Unix Timestamp':
                        result.date = Math.floor(date.getTime() / 1000);
                        break;
                    default:
                        result.date = date.toISOString();
                }

                return result;
            });

            resolve({ success: true, output: results });
        });
    }
};


/* -------------------------------------------------- */
/*      3.5: FLOW CONTROL NODES                       */
/* -------------------------------------------------- */

NodeDefinitions['if'] = {
    appearance: {
        name: 'IF',
        icon: '🔀',
        color: '#ec4899',
        category: 'flow',
        section: 'Flow',
        description: 'Conditional branching'
    },
    settings: [
        { name: 'value1', label: 'Value 1', type: 'expression', placeholder: '{{ $json.status }}', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['equals', 'not equals', 'greater than', 'less than', 'greater or equal', 'less or equal', 'contains', 'not contains', 'starts with', 'ends with', 'is empty', 'is not empty', 'is true', 'is false', 'regex match'], default: 'equals' },
        { name: 'value2', label: 'Value 2', type: 'expression', placeholder: 'active' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var val1 = processExpression(config.value1 || '', inputData, context);
            var val2 = processExpression(config.value2 || '', inputData, context);
            var result = false;

            switch (config.operation) {
                case 'equals':
                    result = val1 == val2;
                    break;
                case 'not equals':
                    result = val1 != val2;
                    break;
                case 'greater than':
                    result = parseFloat(val1) > parseFloat(val2);
                    break;
                case 'less than':
                    result = parseFloat(val1) < parseFloat(val2);
                    break;
                case 'greater or equal':
                    result = parseFloat(val1) >= parseFloat(val2);
                    break;
                case 'less or equal':
                    result = parseFloat(val1) <= parseFloat(val2);
                    break;
                case 'contains':
                    result = String(val1).toLowerCase().includes(String(val2).toLowerCase());
                    break;
                case 'not contains':
                    result = !String(val1).toLowerCase().includes(String(val2).toLowerCase());
                    break;
                case 'starts with':
                    result = String(val1).startsWith(String(val2));
                    break;
                case 'ends with':
                    result = String(val1).endsWith(String(val2));
                    break;
                case 'is empty':
                    result = !val1 || val1 === '' || val1 === 'null' || val1 === 'undefined';
                    break;
                case 'is not empty':
                    result = val1 && val1 !== '' && val1 !== 'null' && val1 !== 'undefined';
                    break;
                case 'is true':
                    result = val1 === true || val1 === 'true' || val1 === 1 || val1 === '1';
                    break;
                case 'is false':
                    result = val1 === false || val1 === 'false' || val1 === 0 || val1 === '0';
                    break;
                case 'regex match':
                    try {
                        result = new RegExp(val2).test(String(val1));
                    } catch (e) {
                        result = false;
                    }
                    break;
            }

            var items = normalizeToArray(inputData);

            resolve({
                success: true,
                output: [
                    {
                        _condition: result,
                        _branch: result ? 'true' : 'false',
                        _comparison: {
                            value1: val1,
                            value2: val2,
                            operation: config.operation
                        },
                        ...items[0]
                    }
                ]
            });
        });
    }
};

NodeDefinitions['switch'] = {
    appearance: {
        name: 'Switch',
        icon: '🔄',
        color: '#ec4899',
        category: 'flow',
        section: 'Flow',
        description: 'Route to different outputs based on conditions'
    },
    settings: [
        { name: 'mode', label: 'Mode', type: 'select', options: ['Rules', 'Expression'], default: 'Rules' },
        { name: 'dataType', label: 'Data Type', type: 'select', options: ['String', 'Number', 'Boolean', 'Date & Time'], default: 'String' },
        { name: 'value1', label: 'Value to Route On', type: 'expression', placeholder: '{{ $json.status }}', required: true },
        {
            name: 'rules',
            label: 'Routing Rules (JSON Array)',
            type: 'expression',
            placeholder: '[{"operation":"equals","value":"active","output":0},{"operation":"equals","value":"pending","output":1}]',
            default: '[{"operation":"equals","value":"","output":0}]'
        },
        { name: 'outputCount', label: 'Number of Outputs', type: 'number', placeholder: '4', default: '4', min: 1, max: 10 },
        { name: 'fallbackOutput', label: 'Fallback Output', type: 'select', options: ['None (Ignore)', 'Extra Output', 'First Output'], default: 'None (Ignore)' },
        { name: 'sendToAllMatching', label: 'Send to All Matching', type: 'select', options: ['No', 'Yes'], default: 'No' },
        { name: 'expression', label: 'Output Index Expression (for Expression mode)', type: 'expression', placeholder: '{{ $json.type === "email" ? 0 : 1 }}' },
        { name: 'output0Label', label: 'Output 0 Label', type: 'text', placeholder: 'Output 0', default: 'Output 0' },
        { name: 'output1Label', label: 'Output 1 Label', type: 'text', placeholder: 'Output 1', default: 'Output 1' },
        { name: 'output2Label', label: 'Output 2 Label', type: 'text', placeholder: 'Output 2', default: 'Output 2' },
        { name: 'output3Label', label: 'Output 3 Label', type: 'text', placeholder: 'Output 3', default: 'Output 3' }
    ],
    connectors: { hasInput: true, hasOutput: true, outputCount: 4, dynamicOutputCount: true },
    outputLabels: ['Output 0', 'Output 1', 'Output 2', 'Output 3'],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var outputCount = parseInt(config.outputCount) || 4;
            var hasFallback = config.fallbackOutput === 'Extra Output';
            var fallbackToFirst = config.fallbackOutput === 'First Output';
            var sendToAll = config.sendToAllMatching === 'Yes';

            // Initialize outputs array
            var outputs = [];
            for (var i = 0; i < outputCount + (hasFallback ? 1 : 0); i++) {
                outputs.push([]);
            }

            // Process each item
            items.forEach(function (item) {
                var matchedOutputs = [];

                if (config.mode === 'Expression') {
                    // Expression mode - evaluate expression to get output index
                    try {
                        var exprContext = buildFullExpressionContext(context.nodeId, [item]);
                        var exprResult = processExpression(config.expression || '0', [item], context);
                        var outputIndex = parseInt(exprResult);

                        if (!isNaN(outputIndex) && outputIndex >= 0 && outputIndex < outputCount) {
                            matchedOutputs.push(outputIndex);
                        }
                    } catch (e) {
                        // Expression error - use fallback
                    }
                } else {
                    // Rules mode - evaluate each rule
                    var val1 = processExpression(config.value1 || '', [item], context);
                    var rules = [];

                    try {
                        rules = JSON.parse(config.rules || '[]');
                    } catch (e) {
                        rules = [];
                    }

                    rules.forEach(function (rule) {
                        var val2 = processExpression(String(rule.value || ''), [item], context);
                        var matches = false;
                        var operation = rule.operation || 'equals';

                        // Type conversion based on dataType
                        if (config.dataType === 'Number') {
                            val1 = parseFloat(val1) || 0;
                            val2 = parseFloat(val2) || 0;
                        } else if (config.dataType === 'Boolean') {
                            val1 = val1 === true || val1 === 'true' || val1 === '1' || val1 === 1;
                            val2 = val2 === true || val2 === 'true' || val2 === '1' || val2 === 1;
                        } else if (config.dataType === 'Date & Time') {
                            val1 = new Date(val1).getTime();
                            val2 = new Date(val2).getTime();
                        }

                        // Evaluate condition
                        switch (operation) {
                            case 'equals':
                                matches = val1 == val2;
                                break;
                            case 'not equals':
                            case 'notEquals':
                                matches = val1 != val2;
                                break;
                            case 'contains':
                                matches = String(val1).toLowerCase().includes(String(val2).toLowerCase());
                                break;
                            case 'not contains':
                            case 'notContains':
                                matches = !String(val1).toLowerCase().includes(String(val2).toLowerCase());
                                break;
                            case 'starts with':
                            case 'startsWith':
                                matches = String(val1).toLowerCase().startsWith(String(val2).toLowerCase());
                                break;
                            case 'ends with':
                            case 'endsWith':
                                matches = String(val1).toLowerCase().endsWith(String(val2).toLowerCase());
                                break;
                            case 'greater than':
                            case 'greaterThan':
                                matches = parseFloat(val1) > parseFloat(val2);
                                break;
                            case 'less than':
                            case 'lessThan':
                                matches = parseFloat(val1) < parseFloat(val2);
                                break;
                            case 'greater or equal':
                            case 'greaterOrEqual':
                                matches = parseFloat(val1) >= parseFloat(val2);
                                break;
                            case 'less or equal':
                            case 'lessOrEqual':
                                matches = parseFloat(val1) <= parseFloat(val2);
                                break;
                            case 'is empty':
                            case 'isEmpty':
                                matches = !val1 || val1 === '' || val1 === 'null' || val1 === 'undefined';
                                break;
                            case 'is not empty':
                            case 'isNotEmpty':
                                matches = val1 && val1 !== '' && val1 !== 'null' && val1 !== 'undefined';
                                break;
                            case 'regex':
                                try {
                                    matches = new RegExp(val2).test(String(val1));
                                } catch (e) {
                                    matches = false;
                                }
                                break;
                            default:
                                matches = val1 == val2;
                        }

                        if (matches) {
                            var targetOutput = parseInt(rule.output) || 0;
                            if (targetOutput >= 0 && targetOutput < outputCount) {
                                if (matchedOutputs.indexOf(targetOutput) === -1) {
                                    matchedOutputs.push(targetOutput);
                                }
                            }
                        }
                    });
                }

                // Route item to matched outputs
                if (matchedOutputs.length > 0) {
                    if (sendToAll) {
                        // Send to all matching outputs
                        matchedOutputs.forEach(function (idx) {
                            outputs[idx].push(Object.assign({}, item, { _switchedTo: idx }));
                        });
                    } else {
                        // Send to first matching output only
                        var firstMatch = matchedOutputs[0];
                        outputs[firstMatch].push(Object.assign({}, item, { _switchedTo: firstMatch }));
                    }
                } else {
                    // No match - handle fallback
                    if (hasFallback) {
                        outputs[outputCount].push(Object.assign({}, item, { _switchedTo: 'fallback' }));
                    } else if (fallbackToFirst) {
                        outputs[0].push(Object.assign({}, item, { _switchedTo: 0, _fallback: true }));
                    }
                    // If 'None (Ignore)' - item is dropped
                }
            });

            // Find first non-empty output for primary result
            var primaryOutput = 0;
            for (var j = 0; j < outputs.length; j++) {
                if (outputs[j].length > 0) {
                    primaryOutput = j;
                    break;
                }
            }

            resolve({
                success: true,
                output: outputs[primaryOutput].length > 0 ? outputs[primaryOutput] : [],
                outputPort: primaryOutput,
                allOutputs: outputs,
                _switchInfo: {
                    mode: config.mode,
                    totalOutputs: outputCount + (hasFallback ? 1 : 0),
                    itemsPerOutput: outputs.map(function (o) { return o.length; })
                }
            });
        });
    }
};


/* AI Agent node removed per user request */

NodeDefinitions['http-request-tool'] = {
    appearance: {
        name: 'HTTP Request Tool',
        icon: '🌐',
        color: '#22c55e',
        category: 'tool',
        section: 'Tools',
        description: 'Make HTTP requests (AI Agent Tool)'
    },
    settings: [
        { name: 'name', label: 'Tool Name', type: 'text', placeholder: 'http_request', default: 'http_request' },
        { name: 'description', label: 'Tool Description (for AI)', type: 'expression', placeholder: 'Make an HTTP request to fetch data from an API. Use this when you need to retrieve external data.', required: true, default: 'Make HTTP requests to external APIs' },
        { name: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], default: 'GET' },
        { name: 'url', label: 'URL', type: 'expression', placeholder: 'https://api.example.com/endpoint', required: true },
        { name: 'authentication', label: 'Authentication', type: 'select', options: ['None', 'Predefined Credential', 'Header Auth', 'Bearer Token', 'Basic Auth'], default: 'None' },
        { name: 'credentialId', label: 'Credential', type: 'credential', credentialType: 'http-header' },
        { name: 'headers', label: 'Headers (JSON)', type: 'expression', placeholder: '{"Content-Type": "application/json"}' },
        { name: 'queryParams', label: 'Query Parameters (JSON)', type: 'expression', placeholder: '{"key": "value"}' },
        { name: 'body', label: 'Body (JSON)', type: 'expression', placeholder: '{"data": "value"}' },
        { name: 'responseFormat', label: 'Response Format', type: 'select', options: ['JSON', 'Text', 'Binary'], default: 'JSON' }
    ],
    connectors: {
        hasInput: false,
        hasOutput: false,
        isTool: true,
        connectsToAgent: true
    },
    getToolDefinition: function (config) {
        return {
            name: config.name || 'http_request',
            description: config.description || 'Make HTTP requests to external APIs',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The URL to make the request to' },
                    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method' },
                    headers: { type: 'object', description: 'HTTP headers as a JSON object' },
                    queryParams: { type: 'object', description: 'Query parameters as a JSON object' },
                    body: { type: 'object', description: 'Request body for POST/PUT/PATCH requests' }
                },
                required: ['url']
            }
        };
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var url = processExpression(config.url || '', inputData, context);
            var headers = {};
            var queryParams = {};
            var body = null;

            // Handle Headers
            if (typeof config.headers === 'object' && config.headers !== null) {
                headers = config.headers;
            } else {
                try {
                    headers = JSON.parse(processExpression(config.headers || '{}', inputData, context));
                } catch (e) { }
            }

            // Handle Query Params
            if (typeof config.queryParams === 'object' && config.queryParams !== null) {
                queryParams = config.queryParams;
            } else {
                try {
                    queryParams = JSON.parse(processExpression(config.queryParams || '{}', inputData, context));
                } catch (e) { }
            }

            // Append Query Params to URL
            if (Object.keys(queryParams).length > 0) {
                var separator = url.indexOf('?') === -1 ? '?' : '&';
                var qs = Object.keys(queryParams).map(function (k) {
                    return encodeURIComponent(k) + '=' + encodeURIComponent(queryParams[k]);
                }).join('&');
                url += separator + qs;
            }

            if (config.body && ['POST', 'PUT', 'PATCH'].indexOf(config.method) !== -1) {
                if (typeof config.body === 'object') {
                    body = JSON.stringify(config.body);
                } else {
                    body = processExpression(config.body, inputData, context);
                }
            }

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'http_request',
                    url: url,
                    method: config.method || 'GET',
                    headers: headers,
                    body: body
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    resolve({ success: result.success, output: result.data });
                })
                .catch(function (err) {
                    resolve({ success: false, error: err.message });
                });
        });
    }
};

NodeDefinitions['google-sheets-tool'] = {
    appearance: {
        name: 'Google Sheets Tool',
        icon: '📊',
        color: '#34a853',
        category: 'tool',
        section: 'Tools',
        description: 'Read/Write Google Sheets (AI Agent Tool)'
    },
    settings: [
        { name: 'name', label: 'Tool Name', type: 'text', placeholder: 'google_sheets', default: 'google_sheets' },
        { name: 'description', label: 'Tool Description (for AI)', type: 'expression', placeholder: 'Read and write data from Google Sheets spreadsheets', default: 'Read and write to Google Sheets spreadsheets' },
        { name: 'credentialId', label: 'Google Account', type: 'credential', credentialType: 'google-oauth', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Read Rows', 'Append Row', 'Update Row', 'Get Sheet Names', 'Clear'], default: 'Read Rows' },
        { name: 'spreadsheetId', label: 'Spreadsheet ID', type: 'expression', required: true },
        { name: 'sheetName', label: 'Sheet Name', type: 'expression', default: 'Sheet1' },
        { name: 'range', label: 'Range', type: 'expression', placeholder: 'A1:Z100' }
    ],
    connectors: { hasInput: false, hasOutput: false, isTool: true, connectsToAgent: true },
    getToolDefinition: function (config) {
        return {
            name: config.name || 'google_sheets',
            description: config.description || 'Read and write to Google Sheets',
            parameters: {
                type: 'object',
                properties: {
                    operation: { type: 'string', enum: ['read', 'append', 'update'], description: 'Operation to perform' },
                    data: { type: 'object', description: 'Data to write (for append/update)' }
                }
            }
        };
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var toolArgs = (inputData && inputData[0]) || {};
            var spreadsheetId = (toolArgs.spreadsheetId !== undefined) ? toolArgs.spreadsheetId : processExpression(config.spreadsheetId || '', inputData, context);
            var operation = (toolArgs.operation !== undefined) ? toolArgs.operation : (config.operation || 'Read Rows');
            var sheetName = (toolArgs.sheetName !== undefined) ? toolArgs.sheetName : processExpression(config.sheetName || 'Sheet1', inputData, context);
            var range = (toolArgs.range !== undefined) ? toolArgs.range : processExpression(config.range || 'A1:Z100', inputData, context);
            var data = (toolArgs.data !== undefined) ? toolArgs.data : (toolArgs.values !== undefined ? toolArgs.values : null);

            getCredentialById(config.credentialId, function (cred) {
                var accessToken = cred ? (typeof cred === 'string' ? cred : (cred.accessToken || (cred.data && cred.data.accessToken))) : null;
                if (!accessToken) {
                    resolve({ success: false, error: 'Google Access Token required' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'google_sheets',
                        accessToken: accessToken,
                        operation: operation,
                        spreadsheetId: spreadsheetId,
                        sheetName: sheetName,
                        range: range,
                        values: data
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        resolve({ success: result.success, output: result.data });
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message });
                    });
            });
        });
    }
};

NodeDefinitions['google-drive-tool'] = {
    appearance: {
        name: 'Google Drive Tool',
        icon: '📁',
        color: '#4285f4',
        category: 'tool',
        section: 'Tools',
        description: 'Manage Google Drive files (AI Agent Tool)'
    },
    settings: [
        { name: 'name', label: 'Tool Name', type: 'text', default: 'google_drive' },
        { name: 'description', label: 'Tool Description (for AI)', type: 'expression', default: 'List, upload, download, and manage files in Google Drive' },
        { name: 'credentialId', label: 'Google Account', type: 'credential', credentialType: 'google-oauth', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['List Files', 'Upload File', 'Download File', 'Delete File', 'Search'], default: 'List Files' }
    ],
    connectors: { hasInput: false, hasOutput: false, isTool: true, connectsToAgent: true },
    getToolDefinition: function (config) {
        return {
            name: config.name || 'google_drive',
            description: config.description || 'Manage Google Drive files',
            parameters: {
                type: 'object',
                properties: {
                    operation: { type: 'string', description: 'Operation to perform' },
                    folderId: { type: 'string', description: 'Folder ID to list or upload to' }
                }
            }
        };
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var toolArgs = (inputData && inputData[0]) || {};
            var operation = (toolArgs.operation !== undefined) ? toolArgs.operation : (config.operation || 'List Files');
            var folderId = (toolArgs.folderId !== undefined) ? toolArgs.folderId : processExpression(config.folderId || '', inputData, context);
            var fileId = (toolArgs.fileId !== undefined) ? toolArgs.fileId : '';

            getCredentialById(config.credentialId, function (cred) {
                var accessToken = cred ? (typeof cred === 'string' ? cred : (cred.accessToken || (cred.data && cred.data.accessToken))) : null;
                if (!accessToken) {
                    resolve({ success: false, error: 'Google Access Token required' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'google_drive',
                        accessToken: accessToken,
                        operation: operation,
                        folderId: folderId,
                        fileId: fileId
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        resolve({ success: result.success, output: result.data });
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message });
                    });
            });
        });
    }
};

NodeDefinitions['gmail-tool'] = {
    appearance: {
        name: 'Gmail Tool',
        icon: '✉️',
        color: '#ea4335',
        category: 'tool',
        section: 'Tools',
        description: 'Send and read emails (AI Agent Tool)'
    },
    settings: [
        { name: 'name', label: 'Tool Name', type: 'text', default: 'gmail' },
        { name: 'description', label: 'Tool Description (for AI)', type: 'expression', default: 'Send emails and read inbox messages using Gmail' },
        { name: 'credentialId', label: 'Google Account', type: 'credential', credentialType: 'google-oauth', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Send Email', 'Get Emails', 'Get Email by ID', 'Search Emails'], default: 'Send Email' }
    ],
    connectors: { hasInput: false, hasOutput: false, isTool: true, connectsToAgent: true },
    getToolDefinition: function (config) {
        return {
            name: config.name || 'gmail',
            description: config.description || 'Send and read Gmail emails',
            parameters: {
                type: 'object',
                properties: {
                    to: { type: 'string', description: 'Recipient email address' },
                    subject: { type: 'string', description: 'Email subject' },
                    body: { type: 'string', description: 'Email body content' }
                }
            }
        };
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var toolArgs = (inputData && inputData[0]) || {};
            var operation = (toolArgs.operation !== undefined) ? toolArgs.operation : (config.operation || 'Send Email');
            var to = (toolArgs.to !== undefined) ? toolArgs.to : '';
            var subject = (toolArgs.subject !== undefined) ? toolArgs.subject : '';
            var body = (toolArgs.body !== undefined) ? toolArgs.body : '';

            getCredentialById(config.credentialId, function (cred) {
                var accessToken = cred ? (typeof cred === 'string' ? cred : (cred.accessToken || (cred.data && cred.data.accessToken))) : null;
                if (!accessToken) {
                    resolve({ success: false, error: 'Google Access Token required' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'gmail',
                        accessToken: accessToken,
                        operation: operation,
                        to: to,
                        subject: subject,
                        body: body
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        resolve({ success: result.success, output: result.data });
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message });
                    });
            });
        });
    }
};

NodeDefinitions['google-calendar-tool'] = {
    appearance: {
        name: 'Google Calendar Tool',
        icon: '📅',
        color: '#4285f4',
        category: 'tool',
        section: 'Tools',
        description: 'Read and manage calendar events (AI Agent Tool)'
    },
    settings: [
        { name: 'name', label: 'Tool Name', type: 'text', default: 'google_calendar' },
        { name: 'description', label: 'Tool Description (for AI)', type: 'expression', default: 'Manage Google Calendar events' },
        { name: 'credentialId', label: 'Google Account', type: 'credential', credentialType: 'google-oauth', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Get Events', 'Create Event', 'Update Event', 'Delete Event', 'Get Calendars'], default: 'Get Events' }
    ],
    connectors: { hasInput: false, hasOutput: false, isTool: true, connectsToAgent: true },
    getToolDefinition: function (config) {
        return {
            name: config.name || 'google_calendar',
            description: config.description || 'Manage Google Calendar events',
            parameters: {
                type: 'object',
                properties: {
                    operation: { type: 'string', enum: ['list', 'create', 'update', 'delete'], description: 'Operation to perform' },
                    calendarId: { type: 'string', description: 'Calendar ID (default "primary")' },
                    summary: { type: 'string', description: 'Event title' },
                    description: { type: 'string', description: 'Event description' },
                    start: { type: 'string', description: 'Start time (ISO 8601)' },
                    end: { type: 'string', description: 'End time (ISO 8601)' }
                }
            }
        };
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var toolArgs = (inputData && inputData[0]) || {};
            var operation = (toolArgs.operation !== undefined) ? toolArgs.operation : (config.operation || 'Get Events');
            var calendarId = (toolArgs.calendarId !== undefined) ? toolArgs.calendarId : 'primary';

            getCredentialById(config.credentialId, function (cred) {
                var accessToken = cred ? (typeof cred === 'string' ? cred : (cred.accessToken || (cred.data && cred.data.accessToken))) : null;
                if (!accessToken) {
                    resolve({ success: false, error: 'Google Access Token required' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'google_calendar',
                        accessToken: accessToken,
                        operation: operation,
                        calendarId: calendarId,
                        summary: toolArgs.summary || '',
                        description: toolArgs.description || '',
                        startTime: toolArgs.start || '',
                        endTime: toolArgs.end || ''
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        resolve({ success: result.success, output: result.data });
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message });
                    });
            });
        });
    }
};

NodeDefinitions['slack-tool'] = {
    appearance: {
        name: 'Slack Tool',
        icon: '💬',
        color: '#4a154b',
        category: 'tool',
        section: 'Tools',
        description: 'Send and manage Slack messages (AI Agent Tool)'
    },
    settings: [
        { name: 'name', label: 'Tool Name', type: 'text', default: 'slack' },
        { name: 'description', label: 'Tool Description (for AI)', type: 'expression', default: 'Send messages to Slack channels' },
        { name: 'credentialId', label: 'Slack Token', type: 'credential', credentialType: 'slack', required: true }
    ],
    connectors: { hasInput: false, hasOutput: false, isTool: true, connectsToAgent: true },
    getToolDefinition: function (config) {
        return {
            name: config.name || 'slack',
            description: config.description || 'Send Slack messages',
            parameters: {
                type: 'object',
                properties: {
                    channel: { type: 'string', description: 'Channel ID or name' },
                    message: { type: 'string', description: 'Text message to send' }
                },
                required: ['channel', 'message']
            }
        };
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var toolArgs = (inputData && inputData[0]) || {};

            getCredentialById(config.credentialId, function (token) {
                if (!token) {
                    resolve({ success: false, error: 'Slack Token required' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'slack',
                        token: token,
                        operation: 'Send Message',
                        channel: toolArgs.channel,
                        message: toolArgs.message
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        resolve({ success: result.success, output: result.data });
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message });
                    });
            });
        });
    }
};

NodeDefinitions['discord-tool'] = {
    appearance: {
        name: 'Discord Tool',
        icon: '🎮',
        color: '#5865f2',
        category: 'tool',
        section: 'Tools',
        description: 'Send Discord messages via Webhook (AI Agent Tool)'
    },
    settings: [
        { name: 'name', label: 'Tool Name', type: 'text', default: 'discord' },
        { name: 'description', label: 'Tool Description (for AI)', type: 'expression', default: 'Send messages to a Discord channel' },
        { name: 'credentialId', label: 'Webhook URL', type: 'credential', credentialType: 'discord-webhook', required: true }
    ],
    connectors: { hasInput: false, hasOutput: false, isTool: true, connectsToAgent: true },
    getToolDefinition: function (config) {
        return {
            name: config.name || 'discord',
            description: config.description || 'Send Discord messages',
            parameters: {
                type: 'object',
                properties: {
                    content: { type: 'string', description: 'Message content' },
                    username: { type: 'string', description: 'Bot username' }
                },
                required: ['content']
            }
        };
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var toolArgs = (inputData && inputData[0]) || {};

            getCredentialById(config.credentialId, function (webhookUrl) {
                if (!webhookUrl) {
                    resolve({ success: false, error: 'Discord Webhook URL required' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'discord',
                        webhookUrl: webhookUrl,
                        content: toolArgs.content,
                        username: toolArgs.username || ''
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        resolve({ success: result.success, output: [{ sent: true }] });
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message });
                    });
            });
        });
    }
};

NodeDefinitions['code-tool'] = {
    appearance: {
        name: 'Code Tool',
        icon: '💻',
        color: '#8b5cf6',
        category: 'tool',
        section: 'Tools',
        description: 'Execute JavaScript code (AI Agent Tool)'
    },
    settings: [
        { name: 'name', label: 'Tool Name', type: 'text', default: 'execute_code' },
        { name: 'description', label: 'Tool Description (for AI)', type: 'expression', default: 'Execute custom JavaScript code for data processing and calculations' },
        { name: 'code', label: 'JavaScript Code', type: 'code', placeholder: '// Available: input (the input from AI)\n// Return the result\nreturn input;' }
    ],
    connectors: { hasInput: false, hasOutput: false, isTool: true, connectsToAgent: true },
    getToolDefinition: function (config) {
        return {
            name: config.name || 'execute_code',
            description: config.description || 'Execute JavaScript code',
            parameters: {
                type: 'object',
                properties: {
                    input: { type: 'object', description: 'Input data for the code' }
                }
            }
        };
    },
    execute: function (inputData, config, context) {
        try {
            var toolArgs = (inputData && inputData[0]) || {};
            var code = config.code || 'return input;';
            var fn = new Function('input', code);
            var result = fn(toolArgs.input || toolArgs);
            return Promise.resolve({ success: true, output: result });
        } catch (e) {
            return Promise.resolve({ success: false, error: e.message });
        }
    }
};

NodeDefinitions['calculator-tool'] = {
    appearance: {
        name: 'Calculator Tool',
        icon: '🔢',
        color: '#f59e0b',
        category: 'tool',
        section: 'Tools',
        description: 'Perform calculations (AI Agent Tool)'
    },
    settings: [
        { name: 'name', label: 'Tool Name', type: 'text', default: 'calculator' },
        { name: 'description', label: 'Tool Description (for AI)', type: 'expression', default: 'Perform mathematical calculations. Supports basic arithmetic, percentages, and mathematical functions.' }
    ],
    connectors: { hasInput: false, hasOutput: false, isTool: true, connectsToAgent: true },
    getToolDefinition: function (config) {
        return {
            name: config.name || 'calculator',
            description: config.description || 'Perform mathematical calculations',
            parameters: {
                type: 'object',
                properties: {
                    expression: { type: 'string', description: 'Mathematical expression to evaluate, e.g. "2 + 2 * 3"' }
                },
                required: ['expression']
            }
        };
    },
    execute: function (inputData, config, context) {
        try {
            var toolArgs = (inputData && inputData[0]) || {};
            var expr = toolArgs.expression || '';
            // Safe math evaluation
            var result = Function('"use strict"; return (' + expr + ')')();
            return Promise.resolve({ success: true, output: { result: result } });
        } catch (e) {
            return Promise.resolve({ success: false, error: 'Invalid expression: ' + e.message });
        }
    }
};


NodeDefinitions['merge'] = {
    appearance: {
        name: 'Merge',
        icon: '🔗',
        color: '#ec4899',
        category: 'flow',
        section: 'Flow',
        description: 'Combine data from multiple nodes'
    },
    settings: [
        { name: 'mode', label: 'Merge Mode', type: 'select', options: ['Append', 'Merge by Position', 'Merge by Key', 'Combine All'], default: 'Append' },
        { name: 'propertyName', label: 'Key Property (for Merge by Key)', type: 'text', placeholder: 'id' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            // For now, just pass through the input
            var items = normalizeToArray(inputData);
            resolve({ success: true, output: items });
        });
    }
};

NodeDefinitions['split-out'] = {
    appearance: {
        name: 'Split Out',
        icon: '✂️',
        color: '#ec4899',
        category: 'flow',
        section: 'Flow',
        description: 'Split array into separate items'
    },
    settings: [
        { name: 'fieldToSplit', label: 'Field to Split', type: 'expression', placeholder: '{{ $json.items }}', required: true },
        { name: 'includeOtherFields', label: 'Include Other Fields', type: 'select', options: ['No', 'Yes'], default: 'No' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            try {
                var valueStr = processExpression(config.fieldToSplit || '', inputData, context);
                var value;

                try {
                    value = JSON.parse(valueStr);
                } catch (e) {
                    value = valueStr;
                }

                if (!Array.isArray(value)) {
                    value = [value];
                }

                var items = normalizeToArray(inputData);
                var output;

                if (config.includeOtherFields === 'Yes') {
                    output = value.map(function (item) {
                        if (typeof item === 'object') {
                            return Object.assign({}, items[0], item);
                        }
                        return Object.assign({}, items[0], { value: item });
                    });
                } else {
                    output = value.map(function (item) {
                        return typeof item === 'object' ? item : { value: item };
                    });
                }

                resolve({ success: true, output: output });

            } catch (e) {
                resolve({ success: false, error: e.message, errorType: 'EXECUTION_ERROR' });
            }
        });
    }
};

NodeDefinitions['loop-over-items'] = {
    appearance: {
        name: 'Loop Over Items',
        icon: '🔁',
        color: '#ec4899',
        category: 'flow',
        section: 'Flow',
        description: 'Iterate over items with two outputs: Loop and Done'
    },
    settings: [
        { name: 'batchSize', label: 'Batch Size', type: 'number', placeholder: '1', default: '1', description: 'Number of items to process in each iteration' },
        { name: 'pauseBetween', label: 'Pause Between Items (ms)', type: 'number', placeholder: '0', default: '0' }
    ],
    connectors: {
        hasInput: true,
        hasOutput: true,
        outputCount: 2,
        dynamicOutputCount: false
    },
    outputLabels: ['Loop Body', 'Done'],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            // The frontend execution engine handles the loop logic primarily.
            // But for the 'execute' function called once, we usually just pass through or setup state.
            // However, since this node has a special execution mode (splitting flow), 
            // the result mostly informs the engine. 
            // Here, we provide the input array to the engine to iterate.

            var items = normalizeToArray(inputData);

            // We return the items as "Loop Body" output (index 0) 
            // effectively initializing the loop. 
            // The "Done" output (index 1) handles after completion.

            // Standard execute returns data for immediate next nodes.
            // For a loop, it might be more complex if "Loop" connection is taken.

            resolve({
                success: true,
                output: items,
                outputPort: 0, // Start with Loop Body
                // Metadata for engine to know this is a loop start
                _loop: {
                    total: items.length,
                    batchSize: parseInt(config.batchSize) || 1
                }
            });
        });
    }
};


/* -------------------------------------------------- */
/*      3.6: UTILITY NODES                            */
/* -------------------------------------------------- */

NodeDefinitions['wait'] = {
    appearance: {
        name: 'Wait',
        icon: '⏳',
        color: '#6366f1',
        category: 'utility',
        section: 'Utility',
        description: 'Pause execution'
    },
    settings: [
        { name: 'amount', label: 'Wait Time', type: 'number', placeholder: '5', default: '5' },
        { name: 'unit', label: 'Unit', type: 'select', options: ['Seconds', 'Minutes', 'Hours'], default: 'Seconds' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var amount = parseInt(config.amount) || 5;
            var multiplier = 1000; // seconds

            if (config.unit === 'Minutes') multiplier = 60000;
            if (config.unit === 'Hours') multiplier = 3600000;

            var waitMs = Math.min(amount * multiplier, 30000); // Max 30 seconds in demo

            setTimeout(function () {
                var items = normalizeToArray(inputData);
                resolve({
                    success: true,
                    output: items.map(function (item) {
                        return Object.assign({}, item, {
                            _waitedMs: waitMs,
                            _waitedAt: new Date().toISOString()
                        });
                    })
                });
            }, waitMs);
        });
    }
};

NodeDefinitions['no-op'] = {
    appearance: {
        name: 'No Operation',
        icon: '➡️',
        color: '#6366f1',
        category: 'utility',
        section: 'Utility',
        description: 'Pass data through unchanged'
    },
    settings: [],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            resolve({ success: true, output: normalizeToArray(inputData) });
        });
    }
};

NodeDefinitions['debug'] = {
    appearance: {
        name: 'Debug',
        icon: '🔧',
        color: '#6366f1',
        category: 'utility',
        section: 'Utility',
        description: 'Log data for debugging'
    },
    settings: [
        { name: 'message', label: 'Debug Message', type: 'expression', placeholder: 'Debug: {{ $json }}' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var message = processExpression(config.message || '', inputData, context);
            console.log('[DEBUG]', message, inputData);

            resolve({ success: true, output: normalizeToArray(inputData) });
        });
    }
};


/* -------------------------------------------------- */
/*      3.7: GOOGLE CLOUD NODES                       */
/* -------------------------------------------------- */

NodeDefinitions['google-sheets'] = {
    appearance: {
        name: 'Google Sheets',
        icon: '📊',
        color: '#34a853',
        category: 'google',
        section: 'Google Cloud',
        description: 'Read/Write Google Sheets'
    },
    settings: [
        { name: 'credentialId', label: 'Google Account', type: 'credential', credentialType: 'google-oauth', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Read Rows', 'Append Row', 'Update Row', 'Delete Row', 'Get Sheet Names'], default: 'Read Rows' },
        { name: 'spreadsheetId', label: 'Spreadsheet ID', type: 'expression', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', required: true },
        { name: 'sheetName', label: 'Sheet Name', type: 'expression', placeholder: 'Sheet1', default: 'Sheet1' },
        { name: 'range', label: 'Range (for Read)', type: 'expression', placeholder: 'A1:Z1000' },
        { name: 'data', label: 'Row Data (JSON for Append/Update)', type: 'expression', placeholder: '{"Name": "John", "Email": "john@example.com"}' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Google Account credential required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            var spreadsheetId = processExpression(config.spreadsheetId || '', inputData, context);
            var sheetName = processExpression(config.sheetName || 'Sheet1', inputData, context);
            var range = processExpression(config.range || '', inputData, context);
            var data = processExpression(config.data || '{}', inputData, context);

            getCredentialById(config.credentialId, function (cred) {
                if (!cred) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'google_sheets',
                        credentialId: config.credentialId,
                        operation: config.operation || 'Read Rows',
                        spreadsheetId: spreadsheetId,
                        sheetName: sheetName,
                        range: range,
                        data: data
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: Array.isArray(result.data) ? result.data : [result.data] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['google-drive'] = {
    appearance: {
        name: 'Google Drive',
        icon: '📁',
        color: '#4285f4',
        category: 'google',
        section: 'Google Cloud',
        description: 'Manage Google Drive files'
    },
    settings: [
        { name: 'credentialId', label: 'Google Account', type: 'credential', credentialType: 'google-oauth', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['List Files', 'Upload File', 'Download File', 'Delete File', 'Create Folder', 'Search Files'], default: 'List Files' },
        { name: 'folderId', label: 'Folder ID', type: 'expression', placeholder: 'root or folder ID' },
        { name: 'fileName', label: 'File Name', type: 'expression', placeholder: 'document.pdf' },
        { name: 'fileContent', label: 'File Content (for Upload)', type: 'expression', placeholder: 'Base64 or text content' },
        { name: 'query', label: 'Search Query (for Search)', type: 'expression', placeholder: "name contains 'report'" }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Google Account credential required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (cred) {
                if (!cred) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'google_drive',
                        credentialId: config.credentialId,
                        operation: config.operation || 'List Files',
                        folderId: processExpression(config.folderId || '', inputData, context),
                        fileName: processExpression(config.fileName || '', inputData, context),
                        fileContent: processExpression(config.fileContent || '', inputData, context),
                        query: processExpression(config.query || '', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: Array.isArray(result.data) ? result.data : [result.data] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['gmail'] = {
    appearance: {
        name: 'Gmail',
        icon: '✉️',
        color: '#ea4335',
        category: 'google',
        section: 'Google Cloud',
        description: 'Send/Read Gmail emails'
    },
    settings: [
        { name: 'credentialId', label: 'Google Account', type: 'credential', credentialType: 'google-oauth', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Send Email', 'Get Emails', 'Get Email', 'Mark as Read', 'Add Labels', 'Delete Email'], default: 'Send Email' },
        { name: 'to', label: 'To (for Send)', type: 'expression', placeholder: 'recipient@example.com' },
        { name: 'subject', label: 'Subject (for Send)', type: 'expression', placeholder: 'Email Subject' },
        { name: 'body', label: 'Body (for Send)', type: 'expression', placeholder: 'Email body content...' },
        { name: 'maxResults', label: 'Max Results (for Get)', type: 'number', placeholder: '10', default: '10' },
        { name: 'labelIds', label: 'Label Filter (comma-separated)', type: 'expression', placeholder: 'INBOX,UNREAD' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Google Account credential required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (cred) {
                if (!cred) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'gmail',
                        credentialId: config.credentialId,
                        operation: config.operation || 'Send Email',
                        to: processExpression(config.to || '', inputData, context),
                        subject: processExpression(config.subject || '', inputData, context),
                        body: processExpression(config.body || '', inputData, context),
                        maxResults: parseInt(config.maxResults) || 10,
                        labelIds: processExpression(config.labelIds || '', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: Array.isArray(result.data) ? result.data : [result.data] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['google-calendar'] = {
    appearance: {
        name: 'Google Calendar',
        icon: '📅',
        color: '#4285f4',
        category: 'google',
        section: 'Google Cloud',
        description: 'Manage calendar events'
    },
    settings: [
        { name: 'credentialId', label: 'Google Account', type: 'credential', credentialType: 'google-oauth', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Get Events', 'Create Event', 'Update Event', 'Delete Event', 'Get Calendars'], default: 'Get Events' },
        { name: 'calendarId', label: 'Calendar ID', type: 'expression', placeholder: 'primary', default: 'primary' },
        { name: 'summary', label: 'Event Title', type: 'expression', placeholder: 'Meeting with Team' },
        { name: 'description', label: 'Event Description', type: 'expression', placeholder: 'Discuss project updates' },
        { name: 'startTime', label: 'Start Time (ISO format)', type: 'expression', placeholder: '2025-01-15T10:00:00' },
        { name: 'endTime', label: 'End Time (ISO format)', type: 'expression', placeholder: '2025-01-15T11:00:00' },
        { name: 'maxResults', label: 'Max Events (for Get)', type: 'number', placeholder: '10', default: '10' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Google Account credential required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (cred) {
                if (!cred) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'google_calendar',
                        credentialId: config.credentialId,
                        operation: config.operation || 'Get Events',
                        calendarId: processExpression(config.calendarId || 'primary', inputData, context),
                        summary: processExpression(config.summary || '', inputData, context),
                        description: processExpression(config.description || '', inputData, context),
                        startTime: processExpression(config.startTime || '', inputData, context),
                        endTime: processExpression(config.endTime || '', inputData, context),
                        maxResults: parseInt(config.maxResults) || 10
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: Array.isArray(result.data) ? result.data : [result.data] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};


/* -------------------------------------------------- */
/*      3.8: DATABASE NODES                           */
/* -------------------------------------------------- */

NodeDefinitions['supabase'] = {
    appearance: {
        name: 'Supabase',
        icon: '⚡',
        color: '#3ecf8e',
        category: 'database',
        section: 'Databases',
        description: 'Supabase database operations'
    },
    settings: [
        { name: 'credentialId', label: 'Supabase Credential', type: 'credential', credentialType: 'supabase', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Select', 'Insert', 'Update', 'Upsert', 'Delete', 'RPC (Function Call)'], default: 'Select' },
        { name: 'table', label: 'Table Name', type: 'expression', placeholder: 'users', required: true },
        { name: 'columns', label: 'Columns (comma-separated, for Select)', type: 'expression', placeholder: '*', default: '*' },
        { name: 'filters', label: 'Filters (JSON array)', type: 'expression', placeholder: '[{"column": "id", "operator": "eq", "value": 1}]' },
        { name: 'data', label: 'Data (JSON for Insert/Update)', type: 'expression', placeholder: '{"name": "John", "email": "john@example.com"}' },
        { name: 'rpcName', label: 'Function Name (for RPC)', type: 'expression', placeholder: 'my_function' },
        { name: 'rpcParams', label: 'Function Params (JSON)', type: 'expression', placeholder: '{"param1": "value"}' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Supabase credential required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            var table = processExpression(config.table || '', inputData, context);
            if (!table) {
                resolve({ success: false, error: 'Table name is required', errorType: 'VALIDATION_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (cred) {
                if (!cred) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'supabase',
                        credentialId: config.credentialId,
                        operation: config.operation || 'Select',
                        table: table,
                        columns: processExpression(config.columns || '*', inputData, context),
                        filters: processExpression(config.filters || '[]', inputData, context),
                        data: processExpression(config.data || '{}', inputData, context),
                        rpcName: processExpression(config.rpcName || '', inputData, context),
                        rpcParams: processExpression(config.rpcParams || '{}', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: Array.isArray(result.data) ? result.data : [result.data] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['postgres'] = {
    appearance: {
        name: 'Postgres',
        icon: '🐘',
        color: '#336791',
        category: 'database',
        section: 'Databases',
        description: 'PostgreSQL database queries'
    },
    settings: [
        { name: 'credentialId', label: 'Postgres Credential', type: 'credential', credentialType: 'postgres', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Execute Query', 'Insert', 'Update', 'Delete'], default: 'Execute Query' },
        { name: 'query', label: 'SQL Query', type: 'expression', placeholder: 'SELECT * FROM users WHERE id = $1', required: true },
        { name: 'params', label: 'Query Parameters (JSON array)', type: 'expression', placeholder: '[1, "active"]' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Postgres credential required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            var query = processExpression(config.query || '', inputData, context);
            if (!query) {
                resolve({ success: false, error: 'SQL Query is required', errorType: 'VALIDATION_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (cred) {
                if (!cred) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'postgres',
                        credentialId: config.credentialId,
                        operation: config.operation || 'Execute Query',
                        query: query,
                        params: processExpression(config.params || '[]', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: Array.isArray(result.data) ? result.data : [result.data] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['mysql'] = {
    appearance: {
        name: 'MySQL',
        icon: '🐬',
        color: '#4479a1',
        category: 'database',
        section: 'Databases',
        description: 'MySQL database queries'
    },
    settings: [
        { name: 'credentialId', label: 'MySQL Credential', type: 'credential', credentialType: 'mysql', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Execute Query', 'Insert', 'Update', 'Delete'], default: 'Execute Query' },
        { name: 'query', label: 'SQL Query', type: 'expression', placeholder: 'SELECT * FROM users WHERE id = ?', required: true },
        { name: 'params', label: 'Query Parameters (JSON array)', type: 'expression', placeholder: '[1, "active"]' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'MySQL credential required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            var query = processExpression(config.query || '', inputData, context);
            if (!query) {
                resolve({ success: false, error: 'SQL Query is required', errorType: 'VALIDATION_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (cred) {
                if (!cred) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'mysql',
                        credentialId: config.credentialId,
                        operation: config.operation || 'Execute Query',
                        query: query,
                        params: processExpression(config.params || '[]', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: Array.isArray(result.data) ? result.data : [result.data] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};


/* -------------------------------------------------- */
/*      3.9: COMMUNICATION NODES                      */
/* -------------------------------------------------- */

NodeDefinitions['slack'] = {
    appearance: {
        name: 'Slack',
        icon: '💬',
        color: '#4a154b',
        category: 'communication',
        section: 'Communication',
        description: 'Send Slack messages'
    },
    settings: [
        { name: 'credentialId', label: 'Slack Bot Token', type: 'credential', credentialType: 'slack', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Send Message', 'Upload File', 'Get Channel History', 'List Channels', 'React to Message'], default: 'Send Message' },
        { name: 'channel', label: 'Channel ID', type: 'expression', placeholder: 'C1234567890', required: true },
        { name: 'message', label: 'Message', type: 'expression', placeholder: 'Hello from ArcFlow!' },
        { name: 'blocks', label: 'Blocks (JSON for rich messages)', type: 'expression', placeholder: '[]' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Slack Bot Token required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (token) {
                if (!token) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'slack',
                        token: token,
                        operation: config.operation || 'Send Message',
                        channel: processExpression(config.channel || '', inputData, context),
                        message: processExpression(config.message || '', inputData, context),
                        blocks: processExpression(config.blocks || '[]', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: [result.data] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['discord'] = {
    appearance: {
        name: 'Discord',
        icon: '🎮',
        color: '#5865f2',
        category: 'communication',
        section: 'Communication',
        description: 'Send Discord webhooks'
    },
    settings: [
        { name: 'credentialId', label: 'Discord Webhook', type: 'credential', credentialType: 'discord-webhook', required: true },
        { name: 'content', label: 'Message Content', type: 'expression', placeholder: 'Hello from ArcFlow!', required: true },
        { name: 'username', label: 'Bot Username', type: 'expression', placeholder: 'ArcFlow Bot' },
        { name: 'avatarUrl', label: 'Avatar URL', type: 'expression', placeholder: 'https://example.com/avatar.png' },
        { name: 'embeds', label: 'Embeds (JSON array)', type: 'expression', placeholder: '[]' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Discord Webhook URL required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (webhookUrl) {
                if (!webhookUrl) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'discord',
                        webhookUrl: webhookUrl,
                        content: processExpression(config.content || '', inputData, context),
                        username: processExpression(config.username || '', inputData, context),
                        avatarUrl: processExpression(config.avatarUrl || '', inputData, context),
                        embeds: processExpression(config.embeds || '[]', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: [{ sent: true, timestamp: new Date().toISOString() }] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['telegram'] = {
    appearance: {
        name: 'Telegram',
        icon: '✈️',
        color: '#0088cc',
        category: 'communication',
        section: 'Communication',
        description: 'Send Telegram messages'
    },
    settings: [
        { name: 'credentialId', label: 'Telegram Bot Token', type: 'credential', credentialType: 'telegram', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Send Message', 'Send Photo', 'Send Document', 'Get Updates'], default: 'Send Message' },
        { name: 'chatId', label: 'Chat ID', type: 'expression', placeholder: '123456789', required: true },
        { name: 'text', label: 'Message Text', type: 'expression', placeholder: 'Hello from ArcFlow!' },
        { name: 'parseMode', label: 'Parse Mode', type: 'select', options: ['None', 'Markdown', 'HTML'], default: 'None' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Telegram Bot Token required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (token) {
                if (!token) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'telegram',
                        token: token,
                        operation: config.operation || 'Send Message',
                        chatId: processExpression(config.chatId || '', inputData, context),
                        text: processExpression(config.text || '', inputData, context),
                        parseMode: config.parseMode !== 'None' ? config.parseMode : undefined
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: [result.data] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['send-email'] = {
    appearance: {
        name: 'Send Email',
        icon: '📧',
        color: '#64748b',
        category: 'communication',
        section: 'Communication',
        description: 'Send email via SMTP'
    },
    settings: [
        { name: 'credentialId', label: 'SMTP Credential', type: 'credential', credentialType: 'smtp', required: true },
        { name: 'to', label: 'To Email', type: 'expression', placeholder: 'recipient@example.com', required: true },
        { name: 'subject', label: 'Subject', type: 'expression', placeholder: 'Email Subject', required: true },
        { name: 'body', label: 'Body', type: 'expression', placeholder: 'Email content...' },
        { name: 'isHtml', label: 'Send as HTML', type: 'select', options: ['No', 'Yes'], default: 'No' },
        { name: 'cc', label: 'CC', type: 'expression', placeholder: 'cc@example.com' },
        { name: 'bcc', label: 'BCC', type: 'expression', placeholder: 'bcc@example.com' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'SMTP credential required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (cred) {
                if (!cred) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'send_email',
                        credentialId: config.credentialId,
                        to: processExpression(config.to || '', inputData, context),
                        subject: processExpression(config.subject || '', inputData, context),
                        body: processExpression(config.body || '', inputData, context),
                        isHtml: config.isHtml === 'Yes',
                        cc: processExpression(config.cc || '', inputData, context),
                        bcc: processExpression(config.bcc || '', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            resolve({ success: true, output: [{ sent: true, to: config.to, timestamp: new Date().toISOString() }] });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['github'] = {
    appearance: {
        name: 'GitHub',
        icon: '🐙',
        color: '#24292e',
        category: 'devtools',
        section: 'Development',
        description: 'Manage GitHub repositories, issues, and PRs'
    },
    settings: [
        { name: 'credentialId', label: 'GitHub Token', type: 'credential', credentialType: 'github', required: true },
        { name: 'resource', label: 'Resource', type: 'select', options: ['Issue', 'Pull Request', 'Repository', 'File', 'Release', 'User'], default: 'Issue' },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Create', 'Get', 'Get Many', 'Update', 'Delete', 'Lock', 'Close'], default: 'Get Many' },
        { name: 'owner', label: 'Repository Owner', type: 'expression', placeholder: 'owner', required: true },
        { name: 'repo', label: 'Repository Name', type: 'expression', placeholder: 'repo', required: true },
        { name: 'issueNumber', label: 'Issue/PR Number', type: 'expression', placeholder: '1' },
        { name: 'title', label: 'Title', type: 'expression', placeholder: 'Issue title' },
        { name: 'body', label: 'Body', type: 'expression', placeholder: 'Issue description...' },
        { name: 'labels', label: 'Labels (comma-separated)', type: 'expression', placeholder: 'bug,enhancement' },
        { name: 'state', label: 'State Filter', type: 'select', options: ['all', 'open', 'closed'], default: 'open' },
        { name: 'filePath', label: 'File Path', type: 'expression', placeholder: 'path/to/file.txt' },
        { name: 'fileContent', label: 'File Content (base64)', type: 'expression', placeholder: 'SGVsbG8gV29ybGQ=' },
        { name: 'commitMessage', label: 'Commit Message', type: 'expression', placeholder: 'Update file' }
    ],
    connectors: { hasInput: true, hasOutput: true, isTool: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'GitHub token required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (token) {
                if (!token) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'github',
                        token: token,
                        resource: config.resource || 'Issue',
                        operation: config.operation || 'Get Many',
                        owner: processExpression(config.owner || '', inputData, context),
                        repo: processExpression(config.repo || '', inputData, context),
                        issueNumber: processExpression(config.issueNumber || '', inputData, context),
                        title: processExpression(config.title || '', inputData, context),
                        body: processExpression(config.body || '', inputData, context),
                        labels: processExpression(config.labels || '', inputData, context),
                        state: config.state || 'open',
                        filePath: processExpression(config.filePath || '', inputData, context),
                        fileContent: processExpression(config.fileContent || '', inputData, context),
                        commitMessage: processExpression(config.commitMessage || '', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            var output = result.data;
                            if (!Array.isArray(output)) output = [output];
                            resolve({ success: true, output: output });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['notion'] = {
    appearance: {
        name: 'Notion',
        icon: '📝',
        color: '#000000',
        category: 'productivity',
        section: 'Productivity',
        description: 'Manage Notion pages, databases, and blocks'
    },
    settings: [
        { name: 'credentialId', label: 'Notion API Key', type: 'credential', credentialType: 'notion', required: true },
        { name: 'resource', label: 'Resource', type: 'select', options: ['Page', 'Database', 'Database Page', 'Block', 'User'], default: 'Page' },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Create', 'Get', 'Get Many', 'Update', 'Archive', 'Search', 'Append'], default: 'Get Many' },
        { name: 'pageId', label: 'Page ID', type: 'expression', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
        { name: 'databaseId', label: 'Database ID', type: 'expression', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
        { name: 'parentPageId', label: 'Parent Page ID (for Create)', type: 'expression', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
        { name: 'title', label: 'Title', type: 'expression', placeholder: 'Page Title' },
        { name: 'properties', label: 'Properties (JSON)', type: 'expression', placeholder: '{"Name": {"title": [{"text": {"content": "My Page"}}]}}' },
        { name: 'content', label: 'Content/Blocks (JSON)', type: 'expression', placeholder: '[{"type": "paragraph", "paragraph": {"text": [{"text": {"content": "Hello"}}]}}]' },
        { name: 'searchQuery', label: 'Search Query', type: 'expression', placeholder: 'Search text...' },
        { name: 'filter', label: 'Filter (JSON)', type: 'expression', placeholder: '{"property": "Status", "select": {"equals": "Done"}}' }
    ],
    connectors: { hasInput: true, hasOutput: true, isTool: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Notion API Key required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (apiKey) {
                if (!apiKey) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'notion',
                        apiKey: apiKey,
                        resource: config.resource || 'Page',
                        operation: config.operation || 'Get Many',
                        pageId: processExpression(config.pageId || '', inputData, context),
                        databaseId: processExpression(config.databaseId || '', inputData, context),
                        parentPageId: processExpression(config.parentPageId || '', inputData, context),
                        title: processExpression(config.title || '', inputData, context),
                        properties: processExpression(config.properties || '', inputData, context),
                        content: processExpression(config.content || '', inputData, context),
                        searchQuery: processExpression(config.searchQuery || '', inputData, context),
                        filter: processExpression(config.filter || '', inputData, context)
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            var output = result.data;
                            if (!Array.isArray(output)) output = [output];
                            resolve({ success: true, output: output });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};

NodeDefinitions['airtable'] = {
    appearance: {
        name: 'Airtable',
        icon: '📊',
        color: '#18bfff',
        category: 'productivity',
        section: 'Productivity',
        description: 'Manage Airtable bases, tables, and records'
    },
    settings: [
        { name: 'credentialId', label: 'Airtable Personal Access Token', type: 'credential', credentialType: 'airtable', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Create', 'Get', 'Get Many', 'Update', 'Delete', 'Search', 'List Bases', 'List Tables'], default: 'Get Many' },
        { name: 'baseId', label: 'Base ID', type: 'expression', placeholder: 'appXXXXXXXXXXXXXX', required: true },
        { name: 'tableId', label: 'Table Name or ID', type: 'expression', placeholder: 'Table1 or tblXXXXXXXXXXXXXX' },
        { name: 'recordId', label: 'Record ID', type: 'expression', placeholder: 'recXXXXXXXXXXXXXX' },
        { name: 'fields', label: 'Fields (JSON)', type: 'expression', placeholder: '{"Name": "John Doe", "Email": "john@example.com"}' },
        { name: 'filterByFormula', label: 'Filter By Formula', type: 'expression', placeholder: '{Status} = "Active"' },
        { name: 'maxRecords', label: 'Max Records', type: 'number', placeholder: '100', default: '100' },
        { name: 'view', label: 'View Name', type: 'expression', placeholder: 'Grid view' },
        { name: 'sortField', label: 'Sort Field', type: 'expression', placeholder: 'Created' },
        { name: 'sortDirection', label: 'Sort Direction', type: 'select', options: ['asc', 'desc'], default: 'asc' }
    ],
    connectors: { hasInput: true, hasOutput: true, isTool: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            if (!config.credentialId) {
                resolve({ success: false, error: 'Airtable Personal Access Token required', errorType: 'CREDENTIAL_ERROR' });
                return;
            }

            getCredentialById(config.credentialId, function (token) {
                if (!token) {
                    resolve({ success: false, error: 'Failed to load credential', errorType: 'CREDENTIAL_ERROR' });
                    return;
                }

                fetch('nodes1.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'airtable',
                        token: token,
                        operation: config.operation || 'Get Many',
                        baseId: processExpression(config.baseId || '', inputData, context),
                        tableId: processExpression(config.tableId || '', inputData, context),
                        recordId: processExpression(config.recordId || '', inputData, context),
                        fields: processExpression(config.fields || '', inputData, context),
                        filterByFormula: processExpression(config.filterByFormula || '', inputData, context),
                        maxRecords: parseInt(config.maxRecords) || 100,
                        view: processExpression(config.view || '', inputData, context),
                        sortField: processExpression(config.sortField || '', inputData, context),
                        sortDirection: config.sortDirection || 'asc'
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        if (result.success) {
                            var output = result.data;
                            if (!Array.isArray(output)) output = [output];
                            resolve({ success: true, output: output });
                        } else {
                            resolve({ success: false, error: result.message, errorType: 'API_ERROR' });
                        }
                    })
                    .catch(function (err) {
                        resolve({ success: false, error: err.message, errorType: 'NETWORK_ERROR' });
                    });
            });
        });
    }
};



/* -------------------------------------------------- */
/*      3.9: AI TOOLS                                 */
/* -------------------------------------------------- */



/* -------------------------------------------------- */
/* -------------------------------------------------- */
/*      MEMORY NODES (for AI Models & Agents)         */
/* -------------------------------------------------- */

NodeDefinitions['simple-memory'] = {
    appearance: {
        name: 'Window Buffer Memory',
        icon: '🧠',
        color: '#06b6d4',
        category: 'ai',
        section: 'AI Memory',
        description: 'Store conversation history for AI agents (connects to AI Agent Memory output)'
    },
    settings: [
        { name: 'contextWindow', label: 'Context Window (messages)', type: 'number', placeholder: '10', default: '10' },
        { name: 'sessionIdKey', label: 'Session ID Key', type: 'text', placeholder: 'details.sessionId', default: 'sessionId' }
    ],
    connectors: {
        hasInput: false,        // No left input - receives from AI Agent via TOP
        hasOutput: false,       // No right output - only connects to AI Agent via DOWN/UP specialized connections
        isMemory: true,         // Special memory node flag - renders TOP connector
        connectsUpward: true    // Has TOP connector to receive from AI Agent memory output
    },
    execute: function (inputData, config, context) {
        highlightNode(context.nodeId, '#06b6d4');
        return new Promise(function (resolve) {
            var sessionId = processExpression(config.sessionIdKey || 'default', inputData, context);

            fetch('nodes1.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_chat_history',
                    sessionId: sessionId
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    clearHighlight(context.nodeId);
                    resolve({
                        success: true,
                        output: [{
                            type: 'window-buffer-memory',
                            contextWindow: parseInt(config.contextWindow) || 10,
                            sessionId: sessionId,
                            status: 'ready',
                            messages: data.messages || []
                        }]
                    });
                })
                .catch(function (err) {
                    clearHighlight(context.nodeId);
                    resolve({ success: false, error: 'Memory error: ' + err.message });
                });
        });
    }
};

/* -------------------------------------------------- */
/*      3.10: ADVANCED FLOW CONTROL                   */
/* -------------------------------------------------- */

NodeDefinitions['loop-over-items'] = {
    appearance: {
        name: 'Loop Over Items',
        icon: '🔁',
        color: '#ec4899',
        category: 'flow',
        section: 'Flow',
        description: 'Process items in batches (Loop & Done outputs)'
    },
    settings: [
        { name: 'batchSize', label: 'Batch Size', type: 'number', placeholder: '1', default: '1' },
        { name: 'pauseBetween', label: 'Pause Between Batches (ms)', type: 'number', placeholder: '0', default: '0' },
        { name: 'reset', label: 'Reset on New Input', type: 'select', options: ['Yes', 'No'], default: 'Yes' }
    ],
    connectors: { hasInput: true, hasOutput: true, outputCount: 2 },
    outputLabels: ['Loop', 'Done'],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var batchSize = parseInt(config.batchSize) || 1;

            // Get or initialize loop context
            var loopKey = 'loop_' + context.nodeId;
            var loopContext = context.loopState && context.loopState[loopKey] || {
                currentIndex: 0,
                allItems: items,
                processedItems: []
            };

            // Check if we should reset
            if (config.reset === 'Yes' && loopContext.allItems.length !== items.length) {
                loopContext = {
                    currentIndex: 0,
                    allItems: items,
                    processedItems: []
                };
            }

            var currentIndex = loopContext.currentIndex;
            var totalItems = loopContext.allItems.length;
            var noItemsLeft = currentIndex >= totalItems;

            if (noItemsLeft) {
                // All items processed - output through "Done" port
                resolve({
                    success: true,
                    output: loopContext.processedItems.length > 0 ? loopContext.processedItems : items,
                    outputPort: 1, // Done output
                    _loopInfo: {
                        completed: true,
                        totalItems: totalItems,
                        noItemsLeft: true,
                        currentRunIndex: currentIndex
                    }
                });
            } else {
                // Get current batch
                var endIndex = Math.min(currentIndex + batchSize, totalItems);
                var batch = loopContext.allItems.slice(currentIndex, endIndex);

                // Update context for next iteration
                loopContext.currentIndex = endIndex;

                resolve({
                    success: true,
                    output: batch,
                    outputPort: 0, // Loop output
                    _loopInfo: {
                        completed: false,
                        totalItems: totalItems,
                        batchSize: batchSize,
                        currentRunIndex: currentIndex,
                        noItemsLeft: endIndex >= totalItems,
                        isLoop: true
                    },
                    _loopContext: loopContext
                });
            }
        });
    }
};


NodeDefinitions['split-in-batches'] = {
    appearance: {
        name: 'Split In Batches',
        icon: '📦',
        color: '#ec4899',
        category: 'flow',
        section: 'Flow',
        description: 'Split data into batches'
    },
    settings: [
        { name: 'batchSize', label: 'Batch Size', type: 'number', placeholder: '10', default: '10' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var batchSize = parseInt(config.batchSize) || 10;
            var batches = [];

            for (var i = 0; i < items.length; i += batchSize) {
                batches.push({
                    _batchIndex: Math.floor(i / batchSize),
                    _batchItems: items.slice(i, i + batchSize),
                    _totalBatches: Math.ceil(items.length / batchSize)
                });
            }

            resolve({ success: true, output: batches.length > 0 ? batches : [{ _batchItems: [], _totalBatches: 0 }] });
        });
    }
};

NodeDefinitions['stop-and-error'] = {
    appearance: {
        name: 'Stop and Error',
        icon: '🛑',
        color: '#ef4444',
        category: 'flow',
        section: 'Flow',
        description: 'Stop workflow with error'
    },
    settings: [
        { name: 'errorMessage', label: 'Error Message', type: 'expression', placeholder: 'Workflow stopped due to error', required: true }
    ],
    connectors: { hasInput: true, hasOutput: false },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var message = processExpression(config.errorMessage || 'Workflow stopped', inputData, context);
            resolve({
                success: false,
                error: message,
                errorType: 'USER_STOPPED',
                _isIntentionalStop: true
            });
        });
    }
};


/* -------------------------------------------------- */
/*      3.11: DATA PROCESSING NODES                   */
/* -------------------------------------------------- */









NodeDefinitions['html-extract'] = {
    appearance: {
        name: 'HTML Extract',
        icon: '🔎',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Extract data from HTML'
    },
    settings: [
        { name: 'html', label: 'HTML Content', type: 'expression', placeholder: '{{ $json.html }}', required: true },
        { name: 'selector', label: 'CSS Selector', type: 'expression', placeholder: 'div.content p', required: true },
        { name: 'attribute', label: 'Attribute to Extract', type: 'expression', placeholder: 'text (or href, src, etc.)', default: 'text' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            // This would need a proper HTML parser in production
            var html = processExpression(config.html || '', inputData, context);
            var selector = processExpression(config.selector || '', inputData, context);
            var attribute = processExpression(config.attribute || 'text', inputData, context);

            // Simple extraction mock - in production use backend with DOMParser
            resolve({
                success: true,
                output: [{
                    extracted: '[HTML extraction requires backend processing]',
                    selector: selector,
                    attribute: attribute,
                    inputLength: html.length
                }]
            });
        });
    }
};

NodeDefinitions['compare-datasets'] = {
    appearance: {
        name: 'Compare Datasets',
        icon: '⚖️',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Compare two datasets and find differences'
    },
    settings: [
        { name: 'mergeByField', label: 'Merge By Field', type: 'expression', placeholder: 'id', required: true },
        { name: 'mode', label: 'Output Mode', type: 'select', options: ['Match', 'Append', 'Keep Everything (Outer Join)', 'Wait'], default: 'Match' }
    ],
    connectors: { hasInput: true, hasOutput: true, inputCount: 2, outputCount: 3 },
    outputLabels: ['In Both', 'Only in Input 1', 'Only in Input 2'],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            // For Compare Datasets, we need two inputs
            // In real implementation, this would receive data from two connected nodes
            var input1 = context.input1 || normalizeToArray(inputData);
            var input2 = context.input2 || [];
            var field = config.mergeByField || 'id';

            var set1 = {};
            var set2 = {};

            input1.forEach(function (item) {
                var key = String(item[field] || '');
                set1[key] = item;
            });

            input2.forEach(function (item) {
                var key = String(item[field] || '');
                set2[key] = item;
            });

            var inBoth = [];
            var onlyIn1 = [];
            var onlyIn2 = [];

            Object.keys(set1).forEach(function (key) {
                if (set2[key]) {
                    inBoth.push(Object.assign({}, set1[key], set2[key]));
                } else {
                    onlyIn1.push(set1[key]);
                }
            });

            Object.keys(set2).forEach(function (key) {
                if (!set1[key]) {
                    onlyIn2.push(set2[key]);
                }
            });

            resolve({
                success: true,
                output: inBoth,
                outputPort: 0,
                allOutputs: [inBoth, onlyIn1, onlyIn2],
                _compareInfo: {
                    inBoth: inBoth.length,
                    onlyIn1: onlyIn1.length,
                    onlyIn2: onlyIn2.length,
                    field: field
                }
            });
        });
    }
};

NodeDefinitions['rename-keys'] = {
    appearance: {
        name: 'Rename Keys',
        icon: '🏷️',
        color: '#8b5cf6',
        category: 'data',
        section: 'Data',
        description: 'Rename object keys/field names'
    },
    settings: [
        { name: 'renameMapping', label: 'Key Mappings (JSON)', type: 'expression', placeholder: '{"oldKey": "newKey", "name": "fullName"}', required: true },
        { name: 'keepUnmapped', label: 'Keep Unmapped Keys', type: 'select', options: ['Yes', 'No'], default: 'Yes' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var mapping = {};

            try {
                var mappingStr = processExpression(config.renameMapping || '{}', inputData, context);
                mapping = JSON.parse(mappingStr);
            } catch (e) {
                resolve({ success: false, error: 'Invalid JSON mapping: ' + e.message, errorType: 'PARSE_ERROR' });
                return;
            }

            var keepUnmapped = config.keepUnmapped !== 'No';

            var output = items.map(function (item) {
                var renamed = {};

                Object.keys(item).forEach(function (key) {
                    if (mapping[key]) {
                        renamed[mapping[key]] = item[key];
                    } else if (keepUnmapped) {
                        renamed[key] = item[key];
                    }
                });

                return renamed;
            });

            resolve({ success: true, output: output });
        });
    }
};

NodeDefinitions['crypto'] = {
    appearance: {
        name: 'Crypto',
        icon: '🔐',
        color: '#6366f1',
        category: 'utility',
        section: 'Utility',
        description: 'Hash, encrypt, or generate tokens'
    },
    settings: [
        { name: 'operation', label: 'Operation', type: 'select', options: ['Hash', 'Generate UUID', 'Generate Random', 'Encode Base64', 'Decode Base64'], default: 'Hash' },
        { name: 'algorithm', label: 'Algorithm (for Hash)', type: 'select', options: ['MD5', 'SHA1', 'SHA256', 'SHA512'], default: 'SHA256' },
        { name: 'value', label: 'Value', type: 'expression', placeholder: '{{ $json.password }}' },
        { name: 'encoding', label: 'Output Encoding', type: 'select', options: ['hex', 'base64'], default: 'hex' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var value = processExpression(config.value || '', inputData, context);
            var result;

            switch (config.operation) {
                case 'Generate UUID':
                    result = {
                        uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                            var r = Math.random() * 16 | 0;
                            var v = c === 'x' ? r : (r & 0x3 | 0x8);
                            return v.toString(16);
                        })
                    };
                    break;
                case 'Generate Random':
                    result = { random: Math.random().toString(36).substring(2, 15) };
                    break;
                case 'Encode Base64':
                    result = { encoded: btoa(value) };
                    break;
                case 'Decode Base64':
                    try {
                        result = { decoded: atob(value) };
                    } catch (e) {
                        result = { error: 'Invalid base64 string' };
                    }
                    break;
                case 'Hash':
                default:
                    // Hash requires backend - return placeholder
                    result = { hash: '[Hash requires backend - use nodes1.php]', algorithm: config.algorithm };
            }

            resolve({ success: true, output: [result] });
        });
    }
};



// ================================================
// SUPABASE VECTOR STORE
// ================================================

NodeDefinitions['supabase-vector-store'] = {
    appearance: {
        name: 'Supabase Vector Store',
        icon: '🗄️',
        color: '#3ecf8e',
        category: 'ai',
        section: 'AI',
        description: 'Store and search vectors in Supabase'
    },
    settings: [
        { name: 'credentialId', label: 'Supabase Credential', type: 'credential', credentialType: 'supabase', required: true },
        { name: 'operation', label: 'Operation', type: 'select', options: ['Insert Documents', 'Search Similar', 'Delete Documents', 'Get by ID'], default: 'Insert Documents' },
        { name: 'tableName', label: 'Table Name', type: 'text', placeholder: 'documents', default: 'documents' },
        { name: 'embeddingColumn', label: 'Embedding Column', type: 'text', placeholder: 'embedding', default: 'embedding' },
        { name: 'contentColumn', label: 'Content Column', type: 'text', placeholder: 'content', default: 'content' },
        { name: 'metadataColumn', label: 'Metadata Column', type: 'text', placeholder: 'metadata', default: 'metadata' },
        { name: 'chunkSize', label: 'Chunk Size (characters)', type: 'number', placeholder: '1000', default: '1000' },
        { name: 'chunkOverlap', label: 'Chunk Overlap (characters)', type: 'number', placeholder: '200', default: '200' },
        { name: 'topK', label: 'Top K Results (for search)', type: 'number', placeholder: '5', default: '5' },
        { name: 'similarityThreshold', label: 'Similarity Threshold', type: 'number', placeholder: '0.7', default: '0.7' },
        { name: 'query', label: 'Search Query', type: 'expression', placeholder: '{{ $json.query }}' }
    ],
    connectors: {
        hasInput: true,
        hasOutput: true,
        hasEmbeddingInput: true  // Bottom connector for embedding model
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) {
                resolve({ success: true, output: getPinnedOutput(context.nodeId) });
                return;
            }

            var items = normalizeToArray(inputData);
            var operation = config.operation || 'Insert Documents';
            var chunkSize = parseInt(config.chunkSize) || 1000;
            var chunkOverlap = parseInt(config.chunkOverlap) || 200;

            // Helper function to chunk text
            function chunkText(text, size, overlap) {
                var chunks = [];
                var start = 0;
                while (start < text.length) {
                    var end = Math.min(start + size, text.length);
                    chunks.push(text.slice(start, end));
                    start = end - overlap;
                    if (start < 0) start = end;
                }
                return chunks;
            }

            if (operation === 'Insert Documents') {
                var processedDocs = [];
                items.forEach(function (item, idx) {
                    var content = item.content || item.text || JSON.stringify(item);
                    var chunks = chunkText(content, chunkSize, chunkOverlap);

                    chunks.forEach(function (chunk, chunkIdx) {
                        processedDocs.push({
                            content: chunk,
                            metadata: {
                                originalIndex: idx,
                                chunkIndex: chunkIdx,
                                ...item.metadata
                            }
                        });
                    });
                });

                // Would call Supabase API here
                resolve({
                    success: true,
                    output: [{
                        operation: 'insert',
                        documentsProcessed: items.length,
                        chunksCreated: processedDocs.length,
                        chunkSize: chunkSize,
                        chunkOverlap: chunkOverlap,
                        message: 'Documents chunked and ready for embedding. Connect an Embeddings node below.'
                    }]
                });
            } else if (operation === 'Search Similar') {
                var query = processExpression(config.query || '', inputData, context);
                var topK = parseInt(config.topK) || 5;

                resolve({
                    success: true,
                    output: [{
                        operation: 'search',
                        query: query,
                        topK: topK,
                        results: [],  // Would contain actual search results
                        message: 'Search query prepared. Requires embedding of query text.'
                    }]
                });
            } else {
                resolve({ success: true, output: [{ operation: operation, status: 'pending' }] });
            }
        });
    }
};

// ================================================
// EMBEDDINGS AI MODEL
// ================================================

NodeDefinitions['embeddings-ai'] = {
    appearance: {
        name: 'Embeddings Model',
        icon: '🔢',
        color: '#6366f1',
        category: 'ai',
        section: 'AI',
        description: 'Generate embeddings for text'
    },
    settings: [
        { name: 'provider', label: 'Provider', type: 'select', options: ['OpenAI', 'Google (Gemini)', 'Cohere', 'HuggingFace'], default: 'OpenAI' },
        { name: 'credentialId', label: 'API Credential', type: 'credential', credentialType: 'auto', required: true },
        {
            name: 'model',
            label: 'Model',
            type: 'select',
            options: [
                'text-embedding-3-small',
                'text-embedding-3-large',
                'text-embedding-ada-002',
                'text-embedding-004 (Gemini)',
                'embed-english-v3.0 (Cohere)'
            ],
            default: 'text-embedding-3-small'
        },
        { name: 'dimensions', label: 'Dimensions (OpenAI 3 only)', type: 'number', placeholder: '1536' },
        { name: 'batchSize', label: 'Batch Size', type: 'number', placeholder: '100', default: '100' }
    ],
    connectors: {
        hasInput: false,
        hasOutput: false,
        isEmbeddingModel: true,
        connectsUpward: true
    },
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            var provider = config.provider || 'OpenAI';
            var model = config.model || 'text-embedding-3-small';

            // This would actually call the embedding API
            resolve({
                success: true,
                output: [{
                    provider: provider,
                    model: model,
                    status: 'ready',
                    message: 'Embeddings model configured. Connect to Vector Store above.'
                }]
            });
        });
    }
}




/* ================================================== */
/*                                                    */
/*      SECTION 4: PINNING SYSTEM                     */
/*                                                    */
/* ================================================== */


function isNodePinned(nodeId) {
    return !!(ArcFlow.pinnedData[nodeId] && ArcFlow.pinnedData[nodeId].isPinned);
}

function getPinnedOutput(nodeId) {
    var pinned = ArcFlow.pinnedData[nodeId];
    if (pinned && pinned.output) {
        return pinned.output;
    }
    return null;
}

function pinNode(nodeId, data) {
    var output = normalizeToArray(data);

    ArcFlow.pinnedData[nodeId] = {
        isPinned: true,
        output: output,
        pinnedAt: new Date().toISOString()
    };

    // Also store in execution data for display
    ArcFlow.executionData[nodeId] = {
        output: output,
        status: 'pinned'
    };

    updateNodePinnedVisual(nodeId, true);
    markUnsavedChanges();
}

function unpinNode(nodeId) {
    delete ArcFlow.pinnedData[nodeId];
    updateNodePinnedVisual(nodeId, false);
    markUnsavedChanges();
}

function toggleNodePin(nodeId) {
    if (isNodePinned(nodeId)) {
        unpinNode(nodeId);
        showNotification('Node unpinned', false);
    } else {
        var data = getNodeOutputData(nodeId);
        if (data && (Array.isArray(data) ? data.length > 0 : true)) {
            pinNode(nodeId, data);
            showNotification('Node pinned! 📌', false);
        } else {
            showNotification('No data to pin. Execute the workflow first.', true);
        }
    }

    // Refresh modal if open
    if (ArcFlow.currentModalNodeId === nodeId) {
        refreshNodeModal();
    }
}

function updateNodePinnedVisual(nodeId, isPinned) {
    var el = document.getElementById(nodeId);
    if (!el) return;

    // Remove existing badge
    var badge = el.querySelector('.node-pin-badge');
    if (badge) badge.remove();

    if (isPinned) {
        el.classList.add('pinned');

        var newBadge = document.createElement('div');
        newBadge.className = 'node-pin-badge';
        newBadge.innerHTML = '📌';
        newBadge.title = 'Using pinned data';
        el.appendChild(newBadge);
    } else {
        el.classList.remove('pinned');
    }
}





/* ================================================== */
/*                                                    */
/*      SECTION 5: DATA ACCESS HELPERS                */
/*                                                    */
/* ================================================== */

function getNodeById(nodeId) {
    return ArcFlow.nodes.find(function (n) { return n.id === nodeId; });
}

function getNodeOutputData(nodeId) {
    var node = getNodeById(nodeId);
    if (!node) return null;

    // Priority: Pinned > Execution > Default
    if (isNodePinned(nodeId)) {
        return getPinnedOutput(nodeId);
    }

    if (ArcFlow.executionData[nodeId] && ArcFlow.executionData[nodeId].output) {
        return ArcFlow.executionData[nodeId].output;
    }

    // Return default data from definition
    var def = NodeDefinitions[node.type];
    if (def && def.defaultData) {
        return JSON.parse(JSON.stringify(def.defaultData)); // Deep clone
    }

    return null;
}

function getNodeInputData(nodeId) {
    var inputNode = getDirectInputNode(nodeId);
    if (inputNode) {
        return getNodeOutputData(inputNode.id);
    }
    return null;
}

function getDirectInputNode(nodeId) {
    var conn = ArcFlow.connections.find(function (c) { return c.to === nodeId; });
    return conn ? getNodeById(conn.from) : null;
}

function getConnectedOutputNodes(nodeId) {
    return ArcFlow.connections
        .filter(function (c) { return c.from === nodeId; })
        .map(function (c) { return getNodeById(c.to); })
        .filter(Boolean);
}

function getUpstreamNodes(nodeId) {
    var upstream = [];
    var visited = {};

    function traverse(currentId) {
        ArcFlow.connections.forEach(function (conn) {
            if (conn.to === currentId && !visited[conn.from]) {
                visited[conn.from] = true;
                var node = getNodeById(conn.from);
                if (node) {
                    upstream.push(node);
                    traverse(conn.from);
                }
            }
        });
    }

    traverse(nodeId);
    return upstream;
}


// ================================================== 
// CREDENTIAL TYPES DEFINITION (Synced with landcredits.html)
// ==================================================
var credentialTypes = {
    'google-oauth': { label: 'Google Account (OAuth)', oauth: true },
    'gemini': { label: 'Google Gemini AI' },
    'openai': { label: 'OpenAI' },
    'anthropic': { label: 'Anthropic (Claude)' },
    'github': { label: 'GitHub' },
    'notion': { label: 'Notion' },
    'airtable': { label: 'Airtable' },
    'twilio': { label: 'Twilio' },
    'sendgrid': { label: 'SendGrid' },
    'stripe': { label: 'Stripe' },
    'hubspot': { label: 'HubSpot' },
    'supabase': { label: 'Supabase' },
    'postgres': { label: 'PostgreSQL' },
    'mysql': { label: 'MySQL' },
    'slack': { label: 'Slack' },
    'discord-webhook': { label: 'Discord Webhook' },
    'telegram': { label: 'Telegram Bot' },
    'smtp': { label: 'SMTP Email' },
    'http-header': { label: 'Header Auth' },
    'basic-auth': { label: 'Basic Auth' },
    'bearer-token': { label: 'Bearer Token' },
    'query-auth': { label: 'Query Auth' },
    'aws': { label: 'AWS' },
    'azure': { label: 'Microsoft Azure' },
    'circle': { label: 'Circle API' },
    'circle_developer': { label: 'Circle Developer (Programmable Wallets)' },
    'circle_wallet': { label: 'Circle Wireless Wallet' },
    'arc_wallet': { label: 'Arc Wallet' }
};

function getCredentialById(credId, callback) {
    if (!credId) {
        callback(null);
        return;
    }

    fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_credential', id: credId })
    })
        .then(function (res) { return res.json(); })
        .then(function (result) {
            if (result.success && result.data) {
                // If the stored data has top-level apiKey (legacy)
                if (result.data.apiKey && !result.data.data) {
                    // Normalize to new structure implicitly for caller
                    // But legacy nodes expect string.
                    // We return the raw string if it looks like a simple API key credential?
                    // NO, simpler to return object and let caller handle, OR return "best guess" string if legacy.

                    // Compatibility Hack:
                    // If result.data has apiKey, return that.
                    // If result.data.data has apiKey, return that.
                    // BUT if we need the whole object, this breaks.
                    // SOLUTION: Return an object that toString()s to the key? No, risky.

                    // We will update the callers to handle objects. 
                    // OR, we attach properties to the string? No.

                    // Let's return the full object.
                    var fullCred = result.data;

                    // Normalize: ensure 'data' exists
                    if (!fullCred.data) fullCred.data = {};
                    if (fullCred.apiKey) fullCred.data.apiKey = fullCred.apiKey;

                    callback(fullCred);
                } else {
                    callback(result.data);
                }
            } else {
                callback(null);
            }
        })
        .catch(function () {
            callback(null);
        });
}

function loadCredentialsForSelect(selectEl, node, settingName) {
    if (!selectEl) return;

    // Find expected type from node definition
    var def = NodeDefinitions[node.type];
    var settingDef = def ? def.settings.find(function (s) { return s.name === settingName; }) : null;
    var validType = settingDef ? settingDef.credentialType : null;

    selectEl.innerHTML = '<option value="">Loading...</option>';

    fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_credentials' })
    })
        .then(function (res) { return res.json(); })
        .then(function (result) {
            selectEl.innerHTML = '<option value="">Select Credential...</option>';

            if (result.success && result.data) {
                var filtered = result.data;
                if (validType) {
                    filtered = result.data.filter(function (c) {
                        // Match specific type OR generic 'http-header'/'basic-auth' if compatible?
                        // For strict typing:
                        return c.type === validType;
                    });
                }

                if (filtered.length === 0) {
                    var opt = document.createElement('option');
                    opt.disabled = true;
                    opt.textContent = 'No ' + (validType ? credentialTypes[validType]?.label || validType : 'matching') + ' credentials found';
                    selectEl.appendChild(opt);
                }

                filtered.forEach(function (cred) {
                    var opt = document.createElement('option');
                    opt.value = cred.id;
                    opt.textContent = cred.name;
                    if (node.config[settingName] === cred.id) {
                        opt.selected = true;
                    }
                    selectEl.appendChild(opt);
                });
            }

            selectEl.onchange = function () {
                node.config[settingName] = this.value;
                markUnsavedChanges();
            };
        })
        .catch(function () {
            selectEl.innerHTML = '<option value="">Error loading list</option>';
        });
}

function openCredentialModal(selectEl) {
    // Redirect to credentials page in new tab? 
    // Or better, just open the page.
    window.open('landcredits.html?id=new', '_blank');

    // Auto-refresh select when they come back?
    // We can set a focus listener
    var handleFocus = function () {
        // Reload list
        var settingName = selectEl.getAttribute('data-setting'); // We need to pass this or use closure
        // Since we are inside closure in renderSettingsPanel, we can't easily re-call.
        // We will just invoke the load again if we had the params.
        // Implementation detail: renderSettingsPanel should attach a refresh capability.
    };
    window.addEventListener('focus', handleFocus, { once: true });
}






/* ================================================== */
/*                                                    */
/*      SECTION 6: INITIALIZATION                     */
/*                                                    */
/* ================================================== */

function initArcFlow() {
    // Only init on workflow editor page
    if (window.location.pathname.indexOf('landwork.html') === -1) return;

    console.log('%c ArcFlow Engine v7.0 ', 'background: #8b5cf6; color: white; font-size: 14px; padding: 5px 10px; border-radius: 5px;');
    console.log('Built for Arc.Network Hackathon');

    setupCanvas();
    setupNodePanel();
    setupViewportControls();
    setupKeyboardShortcuts();
    setupExecutionControls();
    setupUnsavedChangesWarning();

    renderNodePanel();
    createNodeModal();
    createDataEditorModal();
    createExpressionHelpModal();

    // Start polling for webhook triggers (every 2s)
    setInterval(pollWebhookTriggers, 2000);

    console.log('✓ Loaded ' + Object.keys(NodeDefinitions).length + ' node types');
}

function pollWebhookTriggers() {
    // Only poll if on editor page
    if (window.location.pathname.indexOf('landwork.html') === -1) return;

    fetch('/api/webhook-triggers')
        .then(function (res) { return res.json(); })
        .then(function (res) {
            if (res.success && res.triggers && res.triggers.length > 0) {
                handleWebhookExecutions(res.triggers);
            }
        })
        .catch(function (err) {
            // Silent error to avoid console flood
        });
}

function handleWebhookExecutions(triggers) {
    // Queue webhook if already executing - don't lose it
    if (ArcFlow.isExecuting) {
        console.log('⏳ Workflow running, webhook queued for retry');
        ArcFlow.pendingWebhook = triggers[triggers.length - 1];
        return;
    }

    // Use latest trigger
    var trigger = triggers[triggers.length - 1];

    // Find matching webhook node - normalize paths for comparison
    var webhookNode = ArcFlow.nodes.find(function (n) {
        var def = NodeDefinitions[n.type];
        if (!def) return false;

        // Match if it's a trigger and has the same path
        var isTrigger = def.appearance && def.appearance.category === 'trigger';
        if (!isTrigger) return false;

        // Normalize paths - remove leading slashes and trailing slashes
        var nodePath = (n.config.path || '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
        var trigPath = (trigger.path || '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();

        console.log('[Webhook] Comparing paths:', nodePath, 'vs', trigPath);
        return nodePath === trigPath;
    });

    if (!webhookNode) {
        console.log('⚠️ Webhook received but no matching node found for path:', trigger.path);
        console.log('Available webhook nodes:', ArcFlow.nodes.filter(n => n.type === 'webhook-trigger').map(n => n.config.path));
        // Clear queue anyway to prevent infinite loop
        fetch('/api/webhook-triggers', { method: 'DELETE' });
        return;
    }

    console.log('⚡ Triggering workflow from Webhook:', trigger.path);
    showNotification('Webhook Triggered: ' + trigger.method + ' ' + trigger.path, false);

    // Stop waiting state
    ArcFlow.isWaitingForTrigger = false;
    ArcFlow.waitingTriggerId = null;
    hideExecutionNotification();

    // Prepare output data
    var outputData = [{
        body: trigger.body,
        query: trigger.query,
        headers: trigger.headers,
        method: trigger.method,
        path: trigger.path,
        json: trigger.body // n8n parity - $json accesses body directly
    }];

    // Execute workflow
    runFromTrigger(webhookNode, outputData);

    // Clear queue after triggering
    fetch('/api/webhook-triggers', { method: 'DELETE' });
}

document.addEventListener('DOMContentLoaded', initArcFlow);


function setupUnsavedChangesWarning() {
    var backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', function (e) {
            if (ArcFlow.hasUnsavedChanges) {
                e.preventDefault();
                showUnsavedChangesModal('work.html');
            }
        });
    }

    // Handle browser back button
    window.addEventListener('beforeunload', function (e) {
        if (ArcFlow.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

function showUnsavedChangesModal(destination) {
    var modal = document.getElementById('unsavedModal');
    if (!modal) return;

    modal.classList.add('active');

    var discardBtn = document.getElementById('discardChanges');
    var saveBtn = document.getElementById('saveAndLeave');

    if (discardBtn) {
        discardBtn.onclick = function () {
            ArcFlow.hasUnsavedChanges = false;
            modal.classList.remove('active');
            window.location.href = destination;
        };
    }

    if (saveBtn) {
        saveBtn.onclick = function () {
            var btn = this;
            var originalText = btn.innerText;
            btn.innerText = 'Saving...';

            if (typeof saveWorkflow === 'function') {
                saveWorkflow().then(function () {
                    ArcFlow.hasUnsavedChanges = false;
                    modal.classList.remove('active');
                    window.location.href = destination;
                }).catch(function () {
                    btn.innerText = originalText;
                });
            } else {
                modal.classList.remove('active');
                window.location.href = destination;
            }
        };
    }
}

function markUnsavedChanges() {
    ArcFlow.hasUnsavedChanges = true;
    var title = document.getElementById('workflowTitle');
    if (title && !title.classList.contains('unsaved')) {
        title.classList.add('unsaved');
    }
}

function clearUnsavedChanges() {
    ArcFlow.hasUnsavedChanges = false;
    var title = document.getElementById('workflowTitle');
    if (title) {
        title.classList.remove('unsaved');
    }
}





/* ================================================== */
/*                                                    */
/*      SECTION 7: CANVAS SETUP & EVENTS              */
/*                                                    */
/* ================================================== */

function setupCanvas() {
    var canvas = document.getElementById('editorCanvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', onCanvasMouseDown);
    // Use document for global move/up handling to prevent stuck drags
    document.addEventListener('mousemove', onCanvasMouseMove);
    document.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    canvas.addEventListener('click', function (e) {
        if (e.target === canvas || e.target.classList.contains('canvas-grid')) {
            deselectAll();
        }
    });
}

function onCanvasMouseDown(e) {
    // Space + click = pan
    if (ArcFlow.isSpacePressed) {
        ArcFlow.isPanning = true;
        ArcFlow.lastMouseX = e.clientX;
        ArcFlow.lastMouseY = e.clientY;
        document.body.classList.add('panning');
        e.preventDefault();
    }
}

function onCanvasMouseMove(e) {
    // Panning
    if (ArcFlow.isPanning) {
        var dx = e.clientX - ArcFlow.lastMouseX;
        var dy = e.clientY - ArcFlow.lastMouseY;
        ArcFlow.panX += dx;
        ArcFlow.panY += dy;
        ArcFlow.lastMouseX = e.clientX;
        ArcFlow.lastMouseY = e.clientY;
        applyCanvasTransform();
        return;
    }

    // Node dragging
    if (ArcFlow.isDraggingNode && ArcFlow.draggedNode) {
        var canvas = document.getElementById('editorCanvas');
        var rect = canvas.getBoundingClientRect();
        var x = (e.clientX - rect.left - ArcFlow.panX - ArcFlow.dragOffset.x) / ArcFlow.zoom;
        var y = (e.clientY - rect.top - ArcFlow.panY - ArcFlow.dragOffset.y) / ArcFlow.zoom;

        ArcFlow.draggedNode.x = Math.max(0, Math.round(x));
        ArcFlow.draggedNode.y = Math.max(0, Math.round(y));

        updateNodePosition(ArcFlow.draggedNode);
        renderConnections();
        markUnsavedChanges();
    }

    // Connection dragging with AUTO-CONNECT on proximity
    if (ArcFlow.isConnecting) {
        drawTemporaryConnection(e);

        // Auto-connect: Check if cursor is close to ANY connector
        var proximityThreshold = 25; // Tightened from 30
        var connectors = document.querySelectorAll('.connector');
        var closestConnector = null;
        var minDistance = Infinity;

        connectors.forEach(function (connector) {
            // Filter incompatible types
            var isInput = connector.classList.contains('connector-in') ||
                connector.classList.contains('connector-top-in') ||
                connector.classList.contains('connector-bottom-in') ||
                connector.querySelector('.connector-in'); // Check children too

            var isOutput = connector.classList.contains('connector-out') ||
                connector.classList.contains('connector-top-out') ||
                connector.classList.contains('connector-bottom-out') ||
                connector.classList.contains('connector-top-plus');

            // If dragging FROM Input, we need Output target
            if (ArcFlow.dragFromInput && !isOutput) return;
            // If dragging FROM Output, we need Input target
            if (!ArcFlow.dragFromInput && !isInput) return;

            // Type Compatibility Check
            var startType = ArcFlow.connectionType;
            var targetType = connector.getAttribute('data-conn-type');

            if (!checkConnectionTypeCompatibility(startType, targetType)) return;

            var connRect = connector.getBoundingClientRect();
            var connCenterX = connRect.left + connRect.width / 2;
            var connCenterY = connRect.top + connRect.height / 2;

            var distance = Math.sqrt(
                Math.pow(e.clientX - connCenterX, 2) +
                Math.pow(e.clientY - connCenterY, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestConnector = connector;
            }

            // Clear highlights (will re-add for closest)
            connector.classList.remove('highlight');
        });

        if (closestConnector && minDistance < proximityThreshold) {
            closestConnector.classList.add('highlight');

            // Auto-snap VISUAL ONLY (Complete on mouseup)
            if (minDistance < 15) { // Tightened from 20 for sharper snap
                var targetId = closestConnector.getAttribute('data-node-id');
                var startId = ArcFlow.connectionStartNodeId;

                // Validate before snapping
                var alreadyConnected = ArcFlow.connections.some(function (c) {
                    if (ArcFlow.dragFromInput) {
                        return c.from === targetId && c.to === startId;
                    } else {
                        return c.from === startId && c.to === targetId;
                    }
                });

                var isSelf = startId === targetId;

                if (!alreadyConnected && !isSelf) {
                    ArcFlow.snapTarget = closestConnector;
                } else {
                    ArcFlow.snapTarget = null;
                }
            } else {
                ArcFlow.snapTarget = null;
            }
        } else {
            ArcFlow.snapTarget = null;
        }
    }

    // Field dragging
    if (ArcFlow.isDraggingField) {
        updateDragGhost(e);
    }
}

function onCanvasMouseUp(e) {
    if (ArcFlow.isPanning) {
        ArcFlow.isPanning = false;
        document.body.classList.remove('panning');
    }

    if (ArcFlow.isDraggingNode && ArcFlow.draggedNode) {
        var nodeEl = document.getElementById(ArcFlow.draggedNode.id);
        if (nodeEl) nodeEl.classList.remove('dragging');
        ArcFlow.isDraggingNode = false;
        ArcFlow.draggedNode = null;
    }

    if (ArcFlow.isConnecting) {
        var targetId = ArcFlow.snapTarget ? ArcFlow.snapTarget.getAttribute('data-node-id') : null;
        completeConnection(e, targetId);
        ArcFlow.snapTarget = null; // Reset
    }
}

function onCanvasWheel(e) {
    e.preventDefault();

    var canvas = document.getElementById('editorCanvas');
    var rect = canvas.getBoundingClientRect();

    // Mouse position relative to canvas
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;

    // Point in canvas space before zoom
    var pointX = (mouseX - ArcFlow.panX) / ArcFlow.zoom;
    var pointY = (mouseY - ArcFlow.panY) / ArcFlow.zoom;

    // Calculate new zoom
    var delta = e.deltaY > 0 ? -0.1 : 0.1;
    var newZoom = Math.max(0.25, Math.min(2, ArcFlow.zoom + delta));

    if (newZoom === ArcFlow.zoom) return;

    // Adjust pan to keep mouse point stationary
    ArcFlow.panX = mouseX - pointX * newZoom;
    ArcFlow.panY = mouseY - pointY * newZoom;
    ArcFlow.zoom = newZoom;

    updateZoomDisplay();
    applyCanvasTransform();
}

function applyCanvasTransform() {
    var container = document.getElementById('canvasNodes');
    if (!container) return;

    container.style.transform = 'translate(' + ArcFlow.panX + 'px, ' + ArcFlow.panY + 'px) scale(' + ArcFlow.zoom + ')';
    container.style.transformOrigin = '0 0';

    renderConnections();
}

function updateZoomDisplay() {
    var el = document.getElementById('zoomLevel');
    if (el) {
        el.textContent = Math.round(ArcFlow.zoom * 100) + '%';
    }
}

function deselectAll() {
    // Deselect nodes
    document.querySelectorAll('.canvas-node.selected').forEach(function (el) {
        el.classList.remove('selected');
    });
    ArcFlow.selectedNodeId = null;
    ArcFlow.selectedConnectionId = null;
}





/* ================================================== */
/*                                                    */
/*      SECTION 8: VIEWPORT CONTROLS                  */
/*                                                    */
/* ================================================== */

function setupViewportControls() {
    var zoomIn = document.getElementById('zoomIn');
    var zoomOut = document.getElementById('zoomOut');

    if (zoomIn) {
        zoomIn.addEventListener('click', function () {
            zoomBy(0.25);
        });
    }

    if (zoomOut) {
        zoomOut.addEventListener('click', function () {
            zoomBy(-0.25);
        });
    }
}

function zoomBy(delta) {
    var canvas = document.getElementById('editorCanvas');
    if (!canvas) return;

    var rect = canvas.getBoundingClientRect();
    var centerX = rect.width / 2;
    var centerY = rect.height / 2;

    var pointX = (centerX - ArcFlow.panX) / ArcFlow.zoom;
    var pointY = (centerY - ArcFlow.panY) / ArcFlow.zoom;

    var newZoom = Math.max(0.25, Math.min(2, ArcFlow.zoom + delta));

    if (newZoom === ArcFlow.zoom) return;

    ArcFlow.panX = centerX - pointX * newZoom;
    ArcFlow.panY = centerY - pointY * newZoom;
    ArcFlow.zoom = newZoom;

    updateZoomDisplay();
    applyCanvasTransform();
}





/* ================================================== */
/*                                                    */
/*      SECTION 9: KEYBOARD SHORTCUTS                 */
/*                                                    */
/* ================================================== */

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
        // Skip if in input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Space for pan mode
        if (e.code === 'Space' && !ArcFlow.isSpacePressed) {
            e.preventDefault();
            ArcFlow.isSpacePressed = true;
            document.body.style.cursor = 'grab';
        }

        // Escape - close everything
        if (e.key === 'Escape') {
            closeNodeModal();
            closeNodePanel();
            closeAllModals();
            clearTemporaryConnection();
            ArcFlow.isConnecting = false;
            cancelFieldDrag();
            deselectAll();
        }

        // Delete selected node
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (ArcFlow.selectedNodeId) {
                deleteNode(ArcFlow.selectedNodeId);
            }
        }

        // Ctrl+S / Cmd+S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (typeof saveWorkflow === 'function') {
                saveWorkflow();
            }
        }

        // Ctrl+Z / Cmd+Z for undo (placeholder)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            // TODO: Implement undo
        }

        // + and - for zoom
        if (e.key === '+' || e.key === '=') {
            zoomBy(0.1);
        }
        if (e.key === '-') {
            zoomBy(-0.1);
        }

        // 0 to reset zoom
        if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            ArcFlow.zoom = 1;
            ArcFlow.panX = 0;
            ArcFlow.panY = 0;
            updateZoomDisplay();
            applyCanvasTransform();
        }
    });

    document.addEventListener('keyup', function (e) {
        if (e.code === 'Space') {
            ArcFlow.isSpacePressed = false;
            ArcFlow.isPanning = false;
            document.body.style.cursor = '';
            document.body.classList.remove('panning');
        }
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(function (modal) {
        modal.classList.remove('active');
    });
}





/* ================================================== */
/*                                                    */
/*      SECTION 10: NODE PANEL                        */
/*                                                    */
/* ================================================== */

function setupNodePanel() {
    var toggle = document.getElementById('nodesToggle');
    var close = document.getElementById('panelClose');
    var overlay = document.getElementById('panelOverlay');
    var search = document.getElementById('nodeSearch');

    if (toggle) {
        toggle.addEventListener('click', toggleNodePanel);
    }

    if (close) {
        close.addEventListener('click', closeNodePanel);
    }

    if (overlay) {
        overlay.addEventListener('click', closeNodePanel);
    }

    if (search) {
        search.addEventListener('input', filterNodes);
    }
}

function toggleNodePanel() {
    var panel = document.getElementById('nodesPanel');
    var overlay = document.getElementById('panelOverlay');
    var toggle = document.getElementById('nodesToggle');

    if (panel) panel.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
    if (toggle) toggle.classList.toggle('active');

    // Filter triggers if connecting from another node
    if (panel && panel.classList.contains('active')) {
        var triggers = document.querySelector('.panel-section[data-section="triggers"]');
        if (triggers) {
            triggers.style.display = ArcFlow.connectionStartNodeId ? 'none' : 'block';
        }
    }
}

function openNodePanel() {
    var panel = document.getElementById('nodesPanel');
    var overlay = document.getElementById('panelOverlay');
    var toggle = document.getElementById('nodesToggle');

    if (panel) panel.classList.add('active');
    if (overlay) overlay.classList.add('active');
    if (toggle) toggle.classList.add('active');

    // Focus search
    var search = document.getElementById('nodeSearch');
    if (search) {
        setTimeout(function () { search.focus(); }, 100);
    }
}

function closeNodePanel() {
    var panel = document.getElementById('nodesPanel');
    var overlay = document.getElementById('panelOverlay');
    var toggle = document.getElementById('nodesToggle');

    if (panel) panel.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    if (toggle) toggle.classList.remove('active');

    // Clear pending connection
    ArcFlow.pendingConnectionNodeId = null;

    // Clear search
    var search = document.getElementById('nodeSearch');
    if (search) search.value = '';
    filterNodes({ target: { value: '' } });
}

function renderNodePanel() {
    var container = document.querySelector('.panel-sections');
    if (!container) return;

    container.innerHTML = '';

    // Group nodes by section
    var sections = {};
    Object.keys(NodeDefinitions).forEach(function (type) {
        var def = NodeDefinitions[type];
        var section = def.appearance.section || 'Other';
        if (!sections[section]) {
            sections[section] = [];
        }
        sections[section].push({ type: type, def: def });
    });

    // Define section order
    var sectionOrder = ['Triggers', 'AI Models', 'Actions', 'Data', 'Flow', 'Utility', 'Arc Network'];

    // Render sections in order
    sectionOrder.forEach(function (sectionName) {
        if (sections[sectionName]) {
            container.appendChild(createNodeSection(sectionName, sections[sectionName]));
            delete sections[sectionName];
        }
    });

    // Render remaining sections
    Object.keys(sections).forEach(function (sectionName) {
        container.appendChild(createNodeSection(sectionName, sections[sectionName]));
    });
}

function createNodeSection(name, nodes) {
    var section = document.createElement('div');
    section.className = 'panel-section';
    section.setAttribute('data-section', name.toLowerCase());

    var header = document.createElement('div');
    header.className = 'section-toggle';
    header.innerHTML =
        '<span class="toggle-arrow">▶</span>' +
        '<span class="toggle-title">' + escapeHtml(name) + '</span>' +
        '<span class="section-count">' + nodes.length + '</span>';

    var content = document.createElement('div');
    content.className = 'section-nodes';

    nodes.forEach(function (item) {
        content.appendChild(createNodeItem(item.type, item.def));
    });

    header.addEventListener('click', function () {
        header.classList.toggle('active');
        content.classList.toggle('active');
    });

    section.appendChild(header);
    section.appendChild(content);

    return section;
}

function createNodeItem(type, def) {
    var item = document.createElement('div');
    item.className = 'panel-node';
    item.setAttribute('data-type', type);
    item.setAttribute('data-name', def.appearance.name.toLowerCase());
    item.setAttribute('data-description', def.appearance.description.toLowerCase());

    var iconBg = 'linear-gradient(135deg, ' + def.appearance.color + '33, ' + def.appearance.color + '11)';

    item.innerHTML =
        '<div class="panel-node-icon" style="background:' + iconBg + ';color:' + def.appearance.color + ';">' +
        def.appearance.icon +
        '</div>' +
        '<div class="panel-node-info">' +
        '<span class="panel-node-name">' + escapeHtml(def.appearance.name) + '</span>' +
        '<span class="panel-node-desc">' + escapeHtml(def.appearance.description) + '</span>' +
        '</div>';

    item.addEventListener('click', function () {
        addNodeToCanvas(type);
        closeNodePanel();
    });

    return item;
}

function filterNodes(e) {
    var query = (e.target.value || '').toLowerCase().trim();

    document.querySelectorAll('.panel-section').forEach(function (section) {
        var hasVisible = false;

        section.querySelectorAll('.panel-node').forEach(function (node) {
            var name = node.getAttribute('data-name') || '';
            var desc = node.getAttribute('data-description') || '';
            var type = node.getAttribute('data-type') || '';

            var matches = !query ||
                name.includes(query) ||
                desc.includes(query) ||
                type.includes(query);

            node.style.display = matches ? '' : 'none';
            if (matches) hasVisible = true;
        });

        section.style.display = hasVisible ? '' : 'none';

        // Auto-expand sections when searching
        if (query && hasVisible) {
            section.querySelector('.section-toggle').classList.add('active');
            section.querySelector('.section-nodes').classList.add('active');
        }
    });
}





/* ================================================== */
/*                                                    */
/*      SECTION 11: NODE CREATION & RENDERING         */
/*                                                    */
/* ================================================== */

function addNodeToCanvas(type) {
    var def = NodeDefinitions[type];
    if (!def) {
        console.error('Unknown node type:', type);
        return;
    }

    // Hide placeholder
    var placeholder = document.getElementById('canvasPlaceholder');
    if (placeholder) placeholder.classList.add('hidden');

    // Generate unique ID
    ArcFlow.nodeCounter++;
    var id = 'node_' + ArcFlow.nodeCounter + '_' + Date.now();

    // Calculate position
    var x = 200 + (ArcFlow.nodes.length % 5) * 50;
    var y = 150 + Math.floor(ArcFlow.nodes.length / 5) * 50;

    // If adding from connection, position relative to source
    if (ArcFlow.pendingConnectionNodeId) {
        var sourceNode = getNodeById(ArcFlow.pendingConnectionNodeId);
        if (sourceNode) {
            x = sourceNode.x + 350;
            y = sourceNode.y;
        }
    }

    // Create node object
    var node = {
        id: id,
        type: type,
        name: def.appearance.name,
        x: x,
        y: y,
        config: {}
    };

    // Initialize config with defaults
    def.settings.forEach(function (setting) {
        node.config[setting.name] = setting.default || '';
    });

    // Add to state
    ArcFlow.nodes.push(node);

    // Render on canvas
    renderNode(node);

    // Create connection if pending
    if (ArcFlow.pendingConnectionNodeId && def.connectors.hasInput) {
        createConnection(ArcFlow.pendingConnectionNodeId, id);
        ArcFlow.pendingConnectionNodeId = null;
    }

    markUnsavedChanges();

    // Select the new node
    selectNode(id);
}

function renderNode(node) {
    var def = NodeDefinitions[node.type];
    if (!def) return;

    var container = document.getElementById('canvasNodes');
    if (!container) return;

    // Create node element
    var el = document.createElement('div');
    el.className = 'canvas-node';
    el.id = node.id;
    el.setAttribute('data-type', node.type);
    el.setAttribute('data-category', def.appearance.category);
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';

    var iconStyle = 'background:linear-gradient(135deg,' + def.appearance.color + '33,' + def.appearance.color + '11);color:' + def.appearance.color;

    var html = '';

    // Input connector
    if (def.connectors.hasInput) {
        html += '<div class="node-connector-input">' +
            '<div class="connector connector-in" data-node-id="' + node.id + '"></div>' +
            '</div>';
    }

    // Main node content
    html += '<div class="node-main">' +
        '<div class="node-header">' +
        '<div class="node-icon" style="' + iconStyle + '">' + def.appearance.icon + '</div>' +
        '<div class="node-info">' +
        '<div class="node-type-label">' + escapeHtml(def.appearance.category) + '</div>' +
        '</div>' +
        '<div class="node-actions">' +
        '<button class="node-btn node-settings-btn" title="Settings">⚙️</button>' +
        '<button class="node-btn node-delete-btn" title="Delete">✕</button>' +
        '</div>' +
        '</div>' +
        '<div class="node-body">' +
        '<div class="node-drag-area">' +
        '<span class="drag-handle">⋮⋮</span>' +
        '</div>' +
        '</div>' +
        '</div>';

    // Output connector(s) - support multiple outputs
    if (def.connectors.hasOutput) {
        var outputCount = (def.connectors.dynamicOutputCount && node.config && node.config.outputCount)
            ? parseInt(node.config.outputCount) : (def.connectors.outputCount || 1);

        if (outputCount > 1) {
            // Multiple outputs (Switch, Loop Over Items, etc.)
            html += '<div class="node-connector-output-multi">';
            for (var oi = 0; oi < outputCount; oi++) {
                var outputLabel = def.outputLabels ? def.outputLabels[oi] : ('Output ' + oi);
                if (node.config && node.config['output' + oi + 'Label']) {
                    outputLabel = node.config['output' + oi + 'Label'];
                }
                html += '<div class="output-connector-row" data-output-index="' + oi + '">' +
                    '<span class="output-label">' + escapeHtml(outputLabel) + '</span>' +
                    '<div class="connector connector-out" data-node-id="' + node.id + '" data-output-index="' + oi + '">' +
                    '<div class="connector-wire"></div>' +
                    '<div class="connector-plus" data-node-id="' + node.id + '" data-output-index="' + oi + '" title="Drag to connect">+</div>' +
                    '</div>' +
                    '</div>';
            }
            html += '</div>';
        } else {
            // Single output
            html += '<div class="node-connector-output">' +
                '<div class="connector connector-out" data-node-id="' + node.id + '">' +
                '<div class="connector-wire"></div>' +
                '<div class="connector-plus" data-node-id="' + node.id + '" title="Drag to connect">+</div>' +
                '</div>' +
                '</div>';
        }
    }

    // ================================================
    // BOTTOM CONNECTORS (OUTPUT - for AI Agent, Vector Store)
    // These are OUTPUT connectors that "pop out" like pipes (n8n style)
    // ================================================

    var hasBottomConnectors = def.connectors.hasToolInput || def.connectors.hasMemoryInput || def.connectors.hasEmbeddingInput || def.connectors.hasChatModelInput;

    if (hasBottomConnectors) {
        html += '<div class="node-bottom-connectors">';

        // Chat Model OUTPUT (for AI Agent)
        if (def.connectors.hasChatModelInput) {
            html += '<div class="bottom-connector-group chat-model-connector">' +
                '<div class="connector-bottom-label">💬 Chat Model</div>' +
                '<div class="connector connector-bottom-out" data-node-id="' + node.id + '" data-conn-type="chatModel" title="Drag to connect Chat Model">' +
                '<div class="connector-bottom-wire"></div>' +
                '<div class="connector-bottom-plus" data-node-id="' + node.id + '" data-conn-type="chatModel">+</div>' +
                '</div>' +
                '</div>';
        }

        // Memory OUTPUT (for AI Agent)
        if (def.connectors.hasMemoryInput) {
            html += '<div class="bottom-connector-group memory-connector">' +
                '<div class="connector-bottom-label">🧠 Memory</div>' +
                '<div class="connector connector-bottom-out" data-node-id="' + node.id + '" data-conn-type="memory" title="Drag to connect Memory">' +
                '<div class="connector-bottom-wire"></div>' +
                '<div class="connector-bottom-plus" data-node-id="' + node.id + '" data-conn-type="memory">+</div>' +
                '</div>' +
                '</div>';
        }

        // Tools OUTPUT (for AI Agent)
        if (def.connectors.hasToolInput) {
            html += '<div class="bottom-connector-group tool-connector">' +
                '<div class="connector-bottom-label">🔧 Tools</div>' +
                '<div class="connector connector-bottom-out" data-node-id="' + node.id + '" data-conn-type="tool" title="Drag to connect Tools">' +
                '<div class="connector-bottom-wire"></div>' +
                '<div class="connector-bottom-plus" data-node-id="' + node.id + '" data-conn-type="tool">+</div>' +
                '</div>' +
                '</div>';
        }

        // Embeddings OUTPUT (for Vector Store)
        if (def.connectors.hasEmbeddingInput) {
            html += '<div class="bottom-connector-group embedding-connector">' +
                '<div class="connector-bottom-label">🔢 Embeddings</div>' +
                '<div class="connector connector-bottom-out" data-node-id="' + node.id + '" data-conn-type="embedding" title="Drag to connect Embedding Model">' +
                '<div class="connector-bottom-wire"></div>' +
                '<div class="connector-bottom-plus" data-node-id="' + node.id + '" data-conn-type="embedding">+</div>' +
                '</div>' +
                '</div>';
        }

        html += '</div>';
    }

    // ================================================
    // TOP CONNECTORS (Tool nodes connect upward)
    // ================================================

    // Tool Output (Top - for Tool Nodes that connect to AI Agent)
    if (def.connectors.isTool || (def.connectors.connectsUpward && !def.connectors.isMemory)) {
        html += '<div class="node-connector-top">' +
            '<div class="connector-top-wire"></div>' +
            '<div class="connector connector-top-out" data-node-id="' + node.id + '" data-conn-type="tool" title="Connect to AI Agent">' +
            '<div class="connector-top-plus">↑</div>' +
            '</div>' +
            '</div>';
    }

    // Memory Output (Top - for Memory Nodes that connect to AI Model Memory input)
    if (def.connectors.isMemory) {
        html += '<div class="node-connector-top memory-top-connector">' +
            '<div class="connector-top-wire memory-wire"></div>' +
            '<div class="connector connector-top-out memory-connector" data-node-id="' + node.id + '" data-conn-type="memory" title="Connect to AI Model Memory">' +
            '<div class="connector-top-plus">↑</div>' +
            '</div>' +
            '</div>';
    }

    // Embedding Model Output (Top - connects to Vector Store)
    if (def.connectors.isEmbeddingModel) {
        html += '<div class="node-connector-top">' +
            '<div class="connector-top-wire"></div>' +
            '<div class="connector connector-top-out" data-node-id="' + node.id + '" data-conn-type="embedding" title="Connect to Vector Store">' +
            '<div class="connector-top-plus">↑</div>' +
            '</div>' +
            '</div>';
    }

    el.innerHTML = html;

    // Add name label below node
    var nameLabel = document.createElement('div');
    nameLabel.className = 'node-name-label';
    nameLabel.innerHTML = '<span class="node-name-text">' + escapeHtml(node.name) + '</span>';
    el.appendChild(nameLabel);

    container.appendChild(el);

    // Attach events
    attachNodeEvents(el, node);

    // Restore pinned visual if applicable
    if (isNodePinned(node.id)) {
        updateNodePinnedVisual(node.id, true);
    }
}

function attachNodeEvents(el, node) {
    // Drag handle
    var dragArea = el.querySelector('.node-drag-area');
    if (dragArea) {
        dragArea.addEventListener('mousedown', function (e) {
            if (ArcFlow.isSpacePressed) return;

            e.preventDefault();
            e.stopPropagation();

            ArcFlow.isDraggingNode = true;
            ArcFlow.draggedNode = node;

            var canvas = document.getElementById('editorCanvas');
            var rect = canvas.getBoundingClientRect();

            ArcFlow.dragOffset.x = (e.clientX - rect.left - ArcFlow.panX) / ArcFlow.zoom - node.x;
            ArcFlow.dragOffset.y = (e.clientY - rect.top - ArcFlow.panY) / ArcFlow.zoom - node.y;

            el.classList.add('dragging');
            selectNode(node.id);
        });
    }

    // Settings button
    var settingsBtn = el.querySelector('.node-settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openNodeModal(node);
        });
    }

    // Delete button
    var deleteBtn = el.querySelector('.node-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            deleteNode(node.id);
        });
    }

    // Name label double-click to edit
    var nameLabel = el.querySelector('.node-name-label');
    if (nameLabel) {
        nameLabel.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            startEditingNodeName(node, nameLabel);
        });
    }

    // Output connectors - start connection drag (support multiple outputs)
    var connectorPlusElements = el.querySelectorAll('.connector-plus');
    connectorPlusElements.forEach(function (connectorPlus) {
        connectorPlus.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return; // Enforce Left Click Only
            e.stopPropagation();
            e.preventDefault();
            // Store the output index for multi-output nodes
            var outputIndex = connectorPlus.getAttribute('data-output-index');
            startConnectionDrag(node, e, false, outputIndex);
        });

        // Single click opens node panel
        connectorPlus.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!ArcFlow.isConnecting) {
                ArcFlow.pendingConnectionNodeId = node.id;
                ArcFlow.pendingOutputIndex = connectorPlus.getAttribute('data-output-index');
                openNodePanel();
            }
        });
    });

    // Input connector - highlight on connection drag
    // Input connectors should ONLY receive connections (n8n behavior)
    var connectorIn = el.querySelector('.connector-in');
    if (connectorIn) {
        connectorIn.addEventListener('mouseenter', function () {
            if (ArcFlow.isConnecting && ArcFlow.connectionStartNodeId !== node.id) {
                connectorIn.classList.add('highlight');
            }
        });

        connectorIn.addEventListener('mouseleave', function () {
            connectorIn.classList.remove('highlight');
        });

        // Input connectors do NOT start connections - they only receive them
    }

    // Bottom OUTPUTS (AI Agent - Memory, Tools, Chat Model) - These are now OUTPUT connectors
    // The plus icon is what users drag from
    var bottomPlusElements = el.querySelectorAll('.connector-bottom-plus');
    bottomPlusElements.forEach(function (connectorPlus) {
        connectorPlus.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return; // Enforce Left Click Only
            e.stopPropagation();
            e.preventDefault();
            // Bottom connectors are INPUTS (receiving from Tools/Memory) - start REVERSE connection drag
            startConnectionDrag(node, e, true);
        });

        // Single click opens node panel for quick connection
        connectorPlus.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!ArcFlow.isConnecting) {
                ArcFlow.pendingConnectionNodeId = node.id;
                ArcFlow.pendingConnectionType = connectorPlus.getAttribute('data-conn-type');
                openNodePanel();
            }
        });
    });

    // Top connectors (Tools, Memory, Embedding that connect upward) are INPUTS - no drag, only receive
    var topConnectors = el.querySelectorAll('.connector-top-out');
    topConnectors.forEach(function (connectorTop) {
        // Top connectors are INPUTS - they only receive connections, NOT draggable
        connectorTop.addEventListener('mouseenter', function () {
            if (ArcFlow.isConnecting && ArcFlow.connectionStartNodeId !== node.id) {
                connectorTop.classList.add('highlight');
            }
        });
        connectorTop.addEventListener('mouseleave', function () {
            connectorTop.classList.remove('highlight');
        });
        // NO mousedown for drag - inputs don't start connections
    });

    // Click to select
    el.addEventListener('click', function (e) {
        if (!e.target.closest('.node-btn') && !e.target.closest('.connector')) {
            selectNode(node.id);
        }
    });

    // Double-click to open settings
    el.addEventListener('dblclick', function (e) {
        if (!e.target.closest('.node-btn') && !e.target.closest('.connector') && !e.target.closest('.node-name-label')) {
            openNodeModal(node);
        }
    });
}

function startEditingNodeName(node, labelEl) {
    if (ArcFlow.editingNameId) return;

    ArcFlow.editingNameId = node.id;
    var currentName = node.name;

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'node-name-input';
    input.value = currentName;

    labelEl.innerHTML = '';
    labelEl.appendChild(input);

    input.focus();
    input.select();

    function finishEditing() {
        var newName = input.value.trim();
        if (!newName) {
            newName = NodeDefinitions[node.type].appearance.name;
        }

        node.name = newName;
        labelEl.innerHTML = '<span class="node-name-text">' + escapeHtml(newName) + '</span>';
        ArcFlow.editingNameId = null;
        markUnsavedChanges();
    }

    input.addEventListener('blur', finishEditing);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            input.blur();
        }
        if (e.key === 'Escape') {
            input.value = currentName;
            input.blur();
        }
    });
}

function selectNode(nodeId) {
    deselectAll();

    var el = document.getElementById(nodeId);
    if (el) {
        el.classList.add('selected');
        ArcFlow.selectedNodeId = nodeId;
    }
}

function updateNodePosition(node) {
    var el = document.getElementById(node.id);
    if (el) {
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
    }
}

function updateNodeNameDisplay(node) {
    var el = document.getElementById(node.id);
    if (el) {
        var nameText = el.querySelector('.node-name-text');
        if (nameText) {
            nameText.textContent = node.name;
        }
    }
}

function deleteNode(nodeId) {
    // Remove from DOM
    var el = document.getElementById(nodeId);
    if (el) el.remove();

    // Remove from state
    ArcFlow.nodes = ArcFlow.nodes.filter(function (n) { return n.id !== nodeId; });

    // Remove connections
    ArcFlow.connections = ArcFlow.connections.filter(function (c) {
        return c.from !== nodeId && c.to !== nodeId;
    });

    // Clean up data
    delete ArcFlow.executionData[nodeId];
    delete ArcFlow.pinnedData[nodeId];

    // Re-render connections
    renderConnections();

    // Show placeholder if no nodes
    if (ArcFlow.nodes.length === 0) {
        var placeholder = document.getElementById('canvasPlaceholder');
        if (placeholder) placeholder.classList.remove('hidden');
    }

    // Clear selection
    if (ArcFlow.selectedNodeId === nodeId) {
        ArcFlow.selectedNodeId = null;
    }

    markUnsavedChanges();
}





/* ================================================== */
/*                                                    */
/*      SECTION 12: CONNECTIONS                       */
/*      With Draggable Wires & Delete Button          */
/*                                                    */
/* ================================================== */

function startConnectionDrag(fromNode, e, isReverse, outputIndex) {
    ArcFlow.isConnecting = true;
    ArcFlow.connectionStartNodeId = fromNode.id;
    ArcFlow.dragFromInput = !!isReverse; // Flag to indicate drawing from Input
    ArcFlow.connectionOutputIndex = outputIndex || null; // Store output index for multi-output nodes

    var canvas = document.getElementById('editorCanvas');
    var rect = canvas.getBoundingClientRect();

    // Get position of start connector
    // Try to find the specific element that triggered the event, or default to standard positions
    var targetEl = e.target.closest('.connector');

    if (targetEl) {
        var cRect = targetEl.getBoundingClientRect();
        ArcFlow.connectionStartPos = {
            x: cRect.left + cRect.width / 2 - rect.left,
            y: cRect.top + cRect.height / 2 - rect.top
        };
        // Also store connection type if it's a bottom/top connector
        ArcFlow.connectionType = targetEl.getAttribute('data-conn-type') || 'data';

        // Detect Orientation
        if (targetEl.classList.contains('connector-bottom-out') || targetEl.classList.contains('connector-bottom-plus')) {
            ArcFlow.connectionOrientation = 'bottom';
        } else if (targetEl.classList.contains('connector-top-out') || targetEl.classList.contains('connector-top-plus')) {
            ArcFlow.connectionOrientation = 'top';
        } else if (targetEl.classList.contains('connector-in')) {
            ArcFlow.connectionOrientation = 'left';
        } else {
            ArcFlow.connectionOrientation = 'right';
        }
    } else {
        // Fallback for standard right output
        ArcFlow.connectionStartPos = {
            x: (fromNode.x + 280) * ArcFlow.zoom + ArcFlow.panX,
            y: (fromNode.y + 70) * ArcFlow.zoom + ArcFlow.panY
        };
        ArcFlow.connectionType = 'data';
    }

    document.body.classList.add('connecting');
}

function drawTemporaryConnection(e) {
    // Remove existing temp connection
    clearTemporaryConnection();

    if (!ArcFlow.isConnecting) return;

    var canvas = document.getElementById('editorCanvas');
    var rect = canvas.getBoundingClientRect();

    var startX = ArcFlow.connectionStartPos.x;
    var startY = ArcFlow.connectionStartPos.y;
    var endX = e.clientX - rect.left;
    var endY = e.clientY - rect.top;

    // Visual Snap
    if (ArcFlow.snapTarget) {
        var tRect = ArcFlow.snapTarget.getBoundingClientRect();
        endX = tRect.left + tRect.width / 2 - rect.left;
        endY = tRect.top + tRect.height / 2 - rect.top;
    }

    // Create SVG for temp connection
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'tempConnectionSvg';
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';

    // Calculate control points for bezier curve based on orientation
    var dx = Math.abs(endX - startX);
    var dy = Math.abs(endY - startY);
    var cp = Math.max(50, Math.min(150, (dx + dy) / 4));

    var controlStartX = startX;
    var controlStartY = startY;
    var controlEndX = endX;
    var controlEndY = endY;

    // Start Control Point
    if (ArcFlow.connectionOrientation === 'bottom') {
        controlStartY += cp;
    } else if (ArcFlow.connectionOrientation === 'top') {
        controlStartY -= cp;
    } else if (ArcFlow.connectionOrientation === 'left') {
        controlStartX -= cp;
    } else {
        controlStartX += cp;
    }

    // End Control Point (Guess if not snapped)
    if (ArcFlow.snapTarget) {
        var t = ArcFlow.snapTarget;
        if (t.classList.contains('connector-top-out') || t.classList.contains('connector-top-plus')) controlEndY -= cp;
        else if (t.classList.contains('connector-bottom-out') || t.classList.contains('connector-bottom-plus')) controlEndY += cp;
        else if (t.classList.contains('connector-in')) controlEndX -= cp;
        else controlEndX += cp;
    } else {
        // Default cursor approach: Horizontal from left
        controlEndX -= cp;
    }

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d',
        'M ' + startX + ' ' + startY +
        ' C ' + controlStartX + ' ' + controlStartY +
        ', ' + controlEndX + ' ' + controlEndY +
        ', ' + endX + ' ' + endY
    );
    path.setAttribute('class', 'connection-line temp');

    svg.appendChild(path);
    canvas.appendChild(svg);
}

function clearTemporaryConnection() {
    var temp = document.getElementById('tempConnectionSvg');
    if (temp) temp.remove();
}

// Helper to validate connection types (e.g. Memory only to Memory)
function checkConnectionTypeCompatibility(type1, type2) {
    if (!type1) type1 = 'data';
    if (!type2) type2 = 'data';

    // Data/Main can connect to each other (Standard flows)
    if ((type1 === 'data' || type1 === 'main') && (type2 === 'data' || type2 === 'main')) return true;

    // Strict types (memory, tool, embedding, chatModel) must match EXACTLY
    return type1 === type2;
}

function completeConnection(e, explicitTargetId) {
    if (!ArcFlow.isConnecting) return;

    try {
        clearTemporaryConnection();
        document.body.classList.remove('connecting');

        if (!ArcFlow.connectionStartNodeId) return;

        var targetNodeId = explicitTargetId || null;

        if (!targetNodeId) {
            // Find target element via mouse position
            var targetEl = document.elementFromPoint(e.clientX, e.clientY);

            // Check if dropped on ANY connector
            var targetConnector = targetEl ? targetEl.closest('.connector') : null;

            if (targetConnector) {
                // Compatibility Check
                var isInput = targetConnector.classList.contains('connector-in') ||
                    targetConnector.classList.contains('connector-top-in') ||
                    targetConnector.classList.contains('connector-bottom-in') ||
                    targetConnector.querySelector('.connector-in');

                var isOutput = targetConnector.classList.contains('connector-out') ||
                    targetConnector.classList.contains('connector-top-out') ||
                    targetConnector.classList.contains('connector-bottom-out') ||
                    targetConnector.classList.contains('connector-top-plus');

                // If dragging FROM Input, we need Output target
                if (ArcFlow.dragFromInput && isOutput) {
                    targetNodeId = targetConnector.getAttribute('data-node-id');
                }
                // If dragging FROM Output, we need Input target
                else if (!ArcFlow.dragFromInput && isInput) {
                    // Type Compatibility Check
                    var startType = ArcFlow.connectionType;
                    var targetType = targetConnector.getAttribute('data-conn-type');

                    if (checkConnectionTypeCompatibility(startType, targetType)) {
                        targetNodeId = targetConnector.getAttribute('data-node-id');
                    }
                }
            }

            // Fallback: Check if dropped on node body (auto-connect to main input if compatible)
            if (!targetNodeId) {
                var nodeEl = targetEl ? targetEl.closest('.canvas-node') : null;
                if (nodeEl && nodeEl.id !== ArcFlow.connectionStartNodeId) {
                    var targetNode = getNodeById(nodeEl.id);
                    var targetDef = targetNode ? NodeDefinitions[targetNode.type] : null;

                    // Only auto-connect to Node Body if we are dragging FROM Output (Standard flow)
                    // And target has inputs
                    if (!ArcFlow.dragFromInput && targetDef && targetDef.connectors.hasInput) {
                        targetNodeId = nodeEl.id;
                    }
                }
            }
        }

        // Validate and create connection
        if (targetNodeId && targetNodeId !== ArcFlow.connectionStartNodeId) {
            var fromNode, toNode;

            // Handle Reverse Dragging (Input -> Output)
            if (ArcFlow.dragFromInput) {
                toNode = getNodeById(ArcFlow.connectionStartNodeId); // Start was Input
                fromNode = getNodeById(targetNodeId); // Target is Output
            } else {
                // Standard Dragging (Output -> Input)
                fromNode = getNodeById(ArcFlow.connectionStartNodeId);
                toNode = getNodeById(targetNodeId);
            }

            if (fromNode && toNode) {
                var exists = ArcFlow.connections.some(function (c) {
                    return c.from === fromNode.id && c.to === toNode.id;
                });

                // Allow self-connection only if needed (usually block unless loop)
                var allowSelf = false;

                // Check for circular reference
                var wouldBeCircular = !allowSelf && checkCircularConnection(fromNode.id, toNode.id);

                if (!exists && !wouldBeCircular) {
                    createConnection(fromNode.id, toNode.id);
                    renderConnections();
                    markUnsavedChanges();
                } else if (wouldBeCircular) {
                    showNotification('Cannot create circular connection', true);
                } else if (exists) {
                    showNotification('Connection already exists', true);
                }
            }
        }
    } catch (err) {
        console.error("Connection Error:", err);
    } finally {
        // CLEAN UP ALWAYS
        ArcFlow.isConnecting = false;
        ArcFlow.connectionStartNodeId = null;
        ArcFlow.snapTarget = null;

        // Remove highlights
        document.querySelectorAll('.highlight').forEach(function (el) {
            el.classList.remove('highlight');
        });
    }
}

function checkCircularConnection(fromId, toId) {
    // If we can reach fromId starting from toId, it would create a circle
    var visited = {};

    function canReach(currentId, targetId) {
        if (currentId === targetId) return true;
        if (visited[currentId]) return false;
        visited[currentId] = true;

        var outgoing = ArcFlow.connections.filter(function (c) { return c.from === currentId; });
        for (var i = 0; i < outgoing.length; i++) {
            if (canReach(outgoing[i].to, targetId)) return true;
        }
        return false;
    }

    return canReach(toId, fromId);
}

function createConnection(fromId, toId, outputIndex, connectionType) {
    var conn = {
        id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        from: fromId,
        to: toId,
        outputIndex: outputIndex || ArcFlow.connectionOutputIndex || null,
        type: connectionType || ArcFlow.connectionType || 'data'
    };

    ArcFlow.connections.push(conn);

    // Clear connection state
    ArcFlow.connectionOutputIndex = null;
    ArcFlow.connectionType = null;

    renderConnections();
    markUnsavedChanges();
}

function deleteConnection(connectionId) {
    ArcFlow.connections = ArcFlow.connections.filter(function (c) {
        return c.id !== connectionId;
    });
    renderConnections();
    markUnsavedChanges();
    showNotification('Connection deleted', false);
}

// Helper to get exact SVG coordinates for a node's connector
function getConnectorPoint(nodeId, type, outputIndex, isInput) {
    var node = getNodeById(nodeId);
    if (!node) return null;

    var nodeEl = document.getElementById(nodeId);
    if (!nodeEl) return null;

    var rect = document.getElementById('editorCanvas').getBoundingClientRect();
    var connector = null;

    // 1. Try to find by specific connection type (memory, tool, etc) - Highly reliable
    if (type && type !== 'data') {
        var selector = isInput ? `.connector[data-conn-type="${type}"]` : `.connector-bottom-plus[data-conn-type="${type}"], .connector-top-plus[data-conn-type="${type}"]`;
        connector = nodeEl.querySelector(selector);

        // Fallback to the connector container if plus not found
        if (!connector) {
            connector = nodeEl.querySelector(`.connector[data-conn-type="${type}"]`);
        }

        // Fallback to top/bottom generic if type-specific not found
        if (!connector) {
            connector = nodeEl.querySelector(isInput ? '.connector-top-out' : '.connector-bottom-out');
        }
    }

    // 2. Try to find by output index (for multi-output nodes)
    if (!connector && outputIndex !== null) {
        connector = nodeEl.querySelector(`.connector-plus[data-output-index="${outputIndex}"]`);
    }

    // 3. Fallback to standard input/output
    if (!connector) {
        connector = nodeEl.querySelector(isInput ? '.connector-in' : '.connector-plus');
    }

    if (connector) {
        var cRect = connector.getBoundingClientRect();
        // Determine orientation based on classes or position
        var orientation = 'right';
        if (connector.classList.contains('connector-bottom-out') || connector.classList.contains('connector-bottom-plus') || connector.closest('.node-bottom-connectors')) {
            orientation = 'bottom';
        } else if (connector.classList.contains('connector-top-out') || connector.classList.contains('connector-top-plus') || connector.closest('.node-connector-top')) {
            orientation = 'top';
        } else if (connector.classList.contains('connector-in')) {
            orientation = 'left';
        }

        return {
            x: cRect.left + cRect.width / 2 - rect.left,
            y: cRect.top + cRect.height / 2 - rect.top,
            orientation: orientation
        };
    }

    // Fallback logic using node coordinates
    var zoom = ArcFlow.zoom || 1;
    var panX = ArcFlow.panX || 0;
    var panY = ArcFlow.panY || 0;

    return {
        x: (node.x + (isInput ? 0 : 280)) * zoom + panX,
        y: (node.y + 70) * zoom + panY,
        orientation: isInput ? 'left' : 'right'
    };
}

function renderConnections() {
    // Remove existing SVG
    var existingSvg = document.getElementById('connectionsSvg');
    if (existingSvg) existingSvg.remove();

    if (ArcFlow.connections.length === 0) return;

    var canvas = document.getElementById('editorCanvas');

    // Create SVG container
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'connectionsSvg';
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';

    ArcFlow.connections.forEach(function (conn) {
        var fromNode = getNodeById(conn.from);
        var toNode = getNodeById(conn.to);

        if (!fromNode || !toNode) return;

        // Create group for this connection
        var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'connection-group');
        group.setAttribute('data-connection-id', conn.id);

        // Calculate exact positions based on connectors
        var isSelfConnection = conn.from === conn.to;

        var startPoint = getConnectorPoint(conn.from, conn.type, conn.outputIndex, false);
        var endPoint = getConnectorPoint(conn.to, conn.type, null, true);

        if (!startPoint || !endPoint) return;

        var startX = startPoint.x;
        var startY = startPoint.y;
        var endX = endPoint.x;
        var endY = endPoint.y;

        var dx = endX - startX;
        var dy = endY - startY;

        // Smart Bezier Logic (n8n style)
        var pathD;

        if (isSelfConnection) {
            var loopHeight = 120 * ArcFlow.zoom;
            pathD = 'M ' + startX + ' ' + startY +
                ' C ' + (startX + 100) + ' ' + (startY - loopHeight) +
                ', ' + (endX - 100) + ' ' + (endY - loopHeight) +
                ', ' + endX + ' ' + endY;
        } else {
            var dx = Math.abs(endX - startX);
            var dy = Math.abs(endY - startY);
            var cp = Math.max(50, Math.min(150, (dx + dy) / 4));

            var controlStartX = startX;
            var controlStartY = startY;
            var controlEndX = endX;
            var controlEndY = endY;

            // Adjust control points based on connector orientations
            if (startPoint.orientation === 'bottom') controlStartY += cp;
            else if (startPoint.orientation === 'top') controlStartY -= cp;
            else if (startPoint.orientation === 'left') controlStartX -= cp;
            else controlStartX += cp;

            if (endPoint.orientation === 'bottom') controlEndY += cp;
            else if (endPoint.orientation === 'top') controlEndY -= cp;
            else if (endPoint.orientation === 'left') controlEndX -= cp;
            else controlEndX += cp;

            pathD = 'M ' + startX + ' ' + startY +
                ' C ' + controlStartX + ' ' + controlStartY +
                ', ' + controlEndX + ' ' + controlEndY +
                ', ' + endX + ' ' + endY;
        }

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        var isExec = ArcFlow.isExecuting && ArcFlow.executionData && ArcFlow.executionData[conn.from];
        path.setAttribute('class', 'connection-line ' + (conn.type ? conn.type + '-connection' : '') + (isExec ? ' executing' : ''));
        if (conn.from === conn.to) path.setAttribute('class', path.getAttribute('class') + ' loop-connection');

        path.setAttribute('data-connection-id', conn.id);
        group.appendChild(path);

        // Invisible hit area for easier interaction
        var hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitArea.setAttribute('d', pathD);
        hitArea.setAttribute('class', 'connection-hit-area');
        hitArea.setAttribute('data-connection-id', conn.id);
        hitArea.style.cssText = 'stroke:transparent;stroke-width:20;fill:none;pointer-events:stroke;cursor:pointer;';
        group.appendChild(hitArea);

        // Calculate delete button position (midpoint on bezier curve)
        var btnPos = { x: (startX + endX) / 2, y: (startY + endY) / 2 };

        // Helper to calculate point on cubic bezier
        function getBezierPoint(t, p0, p1, p2, p3) {
            var mt = 1 - t;
            var mt2 = mt * mt;
            var mt3 = mt * mt * mt;
            var t2 = t * t;
            var t3 = t * t * t;

            var x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
            var y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
            return { x: x, y: y };
        }

        if (dx > 20 && !isSelfConnection) {
            // Forward curve: p0=(startX,startY), p1=(startX+cp,startY), p2=(endX-cp,endY), p3=(endX,endY)
            var cp = Math.max(80, dx * 0.5);
            btnPos = getBezierPoint(0.5,
                { x: startX, y: startY },
                { x: startX + cp, y: startY },
                { x: endX - cp, y: endY },
                { x: endX, y: endY }
            );
        } else if (isSelfConnection) {
            // Loop curve approximate top point
            btnPos = { x: (startX + endX) / 2, y: Math.min(startY, endY) - 130 };
        }

        var deleteBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        deleteBtn.setAttribute('class', 'connection-delete-btn');
        deleteBtn.setAttribute('data-connection-id', conn.id);
        deleteBtn.style.cssText = 'opacity:0;cursor:pointer;pointer-events:auto;transition:opacity 0.2s;';

        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', btnPos.x);
        circle.setAttribute('cy', btnPos.y);
        circle.setAttribute('r', '16');
        circle.setAttribute('fill', '#ef4444');
        circle.setAttribute('stroke', '#ffffff');
        circle.setAttribute('stroke-width', '2');
        deleteBtn.appendChild(circle);

        var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', btnPos.x);
        text.setAttribute('y', btnPos.y + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.textContent = '×';
        deleteBtn.appendChild(text);

        // Ensure button is last child (on top)
        group.appendChild(deleteBtn);
        svg.appendChild(group);
    });

    canvas.appendChild(svg);

    // Setup hover events
    setupConnectionEvents();
}

function setupConnectionEvents() {
    // Stable hover logic using debounced state and CSS class toggling
    document.querySelectorAll('.connection-group').forEach(function (group) {
        var deleteBtn = group.querySelector('.connection-delete-btn');
        var line = group.querySelector('.connection-line');
        var hitArea = group.querySelector('.connection-hit-area');
        var hoverTimeout = null;
        var isHovered = false;

        // Function to show delete button
        function showDeleteBtn() {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            isHovered = true;
            if (deleteBtn) deleteBtn.style.opacity = '1';
            if (line) line.classList.add('hover');
            group.classList.add('hovered');
        }

        // Function to hide delete button with delay
        function hideDeleteBtn() {
            hoverTimeout = setTimeout(function () {
                isHovered = false;
                if (deleteBtn) deleteBtn.style.opacity = '0';
                if (line) line.classList.remove('hover');
                group.classList.remove('hovered');
            }, 100); // Small delay to prevent flicker
        }

        // Attach hover events to the group
        group.addEventListener('mouseenter', showDeleteBtn);
        group.addEventListener('mouseleave', hideDeleteBtn);

        // Keep button visible when hovering over it
        if (deleteBtn) {
            deleteBtn.addEventListener('mouseenter', function () {
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = null;
                }
                isHovered = true;
                deleteBtn.style.opacity = '1';
            });

            deleteBtn.addEventListener('mouseleave', function (e) {
                // Check if we're still within the group
                var relatedTarget = e.relatedTarget;
                if (relatedTarget && group.contains(relatedTarget)) {
                    return; // Still in group, don't hide
                }
                hideDeleteBtn();
            });

            // Button click
            deleteBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                var connId = deleteBtn.getAttribute('data-connection-id');
                if (connId) {
                    deleteConnection(connId);
                }
            });
        }

        // Also handle hit area hover for better detection
        if (hitArea) {
            hitArea.addEventListener('mouseenter', showDeleteBtn);
            hitArea.addEventListener('mouseleave', function (e) {
                var relatedTarget = e.relatedTarget;
                if (relatedTarget && group.contains(relatedTarget)) {
                    return;
                }
                hideDeleteBtn();
            });
        }
    });
}





/* ================================================== */
/*                                                    */
/*      SECTION 13: NODE MODAL                        */
/*      Input | Settings | Output View                */
/*                                                    */
/* ================================================== */

function createNodeModal() {
    if (document.getElementById('nodeModal')) return;

    var modal = document.createElement('div');
    modal.id = 'nodeModal';
    modal.className = 'node-modal-overlay';

    modal.innerHTML = `
        <div class="node-modal">
            <div class="node-modal-header">
                <div class="modal-header-left">
                    <span class="modal-node-icon"></span>
                    <span class="modal-node-name"></span>
                    <span class="modal-pin-indicator">📌 Pinned</span>
                </div>
                <div class="modal-header-center">
                    <button class="view-toggle-btn active" data-view="json">JSON</button>
                    <button class="view-toggle-btn" data-view="schema">Schema</button>
                    <button class="view-toggle-btn" data-view="table">Table</button>
                </div>
                <div class="modal-header-right">
                    <button class="modal-expr-help-btn" title="Expression Help">{{ }}</button>
                    <button class="modal-pin-btn" title="Pin Node">📌</button>
                    <button class="modal-close-btn">✕</button>
                </div>
            </div>
            
            <div class="node-modal-toolbar">
                <div class="toolbar-left">
                    <label>Input from:</label>
                    <select class="input-source-select"></select>
                    <button class="toolbar-btn copy-input-btn" title="Copy Input">📋</button>
                    <button class="toolbar-btn edit-input-btn" title="Edit Input">✏️</button>
                </div>
                <div class="toolbar-right">
                    <button class="toolbar-btn copy-output-btn" title="Copy Output">📋</button>
                    <button class="toolbar-btn edit-output-btn" title="Edit Output">✏️</button>
                </div>
            </div>
            
            <div class="node-modal-body">
                <div class="modal-column modal-input-column">
                    <div class="column-header">
                        <span>INPUT</span>
                        <span class="column-count input-count"></span>
                    </div>
                    <div class="column-content input-content">
                        <div class="json-viewer"></div>
                    </div>
                    <div class="trigger-area" style="display:none;">
                        <button class="trigger-execute-btn">▶ Execute Workflow</button>
                    </div>
                </div>
                
                <div class="modal-column modal-settings-column">
                    <div class="column-header">
                        <span>⚙️ SETTINGS</span>
                    </div>
                    <div class="column-content settings-content"></div>
                </div>
                
                <div class="modal-column modal-output-column">
                    <div class="column-header">
                        <span>OUTPUT</span>
                        <span class="column-count output-count"></span>
                    </div>
                    <div class="column-content output-content">
                        <div class="json-viewer"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close-btn').addEventListener('click', closeNodeModal);

    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeNodeModal();
    });

    // View toggles
    modal.querySelectorAll('.view-toggle-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            modal.querySelectorAll('.view-toggle-btn').forEach(function (b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            ArcFlow.currentModalViewMode = btn.getAttribute('data-view');
            refreshNodeModal();
        });
    });

    // Input source select
    modal.querySelector('.input-source-select').addEventListener('change', function () {
        ArcFlow.currentSelectedInputNode = this.value;
        refreshNodeModal();
    });

    // Toolbar buttons
    modal.querySelector('.copy-input-btn').addEventListener('click', copyInputData);
    modal.querySelector('.copy-output-btn').addEventListener('click', copyOutputData);
    modal.querySelector('.edit-input-btn').addEventListener('click', function () { openDataEditor('input'); });
    modal.querySelector('.edit-output-btn').addEventListener('click', function () { openDataEditor('output'); });

    // Pin button
    modal.querySelector('.modal-pin-btn').addEventListener('click', function () {
        if (ArcFlow.currentModalNodeId) {
            toggleNodePin(ArcFlow.currentModalNodeId);
        }
    });

    // Expression help button
    modal.querySelector('.modal-expr-help-btn').addEventListener('click', openExpressionHelpModal);

    // Trigger execute button
    modal.querySelector('.trigger-execute-btn').addEventListener('click', function () {
        closeNodeModal();
        executeWorkflow();
    });
}

function openNodeModal(node) {
    var modal = document.getElementById('nodeModal');
    if (!modal) return;

    var def = NodeDefinitions[node.type];
    if (!def) return;

    ArcFlow.currentModalNodeId = node.id;
    ArcFlow.currentSelectedInputNode = '';
    ArcFlow.currentModalViewMode = 'json';

    // Update header
    modal.querySelector('.modal-node-icon').textContent = def.appearance.icon;
    modal.querySelector('.modal-node-name').textContent = node.name;

    // WEBHOOK URL DISPLAY
    var exUrl = modal.querySelector('.webhook-url-display');
    if (exUrl) exUrl.remove(); // Clear previous
    if (node.type === 'webhook-trigger') {
        var header = modal.querySelector('.modal-header');
        var urlInfo = def.getWebhookUrls(node.config);
        var url = urlInfo.test;  // Always use test URL which includes full localhost URL

        var urlDiv = document.createElement('div');
        urlDiv.className = 'webhook-url-display';
        urlDiv.innerHTML = `
            <span>Webhook URL:</span>
            <input type="text" readonly value="${url}" onclick="this.select()">
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${url}')">Copy</button>
        `;
        // Insert after header title
        if (header) {
            header.parentNode.insertBefore(urlDiv, header.nextSibling);
            // Move to inside header? No, usually below.
            // Actually inserting AFTER header (into modal body/top) is better.
            // But valid location is key.
            var body = modal.querySelector('.modal-body');
            if (body) body.insertBefore(urlDiv, body.firstChild);
        }
    }

    // Update pin indicator
    var pinIndicator = modal.querySelector('.modal-pin-indicator');
    var pinBtn = modal.querySelector('.modal-pin-btn');

    if (isNodePinned(node.id)) {
        pinIndicator.style.display = 'inline-block';
        pinBtn.textContent = '📌 Unpin';
        pinBtn.classList.add('active');
    } else {
        pinIndicator.style.display = 'none';
        pinBtn.textContent = '📌 Pin';
        pinBtn.classList.remove('active');
    }

    // Populate input source dropdown
    var select = modal.querySelector('.input-source-select');
    select.innerHTML = '<option value="">Direct Input</option>';

    var upstream = getUpstreamNodes(node.id);
    upstream.forEach(function (n) {
        var opt = document.createElement('option');
        opt.value = n.id;
        opt.textContent = n.name + (isNodePinned(n.id) ? ' 📌' : '');
        select.appendChild(opt);
    });

    // Handle trigger nodes - show execute button instead of input
    var inputContent = modal.querySelector('.input-content');
    var triggerArea = modal.querySelector('.trigger-area');
    var toolbarLeft = modal.querySelector('.toolbar-left');

    if (def.appearance.category === 'trigger') {
        inputContent.style.display = 'none';
        triggerArea.style.display = 'flex';
        toolbarLeft.style.visibility = 'hidden';
    } else {
        inputContent.style.display = 'block';
        triggerArea.style.display = 'none';
        toolbarLeft.style.visibility = 'visible';
    }

    // Reset view toggle
    modal.querySelectorAll('.view-toggle-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-view') === 'json');
    });

    // Render settings
    renderSettings(node);

    // Refresh data displays
    refreshNodeModal();

    // Show modal
    modal.classList.add('active');
    selectNode(node.id);
}

function closeNodeModal() {
    var modal = document.getElementById('nodeModal');
    if (modal) {
        modal.classList.remove('active');
    }
    ArcFlow.currentModalNodeId = null;
}

function refreshNodeModal() {
    var nodeId = ArcFlow.currentModalNodeId;
    if (!nodeId) return;

    var node = getNodeById(nodeId);
    if (!node) return;

    var def = NodeDefinitions[node.type];
    var modal = document.getElementById('nodeModal');

    // Update pin state
    var pinIndicator = modal.querySelector('.modal-pin-indicator');
    var pinBtn = modal.querySelector('.modal-pin-btn');

    if (isNodePinned(nodeId)) {
        pinIndicator.style.display = 'inline-block';
        pinBtn.textContent = '📌 Unpin';
        pinBtn.classList.add('active');
    } else {
        pinIndicator.style.display = 'none';
        pinBtn.textContent = '📌 Pin';
        pinBtn.classList.remove('active');
    }

    // Get input data
    var inputData = null;
    if (ArcFlow.currentSelectedInputNode) {
        inputData = getNodeOutputData(ArcFlow.currentSelectedInputNode);
    } else {
        inputData = getNodeInputData(nodeId);
    }

    // Get output data
    var outputData = getNodeOutputData(nodeId);

    // If no output, use default
    if (!outputData && def.defaultData) {
        outputData = def.defaultData;
    }

    // Update counts
    var inputItems = normalizeToArray(inputData);
    var outputItems = normalizeToArray(outputData);

    modal.querySelector('.input-count').textContent = inputItems.length + ' item' + (inputItems.length !== 1 ? 's' : '');
    modal.querySelector('.output-count').textContent = outputItems.length + ' item' + (outputItems.length !== 1 ? 's' : '');

    // Render data views
    if (def.appearance.category !== 'trigger') {
        var inputViewer = modal.querySelector('.input-content .json-viewer');
        inputViewer.innerHTML = renderDataView(inputData, ArcFlow.currentModalViewMode, null);
        setupDraggableFields(inputViewer, null);
    }

    var outputViewer = modal.querySelector('.output-content .json-viewer');
    outputViewer.innerHTML = renderDataView(outputData, ArcFlow.currentModalViewMode, nodeId);
    setupDraggableFields(outputViewer, nodeId);
}

function renderSettings(node) {
    var modal = document.getElementById('nodeModal');
    var container = modal.querySelector('.settings-content');
    var def = NodeDefinitions[node.type];

    container.innerHTML = '';

    // Node name field
    var nameField = document.createElement('div');
    nameField.className = 'setting-field';
    nameField.innerHTML = `
        <label>Node Name</label>
        <input type="text" class="setting-input" value="${escapeHtml(node.name)}">
    `;
    container.appendChild(nameField);

    var nameInput = nameField.querySelector('input');
    nameInput.addEventListener('input', function () {
        node.name = this.value || def.appearance.name;
        updateNodeNameDisplay(node);
        modal.querySelector('.modal-node-name').textContent = node.name;
        markUnsavedChanges();
    });

    // Other settings
    def.settings.forEach(function (setting) {
        var field = createSettingField(setting, node);
        container.appendChild(field);
    });
}

function createSettingField(setting, node) {
    var field = document.createElement('div');
    field.className = 'setting-field';
    field.setAttribute('data-field', setting.name);

    var label = document.createElement('label');
    label.textContent = setting.label + (setting.required ? ' *' : '');
    field.appendChild(label);

    var value = node.config[setting.name] !== undefined ? node.config[setting.name] : (setting.default || '');

    // Handle Display/Computed Fields (like Webhook URL)
    if (setting.type === 'display') {
        if (setting.computed) {
            var def = NodeDefinitions[node.type];
            var computedValue = '';

            // Special handling for Webhook URL
            if (setting.name === 'webhookUrl' && typeof def.getWebhookUrl === 'function') {
                computedValue = def.getWebhookUrl(node.config);
            }

            var displayBox = document.createElement('div');
            displayBox.className = 'webhook-url-display';
            displayBox.innerHTML = `
                <input type="text" readonly value="${computedValue}">
                <button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.value).then(() => showNotification('Copied!'))">Copy</button>
            `;
            field.appendChild(displayBox);
            return field;
        }
    }

    if (setting.type === 'expression' || setting.type === 'text') {
        // ======================================
        // EXPRESSION FIELD WITH FIXED/EXPRESSION TOGGLE
        // ======================================
        var wrapper = document.createElement('div');
        wrapper.className = 'expression-field-wrapper';

        // Auto-generate random path for Webhook if default
        if (node.type === 'webhook-trigger' && setting.name === 'path') {
            if (!value || value === 'abcd-1234') {
                value = 'webhook-' + Math.random().toString(36).substring(2, 9);
                node.config[setting.name] = value;
                // Also update fixed key if it exists to ensure consistency
                if (node.config[setting.name + '_fixed'] !== undefined) node.config[setting.name + '_fixed'] = value;
            }
        }

        // Get or initialize field mode data
        var fieldModeKey = setting.name + '_mode';
        var currentMode = node.config[fieldModeKey] || (hasExpression(value) ? 'expression' : 'fixed');

        // Store separate values
        var fixedKey = setting.name + '_fixed';
        var exprKey = setting.name + '_expr';
        if (node.config[fixedKey] === undefined) node.config[fixedKey] = hasExpression(value) ? '' : value;
        if (node.config[exprKey] === undefined) node.config[exprKey] = hasExpression(value) ? value : '';

        // === Mode Toggle Dropdown ===
        var modeToggle = document.createElement('div');
        modeToggle.className = 'expr-mode-toggle';
        modeToggle.innerHTML = `
            <select class="mode-select" data-field="${setting.name}">
                <option value="fixed" ${currentMode === 'fixed' ? 'selected' : ''}>Fixed</option>
                <option value="expression" ${currentMode === 'expression' ? 'selected' : ''}>Expression</option>
                <option value="ai" ${currentMode === 'ai' ? 'selected' : ''}>AI Managed</option>
            </select>
            <span class="fx-badge ${currentMode === 'expression' || currentMode === 'ai' ? 'active' : ''}">${currentMode === 'ai' ? 'AI' : 'fx'}</span>
        `;
        wrapper.appendChild(modeToggle);

        // === Input Area with Highlighting ===
        var inputWrapper = document.createElement('div');
        inputWrapper.className = 'expr-input-wrapper';

        // The actual input
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'setting-input expression-input droppable';

        if (currentMode === 'ai') {
            input.value = '{{ $ai_managed }}';
            input.readOnly = true;
            input.style.color = 'var(--accent-secondary)';
            input.style.fontStyle = 'italic';
        } else {
            input.value = currentMode === 'expression' ? (node.config[exprKey] || value) : (node.config[fixedKey] || value);
        }

        input.placeholder = setting.placeholder || '';
        input.setAttribute('data-field', setting.name);
        input.setAttribute('data-mode', currentMode);

        // Overlay for green highlighting (expression mode only)
        var highlightOverlay = document.createElement('div');
        highlightOverlay.className = 'expr-highlight-overlay';
        highlightOverlay.style.display = currentMode === 'expression' ? 'block' : 'none';
        updateExpressionHighlight(highlightOverlay, input.value);

        inputWrapper.appendChild(input);
        inputWrapper.appendChild(highlightOverlay);
        wrapper.appendChild(inputWrapper);

        // === Expression Preview Widget (Live Result) ===
        var previewWidget = document.createElement('div');
        previewWidget.className = 'expr-preview-widget';
        previewWidget.style.display = currentMode === 'expression' ? 'block' : 'none';
        previewWidget.innerHTML = '<span class="label">Result:</span> <span class="value">...</span>';
        wrapper.appendChild(previewWidget);

        // Update preview initially
        if (currentMode === 'expression') {
            updateExpressionPreviewWidget(previewWidget, input.value, node.id);
        }

        // === Expand Button to Open Expression Panel ===
        var expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'expr-expand-btn';
        expandBtn.innerHTML = '↗';
        expandBtn.title = 'Open Expression Panel';
        expandBtn.setAttribute('data-field', setting.name);
        wrapper.appendChild(expandBtn);

        field.appendChild(wrapper);

        // === Events ===

        // Mode toggle change
        var modeSelect = modeToggle.querySelector('.mode-select');
        var fxBadge = modeToggle.querySelector('.fx-badge');

        modeSelect.addEventListener('change', function () {
            var newMode = this.value;
            node.config[fieldModeKey] = newMode;
            input.setAttribute('data-mode', newMode);

            // Switch value
            if (newMode === 'expression') {
                input.value = node.config[exprKey] || '';
                highlightOverlay.style.display = 'block';
                previewWidget.style.display = 'block';
                fxBadge.classList.add('active');
                updateExpressionPreviewWidget(previewWidget, input.value, node.id);
            } else if (newMode === 'ai') {
                input.value = '{{ $ai_managed }}';
                input.setAttribute('readonly', 'true');
                input.style.color = 'var(--accent-secondary)';
                input.style.fontStyle = 'italic';
                highlightOverlay.style.display = 'none';
                previewWidget.style.display = 'none';
                fxBadge.textContent = 'AI';
                fxBadge.classList.add('active');
            } else {
                input.value = node.config[fixedKey] || '';
                input.removeAttribute('readonly');
                input.style.color = '';
                input.style.fontStyle = '';
                highlightOverlay.style.display = 'none';
                previewWidget.style.display = 'none';
                fxBadge.textContent = 'fx';
                fxBadge.classList.remove('active');
            }

            updateExpressionHighlight(highlightOverlay, input.value);
            markUnsavedChanges();
        });

        // Input change
        input.addEventListener('input', function () {
            var mode = this.getAttribute('data-mode');

            // Auto-detect expression and switch mode
            if (mode === 'fixed' && hasExpression(this.value)) {
                mode = 'expression';
                modeSelect.value = 'expression';
                node.config[fieldModeKey] = 'expression';
                this.setAttribute('data-mode', 'expression');
                fxBadge.classList.add('active');
                highlightOverlay.style.display = 'block';
            }

            // Store in appropriate key
            if (mode === 'expression') {
                node.config[exprKey] = this.value;
                node.config[setting.name] = this.value;
            } else {
                node.config[fixedKey] = this.value;
                node.config[setting.name] = this.value;
            }

            updateExpressionHighlight(highlightOverlay, this.value);
            highlightOverlay.scrollLeft = this.scrollLeft; // Sync scroll
            if (mode === 'expression') {
                updateExpressionPreviewWidget(previewWidget, this.value, node.id);
            }
            markUnsavedChanges();
        });

        // Sync scroll
        input.addEventListener('scroll', function () {
            highlightOverlay.scrollLeft = this.scrollLeft;
        });

        // Expand button - open expression panel
        expandBtn.addEventListener('click', function () {
            openExpressionPanel(node, setting, input);
        });

        setupDroppableField(input, node, setting.name);

        // Force update on focus and init to ensure visibility
        input.addEventListener('focus', function () {
            updateExpressionHighlight(highlightOverlay, this.value);
        });
        setTimeout(function () {
            updateExpressionHighlight(highlightOverlay, input.value);
            highlightOverlay.scrollLeft = input.scrollLeft;
        }, 100);

    } else if (setting.type === 'number') {
        var input = document.createElement('input');
        input.type = 'number';
        input.className = 'setting-input';
        input.value = value;
        input.placeholder = setting.placeholder || '';

        input.addEventListener('input', function () {
            node.config[setting.name] = this.value;
            markUnsavedChanges();
        });

        field.appendChild(input);

    } else if (setting.type === 'select') {
        var select = document.createElement('select');
        select.className = 'setting-select';

        setting.options.forEach(function (opt) {
            var option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            option.selected = value === opt;
            select.appendChild(option);
        });

        select.addEventListener('change', function () {
            node.config[setting.name] = this.value;
            markUnsavedChanges();
            if (setting.name === 'outputCount' || setting.name === 'dynamicOutputCount') {
                // Re-render node to update connectors
                var el = document.querySelector('.node[data-id="' + node.id + '"]');
                if (el) {
                    var container = document.getElementById('canvas-container');
                    container.removeChild(el); // Remove old
                    renderNode(node, container); // Render new
                    recalculateLines(); // Update lines
                }
            }
        });

        field.appendChild(select);

    } else if (setting.type === 'code') {
        var textarea = document.createElement('textarea');
        textarea.className = 'setting-textarea code-textarea droppable';
        textarea.value = value;
        textarea.placeholder = setting.placeholder || '';
        textarea.rows = 10;

        textarea.addEventListener('input', function () {
            node.config[setting.name] = this.value;
            markUnsavedChanges();
        });

        field.appendChild(textarea);
        setupDroppableField(textarea, node, setting.name);

    } else if (setting.type === 'credential') {
        var wrapper = document.createElement('div');
        wrapper.className = 'credential-wrapper';

        var select = document.createElement('select');
        select.className = 'setting-select';
        select.innerHTML = '<option value="">Loading...</option>';

        // Load credentials
        loadCredentialsForSelect(select, node, setting.name);

        var addBtn = document.createElement('button');
        addBtn.className = 'add-credential-btn';
        addBtn.innerHTML = '<span>+</span> New Credential';
        addBtn.onclick = function (e) {
            e.preventDefault();
            openCredentialModal(select);
        };

        wrapper.appendChild(select);
        wrapper.appendChild(addBtn);
        field.appendChild(wrapper);
    }

    return field;
}

// ======================================
// EXPRESSION HIGHLIGHTING
// ======================================
function updateExpressionPreviewWidget(widget, value, nodeId) {
    if (!widget) return;

    var valueEl = widget.querySelector('.value');
    if (!valueEl) return;

    // Simple evaluation preview
    if (!value) {
        valueEl.textContent = '...';
        return;
    }

    try {
        // Mock evaluation or use current node context
        // If it's a fixed value, show it
        if (!hasExpression(value)) {
            valueEl.textContent = JSON.stringify(value);
            return;
        }

        // Evaluate expression against mock data or real execution data
        var evaluated = processExpression(value, {}, { nodeId: nodeId }, { showUndefined: true });

        // If we have real execution data, use it!
        if (ArcFlow.executionData && ArcFlow.executionData[nodeId]) {
            // Try to use real inputs if available in context?? 
            // Logic for full context evaluation is complex, stick to "Preview" text or simple eval
        }

        if (evaluated !== undefined) {
            if (typeof evaluated === 'object') {
                valueEl.textContent = JSON.stringify(evaluated);
            } else {
                valueEl.textContent = evaluated;
            }
        } else {
            valueEl.textContent = '(expression)';
        }
    } catch (e) {
        // User requested to hide errors during typing
        valueEl.textContent = '...';
        valueEl.style.color = 'var(--text-muted)';
    }
}

function updateExpressionHighlight(overlay, value) {
    if (!overlay) return;

    // Escape HTML first
    var escaped = escapeHtml(value);

    // Highlight {{ }} parts in green
    var highlighted = escaped.replace(/\{\{([\s\S]*?)\}\}/g, function (match, inner) {
        return '<span class="expr-highlight">{{' + inner + '}}</span>';
    });

    overlay.innerHTML = highlighted + '<span class="expr-cursor-space">&nbsp;</span>';
}

function hasExpression(value) {
    if (!value || typeof value !== 'string') return false;
    return /\{\{.*?\}\}/.test(value);
}

// ======================================
// EXPRESSION PANEL (3 Columns)
// ======================================
function createExpressionPanel() {
    if (document.getElementById('exprPanel')) return;

    var panel = document.createElement('div');
    panel.id = 'exprPanel';
    panel.className = 'expr-panel-overlay';

    panel.innerHTML = `
        <div class="expr-panel">
            <div class="expr-panel-header">
                <div class="expr-panel-title">
                    <span class="expr-panel-icon">{{ }}</span>
                    <span class="expr-panel-field-name">Edit Expression</span>
                </div>
                <button class="expr-panel-close">✕</button>
            </div>
            
            <div class="expr-panel-toolbar">
                <div class="toolbar-left">
                    <label>Input from:</label>
                    <select class="expr-input-source"></select>
                </div>
                <div class="toolbar-center">
                    <span class="expr-preview-label">Live Preview</span>
                </div>
                <div class="toolbar-right">
                    <button class="expr-help-btn">? Help</button>
                </div>
            </div>
            
            <div class="expr-panel-body">
                <!-- Column 1: Input Schema -->
                <div class="expr-column expr-input-column">
                    <div class="expr-column-header">
                        <span>INPUT</span>
                        <div class="expr-view-toggle">
                            <button class="expr-toggle-btn active" data-view="schema">Schema</button>
                            <button class="expr-toggle-btn" data-view="json">JSON</button>
                        </div>
                    </div>
                    <div class="expr-column-content expr-schema-content"></div>
                </div>
                
                <!-- Column 2: Expression Editor -->
                <div class="expr-column expr-editor-column">
                    <div class="expr-column-header">
                        <span>EXPRESSION</span>
                    </div>
                    <div class="expr-column-content">
                        <div class="expr-editor-wrapper">
                            <textarea class="expr-editor-textarea" spellcheck="false" placeholder="Type your expression here...

Examples:
{{ $json.field }}
{{ $node[&quot;Node Name&quot;].json.field }}
{{ $now.toFormat(&quot;yyyy-MM-dd&quot;) }}"></textarea>
                            <div class="expr-editor-highlight"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Column 3: Live Result -->
                <div class="expr-column expr-result-column">
                    <div class="expr-column-header">
                        <span>RESULT</span>
                        <span class="expr-result-status"></span>
                    </div>
                    <div class="expr-column-content">
                        <div class="expr-result-preview"></div>
                    </div>
                </div>
            </div>
            
            <div class="expr-panel-footer">
                <button class="expr-cancel-btn">Cancel</button>
                <button class="expr-apply-btn">Apply Expression</button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
    setupExpressionPanelEvents(panel);
}

function setupExpressionPanelEvents(panel) {
    var textarea = panel.querySelector('.expr-editor-textarea');
    var highlight = panel.querySelector('.expr-editor-highlight');
    var preview = panel.querySelector('.expr-result-preview');
    var status = panel.querySelector('.expr-result-status');

    // Close button
    panel.querySelector('.expr-panel-close').addEventListener('click', closeExpressionPanel);
    panel.querySelector('.expr-cancel-btn').addEventListener('click', closeExpressionPanel);

    // Click outside to close
    panel.addEventListener('click', function (e) {
        if (e.target === panel) closeExpressionPanel();
    });

    // Apply button
    panel.querySelector('.expr-apply-btn').addEventListener('click', function () {
        applyExpressionFromPanel();
    });

    // Live preview on typing
    textarea.addEventListener('input', function () {
        updateExpressionHighlight(highlight, this.value);
        updateExpressionPreview(this.value, preview, status);
    });

    // Sync scroll
    textarea.addEventListener('scroll', function () {
        highlight.scrollTop = this.scrollTop;
        highlight.scrollLeft = this.scrollLeft;
    });

    // Input source change
    panel.querySelector('.expr-input-source').addEventListener('change', function () {
        ArcFlow.exprPanelInputSource = this.value;
        refreshExpressionPanelInput();
        updateExpressionPreview(textarea.value, preview, status);
    });

    // View toggle (Schema/JSON)
    panel.querySelectorAll('.expr-input-column .expr-toggle-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            panel.querySelectorAll('.expr-input-column .expr-toggle-btn').forEach(function (b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            ArcFlow.exprPanelInputView = btn.getAttribute('data-view');
            refreshExpressionPanelInput();
        });
    });

    // Help button
    panel.querySelector('.expr-help-btn').addEventListener('click', function () {
        openExpressionHelpModal();
    });

    // Drop handler for Drag-and-Drop mapping
    textarea.addEventListener('drop', function (e) {
        e.preventDefault();

        if (!ArcFlow.draggedFieldData) return;

        var expression = ArcFlow.draggedFieldData.expression;
        var sourceNodeId = ArcFlow.draggedFieldData.sourceNodeId;
        var panelNodeId = ArcFlow.exprPanelNodeId;

        // Build correct expression with Node Name if from different node
        if (sourceNodeId && sourceNodeId !== panelNodeId) {
            var sourceNode = getNodeById(sourceNodeId);
            if (sourceNode) {
                // n8n Style: $node["Node Name"].json["field"]
                // We use our format: {{ $node["Name"].json.field }}
                expression = '{{ $node["' + sourceNode.name + '"].json.' + ArcFlow.draggedFieldData.path + ' }}';
            }
        }

        // Insert at cursor
        var cursorPos = this.selectionStart;
        var before = this.value.substring(0, cursorPos);
        var after = this.value.substring(cursorPos);

        this.value = before + expression + after;

        updateExpressionHighlight(highlight, this.value);
        updateExpressionPreview(this.value, preview, status);
    });
}

function openExpressionPanel(node, setting, inputEl) {
    createExpressionPanel();

    var panel = document.getElementById('exprPanel');
    if (!panel) return;

    // Store context
    ArcFlow.exprPanelNodeId = node.id;
    ArcFlow.exprPanelSetting = setting;
    ArcFlow.exprPanelInputElement = inputEl;
    ArcFlow.exprPanelInputSource = '';
    ArcFlow.exprPanelInputView = 'schema';

    // Set field name
    panel.querySelector('.expr-panel-field-name').textContent = 'Edit: ' + setting.label;

    // Populate input source dropdown
    var select = panel.querySelector('.expr-input-source');
    select.innerHTML = '<option value="">Direct Input</option>';

    var upstream = getUpstreamNodes(node.id);
    upstream.forEach(function (n) {
        var opt = document.createElement('option');
        opt.value = n.id;
        opt.textContent = n.name + (isNodePinned(n.id) ? ' 📌' : '');
        select.appendChild(opt);
    });

    // Set current expression value
    var textarea = panel.querySelector('.expr-editor-textarea');
    var exprKey = setting.name + '_expr';
    textarea.value = node.config[exprKey] || node.config[setting.name] || '';

    // Update highlight
    var highlight = panel.querySelector('.expr-editor-highlight');
    updateExpressionHighlight(highlight, textarea.value);

    // Refresh input column
    refreshExpressionPanelInput();

    // Update preview
    var preview = panel.querySelector('.expr-result-preview');
    var status = panel.querySelector('.expr-result-status');
    updateExpressionPreview(textarea.value, preview, status);

    // Show panel
    panel.classList.add('active');
    textarea.focus();
}

function closeExpressionPanel() {
    var panel = document.getElementById('exprPanel');
    if (panel) {
        panel.classList.remove('active');
    }

    ArcFlow.exprPanelNodeId = null;
    ArcFlow.exprPanelSetting = null;
    ArcFlow.exprPanelInputElement = null;
}

function refreshExpressionPanelInput() {
    var panel = document.getElementById('exprPanel');
    if (!panel) return;

    var nodeId = ArcFlow.exprPanelNodeId;
    if (!nodeId) return;

    var content = panel.querySelector('.expr-schema-content');
    var viewMode = ArcFlow.exprPanelInputView || 'schema';

    // Get input data
    var inputData = null;
    if (ArcFlow.exprPanelInputSource) {
        inputData = getNodeOutputData(ArcFlow.exprPanelInputSource);
    } else {
        inputData = getNodeInputData(nodeId);
    }

    var sourceNodeId = ArcFlow.exprPanelInputSource || null;
    if (!sourceNodeId) {
        var directInput = getDirectInputNode(nodeId);
        sourceNodeId = directInput ? directInput.id : null;
    }

    // Render
    if (viewMode === 'schema') {
        content.innerHTML = renderSchemaViewForExprPanel(inputData, sourceNodeId);
    } else {
        content.innerHTML = renderJsonViewForExprPanel(inputData, sourceNodeId);
    }

    // Setup draggable fields
    setupDraggableFieldsForExprPanel(content, sourceNodeId);
}

function renderSchemaViewForExprPanel(data, sourceNodeId) {
    if (!data) {
        return '<div class="expr-empty">No input data. Execute workflow first.</div>';
    }

    var items = normalizeToArray(data);
    if (items.length === 0) {
        return '<div class="expr-empty">No items</div>';
    }

    return renderCollapsibleSchema(items[0], [], sourceNodeId);
}

function renderCollapsibleSchema(obj, path, sourceNodeId) {
    if (obj === null || obj === undefined) {
        return '<span class="schema-type null">null</span>';
    }

    var type = Array.isArray(obj) ? 'array' : typeof obj;

    if (type === 'object' && !Array.isArray(obj)) {
        var keys = Object.keys(obj);

        if (keys.length === 0) {
            return '<span class="schema-type object">{}</span>';
        }

        var html = '<div class="schema-tree">';

        keys.forEach(function (key) {
            var keyPath = path.concat([key]);
            var pathStr = buildJsonPath(keyPath);
            var expression = buildDragExpression(sourceNodeId, pathStr, ArcFlow.exprPanelNodeId);
            var valueType = obj[key] === null ? 'null' : (Array.isArray(obj[key]) ? 'array' : typeof obj[key]);
            var valuePreview = truncateValue(obj[key], 15);
            var isNested = valueType === 'object' || valueType === 'array';
            var uniqueId = 'schema_' + Math.random().toString(36).substr(2, 9);

            html += '<div class="schema-row">';

            if (isNested) {
                html += '<input type="checkbox" class="schema-toggle" id="' + uniqueId + '">';
                html += '<label class="schema-arrow" for="' + uniqueId + '">▶</label>';
            } else {
                html += '<span class="schema-spacer"></span>';
            }

            html += '<span class="schema-key draggable-expr-field" ';
            html += 'data-path="' + escapeHtml(pathStr) + '" ';
            html += 'data-expression="' + escapeHtml(expression) + '" ';
            html += 'data-source-node="' + (sourceNodeId || '') + '">';
            html += escapeHtml(key);
            html += '</span>';

            html += '<span class="schema-type ' + valueType + '">' + valueType + '</span>';

            if (!isNested && valuePreview !== '') {
                html += '<span class="schema-value">' + escapeHtml(valuePreview) + '</span>';
            }

            if (isNested) {
                html += '<div class="schema-nested">';
                html += renderCollapsibleSchema(obj[key], keyPath, sourceNodeId);
                html += '</div>';
            }

            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    if (type === 'array') {
        if (obj.length === 0) {
            return '<span class="schema-type array">[] (empty)</span>';
        }

        var html = '<div class="schema-tree">';
        html += '<span class="schema-type array">[' + obj.length + ' items]</span>';
        html += renderCollapsibleSchema(obj[0], path.concat([0]), sourceNodeId);
        html += '</div>';
        return html;
    }

    return '<span class="schema-type ' + type + '">' + type + '</span>';
}

function truncateValue(value, maxLen) {
    if (value === null) return 'null';
    if (value === undefined) return '';
    if (typeof value === 'object') return '';

    var str = String(value);
    if (str.length > maxLen) {
        return str.substring(0, maxLen) + '...';
    }
    return str;
}

function renderJsonViewForExprPanel(data, sourceNodeId) {
    if (!data) {
        return '<div class="expr-empty">No input data</div>';
    }

    var items = normalizeToArray(data);
    return '<pre class="expr-json-pre">' + renderJsonObject(items, '', [], sourceNodeId) + '</pre>';
}

function setupDraggableFieldsForExprPanel(container, sourceNodeId) {
    container.querySelectorAll('.draggable-expr-field').forEach(function (el) {
        el.setAttribute('draggable', 'true');

        el.addEventListener('dragstart', function (e) {
            var expr = el.getAttribute('data-expression');
            e.dataTransfer.setData('text/plain', expr);
            e.dataTransfer.effectAllowed = 'copy';
            el.classList.add('dragging');
        });

        el.addEventListener('dragend', function () {
            el.classList.remove('dragging');
        });

        // Click to insert at cursor
        el.addEventListener('click', function () {
            var expr = el.getAttribute('data-expression');
            insertExpressionAtCursor(expr);
        });
    });
}

function insertExpressionAtCursor(expression) {
    var panel = document.getElementById('exprPanel');
    if (!panel) return;

    var textarea = panel.querySelector('.expr-editor-textarea');
    var cursorPos = textarea.selectionStart;
    var before = textarea.value.substring(0, cursorPos);
    var after = textarea.value.substring(cursorPos);

    textarea.value = before + expression + after;

    // Update highlight
    var highlight = panel.querySelector('.expr-editor-highlight');
    updateExpressionHighlight(highlight, textarea.value);

    // Update preview
    var preview = panel.querySelector('.expr-result-preview');
    var status = panel.querySelector('.expr-result-status');
    updateExpressionPreview(textarea.value, preview, status);

    // Position cursor after inserted expression
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = cursorPos + expression.length;
}

function buildDragExpression(sourceNodeId, pathStr, currentNodeId) {
    // User Requirement: Always show node name in expression
    // e.g. {{ $node["Node Name"].json.field }}

    // Fix duplicated 'json.' prefix if it comes from key path
    // Robust check for 'json.' prefix (case insensitive, trimmed)
    if (pathStr) {
        pathStr = pathStr.toString().trim();
        if (pathStr.toLowerCase().startsWith('json.')) {
            pathStr = pathStr.substring(5);
        }
    }

    var sourceNode = sourceNodeId ? getNodeById(sourceNodeId) : null;

    if (sourceNode) {
        // Enforce $node["Name"] format even for current node
        return '{{ $node["' + sourceNode.name + '"].json.' + pathStr + ' }}';
    }

    // Fallback only if no source node identified
    return '{{ $json.' + pathStr + ' }}';
}

function updateExpressionPreview(expression, previewEl, statusEl) {
    if (!expression || !previewEl) return;

    var nodeId = ArcFlow.exprPanelNodeId;
    if (!nodeId) return;

    // Get input data
    var inputData = null;
    if (ArcFlow.exprPanelInputSource) {
        inputData = getNodeOutputData(ArcFlow.exprPanelInputSource);
    } else {
        inputData = getNodeInputData(nodeId);
    }

    var context = { nodeId: nodeId };

    try {
        var result = processExpression(expression, inputData, context);

        if (result && result.toString().includes('[ERROR:')) {
            statusEl.textContent = '❌ Error';
            statusEl.className = 'expr-result-status error';
            previewEl.innerHTML = '<div class="expr-error">' + escapeHtml(result) + '</div>';
        } else {
            statusEl.textContent = '✓ Valid';
            statusEl.className = 'expr-result-status success';

            if (result === null) {
                previewEl.innerHTML = '<span class="null-val">null</span>';
            } else if (result === undefined) {
                previewEl.innerHTML = '<span class="undef-val">undefined</span>';
            } else if (typeof result === 'object') {
                try {
                    previewEl.innerHTML = '<pre class="expr-result-json">' +
                        escapeHtml(JSON.stringify(result, null, 2)) + '</pre>';
                } catch (e) {
                    previewEl.innerHTML = '<div class="expr-result-text">[Object]</div>';
                }
            } else {
                // Try to parse as JSON string if it looks like one? 
                // No, display as string, unless user wants JSON view.
                // But for now, simple string display is safer.
                // Or try parse if string starts with { or [
                var str = String(result);
                if ((str.startsWith('{') || str.startsWith('[')) && (str.endsWith('}') || str.endsWith(']'))) {
                    try {
                        var parsed = JSON.parse(str);
                        previewEl.innerHTML = '<pre class="expr-result-json">' +
                            escapeHtml(JSON.stringify(parsed, null, 2)) + '</pre>';
                    } catch (e) {
                        previewEl.innerHTML = '<div class="expr-result-text">' + escapeHtml(str) + '</div>';
                    }
                } else {
                    previewEl.innerHTML = '<div class="expr-result-text">' + escapeHtml(str) + '</div>';
                }
            }
        }
    } catch (err) {
        statusEl.textContent = '❌ Error';
        statusEl.className = 'expr-result-status error';
        previewEl.innerHTML = '<div class="expr-error">' + escapeHtml(err.message) + '</div>';
    }
}

function applyExpressionFromPanel() {
    var panel = document.getElementById('exprPanel');
    if (!panel) return;

    var textarea = panel.querySelector('.expr-editor-textarea');
    var expression = textarea.value;

    var node = getNodeById(ArcFlow.exprPanelNodeId);
    var setting = ArcFlow.exprPanelSetting;
    var inputEl = ArcFlow.exprPanelInputElement;

    if (!node || !setting) {
        closeExpressionPanel();
        return;
    }

    // Update node config
    var exprKey = setting.name + '_expr';
    var modeKey = setting.name + '_mode';
    node.config[exprKey] = expression;
    node.config[modeKey] = 'expression';
    node.config[setting.name] = expression;

    // Update the input element
    if (inputEl) {
        inputEl.value = expression;
        inputEl.setAttribute('data-mode', 'expression');
        inputEl.classList.add('has-expression');

        // Update mode select
        var wrapper = inputEl.closest('.expression-field-wrapper');
        if (wrapper) {
            var modeSelect = wrapper.querySelector('.mode-select');
            var fxBadge = wrapper.querySelector('.fx-badge');
            var highlightOverlay = wrapper.querySelector('.expr-highlight-overlay');

            if (modeSelect) modeSelect.value = 'expression';
            if (fxBadge) fxBadge.classList.add('active');
            if (highlightOverlay) {
                highlightOverlay.style.display = 'block';
                updateExpressionHighlight(highlightOverlay, expression);
            }
        }
    }

    markUnsavedChanges();
    closeExpressionPanel();
    showNotification('Expression applied!', false);
}







/* ================================================== */
/*                                                    */
/*      SECTION 14: JSON RENDERING                    */
/*      Full Display - No Truncation                  */
/*                                                    */
/* ================================================== */

function renderDataView(data, viewMode, sourceNodeId) {
    if (data === null || data === undefined) {
        return `
            <div class="empty-data">
                <div class="empty-icon">📭</div>
                <div class="empty-text">No data available</div>
                <div class="empty-hint">Execute the workflow to see results</div>
            </div>
        `;
    }

    var items = normalizeToArray(data);

    switch (viewMode) {
        case 'json':
            return renderJsonView(items, sourceNodeId);
        case 'schema':
            return renderSchemaView(items, sourceNodeId);
        case 'table':
            return renderTableView(items, sourceNodeId);
        default:
            return renderJsonView(items, sourceNodeId);
    }
}

function renderJsonView(items, sourceNodeId) {
    var html = '<div class="json-view">';

    items.forEach(function (item, index) {
        // Unwrap JSON for display (n8n style) - prevents json.json in paths
        var displayItem = item.json ? item.json : item;

        html += '<div class="json-item">';
        html += '<div class="json-item-header">Item ' + index + '</div>';
        html += '<div class="json-item-content">';
        html += renderJsonObject(displayItem, '', [], sourceNodeId);
        html += '</div>';
        html += '</div>';
    });

    html += '</div>';
    return html;
}

function renderJsonObject(obj, indent, path, sourceNodeId) {
    if (obj === null) return '<span class="json-null">null</span>';
    if (obj === undefined) return '<span class="json-undefined">undefined</span>';

    var type = typeof obj;

    if (type === 'boolean') {
        return '<span class="json-boolean">' + obj + '</span>';
    }

    if (type === 'number') {
        return '<span class="json-number">' + obj + '</span>';
    }

    if (type === 'string') {
        // NO TRUNCATION - show full string
        return '<span class="json-string">"' + escapeHtml(obj) + '"</span>';
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '<span class="json-bracket">[]</span>';
        }

        var html = '<span class="json-bracket">[</span>\n';
        var nextIndent = indent + '  ';

        obj.forEach(function (item, i) {
            var itemPath = path.concat([i]);
            html += nextIndent + renderJsonObject(item, nextIndent, itemPath, sourceNodeId);
            if (i < obj.length - 1) html += '<span class="json-comma">,</span>';
            html += '\n';
        });

        html += indent + '<span class="json-bracket">]</span>';
        return html;
    }

    if (type === 'object') {
        var keys = Object.keys(obj);

        if (keys.length === 0) {
            return '<span class="json-brace">{}</span>';
        }

        var html = '<span class="json-brace">{</span>\n';
        var nextIndent = indent + '  ';

        keys.forEach(function (key, i) {
            var keyPath = path.concat([key]);
            var pathStr = buildJsonPath(keyPath);
            var expression = buildDragExpression(sourceNodeId, pathStr, ArcFlow.currentModalNodeId);

            html += nextIndent;
            html += '<span class="json-key draggable-field" ';
            html += 'data-path="' + escapeHtml(pathStr) + '" ';
            html += 'data-expression="' + escapeHtml(expression) + '" ';
            html += 'data-source-node="' + (sourceNodeId || '') + '" ';
            html += 'title="Click to copy, drag to insert">';
            html += '"' + escapeHtml(key) + '"';
            html += '</span>';
            html += '<span class="json-colon">: </span>';
            html += renderJsonObject(obj[key], nextIndent, keyPath, sourceNodeId);
            if (i < keys.length - 1) html += '<span class="json-comma">,</span>';
            html += '\n';
        });

        html += indent + '<span class="json-brace">}</span>';
        return html;
    }

    return '<span class="json-unknown">' + escapeHtml(String(obj)) + '</span>';
}

function buildJsonPath(pathArray) {
    var result = '';

    pathArray.forEach(function (part, i) {
        if (typeof part === 'number') {
            result += '[' + part + ']';
        } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part)) {
            if (i > 0) result += '.';
            result += part;
        } else {
            result += '["' + part.replace(/"/g, '\\"') + '"]';
        }
    });

    return result;
}

function renderSchemaView(items, sourceNodeId) {
    if (items.length === 0) {
        return '<div class="empty-data">No items</div>';
    }

    // Unwrap JSON for schema display (n8n style)
    var displayItem = items[0].json ? items[0].json : items[0];

    var html = '<div class="schema-view">';
    html += renderSchemaObject(displayItem, [], sourceNodeId);
    html += '</div>';
    return html;
}

// ... existing renderSchemaObject ...

function renderTableView(items, sourceNodeId) {
    if (items.length === 0) {
        return '<div class="empty-data">No items</div>';
    }

    // Unwrap JSON for table display
    var displayItems = items.map(function (item) {
        return item.json ? item.json : item;
    });

    // Collect all keys
    var allKeys = new Set();
    displayItems.forEach(function (item) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            Object.keys(item).forEach(function (k) { allKeys.add(k); });
        }
    });

    var keys = Array.from(allKeys);

    if (keys.length === 0) {
        return '<div class="empty-data">No columns to display</div>';
    }

    var html = '<div class="table-wrapper"><table class="data-table">';

    // Header
    html += '<thead><tr><th>#</th>';
    keys.forEach(function (key) {
        // Use buildDragExpression for proper node name format
        var expression = buildDragExpression(sourceNodeId, key, ArcFlow.currentModalNodeId);
        html += '<th class="draggable-field" data-expression="' + escapeHtml(expression) + '" data-path="' + escapeHtml(key) + '" data-source-node="' + (sourceNodeId || '') + '">';
        html += escapeHtml(key);
        html += '</th>';
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    displayItems.forEach(function (item, i) {
        html += '<tr><td class="row-num">' + i + '</td>';
        keys.forEach(function (key) {
            var val = item ? item[key] : undefined;
            var displayVal = '';

            if (val === null) {
                displayVal = '<span class="null-val">null</span>';
            } else if (val === undefined) {
                displayVal = '<span class="undef-val">-</span>';
            } else if (typeof val === 'object') {
                displayVal = '<span class="obj-val">' + escapeHtml(JSON.stringify(val)) + '</span>';
            } else if (typeof val === 'boolean') {
                displayVal = '<span class="bool-val">' + val + '</span>';
            } else {
                displayVal = escapeHtml(String(val));
            }

            html += '<td>' + displayVal + '</td>';
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';

    return html;
}

function renderSchemaObject(obj, path, sourceNodeId) {
    if (obj === null || obj === undefined) {
        return '<span class="schema-type null">null</span>';
    }

    var type = Array.isArray(obj) ? 'array' : typeof obj;

    if (type === 'object' && !Array.isArray(obj)) {
        var keys = Object.keys(obj);

        if (keys.length === 0) {
            return '<span class="schema-type object">{}</span>';
        }

        var html = '<div class="schema-object">';

        keys.forEach(function (key) {
            var keyPath = path.concat([key]);
            var pathStr = buildJsonPath(keyPath);
            var expression = buildDragExpression(sourceNodeId, pathStr, ArcFlow.currentModalNodeId);
            var valueType = obj[key] === null ? 'null' : (Array.isArray(obj[key]) ? 'array' : typeof obj[key]);

            html += '<div class="schema-row">';
            html += '<span class="schema-key draggable-field" ';
            html += 'data-path="' + escapeHtml(pathStr) + '" ';
            html += 'data-expression="' + escapeHtml(expression) + '" ';
            html += 'data-source-node="' + (sourceNodeId || '') + '">';
            html += escapeHtml(key);
            html += '</span>';
            html += '<span class="schema-type ' + valueType + '">' + valueType + '</span>';

            if (valueType === 'object' || valueType === 'array') {
                html += '<div class="schema-nested">';
                html += renderSchemaObject(obj[key], keyPath, sourceNodeId);
                html += '</div>';
            }

            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    if (type === 'array') {
        if (obj.length === 0) {
            return '<span class="schema-type array">[] (empty)</span>';
        }

        var html = '<div class="schema-array">';
        html += '<span class="schema-type array">[' + obj.length + ' items]</span>';
        html += '<div class="schema-nested">';
        html += renderSchemaObject(obj[0], path.concat([0]), sourceNodeId);
        html += '</div>';
        html += '</div>';
        return html;
    }

    return '<span class="schema-type ' + type + '">' + type + '</span>';
}

/* Duplicate renderTableView removed - using the one defined earlier */





/* ================================================== */
/*                                                    */
/*      SECTION 15: DRAG & DROP FIELDS                */
/*                                                    */
/* ================================================== */

function setupDraggableFields(container, sourceNodeId) {
    if (!container) return;

    container.querySelectorAll('.draggable-field').forEach(function (el) {
        el.setAttribute('draggable', 'true');

        // Drag start
        el.addEventListener('dragstart', function (e) {
            ArcFlow.isDraggingField = true;
            ArcFlow.draggedFieldData = {
                path: el.getAttribute('data-path'),
                expression: el.getAttribute('data-expression'),
                sourceNodeId: el.getAttribute('data-source-node') || sourceNodeId
            };

            e.dataTransfer.setData('text/plain', ArcFlow.draggedFieldData.expression);
            e.dataTransfer.effectAllowed = 'copy';

            el.classList.add('dragging');
            createDragGhost(e, ArcFlow.draggedFieldData.expression);
        });

        // Drag end
        el.addEventListener('dragend', function () {
            ArcFlow.isDraggingField = false;
            ArcFlow.draggedFieldData = null;
            el.classList.remove('dragging');
            removeDragGhost();
        });

        // Click to copy
        el.addEventListener('click', function () {
            var expr = el.getAttribute('data-expression');
            copyToClipboard(expr);
            showNotification('Copied: ' + expr, false);
        });
    });
}

function setupDroppableField(element, node, fieldName) {
    element.addEventListener('dragover', function (e) {
        if (ArcFlow.isDraggingField) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            element.classList.add('drag-over');
        }
    });

    element.addEventListener('dragleave', function () {
        element.classList.remove('drag-over');
    });

    element.addEventListener('drop', function (e) {
        e.preventDefault();
        element.classList.remove('drag-over');

        if (!ArcFlow.draggedFieldData) return;

        var expression = ArcFlow.draggedFieldData.expression;
        var sourceNodeId = ArcFlow.draggedFieldData.sourceNodeId;

        // Build correct expression based on source
        if (sourceNodeId && sourceNodeId !== ArcFlow.currentModalNodeId) {
            var sourceNode = getNodeById(sourceNodeId);
            if (sourceNode) {
                expression = '{{ $node["' + sourceNode.name + '"].json.' + ArcFlow.draggedFieldData.path + ' }}';
            }
        }

        // Insert at cursor or append
        var cursorPos = element.selectionStart !== undefined ? element.selectionStart : element.value.length;
        var before = element.value.substring(0, cursorPos);
        var after = element.value.substring(cursorPos);

        element.value = before + expression + after;
        node.config[fieldName] = element.value;

        element.classList.add('has-expression');
        markUnsavedChanges();

        // Position cursor after inserted text
        var newPos = cursorPos + expression.length;
        element.focus();
        if (element.setSelectionRange) {
            element.setSelectionRange(newPos, newPos);
        }

        showNotification('Expression inserted', false);
    });
}

function createDragGhost(e, text) {
    removeDragGhost();

    var ghost = document.createElement('div');
    ghost.id = 'dragGhost';
    ghost.className = 'drag-ghost';
    ghost.textContent = text.length > 50 ? text.substring(0, 50) + '...' : text;

    ghost.style.left = (e.clientX + 10) + 'px';
    ghost.style.top = (e.clientY + 10) + 'px';

    document.body.appendChild(ghost);
}

function updateDragGhost(e) {
    var ghost = document.getElementById('dragGhost');
    if (ghost) {
        ghost.style.left = (e.clientX + 10) + 'px';
        ghost.style.top = (e.clientY + 10) + 'px';
    }
}

function removeDragGhost() {
    var ghost = document.getElementById('dragGhost');
    if (ghost) ghost.remove();
}

function cancelFieldDrag() {
    ArcFlow.isDraggingField = false;
    ArcFlow.draggedFieldData = null;
    removeDragGhost();

    document.querySelectorAll('.dragging').forEach(function (el) {
        el.classList.remove('dragging');
    });

    document.querySelectorAll('.drag-over').forEach(function (el) {
        el.classList.remove('drag-over');
    });
}





/* ================================================== */
/*                                                    */
/*      SECTION 16: COPY & EDIT DATA                  */
/*                                                    */
/* ================================================== */

function copyInputData() {
    var nodeId = ArcFlow.currentModalNodeId;
    if (!nodeId) return;

    var data = ArcFlow.currentSelectedInputNode
        ? getNodeOutputData(ArcFlow.currentSelectedInputNode)
        : getNodeInputData(nodeId);

    if (data) {
        copyToClipboard(JSON.stringify(normalizeToArray(data), null, 2));
        showNotification('Input data copied', false);
    } else {
        showNotification('No input data', true);
    }
}

function copyOutputData() {
    var nodeId = ArcFlow.currentModalNodeId;
    if (!nodeId) return;

    var data = getNodeOutputData(nodeId);

    if (data) {
        copyToClipboard(JSON.stringify(normalizeToArray(data), null, 2));
        showNotification('Output data copied', false);
    } else {
        showNotification('No output data', true);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
    } catch (e) { }
    document.body.removeChild(textarea);
}

function openDataEditor(type) {
    var nodeId = ArcFlow.currentModalNodeId;
    if (!nodeId) return;

    var data = null;
    var targetNodeId = nodeId;

    if (type === 'input') {
        if (ArcFlow.currentSelectedInputNode) {
            targetNodeId = ArcFlow.currentSelectedInputNode;
        } else {
            var inputNode = getDirectInputNode(nodeId);
            if (inputNode) targetNodeId = inputNode.id;
        }
        data = getNodeOutputData(targetNodeId);
    } else {
        data = getNodeOutputData(nodeId);
    }

    if (!data) data = [{}];
    data = normalizeToArray(data);

    ArcFlow.editingDataType = type;
    ArcFlow.editingTargetNodeId = targetNodeId;
    ArcFlow.editingOriginalData = JSON.stringify(data, null, 2);

    showDataEditorModal(data, type);
}


/* ================================================== */
/*                                                    */
/*      SECTION 17: DATA EDITOR MODAL                 */
/*                                                    */
/* ================================================== */

function createDataEditorModal() {
    if (document.getElementById('dataEditorModal')) return;

    var modal = document.createElement('div');
    modal.id = 'dataEditorModal';
    modal.className = 'modal-overlay data-editor-overlay';

    modal.innerHTML = `
        <div class="modal-box data-editor-box">
            <div class="modal-header">
                <h3 class="editor-title">Edit Data</h3>
                <button class="modal-close-btn data-editor-close">✕</button>
            </div>
            <div class="editor-body">
                <div class="editor-hint">📌 Edit JSON below. Data must be an array [ ]. Saving will PIN this node.</div>
                <div class="editor-tools">
                    <button class="editor-tool" id="formatJson">Format</button>
                    <button class="editor-tool" id="minifyJson">Minify</button>
                    <button class="editor-tool" id="validateJson">Validate</button>
                </div>
                <textarea class="editor-textarea" spellcheck="false"></textarea>
                <div class="editor-error"></div>
            </div>
            <div class="modal-buttons">
                <button class="modal-btn cancel data-editor-cancel">Cancel</button>
                <button class="modal-btn confirm data-editor-save">💾 Save & Pin</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    var textarea = modal.querySelector('.editor-textarea');
    var errorEl = modal.querySelector('.editor-error');

    // Close button
    modal.querySelector('.data-editor-close').addEventListener('click', function () {
        closeDataEditorWithCheck();
    });

    // Cancel button
    modal.querySelector('.data-editor-cancel').addEventListener('click', function () {
        closeDataEditorWithCheck();
    });

    // Click outside
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeDataEditorWithCheck();
    });

    // Save button
    modal.querySelector('.data-editor-save').addEventListener('click', saveEditorData);

    // Format button
    modal.querySelector('#formatJson').addEventListener('click', function () {
        try {
            var data = JSON.parse(textarea.value);
            textarea.value = JSON.stringify(data, null, 2);
            errorEl.style.display = 'none';
        } catch (e) {
            errorEl.textContent = 'Invalid JSON: ' + e.message;
            errorEl.style.display = 'block';
        }
    });

    // Minify button
    modal.querySelector('#minifyJson').addEventListener('click', function () {
        try {
            var data = JSON.parse(textarea.value);
            textarea.value = JSON.stringify(data);
            errorEl.style.display = 'none';
        } catch (e) {
            errorEl.textContent = 'Invalid JSON: ' + e.message;
            errorEl.style.display = 'block';
        }
    });

    // Validate button
    modal.querySelector('#validateJson').addEventListener('click', function () {
        try {
            var data = JSON.parse(textarea.value);
            if (!Array.isArray(data)) {
                errorEl.textContent = 'Data must be an array [ ]';
                errorEl.style.display = 'block';
            } else {
                errorEl.innerHTML = '<span style="color:#10b981;">✓ Valid JSON array with ' + data.length + ' item(s)</span>';
                errorEl.style.display = 'block';
            }
        } catch (e) {
            errorEl.textContent = 'Invalid JSON: ' + e.message;
            errorEl.style.display = 'block';
        }
    });
}

function showDataEditorModal(data, type) {
    var modal = document.getElementById('dataEditorModal');
    if (!modal) {
        createDataEditorModal();
        modal = document.getElementById('dataEditorModal');
    }

    modal.querySelector('.editor-title').textContent = 'Edit ' + (type === 'input' ? 'Input' : 'Output') + ' Data';
    modal.querySelector('.editor-textarea').value = JSON.stringify(data, null, 2);
    modal.querySelector('.editor-error').style.display = 'none';

    modal.classList.add('active');
    modal.querySelector('.editor-textarea').focus();
}

function closeDataEditorWithCheck() {
    var modal = document.getElementById('dataEditorModal');
    var current = modal.querySelector('.editor-textarea').value;

    if (current !== ArcFlow.editingOriginalData) {
        if (!confirm('Discard unsaved changes?')) return;
    }

    closeDataEditorModal();
}

function closeDataEditorModal() {
    var modal = document.getElementById('dataEditorModal');
    if (modal) modal.classList.remove('active');

    ArcFlow.editingDataType = null;
    ArcFlow.editingTargetNodeId = null;
    ArcFlow.editingOriginalData = null;
}

function saveEditorData() {
    var modal = document.getElementById('dataEditorModal');
    var textarea = modal.querySelector('.editor-textarea');
    var errorEl = modal.querySelector('.editor-error');

    try {
        var data = JSON.parse(textarea.value);

        if (!Array.isArray(data)) {
            errorEl.textContent = 'Data must be an array [ ]';
            errorEl.style.display = 'block';
            return;
        }

        var targetId = ArcFlow.editingTargetNodeId;

        // Pin the node
        pinNode(targetId, data);

        closeDataEditorModal();
        refreshNodeModal();
        showNotification('Data saved & pinned! 📌', false);

    } catch (e) {
        errorEl.textContent = 'Invalid JSON: ' + e.message;
        errorEl.style.display = 'block';
    }
}





/* ================================================== */
/*                                                    */
/*      SECTION 18: EXPRESSION HELP MODAL             */
/*                                                    */
/* ================================================== */

function createExpressionHelpModal() {
    if (document.getElementById('exprHelpModal')) return;

    var modal = document.createElement('div');
    modal.id = 'exprHelpModal';
    modal.className = 'modal-overlay expr-help-overlay';

    modal.innerHTML = `
        <div class="modal-box expr-help-box">
            <div class="modal-header">
                <h3>{{ }} Expression Reference</h3>
                <button class="modal-close-btn expr-help-close">✕</button>
            </div>
            <div class="expr-help-body">
                <div class="expr-tabs">
                    <button class="expr-tab active" data-tab="basics">Basics</button>
                    <button class="expr-tab" data-tab="nodes">Nodes</button>
                    <button class="expr-tab" data-tab="methods">Methods</button>
                    <button class="expr-tab" data-tab="dates">Dates</button>
                    <button class="expr-tab" data-tab="examples">Examples</button>
                </div>
                <div class="expr-content">
                    <div class="expr-panel active" data-tab="basics">
                        <h4>Current Data</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $json.field }}</code><span>Current item's field</span></div>
                                                        <div class="expr-item"><code>{{ $json.nested.field }}</code><span>Nested field access</span></div>
                            <div class="expr-item"><code>{{ $json.array[0] }}</code><span>Array index access</span></div>
                            <div class="expr-item"><code>{{ $json }}</code><span>Entire current item</span></div>
                        </div>
                        <h4>Input Helpers</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $input.first() }}</code><span>First input item</span></div>
                            <div class="expr-item"><code>{{ $input.last() }}</code><span>Last input item</span></div>
                            <div class="expr-item"><code>{{ $input.all() }}</code><span>All input items as array</span></div>
                        </div>
                        <h4>Metadata</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $workflow.id }}</code><span>Current workflow ID</span></div>
                            <div class="expr-item"><code>{{ $workflow.name }}</code><span>Current workflow name</span></div>
                            <div class="expr-item"><code>{{ $execution.id }}</code><span>Current execution ID</span></div>
                        </div>
                    </div>
                    
                    <div class="expr-panel" data-tab="nodes">
                        <h4>Access Other Nodes (1, 2, 3+ nodes back)</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $node["Node Name"].json.field }}</code><span>Field from specific node</span></div>
                            <div class="expr-item"><code>{{ $node["Node Name"].json }}</code><span>All data from node</span></div>
                            <div class="expr-item"><code>{{ $node["Node Name"].json.items[0] }}</code><span>Array item from node</span></div>
                        </div>
                        <h4>Using $items() Function</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $items("Node Name") }}</code><span>All items from node</span></div>
                            <div class="expr-item"><code>{{ $items("Node Name")[0] }}</code><span>First item from node</span></div>
                            <div class="expr-item"><code>{{ $items("Node Name")[0].field }}</code><span>Field from first item</span></div>
                        </div>
                        <h4>Node Methods</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $node["Name"].first() }}</code><span>First item from node</span></div>
                            <div class="expr-item"><code>{{ $node["Name"].last() }}</code><span>Last item from node</span></div>
                            <div class="expr-item"><code>{{ $node["Name"].all() }}</code><span>All items from node</span></div>
                        </div>
                    </div>
                    
                    <div class="expr-panel" data-tab="methods">
                        <h4>String Methods</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $json.text.toLowerCase() }}</code><span>Convert to lowercase</span></div>
                            <div class="expr-item"><code>{{ $json.text.toUpperCase() }}</code><span>Convert to uppercase</span></div>
                            <div class="expr-item"><code>{{ $json.text.trim() }}</code><span>Remove whitespace</span></div>
                            <div class="expr-item"><code>{{ $json.text.substring(0, 10) }}</code><span>Get substring</span></div>
                            <div class="expr-item"><code>{{ $json.text.replace("old", "new") }}</code><span>Replace text</span></div>
                            <div class="expr-item"><code>{{ $json.text.split(",") }}</code><span>Split into array</span></div>
                            <div class="expr-item"><code>{{ $json.text.includes("word") }}</code><span>Check if contains</span></div>
                            <div class="expr-item"><code>{{ $json.text.length }}</code><span>String length</span></div>
                        </div>
                        <h4>Array Methods</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $json.items.length }}</code><span>Array length</span></div>
                            <div class="expr-item"><code>{{ $json.items.join(", ") }}</code><span>Join array to string</span></div>
                            <div class="expr-item"><code>{{ $json.items.map(x => x.name) }}</code><span>Map to new array</span></div>
                            <div class="expr-item"><code>{{ $json.items.filter(x => x.active) }}</code><span>Filter array</span></div>
                            <div class="expr-item"><code>{{ $json.items.find(x => x.id === 5) }}</code><span>Find single item</span></div>
                            <div class="expr-item"><code>{{ $json.items.slice(0, 5) }}</code><span>Get first 5 items</span></div>
                        </div>
                        <h4>Math Operations</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $json.price * 1.2 }}</code><span>Multiplication</span></div>
                            <div class="expr-item"><code>{{ Math.round($json.value) }}</code><span>Round number</span></div>
                            <div class="expr-item"><code>{{ Math.floor($json.num) }}</code><span>Round down</span></div>
                            <div class="expr-item"><code>{{ Math.ceil($json.num) }}</code><span>Round up</span></div>
                            <div class="expr-item"><code>{{ Math.abs($json.num) }}</code><span>Absolute value</span></div>
                            <div class="expr-item"><code>{{ Math.max(1, 2, 3) }}</code><span>Maximum value</span></div>
                            <div class="expr-item"><code>{{ Math.min(1, 2, 3) }}</code><span>Minimum value</span></div>
                        </div>
                    </div>
                    
                    <div class="expr-panel" data-tab="dates">
                        <h4>Current Date/Time</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $now }}</code><span>Current date/time</span></div>
                            <div class="expr-item"><code>{{ $now.toISO() }}</code><span>ISO format string</span></div>
                            <div class="expr-item"><code>{{ $now.toFormat("yyyy-MM-dd") }}</code><span>Custom format</span></div>
                            <div class="expr-item"><code>{{ $today }}</code><span>Today at midnight</span></div>
                        </div>
                        <h4>Date Manipulation</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $now.plus({days: 7}) }}</code><span>Add 7 days</span></div>
                            <div class="expr-item"><code>{{ $now.minus({hours: 2}) }}</code><span>Subtract 2 hours</span></div>
                            <div class="expr-item"><code>{{ $now.startOf("day") }}</code><span>Start of day</span></div>
                            <div class="expr-item"><code>{{ $now.endOf("month") }}</code><span>End of month</span></div>
                        </div>
                        <h4>Format Tokens</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>yyyy</code><span>4-digit year (2024)</span></div>
                            <div class="expr-item"><code>MM</code><span>2-digit month (01-12)</span></div>
                            <div class="expr-item"><code>dd</code><span>2-digit day (01-31)</span></div>
                            <div class="expr-item"><code>HH</code><span>24-hour (00-23)</span></div>
                            <div class="expr-item"><code>mm</code><span>Minutes (00-59)</span></div>
                            <div class="expr-item"><code>ss</code><span>Seconds (00-59)</span></div>
                            <div class="expr-item"><code>EEE</code><span>Day name (Mon, Tue...)</span></div>
                            <div class="expr-item"><code>MMMM</code><span>Month name (January...)</span></div>
                        </div>
                    </div>
                    
                    <div class="expr-panel" data-tab="examples">
                        <h4>Conditional Logic</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $json.status === "active" ? "Yes" : "No" }}</code><span>Ternary operator</span></div>
                            <div class="expr-item"><code>{{ $json.name || "Unknown" }}</code><span>Default if empty</span></div>
                            <div class="expr-item"><code>{{ $json.value ?? 0 }}</code><span>Default if null/undefined</span></div>
                            <div class="expr-item"><code>{{ $json.user?.email || "N/A" }}</code><span>Optional chaining</span></div>
                        </div>
                        <h4>Data from Multiple Nodes</h4>
                        <div class="expr-items code-block">
                            <pre>// Get data from 3 nodes back
{{ $node["HTTP Request"].json.userId }}

// Combine data from multiple nodes
{
  "user": {{ $node["Get User"].json }},
  "orders": {{ $node["Get Orders"].json.items }},
  "timestamp": "{{ $now.toISO() }}"
}</pre>
                        </div>
                        <h4>Data Transformation</h4>
                        <div class="expr-items code-block">
                            <pre>// Transform array
{{ $json.users.map(u => ({
  fullName: u.first + " " + u.last,
  email: u.email.toLowerCase()
})) }}

// Filter and map
{{ $json.items
   .filter(i => i.active)
   .map(i => i.name)
   .join(", ") }}</pre>
                        </div>
                        <h4>Error Prevention</h4>
                        <div class="expr-items">
                            <div class="expr-item"><code>{{ $json.data?.items?.[0] ?? {} }}</code><span>Safe nested access</span></div>
                            <div class="expr-item"><code>{{ Array.isArray($json.items) ? $json.items.length : 0 }}</code><span>Type checking</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close button
    modal.querySelector('.expr-help-close').addEventListener('click', function () {
        modal.classList.remove('active');
    });

    // Click outside
    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Tab switching
    modal.querySelectorAll('.expr-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            var tabName = this.getAttribute('data-tab');

            modal.querySelectorAll('.expr-tab').forEach(function (t) {
                t.classList.remove('active');
            });
            modal.querySelectorAll('.expr-panel').forEach(function (p) {
                p.classList.remove('active');
            });

            this.classList.add('active');
            modal.querySelector('.expr-panel[data-tab="' + tabName + '"]').classList.add('active');
        });
    });

    // Make code snippets clickable
    modal.querySelectorAll('.expr-item code').forEach(function (code) {
        code.style.cursor = 'pointer';
        code.title = 'Click to copy';
        code.addEventListener('click', function (e) {
            e.stopPropagation();
            copyToClipboard(code.textContent);
            showNotification('Copied: ' + code.textContent.substring(0, 40) + (code.textContent.length > 40 ? '...' : ''), false);
        });
    });
}

function openExpressionHelpModal() {
    var modal = document.getElementById('exprHelpModal');
    if (!modal) {
        createExpressionHelpModal();
        modal = document.getElementById('exprHelpModal');
    }
    modal.classList.add('active');
}





/* ================================================== */
/*                                                    */
/*      SECTION 19: EXECUTION ENGINE                  */
/*                                                    */
/* ================================================== */

function setupExecutionControls() {
    var executeBtn = document.getElementById('executeBtn');
    var clearBtn = document.getElementById('clearExecutionBtn');

    if (executeBtn) {
        executeBtn.addEventListener('click', executeWorkflow);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearExecution);
    }
}

function executeWorkflow() {
    if (ArcFlow.isExecuting) {
        showNotification('Workflow is already running', true);
        return;
    }

    // Find trigger nodes
    var triggers = ArcFlow.nodes.filter(function (n) {
        var def = NodeDefinitions[n.type];
        return def && def.appearance.category === 'trigger';
    });

    if (triggers.length === 0) {
        showNotification('No trigger node found. Add a trigger to start.', true);
        return;
    }

    if (triggers.length > 1) {
        showTriggerSelectModal(triggers);
        return;
    }

    runFromTrigger(triggers[0]);
}

function showTriggerSelectModal(triggers) {
    var modal = document.getElementById('triggerSelectModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'triggerSelectModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-box">
                <div class="modal-icon">⚡</div>
                <h3>Select Trigger</h3>
                <p>Multiple triggers found. Select one to execute:</p>
                <div class="trigger-list"></div>
                <div class="modal-buttons">
                    <button class="modal-btn cancel trigger-cancel">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.trigger-cancel').addEventListener('click', function () {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    var list = modal.querySelector('.trigger-list');
    list.innerHTML = '';

    triggers.forEach(function (trigger) {
        var def = NodeDefinitions[trigger.type];
        var btn = document.createElement('button');
        btn.className = 'trigger-option';
        btn.innerHTML = '<span class="trigger-icon">' + def.appearance.icon + '</span><span>' + escapeHtml(trigger.name) + '</span>';
        btn.addEventListener('click', function () {
            modal.classList.remove('active');
            runFromTrigger(trigger);
        });
        list.appendChild(btn);
    });

    modal.classList.add('active');
}

function runFromTrigger(triggerNode, inputDataOverride) {
    // Handling Webhook "Wait" state
    if (triggerNode.type === 'webhook-trigger' && !inputDataOverride) {
        // If not pinned and no input data provided, wait for event
        if (!isNodePinned(triggerNode.id)) {
            ArcFlow.isWaitingForTrigger = true;
            ArcFlow.waitingTriggerId = triggerNode.id;

            // Connect socket if not already
            if (window.connectWebSocket) window.connectWebSocket();

            showExecutionNotification('running', 'Waiting for Webhook event... (Send POST to /webhook/)');

            // Add cancel button logic to notification
            var notif = document.getElementById('execNotification');
            if (notif) {
                var closeBtn = notif.querySelector('.close-btn');
                if (closeBtn) {
                    closeBtn.onclick = function () {
                        ArcFlow.isWaitingForTrigger = false;
                        ArcFlow.waitingTriggerId = null;
                        hideExecutionNotification();
                        showNotification('Stopped waiting', false);
                    };
                }
            }
            return;
        }
    }

    ArcFlow.isExecuting = true;

    // Clear previous execution (keep pinned)
    Object.keys(ArcFlow.executionData).forEach(function (nodeId) {
        if (!isNodePinned(nodeId)) {
            delete ArcFlow.executionData[nodeId];
        }
    });

    // Reset node statuses
    ArcFlow.nodes.forEach(function (node) {
        setNodeStatus(node.id, isNodePinned(node.id) ? 'pinned' : 'idle');
    });

    showExecutionNotification('running', 'Executing workflow...');

    var context = {
        workflowId: getUrlParam('id') || 'unknown',
        workflowName: document.getElementById('workflowTitle')?.value || 'Untitled',
        startTime: Date.now()
    };

    var executedNodes = [];

    // Use override data if provided (from WebSocket)
    var initialInput = inputDataOverride || null;

    highlightNode(triggerNode.id, '#10b981');
    setTimeout(function () { clearHighlight(triggerNode.id); }, 2000);

    executeNode(triggerNode, initialInput, context, executedNodes, function (success) {
        ArcFlow.isExecuting = false;

        var duration = Date.now() - context.startTime;

        ArcFlow.lastExecutionResult = {
            success: success,
            nodes: executedNodes,
            duration: duration,
            timestamp: new Date().toISOString()
        };

        if (success) {
            showExecutionNotification('success', 'Completed in ' + duration + 'ms');
        } else {
            showExecutionNotification('error', 'Execution failed');
        }

        // Save Execution Log
        saveExecutionLog(context, success, executedNodes);

        // Refresh modal if open
        if (ArcFlow.currentModalNodeId) {
            refreshNodeModal();
        }
    });
}

function executeNode(node, inputData, context, executedNodes, callback) {
    var def = NodeDefinitions[node.type];

    if (!def) {
        callback(false);
        return;
    }

    setNodeStatus(node.id, 'executing');

    // Store input
    if (!ArcFlow.executionData[node.id]) {
        ArcFlow.executionData[node.id] = {};
    }
    ArcFlow.executionData[node.id].input = inputData;

    // Create node context
    var nodeContext = {
        nodeId: node.id,
        nodeName: node.name,
        workflowId: context.workflowId,
        workflowName: context.workflowName
    };

    // Execute
    def.execute(inputData, node.config, nodeContext)
        .then(function (result) {
            var isPinned = isNodePinned(node.id);

            executedNodes.push({
                id: node.id,
                name: node.name,
                success: result.success,
                output: result.output,
                error: result.error,
                pinned: isPinned
            });

            if (result.success) {
                // Store output
                ArcFlow.executionData[node.id].output = result.output;
                ArcFlow.executionData[node.id].status = 'success';

                setNodeStatus(node.id, isPinned ? 'pinned' : 'success');

                // Get downstream nodes
                var nextNodes = getConnectedOutputNodes(node.id);

                if (nextNodes.length === 0) {
                    callback(true);
                } else {
                    // Execute next nodes in sequence
                    executeNextNodes(nextNodes, result.output, context, executedNodes, callback);
                }
            } else {
                // Error
                ArcFlow.executionData[node.id].error = result.error;
                ArcFlow.executionData[node.id].status = 'error';

                setNodeStatus(node.id, 'error');
                showNodeErrorBadge(node.id, result.error);

                callback(false);
            }
        })
        .catch(function (err) {
            ArcFlow.executionData[node.id].error = err.message;
            ArcFlow.executionData[node.id].status = 'error';

            setNodeStatus(node.id, 'error');
            showNodeErrorBadge(node.id, err.message);

            executedNodes.push({
                id: node.id,
                name: node.name,
                success: false,
                error: err.message
            });

            callback(false);
        });
}

function executeNextNodes(nodes, inputData, context, executedNodes, callback) {
    if (nodes.length === 0) {
        callback(true);
        return;
    }

    var completed = 0;
    var hasError = false;

    nodes.forEach(function (node) {
        executeNode(node, inputData, context, executedNodes, function (success) {
            completed++;
            if (!success) hasError = true;

            if (completed === nodes.length) {
                callback(!hasError);
            }
        });
    });
}

function setNodeStatus(nodeId, status) {
    var el = document.getElementById(nodeId);
    if (!el) return;

    el.classList.remove('executing', 'success', 'error', 'pinned', 'idle');

    if (status && status !== 'idle') {
        el.classList.add(status);
    }
}

function showNodeErrorBadge(nodeId, message) {
    var el = document.getElementById(nodeId);
    if (!el) return;

    var badge = el.querySelector('.node-error-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'node-error-badge';
        el.appendChild(badge);
    }

    // Clean up message for UI
    var displayMessage = message;
    if (typeof message === 'object') displayMessage = JSON.stringify(message);
    if (displayMessage.length > 200) displayMessage = displayMessage.substring(0, 200) + '...';

    badge.innerHTML = '!';
    badge.title = displayMessage; // Hover
    badge.onclick = function (e) {
        e.stopPropagation();
        showNotification(typeof message === 'object' ? JSON.stringify(message, null, 2) : message, true);
    };
}

function clearNodeErrorBadge(nodeId) {
    var el = document.getElementById(nodeId);
    if (!el) return;

    var badge = el.querySelector('.node-error-badge');
    if (badge) badge.remove();
}

function clearExecution() {
    // Clear execution data (keep pinned)
    Object.keys(ArcFlow.executionData).forEach(function (nodeId) {
        if (!isNodePinned(nodeId)) {
            delete ArcFlow.executionData[nodeId];
        }
    });

    ArcFlow.lastExecutionResult = null;

    // Reset node statuses
    ArcFlow.nodes.forEach(function (node) {
        setNodeStatus(node.id, isNodePinned(node.id) ? 'pinned' : 'idle');
        clearNodeErrorBadge(node.id);
    });

    hideExecutionNotification();
    showNotification('Execution cleared (pinned data kept)', false);

    if (ArcFlow.currentModalNodeId) {
        refreshNodeModal();
    }
}

function showExecutionNotification(status, message) {
    var notif = document.getElementById('execNotification');

    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'execNotification';
        notif.className = 'exec-notification';
        document.body.appendChild(notif);
    }

    var icon = status === 'running' ? '⚡' : (status === 'success' ? '✓' : '✗');

    notif.className = 'exec-notification ' + status;
    notif.innerHTML = `
        <div class="exec-notif-content">
            <span class="exec-notif-icon">${icon}</span>
            <span class="exec-notif-msg">${escapeHtml(message)}</span>
        </div>
        <div class="exec-notif-actions">
            ${status === 'running' ? '<button class="exec-notif-btn stop-btn">⬛ Stop</button>' : ''}
            ${status !== 'running' ? '<button class="exec-notif-btn view-btn">Details</button>' : ''}
            <button class="exec-notif-btn close-btn">✕</button>
        </div>
    `;

    notif.classList.add('active');

    // Stop button
    var stopBtn = notif.querySelector('.stop-btn');
    if (stopBtn) {
        stopBtn.addEventListener('click', function () {
            ArcFlow.executionAborted = true;
            ArcFlow.isExecuting = false;
            ArcFlow.isWaitingForTrigger = false;
            showExecutionNotification('error', 'Execution stopped by user');

            // Reset node statuses
            ArcFlow.nodes.forEach(function (node) {
                var el = document.getElementById(node.id);
                if (el && el.classList.contains('executing')) {
                    setNodeStatus(node.id, 'idle');
                }
            });
        });
    }

    // View details button
    var viewBtn = notif.querySelector('.view-btn');
    if (viewBtn) {
        viewBtn.addEventListener('click', showExecutionDetails);
    }

    // Close button
    notif.querySelector('.close-btn').addEventListener('click', hideExecutionNotification);
}

function hideExecutionNotification() {
    var notif = document.getElementById('execNotification');
    if (notif) notif.classList.remove('active');
}

function showExecutionDetails() {
    var modal = document.getElementById('executionModal');
    if (!modal) return;

    var result = ArcFlow.lastExecutionResult;
    var icon = document.getElementById('execIcon');
    var title = document.getElementById('execTitle');
    var output = document.getElementById('execOutput');
    var closeBtn = document.getElementById('closeExecution');

    if (result && result.success) {
        icon.textContent = '✓';
        icon.style.color = '#10b981';
        title.textContent = 'Workflow Execution Successful';
    } else {
        icon.textContent = '✗';
        icon.style.color = '#ef4444';
        title.textContent = 'Workflow Execution Failed';
    }

    var log = '';
    log += '┌─────────────────────────────────────────────────────────────────────────────┐\n';
    log += '│                          ARCFLOW EXECUTION AUDIT                            │\n';
    log += '└─────────────────────────────────────────────────────────────────────────────┘\n\n';

    if (result) {
        log += '  ◈ SESSION       ' + (ArcFlow.workflowId || 'local_session') + '\n';
        log += '  ◈ TIMESTAMP     ' + (result.timestamp || new Date().toISOString()) + '\n';
        log += '  ◈ DURATION      ' + (result.duration || 0) + 'ms\n';
        log += '  ◈ FINAL STATUS  ' + (result.success ? '✅ SUCCESS' : '❌ FAILED') + '\n\n';

        log += '  ─────────────────────────────────────────────────────────────────────────\n';
        log += '                                NODE PIPELINE                              \n';
        log += '  ─────────────────────────────────────────────────────────────────────────\n\n';

        if (result.nodes) {
            result.nodes.forEach(function (node, i) {
                var status = node.success ? '✅ SUCCESS' : '❌ FAILED';
                log += '  [' + (i + 1) + '] ' + node.name.toUpperCase() + (node.pinned ? ' (PINNED 📌)' : '') + '\n';
                log += '      Status:   ' + status + '\n';

                if (node.error) {
                    log += '      Error:    ' + node.error + '\n';
                }

                if (node.output) {
                    var items = normalizeToArray(node.output);

                    items.forEach(function (item, idx) {
                        if (items.length > 1) log += '      ── Item ' + (idx + 1) + ' ──\n';

                        // Handle Specialized AI output
                        if (item.toolCalls && item.toolCalls.length > 0) {
                            log += '      ◈ AGENT REASONING CHAIN ◈\n';
                            item.toolCalls.forEach(function (tc, tcIdx) {
                                log += '        ' + (tcIdx + 1) + '. TOOL CALL: ' + tc.tool + '\n';
                                log += '           Args:   ' + JSON.stringify(tc.arguments) + '\n';
                                if (tc.result) {
                                    var resStr = typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result);
                                    if (resStr.length > 200) resStr = resStr.substring(0, 197) + '...';
                                    log += '           Result: ' + resStr + '\n';
                                } else {
                                    log += '           Result: [Waiting/No Output]\n';
                                }
                            });
                        }

                        if (item.text || item.response) {
                            var text = item.text || item.response;
                            log += '      ◈ RESPONSE:\n';
                            log += '        ' + text.replace(/\n/g, '\n        ') + '\n';
                        } else if (typeof item === 'object') {
                            log += '      ◈ DATA:\n';
                            var jsonStr = JSON.stringify(item, null, 2);
                            log += jsonStr.split('\n').map(function (line) { return '        ' + line; }).join('\n') + '\n';
                        } else {
                            log += '      ◈ VALUE: ' + item + '\n';
                        }
                    });
                }
                log += '\n';
            });
        }
    } else {
        log += '  ⚠️  No execution audit data found for the current session.\n';
    }

    log += '  ─────────────────────────────────────────────────────────────────────────\n';
    log += '                            END OF EXECUTION REPORT                        \n';
    log += '  ─────────────────────────────────────────────────────────────────────────\n';

    output.innerHTML = '<pre style="font-family: \'Fira Code\', \'JetBrains Mono\', monospace; font-size: 13px; line-height: 1.6; color: #e2e8f0;">' + escapeHtml(log) + '</pre>';
    closeBtn.style.display = 'block';
    modal.classList.add('active');
}

// Setup execution modal close
document.addEventListener('DOMContentLoaded', function () {
    var closeBtn = document.getElementById('closeExecution');
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            var modal = document.getElementById('executionModal');
            if (modal) modal.classList.remove('active');
        });
    }
});





/* ================================================== */
/*                                                    */
/*      SECTION 20: DATA PERSISTENCE                  */
/*                                                    */
/* ================================================== */

function getCanvasNodes() {
    return ArcFlow.nodes;
}

function getCanvasConnections() {
    return ArcFlow.connections;
}

function getPinnedData() {
    return ArcFlow.pinnedData;
}

function loadNodesFromData(nodesData) {
    ArcFlow.nodes = [];
    ArcFlow.connections = [];
    ArcFlow.executionData = {};

    var container = document.getElementById('canvasNodes');
    if (container) container.innerHTML = '';

    var placeholder = document.getElementById('canvasPlaceholder');

    if (!nodesData || nodesData.length === 0) {
        if (placeholder) placeholder.classList.remove('hidden');
        return;
    }

    if (placeholder) placeholder.classList.add('hidden');

    // Find max node counter
    var maxCounter = 0;
    nodesData.forEach(function (node) {
        var match = node.id.match(/node_(\d+)_/);
        if (match) {
            var num = parseInt(match[1]);
            if (num > maxCounter) maxCounter = num;
        }
    });
    ArcFlow.nodeCounter = maxCounter;

    // Render nodes
    nodesData.forEach(function (node) {
        var def = NodeDefinitions[node.type];
        if (def) {
            // Ensure name
            if (!node.name) node.name = def.appearance.name;

            // Ensure config
            if (!node.config) node.config = {};
            def.settings.forEach(function (setting) {
                if (node.config[setting.name] === undefined) {
                    node.config[setting.name] = setting.default || '';
                }
            });

            ArcFlow.nodes.push(node);
            renderNode(node);
        }
    });

    clearUnsavedChanges();
}

function loadConnectionsFromData(connectionsData) {
    ArcFlow.connections = (connectionsData || []).map(function (conn, i) {
        if (!conn.id) {
            conn.id = 'conn_' + Date.now() + '_' + i;
        }
        return conn;
    });

    renderConnections();
}

function loadPinnedDataFromData(pinnedData) {
    ArcFlow.pinnedData = pinnedData || {};

    Object.keys(ArcFlow.pinnedData).forEach(function (nodeId) {
        if (ArcFlow.pinnedData[nodeId] && ArcFlow.pinnedData[nodeId].isPinned) {
            updateNodePinnedVisual(nodeId, true);

            // Also populate execution data
            ArcFlow.executionData[nodeId] = {
                output: ArcFlow.pinnedData[nodeId].output,
                status: 'pinned'
            };
        }
    });
}





/* ================================================== */
/*                                                    */
/*      SECTION 21: UTILITIES                         */
/*                                                    */
/* ================================================== */

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getUrlParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function showNotification(message, isError) {
    var notif = document.getElementById('notification');
    var icon = document.getElementById('notificationIcon');
    var msg = document.getElementById('notificationMessage');

    if (!notif) return;

    msg.textContent = message;
    icon.textContent = isError ? '✗' : '✓';
    notif.classList.toggle('error', isError);
    notif.classList.add('active');

    setTimeout(function () {
        notif.classList.remove('active');
    }, isError ? 5000 : 3000);
}




/* ================================================== */
/*                                                    */
/*      SECTION 21B: WEBSOCKET CLIENT                 */
/*      For Webhook Trigger Real-time Events          */
/*                                                    */
/* ================================================== */

function connectWebSocket() {
    // Check if already connected
    if (ArcFlow.ws && ArcFlow.ws.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
    }

    // Determine WebSocket URL (same host, port 8080)
    var wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsHost = window.location.hostname || 'localhost';
    var wsUrl = wsProtocol + '//' + wsHost + ':8080';

    console.log('Connecting to WebSocket:', wsUrl);

    try {
        ArcFlow.ws = new WebSocket(wsUrl);

        ArcFlow.ws.onopen = function () {
            console.log('✓ WebSocket connected');
            showNotification('WebSocket connected', false);

            // Send registration if we're waiting for a trigger
            if (ArcFlow.isWaitingForTrigger && ArcFlow.waitingTriggerId) {
                var triggerNode = getNodeById(ArcFlow.waitingTriggerId);
                if (triggerNode) {
                    ArcFlow.ws.send(JSON.stringify({
                        type: 'register',
                        workflowId: getUrlParam('id') || 'default',
                        nodeId: triggerNode.id
                    }));
                }
            }
        };

        ArcFlow.ws.onmessage = function (event) {
            try {
                var data = JSON.parse(event.data);
                handleWebhookData(data);
            } catch (e) {
                console.error('WebSocket message parse error:', e);
            }
        };

        ArcFlow.ws.onclose = function () {
            console.log('WebSocket disconnected');
            ArcFlow.ws = null;

            // Reconnect if still waiting for trigger
            if (ArcFlow.isWaitingForTrigger) {
                setTimeout(connectWebSocket, 3000);
            }
        };

        ArcFlow.ws.onerror = function (error) {
            console.error('WebSocket error:', error);
            showNotification('WebSocket connection failed - webhook triggers will use polling', true);
        };

    } catch (e) {
        console.error('WebSocket connection failed:', e);
    }
}

function handleWebhookData(data) {
    console.log('Received webhook data:', data);

    // Check if we're waiting for this trigger
    if (!ArcFlow.isWaitingForTrigger || !ArcFlow.waitingTriggerId) {
        console.log('Not waiting for trigger, ignoring webhook data');
        return;
    }

    var triggerNode = getNodeById(ArcFlow.waitingTriggerId);
    if (!triggerNode) {
        console.error('Trigger node not found:', ArcFlow.waitingTriggerId);
        return;
    }

    // Clear waiting state
    ArcFlow.isWaitingForTrigger = false;
    ArcFlow.waitingTriggerId = null;

    // Show toast notification
    showNotification('📨 Webhook received! Executing workflow...', false);

    // Continue execution with received data
    var webhookPayload = data.body || data.payload || data;

    // Normalize to array format like n8n
    var inputData = Array.isArray(webhookPayload) ? webhookPayload : [webhookPayload];

    // Resume workflow execution
    runFromTrigger(triggerNode, inputData);
}

function disconnectWebSocket() {
    if (ArcFlow.ws) {
        ArcFlow.ws.close();
        ArcFlow.ws = null;
    }
}

// Export WebSocket functions
window.connectWebSocket = connectWebSocket;
window.disconnectWebSocket = disconnectWebSocket;
window.handleWebhookData = handleWebhookData;


/* ================================================== */
/*                                                    */
/*      SECTION 22: EXPORTS                           */
/*                                                    */
/* ==================================================  */

// Global exports
window.ArcFlow = ArcFlow;
window.NodeDefinitions = NodeDefinitions;

// Data functions
window.getCanvasNodes = getCanvasNodes;
window.getCanvasConnections = getCanvasConnections;
window.getPinnedData = getPinnedData;
window.loadNodesFromData = loadNodesFromData;
window.loadConnectionsFromData = loadConnectionsFromData;
window.loadPinnedDataFromData = loadPinnedDataFromData;

// State functions
window.markUnsavedChanges = markUnsavedChanges;
window.clearUnsavedChanges = clearUnsavedChanges;

// Expression functions
window.processExpression = processExpression;
window.validateExpression = validateExpression;
window.buildDragExpression = buildDragExpression;
window.hasExpression = hasExpression;

// Utility functions
window.showNotification = showNotification;
window.escapeHtml = escapeHtml;




// AI Memory
/* AI Memory node removed */

// Vector Store
NodeDefinitions['vector-store'] = {
    appearance: { name: 'Vector Store', icon: '🧠', color: '#8b5cf6', category: 'ai', section: 'AI Models', description: 'Store & Retrieve Embeddings' },
    settings: [
        { name: 'mode', label: 'Mode', type: 'select', options: ['Retrieve', 'Upsert', 'Delete'], default: 'Retrieve' },
        { name: 'provider', label: 'Provider', type: 'select', options: ['Memory (Local)', 'Pinecone', 'Supabase'], default: 'Memory (Local)' },
        { name: 'credential', label: 'Credential', type: 'credential' },
        { name: 'text', label: 'Input Text', type: 'expression', placeholder: '{{ $json.text }}', required: true },
        { name: 'limit', label: 'Limit', type: 'number', default: 5 }
    ],
    connectors: { hasInput: true, hasOutput: true },
    defaultData: [{ text: 'Result text', score: 0.95 }],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) { resolve({ success: true, output: getPinnedOutput(context.nodeId) }); return; }
            var mode = config.mode || 'Retrieve';
            var text = processExpression(config.text || '', inputData, context);

            // Simulation of vector store
            resolve({
                success: true,
                output: [{
                    simulated: true,
                    mode: mode,
                    query: text,
                    matches: [
                        { text: 'Simulated match 1 for: ' + text, score: 0.98 },
                        { text: 'Simulated match 2', score: 0.85 }
                    ]
                }]
            });
        });
    }
};

// Read File
NodeDefinitions['read-file'] = {
    appearance: { name: 'Read File', icon: '📄', color: '#f59e0b', category: 'utility', section: 'Utility', description: 'Read file from storage' },
    settings: [
        { name: 'filename', label: 'Filename', type: 'expression', placeholder: 'data.json', required: true },
        { name: 'encoding', label: 'Encoding', type: 'select', options: ['utf8', 'base64'], default: 'utf8' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    defaultData: [{ content: '', filename: '' }],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) { resolve({ success: true, output: getPinnedOutput(context.nodeId) }); return; }
            var filename = processExpression(config.filename || '', inputData, context);
            fetch('nodes1.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'read_file', filename: filename, encoding: config.encoding })
            })
                .then(res => res.json())
                .then(data => resolve(data.success ? { success: true, output: [data.data] } : { success: false, error: data.message }))
                .catch(err => resolve({ success: false, error: err.message }));
        });
    }
};

// Write File
NodeDefinitions['write-file'] = {
    appearance: { name: 'Write File', icon: '💾', color: '#10b981', category: 'utility', section: 'Utility', description: 'Write file to storage' },
    settings: [
        { name: 'filename', label: 'Filename', type: 'expression', placeholder: 'output.json', required: true },
        { name: 'content', label: 'Content', type: 'expression', placeholder: '{{ $json.data }}', required: true },
        { name: 'encoding', label: 'Encoding', type: 'select', options: ['utf8', 'base64'], default: 'utf8' },
        { name: 'append', label: 'Append', type: 'select', options: ['false', 'true'], default: 'false' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    defaultData: [{ written: true }],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) { resolve({ success: true, output: getPinnedOutput(context.nodeId) }); return; }
            var filename = processExpression(config.filename || '', inputData, context);
            var content = processExpression(config.content || '', inputData, context);
            if (typeof content !== 'string') content = JSON.stringify(content);

            fetch('nodes1.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'write_file',
                    filename: filename,
                    content: content,
                    encoding: config.encoding,
                    append: config.append === 'true'
                })
            })
                .then(res => res.json())
                .then(data => resolve(data.success ? { success: true, output: [data.data] } : { success: false, error: data.message }))
                .catch(err => resolve({ success: false, error: err.message }));
        });
    }
};

// Compression
NodeDefinitions['compression'] = {
    appearance: { name: 'Compression', icon: '📦', color: '#6366f1', category: 'utility', section: 'Utility', description: 'Zip/Unzip files' },
    settings: [
        { name: 'operation', label: 'Operation', type: 'select', options: ['zip'], default: 'zip' },
        { name: 'archiveName', label: 'Archive Name', type: 'expression', placeholder: 'archive.zip' },
        { name: 'files', label: 'Files to Compress (Array)', type: 'expression', placeholder: '{{ ["file1.txt", "file2.txt"] }}' }
    ],
    connectors: { hasInput: true, hasOutput: true },
    defaultData: [{ archiveName: 'archive.zip', size: 0 }],
    execute: function (inputData, config, context) {
        return new Promise(function (resolve) {
            if (isNodePinned(context.nodeId)) { resolve({ success: true, output: getPinnedOutput(context.nodeId) }); return; }
            var files = [];
            try { files = JSON.parse(processExpression(config.files || '[]', inputData, context)); } catch (e) { }
            var archiveName = processExpression(config.archiveName || 'archive.zip', inputData, context);

            fetch('nodes1.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'compress_file', files: files, archiveName: archiveName })
            })
                .then(res => res.json())
                .then(data => resolve(data.success ? { success: true, output: [data.data] } : { success: false, error: data.message }))
                .catch(err => resolve({ success: false, error: err.message }));
        });
    }
};



// ================================================== 
//      SECTION 23: UTILITIES
// ==================================================

function normalizeToArray(data) {
    if (data === null || data === undefined) return [];
    if (Array.isArray(data)) return data;
    return [data];
}



/* ================================================== */
/*      SECTION 24: WEBSOCKET CLIENT                  */
/*      Real-time Trigger Waiting                     */
/* ================================================== */

function connectWebSocket() {
    if (ArcFlow.socket) return;

    try {
        ArcFlow.socket = new WebSocket('ws://localhost:8080');

        ArcFlow.socket.onopen = function () {
            console.log('🔌 WebSocket Connected');
            showNotification('Connected to Event Server', false);

            // Send identity
            ArcFlow.socket.send(JSON.stringify({
                type: 'register',
                client: 'editor',
                workflowId: ArcFlow.workflow.id
            }));
        };

        ArcFlow.socket.onmessage = function (event) {
            try {
                var msg = JSON.parse(event.data);
                handleWebSocketMessage(msg);
            } catch (e) {
                console.error('WebSocket Error:', e);
            }
        };

        ArcFlow.socket.onclose = function () {
            console.log('🔌 WebSocket Disconnected');
            ArcFlow.socket = null;
            // Retry after 5s
            setTimeout(connectWebSocket, 5000);
        };

    } catch (e) {
        console.error('WebSocket Connection Failed:', e);
    }
}

function handleWebSocketMessage(msg) {
    if (msg.type === 'trigger_event') {
        var eventData = msg.data;

        // Check if we are waiting for this trigger
        if (ArcFlow.isWaitingForTrigger && ArcFlow.waitingTriggerId) {
            var triggerNode = getNodeById(ArcFlow.waitingTriggerId);

            if (triggerNode) {
                // Match method and path if available
                var method = triggerNode.config.method || 'GET';
                var path = triggerNode.config.path || '/webhook/';

                // For demo, we just accept any webhook event if waiting
                // In real app, check eventData.path === path specific logic

                showNotification('⚡ Webhook Event Received!', false);
                ArcFlow.isWaitingForTrigger = false;
                ArcFlow.waitingTriggerId = null;

                // Resume execution with this data
                runFromTrigger(triggerNode, [eventData]);
            }
        }
    }
}

// Webhook Polling Fallback (ensures triggers work even without WebSockets)
function pollWebhooks() {
    fetch('webhook-triggers')
        .then(function (res) { return res.json(); })
        .then(function (result) {
            if (result.success && result.triggers && result.triggers.length > 0) {
                result.triggers.forEach(function (triggerEvent) {
                    // Match with active webhook nodes
                    ArcFlow.nodes.forEach(function (node) {
                        if (node.type === 'webhook-trigger' || node.type === 'x402-webhook') {
                            var nodePath = node.config.path || '';
                            var nodeMethod = (node.config.httpMethod || node.config.method || 'GET').toUpperCase();
                            var eventMethod = (triggerEvent.method || 'GET').toUpperCase();

                            if (nodePath === triggerEvent.path && (nodeMethod === 'ANY' || nodeMethod === eventMethod)) {
                                console.log('⚡ Webhook Polled Event Triggered:', nodePath, eventMethod);
                                showNotification('Webhook Triggered: ' + nodePath, false);
                                highlightNode(node.id, '#ec4899');
                                runFromTrigger(node, [triggerEvent]);
                                setTimeout(function () { clearHighlight(node.id); }, 2000);
                            }
                        }
                    });
                });

                // Clear queue after processing
                fetch('webhook-triggers', { method: 'DELETE' });
            }
        })
        .catch(function (err) { console.warn('Webhook polling error:', err); });
}

// Auto-connect and start polling on load
document.addEventListener('DOMContentLoaded', function () {
    connectWebSocket();
    setInterval(pollWebhooks, 2000); // Polling every 2 seconds
});

console.log('%c ArcFlow v7.0 Ready ', 'background:#8b5cf6;color:white;padding:5px 10px;border-radius:5px;font-weight:bold;');
console.log('Nodes loaded:', Object.keys(NodeDefinitions).length);

// ==================================================
// CREDENTIAL HELPERS
// ==================================================



function openCredentialModal() {
    window.open('landcredits.html', '_blank');
}


