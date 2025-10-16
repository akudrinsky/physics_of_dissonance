import { renderToString } from "katex";
import type { ReactNode } from "react";

type Explorer = {
  name: string;
  blurb: string;
  outcomes: string[];
};

type PipelineStep = {
  title: string;
  summary: string;
  formula?: string;
  details?: string[];
  constantsTable?: Array<{ constant: string; value: string; role: string }>;
  definitions?: Array<{ symbol: string; description: ReactNode }>;
};

type Experiment = {
  title: string;
  tweak: string;
  outcome: string;
};

function InlineFormula({ expression }: { expression: string }) {
  const html = renderToString(expression, {
    throwOnError: false,
    displayMode: false,
    strict: "ignore",
  });
  return <span className="text-white" dangerouslySetInnerHTML={{ __html: html }} />;
}

const explorers: Explorer[] = [
  {
    name: "Dyadic explorer",
    blurb:
      "Sweep a two-tone ratio from 1.00 → 2.00 and listen as the roughness landscape morphs with every harmonic layer.",
    outcomes: [
      "Locate the exact interval where beating collapses into smoothness.",
      "Contrast bright and dark spectra to hear how the same ratio changes character.",
    ],
  },
  {
    name: "Triad explorer",
    blurb:
      "Roam a consonance surface for three-note chords anchored to A₄ = 220 Hz and audition any coordinate instantly.",
    outcomes: [
      "Spot the ridges of maximum smoothness before committing them to the keyboard.",
      "Capture triads that stay gentle even as you retune their third note.",
    ],
  },
];

