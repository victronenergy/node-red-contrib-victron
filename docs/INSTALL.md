# Installation Guide

## Option 1: Venus OS Large (Recommended)

The easiest way to use Victron Energy nodes is through Venus OS Large, where both Node-RED and these nodes come pre-installed.

1. Install Venus OS Large on your GX device
   - Download from [Victron Professional](https://professional.victronenergy.com/)
   - Follow the [installation instructions](https://www.victronenergy.com/live/venus-os:large)

2. Access Node-RED
   - Open your web browser
   - Navigate to `http://<venus-ip>:1881`
   - The Victron nodes will be available in the palette

## Option 2: Manual Installation

### Prerequisites
- Node-RED installed
- A Victron system with a GX device
- Network access to the GX device

### Warning
⚠️ Manual installation requires modifying D-Bus settings. Incorrect configuration can render your GX device unusable. Only proceed if you:
- Are comfortable with system configuration
- Have a backup plan
- Are on a trusted network
- Understand the security implications

### Installation Steps

1. **Install Node-RED** (if not already installed)
   ```bash
   npm install -g node-red
   ```

2. **Install Victron nodes**
   ```bash
   cd ~/.node-red
   npm install @victronenergy/node-red-contrib-victron
   ```

3. **Configure D-Bus Access**

   Option A: Direct Socket Connection (Recommended)
   - Uses system socket by default
   - No additional configuration needed
   - Socket path: `/var/run/dbus/system_bus_socket`

   Option B: TCP Connection
   ```bash
   # On the GX device
   dbus -y com.victronenergy.settings /Settings/Services/InsecureDbusOverTcp SetValue 1
   # Reboot required
   ```

4. **Set Environment Variables** (if needed)
   ```bash
   # For TCP connection
   export NODE_RED_DBUS_ADDRESS=venus.local:78

   # For debugging
   export DEBUG=node-red-contrib-victron*
   ```

5. **Start Node-RED**
   ```bash
   node-red
   ```

### Verification

1. Open Node-RED interface
   ```
   http://localhost:1880
   ```

2. Check for Victron nodes in the palette
   - Look for the Victron Energy section
   - Verify available nodes match your system

3. Test connection
   - Drop an input node onto the canvas
   - Configure device and measurement
   - Deploy and check for data

### Troubleshooting

1. **Connection Issues**
   - Verify GX device is accessible
   - Check D-Bus configuration
   - Review environment variables

2. **Missing Nodes**
   - Check npm installation
   - Verify Node-RED version compatibility
   - Review Node-RED logs

3. **Data Not Flowing**
   - Confirm device is available on D-Bus
   - Check node configuration
   - Enable debug messages

### Security Considerations

1. **Network Security**
   - Use on trusted networks only
   - Consider VPN for remote access
   - Monitor for unauthorized access

2. **Access Control**
   - Enable Node-RED authentication
   - Use strong passwords
   - Limit network exposure

3. **Updates**
   - Keep Node-RED updated
   - Monitor for security advisories
   - Update nodes regularly

### Additional Configuration

#### Custom Socket Path
```bash
export DBUS_SYSTEM_BUS_ADDRESS="unix:path=/custom/path/to/socket"
```

#### Session Bus
```bash
export DBUS_SESSION_BUS_ADDRESS="unix:path=/custom/path/to/session/socket"
```

#### Debug Options
```bash
# Full debug output
export DEBUG=node-red-contrib-victron*

# Specific component debugging
export DEBUG=node-red-contrib-victron:dbus
```

## Support

For installation help:
1. Check [Troubleshooting](#troubleshooting) section
2. Visit [Victron Community](https://community.victronenergy.com)
3. Review [GitHub Issues](https://github.com/victronenergy/node-red-contrib-victron/issues)
4. Contact your Victron dealer for Venus OS support
