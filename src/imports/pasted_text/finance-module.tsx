Add a new "Biuro Finansów" module to the existing SPKE application. 
Keep all existing code (OrdersView, DispatchView, components, styles) 
completely unchanged. Only add the following:

=== NAVIGATION ===

Add a third navigation tab in the header, after "Ekspedycja":
- Icon: CreditCard (lucide-react)
- Label: "Biuro Finansów"
- Clicking it switches view to the finance module
- Header shows user: "Małgorzata Mróz", role "Biuro Finansów", 
  initials "MM"
- Breadcrumb: "Biuro Finansów / Rozliczenia"

Update View type: "orders" | "dispatch" | "finance"

=== DATA MODEL ===

Add type FinanceTab = "pending" | "refunds" | "history"

Add type FinanceRow:
- id: string (e.g. "WN/2026/045600" — same ID as SPKE orders)
- paymentId: string (e.g. "PAY/2026/001847")
- paymentDate: string
- amount: number (PLN)
- ordererType: "fizyczna" | "firma"
- clientName: string
- clientAddress: string
- nip?: string (only for firms)
- cards: CardEntry[] (same type as SPKE)
- doneAt?: string (if fulfilled)
- withdrawnAt?: string (if withdrawn)
- status: "zrealizowane" | "wycofane"
- reportId?: string (e.g. "RAP-BF/2026/00041")
- reportedAt?: string

Add CARD_PRICE record (PLN per card type, used to compute amounts):
- kierowcy: 98
- warsztatowa: 165
- przedsiebiorstwa: 380
- kontrolna: 220

=== MOCK DATA ===

Create FINANCE_ORDERS array with 12 realistic FinanceRow entries:
- 7 with status "zrealizowane" and no reportId (tab: "Do rozliczenia")
- 3 with status "wycofane" and no reportId (tab: "Zwroty")
- 2 with status "zrealizowane" or "wycofane" AND reportId 
  "RAP-BF/2026/00041" and reportedAt "05.05.2026, 23:59" (tab: "Historia")

Use realistic Polish data: mix of firms (with NIP) and individuals, 
real-looking addresses across different voivodeships, dates from 
May 2026, varied card types. Amounts must be mathematically correct 
(qty × CARD_PRICE per type, summed).

=== FINANCE VIEW COMPONENT ===

Build FinanceView as a single React component with this structure:

PAGE HEADER:
- Title: "Biuro Finansów" (28px semibold)
- Subtitle: "Rozliczenia płatności i zwrotów za zamówienia kart 
  tachografowych" (14px muted)

TAB NAVIGATION (underline style, same as SPKE tabs):
Three tabs with counters:
1. "Do rozliczenia (N)" — status="zrealizowane" + no reportId
2. "Zwroty (N)" — status="wycofane" + no reportId  
3. "Historia (N)" — has reportId

TOOLBAR (above table, white card with border):
Left side:
- Checkbox "select all" (only on tabs 1 and 2, hidden on Historia)
- Search input 300px: "Szukaj po ID, kliencie lub ID płatności..."
  (filters by id, clientName, paymentId)
- When items selected: counter "Zaznaczono: X (1 234,00 zł)" showing 
  selected count and sum of selected amounts

Right side:
- When items selected: 
    "Anuluj zaznaczenie" (ghost) + 
    "Pobierz raport (X)" (primary navy filled, Download icon)
- When nothing selected and rows exist:
    "Pobierz raport zbiorczy" (outline navy, FileText icon)
- On Historia tab: no action buttons

TABLE:
Columns for tabs "Do rozliczenia" and "Zwroty":
1. Checkbox (40px) — disabled and grayed for rows with reportId
2. "ID Zamówienia" — monospace navy, format WN/2026/XXXXXX
3. "ID Płatności" — monospace gray, format PAY/2026/XXXXXX
4. "Data płatności" — format "06.05.2026, 09:14"
5. "Kwota" — right-aligned, bold, format "98,00 zł" 
   (amber color for wycofane rows)
