#!/bin/bash
# Admin tool for Captive Portal

case "$1" in
  status)
    echo "--- Services ---"
    for s in hostapd dnsmasq nginx nodogsplash captive-backend; do
      systemctl is-active --quiet $s && echo " [OK] $s" || echo " [FAIL] $s"
    done
    echo "--- Connections ---"
    if command -v iw &> /dev/null; then
        echo "Clients: $(iw dev wlan0 station dump 2>/dev/null | grep -c "Station")"
    fi
    ;;
  restart)
    echo "Restarting services..."
    systemctl restart hostapd dnsmasq nginx nodogsplash captive-backend
    echo "Done."
    ;;
  *)
    echo "Usage: $0 {status|restart}"
    ;;
esac
