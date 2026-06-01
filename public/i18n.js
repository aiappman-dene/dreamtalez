// Simple i18n implementation for Bedtalez UI
// Usage: i18n.t('key')

const translations = {
  en: {
    choose_story: "Choose Your Story",
    create_new_story: "Create New Story",
    quick_dream: "Quick Dream",
    magic_adventure: "Magic Adventure",
    sleepy_story: "Sleepy Story",
    custom_story: "Custom Story",
    add_teddies: "Add Teddies 🧸 99p",
    teddies_ready: "Your teddies are ready for tonight! 🧸",
    running_low: "Running low on teddies! 🧸",
    all_used: "All your teddies have been used tonight! Come back tomorrow or add more for 99p 🧸",
    topup_confirmation: "20 teddies added! Time for more stories 🧸✨",
    // ...add more keys as needed
  },
  fr: {
    choose_story: "Choisissez votre histoire",
    create_new_story: "Créer une nouvelle histoire",
    quick_dream: "Rêve rapide",
    magic_adventure: "Aventure magique",
    sleepy_story: "Histoire pour dormir",
    custom_story: "Histoire personnalisée",
    add_teddies: "Ajouter des nounours 🧸 0,99€",
    teddies_ready: "Vos nounours sont prêts pour ce soir ! 🧸",
    running_low: "Il ne reste plus beaucoup de nounours ! 🧸",
    all_used: "Tous vos nounours ont été utilisés ce soir ! Revenez demain ou ajoutez-en pour 0,99€ 🧸",
    topup_confirmation: "20 nounours ajoutés ! Prêt pour plus d'histoires 🧸✨",
    // ...add more keys as needed
  },
  // Add more languages here
};

let currentLang = 'en';

export const i18n = {
  setLang: (lang) => { currentLang = translations[lang] ? lang : 'en'; },
  // Delegate to main.js t() when available (full 11-language table).
  // Falls back to the small local dict so early callers still get a value.
  t: (key) => {
    if (typeof window.__t === 'function') return window.__t(key);
    return translations[currentLang]?.[key] || translations['en']?.[key] || key;
  },
};

window.i18n = i18n; // For global access in HTML inline scripts
