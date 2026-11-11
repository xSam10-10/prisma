package com.prisma.iptv;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.PlayerView;

/**
 * Player nativo (ExoPlayer / Media3) para filmes e séries no Android (0.30.0).
 * Os controles do próprio Android trazem troca de áudio, legendas e velocidade
 * (botão de engrenagem). Ao sair, devolve onde parou para o PRISMA guardar.
 */
@OptIn(markerClass = UnstableApi.class)
public class NativePlayerActivity extends AppCompatActivity {
    private ExoPlayer player;
    private PlayerView view;
    private TextView title;
    private boolean ended = false;
    private String error = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        hideSystemBars();

        Intent in = getIntent();
        String url = in.getStringExtra("url");
        String name = in.getStringExtra("title");
        String sub = in.getStringExtra("subtitle");
        long startMs = in.getLongExtra("startMs", 0L);
        String ua = in.getStringExtra("ua");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        view = new PlayerView(this);
        view.setShowSubtitleButton(true);
        view.setControllerShowTimeoutMs(4000);
        view.setKeepScreenOn(true);
        root.addView(view, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // Nome do filme/episódio no alto, junto com os controles.
        title = new TextView(this);
        title.setTextColor(Color.WHITE);
        title.setTextSize(20);
        title.setShadowLayer(8f, 0f, 2f, Color.BLACK);
        title.setText(sub != null && !sub.isEmpty() ? name + "\n" + sub : name);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        title.setPadding(pad, pad, pad, pad);
        root.addView(title, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP));
        view.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener) visibility -> title.setVisibility(visibility));
        setContentView(root);

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setUserAgent(ua != null ? ua : "VLC/3.0.20 LibVLC/3.0.20")
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(20000)
            .setReadTimeoutMs(30000);
        DefaultMediaSourceFactory sources = new DefaultMediaSourceFactory(this).setDataSourceFactory(new DefaultDataSource.Factory(this, http));
        DefaultTrackSelector tracks = new DefaultTrackSelector(this);
        // Português primeiro (áudio e legenda), como o app já lembra no player web.
        tracks.setParameters(tracks.buildUponParameters().setPreferredAudioLanguage("pt").setPreferredTextLanguage("pt"));
        DefaultRenderersFactory renderers = new DefaultRenderersFactory(this).setEnableDecoderFallback(true);

        player = new ExoPlayer.Builder(this, renderers).setMediaSourceFactory(sources).setTrackSelector(tracks).build();
        view.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    ended = true;
                    finishWithResult();
                }
            }

            @Override
            public void onPlayerError(PlaybackException e) {
                error = e.getErrorCodeName();
                Toast.makeText(NativePlayerActivity.this, "Não deu para tocar no player do Android (" + error + "). Voltando…", Toast.LENGTH_LONG).show();
                finishWithResult();
            }
        });

        MediaItem.Builder item = new MediaItem.Builder().setUri(Uri.parse(url));
        if (url != null && url.toLowerCase().contains(".m3u8")) item.setMimeType(MimeTypes.APPLICATION_M3U8);
        player.setMediaItem(item.build(), Math.max(0L, startMs));
        player.prepare();
        player.play();
    }

    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** Controle remoto: ◀ ▶ voltam/avançam 10 s com os controles escondidos; OK mostra os controles. */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() == KeyEvent.ACTION_DOWN && player != null && !view.isControllerFullyVisible()) {
            int k = e.getKeyCode();
            if (k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_DPAD_RIGHT) {
                long to = player.getCurrentPosition() + (k == KeyEvent.KEYCODE_DPAD_LEFT ? -10000 : 10000);
                long dur = player.getDuration();
                if (dur != C.TIME_UNSET) to = Math.min(to, dur - 1000);
                player.seekTo(Math.max(0, to));
                view.showController();
                return true;
            }
            if (k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER || k == KeyEvent.KEYCODE_DPAD_UP || k == KeyEvent.KEYCODE_DPAD_DOWN) {
                view.showController();
                return true;
            }
        }
        return view.dispatchKeyEvent(e) || super.dispatchKeyEvent(e);
    }

    @Override
    public void onBackPressed() {
        if (view != null && view.isControllerFullyVisible()) {
            view.hideController();
            return;
        }
        finishWithResult();
    }

    private boolean done = false;

    private void finishWithResult() {
        if (done) return;
        done = true;
        Intent out = new Intent();
        if (player != null) {
            long dur = player.getDuration();
            out.putExtra("posMs", player.getCurrentPosition());
            out.putExtra("durMs", dur == C.TIME_UNSET ? 0L : dur);
        }
        out.putExtra("ended", ended);
        if (error != null) out.putExtra("error", error);
        setResult(RESULT_OK, out);
        finish();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) player.pause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (player != null) {
            player.release();
            player = null;
        }
    }
}
