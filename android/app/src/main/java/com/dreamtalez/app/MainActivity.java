package com.dreamtalez.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Clear stale WebView cache on every resume so Render deploys
        // reflect immediately without requiring a manual cache clear.
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.clearCache(false); // false = memory cache only; preserves cookies/auth
        }
    }
}
