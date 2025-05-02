import { summarize } from "../activities";

(async () => {
  const report =
    `Rebooted payments-1 for LatencyHigh at ${new Date().toISOString()}`;
  console.log("💡 Testing summarize with report:", report);
  try {
    await summarize(report);
    console.log("✅ summarize completed successfully");
  } catch (err) {
    console.error("❌ summarize test failed:", err);
  }
})();
