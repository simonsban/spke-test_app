import { useMemo, useState, useEffect, useRef } from "react";
import {
  Search,
  ChevronDown,
  ArrowUpDown,
  Check,
  Inbox,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Eye,
  Calendar,
  X,
  ClipboardList,
  Truck,
  UserRound,
  Building2,
  XCircle,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  CreditCard,
  RotateCcw,
} from "lucide-react";

/* ======================== TYPES ======================== */

type CardType = "kierowcy" | "warsztatowa" | "przedsiebiorstwa" | "kontrolna";
type ReportFormat = "PDF" | "CSV" | "XLSX";
type View = "orders" | "dispatch" | "finance";
type OrderStatus = "Nowe" | "W produkcji" | "Zrobione" | "Wycofane";
type OrdererType = "fizyczna" | "firma";
type FinanceTab = "pending" | "refunds" | "history";

// TODO: confirm with BA — ceny per typ karty wg cennika Info-Car
const CARD_PRICE: Record<CardType, number> = {
  kierowcy: 98,
  warsztatowa: 165,
  przedsiebiorstwa: 380,
  kontrolna: 220,
};

type FinanceRow = {
  id: string;           // WN/2026/XXXXXX — wspólne z SPKE
  paymentId: string;    // TODO: confirm format z POKE/Info-Car (PAY/RRRR/XXXXXX)
  paymentDate: string;
  amount: number;       // TODO: confirm cennik
  ordererType: OrdererType;
  clientName: string;   // imię nazwisko lub nazwa firmy
  clientAddress: string;
  nip?: string;         // tylko dla firm — TODO: confirm czy BF widzi NIP
  cards: CardEntry[];
  doneAt?: string;      // data realizacji (jeśli zrealizowane)
  withdrawnAt?: string; // data wycofania (jeśli wycofane)
  status: "zrealizowane" | "wycofane";
  reportedAt?: string;  // data wygenerowania raportu
  reportId?: string;    // RAP-BF/2026/XXXXX
};

type CardEntry = {
  type: CardType;
  qty: number;
};

type OrderRow = {
  id: string;
  date: string;
  cards: CardEntry[];
  orderer: OrdererType;
  status: OrderStatus;
  takenAt?: string;
  takenBy?: string;
  doneAt?: string;
  doneBy?: string;
  withdrawnAt?: string;
  withdrawnBy?: string;
  withdrawalReason?: string;
  withdrawnFromStatus?: "Nowe" | "W produkcji";
  // dane klienta — maskowane dla SPKE
  clientName?: string;       // "Anna Lewandowska" / "TransLog Sp. z o.o."
  clientMaskedId?: string;   // "78••••••231" (PESEL) lub "525-22-••-118" (NIP)
  clientIdType?: "PESEL" | "NIP";
};

/* ======================== CARD TYPE CONFIG ======================== */


const CARD_TYPE_STYLE: Record<CardType, { dot: string }> = {
  kierowcy:         { dot: "#6366F1" },
  warsztatowa:      { dot: "#F59E0B" },
  przedsiebiorstwa: { dot: "#10B981" },
  kontrolna:        { dot: "#8B5CF6" },
};

const CARD_TYPE_SHORT: Record<CardType, string> = {
  kierowcy:         "KIEROWCY",
  warsztatowa:      "WARSZTATOWA",
  przedsiebiorstwa: "PRZEDSIĘBIORSTWA",
  kontrolna:        "KONTROLNA",
};

/* ======================== ORDERS DATA ======================== */


// Lookup danych klienta dla mockowych danych — TODO: replace with real data from POKE
const CLIENT_DATA: Record<string, { clientName: string; clientMaskedId: string; clientIdType: 'PESEL' | 'NIP' }> = {"WN/2026/045687":{"clientName":"Anna Lewandowska","clientMaskedId":"78••••••231","clientIdType":"PESEL"},"WN/2026/045686":{"clientName":"TransLog Sp. z o.o.","clientMaskedId":"525-22-••-118","clientIdType":"NIP"},"WN/2026/045685":{"clientName":"Krzysztof Marek","clientMaskedId":"84••••••502","clientIdType":"PESEL"},"WN/2026/045684":{"clientName":"ITD Warszawa","clientMaskedId":"521-34-••-567","clientIdType":"NIP"},"WN/2026/045683":{"clientName":"Marta Wiśniewska","clientMaskedId":"91••••••344","clientIdType":"PESEL"},"WN/2026/045682":{"clientName":"Logistyka Mazowsze","clientMaskedId":"521-34-••-781","clientIdType":"NIP"},"WN/2026/045681":{"clientName":"Piotr Zając","clientMaskedId":"75••••••618","clientIdType":"PESEL"},"WN/2026/045680":{"clientName":"Auto-Serwis Nowak","clientMaskedId":"677-23-••-901","clientIdType":"NIP"},"WN/2026/045679":{"clientName":"Trans-Pol Sp. z o.o.","clientMaskedId":"634-01-••-578","clientIdType":"NIP"},"WN/2026/045678":{"clientName":"Joanna Kowalczyk","clientMaskedId":"89••••••127","clientIdType":"PESEL"},"WN/2026/045654":{"clientName":"Cargo Małopolska","clientMaskedId":"679-23-••-456","clientIdType":"NIP"},"WN/2026/045653":{"clientName":"Tomasz Kamiński","clientMaskedId":"83••••••290","clientIdType":"PESEL"},"WN/2026/045652":{"clientName":"Mech-Tech Sp. j.","clientMaskedId":"895-00-••-278","clientIdType":"NIP"},"WN/2026/045651":{"clientName":"Ewa Dąbrowska","clientMaskedId":"79••••••541","clientIdType":"PESEL"},"WN/2026/045650":{"clientName":"Spedycja Bałtyk","clientMaskedId":"583-45-••-789","clientIdType":"NIP"}};
const INITIAL_ORDERS: OrderRow[] = [
  // ——— NOWE ———
  {
    id: "WN/2026/045687",
    date: "07.05.2026, 09:14",
    cards: [{ type: "kierowcy", qty: 1 }],
    orderer: "fizyczna",
    status: "Nowe",
  },
  {
    id: "WN/2026/045686",
    date: "07.05.2026, 08:47",
    cards: [{ type: "kierowcy", qty: 30 }],
    orderer: "firma",
    status: "Nowe",
  },
  {
    id: "WN/2026/045685",
    date: "06.05.2026, 17:32",
    cards: [
      { type: "kierowcy", qty: 1 },
      { type: "warsztatowa", qty: 1 },
    ],
    orderer: "fizyczna",
    status: "Nowe",
  },
  {
    id: "WN/2026/045684",
    date: "06.05.2026, 16:58",
    cards: [{ type: "kontrolna", qty: 6 }],
    orderer: "firma",
    status: "Nowe",
  },
  {
    id: "WN/2026/045683",
    date: "06.05.2026, 15:40",
    cards: [{ type: "warsztatowa", qty: 2 }],
    orderer: "fizyczna",
    status: "Nowe",
  },
  {
    id: "WN/2026/045682",
    date: "06.05.2026, 14:23",
    cards: [
      { type: "kierowcy", qty: 5 },
      { type: "przedsiebiorstwa", qty: 2 },
      { type: "kontrolna", qty: 1 },
    ],
    orderer: "firma",
    status: "Nowe",
  },
  {
    id: "WN/2026/045681",
    date: "06.05.2026, 13:11",
    cards: [{ type: "kierowcy", qty: 1 }],
    orderer: "fizyczna",
    status: "Nowe",
  },
  {
    id: "WN/2026/045680",
    date: "06.05.2026, 11:55",
    cards: [{ type: "przedsiebiorstwa", qty: 12 }],
    orderer: "firma",
    status: "Nowe",
  },
  {
    id: "WN/2026/045679",
    date: "06.05.2026, 10:31",
    cards: [
      { type: "kierowcy", qty: 8 },
      { type: "warsztatowa", qty: 3 },
    ],
    orderer: "firma",
    status: "Nowe",
  },
  {
    id: "WN/2026/045678",
    date: "06.05.2026, 08:02",
    cards: [{ type: "kierowcy", qty: 1 }],
    orderer: "fizyczna",
    status: "Nowe",
  },
  // ——— W PRODUKCJI ———
  {
    id: "WN/2026/045654",
    date: "05.05.2026, 17:20",
    cards: [{ type: "przedsiebiorstwa", qty: 20 }],
    orderer: "firma",
    status: "W produkcji",
    takenAt: "06.05.2026, 09:00",
    takenBy: "Jan Kowalski",
  },
  {
    id: "WN/2026/045653",
    date: "05.05.2026, 16:45",
    cards: [{ type: "warsztatowa", qty: 1 }],
    orderer: "fizyczna",
    status: "W produkcji",
    takenAt: "06.05.2026, 09:00",
    takenBy: "Jan Kowalski",
  },
  {
    id: "WN/2026/045652",
    date: "05.05.2026, 15:10",
    cards: [
      { type: "warsztatowa", qty: 4 },
      { type: "kontrolna", qty: 2 },
    ],
    orderer: "firma",
    status: "W produkcji",
    takenAt: "05.05.2026, 17:30",
    takenBy: "Jan Kowalski",
  },
  {
    id: "WN/2026/045651",
    date: "05.05.2026, 14:08",
    cards: [{ type: "kierowcy", qty: 1 }],
    orderer: "fizyczna",
    status: "W produkcji",
    takenAt: "05.05.2026, 17:30",
    takenBy: "Jan Kowalski",
  },
  {
    id: "WN/2026/045650",
    date: "05.05.2026, 11:33",
    cards: [{ type: "kierowcy", qty: 15 }],
    orderer: "firma",
    status: "W produkcji",
    takenAt: "05.05.2026, 14:00",
    takenBy: "Jan Kowalski",
  },
  // ——— ZROBIONE ———
  {
    id: "WN/2026/045605",
    date: "04.05.2026, 16:30",
    cards: [{ type: "przedsiebiorstwa", qty: 14 }],
    orderer: "firma",
    status: "Zrobione",
    takenAt: "04.05.2026, 18:00",
    takenBy: "Jan Kowalski",
    doneAt: "05.05.2026, 10:15",
    doneBy: "Jan Kowalski",
  },
  {
    id: "WN/2026/045604",
    date: "04.05.2026, 14:22",
    cards: [{ type: "kontrolna", qty: 8 }],
    orderer: "firma",
    status: "Zrobione",
    takenAt: "04.05.2026, 17:45",
    takenBy: "Jan Kowalski",
    doneAt: "05.05.2026, 09:30",
    doneBy: "Jan Kowalski",
  },
  {
    id: "WN/2026/045603",
    date: "04.05.2026, 11:05",
    cards: [{ type: "kierowcy", qty: 1 }],
    orderer: "fizyczna",
    status: "Zrobione",
    takenAt: "04.05.2026, 14:00",
    takenBy: "Jan Kowalski",
    doneAt: "04.05.2026, 16:45",
    doneBy: "Jan Kowalski",
  },
  {
    id: "WN/2026/045602",
    date: "03.05.2026, 15:44",
    cards: [
      { type: "warsztatowa", qty: 9 },
      { type: "kierowcy", qty: 3 },
    ],
    orderer: "firma",
    status: "Zrobione",
    takenAt: "04.05.2026, 09:15",
    takenBy: "Jan Kowalski",
    doneAt: "04.05.2026, 13:30",
    doneBy: "Jan Kowalski",
  },
  {
    id: "WN/2026/045601",
    date: "03.05.2026, 12:18",
    cards: [{ type: "kierowcy", qty: 1 }],
    orderer: "fizyczna",
    status: "Zrobione",
    takenAt: "03.05.2026, 14:30",
    takenBy: "Jan Kowalski",
    doneAt: "03.05.2026, 17:00",
    doneBy: "Jan Kowalski",
  },
  {
    id: "WN/2026/045600",
    date: "03.05.2026, 09:50",
    cards: [{ type: "kierowcy", qty: 22 }],
    orderer: "firma",
    status: "Zrobione",
    takenAt: "03.05.2026, 11:00",
    takenBy: "Jan Kowalski",
    doneAt: "03.05.2026, 16:20",
    doneBy: "Jan Kowalski",
  },
  // ——— WYCOFANE ———
  {
    id: "WN/2026/045611",
    date: "05.05.2026, 13:20",
    cards: [{ type: "kierowcy", qty: 5 }],
    orderer: "firma",
    status: "Wycofane",
    withdrawnFromStatus: "Nowe",
    withdrawnAt: "06.05.2026, 08:30",
    withdrawnBy: "Anna Nowak",
    withdrawalReason: "Duplikat wniosku z poprzedniego dnia",
  },
  {
    id: "WN/2026/045610",
    date: "05.05.2026, 09:45",
    cards: [{ type: "kierowcy", qty: 1 }],
    orderer: "fizyczna",
    status: "Wycofane",
    withdrawnFromStatus: "Nowe",
    withdrawnAt: "05.05.2026, 16:00",
    withdrawnBy: "Jan Kowalski",
    withdrawalReason: "Wniosek złożony przez pomyłkę",
  },
  {
    id: "WN/2026/045648",
    date: "04.05.2026, 10:30",
    cards: [
      { type: "warsztatowa", qty: 3 },
      { type: "kierowcy", qty: 2 },
    ],
    orderer: "firma",
    status: "Wycofane",
    withdrawnFromStatus: "W produkcji",
    takenAt: "04.05.2026, 12:00",
    takenBy: "Jan Kowalski",
    withdrawnAt: "04.05.2026, 15:30",
    withdrawnBy: "Anna Nowak",
    withdrawalReason: "Błąd w danych zamówienia",
  },
];

