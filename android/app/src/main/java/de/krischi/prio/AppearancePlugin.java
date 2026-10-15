package de.krischi.prio;

import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Der Fensterhintergrund hinter älteren WebViews folgt derselben CSS-Farbrolle. */
@CapacitorPlugin(name = "Appearance")
public class AppearancePlugin extends Plugin {
    private Integer background;

    @PluginMethod
    public void setBackground(PluginCall call) {
        String color = call.getString("color", "");
        if (!color.matches("#[0-9a-fA-F]{6}")) {
            call.reject("Ungültige Hintergrundfarbe.");
            return;
        }
        background = Color.parseColor(color);
        getBridge().executeOnMainThread(() -> { applyBackground(); call.resolve(); });
    }

    private void applyBackground() {
        if (background == null) return;
        getActivity().getWindow().setBackgroundDrawable(new ColorDrawable(background));
        getActivity().getWindow().getDecorView().setBackgroundColor(background);
        getBridge().getWebView().setBackgroundColor(background);
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration config) {
        // SystemBars setzt beim Drehen zunächst wieder die Startfarbe. Die
        // nächste UI-Runde übernimmt anschließend die aktuelle Farbwahl.
        getBridge().getWebView().post(this::applyBackground);
    }

    @Override
    protected void handleOnResume() {
        getBridge().getWebView().post(this::applyBackground);
    }
}
