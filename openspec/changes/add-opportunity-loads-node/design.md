## Context

See `proposal.md` - Why. This section covers only the D-Bus/architecture facts needed to justify the approach below, all confirmed directly against the `venus-opportunity-loads` and `gui-v2` source (not from documentation, since none exists for this feature).

- In this project, a `services.json` device-type key can span **multiple D-Bus services** in one node: each top-level sub-key under a device type becomes its own `com.victronenergy.<sub-key>` lookup, all merged into the same node's service/path dropdown (`victron-system.js: getNodeServices`). This is not new - the existing `dess` device type already combines `settings` + `system` this way.
- `venus-opportunity-loads` publishes most of its user-relevant settings on **two** D-Bus surfaces: `com.victronenergy.opportunityloads` (state + settings mirror + `/AvailableServices`) and `com.victronenergy.platform` (`/Services/OpportunityLoads/Mode`, the enable/disable switch - confirmed in `gui-v2`'s `PageControllableLoads.qml`). `Mode` is not mirrored onto `opportunityloads` itself.
- Each `Configurable` in `venus-opportunity-loads` (`globals.py`) has both a `settings_path` (always on `com.victronenergy.settings`, under `/Settings/OpportunityLoads/*`) and an optional `service_path` (mirrored onto `com.victronenergy.opportunityloads`, live-read/writable without touching the settings service directly). Five Configurables have no `service_path` (`None`): `ControlLoopInterval`, `DisableEvcsQuirks`, `EnableDebugLogging`, `BatteryReservationEquation`, `PriorityMapping`.
- This project's existing wildcard expansion (`utils.expandWildcardPaths`) matches any non-slash path segment via regex (`[^/]+`), not just numeric ones - `/Consumers/{id}/*` would technically expand fine. The blocker is different: `opportunityloads.py`'s `publish()` helper (line ~1441) explicitly drops any write to a `/Consumers/` or `/Debug/` path unless the engine's own `EnableDebugLogging` setting is on - so these paths simply don't exist on D-Bus during normal operation.

## Goals / Non-Goals

**Goals:**
- Expose the stable, always-on parts of Opportunity Loads (operational state, battery reservation state, priority list, core settings, enable/disable) to Node-RED flows.
- Do it with no new node *behavior*, purely via a `services.json` addition plus the same one-line-per-device-type registration every other device type already requires, in four places: `RED.nodes.registerType(...)` in `victron-nodes.js` (server-side - required for Node-RED to accept the type at all), `registerInputNode`/`registerOutputNode` in `victron-nodes.html` (client-side palette/editor), `listAvailableServices()` entries in `victron-system.js`, and a label in `service-meta.json`. Reuses the existing generic input/output node and the `dess`-style multi-service pattern throughout.

**Non-Goals:**
- Per-load live allocation visibility (`/Consumers/<id>/*`) - excluded because it's a debug-only surface, not part of the feature's stable production behavior. Revisit only if `venus-opportunity-loads` promotes these to an always-on path.
- The five unmirrored/internal Configurables (`ControlLoopInterval`, `DisableEvcsQuirks`, `EnableDebugLogging`, `BatteryReservationEquation`, `PriorityMapping`) - three are internal tuning/debug knobs, and `PriorityMapping` duplicates what `/AvailableServices` already exposes more usefully.
- A bespoke drag/reorder widget for the priority list.
- Any node-count/consolidation redesign (tracked separately per `proposal.md`'s deferred-concern note).

## Decisions

1. **One device type, two D-Bus service sub-keys (`opportunityloads` + `platform`).** Mirrors the existing `dess` device type's `settings`+`system` pattern exactly, so no new mechanism is needed in `victron-system.js`/`utils.js`. Alternative considered: point only at `com.victronenergy.opportunityloads` and skip `Mode` - rejected because the enable/disable switch is the single most important control and genuinely lives elsewhere; skipping it would make the node far less useful for the sake of a slightly smaller `services.json` entry.

2. **`/AvailableServices` stays a plain `string` path, mode `both`.** No JSON parsing or shape validation is added - it's a pass-through like any other `string`-typed value in this project. The node's tooltip/help text documents the expected shape (`[{controllable, deviceInstance, label, serviceType, uniqueIdentifier}, ...]`, confirmed from `gui-v2`'s handling of the same field) so flow authors know what they're reading/writing. Alternative considered: a dedicated reorder UI (drag list, like `gui-v2`'s `ListDevicePriority`) - rejected for this change because it requires new dialog code (against the "zero new node code" goal) and because letting a flow compute the reordered array is arguably more useful for automation (e.g. a seasonal priority change) than a static one-time reorder in the editor.

3. **Exclude `/Consumers/<id>/*` entirely.** These paths only exist on D-Bus when the engine's own debug logging is enabled - building support for them (even reusing the existing generic wildcard matching, which would technically work) would silently do nothing for the overwhelming majority of installations. Documented as a known limitation rather than worked around.

4. **Exclude the five unmirrored Configurables.** None have a `service_path`, so exposing them would require adding a third sub-key (`settings`, i.e. `com.victronenergy.settings`) purely to reach a handful of low-value, internal, or duplicate settings. Not worth the extra surface area for v1.

## Risks / Trade-offs

- [Risk] `venus-opportunity-loads` is pre-1.0 and its own maintainers flag the priority-mapping/`AvailableServices` write path as needing a rewrite - paths or shapes could change without notice. -> Mitigation: node help text states this plainly (already noted in the proposal); nothing in this change depends on undocumented internal behavior beyond the paths listed here.
- [Risk] A flow writing a malformed JSON string to `/AvailableServices` could leave the priority list in a broken state. -> Mitigation: documentation only (tooltip + help text with the exact expected shape), matching how every other passthrough `string` field in this project already works - no new validation code is introduced.
- [Trade-off] No per-load live power/allocation visibility in v1 (see Non-Goals). Users get priority order and identity, not "how many watts is load X getting right now" - only observable today via enabling the engine's own debug logging outside of Node-RED.

## Migration Plan

Purely additive: a new `services.json` key, no changes to any existing entry, node type, or flow. Nothing to migrate for this change itself.

## Open Questions

None that would change the spec, the approach, or the task breakdown. The node-count/consolidation direction raised during exploration is deliberately out of scope here and tracked in `proposal.md`, not as an open question for this change.
