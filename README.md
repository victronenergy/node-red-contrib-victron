# Custom Victron Energy nodes for Node-RED

This library provides custom Node-RED nodes for some of the most commonly used Victron Energy products. The aim is to make it easier and faster for users to create automations without actually having to touch any of the devices' internals.

A Venus device is needed for this library to work. The library connects to a system dbus instance in a VenusOS device -- this can be done either remotely (TCP) or directly. See instructions [here](#Installation-and-Usage).

This library is not officially supported by Victron Energy. For any questions or help, please turn to [community.victronenergy.com](https://community.victronenergy.com). Pull-requests are willingly encouraged!


## Usage and Examples

When the Node-RED is started, a Victron Energy configuration node is automatically created, connecting to the dbus in the Venus device. All the node services and measurements can be found on [services.json](/src/services/services.json) -- however only those services and measurements that are available in the system are shown in the node edit panel.

![Architecture](documentation/images/node-palette.png)

*Node-palette - Input nodes on the left, output nodes on the right*

Here's an example on a functional flow with the Victron Nodes. More in-depth examples and use cases can be found in [wiki/Example-Flows](https://github.com/victronenergy/node-red-contrib-victron/wiki/Example-Flows).

![Architecture](documentation/images/example-nighttime-rates.png)

### Input Nodes

The input nodes have two selectable inputs: the devices select and measurement select. The available options are dynamically updated based on what sort data is actually available on the Venus device dbus.

```
Device Select       - lists all available devices
Measurement Select  - lists all available device-specific measurements
Node label Input    - sets a custom label for the node
```

The measurement unit type is shown in the measurement label in brackets, e.g. Battery voltage (V).
In case the data type is enumerated, an approppriate enum legend is shown below the selected option.

![Architecture](documentation/images/edit-vebus-input.png)

### Output Nodes

Input Nodes have the same options available, but the selectable 'measurement' only lists writable services. Additionally, the user can set an initial value to the service, which is sent whenever the flow is deployed.


All output nodes should have the control value set in its incoming message's `msg.payload` property.

```
Device Select       - lists all available devices
Measurement Select  - lists all available device-specific measurements
Initial value Input - initializes the device when the flow is deployed
Node label Input    - sets a custom label for the node
```

![Architecture](documentation/images/edit-relay-output.png)

### Example Flows

Please head to [wiki/Example-Flows](https://github.com/victronenergy/node-red-contrib-victron/wiki/Example-Flows) for example flows implemented with the Victron Energy nodes.

## Architecture

### Plugin Behavior

All the individual nodes (inputs / outputs) will use a singleton instance of a Victron Config Node to access the system dbus in a Venus device. The nodes will provide a easy-to-use interface for accessing various measurements and writing data to the system.

The following graph demonstrates the architecture of this plugin.

1. Upon initialization, the Victron Config Node initializes a VictronClient and SystemConfiguration instances. VictronClient connects to the Venus D-Bus and starts maintaining a cache of available services.

2. When a user modifies a node (e.g. battery node), the node fetches the available dbus services from the local SystemConfiguration cache and renders relevant inputs to the edit view.

3. When a node is deployed, they either subscribe a message handler to the VictronClient or start publishing data to a desired D-Bus path.


![Architecture](documentation/images/architecture.png)

### Directory Structure
```
.
├── documentation
├── scripts
│   ├── csv                         | input CSV files for the parser script
│   ├── parse-services.js           | parses the services.json used by nodes
│   └── service-whitelist.js        | dbus service/path whitelist for the parser
└── src
    ├── nodes
    │   ├── icons
    │   │   └── victronenergy.svg
    │   ├── config-client.html
    │   ├── config-client.js
    │   ├── victron-nodes.html
    │   └── victron-nodes.js
    └── services
        ├── services.json           | used for node config generation
        ├── utils.js
        ├── dbus-listener.js
        ├── victron-client.js       | Victron Energy dbus-client
        └── victron-system.js       | DBus service cache
```

## Generating the node specification file

All the node configurations (dbus service-path mappings and lables) are generated from a [services.json](/src/services/services.json) file. Please note, that this file is not a full representation of the available dbus paths.

This `services.json` file is generated using the `parse-services.js` script in `./scripts` directory. The script uses two CSV files, `dataAttributes.csv` and `dataAttributeEnums.csv`, as its primary source to generate an up-to-date listing of available dbus services and dbus paths for Victron Energy's devices. The parsed services and paths are filtered against a whitelist (`service-whitelist.js`) before saving the file in order to get rid of undesired or deprecated dbus paths.

![Parser Script Architecture](documentation/images/parser-script-architecture.png)

1. Before running the script, please ensure that you have valid data csv's (`dataAttributes.csv`, `dataAttributeEnums.csv`) in the `./scrip/csv` directory. Edit the `service-whitelist.js` to control all the available fields to the nodes.
2. Run the script `node run parse-services.js`
3. If some of the whitelisted services or paths are not found on the CSV files, the script will print out all the missing dbus paths. The script will also generate a `missingpaths.template.json` file, which can be manually populated and added as an extra input to the script.
4. Copy, rename and populate the `missingpaths.template.json` and run the script again, this time with an extra argument: `node parse-services.js ./missingpaths.json`. This extra input file can also be used to overwrite parsed CSV rows, for example.
5. You are done! The new fields in services.json can be verified using a your favorite diff tool (`git diff`, for example).

## Adding new nodes

A few modifications to the code are needed in order to add new nodes. Here's an example on how to add a new input node `victron-test`. It uses the dbus service `com.victronenergy.settings` and has one option for a path `/Settings/TestDbusPath`.

1. Add the nodetype to scripts/service-whitelist.js
```
    "input-test": {
        "settings": [
            "/Settings/TestDbusPath",
        ]
    }
```

2. Run `node parse-services.js ./missingpaths.json` to generate a new `services.json`, which is used to render the node options. If the dbus paths are missing from the given input CSV's, a missingpaths.template.json is generated with pre-filled templates for dbus path definitions. You should fill in the missing data, and copy-paste the new json objects to missingpaths.json file. Run the script again until no more missing paths are printed to the console.

You can use the `--append` switch to completely bypass the whitelist, missingpaths.json and csv parsing. This is useful if you don't have access to the dataAttribute and dataAttributeEnum CSV files. This will simply merge the given input json file with the services.json: `node parse-services.json ./additionalPaths.json`.

3. Add the following rows to given files:
```
// The following function defines what services are showin in
// /victron/services/ API endpoint.
// src/services/victron-system.js - listAvailableServices()
"input-test": this.getNodeServices("input-test"),

// Creates a new node-definition for node-red backend API
// src/nodes/victron-nodes.js
RED.nodes.registerType('victron-input-test', BaseInputNode);

// Creates a new node-definition for node-red frontend API
// src/nodes/victron-nodes.html
registerInputNode('victron-input-test', 'Test', 'input-test');
```

4. Restart Node-RED and test the new node. It should be visible under Victron Energy nodes. If the path `/Settings/TestDbusPath` is present in dbus under `com.victronenergy.settings`, the node will show the path as an option in its edit panel settings.

## Installation and Usage

The end goal is to have Node-RED running on a Venus device itself (this library included), but it is also possible to connect to the Venus device via TCP from an external Node-RED instance. If you would already like to test it out now, please dive into the instructions below to see how it can be done.

In order to use the plugin remotely, Node-RED and the plugin needs to be locally installed:

1. install node-red on your system
2. cd to the node-red user directory, typically `~/.node-red`
3. install node-red-contrib-victron locally, `npm install /path/to/this/repository`
4. enable d-bus over tcp in your Venus device **if you want to use dbus over TCP**, otherwise skip this step. Edit `/etc/dbus-1/system.conf` and add the following directly above `<policy context="default">`:

```
  <listen>tcp:host=0.0.0.0,port=78</listen>
  <auth>ANONYMOUS</auth>
  <allow_anonymous/>
```

5. the client can connect to dbus either using tcp or directly via system socket.
  - the client defaults to a socket connection systembus, with a socket 'unix:path=/var/run/dbus/system_bus_socket'. This should directly work with a Venus device.
  - (You can  `DBUS_SYSTEM_BUS_ADDRESS` to change the systembus socket path or alternatively set `DBUS_SESSION_BUS_ADDRESS` to use sessionbus via socket)
  - set the environment variable `NODE_RED_DBUS_ADDRESS` to connect via TCP. The variable should be a string with an ip and port separated by a colon, e.g. `export NODE_RED_DBUS_ADDRESS=192.168.1.1:78`

6. you can optionally run the plugin with a DEBUG=* environment variable set, to see additional debug information printed on the shell. E.g. `export DEBUG=node-red-contrib-victron*`

Further information on [nodered.org](https://nodered.org/docs/creating-nodes/first-node) and [github](https://github.com/sbender9/signalk-venus-plugin#plugin-installation--configuration).


## Releasing a new version (Dev)

For a new (internal) release, the following steps are adviced;

1. Bump up the package version in package.json
2. Add the version commit to git `git add package.json && git commit -m 'Version 1.x.x'`
3. Add a new version tag for a release in this format: `git tag 1.x.x`.
4. push changes, including the newly created tag `git push --tags`.
5. go to [Releases](https://github.com/victronenergy/node-red-contrib-victron/releases) Page and Draft a new release.

This package is not publicly available in the npm repository.

## Miscellaneous

The original issue tracking the progress can be found on [Venus repository](https://github.com/victronenergy/venus/issues/378).
