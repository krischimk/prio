#!/usr/bin/env bash
#
# Emulator-Steuerung für die Hands-On-Prüfung.
#
# Warum: Der Emulator läuft auf demselben Rechner wie dieses Projekt. Eine neue
# Version lässt sich damit prüfen, ohne sie auf dem eigenen Telefon zu
# installieren – installieren, öffnen, bedienen, fertig.
#
# Aufruf über die npm-Skripte:
#   npm run android:emu          Emulator mit Fenster starten
#   npm run android:emu:install  Debug-APK gegen den Mock bauen, installieren, öffnen
#   npm run android:emu:echt     Dasselbe gegen das echte Supabase-Projekt
#   npm run android:emu:shot     Screenshot ablegen
#   npm run android:emu:eval     Ausdruck im laufenden WebView auswerten
#   npm run android:emu:stop     Emulator und Mock beenden
#
# Zwei Ziele, ein Standard:
#
#   --mock (Standard)  Der lokale Mock aus tests/mock-supabase. Kein Konto,
#                      keine Daten im echten Projekt, jederzeit wiederholbar.
#                      Beantwortet die Frage „läuft die App, geht die
#                      Oberfläche?".
#   --echt             Das echte Projekt aus der privaten .env. Braucht die
#                      Anmeldung und legt echte Daten an. Nötig für die
#                      Fragen, die der Mock nicht beantworten kann: echte
#                      Anmeldung, echte Zugriffsregeln, Benachrichtigungen.
#
# Welches Ziel gerade läuft, zeigt die App selbst an (Kopfzeile bzw. Menü).
#
# Das eigentliche Bedienen und Beurteilen passiert im Fenster – das Skript
# übernimmt nur Start, Installation und Aufräumen.

set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_HOME
export ANDROID_SDK_ROOT="$ANDROID_HOME"
PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

