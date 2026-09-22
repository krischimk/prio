package de.krischi.prio;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
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
                long id = downloadId;
                abmelden();
                if (manager == null || id < 0) return;

                // Erst das Ergebnis prüfen: Ein fehlgeschlagener Download darf
                // nicht still bleiben – sonst wartet der Nutzer auf einen
                // Dialog, der nie kommt.
                String fehler = pruefeErgebnis(manager, id);
                if (fehler != null) {
                    meldeFehler(fehler);
                    return;
                }

                Uri datei = manager.getUriForDownloadedFile(id);
                if (datei == null) {
                    meldeFehler("Die geladene Datei ist nicht lesbar.");
                    return;
                }

                Intent installation = new Intent(Intent.ACTION_VIEW);
                installation.setDataAndType(datei, APK_MIME);
                installation.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(installation);
                } catch (ActivityNotFoundException nichtVorhanden) {
                    meldeFehler("Auf diesem Gerät gibt es keinen Installationsdialog.");
                    return;
                }

                JSObject ergebnis = new JSObject();
                ergebnis.put("downloadId", id);
                notifyListeners("installerOpened", ergebnis);
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

    /** `null`, wenn der Download erfolgreich war – sonst die Begründung. */
    private String pruefeErgebnis(DownloadManager manager, long id) {
        Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id));
        if (cursor == null) return "Der Download ist nicht mehr auffindbar.";
        try {
            if (!cursor.moveToFirst()) return "Der Download ist nicht mehr auffindbar.";
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            int grund = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
            if (status == DownloadManager.STATUS_SUCCESSFUL) return null;
            return beschreibeGrund(status, grund);
        } finally {
            cursor.close();
        }
    }

    private String beschreibeGrund(int status, int grund) {
        if (status == DownloadManager.STATUS_PAUSED) {
            return "Der Download wurde angehalten.";
        }
        if (status != DownloadManager.STATUS_FAILED) {
            return "Der Download ist nicht abgeschlossen.";
        }
        // Bei HTTP-Fehlern steht der Statuscode im Grund (z. B. 404).
        if (grund >= 400 && grund < 600) {
            return "Der Server hat mit " + grund + " geantwortet.";
        }
        switch (grund) {
            case DownloadManager.ERROR_INSUFFICIENT_SPACE:
                return "Es ist nicht genug Speicher frei.";
            case DownloadManager.ERROR_DEVICE_NOT_FOUND:
                return "Der Speicher ist nicht verfügbar.";
            case DownloadManager.ERROR_FILE_ERROR:
            case DownloadManager.ERROR_FILE_ALREADY_EXISTS:
                return "Die Datei konnte nicht geschrieben werden.";
            case DownloadManager.ERROR_UNHANDLED_HTTP_CODE:
            case DownloadManager.ERROR_HTTP_DATA_ERROR:
                return "Die Antwort des Servers war unerwartet.";
            case DownloadManager.ERROR_CANNOT_RESUME:
            case DownloadManager.ERROR_TOO_MANY_REDIRECTS:
                return "Die Verbindung wurde unterbrochen.";
            default:
                return "Der Download ist fehlgeschlagen.";
        }
    }

    private void meldeFehler(String text) {
        JSObject daten = new JSObject();
        daten.put("message", text);
        notifyListeners("downloadFailed", daten);
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
