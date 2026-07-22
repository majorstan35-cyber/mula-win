import { useEffect, useState, useRef } from "react";

export type StreamItem = {
  id: number;
  phone: string;
  matched: number;
  prizeKes?: number;
  city: string;
  comment: string;
  langTag: string;
  ago: string;
  isWin: boolean;
};

// Fisher-Yates shuffle — ensures no repeating patterns
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 9/12 = KES 20,000 ────────────────────────────────────────────────────────
const POOL_20K = [
  { text: "Ero omera! 20k landed straight on Mpesa, sijui kucheza tena 😭🙌", lang: "Jaluo / Kisumu" },
  { text: "Buda si unajua? Alert ya 20,000 imetoka hata sijapumzika 😂📱", lang: "Sheng / Nairobi" },
  { text: "Ngai fafa! Wambui ameambia ukweli — 20k imefika sasa hivi 🙏💸", lang: "Kikuyu / Nyeri" },
  { text: "Khayekha! Omwami wangu 20,000 iko safe Mpesa yangu 💪🥳", lang: "Luhya / Kakamega" },
  { text: "Mombasa tunaendelea! Alert ya elfu ishirini imeingia 🌊💰", lang: "Swahili / Mombasa" },
  { text: "Chesire! Iten hii ni real — 20k credited leo asubuhi 🏃🔥", lang: "Kalenjin / Iten" },
  { text: "Unadhani ni mchezo? 9 out of 12 na 20,000 confirmed! Machakos power 🇰🇪", lang: "Kamba / Machakos" },
  { text: "Ndugu yangu nimefurahi sana, 20k kutoka kwa mula win 😭🎉", lang: "Swahili / Kisumu" },
  { text: "Hii pesa saa hii imenisaidia sana, 20,000 intact Mpesa 🙌✨", lang: "Nairobi Player" },
  { text: "Ebu niambie kama hii si real — alert 20k imeingia right now 😱📲", lang: "Sheng / Ruiru" },
  { text: "Onyinkwa! Kisii power — 20,000 credited bila stress! 🎊💃", lang: "Kisii / Kisii" },
  { text: "Wuod Kisumu represent! 20k straight kwa simu yangu 🔥🎉", lang: "Jaluo / Homa Bay" },
  { text: "Wewe nakuambia hii kitu inafanya kazi, 20,000 iko kwa akaunti 💸🏆", lang: "Kikuyu / Karatina" },
  { text: "Nilidhani ni mchezo mpaka 20k ilipoingia — Embu represent! 😂🎉", lang: "Embu Player" },
  { text: "Poa sana! Elfu ishirini zimeingia bila kusumbua 🍀💰", lang: "Swahili / Thika" },
  { text: "Sawa kabisa! Mpesa alert ya 20k — Nanyuki tunaendelea 🥳🚀", lang: "Nanyuki Player" },
  { text: "Aaaah nimeshindwa kuamini, 20,000 credited straight hapo! 😭🙏", lang: "Sheng / Westlands" },
  { text: "Naweza sema ukweli? Hii app ni legit — 20k imefika Meru 🎯💸", lang: "Meru Player" },
  { text: "Kibet aliambia ukweli, Eldoret tunawin — 20,000 alert! 🏃💨", lang: "Kalenjin / Eldoret" },
  { text: "Baba wa nyumba amenipata 20k bila kutoka nje, Kitale represent 🏠💸", lang: "Luhya / Kitale" },
  { text: "Nakuru simu imepiga — 20,000 confirmed! Tunaendelea tena 🎊🔥", lang: "Nakuru Player" },
  { text: "Oooh Ngai! Njeri alisema 20k — kweli kweli iko Mpesa 🙌💎", lang: "Kikuyu / Kiambu" },
  { text: "Omwabo! Onyinkwa mwenzangu, 20k iko safi — Kisii town 💃🎉", lang: "Kisii / Kisii" },
  { text: "Garissa tunaendelea! 20,000 alert imeingia saa hii hii 🔥💸", lang: "Garissa Player" },
  { text: "Lakini hii app kweli kweli inabeba — 20k credited Kilifi 🌴💰", lang: "Kilifi Player" },
  { text: "Simu inapiga vibration ya Mpesa — 20,000 iko hapa Malindi 📳💸", lang: "Swahili / Malindi" },
  { text: "Eeeh mungu wangu — nilikuwa naona tu, 20k imeingia Bungoma! 😭🎉", lang: "Luhya / Bungoma" },
  { text: "Auma yangu wa Siaya — 20k credited no jokes 🎉🙌", lang: "Jaluo / Siaya" },
  { text: "Spin moja na 20k straight — Ruiru boys tunaendelea 💪🔥", lang: "Sheng / Ruiru" },
  { text: "Wakinywa chai Kericho — mimi niko na 20k Mpesa tayari 🍵😂", lang: "Kalenjin / Kericho" },
];

