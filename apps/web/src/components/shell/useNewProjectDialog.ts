import { useState } from 'react'

/** Estado do diálogo «Novo projeto» compartilhado pelas views do shell. */
export function useNewProjectDialog() {
  const [open, setOpen] = useState(false)
  return {
    open,
    openDialog: () => setOpen(true),
    closeDialog: () => setOpen(false),
  }
}
