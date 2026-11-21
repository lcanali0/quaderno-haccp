# Quaderno HACCP

App HACCP per pasticceria, panetteria, bar e caffetteria: ricette, lotti, fatture, produzione, etichette, registri ASL.
Funziona dal browser del telefono e si aggiunge alla schermata Home, come l'app degli ordini.

- **Sito**: GitHub Pages (gratis), file in questa cartella
- **Dati e foto**: lo stesso progetto Supabase dell'app degli ordini, ma in tabelle e cartella foto proprie (`haccp`, `haccp_storia`)
- **Chi può entrare**: un elenco solo dell'HACCP (`haccp_ammessi`), separato da quello degli ordini; si gestisce dal pulsante "Accessi"
- **Separazione**: dati, foto, storico e accessi HACCP non toccano niente dell'app degli ordini
- **Lettura automatica di etichette e fatture**: funzione `supabase/functions/leggi` (serve una chiave Anthropic)

## Da fare una volta sola
1. Supabase > SQL Editor: incolla `supabase/schema-haccp.sql` e premi Run.
2. (Facoltativo) Supabase > Edge Functions: crea la funzione `leggi` con il contenuto di `supabase/functions/leggi/index.ts`,
   poi in Secrets aggiungi `ANTHROPIC_API_KEY`. Senza questa, i dati si scrivono a mano.
3. GitHub > Settings > Pages: Branch `main`, cartella `/ (root)`.
4. Sicurezza: Supabase > SQL Editor: incolla `supabase/sicurezza.sql` e premi Run (vale per tutte e due le app: solo le email negli elenchi possono creare un account). Deve uscire "TUTTO A POSTO".

## File
| File | A cosa serve |
|---|---|
| `index.html` | l'app |
| `collegamento.js` | accesso, salvataggio su Supabase, foto, PDF, lettura automatica |
| `config.js` | indirizzo e chiave pubblica di Supabase (gli stessi dell'app degli ordini) |
| `sw.js`, `manifest.webmanifest`, `icona*` | installazione sul telefono |