// ─── 10/12 = KES 25,000 ───────────────────────────────────────────────────────
const POOL_25K = [
  { text: "Omwabo sana! 25,000 credited — Nyamira power imethibitishwa 🤑💃", lang: "Kisii / Nyamira" },
  { text: "Manze buda, simu imepiga 25k — Thika boys tuko juu 📱🔥", lang: "Sheng / Thika" },
  { text: "Chebet akipiga kelele Eldoret — 25,000 iko Mpesa sasa 🏃💨🥳", lang: "Kalenjin / Eldoret" },
  { text: "Ngai fafa Wanjiku — 25k credited bila delay! Kiambu represent 🙌💰", lang: "Kikuyu / Kiambu" },
  { text: "Ebu angalia hii — 25,000 Mpesa alert Webuye power! 🎉💸", lang: "Luhya / Webuye" },
  { text: "Otieno wa Kisumu — 25k straight to Mpesa, no stress 🎊🔥", lang: "Jaluo / Kisumu" },
  { text: "Nakuru chai na 25,000 kwa mfukoni saa hii 😂🍵💸", lang: "Nakuru Player" },
  { text: "Umenisimamisha! 10 out of 12 na 25k — Karatina represent 🏆✨", lang: "Kikuyu / Karatina" },
  { text: "Hata sikuamini mpaka nikaona Mpesa — 25,000 iko safe 😱💰", lang: "Nairobi Player" },
  { text: "Kericho tea land tena! 25k alert — Kibet ataambia wote 🍵💸", lang: "Kalenjin / Kericho" },
  { text: "Kipchoge speed ya akili — 25,000 credited bila kusita 🏃🥇", lang: "Kalenjin / Iten" },
  { text: "Moraa yangu — Kisii watu wanawin 25k bila stress 💃🤑", lang: "Kisii / Kisii" },
  { text: "Mombasa raha — 25k imeingia saa hii, Mpesa inanikubaliana 🌊💸", lang: "Swahili / Mombasa" },
  { text: "Hii ni kweli — 25,000 imetoka kwa Mula Win, Embu represent 🎉💪", lang: "Embu Player" },
  { text: "Sijui kucheka ama kulilia — 25k credited Meru right now 😭😂", lang: "Meru Player" },
  { text: "Simu yangu inalia na furaha — 25,000 alert imetoka Garissa 📳💸", lang: "Garissa Player" },
  { text: "Machakos power! Mwende amesema 25k iko kwa akaunti leo 🇰🇪🥳", lang: "Kamba / Machakos" },
  { text: "Buda nimekuambia hii kitu ni legit — 25k imethibitishwa Ruiru 💯🔥", lang: "Sheng / Ruiru" },
  { text: "Hallelujah! Elfu ishirini na tano Mpesa — Kitale inawin 🙏💰", lang: "Luhya / Kitale" },
  { text: "Naivasha vibes — 25,000 alert imeingia wakati wa mapumziko 🌿💸", lang: "Naivasha Player" },
  { text: "Eeeh mimi Adhiambo wa Homa Bay — 25k credited bila mchezo 😭🎉", lang: "Jaluo / Homa Bay" },
  { text: "10 numbers matched — 25,000 saa hii hii Nanyuki represent 🏔️💸", lang: "Nanyuki Player" },
  { text: "Watu wa Bungoma — 25k imethibitishwa. Hii si mchezo! 💪🎊", lang: "Luhya / Bungoma" },
  { text: "Unanikashifu? 25k landed — Kilifi beach player tuko juu 🌊🤑", lang: "Kilifi Player" },
  { text: "Simama hapo — 25,000 credited kweli kweli! Nyeri power 🏆✨", lang: "Kikuyu / Nyeri" },
  { text: "Sawa kabisa! Simu imelia na 25k — Malindi represent 📲🔥", lang: "Swahili / Malindi" },
  { text: "Omwami wa Kakamega — 25,000 straight Mpesa, bora uhai 💪💸", lang: "Luhya / Kakamega" },
  { text: "Aaah Njeri amelala vizuri leo — 25k iko kwa simu 😂🙌", lang: "Kikuyu / Thika" },
  { text: "Siaya represent! Achieng amesema 25,000 no lies — iko safe 🎉💎", lang: "Jaluo / Siaya" },
  { text: "Hata nilipigia mama simu — 25k credited Nakuru! 😭🙏", lang: "Nakuru Player" },
];

