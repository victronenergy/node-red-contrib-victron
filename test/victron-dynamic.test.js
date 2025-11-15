const victronDynamicInitFunction = require('../src/nodes/victron-dynamic');

describe('victron-dynamic', () => {
  let mockRED;
  let handleStatus;
  let globalContext;
  let subscribeFn;
  let unsubscribeFn;
  let mockCache;

  beforeEach(() => {
    // We imitate the behaviour of node-red here
    handleStatus = jest.fn(function(_node, message, _reportingNode, _muteStatusEvent) {
      if (message.hasOwnProperty('text') && typeof message.text !== 'string') {
        message.text = message.text.toString();
      }
    });

    // Mock global context for storing values
    globalContext = {
      set: jest.fn(),
    };

    subscribeFn = jest.fn();
    unsubscribeFn = jest.fn();

    // Mock cache representing discovered dbus services
    mockCache = {
      'com.victronenergy.battery.ttyUSB0': {
        '/Soc': 75,
        '/CustomName': 'House Battery',
        '/DeviceInstance': 0
      },
      'com.victronenergy.battery.ttyUSB1': {
        '/Soc': 82,
        '/CustomName': 'Starter Battery',
        '/DeviceInstance': 1
      },
      'com.victronenergy.solarcharger.ttyUSB2': {
        '/Dc/0/Voltage': 14.2,
        '/Dc/0/Current': 5.5,
        '/CustomName': 'MPPT 100/30',
        '/DeviceInstance': 2
      }
    };

    const registerType = jest.fn();

    // Mock createNode function
    const createNode = function(self, config) {
      self.name = config.name;
      self.serviceType = config.serviceType;
      self.paths = config.paths;

      self.on = jest.fn();
      self.send = jest.fn();

      self.context = jest.fn().mockReturnValue({
        global: globalContext
      });

      self.status = jest.fn((message) => {
        handleStatus(self, message, self, false);
      });
    };

    const getNodeFn = function getNode(id) {
      if (id === "victron-client-id") {
        return {
          addStatusListener: jest.fn(),
          removeStatusListener: jest.fn(),
          addServiceDiscoveryCallback: jest.fn(() => 'callback-id'),
          removeServiceDiscoveryCallback: jest.fn(),
          client: {
            subscribe: subscribeFn,
            unsubscribe: unsubscribeFn,
            system: {
              cache: mockCache
            },
            client: {
              connected: true,
              getValue: jest.fn(),
              services: {}
            }
          },
          showValues: true
        };
      }
      throw new Error("[mock getNode] Node not found: " + id);
    };

    // Mock RED object
    mockRED = {
      nodes: {
        registerType: registerType,
        createNode: createNode,
        getNode: getNodeFn,
      }
    };

    // Initialize the node
    victronDynamicInitFunction(mockRED);
  });

  it('should register the victron-dynamic node type', () => {
    expect(mockRED.nodes.registerType).toHaveBeenCalledWith(
      'victron-dynamic',
      expect.any(Function)
    );
  });

  it('should discover and subscribe to all battery instances for single path', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc']
    });

    expect(node).toBeDefined();

    // Should subscribe to both battery instances
    expect(subscribeFn).toHaveBeenCalledTimes(2);

    // Check first battery subscription
    expect(subscribeFn).toHaveBeenCalledWith(
      'com.victronenergy.battery.ttyUSB0',
      '/Soc',
      expect.any(Function),
      expect.any(Object)
    );

    // Check second battery subscription
    expect(subscribeFn).toHaveBeenCalledWith(
      'com.victronenergy.battery.ttyUSB1',
      '/Soc',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('should subscribe to multiple paths on matching services', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Solar Monitor',
      serviceType: 'solarcharger',
      paths: ['/Dc/0/Voltage', '/Dc/0/Current']
    });

    expect(node).toBeDefined();

    // Should subscribe to 2 paths on 1 service = 2 subscriptions
    expect(subscribeFn).toHaveBeenCalledTimes(2);

    expect(subscribeFn).toHaveBeenCalledWith(
      'com.victronenergy.solarcharger.ttyUSB2',
      '/Dc/0/Voltage',
      expect.any(Function),
      expect.any(Object)
    );

    expect(subscribeFn).toHaveBeenCalledWith(
      'com.victronenergy.solarcharger.ttyUSB2',
      '/Dc/0/Current',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('should output messages with service, path, and payload', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc']
    });

    // Get the subscription callback for first battery
    const callback = subscribeFn.mock.calls[0][2];

    // Simulate a value update
    callback({
      value: 75,
      type: 'float'
    });

    // Should send a message
    expect(node.send).toHaveBeenCalledTimes(1);

    const sentMsg = node.send.mock.calls[0][0];
    expect(sentMsg.payload).toBe(75);
    expect(sentMsg.service).toBe('com.victronenergy.battery.ttyUSB0');
    expect(sentMsg.path).toBe('/Soc');
  });

  it('should handle multiple service instances outputting separately', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc']
    });

    // Simulate updates from both batteries
    const callback1 = subscribeFn.mock.calls[0][2]; // ttyUSB0
    const callback2 = subscribeFn.mock.calls[1][2]; // ttyUSB1

    callback1({ value: 75, type: 'float' });
    callback2({ value: 82, type: 'float' });

    // Should send two separate messages
    expect(node.send).toHaveBeenCalledTimes(2);

    const msg1 = node.send.mock.calls[0][0];
    expect(msg1.payload).toBe(75);
    expect(msg1.service).toBe('com.victronenergy.battery.ttyUSB0');

    const msg2 = node.send.mock.calls[1][0];
    expect(msg2.payload).toBe(82);
    expect(msg2.service).toBe('com.victronenergy.battery.ttyUSB1');
  });

  it('should handle no matching services gracefully', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Tank Monitor',
      serviceType: 'tank', // No tanks in mock cache
      paths: ['/Level']
    });

    expect(node).toBeDefined();

    // Should not subscribe to anything
    expect(subscribeFn).toHaveBeenCalledTimes(0);
  });

  it('should unsubscribe from all services on close', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc']
    });

    // Subscriptions should return subscription objects
    subscribeFn.mockReturnValue({ id: 'sub-1' });

    // Get the close handler
    const closeHandler = node.on.mock.calls.find(call => call[0] === 'close');
    expect(closeHandler).toBeDefined();

    // Call the close handler
    const doneFn = jest.fn();
    closeHandler[1](doneFn);

    // Should have called done
    expect(doneFn).toHaveBeenCalled();
  });

  it('should update status to show number of monitored services', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc']
    });

    // Should show status indicating how many services are being monitored
    expect(node.status).toHaveBeenCalled();
    const statusCall = node.status.mock.calls[0][0];
    expect(statusCall.text).toContain('2'); // 2 battery services
  });

  it('should handle enum types with textual values', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc']
    });

    const callback = subscribeFn.mock.calls[0][2];

    // Simulate an enum value update
    callback({
      value: 1,
      type: 'enum',
      textValue: 'Charging'
    });

    expect(node.send).toHaveBeenCalledTimes(1);

    const sentMsg = node.send.mock.calls[0][0];
    expect(sentMsg.payload).toBe(1);
    expect(sentMsg.textValue).toBe('Charging');
  });

  it('should filter duplicate values when onlyChanges is enabled', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc'],
      onlyChanges: true
    });

    const callback = subscribeFn.mock.calls[0][2];

    // Send same value twice
    callback({ value: 75, type: 'float' });
    callback({ value: 75, type: 'float' });

    // Should only send once
    expect(node.send).toHaveBeenCalledTimes(1);

    // Send different value
    callback({ value: 76, type: 'float' });

    // Should send again
    expect(node.send).toHaveBeenCalledTimes(2);
  });

  it('should round values when roundValues is configured', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc'],
      roundValues: 1 // Round to 1 decimal place
    });

    const callback = subscribeFn.mock.calls[0][2];

    callback({ value: 75.456, type: 'float' });

    expect(node.send).toHaveBeenCalledTimes(1);
    const sentMsg = node.send.mock.calls[0][0];
    expect(sentMsg.payload).toBe(75.5);
  });

  it('should not round non-numeric values', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/CustomName'],
      roundValues: 2
    });

    const callback = subscribeFn.mock.calls[0][2];

    callback({ value: 'My Battery', type: 'string' });

    expect(node.send).toHaveBeenCalledTimes(1);
    const sentMsg = node.send.mock.calls[0][0];
    expect(sentMsg.payload).toBe('My Battery');
  });

  it('should allow all messages when onlyChanges is disabled', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc'],
      onlyChanges: false
    });

    const callback = subscribeFn.mock.calls[0][2];

    // Send same value three times
    callback({ value: 75, type: 'float' });
    callback({ value: 75, type: 'float' });
    callback({ value: 75, type: 'float' });

    // Should send all three
    expect(node.send).toHaveBeenCalledTimes(3);
  });

  it('should track previous values per service+path combination', () => {
    const DynamicInputNode = mockRED.nodes.registerType.mock.calls[0][1];

    const node = new DynamicInputNode({
      name: 'Battery Monitor',
      serviceType: 'battery',
      paths: ['/Soc'],
      onlyChanges: true
    });

    // Two different batteries
    const callback1 = subscribeFn.mock.calls[0][2]; // ttyUSB0
    const callback2 = subscribeFn.mock.calls[1][2]; // ttyUSB1

    // Same value on both batteries
    callback1({ value: 75, type: 'float' });
    callback2({ value: 75, type: 'float' });

    // Both should send because they're different services
    expect(node.send).toHaveBeenCalledTimes(2);

    // Same value again on first battery
    callback1({ value: 75, type: 'float' });

    // Should not send (duplicate for this service)
    expect(node.send).toHaveBeenCalledTimes(2);
  });
});
