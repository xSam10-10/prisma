package com.prisma.iptv;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Abre filmes e séries no player nativo (NativePlayerActivity) e devolve,
 * ao fechar, onde parou, a duração e se chegou ao fim.
 */
@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Endereço do vídeo vazio.");
            return;
        }
        Intent i = new Intent(getContext(), NativePlayerActivity.class);
        i.putExtra("url", url);
        i.putExtra("title", call.getString("title", ""));
        i.putExtra("subtitle", call.getString("subtitle", ""));
        i.putExtra("startMs", call.getLong("startMs", 0L));
        i.putExtra("ua", call.getString("ua", "VLC/3.0.20 LibVLC/3.0.20"));
        startActivityForResult(call, i, "onPlayerClosed");
    }

    @ActivityCallback
    private void onPlayerClosed(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent d = result.getData();
        JSObject r = new JSObject();
        r.put("posMs", d != null ? d.getLongExtra("posMs", 0L) : 0L);
        r.put("durMs", d != null ? d.getLongExtra("durMs", 0L) : 0L);
        r.put("ended", d != null && d.getBooleanExtra("ended", false));
        String err = d != null ? d.getStringExtra("error") : null;
        if (err != null) r.put("error", err);
        call.resolve(r);
    }
}