// ─── 11/12 = KES 50,000 ───────────────────────────────────────────────────────
const POOL_50K = [
  { text: "EEEEEH! 50,000 credited — Wairimu wa Kiambu hataamini! 💎🚀😭", lang: "Kikuyu / Kiambu" },
  { text: "Omwabo wa miaka yote! 50k Siaya — Wuod Baba ameshinda leo! 🎊🥇", lang: "Jaluo / Siaya" },
  { text: "11 numbers matched... sitaki kulilia, 50,000 iko MPESA SASA 😭💎", lang: "English / Nairobi" },
  { text: "Kayole boys tuko juu! 50k bana, dunia ni yetu leo usiku! 💸👑", lang: "Sheng / Nairobi" },
  { text: "Omwabo! Kisii county — 50,000 saa hii ndio kwanza ninaamini 🎊💎", lang: "Kisii / Kisii" },
  { text: "Aaaah nimeshindwa! 11/12 na 50k straight — Eldoret power forever 🏃🥇", lang: "Kalenjin / Eldoret" },
  { text: "Mama yangu atalilia — 50,000 credited Homa Bay. Ero omera! 😭🎉", lang: "Jaluo / Homa Bay" },
  { text: "Hata sikuamini, spin moja — 50k Mpesa Mombasa inaendelea! 🌊💎", lang: "Swahili / Mombasa" },
  { text: "Kibet alikuwa anasema nikimbie — nimekata nikashinda 50k! 😂🏆", lang: "Kalenjin / Kericho" },
  { text: "Nakuru mtu wa kawaida — 50,000 leo sitaenda kazi kesho 😂💸", lang: "Nakuru Player" },
  { text: "Njeri amepigia wote simu — 50k confirmed Nyeri! Ngai fafa! 🙌🥳", lang: "Kikuyu / Nyeri" },
  { text: "Buda najua unaona — 50k real, Thika West represent! 💪🔥", lang: "Sheng / Thika" },
  { text: "Omwami wa Kakamega — elfu hamsini straight kwa Mpesa! 🥰💎", lang: "Luhya / Kakamega" },
  { text: "Mwende wa Machakos analia machozi ya furaha — 50k iko safe 😭🎉", lang: "Kamba / Machakos" },
  { text: "11 out of 12! Bado napigia simu friends — 50k credited sasa 📞💸", lang: "Nairobi Player" },
  { text: "Watu wa Kisumu — Auma ameshinda 50,000. Hata sikuamini! 😱🏆", lang: "Jaluo / Kisumu" },
  { text: "Hii ndiyo nguvu ya Mula Win — 50k Mpesa Embu right now! 🏆🔥", lang: "Embu Player" },
  { text: "Adhiambo wa Siaya amesema 50k iko — na mimi naona alert! 😭🎊", lang: "Jaluo / Siaya" },
  { text: "Ruiru Eastlands champion — 50,000 credited bila kuwaza sana 💯💎", lang: "Sheng / Ruiru" },
  { text: "Kiambu power — Wanjiku amesema ukweli. 50k iko Mpesa saa hii 🙌💸", lang: "Kikuyu / Kiambu" },
  { text: "Lakini hii game — 50k straight credited, Bungoma represent! 😱🥳", lang: "Luhya / Bungoma" },
  { text: "Otieno alikataa kuspin — mimi nikaspin, 50k iko safe Kisumu 😂🏆", lang: "Jaluo / Kisumu" },
  { text: "Kilifi beach winner — 50,000 wakati jua likichomeka 🌊😎💎", lang: "Kilifi Player" },
  { text: "Hata nafikiri ni ndoto — 50k Mpesa saa hii. Nanyuki power! 😭🔥", lang: "Nanyuki Player" },
  { text: "11 matched! Mpesa inalia — 50k confirmed, Garissa represent! 📳💸", lang: "Garissa Player" },
  { text: "Mtu wa Nakuru — 50,000 saa hii, sitaambia bosi kesho 😂💎", lang: "Nakuru Player" },
  { text: "Eeeh Chesire wa Iten — umeshinda 50k, hata mbio za Leo hazina maana 🏃🥇💸", lang: "Kalenjin / Iten" },
];