/* ======================== DISPATCH DATA ======================== */

type Recipient = {
  name: string;
  street: string;
  postal: string;
  city: string;
  voivodeship: string;
};

type DispatchRow = {
  id: string;
  doneAt: string;
  recipient: Recipient;
  cards: CardEntry[];
  reportId?: string;
  reportedAt?: string;
  reportedBy?: string;
};

/* ======================== FINANCE MOCK DATA ======================== */

const FINANCE_ORDERS: FinanceRow[] = [
  // --- DO ROZLICZENIA (opłacone + zrealizowane) ---
  {
    id: "WN/2026/045600",
    paymentId: "PAY/2026/001847",
    paymentDate: "06.05.2026, 09:14",
    amount: 98,
    ordererType: "fizyczna",
    clientName: "Jan Kowalski",
    clientAddress: "ul. Marszałkowska 142/15, 00-061 Warszawa",
    cards: [{ type: "kierowcy", qty: 1 }],
    doneAt: "06.05.2026, 16:42",
    status: "zrealizowane",
  },
  {
    id: "WN/2026/045599",
    paymentId: "PAY/2026/001831",
    paymentDate: "06.05.2026, 08:47",
    amount: 1930,
    ordererType: "firma",
    clientName: "Trans-Pol Sp. z o.o.",
    clientAddress: "ul. Górnośląska 24, 40-085 Katowice",
    nip: "634-012-45-78",
    cards: [{ type: "przedsiebiorstwa", qty: 3 }, { type: "kierowcy", qty: 5 }],
    doneAt: "06.05.2026, 15:21",
    status: "zrealizowane",
  },
  {
    id: "WN/2026/045598",
    paymentId: "PAY/2026/001812",
    paymentDate: "06.05.2026, 08:14",
    amount: 660,
    ordererType: "firma",
    clientName: "Auto-Serwis Wojciechowski",
    clientAddress: "ul. Floriańska 17, 31-019 Kraków",
    nip: "677-234-12-90",
    cards: [{ type: "warsztatowa", qty: 4 }],
    doneAt: "06.05.2026, 14:08",
    status: "zrealizowane",
  },
  {
    id: "WN/2026/045597",
    paymentId: "PAY/2026/001798",
    paymentDate: "05.05.2026, 17:33",
    amount: 98,
    ordererType: "fizyczna",
    clientName: "Anna Wiśniewska",
    clientAddress: "ul. Półwiejska 38/4, 61-888 Poznań",
    cards: [{ type: "kierowcy", qty: 1 }],
    doneAt: "06.05.2026, 12:55",
    status: "zrealizowane",
  },
  {
    id: "WN/2026/045596",
    paymentId: "PAY/2026/001776",
    paymentDate: "05.05.2026, 16:40",
    amount: 1760,
    ordererType: "firma",
    clientName: "ITD Wrocław",
    clientAddress: "ul. Sucha 3, 50-086 Wrocław",
    nip: "895-000-27-56",
    cards: [{ type: "kontrolna", qty: 8 }],
    doneAt: "06.05.2026, 11:30",
    status: "zrealizowane",
  },
  {
    id: "WN/2026/045595",
    paymentId: "PAY/2026/001754",
    paymentDate: "05.05.2026, 14:22",
    amount: 10990,
    ordererType: "firma",
    clientName: "Logistyka Mazowsze S.A.",
    clientAddress: "Al. Jerozolimskie 181B, 02-222 Warszawa",
    nip: "521-345-67-89",
    cards: [{ type: "przedsiebiorstwa", qty: 25 }, { type: "kierowcy", qty: 10 }, { type: "warsztatowa", qty: 3 }],
    doneAt: "06.05.2026, 10:14",
    status: "zrealizowane",
  },
  {
    id: "WN/2026/045594",
    paymentId: "PAY/2026/001741",
    paymentDate: "05.05.2026, 12:18",
    amount: 98,
    ordererType: "fizyczna",
    clientName: "Piotr Lewandowski",
    clientAddress: "ul. 3 Maja 12/8, 40-097 Katowice",
    cards: [{ type: "kierowcy", qty: 1 }],
    doneAt: "05.05.2026, 17:48",
    status: "zrealizowane",
  },
  // --- ZWROTY (opłacone + wycofane) ---
  {
    id: "WN/2026/045590",
    paymentId: "PAY/2026/001698",
    paymentDate: "04.05.2026, 11:22",
    amount: 660,
    ordererType: "firma",
    clientName: "Mech-Tech Bartosz Nowicki",
    clientAddress: "ul. Długa 41, 31-147 Kraków",
    nip: "679-123-44-56",
    cards: [{ type: "warsztatowa", qty: 3 }, { type: "kontrolna", qty: 1 }],
    withdrawnAt: "05.05.2026, 09:30",
    status: "wycofane",
  },
  {
    id: "WN/2026/045585",
    paymentId: "PAY/2026/001645",
    paymentDate: "03.05.2026, 14:15",
    amount: 196,
    ordererType: "fizyczna",
    clientName: "Maciej Wojtczak",
    clientAddress: "ul. Piękna 14, 61-560 Poznań",
    cards: [{ type: "kierowcy", qty: 2 }],
    withdrawnAt: "04.05.2026, 10:12",
    status: "wycofane",
  },
  {
    id: "WN/2026/045581",
    paymentId: "PAY/2026/001612",
    paymentDate: "03.05.2026, 10:04",
    amount: 380,
    ordererType: "firma",
    clientName: "Cargo Małopolska Sp. z o.o.",
    clientAddress: "ul. Wielicka 254, 30-663 Kraków",
    nip: "679-234-56-78",
    cards: [{ type: "przedsiebiorstwa", qty: 1 }],
    withdrawnAt: "04.05.2026, 08:45",
    status: "wycofane",
  },
  // --- HISTORIA (już ujęte w raporcie) ---
  {
    id: "WN/2026/045570",
    paymentId: "PAY/2026/001544",
    paymentDate: "30.04.2026, 11:30",
    amount: 490,
    ordererType: "firma",
    clientName: "Spedycja Bałtyk Sp. z o.o.",
    clientAddress: "ul. Heweliusza 11, 60-279 Gdańsk",
    nip: "583-456-78-90",
    cards: [{ type: "kierowcy", qty: 5 }],
    doneAt: "02.05.2026, 14:20",
    status: "zrealizowane",
    reportId: "RAP-BF/2026/00041",
    reportedAt: "05.05.2026, 23:59",
  },
  {
    id: "WN/2026/045568",
    paymentId: "PAY/2026/001532",
    paymentDate: "30.04.2026, 09:45",
    amount: 196,
    ordererType: "fizyczna",
    clientName: "Katarzyna Zielińska",
    clientAddress: "ul. Świdnicka 8c/22, 50-067 Wrocław",
    cards: [{ type: "kierowcy", qty: 2 }],
    withdrawnAt: "01.05.2026, 14:30",
    status: "wycofane",
    reportId: "RAP-BF/2026/00041",
    reportedAt: "05.05.2026, 23:59",
  },
];

const DISPATCH_ORDERS: DispatchRow[] = [
  {
    id: "WN/2026/045600",
    doneAt: "06.05.2026, 16:42",
    recipient: { name: "Jan Kowalski", street: "ul. Marszałkowska 142/15", postal: "00-061", city: "Warszawa", voivodeship: "mazowieckie" },
    cards: [{ type: "kierowcy", qty: 1 }],
  },
  {
    id: "WN/2026/045599",
    doneAt: "06.05.2026, 15:21",
    recipient: { name: "Trans-Pol Sp. z o.o.", street: "ul. Górnośląska 24", postal: "40-085", city: "Katowice", voivodeship: "śląskie" },
    cards: [{ type: "przedsiebiorstwa", qty: 12 }, { type: "kierowcy", qty: 8 }],
  },
  {
    id: "WN/2026/045598",
    doneAt: "06.05.2026, 14:08",
    recipient: { name: "Auto-Serwis Wojciechowski", street: "ul. Floriańska 17", postal: "31-019", city: "Kraków", voivodeship: "małopolskie" },
    cards: [{ type: "warsztatowa", qty: 4 }],
  },
  {
    id: "WN/2026/045597",
    doneAt: "06.05.2026, 12:55",
    recipient: { name: "Anna Wiśniewska", street: "ul. Półwiejska 38/4", postal: "61-888", city: "Poznań", voivodeship: "wielkopolskie" },
    cards: [{ type: "kierowcy", qty: 1 }],
  },
  {
    id: "WN/2026/045596",
    doneAt: "06.05.2026, 11:30",
    recipient: { name: "ITD Wrocław", street: "ul. Sucha 3", postal: "50-086", city: "Wrocław", voivodeship: "dolnośląskie" },
    cards: [{ type: "kontrolna", qty: 8 }],
  },
  {
    id: "WN/2026/045595",
    doneAt: "06.05.2026, 10:14",
    recipient: { name: "Logistyka Mazowsze S.A.", street: "Al. Jerozolimskie 181B", postal: "02-222", city: "Warszawa", voivodeship: "mazowieckie" },
    cards: [{ type: "przedsiebiorstwa", qty: 25 }, { type: "kierowcy", qty: 10 }, { type: "warsztatowa", qty: 3 }],
  },
  {
    id: "WN/2026/045594",
    doneAt: "05.05.2026, 17:48",
    recipient: { name: "Piotr Lewandowski", street: "ul. 3 Maja 12/8", postal: "40-097", city: "Katowice", voivodeship: "śląskie" },
    cards: [{ type: "kierowcy", qty: 1 }],
  },
  {
    id: "WN/2026/045593",
    doneAt: "05.05.2026, 16:09",
    recipient: { name: "Mech-Tech Bartosz Nowicki", street: "ul. Długa 41", postal: "31-147", city: "Kraków", voivodeship: "małopolskie" },
    cards: [{ type: "warsztatowa", qty: 3 }, { type: "kontrolna", qty: 1 }],
  },
  {
    id: "WN/2026/045592",
    doneAt: "05.05.2026, 14:42",
    recipient: { name: "Spedycja Bałtyk Sp. z o.o.", street: "ul. Heweliusza 11", postal: "60-279", city: "Gdańsk", voivodeship: "pomorskie" },
    cards: [{ type: "przedsiebiorstwa", qty: 18 }],
  },
  {
    id: "WN/2026/045591",
    doneAt: "05.05.2026, 13:15",
    recipient: { name: "Katarzyna Zielińska", street: "ul. Świdnicka 8c/22", postal: "50-067", city: "Wrocław", voivodeship: "dolnośląskie" },
    cards: [{ type: "kierowcy", qty: 1 }],
  },
  {
    id: "WN/2026/045590",
    doneAt: "05.05.2026, 11:51",
    recipient: { name: "GITD Mazowsze", street: "ul. Postępu 21", postal: "02-676", city: "Warszawa", voivodeship: "mazowieckie" },
    cards: [{ type: "kontrolna", qty: 6 }],
  },
  {
    id: "WN/2026/045589",
    doneAt: "04.05.2026, 18:03",
    recipient: { name: "Tomasz Kamiński", street: "ul. Mickiewicza 27/9", postal: "60-833", city: "Poznań", voivodeship: "wielkopolskie" },
    cards: [{ type: "kierowcy", qty: 2 }],
  },
  {
    id: "WN/2026/045588",
    doneAt: "04.05.2026, 15:27",
    recipient: { name: "Eurokar Naprawy Sp. z o.o.", street: "ul. Piotrkowska 88", postal: "41-902", city: "Bytom", voivodeship: "śląskie" },
    cards: [{ type: "warsztatowa", qty: 9 }, { type: "kontrolna", qty: 3 }],
  },
  {
    id: "WN/2026/045587",
    doneAt: "04.05.2026, 09:38",
    recipient: { name: "Cargo Małopolska Sp. z o.o.", street: "ul. Wielicka 254", postal: "30-663", city: "Kraków", voivodeship: "małopolskie" },
    cards: [{ type: "przedsiebiorstwa", qty: 14 }, { type: "kierowcy", qty: 5 }],
  },
  {
    id: "WN/2026/045586",
    doneAt: "04.05.2026, 08:15",
    recipient: { name: "Marek Zieliński", street: "ul. Chmielna 21/4", postal: "00-021", city: "Warszawa", voivodeship: "mazowieckie" },
    cards: [{ type: "kierowcy", qty: 1 }],
    reportId: "RAP/2026/00126",
    reportedAt: "06.05.2026, 08:42",
    reportedBy: "Anna Nowak",
  },
  {
    id: "WN/2026/045585",
    doneAt: "03.05.2026, 17:55",
    recipient: { name: "Logistyka Pomorze Sp. z o.o.", street: "ul. Grunwaldzka 412", postal: "80-309", city: "Gdańsk", voivodeship: "pomorskie" },
    cards: [{ type: "przedsiebiorstwa", qty: 8 }],
    reportId: "RAP/2026/00126",
    reportedAt: "06.05.2026, 08:42",
    reportedBy: "Anna Nowak",
  },
  {
    id: "WN/2026/045584",
    doneAt: "03.05.2026, 16:20",
    recipient: { name: "Maciej Wojtczak", street: "ul. Piękna 14", postal: "61-560", city: "Poznań", voivodeship: "wielkopolskie" },
    cards: [{ type: "warsztatowa", qty: 2 }],
    reportId: "RAP/2026/00125",
    reportedAt: "05.05.2026, 14:08",
    reportedBy: "Anna Nowak",
  },
];

const DISPATCH_TOTAL = 50;

/* ======================== SHARED UI ======================== */

