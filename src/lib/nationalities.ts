// Elenco completo delle nazionalità (in italiano, forma dell'aggettivo)
// accompagnate dalla bandiera del Paese corrispondente. L'elenco è
// ordinato alfabeticamente in italiano e viene usato come sorgente
// unica per il selettore di nazionalità nell'onboarding e nel profilo.
//
// Nota: il valore salvato è la stringa italiana (es. "Italiana") per
// rimanere retro-compatibile con i profili esistenti. La bandiera è
// solo un'etichetta visiva ricavata dal codice ISO alpha-2 del Paese.

export type Nationality = {
  /** Aggettivo/demonimo in italiano — valore salvato nel DB */
  value: string;
  /** Codice ISO 3166-1 alpha-2 del Paese */
  iso: string;
  /** Emoji bandiera derivata dal codice ISO */
  flag: string;
};

function flagFromIso(iso: string): string {
  const cc = iso.toUpperCase();
  if (cc.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65)) +
    String.fromCodePoint(A + (cc.charCodeAt(1) - 65));
}

// Coppie (demonimo italiano, ISO alpha-2). Elenco ampio dei Paesi ONU.
const RAW: Array<[string, string]> = [
  ["Afghana", "AF"], ["Albanese", "AL"], ["Algerina", "DZ"], ["Andorrana", "AD"],
  ["Angolana", "AO"], ["Antiguo-barbudana", "AG"], ["Argentina", "AR"], ["Armena", "AM"],
  ["Australiana", "AU"], ["Austriaca", "AT"], ["Azera", "AZ"],
  ["Bahamense", "BS"], ["Bahreinita", "BH"], ["Bangladese", "BD"], ["Barbadiana", "BB"],
  ["Belga", "BE"], ["Beliziana", "BZ"], ["Beninese", "BJ"], ["Bhutanese", "BT"],
  ["Bielorussa", "BY"], ["Birmana", "MM"], ["Boliviana", "BO"], ["Bosniaca", "BA"],
  ["Botswana", "BW"], ["Brasiliana", "BR"], ["Bruneiana", "BN"], ["Bulgara", "BG"],
  ["Burkinabé", "BF"], ["Burundese", "BI"],
  ["Cambogiana", "KH"], ["Camerunese", "CM"], ["Canadese", "CA"], ["Capoverdiana", "CV"],
  ["Ceca", "CZ"], ["Centrafricana", "CF"], ["Ciadiana", "TD"], ["Cilena", "CL"],
  ["Cinese", "CN"], ["Cipriota", "CY"], ["Colombiana", "CO"], ["Comoriana", "KM"],
  ["Congolese (Rep. Dem.)", "CD"], ["Congolese (Rep.)", "CG"], ["Nordcoreana", "KP"],
  ["Sudcoreana", "KR"], ["Costaricana", "CR"], ["Croata", "HR"], ["Cubana", "CU"],
  ["Danese", "DK"], ["Dominicana", "DO"], ["Dominicense", "DM"],
  ["Ecuadoriana", "EC"], ["Egiziana", "EG"], ["Salvadoregna", "SV"], ["Emiratina", "AE"],
  ["Eritrea", "ER"], ["Estone", "EE"], ["Etiope", "ET"],
  ["Figiana", "FJ"], ["Filippina", "PH"], ["Finlandese", "FI"], ["Francese", "FR"],
  ["Gabonese", "GA"], ["Gambiana", "GM"], ["Georgiana", "GE"], ["Tedesca", "DE"],
  ["Ghanese", "GH"], ["Giamaicana", "JM"], ["Giapponese", "JP"], ["Gibutiana", "DJ"],
  ["Giordana", "JO"], ["Greca", "GR"], ["Grenadina", "GD"], ["Guatemalteca", "GT"],
  ["Guineana", "GN"], ["Guineana equatoriale", "GQ"], ["Guineense", "GW"],
  ["Guyanese", "GY"],
  ["Haitiana", "HT"], ["Honduregna", "HN"],
  ["Indiana", "IN"], ["Indonesiana", "ID"], ["Inglese", "GB"], ["Iraniana", "IR"],
  ["Irachena", "IQ"], ["Irlandese", "IE"], ["Islandese", "IS"], ["Israeliana", "IL"],
  ["Italiana", "IT"],
  ["Ivoriana", "CI"],
  ["Kazaka", "KZ"], ["Keniota", "KE"], ["Kirghisa", "KG"], ["Kiribatiana", "KI"],
  ["Kosovara", "XK"], ["Kuwaitiana", "KW"],
  ["Laotiana", "LA"], ["Lesothiana", "LS"], ["Lettone", "LV"], ["Libanese", "LB"],
  ["Liberiana", "LR"], ["Libica", "LY"], ["Liechtensteinese", "LI"],
  ["Lituana", "LT"], ["Lussemburghese", "LU"],
  ["Macedone", "MK"], ["Malgascia", "MG"], ["Malawiana", "MW"], ["Malese", "MY"],
  ["Maldiviana", "MV"], ["Maliana", "ML"], ["Maltese", "MT"], ["Marocchina", "MA"],
  ["Marshallese", "MH"], ["Mauritana", "MR"], ["Mauriziana", "MU"], ["Messicana", "MX"],
  ["Micronesiana", "FM"], ["Moldava", "MD"], ["Monegasca", "MC"], ["Mongola", "MN"],
  ["Montenegrina", "ME"], ["Mozambicana", "MZ"],
  ["Namibiana", "NA"], ["Nauruana", "NR"], ["Nepalese", "NP"], ["Nicaraguense", "NI"],
  ["Nigerina", "NE"], ["Nigeriana", "NG"], ["Norvegese", "NO"], ["Neozelandese", "NZ"],
  ["Olandese", "NL"], ["Omanita", "OM"],
  ["Pakistana", "PK"], ["Palauana", "PW"], ["Palestinese", "PS"], ["Panamense", "PA"],
  ["Papuana", "PG"], ["Paraguaiana", "PY"], ["Peruviana", "PE"], ["Polacca", "PL"],
  ["Portoghese", "PT"],
  ["Qatariota", "QA"],
  ["Rumena", "RO"], ["Ruandese", "RW"], ["Russa", "RU"],
  ["Salomonese", "SB"], ["Samoana", "WS"], ["Sammarinese", "SM"], ["Saotomense", "ST"],
  ["Saudita", "SA"], ["Scozzese", "GB"], ["Senegalese", "SN"], ["Serba", "RS"],
  ["Seychellese", "SC"], ["Sierraleonese", "SL"], ["Singaporiana", "SG"],
  ["Siriana", "SY"], ["Slovacca", "SK"], ["Slovena", "SI"], ["Somala", "SO"],
  ["Spagnola", "ES"], ["Srilankese", "LK"], ["Statunitense", "US"], ["Sudafricana", "ZA"],
  ["Sudanese", "SD"], ["Sudsudanese", "SS"], ["Surinamese", "SR"], ["Svedese", "SE"],
  ["Svizzera", "CH"], ["Swazi", "SZ"],
  ["Tagika", "TJ"], ["Taiwanese", "TW"], ["Tanzaniana", "TZ"], ["Thailandese", "TH"],
  ["Timorese", "TL"], ["Togolese", "TG"], ["Tongana", "TO"], ["Trinidadiana", "TT"],
  ["Tunisina", "TN"], ["Turca", "TR"], ["Turkmena", "TM"], ["Tuvaluana", "TV"],
  ["Ucraina", "UA"], ["Ugandese", "UG"], ["Ungherese", "HU"], ["Uruguaiana", "UY"],
  ["Uzbeka", "UZ"],
  ["Vanuatuana", "VU"], ["Vaticana", "VA"], ["Venezuelana", "VE"], ["Vietnamita", "VN"],
  ["Yemenita", "YE"],
  ["Zambiana", "ZM"], ["Zimbabwese", "ZW"],
];

export const NATIONALITIES: Nationality[] = RAW.map(([value, iso]) => ({
  value,
  iso,
  flag: flagFromIso(iso),
})).sort((a, b) => a.value.localeCompare(b.value, "it"));

export function findNationality(value: string | null | undefined): Nationality | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return NATIONALITIES.find((n) => n.value.toLowerCase() === v);
}

export function nationalityLabel(value: string | null | undefined): string {
  const n = findNationality(value);
  if (!n) return value?.trim() || "";
  return `${n.flag} ${n.value}`;
}