interface ProgressSidebarProps {
  reviewedCount: number;
  totalCards: number;
  correctCount: number;
  totalRatings: number;
}

export default function ProgressSidebar({
  reviewedCount,
  totalCards,
  correctCount,
  totalRatings,
}: ProgressSidebarProps) {
  const progress = totalCards > 0 ? Math.min(reviewedCount / totalCards, 1) : 0;
  const accuracy = totalRatings > 0 ? Math.round((correctCount / totalRatings) * 100) : 0;

  return (
    <div className="hidden lg:flex flex-col items-center w-14 shrink-0 py-4 select-none">
      {/* Vertical progress track */}
      <div className="relative w-6 flex-1 min-h-[120px] flex flex-col items-center">
        {/* Finish line at top */}
        <div className="text-sm mb-1">🥕</div>

        {/* Track */}
        <div className="relative flex-1 w-1.5 bg-gray-200 rounded-full overflow-visible">
          {/* Rabbit - moves from bottom to top */}
          <div
            className="absolute left-1/2 -translate-x-1/2 text-base transition-all duration-500 ease-out"
            style={{ bottom: `calc(${progress * 100}% - 10px)` }}
          >
            🐇
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-2 text-center space-y-0.5">
        <div className="text-[10px] text-gray-500 font-medium">
          {reviewedCount} / {totalCards}
        </div>
        <div className="text-[9px] text-gray-400">reviewed</div>
        {totalRatings > 0 && (
          <>
            <div className="text-[10px] text-gray-500 font-medium mt-1">
              {accuracy}%
            </div>
            <div className="text-[9px] text-gray-400">accuracy</div>
          </>
        )}
      </div>
    </div>
  );
}
