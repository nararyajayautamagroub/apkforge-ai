(() => {
  const originalFetch = window.fetch.bind(window);
  const getBase = () => (localStorage.getItem("apkforge.apiBase") || "").trim().replace(/\/+$/, "");
  window.fetch = (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const base = getBase();
    if (base && raw.startsWith("/api/")) return originalFetch(base + raw, init);
    return originalFetch(input, init);
  };
  const input = document.getElementById("apiBase");
  const status = document.getElementById("apiBaseStatus");
  const save = document.getElementById("saveApiBase");
  const test = document.getElementById("testApiBase");
  if (!input || !status || !save || !test) return;
  input.value = getBase();
  save.addEventListener("click", () => {
    const value = input.value.trim().replace(/\/+$/, "");
    if (value && !/^https?:\/\//i.test(value)) { status.textContent = "Alamat harus diawali https:// (atau http:// hanya untuk pengujian lokal)."; return; }
    if (value && location.protocol !== "http:" && !value.startsWith("https://")) { status.textContent = "Aplikasi Android hanya menerima API HTTPS."; return; }
    localStorage.setItem("apkforge.apiBase", value);
    status.textContent = value ? "Alamat API tersimpan." : "Alamat API dihapus; memakai server lokal.";
  });
  test.addEventListener("click", async () => {
    const value = input.value.trim().replace(/\/+$/, "");
    if (!value) { status.textContent = "Masukkan alamat API server terlebih dahulu."; return; }
    try {
      const response = await originalFetch(value + "/api/health");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "HTTP " + response.status);
      status.textContent = "Terhubung: " + data.name + " · " + data.status;
    } catch (error) { status.textContent = "Koneksi gagal: " + error.message + ". Pastikan HTTPS, CORS, dan server aktif."; }
  });
})();
