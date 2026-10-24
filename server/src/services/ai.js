export async function proposePatch({ request, fileInventory = [], currentFiles = [] }) {
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = process.env;
  if (!AI_BASE_URL || !AI_API_KEY || !AI_MODEL) {
    return { configured: false, message: "AI is not configured. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL on the server.", request,
      plan: ["Inspect selected files.", "Generate a minimal patch for editable resources/source.", "Show a diff and require approval.", "Run build and validation checks."] };
  }
  const prompt = [
    "You are APKForge AI for authorized app/game modding. Return JSON with summary, files_to_change, patch, risks, tests.",
    "Do not suggest bypassing DRM, payment, anti-cheat, licensing, or security protections. Do not execute shell commands.",
    `User request: ${request}`,
    `File inventory: ${JSON.stringify(fileInventory).slice(0, 30000)}`,
    `Current editable files: ${JSON.stringify(currentFiles).slice(0, 30000)}`
  ].join("\n\n");
  const response = await fetch(AI_BASE_URL, { method:"POST",
    headers:{ Authorization:`Bearer ${AI_API_KEY}`, "Content-Type":"application/json" },
    body:JSON.stringify({ model:AI_MODEL, messages:[
      {role:"system",content:"Return valid JSON only. Propose reviewable patches; never claim an untested build works."},
      {role:"user",content:prompt}], temperature:0.2 }),
    signal:AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned no message content");
  return { configured:true, proposal:content };
}
