const victronNodesInitFunction = require('../src/nodes/victron-nodes');

describe('victron-nodes', () => {
  it('allows me to instantiate a node and set values', () => {

    // We imitate the behaviour of node-red here, as we cannot access the method
    // handleStatus from node-red's Flow.js here.
    const handleStatus = jest.fn(function(_node, message, _reportingNode, _muteStatusEvent) {
      if (message.hasOwnProperty('text') && typeof message.text !== 'string') {
        message.text = message.text.toString();
      }
    });

    // the subscribe handler of our BasicInputNode writes to the global context,
    // so we need to mock that.
    const globalContext = {
      set: jest.fn(),
    }

    const registerType = jest.fn();

    // we mock the createNode function of the RED object
    const createNode = function(self, config) {
      self.name = config.name;
      self.serviceObj = config.serviceObj;
      self.pathObj = config.pathObj;

      self.on = jest.fn();
      self.send = jest.fn();

      self.context = jest.fn().mockReturnValue({
        global: globalContext
      });

      self.status = jest.fn((message) => {
        handleStatus(self, message, self, false);
      });
    }

    subscribe = jest.fn(),

      getNodeFn = function getNode(id) {
        if (id === "victron-client-id") {
          return {
            addStatusListener: jest.fn(),
            client: {
              subscribe,
              client: {
                // see how we call migrateSubscriptions in victron-nodes.js to understand why we do this:
                // If we don't, the unit test will hang.
                connected: true,
                getValue: jest.fn(),
                services: {}
              }
            },
            showValues: true
          }
        }
        throw new Error("[mock getNode] Node not found: " + id);
      }

    // we mock the RED object that is passed to the init function
    const mockRED = {
      nodes: {
        registerType: registerType,
        createNode: createNode,
        getNode: getNodeFn,
      }
    };

    // now we can call the init function of the victron-nodes, our function under test
    victronNodesInitFunction(mockRED);

    expect(registerType.mock.calls.length).toBeGreaterThan(0)
    expect(registerType.mock.calls[0][0]).toEqual('victron-input-accharger')

    expect(registerType.mock.calls[0][1]).toBeInstanceOf(Function);

    // we can now instantiate a BaseInputNode
    const BaseInputNode = registerType.mock.calls[0][1];

    const node = new BaseInputNode({
      name: 'Test Node',
      service: 'my-service',
      path: 'my-path',
      serviceObj: {
        name: "Test Service",
      },
      pathObj: {
        name: "Test Path",
      },
      on: 42
    });

    expect(subscribe.mock.calls.length).toBe(1);
    expect(subscribe.mock.calls[0][0]).toEqual('my-service');
    expect(node).toBeDefined();

    // now we can send a message to the node
    subscribe.mock.calls[0][2]({
      value: 42
    });

    // we expect the node to send a message
    expect(node.send.mock.calls.length).toBe(1);
    expect(node.send.mock.calls[0][0].payload).toEqual(42);
    expect(node.send.mock.calls[0][0].topic).toEqual('Test Node');

    // ... and we expect the status to be set
    expect(handleStatus.mock.calls.length).toBe(1);
    expect(handleStatus.mock.calls[0][1].text).toEqual('42');

    // now we set a null value
    subscribe.mock.calls[0][2]({
      value: null
    });

    // we expect the node to send a message with null payload
    expect(node.send.mock.calls.length).toBe(2);
    expect(node.send.mock.calls[1][0].payload).toEqual(null);
    expect(node.send.mock.calls[1][0].topic).toEqual('Test Node');

    // ... and we expect the status to be set to 'null'
    expect(handleStatus.mock.calls.length).toBe(2);
    expect(handleStatus.mock.calls[1][1].text).toEqual('null');

  });

  it('allows output nodes to use msg.path to override configured path', () => {
    const handleStatus = jest.fn(function(_node, message, _reportingNode, _muteStatusEvent) {
      if (message.hasOwnProperty('text') && typeof message.text !== 'string') {
        message.text = message.text.toString();
      }
    });

    const registerType = jest.fn();
    const publish = jest.fn((service, path, value, callback) => {
      callback(null);
    });

    const createNode = function(self, config) {
      self.name = config.name;
      self.serviceObj = config.serviceObj;
      self.pathObj = config.pathObj;
      self.id = 'test-node-id';

      self.on = jest.fn((event, handler) => {
        if (event === 'input') {
          self._inputHandler = handler;
        }
      });

      self.status = jest.fn((message) => {
        handleStatus(self, message, self, false);
      });
    }

    const getNodeFn = function getNode(id) {
      if (id === "victron-client-id") {
        return {
          addStatusListener: jest.fn(),
          removeStatusListener: jest.fn(),
          client: {
            publish,
          },
          showValues: true
        }
      }
      throw new Error("[mock getNode] Node not found: " + id);
    }

    const mockRED = {
      nodes: {
        registerType: registerType,
        createNode: createNode,
        getNode: getNodeFn,
      }
    };

    victronNodesInitFunction(mockRED);

    const outputRegistrations = registerType.mock.calls.filter(call => call[0].startsWith('victron-output-'));
    const batteryOutputRegistration = outputRegistrations.find(call => call[0] === 'victron-output-battery');

    expect(batteryOutputRegistration).toBeDefined();
    const BaseOutputNode = batteryOutputRegistration[1];

    const node = new BaseOutputNode({
      name: 'Test Battery Output',
      service: 'com.victronenergy.battery/0',
      path: '/Dc/0/Voltage',
      pathObj: {
        name: "Voltage",
        type: "float",
        disabled: false
      },
      serviceObj: {
        name: "Battery"
      }
    });

    expect(node._inputHandler).toBeDefined();

    node._inputHandler.call(node, {
      payload: 12.5,
      path: '/Dc/0/Current'
    });

    expect(publish).toHaveBeenCalledWith(
      'com.victronenergy.battery/0',
      '/Dc/0/Current',
      12.5,
      expect.any(Function)
    );
  });

  it('relay output node ignores msg.path and uses configured path', () => {
    const handleStatus = jest.fn(function(_node, message, _reportingNode, _muteStatusEvent) {
      if (message.hasOwnProperty('text') && typeof message.text !== 'string') {
        message.text = message.text.toString();
      }
    });

    const registerType = jest.fn();
    const publish = jest.fn((service, path, value, callback) => {
      callback(null);
    });

    const createNode = function(self, config) {
      self.name = config.name;
      self.serviceObj = config.serviceObj;
      self.pathObj = config.pathObj;
      self.id = 'test-relay-node-id';

      self.on = jest.fn((event, handler) => {
        if (event === 'input') {
          self._inputHandler = handler;
        }
      });

      self.removeAllListeners = jest.fn(() => {
        self._inputHandler = null;
      });

      self.status = jest.fn((message) => {
        handleStatus(self, message, self, false);
      });
    }

    const getNodeFn = function getNode(id) {
      if (id === "victron-client-id") {
        return {
          addStatusListener: jest.fn(),
          removeStatusListener: jest.fn(),
          client: {
            publish,
          },
          showValues: true
        }
      }
      throw new Error("[mock getNode] Node not found: " + id);
    }

    const mockRED = {
      nodes: {
        registerType: registerType,
        createNode: createNode,
        getNode: getNodeFn,
      }
    };

    victronNodesInitFunction(mockRED);

    const relayOutputRegistration = registerType.mock.calls.find(call => call[0] === 'victron-output-relay');

    expect(relayOutputRegistration).toBeDefined();
    const RelayOutputNode = relayOutputRegistration[1];

    const node = new RelayOutputNode({
      name: 'Test Relay Output',
      service: 'com.victronenergy.system',
      path: '/Relay/0/State',
      pathObj: {
        name: "Relay State",
        type: "enum",
        disabled: false,
        enum: {
          0: "Open",
          1: "Closed"
        }
      },
      serviceObj: {
        name: "Relay"
      }
    });

    expect(node._inputHandler).toBeDefined();

    node._inputHandler.call(node, {
      payload: 1,
      path: '/Relay/1/State'
    });

    expect(publish).toHaveBeenCalledWith(
      'com.victronenergy.system',
      '/Relay/0/State',
      1,
      expect.any(Function)
    );
  });

});
