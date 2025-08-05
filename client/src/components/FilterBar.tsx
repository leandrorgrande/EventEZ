interface FilterBarProps {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function FilterBar({ currentFilter, onFilterChange }: FilterBarProps) {
  const filters = [
    { id: "all", label: "All", icon: "🌍" },
    { id: "clubs", label: "Clubs", icon: "🎵" },
    { id: "bars", label: "Bars", icon: "🍹" },
    { id: "shows", label: "Shows", icon: "🎭" },
    { id: "fairs", label: "Fairs", icon: "🏪" },
    { id: "food", label: "Food", icon: "🍽️" },
  ];

  return (
    <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-3 border border-slate-700">
      <div className="flex items-center space-x-2 overflow-x-auto">
        <span className="text-sm text-gray-300 whitespace-nowrap mr-2">Filter:</span>
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`filter-chip ${
              currentFilter === filter.id ? "active" : ""
            }`}
            data-testid={`filter-${filter.id}`}
          >
            <span className="mr-1">{filter.icon}</span>
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
