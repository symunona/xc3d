import { For } from "solid-js";
import { PALETTE } from "../lib/colors";

export default function ColorPicker(props: {
  value: string;
  onChange: (c: string) => void;
  taken?: string[];
}) {
  return (
    <div class="flex flex-wrap gap-2">
      <For each={PALETTE}>
        {(c) => {
          const isTaken = () => !!props.taken?.includes(c) && c !== props.value;
          return (
            <button
              type="button"
              disabled={isTaken()}
              title={isTaken() ? "already used by another pilot" : c}
              onClick={() => { if (!isTaken()) props.onChange(c); }}
              style={{
                "background-color": c,
                width: "26px",
                height: "26px",
                "border-radius": "8px",
                outline: props.value === c ? "2px solid var(--text)" : "none",
                "outline-offset": "2px",
                opacity: isTaken() ? "0.3" : "1",
                cursor: isTaken() ? "not-allowed" : "pointer",
              }}
            />
          );
        }}
      </For>
    </div>
  );
}
