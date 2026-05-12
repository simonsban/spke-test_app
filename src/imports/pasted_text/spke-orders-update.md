Update the existing SPKE Zamówienia page based on real Info-Car form 
data structure. Keep the current visual style, header, breadcrumbs, 
3 tabs structure (Nowe / W produkcji / Zrobione), bulk actions, and 
the "Pokaż wycofane" toggle. Apply the following changes:

=== DATA MODEL CHANGES (apply to all 3 tabs) ===

1. Card type names — rename throughout:
   - "Karta kierowcy" — keep as is (blue badge)
   - "Karta warsztatowa" — keep as is (orange badge)
   - "Karta firmy" → RENAME to "Karta przedsiębiorstwa" (green badge)
   - "Karta kontrolna" — keep as is (purple badge)

2. One order can contain MULTIPLE card types in one request. The "Typ 
karty" column must show ALL types ordered with quantities, not a single 
badge. Format: small horizontal list of mini-badges with counts.
   
   Examples:
   - Single type: [Karta kierowcy ×12]
   - Two types:   [Karta kierowcy ×3] [Karta warsztatowa ×2]
   - Three types: [Karta kierowcy ×1] [Karta przedsiębiorstwa ×4] [Karta kontrolna ×2]
   
   If 3+ types don't fit in one row, wrap to second line. Badges should 
   be smaller than current ones (12px text, 4px padding) so multiple 
   fit comfortably.

3. "Liczba sztuk" column — show TOTAL across all card types, 
   right-aligned. Below the number show small muted text with type 
   count, e.g.:
   - "12" with subtext "1 typ"
   - "5" with subtext "2 typy"  
   - "7" with subtext "3 typy"

4. ID format — use Info-Car/POKE source numbering. Format: 
   "WN/2026/045678" (monospace, clickable, opens detail drawer). 
   Replace all current "ZAM/2026/XXXXX" examples.

5. Add new column "Zamawiający" between "Data wpłynięcia" and "Typ karty":
   - Two-line cell
   - Top line: icon + label, either "Osoba fizyczna" (person icon) or 
     "Firma" (building icon) — small muted gray text
   - Bottom line: nothing visible (data hidden — operator doesn't see 
     names due to privacy rules)
   - This is just to let operator know order TYPE without revealing PII

=== NEW FILTER ===

Add to the filter row, next to "Typ karty: Wszystkie":
- "Zamawiający: Wszystkie" dropdown with options: 
  Wszystkie / Osoba fizyczna / Firma

=== NEW: ORDER DETAIL DRAWER ===

Clicking on any order ID (WN/2026/045678) opens a slide-in drawer from 
the right (480px wide) with order details.

Drawer header:
- Title: "Wniosek WN/2026/045678" (large, semibold)
- Subtitle: "Złożony 06.05.2026, 14:23 przez Info-Car"
- Close button (X) in top-right
- Status badge below title (Nowe / W produkcji / Zrobione / Wycofane)

Drawer body sections (separated by horizontal dividers):

SECTION 1: "Zamówienie"
- Type indicator: icon + "Osoba fizyczna" or "Firma"
- Heading: "Zamówione karty" 
- Item list (each row shows type + count + price placeholder):
    [color dot] Karta kierowcy           ×3 szt.
    [color dot] Karta warsztatowa        ×2 szt.
- Bottom of section: "Razem: 5 sztuk" (bold)

SECTION 2: "Status produkcji"
- Timeline component (vertical, 4 steps):
    ✓ Wpłynęło z POKE          06.05.2026, 14:23
    ✓ Pobrane do produkcji     06.05.2026, 09:15 (Jan Kowalski)
    ○ W produkcji              — (current step, highlighted)
    ○ Zrobione                 —
- Steps already completed: green checkmark, full color
- Current step: blue ring, "—" for time
- Future steps: gray, muted
- Show withdrawal as red X step if order is withdrawn

SECTION 3: "Dane zamawiającego"
- Heading with small lock icon and muted text: 
  "🔒 Dane wrażliwe — niedostępne w SPKE"
- Body text (in gray box with light background): 
  "Dane osobowe zamawiającego (imię, nazwisko, PESEL/NIP, adres) są 
  dostępne wyłącznie w panelu Ekspedycji. SPKE pracuje wyłącznie na 
  danych produkcyjnych."
- Below: small link "Dlaczego nie widzę tych danych?" (opens tooltip 
  or info modal explaining RODO/role separation)

SECTION 4: "Historia operacji" (audit log)
- Compact list of events:
    06.05.2026, 14:23 — Wpłynęło z POKE (system)
    06.05.2026, 09:15 — Pobrane do produkcji (Jan Kowalski)
    [if withdrawn:] 06.05.2026, 10:30 — Wycofane (Anna Nowak): 
                    "Powód: duplikat wniosku z poprzedniego dnia"

Drawer footer (sticky bottom, depends on current status):
- For "Nowe": [Wycofaj] (ghost red) | [Pobierz do produkcji] (primary)
- For "W produkcji": [Wycofaj] (ghost red) | [Oznacz jako zrobione] (primary)
- For "Zrobione": no actions, just close button
- For "Wycofane": no actions, just close button

=== UPDATE EXAMPLE DATA ===

Generate fresh sample rows for all 3 tabs that demonstrate variety:
- ~60% single-card-type orders (most common case)
- ~30% two-type orders
- ~10% three-or-more-type orders
- Mix of "Osoba fizyczna" and "Firma" — roughly 70/30 split (companies 
  order more in volume but are less frequent)
- Quantities ranging from 1 to 50, with companies tending to higher 
  numbers
- Use realistic Info-Car ID format: "WN/2026/0XXXXX"

=== KEEP UNCHANGED ===

- Top header (SPKE logo, navigation, breadcrumb, user avatar)
- Page title and subtitle
- Tab structure (Nowe / W produkcji / Zrobione) and counters
- "Pokaż wycofane" toggle
- Search input behavior
- Bulk actions toolbar logic
- Per-row action buttons (Pobierz / Oznacz jako zrobione / Wycofaj)
- Confirmation modals for Pobierz and Wycofaj
- Pagination
- Color palette, typography, spacing

Apply changes incrementally on top of current layout. Do not regenerate 
the page from scratch.