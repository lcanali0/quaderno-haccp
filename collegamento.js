// Collega il Quaderno HACCP a Supabase (lo stesso database dell'app degli ordini).
// Offre all'app le stesse funzioni che aveva dentro Claude: archivio, foto, PDF, lettura automatica.
(() => {
  const cfg = window.ORDINI_CONFIG;
  const sb = supabase.createClient(cfg.url, cfg.key);
  const TAB = "haccp", BUCKET = "haccp";
  const $ = (id) => document.getElementById(id);

  /* ---------- accesso ---------- */
  let pronto;
  const accesso = new Promise((r) => (pronto = r));

  function mostraAccesso(msg) {
    let box = $("accesso");
    if (!box) {
      box = document.createElement("div");
      box.id = "accesso";
      box.innerHTML = `<form class="card" id="acc-form">
        <h2>Quaderno HACCP</h2>
        <div class="sub">Entra con la tua email e password. È un'app separata da quella degli ordini: entra solo chi è nell'elenco dell'HACCP.</div>
        <label>Email<input type="email" id="acc-mail" autocomplete="username" required></label>
        <label>Password<input type="password" id="acc-pw" autocomplete="current-password" required></label>
        <button type="submit" class="primary" id="acc-ok">Entra</button>
        <button type="button" class="small" id="acc-new">Prima volta? Crea la password</button>
        <div class="sub" id="acc-msg" role="status"></div>
        <a class="btn small" href="manuale.html#entrare">Come si entra? Apri il manuale</a>
      </form>`;
      document.body.appendChild(box);
      $("acc-form").onsubmit = async (e) => {
        e.preventDefault();
        $("acc-ok").disabled = true;
        $("acc-msg").textContent = "Entro…";
        const { error } = await sb.auth.signInWithPassword({ email: $("acc-mail").value.trim(), password: $("acc-pw").value });
        $("acc-ok").disabled = false;
        if (error) { $("acc-msg").textContent = "Email o password sbagliate"; return; }
        controlla();
      };
      $("acc-new").onclick = async () => {
        const email = $("acc-mail").value.trim(), password = $("acc-pw").value;
        if (!email || password.length < 6) { $("acc-msg").textContent = "Scrivi la tua email e una password di almeno 6 caratteri, poi premi di nuovo"; return; }
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split("#")[0] } });
        if (error) { $("acc-msg").textContent = /registered/i.test(error.message) ? "Questa email ha già una password: premi Entra" : "Non riuscito: " + error.message; return; }
        if (data.session) controlla(); else $("acc-msg").textContent = "Ti ho mandato un'email: apri il link per confermare, poi torna qui e premi Entra";
      };
    }
    box.hidden = false;
    $("acc-msg").textContent = msg || "";
  }

  async function controlla() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return mostraAccesso();
    const { data: ok } = await sb.rpc("haccp_ammesso");
    if (!ok) { await sb.auth.signOut(); return mostraAccesso("Questa email non è ancora abilitata all'HACCP. Chiedi al titolare di aggiungerla da \"Accessi\"."); }
    if ($("accesso")) $("accesso").hidden = true;
    pronto(session);
    const { data: admin } = await sb.rpc("haccp_admin");
    if (admin) mostraPulsanteAccessi();
  }

  /* ---------- chi può entrare (solo titolari) ---------- */
  function mostraPulsanteAccessi() {
    const esci = document.querySelector("[onclick='esciHaccp()']");
    if (!esci || $("accessi-btn")) return;
    const b = document.createElement("button");
    b.id = "accessi-btn"; b.type = "button"; b.className = "small"; b.textContent = "Accessi";
    b.onclick = apriAccessi;
    esci.before(b, " ");
  }
  async function apriAccessi() {
    let box = $("accessi");
    if (!box) {
      box = document.createElement("div");
      box.id = "accessi";
      box.innerHTML = `<div class="card">
        <h2>Chi può entrare nell'HACCP</h2>
        <div class="sub">Questo elenco è solo dell'HACCP: non cambia niente nell'app degli ordini.</div>
        <div class="list" id="acs-list"></div>
        <form id="acs-form" class="row"><input class="grow" type="email" id="acs-mail" placeholder="email@esempio.it" required>
        <button class="small" type="submit">Aggiungi</button></form>
        <label class="row"><input type="checkbox" id="acs-admin" style="width:22px;height:22px;flex:none"> Titolare (può gestire questo elenco)</label>
        <button type="button" class="primary" id="acs-chiudi">Chiudi</button>
        <div class="sub" id="acs-msg" role="status"></div></div>`;
      document.body.appendChild(box);
      $("acs-chiudi").onclick = () => (box.hidden = true);
      $("acs-form").onsubmit = async (e) => {
        e.preventDefault();
        const email = $("acs-mail").value.trim().toLowerCase();
        const { error } = await sb.from("haccp_ammessi").upsert({ email, admin: $("acs-admin").checked });
        $("acs-msg").textContent = error ? "Non aggiunta: " + error.message : email + " aggiunta. Al primo accesso preme \"Prima volta? Crea la password\".";
        if (!error) { $("acs-mail").value = ""; $("acs-admin").checked = false; elencoAccessi(); }
      };
      $("acs-list").onclick = async (e) => {
        const b = e.target.closest("[data-togli]");
        if (!b) return;
        const { data: { session } } = await sb.auth.getSession();
        if (b.dataset.togli === session?.user?.email?.toLowerCase()) { $("acs-msg").textContent = "Non puoi togliere te stessa"; return; }
        const { error } = await sb.from("haccp_ammessi").delete().eq("email", b.dataset.togli);
        $("acs-msg").textContent = error ? "Non tolta: " + error.message : "Tolta";
        elencoAccessi();
      };
    }
    box.hidden = false;
    elencoAccessi();
  }
  async function elencoAccessi() {
    const { data, error } = await sb.from("haccp_ammessi").select("email,admin").order("email");
    const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    $("acs-list").innerHTML = error ? "Elenco non disponibile" : data.map((r) =>
      `<div class="row"><span class="grow">${esc(r.email)}${r.admin ? " · titolare" : ""}</span><button class="small" type="button" data-togli="${esc(r.email)}">Togli</button></div>`).join("");
  }
  window.esciHaccp = async () => { await sb.auth.signOut(); location.reload(); };

  /* ---------- archivio ---------- */
  const dati = {};          // coll -> Map(id -> data)
  const ascolti = {};       // coll -> [fn]
  const ascoltiDoc = {};    // "coll/id" -> [fn]
  let caricato = null;

  async function caricaTutto() {
    const nuovi = {};
    for (let off = 0; ; off += 1000) {
      const { data, error } = await sb.from(TAB).select("coll,id,data").order("coll").order("id").range(off, off + 999);
      if (error) throw error;
      data.forEach((r) => (nuovi[r.coll] ||= new Map()).set(r.id, r.data));
      if (data.length < 1000) break;
    }
    Object.keys(dati).forEach((k) => delete dati[k]);
    Object.assign(dati, nuovi);
    Object.keys(ascolti).forEach(avvisa);
    Object.keys(ascoltiDoc).forEach(avvisaDoc);
  }
  const snap = (coll) => ({
    docs: [...(dati[coll] || new Map())].map(([id, d]) => ({ id, data: () => d })),
  });
  const avvisa = (coll) => (ascolti[coll] || []).forEach((f) => { try { f(snap(coll)); } catch (e) { console.error(e); } });
  const avvisaDoc = (key) => {
    const [c, i] = key.split("/");
    const d = dati[c]?.get(i);
    (ascoltiDoc[key] || []).forEach((f) => { try { f({ exists: !!d, id: i, data: () => d }); } catch (e) { console.error(e); } });
  };
  function cambiato(coll, id) { avvisa(coll); avvisaDoc(coll + "/" + id); }

  async function scrivi(coll, id, data) {
    (dati[coll] ||= new Map()).set(id, data);
    cambiato(coll, id);
    const { error } = await sb.from(TAB).upsert({ coll, id, data, aggiornato: new Date().toISOString() });
    if (error) throw error;
  }
  async function cancella(coll, id) {
    dati[coll]?.delete(id);
    cambiato(coll, id);
    const { error } = await sb.from(TAB).delete().eq("coll", coll).eq("id", id);
    if (error) throw error;
  }
  const docRef = (coll, id) => ({
    set: (data) => scrivi(coll, id, JSON.parse(JSON.stringify(data))),
    update: (patch) => scrivi(coll, id, { ...(dati[coll]?.get(id) || {}), ...JSON.parse(JSON.stringify(patch)) }),
    delete: () => cancella(coll, id),
    get: async () => { const d = dati[coll]?.get(id); return { exists: !!d, id, data: () => d }; },
    onSnapshot(fn) {
      const k = coll + "/" + id;
      (ascoltiDoc[k] ||= []).push(fn);
      if (caricato) caricato.then(() => avvisaDoc(k));
      return () => (ascoltiDoc[k] = ascoltiDoc[k].filter((f) => f !== fn));
    },
  });
  const db = {
    collection: (coll) => ({
      doc: (id) => docRef(coll, id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      onSnapshot(fn) {
        (ascolti[coll] ||= []).push(fn);
        if (caricato) caricato.then(() => fn(snap(coll)));
        return () => (ascolti[coll] = ascolti[coll].filter((f) => f !== fn));
      },
    }),
    doc: (path) => { const [c, i] = path.split("/"); return docRef(c, i); },
  };

  function ascoltaModifiche() {
    sb.channel("haccp")
      .on("postgres_changes", { event: "*", schema: "public", table: TAB }, (p) => {
        if (p.eventType === "DELETE") { const o = p.old || {}; dati[o.coll]?.delete(o.id); cambiato(o.coll, o.id); }
        else { const r = p.new; (dati[r.coll] ||= new Map()).set(r.id, r.data); cambiato(r.coll, r.id); }
      })
      .subscribe();
  }
  let ultimo = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !caricato || Date.now() - ultimo < 60000) return;
    ultimo = Date.now();
    caricaTutto().catch(() => {});
  });

  /* ---------- foto e file ---------- */
  const assets = {
    async upload(blob) {
      const ext = (blob.type.split("/")[1] || "bin").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
      const path = new Date().toISOString().slice(0, 7) + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + "." + ext;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "application/octet-stream" });
      if (error) throw error;
      // link valido 10 anni: le registrazioni HACCP vanno conservate a lungo
      const { data, error: e2 } = await sb.storage.from(BUCKET).createSignedUrl(path, 10 * 365 * 86400);
      if (e2) throw e2;
      return { id: path, url: data.signedUrl };
    },
  };

  /* ---------- PDF da salvare o stampare ---------- */
  const downloads = {
    async save({ filename, data }) {
      const file = new File([data], filename, { type: data.type || "application/pdf" });
      if (navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: filename }); return; }
        catch (e) { if (e.name === "AbortError") { const c = new Error("annullato"); c.code = "cancelled"; throw c; } }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    },
  };

  /* ---------- lettura automatica (funzione "leggi" su Supabase) ---------- */
  const inBase64 = (blob) => new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok({ type: blob.type || "image/jpeg", data: String(r.result).split(",")[1] });
    r.onerror = ko;
    r.readAsDataURL(blob);
  });
  const sample = {
    async limits() {
      const { data, error } = await sb.functions.invoke("leggi", { body: { ping: true } });
      return error ? null : { images: !!data?.images };
    },
    async json(prompt, opt = {}) {
      const images = await Promise.all((opt.images || []).map(inBase64));
      const { data, error } = await sb.functions.invoke("leggi", { body: { prompt, images, tier: opt.modelTier || "default" } });
      if (error || !data?.json) { const e = new Error(data?.error || "Lettura non riuscita"); e.code = "failed"; throw e; }
      return data.json;
    },
  };

  /* ---------- come dentro Claude ---------- */
  window.claude = {
    async use(nome) {
      await accesso;
      if (nome === "db") {
        caricato ||= caricaTutto().then(ascoltaModifiche);
        await caricato;
        return db;
      }
      if (nome === "assets") return assets;
      if (nome === "downloads") return downloads;
      if (nome === "sample") return sample;
      const e = new Error("non disponibile"); e.code = "not_granted"; throw e;
    },
  };

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  controlla();
})();
