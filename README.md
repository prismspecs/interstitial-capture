# Raspberry Pi Online Captive Portal (SXSW/Berlin Project)

An educational and artistic digital intervention that acts as an Online Pass-Through Gateway. This project configures a Raspberry Pi as a NAT router that intercepts all traffic using a whitelist firewall (NoDogSplash) and only grants internet access once the user interacts with a shared chat or drawing canvas on the captive portal.

---

## Hardware Parts List (SXSW Projection Cart)

To achieve the necessary range and support high client density, the following hardware is recommended for mobile deployment:

### The Core Network
1. Raspberry Pi 5 (8GB): Central processing unit for NAT, backend services, and firewall management.
2. MicroSD Card (32GB+): High-speed (Class 10 / A2) for the OS and logging.
3. Netgear Nighthawk M6 (or similar 5G Modem): Provides the WAN connection via Ethernet (eth0).

### Long-Range WiFi
4. Ubiquiti Rocket M2: High-power 2.4GHz outdoor radio. Connects to the Pi via an Ethernet-to-USB adapter.
5. 15dBi Omni-Directional Antenna: Mounted on a telescoping mast for wide-area broadcast.
6. PoE Injector: Power source for the Rocket M2.
7. USB-to-Ethernet Gigabit Adapter: Secondary ethernet port for the Rocket M2 connection.

### AV & Power
8. Portable Power Station: 1000Wh+ capacity (e.g., Jackery Explorer 1000) to sustain the network and projection equipment.
9. Laser Projector (4000+ Lumens): Connected via HDMI to project the real-time captive portal dashboard.

---

## Installation

The setup process is automated. The architecture (NAT, Hostapd, Nginx, Dnsmasq, NoDogSplash, and Node.js) is configured by the setup script.

1. Clone the repository:
   ```bash
   git clone <repository-url> pi-captive
   cd pi-captive
   ```

2. Execute the installer:
   ```bash
   sudo ./setup.sh
   ```

3. Reboot:
   ```bash
   sudo reboot
   ```

---

## Architecture Overview

```
User Device (wlan0) -> NAT Router (Pi Firewall) -> Internet (eth0)
```

1. Interception: User connects to the "SXSW Free Wifi" open network. Dnsmasq provides an IP and standard DNS (8.8.8.8).
2. Captive Portal: NoDogSplash intercepts initial HTTP requests and redirects the user to the local Node.js webapp (http://10.3.141.1).
3. Interaction: Internet access is restricted until the user sends a chat message or draws on the canvas.
4. Authorization: User interaction triggers the backend API, which executes: `sudo ndsctl auth [CLIENT_IP]`.
5. Access Granted: NoDogSplash updates the firewall for the client MAC/IP, enabling full internet pass-through.

---

## Administration

A unified administration tool is provided for service management.

Check status of all components and connected clients:
```bash
./admin.sh status
```

Restart the entire network stack:
```bash
sudo ./admin.sh restart
```

---

## Customization

- Network Name: Modify the SSID variable at the top of setup.sh before execution.
- Portal Design: Edit HTML/CSS in the webapp/ directory.
- Backend Logic: Update backend/server.js. Restart services via admin.sh after modification.

---

## Legal & Privacy Note
This project intercepts public network traffic for educational and artistic purposes. Using it to capture traffic on public networks carries legal and ethical responsibilities. Ensure explicit permission is obtained for the deployment location.

## License
MIT