const pipeline: PipelineStep[] = [
  {
    title: "1. Loudness weighting",
    summary:
      "Amplitude alone misleads the ear. Each partial is converted to perceived loudness so bright spectra keep their influence downstream.",
    formula: String.raw`L(a_k) = \frac{2^{\frac{20 \log_{10} a_k}{10}}}{16}`,
    details: ["Higher-amplitude partials stay proportionally louder, maintaining the timbre’s character as we compare ratios."],
    definitions: [
      {
        symbol: String.raw`a_k`,
        description: (
          <>
            Amplitude of the k-th harmonic partial in the spectrum <InlineFormula expression="S" />.
          </>
        ),
      },
      {
        symbol: String.raw`L(a_k)`,
        description: <>Perceptual loudness weight assigned to partial <InlineFormula expression="k" />.</>,
      },
      {
        symbol: String.raw`L_k`,
        description: (
          <>
            Short-hand for <InlineFormula expression="L(a_k)" />, used when combining partial <InlineFormula expression="k" /> with
            others.
          </>
        ),
      },
    ],
  },
  {
    title: "2. Sethares roughness kernel",
    summary:
      "Pairs of partials interact through a difference-of-exponentials kernel that captures the rise and fall of beating within a critical band.",
    formula: String.raw`\begin{aligned}
R(f_1,f_2,L_1,L_2) &= \min(L_1,L_2)\left(e^{-b_1 p} - e^{-b_2 p}\right) \\
p &= \frac{x\,|f_1-f_2|}{s_1\min(f_1,f_2) + s_2}
\end{aligned}`,
    constantsTable: [
      { constant: "x", value: "0.24", role: "Maps frequency gaps into critical-band units." },
      { constant: "s₁", value: "0.0207", role: "Broadens bands higher in the spectrum." },
      { constant: "s₂", value: "18.96", role: "Baseline bandwidth at low frequencies." },
      { constant: "b₁, b₂", value: "3.51, 5.75", role: "Shape where beating peaks before decaying." },
    ],
    details: ["Unison cancels the kernel, one critical band maximises roughness, and wide separations decouple the tones."],
    definitions: [
      {
        symbol: String.raw`f_1, f_2`,
        description: <>Frequencies of the two interacting partials.</>,
      },
      {
        symbol: String.raw`L_1, L_2`,
        description: (
          <>
            Loudness weights for each partial after step&nbsp;1 (<InlineFormula expression="L(a_k)" />).
          </>
        ),
      },
      {
        symbol: String.raw`p`,
        description: (
          <>
            Scaled separation of the partials, measured in critical-band units via{" "}
            <InlineFormula expression={String.raw`\frac{x\,|f_1-f_2|}{s_1\min(f_1,f_2)+s_2}`} />.
          </>
        ),
      },
    ],
  },
  {
    title: "3. Aggregate dyads",
    summary:
      "For a candidate ratio r, every unordered pair across the root and shifted spectra is tallied. Cross-terms reveal the valleys musicians seek.",
    formula: String.raw`\begin{aligned}
D_2(f_0, r, S) = \tfrac{1}{2} \sum_{i,j}\Big[
&\tfrac{1}{2} R(f_0\omega_i, f_0\omega_j, L_i, L_j) + \tfrac{1}{2} R(r f_0\omega_i, r f_0\omega_j, L_i, L_j) \\
&+ R(f_0\omega_i, r f_0\omega_j, L_i, L_j)
\Big]
\end{aligned}`,
    details: ["Normalising each sweep to its own maximum keeps different timbres comparable on a 0–1 scale."],
    definitions: [
      {
        symbol: String.raw`f_0`,
        description: <>Reference pitch for the sweep (220 Hz by default).</>,
      },
      {
        symbol: String.raw`r`,
        description: <>Candidate interval ratio measured against <InlineFormula expression="f_0" />.</>,
      },
      {
        symbol: String.raw`S`,
        description: (
          <>
            Set of harmonic partials <InlineFormula expression={String.raw`\{(\omega_k, a_k)\}`} /> describing the spectrum.
          </>
        ),
      },
      {
        symbol: String.raw`\omega_i`,
        description: <>Normalised frequency multiplier for partial <InlineFormula expression="i" />.</>,
      },
      {
        symbol: String.raw`L_i`,
        description: (
          <>
            Loudness weight of partial <InlineFormula expression="i" />, equal to <InlineFormula expression="L(a_i)" /> from step&nbsp;1.
          </>
        ),
      },
    ],
  },
  {
    title: "4. Expand to triads",
    summary:
      "Introduce a third ratio s and repeat the pairing across {f₀, r f₀, s f₀}. The resulting grid produces the interactive consonance terrain.",
    formula: String.raw`\begin{aligned}
D_3(f_0,r,s,S)
&= \tfrac{1}{2} \sum_{i,j} \sum_{\substack{u,v \in \{f_0, r f_0, s f_0\} \\ u \le v}}
R(u\,\omega_i,\; v\,\omega_j,\; L_i,\; L_j)
\end{aligned}`,
    details: ["Global normalisation lets bright and mellow timbres share the same visual scale without bias."],
    definitions: [
      {
        symbol: String.raw`s`,
        description: <>Second interval ratio relative to <InlineFormula expression="f_0" />.</>,
      },
      {
        symbol: String.raw`u, v`,
        description: (
          <>
            Members of the set <InlineFormula expression={String.raw`\{f_0,\; r f_0,\; s f_0\}`} /> that form each unordered pair in
            the sum.
          </>
        ),
      },
      {
        symbol: String.raw`i, j`,
        description: (
          <>
            Indices that traverse partials in <InlineFormula expression="S" /> so every unordered pair of harmonics contributes.
          </>
        ),
      },
      {
        symbol: String.raw`L_i, L_j`,
        description: (
          <>
            Loudness weights from step&nbsp;1 matched to partials <InlineFormula expression="i" /> and{" "}
            <InlineFormula expression="j" />.
          </>
        ),
      },
    ],
  },
];

const experiments: Experiment[] = [
  {
    title: "Bright vs. dark timbre",
    tweak: "Adjust the spectral rolloff slider.",
    outcome: "Hear valleys deepen and shift as upper partials gain or lose weight.",
  },
  {
    title: "Just-intonation landmarks",
    tweak: "Toggle the preset markers and audition each.",
    outcome: "Confirm that classic just ratios coincide with the smoothest basins.",
  },
  {
    title: "Equal temperament check",
    tweak: "Snap ratios to 12-TET steps.",
    outcome: "Notice how tempered chords hover above valley floors, revealing residual beating.",
  },
  {
    title: "Register shifts",
    tweak: "Move the base pitch f₀ up or down.",
    outcome: "Watch the valley lattice stretch or squeeze with the ear’s changing critical bands.",
  },
];