# Signatur: Ohne Schlüssel bleibt der Debug-Build debug-signiert, und ein
# Wechsel zwischen Debug und Release verlangt eine Neuinstallation – die
# Anmeldung im Emulator ginge dabei verloren.
if [ -f "$HOME/.prio-android/emulator.env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.prio-android/emulator.env"
fi

AVD_NAME="${AVD_NAME:-prio-test}"
APP_ID="de.krischi.prio"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK_DEBUG="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

# Der Mock für den Standardweg. Port und Adresse sind dieselben wie im
# E2E-Lauf (tests/mock-supabase/server.mjs bindet an 127.0.0.1).
MOCK_PORT="${MOCK_SUPABASE_PORT:-54321}"
MOCK_PIDFILE="/tmp/prio-mock.pid"
MOCK_LOG="/tmp/prio-mock.log"
MOCK_KEY="e2e-publishable-key"

info() { printf '\033[36m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*" >&2; }

require() {
  command -v "$1" >/dev/null 2>&1 || {
    warn "Nicht gefunden: $1. Ist das Android SDK unter $ANDROID_HOME installiert?"
    exit 1
  }
}

device_online() {
  adb devices 2>/dev/null | grep -q "emulator-.*device$"
}

wait_for_boot() {
  info "Warte auf den Bootvorgang …"
  adb wait-for-device
  for _ in $(seq 1 60); do
    [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && return 0
    sleep 5
  done
  warn "Der Emulator ist nicht rechtzeitig hochgefahren."
  return 1
}

# Der Emulator kann auf einen temporären Datenträger eingestellt sein. Dann
# sind App, Anmeldung und Testdaten nach jedem Beenden weg – das ist bei einer
# AVD-Vorlage mit `firstboot`-Schnappschuss die Voreinstellung.
sorge_fuer_dauerhaften_speicher() {
  local avd_dir="$HOME/.android/avd/$AVD_NAME.avd"
  local config="$avd_dir/config.ini"
  [ -f "$config" ] || return 0
  grep -qE "^disk\.dataPartition\.path *= *<temp>" "$config" || return 0

  local ziel="$avd_dir/userdata-qemu.img"
  warn "Der Emulator war auf einen temporären Datenträger eingestellt."
  warn "Anmeldung und Daten wären bei jedem Beenden verloren gegangen."
  sed -i "s|^disk\.dataPartition\.path *=.*|disk.dataPartition.path = $ziel|" "$config"
  info "Datenträger jetzt dauerhaft: $ziel"
}

start() {
  require emulator
  sorge_fuer_dauerhaften_speicher
  if device_online; then
    info "Emulator läuft bereits."
    return 0
  fi
  # Auf einem Rechner ohne Anzeige (Server, SSH ohne X) lässt sich kein Fenster
  # öffnen; Qt bricht dann mit „no Qt platform plugin could be initialized“ ab.
  # Dort läuft der Emulator ohne Fenster – `adb` und Screenshots funktionieren
  # weiterhin, nur das Zusehen entfällt.
  local fenster=()
  if [ -n "${DISPLAY:-}" ]; then
    info "Starte $AVD_NAME mit Fenster …"
  else
    info "Keine Anzeige gefunden – starte $AVD_NAME ohne Fenster."
    fenster=(-no-window)
  fi
  # `-no-snapshot` verhindert, dass ein alter Zustand aufgewärmt wird.
  nohup emulator -avd "$AVD_NAME" -no-audio -no-boot-anim -no-snapshot "${fenster[@]}" \
    >/tmp/prio-emulator.log 2>&1 &
  wait_for_boot
  info "Emulator bereit."
}

mock_antwortet() {
  curl -fsS "http://127.0.0.1:$MOCK_PORT/__test__/health" >/dev/null 2>&1
}

starte_mock() {
  if mock_antwortet; then
    info "Mock läuft bereits auf Port $MOCK_PORT."
    return 0
  fi
  info "Starte den Mock auf Port $MOCK_PORT …"
  nohup node "$PROJECT_DIR/tests/mock-supabase/server.mjs" "$MOCK_PORT" \
    >"$MOCK_LOG" 2>&1 &
  echo $! >"$MOCK_PIDFILE"
  for _ in $(seq 1 20); do
    mock_antwortet && return 0
    sleep 0.5
  done
  warn "Der Mock antwortet nicht. Protokoll: $MOCK_LOG"
  return 1
}

stoppe_mock() {
  [ -f "$MOCK_PIDFILE" ] || return 0
  local pid
  pid="$(cat "$MOCK_PIDFILE")"
  if kill "$pid" 2>/dev/null; then
    info "Mock beendet (PID $pid)."
  fi
  rm -f "$MOCK_PIDFILE"
}

install_app() {
  local ziel="${1:---mock}"
  require adb
  device_online || start

  case "$ziel" in
    --mock)
      starte_mock || exit 1
      # Die App im Emulator spricht mit 127.0.0.1 – ohne diese Weiterleitung
      # landet sie im Emulator selbst und nicht beim Mock auf diesem Rechner.
      adb reverse "tcp:$MOCK_PORT" "tcp:$MOCK_PORT" >/dev/null
      info "Baue das Web-Bundle und die Debug-APK gegen den Mock (Port $MOCK_PORT) …"
      (
        cd "$PROJECT_DIR"
        VITE_SUPABASE_URL="http://127.0.0.1:$MOCK_PORT" \
          VITE_SUPABASE_PUBLISHABLE_KEY="$MOCK_KEY" \
          npm run android:apk >/dev/null
      )
      info "Ziel: Mock. Die App zeigt es in der Kopfzeile (breit) bzw. im Menü."
      warn "Lokale Daten aus einem früheren Lauf bleiben in der App. Für einen"
      warn "sauberen Lauf: adb shell pm clear $APP_ID   (löscht auch die Anmeldung)"
      ;;
    --echt)
      info "Baue das Web-Bundle und die Debug-APK gegen das echte Projekt (aus .env) …"
      (cd "$PROJECT_DIR" && npm run android:apk >/dev/null)
      warn "Ziel: echtes Supabase-Projekt. Was du hier anlegst, liegt dort wirklich."
      ;;
    *)
      warn "Unbekanntes Ziel: $ziel (erlaubt: --mock, --echt)"
      exit 1
      ;;
  esac

  # Debug- und Release-APK sind verschieden signiert – ein Wechsel scheitert
  # sonst mit INSTALL_FAILED_UPDATE_INCOMPATIBLE.
  adb install -r "$APK_DEBUG" >/dev/null 2>&1 || {
    warn "Die installierte Fassung hat eine andere Signatur und muss ersetzt werden."
    warn "ACHTUNG: Dabei gehen die lokalen Daten verloren – die Anmeldung muss neu erfolgen."
    warn "Vermeidbar, wenn ~/.prio-android/emulator.env mit dem Release-Schlüssel vorliegt."
    adb uninstall "$APP_ID" >/dev/null 2>&1 || true
    adb install "$APK_DEBUG" >/dev/null
  }
  adb shell am start -n "$APP_ID/.MainActivity" >/dev/null
  info "Installiert und geöffnet."
}

