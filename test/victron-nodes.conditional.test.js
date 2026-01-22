const victronNodesInitFunction = require('../src/nodes/victron-nodes');

/**
 * Creates a mock global context for Node-RED
 * @returns {Object} Mock global context with set/get methods
 */
function createMockGlobalContext() {
    return {
        set: jest.fn(),
        get: jest.fn()
    };
}

/**
 * Creates a mock Victron client node with all required methods
 * @param {Object} options - Configuration options
 * @param {Function} options.subscribe - Mock subscribe function
 * @param {Function} options.addStatusListener - Mock addStatusListener function
 * @param {Function} options.removeStatusListener - Mock removeStatusListener function
 * @returns {Object} Mock victron-client node
 */
function createMockVictronClientNode({ subscribe, addStatusListener, removeStatusListener }) {
    return {
        addStatusListener,
        removeStatusListener,
        client: {
            subscribe,
            unsubscribe: jest.fn(),
            client: {
                connected: true,
                getValue: jest.fn(),
                services: {}
            }
        },
        showValues: true
    };
}

/**
 * Creates a mock Node-RED createNode function
 * @param {Object} globalContext - Mock global context
 * @param {Function} handleStatus - Status handler for validation
 * @returns {Function} createNode function
 */
function createMockCreateNode(globalContext, handleStatus) {
    return function(self, config) {
        Object.assign(self, config);
        self.node = self;
        self.on = jest.fn();
        self.send = jest.fn();
        self.status = jest.fn((message) => {
            handleStatus(self, message, self, false);
        });
        self.context = jest.fn().mockReturnValue({
            global: globalContext
        });
    };
}

/**
 * Creates the complete mock RED object for testing
 * @returns {Object} Object containing mockRED and helper references
 */
function createMockRED() {
    const handleStatus = jest.fn(function(_node, message, _reportingNode, _muteStatusEvent) {
        if (message.hasOwnProperty('text') && typeof message.text !== 'string') {
            message.text = message.text.toString();
        }
    });

    const globalContext = createMockGlobalContext();
    const subscribe = jest.fn();
    const addStatusListener = jest.fn();
    const removeStatusListener = jest.fn();

    const victronClientNode = createMockVictronClientNode({
        subscribe,
        addStatusListener,
        removeStatusListener
    });

    const getNodeFn = function getNode(id) {
        if (id === 'victron-client-id') {
            return victronClientNode;
        }
        throw new Error('[mock getNode] Node not found: ' + id);
    };

    const mockRED = {
        nodes: {
            registerType: jest.fn(),
            createNode: createMockCreateNode(globalContext, handleStatus),
            getNode: getNodeFn
        }
    };

    return {
        mockRED,
        subscribe,
        addStatusListener,
        removeStatusListener,
        globalContext,
        handleStatus,
        victronClientNode
    };
}

