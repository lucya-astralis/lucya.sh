export const pad2 = n => String(n).padStart(2, '0');
export const escHtml = (s) => String(s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));

