const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const root = path.resolve(__dirname, "..");
const cloud = fs.readFileSync(path.join(root, "assets", "hoshex-cloud-core.js"), "utf8");
const cloudLoader = fs.readFileSync(path.join(root, "assets", "hoshex-cloud.js"), "utf8");
const wpBridge = fs.readFileSync(path.join(root, "assets", "hoshex-wordpress-sync.js"), "utf8");
const cloudCss = fs.readFileSync(path.join(root, "assets", "hoshex-cloud.css"), "utf8");
const widget = fs.readFileSync(path.join(root, "assets", "hoshex-cloud-widget.js"), "utf8");
const plugin = fs.readFileSync(path.join(root, "plugins", "wordpress", "hoshex-cloud", "hoshex-cloud.php"), "utf8");
const analytics = fs.readFileSync(path.join(root, "assets", "analytics.js"), "utf8");
const brain = fs.readFileSync(path.join(root, "api", "chat-cloud.js"), "utf8");

let failures = 0;
function check(value, message) {
  if (!value) { failures += 1; console.error("FAIL " + message); }
  else console.log("PASS " + message);
}

for (const [name, source] of [["cloud", cloud], ["cloud loader", cloudLoader], ["wordpress bridge", wpBridge], ["widget", widget]]) {
  try { new Function(source); console.log("PASS " + name + " JS syntax"); }
  catch (error) { failures += 1; console.error("FAIL " + name + " JS syntax: " + error.message); }
}

try { cp.execFileSync(process.execPath, ["--check", path.join(root, "api", "chat-cloud.js")], { stdio: "pipe" }); console.log("PASS cloud brain syntax"); }
catch (error) { failures += 1; console.error("FAIL cloud brain syntax"); }

check(cloud.includes("guest-bootstrap"), "guest session uses server bootstrap");
check(cloud.includes("claim-guest"), "guest data can transfer to permanent account");
check(cloud.includes("/rest/v1/"), "client sync uses Supabase Data API during migration");
check(cloud.includes("on_conflict=\" + encodeURIComponent(conflict)"), "sync uses idempotent upserts");
check(cloud.includes("hx_business_journey_v1"), "existing local journey is migrated");
check(cloud.includes("hxCloudGetBrainMemory"), "brain memory is exposed to diagnosis bridge");
check(cloud.includes("/api/chat-cloud"), "diagnosis bridge routes through memory endpoint");
check(cloud.includes("grant_type=password"), "cross-device account login uses password auth");
check(!cloud.includes("service_role"), "browser bundle contains no service-role key");
check(cloud.includes("sb_publishable_"), "browser uses publishable key");
check(cloudLoader.includes("hoshex-cloud-core.js") && cloudLoader.includes("hoshex-wordpress-sync.js"), "cloud loader starts legacy core and WordPress bridge");
check(wpBridge.includes("https://hoshex.ir/wp-json/hoshex/v1"), "V2 bridge targets Hoshex WordPress");
check(wpBridge.includes("/session") && wpBridge.includes("X-Hoshex-Session"), "WordPress sync uses signed browser session");
check(wpBridge.includes("hx_business_journey_v1") && wpBridge.includes("questionnaire: \"v2\""), "V2 journey and questionnaire data are synced to WordPress");
check(wpBridge.includes("client_context") && wpBridge.includes("viewport_width") && wpBridge.includes("touch_points"), "device context is sent to WordPress");
check(wpBridge.includes("base_revision") && wpBridge.includes("response.status === 409"), "WordPress sync respects revision conflicts");
check(brain.includes("داده امروز از حافظه مهم‌تر است"), "brain memory cannot override current evidence blindly");
check(brain.includes("feedback=no_result") && brain.includes("feedback=improved"), "brain uses prior feedback outcomes");
check(brain.includes("baseHandler"), "memory diagnosis wraps the deterministic V2 diagnosis");
check(widget.includes("fa-IR-u-ca-persian"), "website widget uses Jalali dates");
check(widget.includes("journeys?user_id=eq."), "website widget reads same cloud journey during migration");
check(plugin.includes("hoshex_business_path"), "legacy WordPress shortcode remains registered");
check(plugin.includes("hoshex-cloud-widget.js"), "legacy WordPress plugin loads shared cloud widget");
check(cloudCss.includes(".hx-cloud-modal") && cloudCss.includes(".hx-cloud-status"), "cloud account UI has compact app styles");
check(analytics.includes('/assets/hoshex-cloud.css'), "app loader includes cloud CSS");
check(analytics.includes('/assets/hoshex-cloud.js'), "app loader includes cloud loader JS");
check(analytics.indexOf('/assets/hoshex-cloud.js') > analytics.indexOf('/assets/hoshex-app-shell-v5.js'), "cloud initializes after app shell");

if (failures) {
  console.error(`\n${failures} cloud check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll Hoshex Cloud contracts passed.");
}