function CardTypeBadge({ type }: { type: CardType }) {
  const s = CARD_TYPE_STYLE[type];
  return (
    <span className="inline-flex items-center" style={{ gap: 6 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: s.dot,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.05em",
          color: "#71717A",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {CARD_TYPE_SHORT[type]}
      </span>
    </span>
  );
}

/** Mini badge with count — chip z borderem jak w Figmie DS */
function CardTypeMini({ type, qty }: { type: CardType; qty: number }) {
  const s = CARD_TYPE_STYLE[type];
  const label = CARD_TYPE_SHORT[type].charAt(0) + CARD_TYPE_SHORT[type].slice(1).toLowerCase();
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 6,
        padding: "3px 9px",
        border: "1px solid #EDEDED",
        borderRadius: 6,
        backgroundColor: "#FFFFFF",
        whiteSpace: "nowrap",
        height: 24,
      }}
    >
      <span
        style={{
          width: 6, height: 6,
          borderRadius: "50%",
          backgroundColor: s.dot,
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 500, color: "#0A0A0A" }}>
        {label}
      </span>
      <span style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 11.5, fontWeight: 400, color: "#71717A",
      }}>
        ×{qty}
      </span>
    </span>
  );
}

function CardTypesBadgeList({ cards }: { cards: CardEntry[] }) {
  return (
    <div className="flex flex-wrap" style={{ gap: 6, maxWidth: 320 }}>
      {cards.map((c) => (
        <CardTypeMini key={c.type} type={c.type} qty={c.qty} />
      ))}
    </div>
  );
}

function QtyCell({ cards }: { cards: CardEntry[] }) {
  const total = cards.reduce((s, c) => s + c.qty, 0);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500, color: "#0A0A0A", fontSize: 14 }}>
      {total}
    </span>
  );
}

