// Malay text for the member-facing API messages, used by _middleware.js when a
// request comes from the Malay site (my.mambaapp.online, or a /ms/ page on a
// preview). The English message is the key, so endpoints keep returning
// English and stay unchanged; a message missing here simply stays English.
//
// tests/ms-i18n-coverage.spec.js extracts every sentence passed to json() in
// the member-facing endpoints and fails if one has no entry here. Admin
// endpoints are excluded on purpose: the admin workspace is English-only.
export const MS_API_MESSAGES = {
  'A valid account email address is required.': 'Alamat e-mel akaun yang sah diperlukan.',
  'A valid email address is required.': 'Alamat e-mel yang sah diperlukan.',
  'Account number is required.': 'Nombor akaun diperlukan.',
  'account_id is required.': 'account_id diperlukan.',
  'Email already registered.': 'E-mel ini sudah didaftarkan.',
  'Email and password are required.': 'E-mel dan kata laluan diperlukan.',
  'Email, recovery phrase, and new password are required.': 'E-mel, frasa pemulihan dan kata laluan baharu diperlukan.',
  'Failed to add account. Please try again.': 'Gagal menambah akaun. Sila cuba lagi.',
  'Failed to send message. Please try again.': 'Gagal menghantar mesej. Sila cuba lagi.',
  'Failed to submit request. Please try again.': 'Gagal menghantar permohonan. Sila cuba lagi.',
  'IB verification is already approved.': 'Pengesahan IB anda telah pun diluluskan.',
  'IB verification request submitted.': 'Permohonan pengesahan IB telah dihantar.',
  'Invalid email or password.': 'E-mel atau kata laluan tidak sah.',
  'Invalid email or recovery phrase.': 'E-mel atau frasa pemulihan tidak sah.',
  'Invalid event type.': 'Jenis acara tidak sah.',
  'Invalid request body.': 'Kandungan permintaan tidak sah.',
  'Login failed. Please try again.': 'Log masuk gagal. Sila cuba lagi.',
  'MT5 account not found.': 'Akaun MT5 tidak ditemui.',
  'MT5 account number must be 3-20 digits.': 'Nombor akaun MT5 mestilah 3 hingga 20 digit.',
  'MT5 account whitelisted.': 'Akaun MT5 telah dimasukkan ke dalam whitelist.',
  'Message is too long (max 2000 characters).': 'Mesej terlalu panjang (maksimum 2000 aksara).',
  'Message received. We will get back to you soon.': 'Mesej diterima. Kami akan menghubungi anda tidak lama lagi.',
  'Name is required (max 100 characters).': 'Nama diperlukan (maksimum 100 aksara).',
  'Name must be between 1 and 100 characters.': 'Nama mestilah antara 1 hingga 100 aksara.',
  'Name, email, password, and recovery phrase are required.': 'Nama, e-mel, kata laluan dan frasa pemulihan diperlukan.',
  'New password must be between 8 and 128 characters.': 'Kata laluan baharu mestilah antara 8 hingga 128 aksara.',
  'Not authenticated.': 'Sesi anda tidak sah. Sila log masuk semula.',
  'Password has been reset. Please log in with your new password.': 'Kata laluan telah ditetapkan semula. Sila log masuk dengan kata laluan baharu anda.',
  'Password must be between 8 and 128 characters.': 'Kata laluan mestilah antara 8 hingga 128 aksara.',
  'Password reset failed. Please try again.': 'Tetapan semula kata laluan gagal. Sila cuba lagi.',
  'Please confirm you understand the deletion is permanent.': 'Sila sahkan bahawa anda faham pemadaman ini adalah kekal.',
  'Please enter a message (at least 5 characters).': 'Sila masukkan mesej (sekurang-kurangnya 5 aksara).',
  'Please enter a valid Valetax email address.': 'Sila masukkan alamat e-mel Valetax yang sah.',
  'Please enter a valid email address.': 'Sila masukkan alamat e-mel yang sah.',
  'Please request IB verification before adding an MT5 account.': 'Sila mohon pengesahan IB sebelum menambah akaun MT5.',
  'Please request IB verification before requesting whitelist.': 'Sila mohon pengesahan IB sebelum memohon whitelist.',
  'Profile updated.': 'Profil telah dikemas kini.',
  'Recovery phrase must be between 8 and 200 characters.': 'Frasa pemulihan mestilah antara 8 hingga 200 aksara.',
  'Registration failed. Please try again.': 'Pendaftaran gagal. Sila cuba lagi.',
  'Request failed. Please try again.': 'Permohonan gagal. Sila cuba lagi.',
  'This MT5 account is already added.': 'Akaun MT5 ini telah pun ditambah.',
  'This MT5 account number is already registered. If it belongs to you, contact support.': 'Nombor akaun MT5 ini telah didaftarkan. Jika akaun ini milik anda, sila hubungi pasukan sokongan.',
  'This account is already approved.': 'Akaun ini telah pun diluluskan.',
  'Too many login attempts. Please wait a few minutes and try again.': 'Terlalu banyak cubaan log masuk. Sila tunggu beberapa minit dan cuba lagi.',
  'Too many messages. Please try again later.': 'Terlalu banyak mesej. Sila cuba lagi kemudian.',
  'Too many registrations from this connection. Please try again later.': 'Terlalu banyak pendaftaran daripada sambungan ini. Sila cuba lagi kemudian.',
  'Too many requests. Please try again later.': 'Terlalu banyak permohonan. Sila cuba lagi kemudian.',
  'Too many reset attempts. Please wait a few minutes and try again.': 'Terlalu banyak cubaan tetapan semula. Sila tunggu beberapa minit dan cuba lagi.',
  'Update failed. Please try again.': 'Kemas kini gagal. Sila cuba lagi.',
  'Valetax email is required.': 'E-mel Valetax diperlukan.',
  'Whitelist request submitted.': 'Permohonan whitelist telah dihantar.',
  'Whitelist request submitted. It will be activated once your IB verification is approved.': 'Permohonan whitelist telah dihantar. Ia akan diaktifkan sebaik sahaja pengesahan IB anda diluluskan.',
  'You must accept the Terms of Service, Privacy Policy and Risk Disclosure.': 'Anda mesti menerima Terma Perkhidmatan, Dasar Privasi dan Pendedahan Risiko.',
  'Your deletion request has been received.': 'Permohonan pemadaman anda telah diterima.',
  'Your deletion request has been received. We will verify it and email you a confirmation once your account is deleted.': 'Permohonan pemadaman anda telah diterima. Kami akan mengesahkannya dan menghantar e-mel pengesahan kepada anda sebaik sahaja akaun anda dipadam.'
};

// Only these fields carry text a member reads; everything else (tokens, ids,
// counts, account numbers) passes through untouched.
const TEXT_FIELDS = ['error', 'message', 'warning'];

// Returns the body with its member-facing text in Malay. Returns null when
// nothing changed, so the caller can pass the original response through.
export function translateBody(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  let changed = false;
  const out = { ...data };
  for (const field of TEXT_FIELDS) {
    const text = out[field];
    if (typeof text === 'string' && Object.prototype.hasOwnProperty.call(MS_API_MESSAGES, text)) {
      out[field] = MS_API_MESSAGES[text];
      changed = true;
    }
  }
  return changed ? out : null;
}
