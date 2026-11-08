package com.prisma.iptv;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Canal abre tocando, sem precisar tocar na tela.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        // Tela não apaga enquanto o app está aberto (assistindo TV).
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
