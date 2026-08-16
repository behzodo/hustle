import { MagnifyingGlassIcon } from "@phosphor-icons/react"

import { Label } from "@/components/ui/label"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

export function SearchForm({ ...props }: React.ComponentProps<"form">) {
  return (
    <form {...props}>
      <Label htmlFor="search" className="sr-only">
        Search
      </Label>
      {/* InputGroup owns the icon slot, so the absolutely positioned icon and
          its matching left padding are gone. */}
      <InputGroup className="h-8 sm:w-56">
        <InputGroupAddon>
          <MagnifyingGlassIcon className="text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput id="search" placeholder="Type to search..." />
      </InputGroup>
    </form>
  )
}
