import { MagnifyingGlassIcon } from "@phosphor-icons/react";

import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export function SearchForm({ ...props }: React.ComponentProps<"form">) {
  return (
    <form {...props}>
      <Label htmlFor="search" className="sr-only">
        Search
      </Label>
      {/* InputGroup owns the icon slot, so the absolutely positioned icon and
          its matching left padding are gone. Bordered boxes belong to forms;
          up here the field is a tinted well that lifts on focus, so it reads
          as part of the bar rather than an input dropped into it. */}
      <InputGroup className="bg-foreground/[0.04] h-9 rounded-xl border-transparent shadow-none transition-colors focus-within:bg-foreground/[0.07] sm:w-60 dark:bg-foreground/[0.05]">
        <InputGroupAddon>
          <MagnifyingGlassIcon
            weight="light"
            className="text-muted-foreground size-[17px]"
          />
        </InputGroupAddon>
        <InputGroupInput
          id="search"
          placeholder="Search"
          className="text-sm placeholder:text-muted-foreground/60"
        />
      </InputGroup>
    </form>
  );
}