// ─── Non-win messages (large varied pool) ─────────────────────────────────────
const POOL_NONWIN = [
  "Missed by 3 but iko karibu — spinning again saa hii 🔁",
  "Warm up tu buda, next one ni yangu 💪",
  "Acha niskie pumzi, returning in 2 mins 😤",
  "Bahati mbaya leo lakini kesho ni siku yangu 🙏",
  "Ulikuwa karibu sana — one more spin! 🎯",
  "Warm up spin done. Mbele tuna sherehe 🚀",
  "Nimeamua nitakuwa winner leo usiku 🌙💸",
  "Chapaa inakuja, trust the process 🤞",
  "Almost! 8 matched — next spin niko tayari 💥",
  "Hii mara next nitashinda — najua numbers zangu 😎",
  "Nimeweka ngumi — next spin ni jackpot 🥊🎰",
  "Wueh, bahati mbaya lakini siachi 😭🔥",
  "Nairobi boys hawaachi — spinning again 🔄",
  "One more try — feeling lucky leo 🍀",
  "Hizi numbers zinanikaribia — one more spin! 😅",
  "Poleni wenzangu, next one ni yangu 💯",
  "7 out of 12 — getting warmer! 🔥",
  "Sitaisha leo — target ni 20k minimum 💸",
  "Harakisha — spinning again right now! ⚡",
  "Practise spin — next one ni serious 🎯",
];

const CITIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Nyeri", "Kakamega",
  "Siaya", "Karatina", "Ruiru", "Kericho", "Iten", "Homa Bay", "Kiambu", "Machakos",
  "Meru", "Webuye", "Naivasha", "Garissa", "Kilifi", "Embu", "Kitale", "Nanyuki", "Kisii",
  "Bungoma", "Malindi", "Voi", "Kajiado", "Migori", "Busia", "Athi River",
];

// Generates an organic stream with shuffle — no repeating pattern
export function generateOrganicStream(count = 25): StreamItem[] {
  const list: StreamItem[] = [];
  const prefixes = [
    "0712", "0722", "0740", "0798", "0715", "0733", "0721", "0701",
    "0758", "0714", "0728", "0745", "0790", "0711", "0720", "0734",
    "0792", "0719", "0708", "0796", "0769", "0724", "0739", "0756",
  ];

  // Shuffle all three pools so order is random every session
  const pool20 = shuffle(POOL_20K);
  const pool25 = shuffle(POOL_25K);
  const pool50 = shuffle(POOL_50K);
  const poolNW = shuffle(POOL_NONWIN);
  const cityList = shuffle(CITIES);

  let idx20 = 0, idx25 = 0, idx50 = 0, idxNW = 0;

  for (let i = 0; i < count; i++) {
    // Win ratio pattern: 2 wins every 6 items (positions 1 & 4 in each block)
    const posInBlock = i % 6;
    const isWin = posInBlock === 1 || posInBlock === 4;

    const phone = `${prefixes[i % prefixes.length]}****${Math.floor(10 + Math.random() * 89)}`;
    const city = cityList[i % cityList.length];

    if (isWin) {
      const r = Math.random();
      const matched = r < 0.60 ? 9 : r < 0.90 ? 10 : 11;
      let prizeKes = 20000;
      if (matched === 10) prizeKes = 25000;
      if (matched === 11) prizeKes = 50000;

      let commentObj: { text: string; lang: string };
      if (prizeKes === 50000) {
        commentObj = pool50[idx50 % pool50.length];
        idx50++;
      } else if (prizeKes === 25000) {
        commentObj = pool25[idx25 % pool25.length];
        idx25++;
      } else {
        commentObj = pool20[idx20 % pool20.length];
        idx20++;
      }

      list.push({
        id: i,
        phone,
        matched,
        prizeKes,
        city,
        comment: commentObj.text,
        langTag: commentObj.lang,
        ago: `${Math.floor(8 + Math.random() * 55)}s ago`,
        isWin: true,
      });
    } else {
      const matched = Math.floor(4 + Math.random() * 5); // 4 to 8
      const msg = poolNW[idxNW % poolNW.length];
      idxNW++;
      list.push({
        id: i,
        phone,
        matched,
        city,
        comment: msg,
        langTag: `${city} Player`,
        ago: `${Math.floor(5 + Math.random() * 90)}s ago`,
        isWin: false,
      });
    }
  }

  return list;
}