describe('victron-nodes conditional mode', () => {
    // Mock Node-RED environment
    let mockRED;
    let subscribe, addStatusListener, removeStatusListener;
    let globalContext;
    let handleStatus;

    beforeEach(() => {
        const mocks = createMockRED();
        mockRED = mocks.mockRED;
        subscribe = mocks.subscribe;
        addStatusListener = mocks.addStatusListener;
        removeStatusListener = mocks.removeStatusListener;
        globalContext = mocks.globalContext;
        handleStatus = mocks.handleStatus;

        // Initialize the nodes
        victronNodesInitFunction(mockRED);
    });

    const getBaseInputNodeDef = () => {
        // Find the specific 'victron-input-battery' registration to get the defaults
        const registerCall = mockRED.nodes.registerType.mock.calls.find(call => call[0] === 'victron-input-battery');
        if (!registerCall) {
            throw new Error('victron-input-battery node not registered');
        }
        return registerCall[1]; // This is the entire node definition object
    };

    // Helper to get a specific output message from a specific node.send call
    const getMessageFromSendCall = (node, sendCallIndex, outputIndex = 0) => {
        if (!node.send.mock.calls[sendCallIndex]) return undefined;
        return node.send.mock.calls[sendCallIndex][0][outputIndex];
    };

    // Helper to get the last status text
    const getLastStatusText = (node) => {
        if (!node.status.mock.calls.length) return undefined;
        const lastCallArgs = node.status.mock.calls[node.status.mock.calls.length - 1][0];
        return lastCallArgs.text;
    };

    // Test for basic conditional mode functionality
    it('should send payload to output 1 and conditional result to output 2 when conditional mode is enabled (single condition - TRUE)', () => {
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Conditional Test Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.5,
            outputTrue: 'Condition Met',
            outputFalse: 'Condition Not Met',
            debounce: 0
        });

        // Simulate a value that makes the condition TRUE
        subscribe.mock.calls[0][2]({ value: 13.0 }); // Primary value

        expect(node.send).toHaveBeenCalledTimes(2); // One for primary, one for conditional
        expect(getMessageFromSendCall(node, 0, 0)).toEqual({ // First send call, first output
            payload: 13.0,
            topic: 'Conditional Test Node'
        });
        expect(getMessageFromSendCall(node, 0, 1)).toBeNull(); // First send call, second output is null

        expect(getMessageFromSendCall(node, 1, 0)).toBeNull(); // Second send call, first output is null
        expect(getMessageFromSendCall(node, 1, 1)).toEqual({ // Second send call, second output
            payload: 'Condition Met',
            topic: 'Conditional Test Node',
            info: expect.any(Object)
        });
        expect(getLastStatusText(node)).toBe('13 | true');
    });

    it('should send payload to output 1 and conditional result to output 2 when conditional mode is enabled (single condition - FALSE)', () => {
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Conditional Test Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.5,
            outputTrue: 'Condition Met',
            outputFalse: 'Condition Not Met',
            debounce: 0
        });

        // Simulate a value that makes the condition FALSE
        subscribe.mock.calls[0][2]({ value: 12.0 }); // Primary value

        expect(node.send).toHaveBeenCalledTimes(2);
        expect(getMessageFromSendCall(node, 0, 0)).toEqual({
            payload: 12.0,
            topic: 'Conditional Test Node'
        });
        expect(getMessageFromSendCall(node, 0, 1)).toBeNull();

        expect(getMessageFromSendCall(node, 1, 0)).toBeNull();
        expect(getMessageFromSendCall(node, 1, 1)).toEqual({
            payload: 'Condition Not Met',
            topic: 'Conditional Test Node',
            info: expect.any(Object)
        });
        expect(getLastStatusText(node)).toBe('12 | false');
    });

    it('should handle null/undefined primary input value gracefully', () => {
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Conditional Test Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.5,
            outputTrue: 'Condition Met',
            outputFalse: 'Condition Not Met',
            debounce: 0
        });

        // Simulate a null value for the primary input
        subscribe.mock.calls[0][2]({ value: null });

        // Expect primary output to still send null payload
        expect(node.send).toHaveBeenCalledTimes(1); // Only the primary output send
        expect(getMessageFromSendCall(node, 0, 0)).toEqual({
            payload: null,
            topic: 'Conditional Test Node'
        });
        expect(getMessageFromSendCall(node, 0, 1)).toBeNull();
        // Expect no conditional output yet, status waiting
        expect(getLastStatusText(node)).toBe('null | waiting');

        // Simulate an undefined value for the primary input
        subscribe.mock.calls[0][2]({ value: undefined });
        expect(node.send).toHaveBeenCalledTimes(2); // primary output of second input event
        expect(getMessageFromSendCall(node, 1, 0)).toEqual({
            payload: undefined,
            topic: 'Conditional Test Node'
        });
        expect(getMessageFromSendCall(node, 1, 1)).toBeNull();
        expect(getLastStatusText(node)).toBe('undefined | waiting');
    });

    // Test two conditions (AND)
    it('should evaluate two conditions with AND logic (TRUE && TRUE)', () => {
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Dual Conditional Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.0,
            condition2Enabled: true,
            condition2Service: 'com.victronenergy.solarcharger',
            condition2Path: '/Dc/0/Current',
            condition2ServiceObj: { name: 'Solar Charger', service: 'com.victronenergy.solarcharger' },
            condition2PathObj: { name: 'Current', path: '/Dc/0/Current', type: 'float' },
            condition2Operator: '<',
            condition2Threshold: 5.0,
            logicOperator: 'AND',
            outputTrue: 'Both True',
            outputFalse: 'Not Both True',
            debounce: 0
        });

        // Simulate primary input
        subscribe.mock.calls[0][2]({ value: 12.8 }); // Condition 1 TRUE

        // Simulate secondary input
        subscribe.mock.calls[1][2]({ value: 3.0 }); // Condition 2 TRUE

        expect(node.send).toHaveBeenCalledTimes(2); // Primary, then conditional
        expect(getMessageFromSendCall(node, 0, 0)).toEqual({ payload: 12.8, topic: 'Dual Conditional Node' }); // First send call, primary output
        expect(getMessageFromSendCall(node, 1, 1).payload).toBe('Both True'); // Second send call, conditional output
        expect(getLastStatusText(node)).toBe('12.8 | true');
    });

    it('should evaluate two conditions with AND logic (TRUE && FALSE)', () => {
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Dual Conditional Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.0,
            condition2Enabled: true,
            condition2Service: 'com.victronenergy.solarcharger',
            condition2Path: '/Dc/0/Current',
            condition2ServiceObj: { name: 'Solar Charger', service: 'com.victronenergy.solarcharger' },
            condition2PathObj: { name: 'Current', path: '/Dc/0/Current', type: 'float' },
            condition2Operator: '<',
            condition2Threshold: 5.0,
            logicOperator: 'AND',
            outputTrue: 'Both True',
            outputFalse: 'Not Both True',
            debounce: 0
        });

        // Simulate primary input
        subscribe.mock.calls[0][2]({ value: 12.8 }); // Condition 1 TRUE

        // Simulate secondary input
        subscribe.mock.calls[1][2]({ value: 6.0 }); // Condition 2 FALSE

        expect(node.send).toHaveBeenCalledTimes(2);
        expect(getMessageFromSendCall(node, 0, 0)).toEqual({ payload: 12.8, topic: 'Dual Conditional Node' });
        expect(getMessageFromSendCall(node, 1, 1).payload).toBe('Not Both True');
        expect(getLastStatusText(node)).toBe('12.8 | false');
    });

    it('should evaluate two conditions with OR logic (TRUE || FALSE)', () => {
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Dual Conditional Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.0,
            condition2Enabled: true,
            condition2Service: 'com.victronenergy.solarcharger',
            condition2Path: '/Dc/0/Current',
            condition2ServiceObj: { name: 'Solar Charger', service: 'com.victronenergy.solarcharger' },
            condition2PathObj: { name: 'Current', path: '/Dc/0/Current', type: 'float' },
            condition2Operator: '<',
            condition2Threshold: 5.0,
            logicOperator: 'OR',
            outputTrue: 'At Least One True',
            outputFalse: 'Neither True',
            debounce: 0
        });

        // Simulate primary input
        subscribe.mock.calls[0][2]({ value: 12.8 }); // Condition 1 TRUE

        // Simulate secondary input
        subscribe.mock.calls[1][2]({ value: 6.0 }); // Condition 2 FALSE

        expect(node.send).toHaveBeenCalledTimes(2);
        expect(getMessageFromSendCall(node, 0, 0)).toEqual({ payload: 12.8, topic: 'Dual Conditional Node' });
        expect(getMessageFromSendCall(node, 1, 1).payload).toBe('At Least One True');
        expect(getLastStatusText(node)).toBe('12.8 | true');
    });

    it('should evaluate two conditions with OR logic (FALSE || FALSE)', () => {
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Dual Conditional Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.0,
            condition2Enabled: true,
            condition2Service: 'com.victronenergy.solarcharger',
            condition2Path: '/Dc/0/Current',
            condition2ServiceObj: { name: 'Solar Charger', service: 'com.victronenergy.solarcharger' },
            condition2PathObj: { name: 'Current', path: '/Dc/0/Current', type: 'float' },
            condition2Operator: '<',
            condition2Threshold: 5.0,
            logicOperator: 'OR',
            outputTrue: 'At Least One True',
            outputFalse: 'Neither True',
            debounce: 0
        });

        // Simulate primary input
        subscribe.mock.calls[0][2]({ value: 11.0 }); // Condition 1 FALSE

        // Simulate secondary input
        subscribe.mock.calls[1][2]({ value: 6.0 }); // Condition 2 FALSE

        expect(node.send).toHaveBeenCalledTimes(2);
        expect(getMessageFromSendCall(node, 0, 0)).toEqual({ payload: 11.0, topic: 'Dual Conditional Node' });
        expect(getMessageFromSendCall(node, 1, 1).payload).toBe('Neither True');
        expect(getLastStatusText(node)).toBe('11 | false');
    });

    // Test debounce
    it('should debounce conditional output', (done) => {
        jest.useFakeTimers(); // Enable fake timers
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Debounced Conditional Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.0,
            outputTrue: 'True Value',
            outputFalse: 'False Value',
            debounce: 100 // 100ms debounce
        });

        subscribe.mock.calls[0][2]({ value: 13.0 }); // TRUE
        expect(node.send).toHaveBeenCalledTimes(1); // One call to send primary output
        expect(getMessageFromSendCall(node, 0, 0)).toEqual({
            payload: 13.0,
            topic: 'Debounced Conditional Node'
        });
        expect(getMessageFromSendCall(node, 0, 1)).toBeNull(); // Conditional output should be debounced
        expect(getLastStatusText(node)).toBe('13 | pending'); // Status shows pending during debounce

        subscribe.mock.calls[0][2]({ value: 11.0 }); // FALSE (within debounce period)
        expect(node.send).toHaveBeenCalledTimes(2); // primary output for the second input
        expect(getMessageFromSendCall(node, 1, 0)).toEqual({
            payload: 11.0,
            topic: 'Debounced Conditional Node'
        });
        expect(getMessageFromSendCall(node, 1, 1)).toBeNull(); // Conditional output still debounced
        expect(getLastStatusText(node)).toBe('11 | pending'); // Status shows pending during debounce

        jest.advanceTimersByTime(50); // Advance halfway
        expect(node.send).toHaveBeenCalledTimes(2); // No new conditional output

        subscribe.mock.calls[0][2]({ value: 14.0 }); // TRUE (reset debounce)
        expect(node.send).toHaveBeenCalledTimes(3); // primary output for the third input
        expect(getMessageFromSendCall(node, 2, 0)).toEqual({
            payload: 14.0,
            topic: 'Debounced Conditional Node'
        });
        expect(getMessageFromSendCall(node, 2, 1)).toBeNull(); // Conditional output still debounced
        expect(getLastStatusText(node)).toBe('14 | pending'); // Status shows pending during debounce

        jest.advanceTimersByTime(100); // Advance past debounce period

        expect(node.send).toHaveBeenCalledTimes(4); // Now conditional output should be sent
        expect(getMessageFromSendCall(node, 3, 1).payload).toBe('True Value');
        expect(getLastStatusText(node)).toBe('14 | true'); // Status shows confirmed after debounce completes

        jest.useRealTimers(); // Disable fake timers
        done();
    });

    // Test outputTrue/outputFalse parsing
    it('should parse outputTrue/outputFalse as JSON objects if valid', () => {
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'JSON Output Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.0,
            outputTrue: '{"status":"ok", "value": true}',
            outputFalse: '{"status":"error", "value": false}',
            debounce: 0
        });

        // First input makes condition TRUE
        subscribe.mock.calls[0][2]({ value: 13.0 });
        expect(node.send).toHaveBeenCalledTimes(2); // Primary + Conditional
        expect(getMessageFromSendCall(node, 1, 1).payload).toEqual({ status: 'ok', value: true });

        // Second input makes condition FALSE
        subscribe.mock.calls[0][2]({ value: 11.0 });
        expect(node.send).toHaveBeenCalledTimes(4); // Another Primary + Conditional
        expect(getMessageFromSendCall(node, 3, 1).payload).toEqual({ status: 'error', value: false });
    });

    it('should use outputTrue/outputFalse as literal strings if not valid JSON', () => {
        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Literal Output Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.0,
            outputTrue: 'true_string',
            outputFalse: 'false_string',
            debounce: 0
        });

        // First input makes condition TRUE
        subscribe.mock.calls[0][2]({ value: 13.0 });
        expect(node.send).toHaveBeenCalledTimes(2); // Primary + Conditional
        expect(getMessageFromSendCall(node, 1, 1).payload).toBe('true_string');

        // Second input makes condition FALSE
        subscribe.mock.calls[0][2]({ value: 11.0 });
        expect(node.send).toHaveBeenCalledTimes(4); // Another Primary + Conditional
        expect(getMessageFromSendCall(node, 3, 1).payload).toBe('false_string');
    });

    it('should register two outputs and correct labels when conditional mode is enabled', () => {
        const registerTypeSpy = jest.spyOn(mockRED.nodes, 'registerType');
        victronNodesInitFunction(mockRED); // Re-initialize to capture registerType calls

        const inputNodeCalls = registerTypeSpy.mock.calls.filter(call => call[0].startsWith('victron-input'));

        // Find the registration for a generic input node (e.g., 'victron-input-battery')
        const batteryInputRegistration = inputNodeCalls.find(call => call[0] === 'victron-input-battery');
        expect(batteryInputRegistration).toBeDefined();

        // outputLabels is now in the third argument (options object) per Node-RED standard pattern
        const nodeOptions = batteryInputRegistration[2];
        expect(nodeOptions).toBeDefined();
        expect(nodeOptions.outputLabels).toBeDefined();

        // Simulate conditional mode enabled
        const conditionalNodeInstance = { conditionalMode: true };
        let outputLabels = nodeOptions.outputLabels.call(conditionalNodeInstance, 0);
        expect(outputLabels).toBe('value');
        outputLabels = nodeOptions.outputLabels.call(conditionalNodeInstance, 1);
        expect(outputLabels).toBe('conditional');

        // Simulate conditional mode disabled
        const regularNodeInstance = { conditionalMode: false };
        outputLabels = nodeOptions.outputLabels.call(regularNodeInstance, 0);
        expect(outputLabels).toBeUndefined();
    });

    it('should unsubscribe from primary and secondary subscriptions and clear debounce timer on close', (done) => {
        // Make subscribe return mock subscription IDs so the cleanup code is triggered
        subscribe.mockReturnValueOnce('subscription-1').mockReturnValueOnce('subscription-2');
        // Make addStatusListener return mock handler IDs so the cleanup code removes both listeners
        addStatusListener.mockReturnValueOnce('handler-1').mockReturnValueOnce('handler-2');

        const unsubscribeSpy = jest.spyOn(mockRED.nodes.getNode('victron-client-id').client, 'unsubscribe');
        const removeStatusListenerSpy = jest.spyOn(mockRED.nodes.getNode('victron-client-id'), 'removeStatusListener');

        const NodeDef = getBaseInputNodeDef();
        const node = new NodeDef({
            name: 'Cleanup Test Node',
            service: 'com.victronenergy.battery',
            path: '/Dc/0/Voltage',
            serviceObj: { name: 'Battery', service: 'com.victronenergy.battery' },
            pathObj: { name: 'Voltage', path: '/Dc/0/Voltage', type: 'float' },
            conditionalMode: true,
            condition1Operator: '>',
            condition1Threshold: 12.5,
            condition2Enabled: true, // Enable second condition to trigger its subscription
            condition2Service: 'com.victronenergy.solarcharger',
            condition2Path: '/Dc/0/Current',
            condition2ServiceObj: { name: 'Solar Charger', service: 'com.victronenergy.solarcharger' },
            condition2PathObj: { name: 'Current', path: '/Dc/0/Current', type: 'float' },
            condition2Operator: '<',
            condition2Threshold: 5.0,
            debounce: 100
        });

        // Trigger subscriptions and debounce timer setup
        subscribe.mock.calls[0][2]({ value: 13.0 }); // Primary
        subscribe.mock.calls[1][2]({ value: 3.0 }); // Secondary

        // Call the 'close' handler with proper 'this' context
        const closeHandler = node.on.mock.calls.find(call => call[0] === 'close')[1];
        closeHandler.call(node, done);

        // Expect both subscriptions to be unsubscribed
        expect(unsubscribeSpy).toHaveBeenCalledTimes(2);

        // Expect status listeners to be removed (primary + secondary)
        expect(removeStatusListenerSpy).toHaveBeenCalledTimes(2);

        // Ensure debounce timer is cleared
        expect(node.debounceTimer).toBeNull();
    });

});
