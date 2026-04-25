/** Yeni firma (organization) için varsayılan prim oranları — 019 ile aynı liste */
export const DEFAULT_COMMISSION_ROWS: ReadonlyArray<{
  country: string;
  amount: number;
  currency: "EUR" | "USD" | "TL";
}> = [
  ["Almanya", 10, "EUR"],
  ["Fransa", 10, "EUR"],
  ["İtalya", 10, "EUR"],
  ["İspanya", 10, "EUR"],
  ["Hollanda", 10, "EUR"],
  ["Belçika", 10, "EUR"],
  ["Avusturya", 10, "EUR"],
  ["Yunanistan", 10, "EUR"],
  ["Portekiz", 10, "EUR"],
  ["İsviçre", 10, "EUR"],
  ["Polonya", 10, "EUR"],
  ["Çekya", 10, "EUR"],
  ["Macaristan", 10, "EUR"],
  ["Danimarka", 10, "EUR"],
  ["İsveç", 10, "EUR"],
  ["Norveç", 10, "EUR"],
  ["Finlandiya", 10, "EUR"],
  ["Estonya", 10, "EUR"],
  ["Letonya", 10, "EUR"],
  ["Litvanya", 10, "EUR"],
  ["Slovenya", 10, "EUR"],
  ["Slovakya", 10, "EUR"],
  ["Hırvatistan", 10, "EUR"],
  ["Malta", 10, "EUR"],
  ["Lüksemburg", 10, "EUR"],
  ["İzlanda", 10, "EUR"],
  ["Liechtenstein", 10, "EUR"],
  ["Çin", 10, "USD"],
  ["ABD", 10, "USD"],
].map(([country, amount, currency]) => ({
  country: country as string,
  amount: amount as number,
  currency: currency as "EUR" | "USD",
}));