export function getOrganicOnlineCount(): number {
  const hour = new Date().getHours();
  let baseMin = 1200;
  let baseMax = 2500;

  if (hour >= 12 && hour < 16) {
    baseMin = 2500;
    baseMax = 5200;
  } else if (hour >= 16 && hour < 19) {
    baseMin = 1000;
    baseMax = 2400;
  } else if (hour >= 19 && hour <= 23) {
    baseMin = 3500;
    baseMax = 7800;
  } else if (hour >= 0 && hour < 6) {
    baseMin = 500;
    baseMax = 1200;
  }

  const jitter = Math.floor(Math.random() * (baseMax - baseMin));
  return baseMin + jitter;
}

export function LiveCommentsFeed() {
  const [stream] = useState(() => generateOrganicStream(25));
  const [index, setIndex] = useState(0);
  const [onlineCount, setOnlineCount] = useState(() => getOrganicOnlineCount());
  const trendRef = useRef(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % stream.length);

      setOnlineCount((n) => {
        if (Math.random() < 0.08) trendRef.current *= -1;
        const hour = new Date().getHours();
        let floor = 900;
        let ceil = 2500;
        if (hour >= 12 && hour < 16) { floor = 2400; ceil = 5400; }
        else if (hour >= 16 && hour < 19) { floor = 1000; ceil = 2500; }
        else if (hour >= 19 && hour <= 23) { floor = 3500; ceil = 8000; }
        else if (hour >= 0 && hour < 6) { floor = 450; ceil = 1200; }

        const delta = (Math.floor(Math.random() * 18) + 6) * trendRef.current;
        const nextVal = n + delta;
        return Math.max(floor, Math.min(ceil, nextVal));
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [stream]);

  const item = stream[index];

  return (
    <div className="w-full">
      {/* Header Counter */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
          💬 Live Player Activity Feed
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {onlineCount.toLocaleString()} playing now
        </span>
      </div>

      {/* Main Display Card */}
      <div className={`relative min-h-[90px] overflow-hidden rounded-2xl border backdrop-blur p-4 shadow-lg transition-all duration-500 ${
        item.isWin
          ? "border-emerald-500/50 bg-gradient-to-r from-[color:var(--card)]/90 via-emerald-950/30 to-[color:var(--card)]/90 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          : "border-[color:var(--border)] bg-[color:var(--card)]/60"
      }`}>
        <div className="flex items-start justify-between gap-3">
          {/* Left Column: Player Info + Organic Comment */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono font-bold text-xs text-[color:var(--foreground)]">{item.phone}</span>
              <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-[color:var(--muted-foreground)]">{item.city}</span>
              <span className="rounded bg-[color:var(--gold)]/10 text-[color:var(--gold-soft)] px-1.5 py-0.5 text-[9px] font-medium">{item.langTag}</span>
              <span className="text-[10px] text-[color:var(--muted-foreground)] ml-auto sm:ml-0">{item.ago}</span>
            </div>

            {/* Organic comment text */}
            <p className="text-xs text-[color:var(--foreground)]/90 italic font-sans leading-relaxed mt-1">
              "{item.comment}"
            </p>
          </div>

          {/* Right Column: Matched Count + Green Prize Badge */}
          <div className="flex flex-col items-end flex-shrink-0 text-right">
            <div className="font-display text-lg font-bold text-[color:var(--gold)]">
              {item.matched}<span className="text-xs text-[color:var(--muted-foreground)]">/12</span>
            </div>
            <div className="text-[9px] uppercase tracking-widest text-[color:var(--muted-foreground)] mb-0.5">
              matched
            </div>

            {/* Prominent Green Prize Badge for Winners */}
            {item.isWin && item.prizeKes && (
              <div className="mt-1 flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-black text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse">
                <span>🎉</span>
                <span>+ KES {item.prizeKes.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6 Dots */}
      <div className="mt-2.5 flex justify-center gap-1.5">
        {stream.slice(0, 6).map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full bg-[color:var(--muted-foreground)]/30 transition-all duration-300"
            style={{
              width: i === index % 6 ? 16 : 6,
              background: i === index % 6 ? (stream[index]?.isWin ? "oklch(0.7 0.2 145)" : "var(--gold)") : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
