"use client";

interface ReviewButtonsProps {
  onRate: (quality: number) => void;
  disabled: boolean;
}

export default function ReviewButtons({ onRate, disabled }: ReviewButtonsProps) {
  return (
    <div className="flex gap-2 justify-center mt-3">
      <button
        onClick={() => onRate(5)}
        disabled={disabled}
        className="px-4 py-2 rounded-lg bg-green-100 text-green-700 text-sm font-semibold hover:bg-green-200 transition disabled:opacity-50"
      >
        1 Easy
      </button>
      <button
        onClick={() => onRate(3)}
        disabled={disabled}
        className="px-4 py-2 rounded-lg bg-yellow-100 text-yellow-700 text-sm font-semibold hover:bg-yellow-200 transition disabled:opacity-50"
      >
        2 Medium
      </button>
      <button
        onClick={() => onRate(0)}
        disabled={disabled}
        className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-semibold hover:bg-red-200 transition disabled:opacity-50"
      >
        3 Didn&apos;t get it
      </button>
    </div>
  );
}