function ZamawiajacyCell({ orderer, rowId }: { orderer: OrdererType; rowId: string }) {
  const client = CLIENT_DATA[rowId];
  const initials = client?.clientName
    ? client.clientName.split(" ").map((w) => w[0]).slice(0, 1).join("").toUpperCase()
    : orderer === "fizyczna" ? "O" : "F";
  const isFirma = orderer === "firma";

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      <div
        style={{
          width: 28, height: 28, borderRadius: isFirma ? 6 : 14,
          backgroundColor: isFirma ? "#FAFAFA" : "#EEF2FF",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          border: isFirma ? "1px solid #EDEDED" : "none",
        }}
      >
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: isFirma ? "#71717A" : "#4F46E5",
        }}>
          {initials}
        </span>
      </div>
      {/* Nazwa + ID */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0A0A0A", whiteSpace: "nowrap" }}>
          {client?.clientName ?? (isFirma ? "Firma" : "Osoba fizyczna")}
        </span>
        {client?.clientMaskedId && (
          <div className="flex items-center gap-1" style={{ color: "#71717A", fontSize: 11.5 }}>
            <span style={{ fontWeight: 500, letterSpacing: "0.04em" }}>
              {client.clientIdType}
            </span>
            <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
              {client.clientMaskedId}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  // Format: "DD.MM.YYYY, HH:MM"
  const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2})/);
  if (!parts) return dateStr;
  const [, dd, mm, yyyy, hh, min] = parts;
  const date = new Date(+yyyy, +mm - 1, +dd, +hh, +min);
  const now = new Date("2026-05-07T10:00:00"); // symulowany "teraz" dla demo
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)   return "przed chwilą";
  if (diffMin < 60)  return `${diffMin} min temu`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)    return `${diffH} godz. temu`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} dni temu`;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg: Record<OrderStatus, { label: string; color: string }> = {
    "Nowe":        { label: "Nowe",        color: "#0A0A0A" },
    "W produkcji": { label: "W produkcji", color: "#0A0A0A" },
    "Zrobione":    { label: "Zrobione",    color: "#0A0A0A" },
    "Wycofane":    { label: "Wycofane",    color: "#71717A" },
  };
  const { label, color } = cfg[status];
  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 600,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Checkbox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const filled = checked || indeterminate;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      style={{
        boxSizing: "border-box",
        width: 16,
        height: 16,
        padding: 0,
        margin: 0,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 3,
        border: `1px solid ${disabled ? "#D1D5DB" : filled ? "#4F46E5" : "#D1D5DB"}`,
        backgroundColor: disabled ? "#EDEDED" : filled ? "#4F46E5" : "#FFFFFF",
        cursor: disabled ? "not-allowed" : "pointer",
        lineHeight: 0,
        verticalAlign: "middle",
        opacity: disabled ? 0.85 : 1,
        transition: "background-color 120ms, border-color 120ms",
      }}
      aria-checked={checked}
      role="checkbox"
    >
      {indeterminate ? (
        <span style={{ width: 8, height: 2, backgroundColor: "#FFFFFF", display: "block" }} />
      ) : checked ? (
        <Check size={12} color="#FFFFFF" strokeWidth={3} />
      ) : null}
    </button>
  );
}

function Radio({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        boxSizing: "border-box",
        width: 16,
        height: 16,
        flexShrink: 0,
        padding: 0,
        margin: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: `1px solid ${checked ? "#4F46E5" : "#D1D5DB"}`,
        backgroundColor: "#FFFFFF",
        cursor: "pointer",
        verticalAlign: "middle",
      }}
      aria-checked={checked}
      role="radio"
    >
      {checked ? (
        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4F46E5", display: "block" }} />
      ) : null}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          backgroundColor: checked ? "#4F46E5" : "#D1D5DB",
          position: "relative",
          cursor: "pointer",
          transition: "background-color 200ms",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            transition: "left 200ms",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </div>
      <span style={{ fontSize: 13, color: "#3F3F46", whiteSpace: "nowrap" }}>{label}</span>
    </label>
  );
}

function thStyle(align: "left" | "right" | "center"): React.CSSProperties {
  return {
    textAlign: align,
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 600,
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  };
}

function tdStyle(align: "left" | "right" | "center"): React.CSSProperties {
  return {
    textAlign: align,
    padding: "0 16px",
    verticalAlign: "middle",
    fontSize: 14,
  };
}

function SortableTh({ label, align = "left" }: { label: string; align?: "left" | "right" }) {
  return (
    <th style={thStyle(align)}>
      <button
        className="inline-flex items-center gap-1.5"
        style={{ color: "#71717A", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}
      >
        {label}
        <ArrowUpDown size={12} color="#A1A1AA" />
      </button>
    </th>
  );
}

function PageBtn({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center"
      style={{
        minWidth: 32,
        height: 32,
        padding: "0 8px",
        borderRadius: 4,
        border: active ? "1px solid #4F46E5" : "1px solid #D1D5DB",
        backgroundColor: active ? "#4F46E5" : "#FFFFFF",
        color: active ? "#FFFFFF" : disabled ? "#D1D5DB" : "#3F3F46",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon ?? label}
    </button>
  );
}

function FilterDropdown({
  open,
  setOpen,
  label,
  value,
  icon,
  children,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  label: string;
  value: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3"
        style={{
          height: 36,
          borderRadius: 4,
          border: "1px solid #D1D5DB",
          backgroundColor: "#FFFFFF",
          fontSize: 14,
          color: "#3F3F46",
        }}
      >
        {icon}
        <span style={{ color: "#71717A" }}>{label}:</span>
        <span style={{ color: "#0A0A0A", fontWeight: 500 }}>{value}</span>
        <ChevronDown size={16} color="#71717A" />
      </button>
      {open && (
        <div
          className="absolute left-0 mt-1 z-20"
          style={{
            minWidth: 220,
            backgroundColor: "#FFFFFF",
            border: "1px solid #EDEDED",
            borderRadius: 6,
            boxShadow: "0 8px 16px rgba(16,24,40,0.08)",
            padding: 4,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2"
      style={{
        fontSize: 14,
        borderRadius: 4,
        color: "#0A0A0A",
        backgroundColor: active ? "#EEF2FF" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "#FAFAFA";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

/* ======================== ROOT APP ======================== */

export default function App() {
  const [view, setView] = useState<View>("orders");

  const user =
    view === "orders"
      ? { name: "Jan Kowalski", role: "Operator SPKE", initials: "JK" }
      : view === "dispatch"
        ? { name: "Anna Nowak", role: "Operator Ekspedycji", initials: "AN" }
        : { name: "Małgorzata Mróz", role: "Biuro Finansów", initials: "MM" };



  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundColor: "#FFFFFF",
        color: "#0A0A0A",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 14,
      }}
    >
      <header
        className="w-full flex items-center justify-between px-8"
        style={{ height: 60, backgroundColor: "#FFFFFF", borderBottom: "1px solid #EDEDED" }}
      >
        <div className="flex items-center gap-6">
          <div
            className="flex items-center justify-center"
            style={{
              width: 44,
              height: 32,
              borderRadius: 6,
              backgroundColor: "#4F46E5",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 0.5,
            }}
          >
            SPKE
          </div>
          <nav className="flex items-center gap-1" style={{ fontSize: 13 }}>
            <ViewTab active={view === "orders"} icon={<ClipboardList size={14} />} onClick={() => setView("orders")}>
              Zamówienia
            </ViewTab>
            <ViewTab active={view === "dispatch"} icon={<Truck size={14} />} onClick={() => setView("dispatch")}>
              Ekspedycja
            </ViewTab>
            <ViewTab active={view === "finance"} icon={<CreditCard size={14} />} onClick={() => setView("finance")}>
              Biuro Finansów
            </ViewTab>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div style={{ fontSize: 13, color: "#0A0A0A" }}>{user.name}</div>
            <div style={{ fontSize: 12, color: "#71717A" }}>{user.role}</div>
          </div>
          <div
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "#4F46E5",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {user.initials}
          </div>
        </div>
      </header>

      {view === "orders" ? <OrdersView /> : view === "dispatch" ? <DispatchView /> : <FinanceView />}
    </div>
  );
}

function ViewTab({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3"
      style={{
        height: 32,
        borderRadius: 6,
        backgroundColor: active ? "#EEF2FF" : "transparent",
        color: active ? "#4F46E5" : "#3F3F46",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        border: "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "#F3F4F6";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ======================== ORDERS VIEW ======================== */

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ORDER_FILTER_CARD_OPTIONS: { value: "all" | CardType; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "kierowcy", label: "Karta kierowcy" },
  { value: "warsztatowa", label: "Karta warsztatowa" },
  { value: "przedsiebiorstwa", label: "Karta przedsiębiorstwa" },
  { value: "kontrolna", label: "Karta kontrolna" },
];

const ORDER_FILTER_ORDERER_OPTIONS: { value: "all" | OrdererType; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "fizyczna", label: "Osoba fizyczna" },
  { value: "firma", label: "Firma" },
];

function OrdersView() {
  const [orders, setOrders] = useState<OrderRow[]>(INITIAL_ORDERS);
  const [tab, setTab] = useState<"new" | "wip" | "done">("new");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | CardType>("all");
  const [filterOrderer, setFilterOrderer] = useState<"all" | OrdererType>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOrdererOpen, setFilterOrdererOpen] = useState(false);
  const [perPageOpen, setPerPageOpen] = useState(false);
  const [perPage, setPerPage] = useState(12);
  const [showWithdrawn, setShowWithdrawn] = useState(false);

  // Drawer state
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  // Confirmation modals
  const [confirmPobierz, setConfirmPobierz] = useState<string | null>(null); // orderId
  const [confirmWycofaj, setConfirmWycofaj] = useState<string | null>(null); // orderId

  const newOrders = useMemo(() => orders.filter((o) => o.status === "Nowe"), [orders]);
  const wipOrders = useMemo(() => orders.filter((o) => o.status === "W produkcji"), [orders]);
  const doneOrders = useMemo(() => orders.filter((o) => o.status === "Zrobione"), [orders]);
  const withdrawnOrders = useMemo(() => orders.filter((o) => o.status === "Wycofane"), [orders]);

  const rows = useMemo(() => {
    const statusMap = { new: "Nowe", wip: "W produkcji", done: "Zrobione" } as const;
    const activeStatus = statusMap[tab];

    let base = orders.filter((o) => o.status === activeStatus);

    if (showWithdrawn) {
      const tabWithdrawnFrom = tab === "new" ? "Nowe" : tab === "wip" ? "W produkcji" : null;
      if (tabWithdrawnFrom) {
        const withdrawn = withdrawnOrders.filter((o) => o.withdrawnFromStatus === tabWithdrawnFrom);
        base = [...base, ...withdrawn];
      }
    }

    return base.filter((o) => {
      if (filterType !== "all" && !o.cards.some((c) => c.type === filterType)) return false;
      if (filterOrderer !== "all" && o.orderer !== filterOrderer) return false;
      if (search && !o.id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tab, orders, search, filterType, filterOrderer, showWithdrawn, withdrawnOrders]);

  const markProduction = (ids: string[]) => {
    const stamp = nowStamp();
    const set = new Set(ids);
    setOrders((prev) =>
      prev.map((o) =>
        set.has(o.id) && o.status === "Nowe"
          ? ({ ...o, status: "W produkcji", takenAt: stamp, takenBy: "Jan Kowalski" } as OrderRow)
          : o,
      ),
    );
    setSelected(new Set());
  };

  const markDone = (ids: string[]) => {
    const stamp = nowStamp();
    const set = new Set(ids);
    setOrders((prev) =>
      prev.map((o) =>
        set.has(o.id) && o.status === "W produkcji"
          ? ({ ...o, status: "Zrobione", doneAt: stamp, doneBy: "Jan Kowalski" } as OrderRow)
          : o,
      ),
    );
    setSelected(new Set());
  };

  const markWithdrawn = (id: string, reason: string) => {
    const stamp = nowStamp();
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return {
          ...o,
          status: "Wycofane",
          withdrawnFromStatus: o.status as "Nowe" | "W produkcji",
          withdrawnAt: stamp,
          withdrawnBy: "Jan Kowalski",
          withdrawalReason: reason || undefined,
        } as OrderRow;
      }),
    );
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (drawerOrderId === id) setDrawerOrderId(null);
  };

  const activeRows = rows.filter((r) => r.status !== "Wycofane");
  const allSelected = activeRows.length > 0 && activeRows.every((r) => selected.has(r.id));
  const someSelected = activeRows.some((r) => selected.has(r.id));
  const selectedCount = selected.size;

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(activeRows.map((r) => r.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const switchTab = (t: "new" | "wip" | "done") => {
    setTab(t);
    clearSelection();
  };

  const tabCounts = { new: newOrders.length, wip: wipOrders.length, done: doneOrders.length };

  const openDrawer = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrawerOrderId(id);
  };

  return (
    <main className="px-8 py-8 mx-auto" style={{ maxWidth: 1400 }}>
      <div className="mb-6">
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#0A0A0A", margin: 0, lineHeight: 1.2 }}>Zamówienia</h1>
        <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>Zarządzanie zamówieniami kart tachografowych</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-7 mb-6" style={{ borderBottom: "1px solid #EDEDED" }}>
        {[
          { key: "new" as const, label: "Nowe", count: tabCounts.new },
          { key: "wip" as const, label: "W produkcji", count: tabCounts.wip },
          { key: "done" as const, label: "Zrobione", count: tabCounts.done },
        ].map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className="relative flex items-center gap-2"
              style={{
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                color: active ? "#0A0A0A" : "#71717A",
                borderBottom: active ? "1.5px solid #0A0A0A" : "1.5px solid transparent",
                marginBottom: -1,
                paddingTop: 4,
                paddingBottom: 14,
                background: "none",
                border: "none",
                borderBottomWidth: 1.5,
                borderBottomStyle: "solid",
                borderBottomColor: active ? "#0A0A0A" : "transparent",
                cursor: "pointer",
              }}
            >
              {t.label}
              <span
                style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 12,
                  fontWeight: 400,
                  color: active ? "#3F3F46" : "#A1A1AA",
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #EDEDED",
          borderRadius: 6,
          boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
        }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 gap-3 flex-wrap"
          style={{
            minHeight: 60,
            padding: "12px 16px",
            borderBottom: "1px solid #EDEDED",
            backgroundColor: selectedCount > 0 ? "#0A0A0A" : "#FFFFFF",
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            transition: "background-color 150ms ease",
          }}
        >
          {selectedCount > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 34, height: 28,
                    borderRadius: 3,
                    backgroundColor: "#FFFFFF",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#0A0A0A",
                    flexShrink: 0,
                  }}
                >
                  {selectedCount}
                </div>
                <span style={{ fontSize: 13.5, color: "#FFFFFF", fontWeight: 500 }}>
                  {tab === "new" ? "wniosków" : "zamówień"} zaznaczonych
                </span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>·</span>
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                  łącznie{" "}
                  {Array.from(selected).reduce((sum, id) => {
                    const row = orders.find((o) => o.id === id);
                    return sum + (row ? row.cards.reduce((s, c) => s + c.qty, 0) : 0);
                  }, 0)}{" "}
                  kart
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearSelection}
                  className="px-3"
                  style={{
                    height: 32,
                    borderRadius: 7,
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 13,
                    fontWeight: 500,
                    backgroundColor: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  Anuluj
                </button>
                {tab === "new" && (
                  <button
                    className="px-4 inline-flex items-center gap-2"
                    style={{
                      height: 32,
                      borderRadius: 7,
                      backgroundColor: "#4F46E5",
                      color: "#FFFFFF",
                      fontSize: 12.5,
                      fontWeight: 500,
                      border: "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
                    onClick={() => markProduction(Array.from(selected))}
                  >
                    Przekaż do produkcji
                  </button>
                )}
                {tab === "wip" && (
                  <button
                    className="px-4 inline-flex items-center gap-2"
                    style={{
                      height: 32,
                      borderRadius: 7,
                      backgroundColor: "#4F46E5",
                      color: "#FFFFFF",
                      fontSize: 12.5,
                      fontWeight: 500,
                      border: "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
                    onClick={() => markDone(Array.from(selected))}
                  >
                    Oznacz jako zrobione
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative" style={{ width: 320 }}>
                  <Search
                    size={14}
                    color="#A1A1AA"
                    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Szukaj po ID wniosku, NIP, PESEL…"
                    className="w-full outline-none"
                    style={{
                      height: 36,
                      paddingLeft: 34,
                      paddingRight: 52,
                      borderRadius: 9,
                      border: "1px solid #EDEDED",
                      fontSize: 13.5,
                      backgroundColor: "#FFFFFF",
                      color: "#0A0A0A",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#EDEDED")}
                  />
                  <span
                    style={{
                      position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                      fontSize: 11, color: "#A1A1AA", pointerEvents: "none",
                    }}
                  >
                    ⌘ K
                  </span>
                </div>
                <FilterDropdown
                  open={filterOpen}
                  setOpen={setFilterOpen}
                  label="Typ karty"
                  value={ORDER_FILTER_CARD_OPTIONS.find((o) => o.value === filterType)?.label ?? ""}
                >
                  {ORDER_FILTER_CARD_OPTIONS.map((o) => (
                    <DropdownItem
                      key={o.value}
                      active={filterType === o.value}
                      onClick={() => {
                        setFilterType(o.value);
                        setFilterOpen(false);
                      }}
                    >
                      {o.label}
                    </DropdownItem>
                  ))}
                </FilterDropdown>
                <FilterDropdown
                  open={filterOrdererOpen}
                  setOpen={setFilterOrdererOpen}
                  label="Zamawiający"
                  value={ORDER_FILTER_ORDERER_OPTIONS.find((o) => o.value === filterOrderer)?.label ?? ""}
                >
                  {ORDER_FILTER_ORDERER_OPTIONS.map((o) => (
                    <DropdownItem
                      key={o.value}
                      active={filterOrderer === o.value}
                      onClick={() => {
                        setFilterOrderer(o.value);
                        setFilterOrdererOpen(false);
                      }}
                    >
                      {o.label}
                    </DropdownItem>
                  ))}
                </FilterDropdown>
              </div>
              {tab !== "done" && (
                <Toggle checked={showWithdrawn} onChange={setShowWithdrawn} label="Pokaż wycofane" />
              )}
            </>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyOrders tab={tab} />
        ) : (
          <>
            <div>
              <table className="w-full" style={{ borderCollapse: "collapse", tableLayout: "auto" }}>
                <colgroup>
                  <col style={{ width: 50 }} />
                  <col style={{ width: 155 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 280 }} />
                  <col style={{ width: 260 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 190 }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: "#FAFAFA", borderBottom: "1px solid #EDEDED" }}>
                    <th style={thStyle("center")}>
                      <div className="flex items-center justify-center">
                        {tab !== "done" ? (
                          <Checkbox
                            checked={allSelected}
                            indeterminate={!allSelected && someSelected}
                            onChange={toggleAll}
                          />
                        ) : null}
                      </div>
                    </th>
                    <SortableTh label="ID wniosku" />
                    <SortableTh label="Data wpłynięcia" />
                    <th style={thStyle("left")}>Zamawiający</th>
                    <SortableTh label="Typ karty" />
                    <SortableTh label="Szt." align="right" />
                    <SortableTh label="Status" />
                    <th style={thStyle("right")}>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isSelected = selected.has(row.id);
                    const isWithdrawn = row.status === "Wycofane";
                    return (
                      <tr
                        key={row.id}
                        onClick={() => {
                          if (!isWithdrawn && tab !== "done") toggleRow(row.id);
                        }}
                        className={!isWithdrawn && tab !== "done" ? "cursor-pointer" : ""}
                        style={{
                          backgroundColor: isSelected
                            ? "#FAFAFF"
                            : isWithdrawn
                              ? "#FAFAFA"
                              : "#FFFFFF",
                          borderBottom: "1px solid #F3F3F3",
                          borderLeft: isSelected ? "2px solid #4F46E5" : "2px solid transparent",
                          transition: "background-color 120ms, border-left-color 120ms",
                          opacity: isWithdrawn ? 0.7 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected && !isWithdrawn) e.currentTarget.style.backgroundColor = "#FAFAFA";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = isWithdrawn ? "#FAFAFA" : "#FFFFFF";
                        }}
                      >
                        <td style={{ ...tdStyle("center"), height: 60 }}>
                          <div className="flex items-center justify-center">
                            {!isWithdrawn && tab !== "done" ? (
                              <Checkbox
                                checked={isSelected}
                                onChange={() => toggleRow(row.id)}
                              />
                            ) : null}
                          </div>
                        </td>
                        <td style={{ ...tdStyle("left"), height: 60 }}>
                          <span
    onClick={(e) => openDrawer(row.id, e)}
    style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13,
      color: '#0A0A0A',
      fontWeight: 500,
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
  >
    {row.id}
  </span>
                        </td>
                        <td style={{ ...tdStyle("left"), height: 60, padding: "0 24px" }}>
                          {(() => {
                            const parts = row.date.match(/^(\d{2}\.\d{2}\.\d{4}),?\s*(\d{2}:\d{2})$/);
                            const dateStr = parts ? parts[1] : row.date;
                            const timeStr = parts ? parts[2] : "";
                            return (
                              <div className="flex items-center" style={{ gap: 8, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 13, whiteSpace: "nowrap" }}>
                                <span style={{ color: "#0A0A0A" }}>{dateStr}</span>
                                {timeStr && <span style={{ color: "#71717A" }}>{timeStr}</span>}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ ...tdStyle("left"), height: 60 }}>
                          <ZamawiajacyCell orderer={row.orderer} rowId={row.id} />
                        </td>
                        <td style={{ padding: "0 24px", verticalAlign: "middle", height: 60, whiteSpace: "nowrap" }}>
                          <CardTypesBadgeList cards={row.cards} />
                        </td>
                        <td style={{ ...tdStyle("right"), height: 60 }}>
                          <QtyCell cards={row.cards} />
                        </td>
                        <td style={{ ...tdStyle("left"), height: 60 }}>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={row.status} />
                            <span style={{ fontSize: 12.5, color: "#71717A" }}>
                              {relativeTime(
                                row.status === "W produkcji" ? row.takenAt :
                                row.status === "Zrobione" ? row.doneAt :
                                row.status === "Wycofane" ? row.withdrawnAt :
                                row.date
                              )}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle("right"), height: 60 }}>
                          {!isWithdrawn && (
                            <div className="flex items-center justify-end gap-1">
                              {tab === "new" && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmPobierz(row.id);
                                    }}
                                    className="inline-flex items-center px-2.5"
                                    style={{
                                      height: 30,
                                      borderRadius: 6,
                                      backgroundColor: "transparent",
                                      color: "#4F46E5",
                                      fontSize: 12,
                                      fontWeight: 500,
                                      border: "1px solid transparent",
                                      whiteSpace: "nowrap",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#EEF2FF")}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                  >
                                    Pobierz
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmWycofaj(row.id);
                                    }}
                                    className="inline-flex items-center px-2.5"
                                    style={{
                                      height: 30,
                                      borderRadius: 6,
                                      backgroundColor: "transparent",
                                      color: "#71717A",
                                      fontSize: 12,
                                      fontWeight: 500,
                                      border: "1px solid transparent",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F3F3")}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                  >
                                    Wycofaj
                                  </button>
                                </>
                              )}
                              {tab === "wip" && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markDone([row.id]);
                                    }}
                                    className="inline-flex items-center px-2.5"
                                    style={{
                                      height: 30,
                                      borderRadius: 6,
                                      backgroundColor: "transparent",
                                      color: "#047857",
                                      fontSize: 12,
                                      fontWeight: 500,
                                      border: "1px solid transparent",
                                      whiteSpace: "nowrap",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ECFDF5")}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                  >
                                    Zrobione
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmWycofaj(row.id);
                                    }}
                                    className="inline-flex items-center px-2.5"
                                    style={{
                                      height: 30,
                                      borderRadius: 6,
                                      backgroundColor: "transparent",
                                      color: "#71717A",
                                      fontSize: 12,
                                      fontWeight: 500,
                                      border: "1px solid transparent",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F3F3")}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                  >
                                    Wycofaj
                                  </button>
                                </>
                              )}
                              {tab === "done" && (
                                <button
                                  onClick={(e) => openDrawer(row.id, e)}
                                  className="inline-flex items-center px-2.5"
                                  style={{
                                    height: 30,
                                    borderRadius: 6,
                                    backgroundColor: "transparent",
                                    color: "#4F46E5",
                                    fontSize: 12,
                                    fontWeight: 500,
                                    border: "1px solid transparent",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#EEF2FF")}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  Szczegóły
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              className="flex items-center justify-between px-4"
              style={{
                height: 56,
                borderTop: "1px solid #EDEDED",
                backgroundColor: "#FFFFFF",
                borderBottomLeftRadius: 6,
                borderBottomRightRadius: 6,
              }}
            >
              <div style={{ fontSize: 13, color: "#71717A" }}>
                Wyświetlono 1–{rows.length} z{" "}
                {tab === "new" ? tabCounts.new : tab === "wip" ? tabCounts.wip : tabCounts.done}
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <button
                    onClick={() => setPerPageOpen((v) => !v)}
                    className="inline-flex items-center gap-2 px-3"
                    style={{
                      height: 32,
                      borderRadius: 4,
                      border: "1px solid #D1D5DB",
                      backgroundColor: "#FFFFFF",
                      fontSize: 13,
                      color: "#3F3F46",
                    }}
                  >
                    <span style={{ color: "#71717A" }}>Wierszy na stronę:</span>
                    <span style={{ fontWeight: 500 }}>{perPage}</span>
                    <ChevronDown size={14} color="#71717A" />
                  </button>
                  {perPageOpen && (
                    <div
                      className="absolute right-0 bottom-full mb-1 z-20"
                      style={{
                        minWidth: 80,
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #EDEDED",
                        borderRadius: 6,
                        boxShadow: "0 8px 16px rgba(16,24,40,0.08)",
                        padding: 4,
                      }}
                    >
                      {[12, 24, 48].map((n) => (
                        <button
                          key={n}
                          onClick={() => {
                            setPerPage(n);
                            setPerPageOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5"
                          style={{
                            fontSize: 13,
                            borderRadius: 4,
                            color: "#0A0A0A",
                            backgroundColor: perPage === n ? "#EEF2FF" : "transparent",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <PageBtn icon={<ChevronLeft size={14} />} disabled />
                  <PageBtn label="1" active />
                  <PageBtn label="2" />
                  <PageBtn icon={<ChevronRight size={14} />} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Order Detail Drawer */}
      {drawerOrderId && (
        <OrderDrawer
          orderId={drawerOrderId}
          orders={orders}
          onClose={() => setDrawerOrderId(null)}
          onMarkProduction={(id) => setConfirmPobierz(id)}
          onMarkDone={(id) => markDone([id])}
          onWithdraw={(id) => setConfirmWycofaj(id)}
        />
      )}

      {/* Confirmation: Pobierz do produkcji */}
      {confirmPobierz && (
        <ConfirmPobierzModal
          orderId={confirmPobierz}
          onConfirm={() => {
            markProduction([confirmPobierz]);
            setConfirmPobierz(null);
          }}
          onCancel={() => setConfirmPobierz(null)}
        />
      )}

      {/* Confirmation: Wycofaj */}
      {confirmWycofaj && (
        <ConfirmWycofajModal
          orderId={confirmWycofaj}
          onConfirm={(reason) => {
            markWithdrawn(confirmWycofaj, reason);
            setConfirmWycofaj(null);
          }}
          onCancel={() => setConfirmWycofaj(null)}
        />
      )}
    </main>
  );
}

function EmptyOrders({ tab }: { tab: "new" | "wip" | "done" }) {
  const messages = {
    new: { title: "Brak nowych zamówień", sub: "Nowe wnioski z systemu POKE pojawią się tutaj." },
    wip: { title: "Brak zamówień w produkcji", sub: "Pobierz zamówienia do produkcji z zakładki Nowe." },
    done: { title: "Brak zrealizowanych zamówień", sub: "Oznaczone zamówienia pojawią się tutaj." },
  };
  const msg = messages[tab];
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: "80px 24px" }}>
      <div
        className="flex items-center justify-center mb-4"
        style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#F3F4F6", color: "#A1A1AA" }}
      >
        <Inbox size={32} strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>{msg.title}</h3>
      <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>{msg.sub}</p>
    </div>
  );
}

/* ======================== ORDER DRAWER ======================== */

function OrderDrawer({
  orderId,
  orders,
  onClose,
  onMarkProduction,
  onMarkDone,
  onWithdraw,
}: {
  orderId: string;
  orders: OrderRow[];
  onClose: () => void;
  onMarkProduction: (id: string) => void;
  onMarkDone: (id: string) => void;
  onWithdraw: (id: string) => void;
}) {
  const order = orders.find((o) => o.id === orderId);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  if (!order) return null;

  const totalQty = order.cards.reduce((s, c) => s + c.qty, 0);

  // Timeline steps
  type TStep = { label: string; time?: string; operator?: string; state: "done" | "current" | "future" | "withdrawn" };
  const steps: TStep[] = [
    {
      label: "Wpłynęło z POKE",
      time: order.date,
      operator: "Info-Car (system)",
      state: "done",
    },
    {
      label: "Pobrane do produkcji",
      time: order.takenAt,
      operator: order.takenBy,
      state:
        order.status === "Nowe"
          ? "future"
          : "done",
    },
    {
      label: "W produkcji",
      time: undefined,
      state:
        order.status === "Nowe"
          ? "future"
          : order.status === "W produkcji"
            ? "current"
            : "done",
    },
    {
      label: "Zrobione",
      time: order.doneAt,
      operator: order.doneBy,
      state:
        order.status === "Zrobione"
          ? "done"
          : "future",
    },
  ];

  if (order.status === "Wycofane") {
    // Find where withdrawal happened
    const lastDoneIdx = order.takenAt ? 1 : 0;
    steps.forEach((s, i) => {
      if (i <= lastDoneIdx) s.state = "done";
      else s.state = "future";
    });
    steps.push({
      label: "Wycofane",
      time: order.withdrawnAt,
      operator: order.withdrawnBy,
      state: "withdrawn",
    });
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
      className="fixed inset-0 z-40"
      style={{
        backgroundColor: visible ? "rgba(17, 24, 39, 0.35)" : "rgba(17, 24, 39, 0)",
        transition: "background-color 250ms ease",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          backgroundColor: "#FFFFFF",
          boxShadow: "-4px 0 24px rgba(16, 24, 40, 0.12)",
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 250ms ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #EDEDED",
            flexShrink: 0,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#0A0A0A",
                  margin: 0,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  letterSpacing: -0.3,
                }}
              >
                Wniosek {order.id}
              </h2>
              <p style={{ fontSize: 12, color: "#71717A", marginTop: 4, marginBottom: 8 }}>
                Złożony {order.date} przez Info-Car
              </p>
              <StatusBadge status={order.status} />
            </div>
            <button
              onClick={handleClose}
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: "none",
                backgroundColor: "transparent",
                color: "#71717A",
                cursor: "pointer",
                marginTop: 2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 24px",
          }}
        >
          {/* Section 1: Zamówienie */}
          <DrawerSection title="Zamówienie">
            <div className="flex items-center gap-2 mb-3">
              <ZamawiajacyCell orderer={order.orderer} rowId={order.id} />
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#71717A",
                textTransform: "uppercase",
                letterSpacing: 0.4,
                marginBottom: 8,
              }}
            >
              Zamówione karty
            </div>
            <div className="flex flex-col gap-2">
              {order.cards.map((c) => {
                const s = CARD_TYPE_STYLE[c.type];
                return (
                  <div key={c.type} className="flex items-center justify-between" style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #F3F4F6", backgroundColor: "#FAFAFA" }}>
                    <div className="flex items-center" style={{ gap: 8 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: s.dot,
                          flexShrink: 0,
                          display: "inline-block",
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: "0.05em",
                          color: "#71717A",
                          textTransform: "uppercase",
                        }}
                      >
                        {CARD_TYPE_SHORT[c.type]}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, color: "#3F3F46", fontWeight: 500 }}>×{c.qty} szt.</span>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid #F3F4F6",
                fontSize: 14,
                fontWeight: 600,
                color: "#0A0A0A",
              }}
            >
              Razem: {totalQty} {totalQty === 1 ? "sztuka" : totalQty < 5 ? "sztuki" : "sztuk"}
            </div>
          </DrawerSection>

          {/* Section 2: Status produkcji (timeline) */}
          <DrawerSection title="Status produkcji">
            <div className="flex flex-col" style={{ gap: 0 }}>
              {steps.map((step, idx) => {
                const isLast = idx === steps.length - 1;
                return (
                  <div key={step.label} className="flex gap-3" style={{ position: "relative" }}>
                    {/* Line */}
                    {!isLast && (
                      <div
                        style={{
                          position: "absolute",
                          left: 11,
                          top: 22,
                          bottom: -4,
                          width: 2,
                          backgroundColor: step.state === "done" ? "#A7F3D0" : "#EDEDED",
                          zIndex: 0,
                        }}
                      />
                    )}
                    {/* Icon */}
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1,
                        marginTop: 2,
                        backgroundColor:
                          step.state === "done"
                            ? "#ECFDF5"
                            : step.state === "current"
                              ? "#EEF2FF"
                              : step.state === "withdrawn"
                                ? "#FEF2F2"
                                : "#F3F4F6",
                        border:
                          step.state === "done"
                            ? "1.5px solid #6EE7B7"
                            : step.state === "current"
                              ? "2px solid #4F46E5"
                              : step.state === "withdrawn"
                                ? "1.5px solid #FECACA"
                                : "1.5px solid #EDEDED",
                      }}
                    >
                      {step.state === "done" && (
                        <Check size={12} color="#047857" strokeWidth={2.5} />
                      )}
                      {step.state === "current" && (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4F46E5" }} />
                      )}
                      {step.state === "future" && (
                        <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#D1D5DB" }} />
                      )}
                      {step.state === "withdrawn" && (
                        <X size={11} color="#B91C1C" strokeWidth={2.5} />
                      )}
                    </div>
                    {/* Content */}
                    <div style={{ paddingBottom: isLast ? 0 : 18, paddingTop: 2 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: step.state === "current" ? 600 : 500,
                          color:
                            step.state === "done"
                              ? "#0A0A0A"
                              : step.state === "current"
                                ? "#4F46E5"
                                : step.state === "withdrawn"
                                  ? "#B91C1C"
                                  : "#A1A1AA",
                        }}
                      >
                        {step.label}
                      </div>
                      {step.time ? (
                        <div style={{ fontSize: 12, color: "#71717A", marginTop: 2 }}>
                          {step.time}
                          {step.operator && (
                            <span style={{ color: "#A1A1AA" }}> · {step.operator}</span>
                          )}
                        </div>
                      ) : step.state !== "future" ? (
                        <div style={{ fontSize: 12, color: "#A1A1AA", marginTop: 2 }}>—</div>
                      ) : null}
                      {step.state === "withdrawn" && order.withdrawalReason && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: "#B91C1C",
                            backgroundColor: "#FEF2F2",
                            border: "1px solid #FECACA",
                            borderRadius: 4,
                            padding: "4px 8px",
                          }}
                        >
                          Powód: {order.withdrawalReason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DrawerSection>

          {/* Section 3: Historia operacji */}
          <DrawerSection title="Historia operacji" last>
            <div className="flex flex-col gap-2">
              <AuditEntry time={order.date} action="Wpłynęło z POKE" actor="system" />
              {order.takenAt && (
                <AuditEntry time={order.takenAt} action="Pobrane do produkcji" actor={order.takenBy ?? "—"} />
              )}
              {order.doneAt && (
                <AuditEntry time={order.doneAt} action="Oznaczono jako zrobione" actor={order.doneBy ?? "—"} />
              )}
              {order.withdrawnAt && (
                <AuditEntry
                  time={order.withdrawnAt}
                  action={`Wycofane${order.withdrawalReason ? `: „${order.withdrawalReason}"` : ""}`}
                  actor={order.withdrawnBy ?? "—"}
                  isWithdrawal
                />
              )}
            </div>
          </DrawerSection>
        </div>

        {/* Footer */}
        {(order.status === "Nowe" || order.status === "W produkcji") && (
          <div
            className="flex items-center justify-end gap-2"
            style={{
              padding: "14px 24px",
              borderTop: "1px solid #EDEDED",
              backgroundColor: "#FAFAFA",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => {
                handleClose();
                setTimeout(() => onWithdraw(order.id), 260);
              }}
              className="px-4 inline-flex items-center"
              style={{
                height: 36,
                borderRadius: 6,
                border: "1px solid #EDEDED",
                backgroundColor: "transparent",
                color: "#71717A",
                fontSize: 14,
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F3F3")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              Wycofaj
            </button>
            {order.status === "Nowe" && (
              <button
                onClick={() => {
                  handleClose();
                  setTimeout(() => onMarkProduction(order.id), 260);
                }}
                className="px-4 inline-flex items-center"
                style={{
                  height: 36,
                  borderRadius: 6,
                  backgroundColor: "#4F46E5",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 500,
                  border: "1px solid #4F46E5",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
              >
                Pobierz do produkcji
              </button>
            )}
            {order.status === "W produkcji" && (
              <button
                onClick={() => {
                  onMarkDone(order.id);
                  handleClose();
                }}
                className="px-4 inline-flex items-center"
                style={{
                  height: 36,
                  borderRadius: 6,
                  backgroundColor: "#4F46E5",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 500,
                  border: "1px solid #4F46E5",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
              >
                Oznacz jako zrobione
              </button>
            )}
          </div>
        )}
        {(order.status === "Zrobione" || order.status === "Wycofane") && (
          <div
            className="flex items-center justify-end"
            style={{
              padding: "14px 24px",
              borderTop: "1px solid #EDEDED",
              backgroundColor: "#FAFAFA",
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleClose}
              className="px-4"
              style={{
                height: 36,
                borderRadius: 6,
                border: "1px solid #D1D5DB",
                backgroundColor: "#FFFFFF",
                color: "#3F3F46",
                fontSize: 14,
                fontWeight: 500,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
            >
              Zamknij
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DrawerSection({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "20px 0",
        borderBottom: last ? "none" : "1px solid #EDEDED",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#71717A",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function AuditEntry({
  time,
  action,
  actor,
  isWithdrawal,
}: {
  time: string;
  action: string;
  actor: string;
  isWithdrawal?: boolean;
}) {
  return (
    <div
      className="flex gap-3"
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        backgroundColor: isWithdrawal ? "#FEF2F2" : "#FAFAFA",
        border: `1px solid ${isWithdrawal ? "#FECACA" : "#F3F4F6"}`,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        {isWithdrawal ? (
          <XCircle size={13} color="#B91C1C" />
        ) : (
          <CheckCircle2 size={13} color="#047857" />
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, color: isWithdrawal ? "#B91C1C" : "#0A0A0A", fontWeight: 500 }}>
          {action}
        </div>
        <div style={{ fontSize: 12, color: "#A1A1AA", marginTop: 2 }}>
          {time} · {actor}
        </div>
      </div>
    </div>
  );
}

/* ======================== CONFIRM MODALS ======================== */

function ConfirmPobierzModal({
  orderId,
  onConfirm,
  onCancel,
}: {
  orderId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(17, 24, 39, 0.45)", padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 420,
          maxWidth: "100%",
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          boxShadow: "0 20px 40px rgba(16,24,40,0.18)",
          border: "1px solid #EDEDED",
        }}
      >
        <div style={{ padding: "24px 24px 20px" }}>
          <div
            className="flex items-center justify-center mb-4"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: "#EEF2FF",
              margin: "0 auto 16px",
            }}
          >
            <Clock size={22} color="#4F46E5" />
          </div>
          <h3
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: "#0A0A0A",
              margin: "0 0 8px",
              textAlign: "center",
            }}
          >
            Pobierz do produkcji
          </h3>
          <p style={{ fontSize: 14, color: "#71717A", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
            Czy na pewno chcesz pobrać wniosek{" "}
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                color: "#0A0A0A",
                fontWeight: 500,
              }}
            >
              {orderId}
            </span>{" "}
            do produkcji?
          </p>
        </div>
        <div
          className="flex items-center justify-center gap-3"
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #EDEDED",
          }}
        >
          <button
            onClick={onCancel}
            className="px-5"
            style={{
              height: 38,
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              backgroundColor: "#FFFFFF",
              color: "#3F3F46",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            className="px-5 inline-flex items-center gap-2"
            style={{
              height: 38,
              borderRadius: 6,
              backgroundColor: "#4F46E5",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 500,
              border: "1px solid #4F46E5",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
          >
            <Clock size={15} />
            Pobierz do produkcji
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmWycofajModal({
  orderId,
  onConfirm,
  onCancel,
}: {
  orderId: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(17, 24, 39, 0.45)", padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 440,
          maxWidth: "100%",
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          boxShadow: "0 20px 40px rgba(16,24,40,0.18)",
          border: "1px solid #EDEDED",
        }}
      >
        <div style={{ padding: "24px 24px 20px" }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: "#FEF2F2",
              margin: "0 auto 16px",
            }}
          >
            <AlertTriangle size={22} color="#B91C1C" />
          </div>
          <h3
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: "#0A0A0A",
              margin: "0 0 8px",
              textAlign: "center",
            }}
          >
            Wycofaj wniosek
          </h3>
          <p style={{ fontSize: 14, color: "#71717A", margin: "0 0 16px", textAlign: "center", lineHeight: 1.5 }}>
            Czy na pewno chcesz wycofać wniosek{" "}
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                color: "#0A0A0A",
                fontWeight: 500,
              }}
            >
              {orderId}
            </span>
            ? Tej operacji nie można cofnąć.
          </p>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#3F3F46", display: "block", marginBottom: 6 }}>
              Powód wycofania{" "}
              <span style={{ color: "#A1A1AA", fontWeight: 400 }}>(opcjonalnie)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Opisz powód wycofania wniosku..."
              className="w-full outline-none resize-none"
              rows={3}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #D1D5DB",
                fontSize: 14,
                color: "#0A0A0A",
                backgroundColor: "#FFFFFF",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
            />
          </div>
        </div>
        <div
          className="flex items-center justify-center gap-3"
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #EDEDED",
          }}
        >
          <button
            onClick={onCancel}
            className="px-5"
            style={{
              height: 38,
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              backgroundColor: "#FFFFFF",
              color: "#3F3F46",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
          >
            Anuluj
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="px-5 inline-flex items-center gap-2"
            style={{
              height: 38,
              borderRadius: 6,
              backgroundColor: "#B91C1C",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 500,
              border: "1px solid #B91C1C",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#991B1B")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#B91C1C")}
          >
            <XCircle size={15} />
            Wycofaj wniosek
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======================== DISPATCH VIEW ======================== */

const DATE_RANGE_OPTIONS = [
  "Dzisiaj",
  "Ostatnie 7 dni",
  "Ostatnie 30 dni",
  "Ten miesiąc",
  "Zakres niestandardowy...",
];

const DISPATCH_FILTER_OPTIONS: { value: "all" | CardType; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "kierowcy", label: "Karta kierowcy" },
  { value: "warsztatowa", label: "Karta warsztatowa" },
  { value: "przedsiebiorstwa", label: "Karta przedsiębiorstwa" },
  { value: "kontrolna", label: "Karta kontrolna" },
];

/* ======================== FINANCE VIEW ======================== */

function formatPLN(amount: number): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(amount);
}

function FinanceStatusBadge({ status }: { status: "zrealizowane" | "wycofane" }) {
  if (status === "zrealizowane") {
    return (
      <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717A" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#10B981", flexShrink: 0 }} />
        Zrealizowane
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "#B45309" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#F59E0B", flexShrink: 0 }} />
      Do zwrotu
    </span>
  );
}

function FinanceView() {
  const [tab, setTab] = useState<FinanceTab>("pending");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<FinanceRow[]>(FINANCE_ORDERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [reportModal, setReportModal] = useState<null | { mode: "selected" | "all" }>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 5;

  const pendingRows = useMemo(() =>
    orders.filter((o) => {
      if (o.reportId) return false;
      if (o.status !== "zrealizowane") return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.id.toLowerCase().includes(q) && !o.clientName.toLowerCase().includes(q) && !o.paymentId.toLowerCase().includes(q)) return false;
      }
      return true;
    }), [orders, search]);

  const refundRows = useMemo(() =>
    orders.filter((o) => {
      if (o.reportId) return false;
      if (o.status !== "wycofane") return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.id.toLowerCase().includes(q) && !o.clientName.toLowerCase().includes(q) && !o.paymentId.toLowerCase().includes(q)) return false;
      }
      return true;
    }), [orders, search]);

  const historyRows = useMemo(() =>
    orders.filter((o) => !!o.reportId), [orders]);

  const activeRows = tab === "pending" ? pendingRows : tab === "refunds" ? refundRows : historyRows;
  const totalPages = Math.ceil(activeRows.length / PER_PAGE);
  const pagedRows = activeRows.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const selectableRows = activeRows.filter((r) => !r.reportId);
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.id));
  const selectedCount = selected.size;

  const toggleRow = (id: string) => {
    const row = orders.find((o) => o.id === id);
    if (row?.reportId) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableRows.map((r) => r.id)));
  };

  const markAsReported = (ids: string[]) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const stamp = `${dd}.${mm}.${yyyy}, ${hh}:${min}`;
    const existing = orders.map((o) => o.reportId).filter((id): id is string => !!id)
      .map((id) => parseInt(id.split("/")[2] || "0", 10));
    const nextNum = (existing.length ? Math.max(...existing) : 40) + 1;
    const reportId = `RAP-BF/2026/${String(nextNum).padStart(5, "0")}`;
    setOrders((prev) => prev.map((o) => ids.includes(o.id) ? { ...o, reportId, reportedAt: stamp } : o));
    setSelected(new Set());
    return reportId;
  };

  const totalAmount = activeRows.reduce((sum, r) => sum + r.amount, 0);
  const selectedAmount = Array.from(selected).reduce((sum, id) => {
    const row = orders.find((o) => o.id === id);
    return sum + (row?.amount ?? 0);
  }, 0);

  const thStyle = (align: "left" | "right" | "center" = "left"): React.CSSProperties => ({
    padding: "10px 16px",
    textAlign: align,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#71717A",
    borderBottom: "1px solid #EDEDED",
    whiteSpace: "nowrap",
  });

  const tdStyle = (align: "left" | "right" | "center" = "left"): React.CSSProperties => ({
    padding: "0 16px",
    textAlign: align,
    verticalAlign: "middle",
    fontSize: 13,
    color: "#0A0A0A",
  });

  return (
    <main className="px-8 py-8 mx-auto" style={{ maxWidth: 1400, paddingBottom: 48 }}>
      <div className="mb-6">
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#0A0A0A", margin: 0, lineHeight: 1.2 }}>
          Biuro Finansów
        </h1>
        <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
          Rozliczenia płatności i zwrotów za zamówienia kart tachografowych
        </p>
      </div>

      {/* Zakładki */}
      <div style={{ borderBottom: "1px solid #EDEDED", marginBottom: 24 }}>
        <div className="flex items-center gap-1">
          {(
            [
              { key: "pending", label: "Do rozliczenia", count: pendingRows.length, icon: <CheckCircle2 size={13} /> },
              { key: "refunds", label: "Zwroty", count: refundRows.length, icon: <RotateCcw size={13} /> },
              { key: "history", label: "Historia", count: historyRows.length, icon: <Clock size={13} /> },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected(new Set()); setCurrentPage(1); }}
              className="inline-flex items-center gap-2 px-4"
              style={{
                height: 40,
                fontSize: 13,
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? "#0A0A0A" : "#71717A",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: tab === t.key ? "2px solid #0A0A0A" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: -1,
                gap: 6,
              }}
            >
              {t.label}
              <span
                style={{
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 12,
                  fontWeight: 400,
                  color: tab === t.key ? "#3F3F46" : "#A1A1AA",
                }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar + Tabela — jeden kontener */}
      <div style={{ borderRadius: 12, border: "1px solid #EDEDED", overflow: "hidden" }}>
        {/* Toolbar */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: selectedCount > 0 ? "8px 8px 8px 16px" : "12px 16px",
            backgroundColor: selectedCount > 0 ? "#0A0A0A" : "#FFFFFF",
            borderBottom: "1px solid #EDEDED",
            transition: "background-color 150ms ease",
          }}
        >
        {selectedCount > 0 && tab !== "history" ? (
          <>
            <div className="flex items-center gap-3">
              <div style={{
                width: 34, height: 28, borderRadius: 3,
                backgroundColor: "#FFFFFF",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#0A0A0A", flexShrink: 0,
              }}>
                {selectedCount}
              </div>
              <span style={{ fontSize: 13.5, color: "#FFFFFF", fontWeight: 500 }}>
                pozycji zaznaczonych
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>·</span>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                {formatPLN(selectedAmount)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelected(new Set())}
                style={{
                  height: 32, padding: "0 12px", borderRadius: 7,
                  color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500,
                  backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Anuluj
              </button>
              <button
                onClick={() => setReportModal({ mode: "selected" })}
                className="inline-flex items-center gap-2"
                style={{
                  height: 32, padding: "0 14px", borderRadius: 7,
                  backgroundColor: "#4F46E5", color: "#FFFFFF",
                  fontSize: 12.5, fontWeight: 500, border: "none", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
              >
                <Download size={14} />
                Pobierz raport ({selectedCount})
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="relative" style={{ width: 300 }}>
                <Search size={14} color="#A1A1AA" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Szukaj po ID, kliencie lub ID płatności..."
                  className="w-full outline-none"
                  style={{
                    height: 36, paddingLeft: 32, paddingRight: 12,
                    borderRadius: 9, border: "1px solid #EDEDED",
                    fontSize: 13.5, backgroundColor: "#FFFFFF", color: "#0A0A0A",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#EDEDED")}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
            </div>
          </>
        )}
      </div>

        {/* Tabela */}
        {activeRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ padding: "80px 24px" }}>
            <div className="flex items-center justify-center mb-4" style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#F3F4F6", color: "#A1A1AA" }}>
              {tab === "refunds" ? <RotateCcw size={32} strokeWidth={1.5} /> : <Inbox size={32} strokeWidth={1.5} />}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>
              {tab === "pending" ? "Brak zamówień do rozliczenia" : tab === "refunds" ? "Brak zwrotów do obsłużenia" : "Brak historii raportów"}
            </h3>
            <p style={{ fontSize: 14, color: "#71717A", marginTop: 6, maxWidth: 380 }}>
              {tab === "pending"
                ? "Zamówienia pojawią się tutaj gdy zostaną zrealizowane i opłacone."
                : tab === "refunds"
                  ? "Zwroty pojawią się tutaj gdy opłacone zamówienia zostaną wycofane."
                  : "Wygenerowane raporty pojawią się tutaj."}
            </p>
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: "collapse", tableLayout: "auto" }}>
            <colgroup>
              {tab !== "history" && <col style={{ width: 40 }} />}
              <col style={{ width: 155 }} />
              <col style={{ width: 165 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 180 }} />
              {tab === "history" && <col style={{ width: 175 }} />}
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: "#FAFAFA" }}>
                {tab !== "history" && (
                  <th style={thStyle("center")}>
                    <div className="flex items-center justify-center">
                      <Checkbox checked={allSelected} indeterminate={!allSelected && selectedCount > 0} onChange={toggleAll} />
                    </div>
                  </th>
                )}
                <th style={thStyle()}>ID Zamówienia</th>
                <th style={thStyle()}>ID Płatności</th>
                <th style={thStyle()}>Data płatności</th>
                <th style={thStyle("right")}>Kwota</th>
                <th style={thStyle()}>Klient</th>
                <th style={thStyle()}>Typ karty</th>
                <th style={thStyle()}>Status / Data</th>
                {tab === "history" && <th style={thStyle()}>Raport</th>}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => {
                const isSelected = selected.has(row.id);
                const isReported = !!row.reportId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => tab !== "history" && toggleRow(row.id)}
                    style={{
                      height: 64,
                      backgroundColor: isSelected ? "#FAFAFF" : isReported ? "#FAFAFA" : "#FFFFFF",
                      borderBottom: "1px solid #F3F3F3",
                      transition: "background-color 120ms",
                      cursor: tab !== "history" ? "pointer" : "default",
                      opacity: isReported ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !isReported && tab !== "history") e.currentTarget.style.backgroundColor = "#FAFAFA";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = isReported ? "#FAFAFA" : "#FFFFFF";
                    }}
                  >
                    {tab !== "history" && (
                      <td style={tdStyle("center")}>
                        <div className="flex items-center justify-center">
                          <Checkbox checked={isSelected} disabled={isReported} onChange={() => toggleRow(row.id)} />
                        </div>
                      </td>
                    )}
                    <td style={tdStyle()}>
                      <span style={{
                        fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 13, color: "#0A0A0A", fontWeight: 500,
                      }}>
                        {row.id}
                      </span>
                    </td>
                    <td style={tdStyle()}>
                      <span style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                        fontSize: 12, color: "#71717A",
                      }}>
                        {row.paymentId}
                        {/* TODO: confirm format z POKE/Info-Car */}
                      </span>
                    </td>
                    <td style={tdStyle()}>
                      <span style={{ fontSize: 13, color: "#3F3F46" }}>{row.paymentDate}</span>
                    </td>
                    <td style={tdStyle("right")}>
                      <span style={{
                        fontSize: 14, fontWeight: 600,
                        color: row.status === "wycofane" ? "#B45309" : "#0A0A0A",
                      }}>
                        {formatPLN(row.amount)}
                      </span>
                    </td>
                    <td style={tdStyle()}>
                      <div style={{ lineHeight: 1.35 }}>
                        <div className="flex items-center gap-1.5">
                          {row.ordererType === "firma"
                            ? <Building2 size={12} color="#A1A1AA" />
                            : <UserRound size={12} color="#A1A1AA" />}
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>
                            {row.clientName}
                          </span>
                        </div>
                        {row.nip && (
                          <div className="flex items-center gap-1" style={{ fontSize: 11.5, color: "#71717A", marginTop: 2 }}>
                            <span style={{ fontWeight: 500, letterSpacing: "0.04em" }}>NIP</span>
                            <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
                              {row.nip.replace(/^(\d{3}-\d{2})-(\d{2})-(\d{3})$/, "$1-••-$3")}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "8px 16px", verticalAlign: "middle" }}>
                      <CardTypesBadgeList cards={row.cards} />
                    </td>
                    <td style={tdStyle()}>
                      <div style={{ lineHeight: 1.4 }}>
                        <FinanceStatusBadge status={row.status} />
                        <div style={{ fontSize: 11, color: "#A1A1AA", marginTop: 3 }}>
                          {row.status === "zrealizowane" && row.doneAt && `Wysłano: ${row.doneAt}`}
                          {row.status === "wycofane" && row.withdrawnAt && `Wycofano: ${row.withdrawnAt}`}
                        </div>
                      </div>
                    </td>
                    {tab === "history" && (
                      <td style={tdStyle()}>
                        <div style={{ lineHeight: 1.35 }}>
                          <div style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                            fontSize: 11, color: "#71717A", fontWeight: 500,
                          }}>
                            {row.reportId}
                          </div>
                          <div style={{ fontSize: 11, color: "#A1A1AA", marginTop: 2 }}>
                            {row.reportedAt}
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4"
            style={{
              height: 56,
              borderTop: "1px solid #EDEDED",
              backgroundColor: "#FFFFFF",
              borderBottomLeftRadius: 6,
              borderBottomRightRadius: 6,
            }}
          >
            <div style={{ fontSize: 13, color: "#71717A" }}>
              Wyświetlono {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, activeRows.length)} z {activeRows.length}
            </div>
            <div className="flex items-center gap-1">
              <PageBtn icon={<ChevronLeft size={14} />} disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} />
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <PageBtn key={p} label={String(p)} active={p === currentPage} onClick={() => setCurrentPage(p)} />
              ))}
              <PageBtn icon={<ChevronRight size={14} />} disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
            </div>
          </div>
        )}
      </div>

      {/* Modal raportu */}
      {reportModal && (
        <FinanceReportModal
          mode={reportModal.mode}
          selectedCount={selectedCount}
          totalCount={activeRows.length}
          tab={tab}
          selectedAmount={selectedAmount}
          totalAmount={totalAmount}
          onClose={() => setReportModal(null)}
          onConfirm={() => {
            const ids = reportModal.mode === "selected"
              ? Array.from(selected)
              : selectableRows.map((r) => r.id);
            markAsReported(ids);
            setReportModal(null);
          }}
        />
      )}
    </main>
  );
}

function FinanceReportModal({
  mode,
  selectedCount,
  totalCount,
  tab,
  selectedAmount,
  totalAmount,
  onClose,
  onConfirm,
}: {
  mode: "selected" | "all";
  selectedCount: number;
  totalCount: number;
  tab: FinanceTab;
  selectedAmount: number;
  totalAmount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [includePersonal, setIncludePersonal] = useState(true);
  const [includeNip, setIncludeNip] = useState(true);
  const [includeAddress, setIncludeAddress] = useState(true);
  const [includeCards, setIncludeCards] = useState(true);
  const [includeDate, setIncludeDate] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  const count = mode === "selected" ? selectedCount : totalCount;
  const amount = mode === "selected" ? selectedAmount : totalAmount;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabLabel = tab === "pending" ? "do rozliczenia" : "do zwrotu";

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(17,24,40,0.45)", padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 500, maxWidth: "100%", backgroundColor: "#FFFFFF",
          borderRadius: 12, boxShadow: "0 20px 40px rgba(16,24,40,0.18)",
          border: "1px solid #EDEDED",
        }}
      >
        <div className="flex items-start justify-between" style={{ padding: "20px 24px 16px", borderBottom: "1px solid #EDEDED" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>
              Generuj raport rozliczeniowy
            </h2>
            <p style={{ fontSize: 13, color: "#71717A", marginTop: 4, marginBottom: 0 }}>
              {count} zamówień {tabLabel} · łącznie {formatPLN(amount)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer", color: "#71717A" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#3F3F46", marginBottom: 10 }}>
              Zawartość raportu
            </div>
            <div className="flex flex-col gap-2.5">
              <label className="inline-flex items-center gap-2" style={{ fontSize: 14, color: "#71717A", cursor: "not-allowed" }}>
                <Checkbox checked disabled onChange={() => {}} />
                ID zamówienia + ID płatności (wymagane)
              </label>
              <label className="inline-flex items-center gap-2" style={{ fontSize: 14, color: "#71717A", cursor: "not-allowed" }}>
                <Checkbox checked disabled onChange={() => {}} />
                Kwota płatności (wymagana)
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer" style={{ fontSize: 14, color: "#0A0A0A" }}>
                <Checkbox checked={includePersonal} onChange={setIncludePersonal} />
                Imię i nazwisko / Nazwa firmy
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer" style={{ fontSize: 14, color: "#0A0A0A" }}>
                <Checkbox checked={includeNip} onChange={setIncludeNip} />
                NIP (dla firm)
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer" style={{ fontSize: 14, color: "#0A0A0A" }}>
                <Checkbox checked={includeAddress} onChange={setIncludeAddress} />
                Adres klienta
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer" style={{ fontSize: 14, color: "#0A0A0A" }}>
                <Checkbox checked={includeCards} onChange={setIncludeCards} />
                Typ i liczba kart
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer" style={{ fontSize: 14, color: "#0A0A0A" }}>
                <Checkbox checked={includeDate} onChange={setIncludeDate} />
                Data realizacji / wycofania
              </label>
            </div>
          </div>

          {tab === "refunds" && (
            <div style={{
              padding: "12px 14px", backgroundColor: "#FFFBEB",
              border: "1px solid #FDE68A", borderRadius: 6,
            }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} color="#B45309" style={{ marginTop: 1, flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: "#92400E", margin: 0, lineHeight: 1.5 }}>
                  Raport zawiera zamówienia wycofane. Zwroty płatności należy obsłużyć ręcznie w systemie płatności (bank / PayU).
                  {/* TODO: confirm czy jest integracja z gateway płatniczym */}
                </p>
              </div>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2"
          style={{
            padding: "16px 24px", borderTop: "1px solid #EDEDED",
            backgroundColor: "#FAFAFA", borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 36, padding: "0 16px", borderRadius: 6,
              border: "1px solid transparent", backgroundColor: "transparent",
              color: "#3F3F46", fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2"
            style={{
              height: 36, padding: "0 16px", borderRadius: 6,
              backgroundColor: "#4F46E5", color: "#FFFFFF",
              fontSize: 14, fontWeight: 500, border: "1px solid #4F46E5", cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
          >
            <Download size={16} />
            Pobierz XLSX
          </button>
        </div>
      </div>
    </div>
  );
}

function DispatchView() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | CardType>("all");
  const [dateRange, setDateRange] = useState("Ostatnie 7 dni");
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [perPageOpen, setPerPageOpen] = useState(false);
  const [perPage, setPerPage] = useState(14);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | { mode: "selected" | "all"; format: ReportFormat }>(null);
  const [showReported, setShowReported] = useState(false);
  const [orders, setOrders] = useState<DispatchRow[]>(DISPATCH_ORDERS);

  // active rows = przefiltrowane wg search/filter/date — bez togglee
  const allMatching = useMemo(() => {
    return orders.filter((o) => {
      if (filterType !== "all" && !o.cards.some((c) => c.type === filterType)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!o.id.toLowerCase().includes(q) && !o.recipient.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, filterType]);

  // visible rows = po toggle "Pokaż zaraportowane"
  const rows = useMemo(() => {
    if (showReported) return allMatching;
    return allMatching.filter((o) => !o.reportId);
  }, [allMatching, showReported]);

  const reportedCount = allMatching.filter((o) => o.reportId).length;
  const pendingCount = allMatching.filter((o) => !o.reportId).length;

  const selectableRows = rows.filter((r) => !r.reportId);
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.id));
  const someSelected = selectableRows.some((r) => selected.has(r.id));
  const selectedCount = selected.size;

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableRows.map((r) => r.id)));
  };

  const openModal = (mode: "selected" | "all", format: ReportFormat = "PDF") => {
    setModal({ mode, format });
  };

  // Akcja po wygenerowaniu raportu — oznacz zamówienia
  const markAsReported = (orderIds: string[]) => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const stamp = `${dd}.${mm}.${yyyy}, ${hh}:${min}`;
    // Generuj kolejny numer raportu (na bazie istniejących)
    const existingNums = orders
      .map((o) => o.reportId)
      .filter((id): id is string => !!id)
      .map((id) => parseInt(id.split("/")[2] || "0", 10));
    const nextNum = (existingNums.length ? Math.max(...existingNums) : 126) + 1;
    const reportId = `RAP/2026/${String(nextNum).padStart(5, "0")}`;
    setOrders((prev) =>
      prev.map((o) =>
        orderIds.includes(o.id) ? { ...o, reportId, reportedAt: stamp, reportedBy: "Anna Nowak" } : o,
      ),
    );
    setSelected(new Set());
    return reportId;
  };

  return (
    <main className="px-8 py-8 mx-auto" style={{ maxWidth: 1400 }}>
      <div className="mb-6">
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#0A0A0A", margin: 0, lineHeight: 1.2 }}>Ekspedycja</h1>
        <p style={{ fontSize: 14, color: "#71717A", marginTop: 6 }}>
          Generowanie raportów wysyłki dla zrobionych zamówień
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #EDEDED",
          borderRadius: 6,
          boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
        }}
      >
        <div
          className="flex items-center justify-between gap-3"
          style={{
            minHeight: 60,
            padding: selectedCount > 0 ? "8px 8px 8px 16px" : "12px 16px",
            borderBottom: "1px solid #EDEDED",
            backgroundColor: selectedCount > 0 ? "#0A0A0A" : "#FFFFFF",
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            transition: "background-color 150ms ease",
          }}
        >
          {selectedCount > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <div style={{
                  width: 34, height: 28, borderRadius: 3,
                  backgroundColor: "#FFFFFF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#0A0A0A", flexShrink: 0,
                }}>
                  {selectedCount}
                </div>
                <span style={{ fontSize: 13.5, color: "#FFFFFF", fontWeight: 500 }}>
                  zamówień zaznaczonych
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelected(new Set())}
                  style={{
                    height: 32, padding: "0 12px", borderRadius: 7,
                    color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500,
                    backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  Anuluj
                </button>
                <button
                  onClick={() => openModal("selected", "XLSX")}
                  className="inline-flex items-center gap-2"
                  style={{
                    height: 32, padding: "0 14px", borderRadius: 7,
                    backgroundColor: "#4F46E5", color: "#FFFFFF",
                    fontSize: 12.5, fontWeight: 500, border: "none", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
                >
                  <Download size={14} />
                  Generuj raport
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
            <div className="relative" style={{ width: 280 }}>
              <Search
                size={16}
                color="#A1A1AA"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj po ID lub odbiorcy..."
                className="w-full outline-none"
                style={{
                  height: 36,
                  paddingLeft: 32,
                  paddingRight: 12,
                  borderRadius: 4,
                  border: "1px solid #D1D5DB",
                  fontSize: 14,
                  backgroundColor: "#FFFFFF",
                  color: "#0A0A0A",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
              />
            </div>
            <FilterDropdown
              open={filterOpen}
              setOpen={setFilterOpen}
              label="Typ karty"
              value={DISPATCH_FILTER_OPTIONS.find((o) => o.value === filterType)?.label ?? ""}
            >
              {DISPATCH_FILTER_OPTIONS.map((o) => (
                <DropdownItem
                  key={o.value}
                  active={filterType === o.value}
                  onClick={() => {
                    setFilterType(o.value);
                    setFilterOpen(false);
                  }}
                >
                  {o.label}
                </DropdownItem>
              ))}
            </FilterDropdown>
            <FilterDropdown
              open={dateOpen}
              setOpen={setDateOpen}
              label="Data zrobienia"
              value={dateRange}
              icon={<Calendar size={14} color="#71717A" />}
            >
              {DATE_RANGE_OPTIONS.map((o) => (
                <DropdownItem
                  key={o}
                  active={dateRange === o}
                  onClick={() => {
                    setDateRange(o);
                    setDateOpen(false);
                  }}
                >
                  {o}
                </DropdownItem>
              ))}
            </FilterDropdown>
            <div className="flex items-center gap-2 ml-2">
              <Toggle
                checked={showReported}
                onChange={setShowReported}
                label={`Pokaż zaraportowane${reportedCount > 0 ? ` (${reportedCount})` : ""}`}
              />
            </div>
          </div>
            </>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyDispatch
            variant={
              allMatching.length === 0
                ? search || filterType !== "all"
                  ? "filtered"
                  : "none"
                : "all-reported"
            }
            reportedCount={reportedCount}
            onShowReported={() => setShowReported(true)}
          />
        ) : (
          <div>
            <table className="w-full" style={{ borderCollapse: "collapse", tableLayout: "auto" }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: 165 }} />
                <col style={{ width: 145 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 175 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 160 }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: "#FAFAFA", borderBottom: "1px solid #EDEDED" }}>
                  <th style={thStyle("center")}>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={!allSelected && someSelected}
                        onChange={toggleAll}
                      />
                    </div>
                  </th>
                  <SortableTh label="ID zamówienia" />
                  <SortableTh label="Data zrobienia" />
                  <SortableTh label="Odbiorca" />
                  <SortableTh label="Adres wysyłki" />
                  <SortableTh label="Typ karty" />
                  <SortableTh label="Liczba sztuk" align="right" />
                  <SortableTh label="Raport" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isSelected = selected.has(row.id);
                  const isReported = !!row.reportId;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => {
                        if (!isReported) toggleRow(row.id);
                      }}
                      className={isReported ? "" : "cursor-pointer"}
                      style={{
                        height: 64,
                        backgroundColor: isSelected
                          ? "#FAFAFF"
                          : isReported
                            ? "#FAFAFA"
                            : "#FFFFFF",
                        borderBottom: "1px solid #F3F3F3",
                        transition: "background-color 120ms",
                        opacity: isReported ? 0.65 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected && !isReported) e.currentTarget.style.backgroundColor = "#FAFAFA";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = isReported ? "#FAFAFA" : "#FFFFFF";
                      }}
                    >
                      <td style={tdStyle("center")}>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            disabled={isReported}
                            onChange={() => {
                              if (!isReported) toggleRow(row.id);
                            }}
                          />
                        </div>
                      </td>
                      <td style={tdStyle("left")}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          style={{
                            fontFamily:
                              '"JetBrains Mono", ui-monospace, monospace',
                            fontSize: 13,
                            color: "#0A0A0A",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          {row.id}
                        </a>
                      </td>
                      <td style={tdStyle("left")}>
                        <span style={{ color: "#3F3F46", fontSize: 14 }}>{row.doneAt}</span>
                      </td>
                      <td style={tdStyle("left")}>
                        <div style={{ lineHeight: 1.35 }}>
                          <div style={{ color: "#0A0A0A", fontWeight: 600, fontSize: 14 }}>
                            {row.recipient.name}
                          </div>
                          <div style={{ color: "#71717A", fontSize: 13, marginTop: 2 }}>
                            {row.recipient.street}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle("left")}>
                        <div style={{ lineHeight: 1.35 }}>
                          <div style={{ color: "#0A0A0A", fontSize: 14 }}>
                            {row.recipient.postal} {row.recipient.city}
                          </div>
                          <div style={{ color: "#71717A", fontSize: 13, marginTop: 2 }}>
                            {row.recipient.voivodeship}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "8px 16px", verticalAlign: "middle" }}>
                        <CardTypesBadgeList cards={row.cards} />
                      </td>
                      <td style={tdStyle("right")}>
                        <QtyCell cards={row.cards} />
                      </td>
                      <td style={tdStyle("left")}>
                        {isReported ? (
                          <div style={{ lineHeight: 1.35 }}>
                            <div
                              style={{
                                fontFamily:
                                  '"JetBrains Mono", ui-monospace, monospace',
                                fontSize: 12,
                                color: "#71717A",
                                fontWeight: 500,
                              }}
                            >
                              {row.reportId}
                            </div>
                            <div style={{ color: "#A1A1AA", fontSize: 11, marginTop: 2 }}>
                              {row.reportedAt} · {row.reportedBy}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#D4D4D8", fontSize: 13 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div
            className="flex items-center justify-between px-4"
            style={{
              height: 56,
              borderTop: "1px solid #EDEDED",
              backgroundColor: "#FFFFFF",
              borderBottomLeftRadius: 6,
              borderBottomRightRadius: 6,
            }}
          >
            <div style={{ fontSize: 13, color: "#71717A" }}>
              Wyświetlono 1–{rows.length} z {DISPATCH_TOTAL}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setPerPageOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3"
                  style={{
                    height: 32,
                    borderRadius: 4,
                    border: "1px solid #D1D5DB",
                    backgroundColor: "#FFFFFF",
                    fontSize: 13,
                    color: "#3F3F46",
                  }}
                >
                  <span style={{ color: "#71717A" }}>Wierszy na stronę:</span>
                  <span style={{ fontWeight: 500 }}>{perPage}</span>
                  <ChevronDown size={14} color="#71717A" />
                </button>
                {perPageOpen && (
                  <div
                    className="absolute right-0 bottom-full mb-1 z-20"
                    style={{
                      minWidth: 80,
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #EDEDED",
                      borderRadius: 6,
                      boxShadow: "0 8px 16px rgba(16,24,40,0.08)",
                      padding: 4,
                    }}
                  >
                    {[14, 28, 50].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setPerPage(n);
                          setPerPageOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5"
                        style={{
                          fontSize: 13,
                          borderRadius: 4,
                          color: "#0A0A0A",
                          backgroundColor: perPage === n ? "#EEF2FF" : "transparent",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <PageBtn icon={<ChevronLeft size={14} />} disabled />
                <PageBtn label="1" active />
                <PageBtn label="2" />
                <PageBtn label="3" />
                <PageBtn label="4" />
                <PageBtn icon={<ChevronRight size={14} />} />
              </div>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <ReportModal
          mode={modal.mode}
          initialFormat={modal.format}
          selectedCount={selectedCount}
          totalCount={pendingCount}
          onClose={() => setModal(null)}
          onConfirm={() => {
            const ids = modal.mode === "selected"
              ? Array.from(selected)
              : selectableRows.map((r) => r.id);
            const newReportId = markAsReported(ids);
            setModal(null);
            // (W realnym systemie tu byłoby pobieranie pliku XLSX)
            console.log(`Wygenerowano raport ${newReportId} z ${ids.length} zamówień`);
          }}
        />
      )}
    </main>
  );
}

function EmptyDispatch({
  variant = "none",
  reportedCount = 0,
  onShowReported,
}: {
  variant?: "none" | "all-reported" | "filtered";
  reportedCount?: number;
  onShowReported?: () => void;
}) {
  let heading = "Brak zamówień do wysyłki";
  let subtitle = "Zamówienia pojawią się tutaj po oznaczeniu jako zrobione w panelu operatora SPKE.";
  if (variant === "all-reported") {
    heading = "Wszystko zaraportowane";
    subtitle = `Wszystkie ${reportedCount} zamówień z tego okresu zostało już ujętych w raportach.`;
  } else if (variant === "filtered") {
    heading = "Brak wyników";
    subtitle = "Spróbuj zmienić filtry lub wyczyścić wyszukiwanie.";
  }
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: "80px 24px" }}
    >
      <div
        className="flex items-center justify-center mb-4"
        style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "#F3F4F6", color: "#A1A1AA" }}
      >
        <Inbox size={32} strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>{heading}</h3>
      <p style={{ fontSize: 14, color: "#71717A", marginTop: 6, maxWidth: 420 }}>{subtitle}</p>
      {variant === "all-reported" && onShowReported && (
        <button
          onClick={onShowReported}
          className="mt-4 px-3"
          style={{
            height: 32,
            borderRadius: 6,
            backgroundColor: "transparent",
            border: "1px solid #D4D4D8",
            color: "#71717A",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F3F3")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          Pokaż zaraportowane
        </button>
      )}
    </div>
  );
}

/* ======================== DISPATCH SUBCOMPONENTS ======================== */

function SplitButton({
  open,
  setOpen,
  onPrimary,
  onPick,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onPrimary: () => void;
  onPick: (fmt: ReportFormat) => void;
}) {
  return (
    <div className="relative inline-flex">
      <button
        onClick={onPrimary}
        className="inline-flex items-center gap-2 px-4"
        style={{
          height: 36,
          borderTopLeftRadius: 6,
          borderBottomLeftRadius: 6,
          backgroundColor: "#4F46E5",
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 500,
          border: "1px solid #4F46E5",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
      >
        <FileText size={16} />
        Generuj raport wysyłki
      </button>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Wybierz format"
        className="inline-flex items-center justify-center"
        style={{
          height: 36,
          width: 32,
          borderTopRightRadius: 6,
          borderBottomRightRadius: 6,
          backgroundColor: "#4F46E5",
          color: "#FFFFFF",
          fontSize: 14,
          border: "1px solid #4F46E5",
          borderLeft: "1px solid #2D6097",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
      >
        <ChevronDown size={16} />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 z-20"
          style={{
            top: "100%",
            minWidth: 180,
            backgroundColor: "#FFFFFF",
            border: "1px solid #EDEDED",
            borderRadius: 6,
            boxShadow: "0 8px 16px rgba(16,24,40,0.08)",
            padding: 4,
          }}
        >
          {(["PDF", "CSV", "XLSX"] as ReportFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => onPick(fmt)}
              className="w-full text-left px-3 py-2 inline-flex items-center gap-2"
              style={{ fontSize: 14, borderRadius: 4, color: "#0A0A0A" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <Download size={14} color="#71717A" />
              Pobierz {fmt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportModal({
  mode,
  initialFormat,
  selectedCount,
  totalCount,
  onClose,
  onConfirm,
}: {
  mode: "selected" | "all";
  initialFormat: ReportFormat;
  selectedCount: number;
  totalCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [includeQty, setIncludeQty] = useState(true);
  const [includeType, setIncludeType] = useState(true);
  const [includeId, setIncludeId] = useState(false);
  const [includeDate, setIncludeDate] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subtitle =
    mode === "selected"
      ? `Plik XLSX zostanie pobrany dla ${selectedCount} zaznaczonych zamówień`
      : `Plik XLSX zostanie pobrany dla wszystkich ${totalCount} zamówień`;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(17, 24, 39, 0.45)", padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 520,
          maxWidth: "100%",
          backgroundColor: "#FFFFFF",
          borderRadius: 12,
          boxShadow: "0 20px 40px rgba(16,24,40,0.18)",
          border: "1px solid #EDEDED",
        }}
      >
        <div
          className="flex items-start justify-between"
          style={{ padding: "20px 24px 16px", borderBottom: "1px solid #EDEDED" }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>Generuj raport wysyłki</h2>
            <p style={{ fontSize: 13, color: "#71717A", marginTop: 4, marginBottom: 0 }}>{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="inline-flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "none",
              backgroundColor: "transparent",
              color: "#71717A",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          <FieldGroup label="Zawartość raportu">
            <div className="flex flex-col gap-2">
              <CheckboxRow checked disabled label="Adresy odbiorców (wymagane)" onChange={() => {}} />
              <CheckboxRow checked={includeQty} onChange={setIncludeQty} label="Liczba sztuk" />
              <CheckboxRow checked={includeType} onChange={setIncludeType} label="Typ karty" />
              <CheckboxRow checked={includeId} onChange={setIncludeId} label="ID zamówienia" />
              <CheckboxRow checked={includeDate} onChange={setIncludeDate} label="Data zrobienia" />
            </div>
          </FieldGroup>
        </div>

        <div
          className="flex items-center justify-end gap-2"
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #EDEDED",
            backgroundColor: "#FAFAFA",
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          }}
        >
          <button
            onClick={onClose}
            className="px-4"
            style={{
              height: 36,
              borderRadius: 6,
              border: "1px solid transparent",
              backgroundColor: "transparent",
              color: "#3F3F46",
              fontSize: 14,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F3F4F6")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-4"
            style={{
              height: 36,
              borderRadius: 6,
              backgroundColor: "#4F46E5",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 500,
              border: "1px solid #4F46E5",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338CA")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4F46E5")}
          >
            <Download size={16} />
            Pobierz XLSX
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#3F3F46", marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function CheckboxRow({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="inline-flex items-center gap-2"
      style={{
        fontSize: 14,
        color: disabled ? "#71717A" : "#0A0A0A",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Checkbox checked={checked} disabled={disabled} onChange={onChange} />
      {label}
    </label>
  );
}
