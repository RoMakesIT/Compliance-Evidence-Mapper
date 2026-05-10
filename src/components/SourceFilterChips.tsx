import { SOURCE_SYSTEMS } from "@/lib/source-systems";
import { cn } from "@/lib/utils";

interface Props {
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}

// Multi-select chip row. ANY semantics: a row matches if its source_hints
// intersect the selected set (empty selection = no filter).
export function SourceFilterChips({ selected, onToggle, onClear }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
        Source
      </span>
      {SOURCE_SYSTEMS.map((s) => {
        const active = selected.has(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
            className={cn(
              "h-6 rounded-full border px-2.5 text-xs transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted text-muted-foreground border-border",
            )}
          >
            {s}
          </button>
        );
      })}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
