"use client";

interface ReviewButtonsProps {
  onRate: (quality: number) => void;
  disabled: boolean;
}

export default function ReviewButtons({ onRate, disabled }: ReviewButtonsProps) {
  return (
    <div className="flex gap-3 justify-center mt-6">
      <button
        onClick={() => onRate(0)}
        disabled={disabled}
        className="px-6 py-3 rounded-xl bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition disabled:opacity-50"
      >
        Didn&apos;t get it
      </button>
      <button
        onClick={() => onRate(3)}
        disabled={disabled}
        className="px-6 py-3 rounded-xl bg-yellow-100 text-yellow-700 font-semibold hover:bg-yellow-200 transition disabled:opacity-50"
      >
        Medium
      </button>
      <button
        onClick={() => onRate(5)}
        disabled={disabled}
        className="px-6 py-3 rounded-xl bg-green-100 text-green-700 font-semibold hover:bg-green-200 transition disabled:opacity-50"
      >
        Easy
      </button>
    </div>
  );
}
