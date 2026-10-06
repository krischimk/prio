package de.krischi.prio;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebSettings;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Android 15+ erzwingt Edge-to-Edge für Apps mit targetSdk 35 oder höher.
     * Damit die Web-Oberfläche die Systemleisten nicht überdeckt, wird
     * Edge-to-Edge ausdrücklich aktiviert und die Abstände über die
     * CSS-Variablen `--safe-area-inset-*` behandelt
     * (siehe `insetsHandling` in capacitor.config.ts).
     *
     * Ohne diesen Aufruf läge der Inhalt unter der Statusleiste – genau der
     * Zustand, der die Oberfläche unbedienbar gemacht hat.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Muss vor super.onCreate() stehen: Capacitor sammelt die Plugins beim
        // Aufbau der Brücke ein.
        registerPlugin(UpdaterPlugin.class);

        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);

        /*
         * Nur im Debug-Build: Der Emulator läuft standardmäßig gegen den
         * lokalen Mock (http://127.0.0.1:…). Die Oberfläche kommt aus dem
         * App-Paket unter https://localhost, der Mock antwortet über http –
         * ohne diese Ausnahme blockiert die WebView die Anfragen als
         * gemischten Inhalt. Zusammen mit der Netzwerk-Ausnahme in
         * src/debug/res/xml/network_security_config.xml macht das den
         * Mock-Weg möglich.
         *
         * Der Release-Build ist nicht betroffen: Dort ist das Debug-Kennzeichen
         * nicht gesetzt, und die Debug-Ressourcen liegen nicht im Paket.
         */
        boolean debug = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (debug) {
            getBridge()
                .getWebView()
                .getSettings()
                .setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }
    }
}
