(function () {
  "use strict";

  function appendScript(src, key) {
    if (document.querySelector('script[data-hx-cloud-part="' + key + '"]')) return;
    var script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.setAttribute("data-hx-cloud-part", key);
    document.head.appendChild(script);
  }

  appendScript("/assets/hoshex-cloud-core.js", "supabase-core-v1");
  appendScript("/assets/hoshex-wordpress-sync.js", "wordpress-sync-v1");
})();