import { create } from 'zustand';

/** Which modal dialog is open (one at a time). */
export const useDialogs = create((set) => ({
  dialog: null, // 'export' | 'import' | 'runtime' | 'save' | 'shortcuts'
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));

export function openFilePicker(accept, onFile) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) onFile(f);
  };
  input.click();
}
