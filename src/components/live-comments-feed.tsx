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

// Rich multi-language Kenyan winning comments (Kiluo, Kikuyu, Kisii, Kalenjin, Luhya, Swahili, Sheng, English) with emojis
const WINNING_COMMENTS = [
  { text: "Stay guided omera! KES 20,000 confirmed for Kisumu! 🎉🔥", lang: "Jaluo / Kisumu" },
  { text: "Eeeh Ngai fafa 20,000 kwa Mpesa hapo hapo! Njuguna ameamini! 🙌💸", lang: "Kikuyu / Nyeri" },
  { text: "Omwabo! Kisii town represent! 25,000 payout received! 🤑💃", lang: "Kisii / Kisii" },
  { text: "Chebet happy 25,000 loaded! Eldoret champion! 🏃💨🥳", lang: "Kalenjin / Eldoret" },
  { text: "Omwami! Kakamega power 20,000 is real! 💪🎉", lang: "Luhya / Kakamega" },
  { text: "Ero! Mpesa alert 20,000 landed live on phone! 📱✨", lang: "Jaluo / Homa Bay" },
  { text: "Wairimu happiness overloaded! 50,000 won clean! 💎🚀", lang: "Kikuyu / Kiambu" },
  { text: "Mogaka joyful! 25k instant payout alert! 🍀🥳", lang: "Kisii / Nyamira" },
  { text: "Kipchoge speed! 20,000 credited live! 🔥🇰🇪", lang: "Kalenjin / Iten" },
  { text: "Webuye represent! 25,000 alert received wuuuh! 🎉💸", lang: "Luhya / Webuye" },
  { text: "Wuod Baba! 50,000 in the bag! Siaya power! 🚀🎉", lang: "Jaluo / Siaya" },
  { text: "Ngai fafa 25,000 loaded instant! Karatina vibes! 🙌💰", lang: "Kikuyu / Karatina" },
  { text: "Stay guided I won 20,000! Machakos represent! 🇰🇪🎉", lang: "Kamba / Machakos" },
  { text: "Manze 25k alert just popped on my phone! Thika power! 📱🔥", lang: "Sheng / Thika" },
  { text: "No way! Matched 11/12! 50,000 jackpot winner here! 💎👑", lang: "English / Nairobi" },
  { text: "Mombasa raha! 20,000 credited live on Mpesa! 🌊💸", lang: "Swahili / Mombasa" },
  { text: "Kericho tea land! 25,000 payout received! 🍵🥳", lang: "Kalenjin / Kericho" },
  { text: "Ruiru cyber guy here! 20,000 alert confirmed! 💻🚀", lang: "Sheng / Ruiru" },
];

const NON_WIN_MESSAGES = [
  "Almost got half! Let's go again! 🤞",
  "Missed by just 2 numbers, warm up done! 😤",
  "Chapaa inakuja soon, next spin is mine! 💸",
  "Bahati iko karibu leo, trying again! 🍀",
  "One more spin, jackpot loading! 🚀",
  "Just missed 9/12! Spinning right now! 💔",
  "Warm up spin done! Nakuja tena 💥",
  "Enyewe, warm up spin done ✌️",
  "Bahati iko karibu 😱",
  "Wueh, Bahati mbaya 😭",
  "Getting closer 😭",
  "Trust the process 🤞",
];

const CITIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Nyeri", "Kakamega",
  "Siaya", "Karatina", "Ruiru", "Kericho", "Iten", "Homa Bay", "Kiambu", "Machakos",
  "Meru", "Webuye", "Naivasha", "Garissa", "Kilifi", "Embu", "Kitale", "Nanyuki", "Kisii"
];

// Generates an organic stream with exact specified win ratios (2 wins in 6, 4 in 10, ~8 in 25)
export function generateOrganicStream(count = 25): StreamItem[] {
  const list: StreamItem[] = [];
  const prefixes = ["0712", "0722", "0740", "0798", "0715", "0733", "0721", "0701", "0758", "0714", "0728", "0745", "0790", "0711", "0720", "0734", "0792", "0719", "0708", "0796"];

  for (let i = 0; i < count; i++) {
    // Win ratio pattern: 2 wins every 6 items (e.g. index 1, 4 in each 6-item block)
    const posInBlock = i % 6;
    const isWin = posInBlock === 1 || posInBlock === 4;

    const phone = `${prefixes[i % prefixes.length]}****${Math.floor(10 + Math.random() * 89)}`;
    const city = CITIES[i % CITIES.length];

    if (isWin) {
      const r = Math.random();
      // 9/12 = KES 20,000, 10/12 = KES 25,000, 11/12 = KES 50,000
      const matched = r < 0.60 ? 9 : r < 0.90 ? 10 : 11;
      let prizeKes = 20000;
      if (matched === 10) prizeKes = 25000;
      if (matched === 11) prizeKes = 50000;

      const commentObj = WINNING_COMMENTS[i % WINNING_COMMENTS.length];

      list.push({
        id: i,
        phone,
        matched,
        prizeKes,
        city,
        comment: commentObj.text,
        langTag: commentObj.lang,
        ago: `${(i + 1) * 12}s ago`,
        isWin: true,
      });
    } else {
      const matched = Math.floor(4 + Math.random() * 4); // 4 to 7
      list.push({
        id: i,
        phone,
        matched,
        city,
        comment: NON_WIN_MESSAGES[i % NON_WIN_MESSAGES.length],
        langTag: `${city} Player`,
        ago: `${(i + 1) * 10}s ago`,
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

      {/* Reduced 6 Dots */}
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
