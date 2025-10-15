"use client";

type SliderControlProps = {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  accent?: "sky" | "orange";
  onChange: (value: number) => void;
};

export function SliderControl({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
  accent = "sky",
}: SliderControlProps) {
  const accentClass = accent === "orange" ? "accent-orange-500" : "accent-blue-500";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <span className="text-sm font-mono bg-slate-800 px-2 py-1 rounded text-gray-200">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        className={`w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer ${accentClass}`}
      />
    </div>
  );
}
