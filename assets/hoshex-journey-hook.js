(function () {
  "use strict";

  var attempts = 0;

  function readProfile() {
    var name = document.getElementById("business-name");
    var offer = document.getElementById("offer");
    return {
      businessName: name ? String(name.value || "").trim() : "",
      offer: offer ? String(offer.value || "").trim() : ""
    };
  }

  function install() {
    if (typeof window.hxRenderResult !== "function") {
      attempts += 1;
      if (attempts < 120) window.setTimeout(install, 50);
      return;
    }
    if (window.hxRenderResult.__hxJourneyHooked) return;

    var original = window.hxRenderResult;
    function wrapped(input, context) {
      var source = context && context.source || "api";
      window.hxCurrentResultKind = source === "demo" ? "demo" : "diagnosis";
      if (source !== "demo" && input && typeof input === "object") {
        var request = window.hxLastDiagnosisRequest && typeof window.hxLastDiagnosisRequest === "object" ? window.hxLastDiagnosisRequest : {};
        var payload = {
          sessionId: String(request.sessionId || "hx-result-" + Date.now().toString(36)),
          profile: request.profile && typeof request.profile === "object" ? request.profile : readProfile(),
          answers: request.answers && typeof request.answers === "object" ? request.answers : {},
          diagnosis: input,
          source: source,
          meta: window.hxLastDiagnosisMeta && typeof window.hxLastDiagnosisMeta === "object" ? window.hxLastDiagnosisMeta : {}
        };
        if (window.hxJourneySaveDiagnosis) window.hxJourneySaveDiagnosis(payload);
        else window.hxPendingJourneyDiagnosis = payload;
      }
      return original.apply(this, arguments);
    }
    wrapped.__hxJourneyHooked = true;
    window.hxRenderResult = wrapped;
  }

  install();
})();
