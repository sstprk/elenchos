/**
 * Simple i18n — UI string translations.
 * Supports English and Turkish.
 */

export type Locale = "en" | "tr";

const strings = {
  // Header
  "header.history": { en: "HISTORY", tr: "GEÇMİŞ" },
  "header.config": { en: "CONFIG", tr: "AYARLAR" },
  "header.keysSet": { en: "◈ KEYS SET", tr: "◈ ANAHTARLAR" },
  "header.addKeys": { en: "◈ ADD KEYS", tr: "◈ ANAHTAR EKLE" },
  "header.signOut": { en: "SIGN OUT", tr: "ÇIKIŞ" },
  "header.signIn": { en: "SIGN IN", tr: "GİRİŞ" },

  // Hero
  "hero.subtitle": { en: "ΤΟ ΕΛΕΓΧΕΙΝ", tr: "ΤΟ ΕΛΕΓΧΕΙΝ" },
  "hero.title": { en: "Challenge Your Ideas", tr: "Fikirlerini Sorgula" },
  "hero.description": {
    en: "Multiple AI philosophers debate your topic independently, challenge each other, and converge toward well-tested truth.",
    tr: "Birden fazla yapay zeka filozofu konunu bağımsız olarak tartışır, birbirlerine itiraz eder ve sağlam bir sonuca yakınsar.",
  },
  "hero.placeholder": {
    en: "Pose your question to the assembly...",
    tr: "Sorunuzu meclise sorun...",
  },
  "hero.begin": { en: "BEGIN", tr: "BAŞLA" },
  "hero.noKeys": {
    en: "Add at least one API key to summon the philosophers — ",
    tr: "Filozofları çağırmak için en az bir API anahtarı ekleyin — ",
  },
  "hero.setKeys": { en: "Set Keys", tr: "Anahtarları Ayarla" },

  // Debate
  "debate.configTitle": { en: "DEBATE CONFIGURATION", tr: "TARTIŞMA AYARLARI" },
  "debate.onTheMatter": { en: "ON THE MATTER OF", tr: "KONU HAKKINDA" },
  "debate.stop": { en: "STOP", tr: "DURDUR" },
  "debate.newDebate": { en: "NEW DEBATE", tr: "YENİ TARTIŞMA" },
  "debate.round": { en: "Round", tr: "Tur" },

  // Steering
  "steering.title": { en: "Steer the Discourse", tr: "Tartışmayı Yönlendir" },
  "steering.description": {
    en: "Your guidance reaches only Athena, who weaves it into her next evaluation.",
    tr: "Yönlendirmeniz yalnızca Athena'ya ulaşır ve bir sonraki değerlendirmesine yansıtır.",
  },
  "steering.placeholder": {
    en: "Direct the philosophical inquiry...",
    tr: "Felsefi soruşturmayı yönlendirin...",
  },
  "steering.send": { en: "Send", tr: "Gönder" },
  "steering.continue": { en: "Continue", tr: "Devam" },
  "steering.finalize": { en: "Finalize", tr: "Sonlandır" },

  // DebateView
  "view.roundOf": { en: "of", tr: "/" },
  "view.speaks": { en: "speaks", tr: "konuşuyor" },
  "view.deliberates": { en: "deliberates", tr: "değerlendiriyor" },
  "view.concludes": { en: "✦ The debate concludes ✦", tr: "✦ Tartışma sona erdi ✦" },
  "view.thinking": { en: "The philosophers deliberate...", tr: "Filozoflar tartışıyor..." },
  "view.finalVerdict": { en: "Final Verdict", tr: "Son Karar" },
  "view.assessment": { en: "Assessment", tr: "Değerlendirme" },
  "view.agreements": { en: "Agreements", tr: "Uzlaşılar" },
  "view.disagreements": { en: "Disagreements", tr: "Anlaşmazlıklar" },

  // Config
  "config.presets": { en: "Presets", tr: "Ön Ayarlar" },
  "config.debaters": { en: "Debaters", tr: "Tartışmacılar" },
  "config.judge": { en: "Judge", tr: "Hakem" },
  "config.rounds": { en: "Rounds", tr: "Turlar" },
  "config.minimum": { en: "Minimum", tr: "Minimum" },
  "config.maximum": { en: "Maximum", tr: "Maksimum" },
  "config.convergence": { en: "Convergence", tr: "Yakınsama" },
  "config.threshold": { en: "Threshold", tr: "Eşik" },
  "config.contextWindow": { en: "Context Window", tr: "Bağlam Penceresi" },
  "config.lastRound": { en: "Last round", tr: "Son tur" },
  "config.fullHistory": { en: "Full history", tr: "Tam geçmiş" },
  "config.tokenEfficient": { en: "Token-efficient", tr: "Token tasarruflu" },
  "config.bestContinuity": { en: "Best continuity", tr: "En iyi süreklilik" },
  "config.add": { en: "+ Add", tr: "+ Ekle" },
  "config.barelyAgree": { en: "Barely agree", tr: "Neredeyse anlaşamıyor" },
  "config.fullConsensus": { en: "Full consensus", tr: "Tam uzlaşı" },
  "config.onlyAfterMin": { en: "Only check after minimum rounds", tr: "Yalnızca minimum tur sonrasında kontrol et" },

  // Keys
  "keys.title": { en: "API Keys", tr: "API Anahtarları" },
  "keys.description": {
    en: "Keys are stored in your browser only — never sent to any server but the provider's.",
    tr: "Anahtarlar yalnızca tarayıcınızda saklanır — sağlayıcı dışında hiçbir sunucuya gönderilmez.",
  },
  "keys.getKey": { en: "Get key →", tr: "Anahtar al →" },
  "keys.cancel": { en: "Cancel", tr: "İptal" },
  "keys.save": { en: "Save Keys", tr: "Kaydet" },

  // Auth
  "auth.signIn": { en: "Sign In", tr: "Giriş Yap" },
  "auth.createAccount": { en: "Create Account", tr: "Hesap Oluştur" },
  "auth.email": { en: "Email", tr: "E-posta" },
  "auth.password": { en: "Password", tr: "Şifre" },
  "auth.noAccount": { en: "Don't have an account? Sign up", tr: "Hesabınız yok mu? Kayıt olun" },
  "auth.hasAccount": { en: "Already have an account? Sign in", tr: "Zaten hesabınız var mı? Giriş yapın" },

  // History
  "history.title": { en: "Saved Debates", tr: "Kaydedilen Tartışmalar" },
  "history.empty": {
    en: "No debates saved yet. Start a debate while signed in to save it automatically.",
    tr: "Henüz kayıtlı tartışma yok. Otomatik kayıt için giriş yaparak bir tartışma başlatın.",
  },
  "history.rounds": { en: "rounds", tr: "tur" },
  "history.round": { en: "round", tr: "tur" },
  "history.completed": { en: "Completed", tr: "Tamamlandı" },
  "history.inProgress": { en: "In Progress", tr: "Devam Ediyor" },
  "history.stopped": { en: "Stopped", tr: "Durduruldu" },
} as const;

type StringKey = keyof typeof strings;

export function t(key: StringKey, locale: Locale): string {
  return strings[key]?.[locale] ?? strings[key]?.en ?? key;
}
