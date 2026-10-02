## Purpose

Lets Node-RED flows monitor Victron's Opportunity Loads feature (the reactive surplus-solar-consumption engine) and adjust its core settings, using this project's existing generic input/output node pattern rather than any bespoke node.

## ADDED Requirements

### Requirement: Monitoring Opportunity Loads state
The system SHALL let a flow read the Opportunity Loads engine's operational state and battery reservation state via the generic input node.

#### Scenario: Reading the operational state
- **WHEN** a flow subscribes to the `/OperationalState` path on the Opportunity Loads device type
- **THEN** the input node outputs the current state with a human-readable label (one of Disabled, Active, SleepMode, OffGridPaused, IncompatibleSystem, AbnormalCondition)

#### Scenario: Reading the battery reservation state
- **WHEN** a flow subscribes to the `/BatteryReservationState` path
- **THEN** the input node outputs the current reservation hint with a human-readable label (one of Ok, BelowStartSoc, BMSLimited, DESSLimited, SolarKeepAlive, BatteryLifeSupportActive, ERROR)

### Requirement: Reading and reordering the controllable-load priority list
The system SHALL let a flow read the current priority-ordered list of controllable loads, and write back a reordered list, via the `/AvailableServices` path.

#### Scenario: Reading the current priority order
- **WHEN** a flow subscribes to the `/AvailableServices` path
- **THEN** the input node outputs the current value as a JSON-encoded string containing an array of controllable-load entries in priority order

#### Scenario: Writing a reordered priority list
- **WHEN** a flow sends a `msg.payload` containing a JSON-encoded array of controllable-load entries to the `/AvailableServices` path on the output node
- **THEN** the output node writes the value to Opportunity Loads, which re-applies allocation in the new order

### Requirement: Enabling and disabling Opportunity Loads
The system SHALL let a flow read and change whether Opportunity Loads is enabled, via the `Mode` path on the `com.victronenergy.platform` service.

#### Scenario: Reading the enabled state
- **WHEN** a flow subscribes to the `Mode` path
- **THEN** the input node outputs the current enabled state (Enabled or Disabled)

#### Scenario: Enabling Opportunity Loads from a flow
- **WHEN** a flow sends a `msg.payload` of `1` to the `Mode` path on the output node
- **THEN** the output node writes the value, enabling Opportunity Loads

### Requirement: Adjusting core Opportunity Loads settings
The system SHALL let a flow read and write the following Opportunity Loads settings, subject to the same type/range validation this project already applies to every other output node: `ReservationStartSoc`, `ReservationBasePower`, `ReservationEndPower`, `NominalInverterUtilizationLimit`, `BalancingThreshold`, `PauseWhenOffgrid`, `BatteryLifeSupport`, `DisableEvcsControl`.

#### Scenario: Writing a new reservation start SOC
- **WHEN** a flow sends a `msg.payload` of `90` to the `ReservationStartSoc` path on the output node
- **THEN** the output node writes the value, and Opportunity Loads starts reserving battery charge power below 90% SOC

#### Scenario: Rejecting an out-of-range value
- **WHEN** a flow sends a `msg.payload` outside a setting's valid type or range (for example a negative percentage) to any of these paths on the output node
- **THEN** the output node rejects the write using this project's existing generic input validation, and does not send it to D-Bus
