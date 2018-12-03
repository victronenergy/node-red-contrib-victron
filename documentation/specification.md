# Victron Energy Node Specification

The following listing will act as a specification for Victron Energy Node-RED nodes. The main purpose is to give the users a simple interface to create custom automations or 
'flows' with Victron Energy's peripherals - without any existing knowledge on the underlying MQTT interface.

An example use case is shown below. A custom flow triggers a heater relay on, when both the ambient temperature drops below -10 °C and battery's state of charge dips below 60 %.

![tank node editing dialog](images/example-use-case.png)

### Example on Node Definition

All the custom nodes will have an edit dialog showing available node-specific options for the user.  Here's an example of an edit dialog for a tank node. Relevant information will be only shown when necessary.

The editable options are defined in plain text ...


```
Tank                [ Select: 1 .. N available tanks ]
Measurement         [ Select:
                        - Capacity (m3)
                        - Remaining (m3)
                        - Level (%)
                        - Fluid Type        -> Show Enum infotext
                        - Status            -> Show Enum infotext
                    ]
(Enum infotext)
Label               [ Text ]
```

... which will be implemented as follows:

![tank node editing dialog](images/example-tank-edit.png)

All node options will be greyed out and a warning text shown if there are no relevant topics/services available.

All the nodes listed below will have a custom edit dialog as well as additional supporting logic, if required.

## Input Nodes

### Digital Input (input)
Lists all available digital inputs.

If configured as a pulse meter, show options for aggregate and count.
If a CustomName has been set for the input, it will be shown instead of number.


**Selectable options:**
```
Digital Input       [ Select: 1 .. N available inputs ]
Measurement         [ Select:
                        - Count
                        - State (on/off)
                        - Type                          -> Show Enum infotext
                    ]

(Enum infotext)

Label               [ Text ]
```


### Tank (input)
Lists all available tank level inputs.

**Selectable options:**
```
Tank                [ Select: 1 .. N available tanks ]
Measurement         [ Select:
                        - Capacity (m3)
                        - Remaining (m3)
                        - Level (%)
                        - Fluid Type                    -> Show Enum infotext
                        - Status                        -> Show Enum infotext
                    ]

(Enum infotext)

Label               [ Text ]
```


### Temperature (input)
External temperature input (e.g. Venus-GX temperature input).

**Selectable options:**
```
Measurement         [ Select:
                        - Scale
                        - Offset (°C/K)
                        - Temperature Type              -> Show Enum infotext
                        - Temperature (°C)
                        - Status                        -> Show Enum infotext
                    ]

(Enum infotext)

Label               [ Text ]
```


### Custom Topic (input)
(An advanced) user can write a custom MQTT topic to subscribe to.
The 'MQTT Topic' text input will give (an optional) autocomplete of
the portalID and device instance on input unless a wildcard is used.

**Selectable options:**
```
MQTT Topic      [ Text ]
                [ Button: verify ]

Label           [ Text ]
```


### Inverter (input)
```
Measurement         [ Select:
                        - Current Out (AC)
                        - Voltage Out (AC)
                        - Voltage In (DC)
                        - Mode                      -> Show Enum infotext
                        - State                     -> Show Enum infotext
                    ]

(Enum infotext)

Label           [ Text ]
```


### PV Inverter (input)
```
Measurement         [ Select:
                        - Voltage (AC)
                        - Current (AC)
                        - Power (AC)
                        - Energy (DC)
                        - Mode                      -> Show Enum infotext
                        - State                     -> Show Enum infotext
                    ]

(Enum infotext)

Label           [ Text ]
```


### Charger (input)
```
Device              [ Select:
                        - Battery 1                 -> submenu Measurement
                        - Battery 2                 -> submenu Measurement
                        - Battery 3                 -> submenu Measurement
                        - Current In (A, AC)
                        - Power In (W, DC)
                        - Input Current Limit
                        - Mode                      -> Show Enum infotext
                        - State                     -> Show Enum infotext
                        - Relay State (on/off)
                    ]

(Enum infotext)

(submenu only shown on selecting Battery N)
Measurement         [ Select:
                        - Voltage (V, DC)
                        - Current (A, DC)
                        - (Temperature) (°C)
                    ]

Label           [ Text ]
```


