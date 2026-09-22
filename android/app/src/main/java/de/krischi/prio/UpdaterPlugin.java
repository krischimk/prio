package de.krischi.prio;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lädt eine neue Fassung der App und öffnet den Installationsdialog.
 *
 * Warum nativ und nicht im Browser-Teil: Eine APK kann die Web-Oberfläche nicht
 * installieren. Der Download läuft über den System-Downloader – der kann
 * fortsetzen, zeigt den Fortschritt in der Benachrichtigungsleiste und
 * überlebt, wenn die App in den Hintergrund geht.
 *
 * Ab Android 8 muss der Nutzer prio erlauben, Apps zu installieren. Fehlt die
 * Erlaubnis, öffnet das Plugin die passende Einstellungsseite und meldet einen
 * Fehler – so muss niemand raten, wo die Einstellung liegt.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    private static final String APK_MIME = "application/vnd.android.package-archive";

    private BroadcastReceiver fertigEmpfänger;
    private long downloadId = -1;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "prio-update.apk");

        if (url == null || url.isEmpty()) {
            call.reject("Es wurde keine Adresse übergeben.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            einstellungenOeffnen();
            call.reject("Bitte zuerst erlauben, dass prio Apps installieren darf.");
            return;
        }

        DownloadManager manager =
                (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) {
            call.reject("Der System-Downloader ist nicht verfügbar.");
            return;
        }

        DownloadManager.Request anfrage = new DownloadManager.Request(Uri.parse(url));
        anfrage.setTitle("prio");
        anfrage.setDescription("Neue Fassung wird geladen");
        anfrage.setMimeType(APK_MIME);
        anfrage.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        // In den app-eigenen Ordner: kein Zugriff auf den gemeinsamen Speicher
        // nötig, und der System-Downloader darf dort schreiben.
        anfrage.setDestinationInExternalFilesDir(
                getContext(), Environment.DIRECTORY_DOWNLOADS, fileName);

        downloadId = manager.enqueue(anfrage);
        aufFertigstellungWarten();

        JSObject ergebnis = new JSObject();
        ergebnis.put("downloadId", downloadId);
        call.resolve(ergebnis);
    }

    /** Startet nach dem Download den Installationsdialog des Systems. */
    private void aufFertigstellungWarten() {
        abmelden();

        fertigEmpfänger = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long fertigeId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (fertigeId != downloadId) return;

                DownloadManager manager =
                        (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
                abmelden();
                if (manager == null || downloadId < 0) return;

                Uri datei = manager.getUriForDownloadedFile(downloadId);
                if (datei == null) return;

                Intent installation = new Intent(Intent.ACTION_VIEW);
                installation.setDataAndType(datei, APK_MIME);
                installation.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(installation);
            }
        };

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Der Downloader ist Teil des Systems – die Meldung kommt von außen.
            getContext().registerReceiver(fertigEmpfänger, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(fertigEmpfänger, filter);
        }
    }

    private void einstellungenOeffnen() {
        Intent einstellungen = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName()));
        einstellungen.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(einstellungen);
    }

    private void abmelden() {
        if (fertigEmpfänger == null) return;
        try {
            getContext().unregisterReceiver(fertigEmpfänger);
        } catch (IllegalArgumentException ignoriert) {
            // War nie angemeldet – unerheblich.
        }
        fertigEmpfänger = null;
    }

    @Override
    protected void handleOnDestroy() {
        abmelden();
        super.handleOnDestroy();
    }
}
