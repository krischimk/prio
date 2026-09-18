package de.krischi.prio;

import android.os.Bundle;

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
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
