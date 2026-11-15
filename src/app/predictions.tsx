// PREDICTIONS screen (third tab).
// 1. The model's prediction for the next race and qualifying, with "why".
// 2. Your own picks (P1, P2, P3, pole), compared with the model's.
// 3. Your record: after each race, your score vs the model's score.
// 4. A plain explanation of how the model works.
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getQualifying, getRaceResults, Race } from "@/api/jolpica";
import { LoadState } from "@/components/LoadState";
import { Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { loadAllPicks, pickId, PickSet, savePick, scorePicks, Slot, SLOTS } from "@/lib/picks";
import { loadPredictionData } from "@/lib/predictionData";
import { DriverPrediction, Factor, Mode, predict } from "@/lib/predictionModel";
import { getSessions } from "@/lib/sessions";
import { useAsync } from "@/lib/useAsync";
import { TextKey, useLang } from "@/i18n";
import { colors, fonts } from "@/theme";

const pct = (p: number) => (p > 0 && p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);

export default function PredictionsScreen() {
  const { t } = useLang();
  const { data, error, retry } = useAsync(async () => ({ result: await loadPredictionData() }), []);
  const [mode, setMode] = useState<Mode>("race");
  const [savedVersion, setSavedVersion] = useState(0);

  if (!data) {
    return (
      <Screen title={t("tabPredictions")}>
        <LoadState error={error} onRetry={retry} message={t("modelLoading")} />
      </Screen>
    );
  }

  if (!data.result) {
    return (
      <Screen title={t("tabPredictions")}>
        <Text style={styles.message}>{t("noUpcoming")}</Text>
        <HistoryCard version={savedVersion} />
      </Screen>
    );
  }

  const { race, drivers } = data.result;
  const seed = Number(race.season) * 100 + Number(race.round); // same race = same numbers
  const racePrediction = predict(drivers, "race", seed);
  const qualiPrediction = predict(drivers, "quali", seed + 1);

  return (
    <Screen title={t("tabPredictions")} subtitle={`${race.raceName} · ${t("round")} ${race.round}`}>
      <RaceTimes race={race} />

      <Segmented
        options={[
          { key: "race", label: t("race") },
          { key: "quali", label: t("quali") },
        ]}
        value={mode}
        onChange={setMode}
      />
      <ModelTable predictions={mode === "race" ? racePrediction : qualiPrediction} mode={mode} />

      <PicksCard
        race={race}
        racePrediction={racePrediction}
        qualiPrediction={qualiPrediction}
        onSaved={() => setSavedVersion((v) => v + 1)}
      />

      <HistoryCard version={savedVersion} />

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("howItWorks").toUpperCase()}</Text>
        <Text style={styles.body}>{t("howItWorksText")}</Text>
        <Pressable onPress={() => router.push("/accuracy")}>
          <Text style={styles.link}>{t("testModel")} ›</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// ---------- When are qualifying and the race? ----------

function RaceTimes({ race }: { race: Race }) {
  const { t, locale } = useLang();
  const sessions = getSessions(race).filter((s) => s.key === "quali" || s.key === "race");
  return (
    <View style={styles.timesRow}>
      {sessions.map((s) => (
        <View key={s.key} style={styles.timeBox}>
          <Text style={styles.timeLabel}>{t(s.key).toUpperCase()}</Text>
          <Text style={styles.timeValue}>
            {s.start.toLocaleString(locale, {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------- The model's table ----------

function ModelTable({ predictions, mode }: { predictions: DriverPrediction[]; mode: Mode }) {
  const { t } = useLang();
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = showAll ? predictions : predictions.slice(0, 10);
  const maxP1 = Math.max(...predictions.map((p) => p.p1), 0.01);

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t("modelPrediction").toUpperCase()}</Text>
      <Text style={styles.hint}>{t("tapForWhy")}</Text>

      <View style={styles.tableHead}>
        <Text style={[styles.headText, { flex: 1 }]} />
        <Text style={styles.headText}>{mode === "race" ? t("winPct") : t("polePct")}</Text>
        <Text style={styles.headText}>{mode === "race" ? t("podiumPct") : t("top3Pct")}</Text>
        <Text style={styles.headText}>{t("top10Pct")}</Text>
      </View>

      {shown.map((p, i) => (
        <Pressable key={p.driverId} onPress={() => setOpenId(openId === p.driverId ? null : p.driverId)}>
          <View style={styles.predRow}>
            <Text style={styles.pos}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.sub}>{p.team}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { width: `${Math.round((p.p1 / maxP1) * 100)}%` }]} />
              </View>
            </View>
            <Text style={[styles.num, styles.numMain]}>{pct(p.p1)}</Text>
            <Text style={styles.num}>{pct(p.top3)}</Text>
            <Text style={styles.num}>{pct(p.top10)}</Text>
          </View>
          {openId === p.driverId && <WhyBox prediction={p} />}
        </Pressable>
      ))}

      <Pressable onPress={() => setShowAll(!showAll)}>
        <Text style={styles.link}>{showAll ? t("showLess") : t("showAll")}</Text>
      </Pressable>
    </View>
  );
}

function WhyBox({ prediction }: { prediction: DriverPrediction }) {
  const { t } = useLang();
  const form = prediction.factors.find((f) => f.key === "form");
  const line = (f: Factor) => {
    if (f.avg === null) return f.key === "track" ? t("whyTrackNone") : t("whyNoData");
    const key: TextKey =
      f.key === "form" ? "whyForm" : f.key === "quali" ? "whyQuali" : f.key === "team" ? "whyTeam" : "whyTrack";
    return `${t(key, { x: f.avg.toFixed(1), n: f.count })}  ·  ${t("weight")} ${Math.round(f.weight * 100)}%`;
  };
  return (
    <View style={styles.why}>
      {form?.avg === null ? (
        <Text style={styles.whyText}>• {t("whyNoData")}</Text>
      ) : (
        prediction.factors.map((f) => (
          <Text key={f.key} style={styles.whyText}>
            • {line(f)}
          </Text>
        ))
      )}
      <Text style={styles.whyStrong}>
        {t("strongest")}: {t(`factor_${prediction.strongest}` as TextKey)}
      </Text>
    </View>
  );
}

// ---------- Your picks ----------

function PicksCard(props: {
  race: Race;
  racePrediction: DriverPrediction[];
  qualiPrediction: DriverPrediction[];
  onSaved: () => void;
}) {
  const { t } = useLang();
  const { race, racePrediction, qualiPrediction } = props;
  const id = pickId(race.season, race.round);
  const [existing] = useState(() => loadAllPicks()[id]);
  const [picks, setPicks] = useState<PickSet>(existing?.user ?? {});
  const [active, setActive] = useState<Slot>("p1");
  const [isSaved, setIsSaved] = useState(Boolean(existing));

  const codes: Record<string, string> = {};
  for (const p of racePrediction) codes[p.driverId] = p.code;

  const modelPicks: PickSet = {
    p1: racePrediction[0]?.driverId,
    p2: racePrediction[1]?.driverId,
    p3: racePrediction[2]?.driverId,
    pole: qualiPrediction[0]?.driverId,
  };

  const qualiStart = getSessions(race).find((s) => s.key === "quali")?.start;
  const locked = qualiStart ? Date.now() >= qualiStart.getTime() : false;
  const agreement = SLOTS.filter((s) => picks[s] && picks[s] === modelPicks[s]).length;

  const choose = (driverId: string) => {
    if (locked) return;
    const next: PickSet = { ...picks };
    // The same driver can't be on the podium twice.
    if (active !== "pole") {
      for (const s of ["p1", "p2", "p3"] as const) if (next[s] === driverId) delete next[s];
    }
    next[active] = driverId;
    setPicks(next);
    setIsSaved(false);
    const empty = SLOTS.find((s) => !next[s]);
    if (empty) setActive(empty);
  };

  const save = () => {
    savePick({
      season: race.season,
      round: race.round,
      raceName: race.raceName,
      user: picks,
      model: modelPicks,
      names: codes,
      savedAt: Date.now(),
    });
    setIsSaved(true);
    props.onSaved();
  };

  const slotLabel = (s: Slot) => (s === "pole" ? t("polePct") : s.toUpperCase());

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t("yourPicks").toUpperCase()}</Text>
      <Text style={styles.hint}>{locked ? t("locked") : t("pickHint")}</Text>

      <View style={styles.slots}>
        {SLOTS.map((s) => (
          <Pressable
            key={s}
            onPress={() => !locked && setActive(s)}
            style={[styles.slot, active === s && !locked && styles.slotActive]}
          >
            <Text style={styles.slotLabel}>{slotLabel(s)}</Text>
            <Text style={styles.slotValue}>{picks[s] ? codes[picks[s] as string] : "—"}</Text>
            <Text style={styles.slotModel}>
              {t("modelPick")}: {modelPicks[s] ? codes[modelPicks[s] as string] : "—"}
            </Text>
          </Pressable>
        ))}
      </View>

      {!locked && (
        <View style={styles.chips}>
          {racePrediction.map((p) => {
            const chosen = picks[active] === p.driverId;
            return (
              <Pressable key={p.driverId} onPress={() => choose(p.driverId)} style={[styles.chip, chosen && styles.chipOn]}>
                <Text style={[styles.chipText, chosen && styles.chipTextOn]}>{p.code}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {Object.keys(picks).length > 0 && <Text style={styles.hint}>{t("agreement", { x: agreement })}</Text>}

      {!locked && (
        <Pressable
          onPress={save}
          disabled={isSaved || Object.keys(picks).length === 0}
          style={[styles.button, (isSaved || Object.keys(picks).length === 0) && styles.buttonDone]}
        >
          <Text style={styles.buttonText}>{isSaved ? t("saved") : t("savePicks")}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------- Your record vs the model ----------

function HistoryCard({ version }: { version: number }) {
  const { t } = useLang();
  const { data } = useAsync(async () => {
    const saved = Object.values(loadAllPicks())
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, 8);
    const rows = [];
    for (const p of saved) {
      const results = (await getRaceResults(p.season, p.round).catch(() => undefined))?.Results ?? [];
      if (results.length === 0) continue; // race hasn't happened yet
      const quali = await getQualifying(p.season, p.round).catch(() => []);
      const podium = ["1", "2", "3"].map((pos) => results.find((r) => r.position === pos)?.Driver.driverId ?? "");
      const pole = quali.find((q) => q.position === "1")?.Driver.driverId;
      rows.push({ pick: p, you: scorePicks(p.user, podium, pole), model: scorePicks(p.model, podium, pole) });
    }
    return rows;
  }, [version]);

  const rows = data ?? [];
  const youTotal = rows.reduce((sum, r) => sum + r.you, 0);
  const modelTotal = rows.reduce((sum, r) => sum + r.model, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t("record").toUpperCase()}</Text>
      {rows.length === 0 ? (
        <Text style={styles.body}>{t("noHistory")}</Text>
      ) : (
        <>
          <View style={styles.scoreRow}>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreValue}>{youTotal}</Text>
              <Text style={styles.scoreLabel}>{t("you")}</Text>
            </View>
            <Text style={styles.vs}>vs</Text>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreValue}>{modelTotal}</Text>
              <Text style={styles.scoreLabel}>{t("modelPick")}</Text>
            </View>
          </View>
          {rows.map((r) => (
            <View key={pickId(r.pick.season, r.pick.round)} style={styles.historyRow}>
              <Text style={styles.name}>{r.pick.raceName}</Text>
              <Text style={styles.num}>
                {r.you} – {r.model}
              </Text>
            </View>
          ))}
        </>
      )}
      <Text style={styles.hint}>{t("scoring")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  message: { color: colors.muted, fontSize: 15, textAlign: "center", marginTop: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardLabel: { color: colors.accent, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  hint: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  link: { color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: 4 },

  timesRow: { flexDirection: "row", gap: 10 },
  timeBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  timeLabel: { color: colors.amber, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  timeValue: { color: colors.text, fontSize: 13, fontFamily: fonts.mono, marginTop: 4 },

  tableHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 34 },
  headText: { width: 54, color: colors.muted, fontSize: 10, fontWeight: "700", textAlign: "right" },
  predRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pos: { width: 28, color: colors.muted, fontSize: 14, fontFamily: fonts.mono, textAlign: "right" },
  name: { color: colors.text, fontSize: 14, fontWeight: "600" },
  sub: { color: colors.muted, fontSize: 11 },
  barTrack: { height: 3, backgroundColor: colors.border, borderRadius: 2, marginTop: 4, overflow: "hidden" },
  bar: { height: 3, backgroundColor: colors.accent },
  num: { width: 54, color: colors.text, fontSize: 13, fontFamily: fonts.mono, textAlign: "right" },
  numMain: { color: colors.accent, fontWeight: "700" },

  why: { backgroundColor: colors.bg, borderRadius: 10, padding: 10, gap: 4, marginBottom: 8 },
  whyText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  whyStrong: { color: colors.amber, fontSize: 12, fontWeight: "700", marginTop: 2 },

  slots: { flexDirection: "row", gap: 8 },
  slot: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  slotActive: { borderColor: colors.accent },
  slotLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  slotValue: { color: colors.text, fontSize: 18, fontWeight: "800", fontFamily: fonts.mono, marginVertical: 2 },
  slotModel: { color: colors.muted, fontSize: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "700", fontFamily: fonts.mono },
  chipTextOn: { color: colors.onAccent },
  button: { backgroundColor: colors.accentFill, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  buttonDone: { backgroundColor: colors.border },
  buttonText: { color: colors.onAccent, fontWeight: "800" },

  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  scoreBox: { alignItems: "center" },
  scoreValue: { color: colors.text, fontSize: 32, fontWeight: "800", fontFamily: fonts.mono },
  scoreLabel: { color: colors.muted, fontSize: 12 },
  vs: { color: colors.muted, fontSize: 14 },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