### Solar Charger (input)
```
Device              [ Select:
                        - Voltage In (V, DC)
                        - Current In (A, DC)
                        - Voltage Out (V, DC)
                        - Current Out (A, DC)
                        - Temperature (°C)
                        - Yield Power (W)
                        - User Yield (kWh)
                        - Relay State (on/off)
                        - Error Code                -> Show Enum infotext
                        - Mode                      -> Show Enum infotext
                        - State                     -> Show Enum infotext
                    ]

(Enum infotext)

Label           [ Text ]
```


### GPS (input)
```
Device              [ Select:
                        - Position (Decimal Degrees)
                        - Course (Degrees)
                        - Speed (m/s)
                        - Fix
                        - Number of Satellites
                    ]

Label           [ Text ]
```


### Battery (input)
```
Battery             ( ) Battery 1
                    ( ) Battery 2
                    ( ) Battery 3
                    ( ) Battery N ...

Measurement         [ Select:
                        - Voltage (V)
                        - Current (A)
                        - Temperature (°C)
                        - Consumed Charge (Ah)
                        - State of Charge (%)
                        - State of Health (%)
                        - Time to Go (s)
                        - Battery Low Threshold (V)
                        - Capacity (Ah)
                        - Relay State (on/off)
                        - External Relay State (on/off)
                    ]
                    
(Enum infotext)

Label               [ Text ]
```


### Grid (input)
```
Device              [ Select:
                        - Voltage (V)
                        - Current (A)
                        - Power (W)
                        - Energy (kWh)
                        - Forward Energy (kWh)
                        - Reverse Energy (kWh)
                    ]

Label               [ Text ]
```


### Generator (input)
```
Device              [ Select:
                        - Generator Status          -> Show Enum infotext
                        - Generator Error Status    -> Show Enum infotext
                        - Autostart Status          -> Show Enum infotext
                        - Engine Load (%)
                        - Engine Speed (RPM)
                        - Engine Operating Hours (h)
                        - Engine Coolant Temperature (°C)
                        - Engine Winding Temperature (°C)
                        - Engine Exhaust Temperature (°C)
                        - Starter Voltage (V, DC)
                        - Voltage (V, AC)
                        - Current (A, AC)
                        - Power (W, AC)
                        - Frequency (Hz, AC)
                    ]

(Enum infotext)

Label               [ Text ]
```


### Motordrive (input)
```

Engine Measurements  [ Select:
                        - Speed (RPM)
                        - Temperature (°C)
                        - Voltage (V, DC)
                        - Current (V, DC)
                        - Power (W, DC)
                        - Controller Temperature (°C)
                    ]

Label               [ Text ]
```

### Relay (output)
Lists all available relays.

**Selectable options:**
```
Relay Number        ( ) Relay 1
                    ( ) Relay 2
                    ( ) (Relay N ...)

State               (*) on
                    ( ) off
                    ( ) toggle

Label               [ Text ]
```


### MQTT Status Node (output)

Shows the MQTT broker connection status below the custom node.
The node sends a message to the output when the connection status changes.


## Output Nodes


### Inverter (output)
```
Mode                (*) on
                    ( ) economy
                    ( ) off

Label               [ Text ]
```


### PV Inverter (output)
```
Mode                (*) on
                    ( ) economy
                    ( ) off

Label               [ Text ]
```


### Charger (output)
```
Mode                (*) on
                    ( ) economy
                    ( ) off

Label               [ Text ]
```


### Generator (output)
```
Mod                 (*) stopped
                    ( ) started

Label               [ Text ]
```


## Configuration Nodes


### Global Configuration Node (config)
The global configuration node will handle all the common tasks:

* Establish the MQTT connection (to localhost)
* Fetch and save the portalID and available MQTT services
* Make the services and portalID available for other nodes

It is never visible to the user.
