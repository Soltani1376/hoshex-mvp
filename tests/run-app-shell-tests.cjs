const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const jsPath = path.join(root, "assets", "hoshex-app-shell-v5.js");
const cssPath = path.join(root, "assets", "hoshex-app-shell-v5.css");
const mobileCssPath = path.join(root, "assets", "hoshex-app-shell-v5-mobile.css");
const analyticsPath = path.join(root, "assets", "analytics.js");

let failures = 0;
function check(ok, message) {
  if (!ok) {
    failures += 1;
    console.error(`FAIL ${message}`);
  } else {
    console.log(`PASS ${message}`);
  }
}

const js = fs.readFileSync(jsPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const mobileCss = fs.readFileSync(mobileCssPath, "utf8");
const analytics = fs.readFileSync(analyticsPath, "utf8");

try {
  new Function(js);
  console.log("PASS app shell JS syntax");
} catch (error) {
  failures += 1;
  console.error(`FAIL app shell JS syntax: ${error.message}`);
}

check(js.includes('fa-IR-u-ca-persian'), "Jalali calendar locale is explicit");
check(js.includes('.hx-checkin-card strong'), "execution check-in date is patched");
check(js.includes('.hx-inline-execution-status small'), "journey check-in date is patched");
check(js.includes('data-hx-app-dock'), "app dock is installed");
check(js.includes('data-app-nav="home"') && js.includes('data-app-nav="journey"') && js.includes('data-app-nav="diagnosis"'), "dock has three app navigation actions");

const jalaliSample = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(new Date("2026-09-01T12:00:00Z"));
check(/شهریور/.test(jalaliSample), "September 1 2026 formats as Shahrivar in Persian calendar");
check(!/2026/.test(jalaliSample), "formatted date is not Gregorian year text");

for (const selector of [
  ".hx-app-dock",
  ".hx-app-nav-item",
  ".hx-topbar",
  ".hx-active-home",
  ".hx-decision-card",
  ".hx-execution-panel"
]) {
  check(css.includes(selector), `compact CSS contains ${selector}`);
}

check(css.includes("width: min(820px, 100%)"), "returning-user home is capped to compact app width");
check(css.includes("min-height: 43px"), "primary controls use compact height");
check(css.includes("box-shadow: none !important"), "major cards remove heavy shadows");
check(mobileCss.includes("width: calc(100% - 16px) !important"), "mobile shell uses valid compact calc width");

check(analytics.includes('/assets/hoshex-app-shell-v5.css'), "analytics loader includes compact app CSS");
check(analytics.includes('/assets/hoshex-app-shell-v5-mobile.css'), "analytics loader includes compact mobile correction");
check(analytics.includes('/assets/hoshex-app-shell-v5.js'), "analytics loader includes compact app JS");
check(analytics.indexOf('/assets/hoshex-app-shell-v5.css') > analytics.indexOf('/assets/hoshex-completion.css'), "compact CSS loads after completion CSS");
check(analytics.indexOf('/assets/hoshex-app-shell-v5-mobile.css') > analytics.indexOf('/assets/hoshex-app-shell-v5.css'), "mobile correction loads after compact CSS");
check(analytics.indexOf('/assets/hoshex-app-shell-v5.js') > analytics.indexOf('/assets/hoshex-execution.js'), "app shell JS loads after execution JS");

if (failures) {
  console.error(`\n${failures} app shell check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll compact app shell and Jalali checks passed.");
}