6. "Klient" — two lines: bold name on top with person/building icon, 
   muted NIP below (only for firms)
7. "Typ karty" — use existing CardTypesBadgeList component (dot + 
   uppercase style)
8. "Status / Data" — status badge + muted date below:
   - "zrealizowane": green dot + "ZREALIZOWANE" + "Wysłano: DD.MM.RRRR"
   - "wycofane": amber dot + "DO ZWROTU" + "Wycofano: DD.MM.RRRR"
9. "Akcje" — text button "Szczegóły" (same style as SPKE table)

Extra column for Historia tab only (between Status and Akcje):
"Raport" — monospace "RAP-BF/2026/00041" on top, 
muted "05.05.2026, 23:59" below

On Historia tab: no checkboxes column, no action buttons except 
"Szczegóły", rows are slightly dimmed (opacity 0.7)

ROW BEHAVIOR:
- Row height: 64px
- Clickable rows (tabs 1 and 2): clicking toggles checkbox selection
- Rows with reportId: opacity 0.7, gray background #FAFAFA, 
  checkbox disabled
- Hover: very subtle #FAFAFA
- Selected: light blue-gray #F4F6FB
- Separator: 1px solid #F4F4F5 (very subtle, same as SPKE)

EMPTY STATES (centered, with Inbox icon):
- Tab 1 empty: "Brak zamówień do rozliczenia"
- Tab 2 empty: "Brak zwrotów do obsłużenia"  
- Tab 3 empty: "Brak historii raportów"

=== REPORT MODAL ===

Triggered by both report buttons. Modal 500px wide:

Header:
- Title: "Generuj raport rozliczeniowy"
- Subtitle: "X zamówień do rozliczenia · łącznie 1 234,00 zł"

Body — "Zawartość raportu" section with checkboxes:
- ☑ ID zamówienia + ID płatności (checked, DISABLED — always required)
- ☑ Kwota płatności (checked, DISABLED — always required)
- ☑ Imię i nazwisko / Nazwa firmy (checked, toggleable)
- ☑ NIP (dla firm) (checked, toggleable)
- ☑ Adres klienta (checked, toggleable)
- ☑ Typ i liczba kart (checked, toggleable)
- ☑ Data realizacji / wycofania (checked, toggleable)

When tab is "Zwroty": show amber warning box below checkboxes:
"⚠ Raport zawiera zamówienia wycofane. Zwroty płatności należy 
obsłużyć ręcznie w systemie płatności (bank / PayU)."

Footer:
- "Anuluj" (ghost)
- "Pobierz XLSX" (primary navy filled, Download icon)

On confirm (Pobierz XLSX):
- Generate reportId "RAP-BF/2026/XXXXX" (auto-increment)
- Set reportedAt to current timestamp
- Mark all selected (or all pending) rows with this reportId
- Close modal
- Rows move from "Do rozliczenia"/"Zwroty" to "Historia"

=== VISUAL STYLE ===

Exactly match existing SPKE / Ekspedycja aesthetic:
- Same primary navy #1F4E79
- Same background #F5F6F8
- Same table styling (no zebra, subtle separators)
- Same badge style for card types (dot + uppercase)
- Same button styles
- Same font, same spacing
- Status badges: dot + uppercase text, NO background, NO border
  (same pattern as StatusBadge in SPKE)
- Polish language throughout
- Currency formatted as Polish: "1 234,00 zł" using 
  Intl.NumberFormat pl-PL

=== WHAT NOT TO CHANGE ===

Do not modify any existing code:
- OrdersView and all its subcomponents
- DispatchView and all its subcomponents  
- All shared components (CardTypeBadge, StatusBadge, Toggle, 
  Checkbox, FilterDropdown, etc.)
- SPKE and Ekspedycja mock data
- All existing types except adding FinanceTab and FinanceRow and 
  extending View type
- Header layout (only add the third tab)
- All existing styles and color palette