function Formula({ expression, align = "center" }: { expression: string; align?: "left" | "center" }) {
  const alignmentClass = align === "left" ? "text-left" : "text-center";
  const html = renderToString(expression, {
    throwOnError: false,
    displayMode: true,
    strict: "ignore",
  });
  return <div className={`${alignmentClass} text-base leading-relaxed`} dangerouslySetInnerHTML={{ __html: html }} />;
}

function PipelineCard({ step }: { step: PipelineStep }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-black/20 space-y-4">
      <h3 className="text-lg font-medium text-white">{step.title}</h3>
      <p className="text-sm text-gray-300">{step.summary}</p>
      {step.formula ? <Formula expression={step.formula} /> : null}
      {step.definitions ? (
        <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4 text-sm text-gray-300">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Symbols</p>
          <dl className="mt-3 space-y-2">
            {step.definitions.map((item) => (
              <div key={item.symbol} className="flex gap-3">
                <dt className="w-20 shrink-0 font-semibold text-white">
                  <InlineFormula expression={item.symbol} />
                </dt>
                <dd className="text-gray-300">{item.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {step.constantsTable ? (
        <div className="overflow-x-auto">
          <table className="mt-2 w-full table-auto text-sm text-gray-300 [&_th]:text-left [&_th]:font-semibold [&_td]:py-1.5 [&_td]:align-top [&_td]:pr-4">
            <thead className="text-white">
              <tr>
                <th scope="col">constant</th>
                <th scope="col">value</th>
                <th scope="col">role</th>
              </tr>
            </thead>
            <tbody>
              {step.constantsTable.map((row) => (
                <tr key={row.constant} className="border-t border-white/10">
                  <td className="font-medium text-white">{row.constant}</td>
                  <td>{row.value}</td>
                  <td>{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {step.details?.map((text) => (
        <p key={text} className="text-sm text-gray-400">
          {text}
        </p>
      ))}
    </div>
  );
}

export default function TheoryPage() {
  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950 px-6 py-10 sm:px-10 sm:py-16">
        <div className="absolute inset-y-10 -left-32 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-y-16 -right-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.35em] text-white/70">
            Theory notes
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">Physics of Dissonance</h1>
          <p className="max-w-2xl text-base text-white/80">
            This project reframes William Sethares’s roughness research in TypeScript so visuals, math, and audio share a
            single engine. Use these notes as the map linking each equation to what you see and hear in the explorers.
          </p>
          <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
            {explorers.map((item) => (
              <div key={item.name} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <h2 className="text-base font-semibold text-white">{item.name}</h2>
                <p className="mt-2 text-sm text-white/70">{item.blurb}</p>
                <ul className="mt-3 space-y-1 text-xs text-white/60">
                  {item.outcomes.map((outcome) => (
                    <li key={outcome}>• {outcome}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">Signal pipeline</h2>
        <p className="max-w-2xl text-sm text-gray-300">
          Both explorers follow the same four stages. Loudness weighting prepares the spectrum, the Sethares kernel scores
          every beating pair, and the aggregates surface the low-roughness regions that feel consonant.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          {pipeline.map((step) => (
            <PipelineCard key={step.title} step={step} />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">Shared audio engine</h2>
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <h3 className="text-lg font-medium text-white">ReferenceSynth in brief</h3>
            <ul className="mt-4 space-y-3 text-sm text-gray-300">
              <li>Each harmonic partial gets its own oscillator and gain envelope, mirroring the original dissonance demo.</li>
              <li>Fast 2 ms fades prevent clicks, while longer releases let chords blossom before settling.</li>
              <li>A shared AudioContext and cross-fade messaging ensure only the current chord rings out.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-emerald-900/40 p-6 text-sm text-emerald-100">
            <h3 className="text-lg font-medium text-white">Why it matters</h3>
            <p className="mt-3">
              Visual cues and sonic feedback stay perfectly aligned—when you discover a smooth island on the plot, the
              chord you hear already reflects the same parameters.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">Experiment playbook</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {experiments.map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Scenario</p>
              <h3 className="mt-2 text-lg font-medium text-white">{item.title}</h3>
              <p className="mt-3 text-sm text-sky-200/80">
                <span className="font-semibold text-sky-100">Try:</span> {item.tweak}
              </p>
              <p className="mt-2 text-sm text-gray-300">{item.outcome}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