screenshot() {
  require adb
  device_online || { warn "Kein Emulator läuft."; exit 1; }
  # Ablageort: erst PRIO_SHOT_DIR, dann ~/Desktop, sonst der Projektordner
  # test-results. Auf einem Server ohne Desktopumgebung gibt es ~/Desktop nicht
  # – dort landete der Screenshot sonst in einem Ordner, den es nicht gibt.
  # `test-results` ist bereits über .gitignore ausgeschlossen.
  local dir="${PRIO_SHOT_DIR:-}"
  if [ -z "$dir" ]; then
    if [ -d "$HOME/Desktop" ]; then
      dir="$HOME/Desktop"
    else
      dir="$PROJECT_DIR/test-results"
    fi
  fi
  local target="${1:-prio-emulator.png}"
  if [[ "$target" != */* ]]; then
    target="$dir/$target"
  fi
  mkdir -p "$(dirname "$target")"
  adb exec-out screencap -p >"$target"
  info "Screenshot: $target"
}

stop() {
  require adb
  device_online || { info "Es läuft kein Emulator."; return 0; }
  adb emu kill >/dev/null 2>&1 || true
  info "Emulator beendet."
}

# Führt im laufenden WebView einen Ausdruck aus. Zwei Dinge werden dabei leicht
# übersehen: Der Devtools-Anschluss liegt im Emulator, nicht auf diesem Rechner
# – ohne `adb forward` endet der Aufruf in „Connection refused“. Und der
# Anschlussname trägt die Prozessnummer der App, die sich bei jedem Start
# ändert.
eval_webview() {
  require adb
  device_online || { warn "Kein Emulator läuft."; exit 1; }

  local pid socket
  pid="$(adb shell pidof -s "$APP_ID" 2>/dev/null | tr -d '\r')"
  socket=""
  if [ -n "$pid" ]; then
    socket="$(adb shell cat /proc/net/unix 2>/dev/null \
      | grep -o "webview_devtools_remote_$pid" | head -1)"
  fi
  if [ -z "$socket" ]; then
    socket="$(adb shell cat /proc/net/unix 2>/dev/null \
      | grep -o 'webview_devtools_remote_[0-9]*' | sort -u | tail -1)"
  fi
  [ -n "$socket" ] || {
    warn "Kein WebView gefunden. Läuft die App? (npm run android:emu:install)"
    exit 1
  }

  adb forward tcp:9222 "localabstract:$socket" >/dev/null
  node "$PROJECT_DIR/scripts/webview-eval.mjs" "$@"
  adb forward --remove tcp:9222 >/dev/null 2>&1 || true
}

case "${1:-}" in
  start) start ;;
  install) install_app "${2:---mock}" ;;
  shot) shift; screenshot "${1:-}" ;;
  stop)
    stop
    stoppe_mock
    ;;
  eval) shift; eval_webview "$@" ;;
  *)
    echo "Aufruf: $0 {start|install [--mock|--echt]|shot [datei]|eval <ausdruck>|stop}"
    exit 1
    ;;
esac
