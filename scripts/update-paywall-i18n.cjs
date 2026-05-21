#!/usr/bin/env node
/**
 * Update paywall + oneoff i18n keys across all 11 language blocks.
 * Phase 2: oneoff_home_btn, paywall_perks_note2 (sample/preview language)
 * Phase 4: paywall_h2, paywall_sub, paywall_hint_home, paywall_perks_note1
 *
 * Run: node scripts/update-paywall-i18n.cjs
 * Dry-run: node scripts/update-paywall-i18n.cjs --dry
 */

const fs = require("fs");
const path = require("path");
const isDry = process.argv.includes("--dry");

const filePath = path.resolve(__dirname, "../public/modules/i18n.js");
let content = fs.readFileSync(filePath, "utf8");

// Each entry: [exactOldString, newString]
const REPLACEMENTS = [

  // ═══════════════════════════════════════════════════════
  // en-GB
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "Magical stories, night after night"',
   'paywall_h2: "A bedtime story your child will dream about — every night"'],

  ['paywall_sub: "Create ongoing adventures that continue where they left off."',
   'paywall_sub: "Personal adventures that grow with your child — remembered night after night."'],

  ['paywall_hint_home: "40 premium story adventures a month — starring your child by name — with memory, continuity, and a world that grows with every night."',
   'paywall_hint_home: "40 premium bedtime adventures a month — starring your child by name — with continuing characters, emotional memory, and magical keepsake rewards along the way."'],

  ['paywall_perks_note1: "40 adventures/month · Story continuity · Premium memory · No ads"',
   'paywall_perks_note1: "40 adventures/month · Continuing stories · Keepsake rewards · No ads"'],

  ['oneoff_home_btn: "★ One magical story — 99p"',
   'oneoff_home_btn: "★ Magical bedtime taster — 99p"'],

  ['paywall_perks_note2: "Full personalised story · Starring your child · Same magic, one night"',
   'paywall_perks_note2: "One beautiful sample story · Starring your child · A taste of the magic"'],

  // ═══════════════════════════════════════════════════════
  // fr
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "Chaque soir, une aventure magique"',
   'paywall_h2: "Une histoire du soir dont votre enfant va rêver — chaque nuit"'],

  ['paywall_sub: "Personnalisée pour votre enfant. Magnifique à chaque fois."',
   'paywall_sub: "Des aventures personnalisées avec mémoire, continuité et magie qui grandit chaque nuit."'],

  [`paywall_hint_home: "Une histoire du soir calme et magique — 7 à 10 minutes, avec votre enfant comme héros — pour l'aider à se détendre et glisser dans le sommeil."`,
   `paywall_hint_home: "40 aventures du soir par mois — avec votre enfant comme héros — avec des personnages récurrents, une mémoire émotionnelle et des récompenses souvenir."`],

  ['paywall_perks_note1: "Nouvelle histoire chaque soir · Bibliothèque complète · Sauvegardez pour toujours"',
   'paywall_perks_note1: "40 aventures/mois · Histoires continues · Récompenses souvenir · Sans publicité"'],

  ['oneoff_home_btn: "★ Une histoire magique — 99p"',
   'oneoff_home_btn: "★ Avant-goût magique — 99p"'],

  ['paywall_perks_note2: "Histoire complète 7–10 min · Avec votre enfant · Même magie, une nuit"',
   'paywall_perks_note2: "Une belle histoire découverte · Avec votre enfant · Un avant-goût de la magie"'],

  // ═══════════════════════════════════════════════════════
  // es
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "Cada noche, una aventura mágica"',
   'paywall_h2: "Una historia que tu hijo soñará — cada noche"'],

  ['paywall_sub: "Personalizada para tu hijo. Hermosa cada vez."',
   'paywall_sub: "Aventuras personalizadas con memoria, continuidad y magia que crece cada noche."'],

  ['paywall_hint_home: "Un cuento de buenas noches tranquilo y mágico — 7–10 minutos, con tu hijo como protagonista — para que se relaje y se duerma."',
   'paywall_hint_home: "40 aventuras del sueño al mes — con tu hijo como protagonista — con personajes continuos, memoria emocional y recompensas especiales."'],

  ['paywall_perks_note1: "Nueva historia cada noche · Biblioteca completa · Guarda historias para siempre"',
   'paywall_perks_note1: "40 aventuras/mes · Historias continuas · Recompensas especiales · Sin anuncios"'],

  ['oneoff_home_btn: "★ Una historia mágica — 99p"',
   'oneoff_home_btn: "★ Cuento mágico de prueba — 99p"'],

  ['paywall_perks_note2: "Historia completa 7–10 min · Con tu hijo · La misma magia, una noche"',
   'paywall_perks_note2: "Una hermosa historia de muestra · Con tu hijo · Un sabor de la magia"'],

  // ═══════════════════════════════════════════════════════
  // pt
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "Cada noite, uma aventura mágica"',
   'paywall_h2: "Uma história que o seu filho vai sonhar — cada noite"'],

  ['paywall_sub: "Personalizada para o seu filho. Linda em todas as vezes."',
   'paywall_sub: "Aventuras personalizadas com memória, continuidade e magia que cresce cada noite."'],

  ['paywall_hint_home: "Uma história de ninar calma e mágica — 7 a 10 minutos, com o seu filho como protagonista — para relaxar e adormecer."',
   'paywall_hint_home: "40 aventuras do sono por mês — com o seu filho como protagonista — com personagens contínuos, memória emocional e recompensas especiais."'],

  ['paywall_perks_note1: "Nova história cada noite · Biblioteca completa · Salvar histórias para sempre"',
   'paywall_perks_note1: "40 aventuras/mês · Histórias contínuas · Recompensas especiais · Sem anúncios"'],

  ['oneoff_home_btn: "★ Uma história mágica — 99p"',
   'oneoff_home_btn: "★ Conto mágico de amostra — 99p"'],

  ['paywall_perks_note2: "História completa 7–10 min · Com o seu filho · A mesma magia, uma noite"',
   'paywall_perks_note2: "Uma bela história de amostra · Com o seu filho · Um gostinho da magia"'],

  // ═══════════════════════════════════════════════════════
  // de
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "Jede Nacht ein magisches Abenteuer"',
   'paywall_h2: "Eine Geschichte, von der dein Kind träumt — jede Nacht"'],

  ['paywall_sub: "Personalisiert für Ihr Kind. Jedes Mal wunderschön."',
   'paywall_sub: "Persönliche Abenteuer mit Erinnerung, Kontinuität und Magie, die jede Nacht wächst."'],

  ['paywall_hint_home: "Eine ruhige, magische Gutenachtgeschichte — 7–10 Minuten lang, mit Ihrem Kind als Hauptfigur — zum Entspannen und Einschlafen."',
   'paywall_hint_home: "40 Schlafenszeit-Abenteuer im Monat — mit deinem Kind als Held — mit wiederkehrenden Charakteren, emotionaler Erinnerung und besonderen Erinnerungsbelohnungen."'],

  ['paywall_perks_note1: "Neue Geschichte jede Nacht · Vollständige Bibliothek · Geschichten für immer speichern"',
   'paywall_perks_note1: "40 Abenteuer/Monat · Fortsetzungsgeschichten · Erinnerungsbelohnungen · Keine Werbung"'],

  ['oneoff_home_btn: "★ Eine magische Geschichte — 99p"',
   'oneoff_home_btn: "★ Magische Kostprobe — 99p"'],

  ['paywall_perks_note2: "Vollständige Geschichte 7–10 Min · Mit Ihrem Kind · Gleiche Magie, eine Nacht"',
   'paywall_perks_note2: "Eine schöne Kostprobe · Mit deinem Kind · Ein Vorgeschmack auf die Magie"'],

  // ═══════════════════════════════════════════════════════
  // it
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "Ogni notte, un\'avventura magica"',
   'paywall_h2: "Una storia di cui il tuo bambino sognerà — ogni notte"'],

  ['paywall_sub: "Personalizzata per tuo figlio. Meravigliosa ogni volta."',
   'paywall_sub: "Avventure personalizzate con memoria, continuità e magia che cresce ogni notte."'],

  ['paywall_hint_home: "Una storia della buonanotte calma e magica — 7–10 minuti, con tuo figlio come protagonista — per rilassarsi e addormentarsi."',
   'paywall_hint_home: "40 avventure della buonanotte al mese — con tuo figlio come protagonista — con personaggi ricorrenti, memoria emotiva e premi speciali."'],

  ['paywall_perks_note1: "Nuova storia ogni notte · Biblioteca completa · Salva storie per sempre"',
   'paywall_perks_note1: "40 avventure/mese · Storie continue · Premi speciali · Niente pubblicità"'],

  ['oneoff_home_btn: "★ Una storia magica — 99p"',
   'oneoff_home_btn: "★ Assaggio magico — 99p"'],

  ['paywall_perks_note2: "Storia completa 7–10 min · Con tuo figlio · Stessa magia, una notte"',
   'paywall_perks_note2: "Una bella storia campione · Con tuo figlio · Un assaggio della magia"'],

  // ═══════════════════════════════════════════════════════
  // ja
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "毎晩、魔法の冒険"',
   'paywall_h2: "お子様が夢見る物語 — 毎晩"'],

  ['paywall_sub: "お子様のためにパーソナライズ。毎回美しい。"',
   'paywall_sub: "記憶と継続性を持つ、お子様だけのパーソナルな冒険。"'],

  ['paywall_hint_home: "お子様が主人公の穏やかで魔法の就寝時のお話 — 7〜10分 — リラックスして眠りにつくために。"',
   'paywall_hint_home: "月40回のプレミアムな就寝時の冒険 — お子様が主人公 — 感情的な継続性と繰り返し登場するキャラクターと特別な記念品。"'],

  ['paywall_perks_note1: "毎晩新しい話 · 完全なライブラリ · 永遠に保存"',
   'paywall_perks_note1: "月40冒険 · 続きのある物語 · 記念品 · 広告なし"'],

  ['oneoff_home_btn: "★ 魔法の話1つ — 99p"',
   'oneoff_home_btn: "★ 魔法のお試し物語 — 99p"'],

  ['paywall_perks_note2: "完全な話7〜10分 · お子様が主人公 · 同じ魔法、一夜"',
   'paywall_perks_note2: "美しいお試し物語 · お子様が主人公 · 魔法を体験"'],

  // ═══════════════════════════════════════════════════════
  // zh-CN
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "每晚，魔法冒险"',
   'paywall_h2: "孩子会梦见的故事 — 每晚"'],

  ['paywall_sub: "为您的孩子量身定制。每次都精彩。"',
   'paywall_sub: "有记忆和情感连续性的个性化冒险，每晚成长。"'],

  ['paywall_hint_home: "一个平静、神奇的睡前故事 — 7至10分钟，以您的孩子为主角 — 帮助他们放松、想象，轻松入睡。"',
   'paywall_hint_home: "每月40个睡前冒险 — 以您的孩子为主角 — 有情感记忆、持续角色和特别纪念奖励。"'],

  ['paywall_perks_note1: "每晚新故事 · 完整图书馆 · 永久保存"',
   'paywall_perks_note1: "每月40个冒险 · 续集故事 · 纪念奖励 · 无广告"'],

  ['oneoff_home_btn: "★ 一个魔法故事 — 99p"',
   'oneoff_home_btn: "★ 魔法体验故事 — 99p"'],

  ['paywall_perks_note2: "完整故事7-10分钟 · 以您的孩子为主角 · 同样的魔法，一个晚上"',
   'paywall_perks_note2: "一个精美的体验故事 · 以您的孩子为主角 · 感受魔法"'],

  // ═══════════════════════════════════════════════════════
  // ar
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "كل ليلة، مغامرة سحرية"',
   'paywall_h2: "قصة سيحلم بها طفلك — كل ليلة"'],

  ['paywall_sub: "مخصصة لطفلك. جميلة في كل مرة."',
   'paywall_sub: "مغامرات شخصية مع ذاكرة واستمرارية وسحر ينمو كل ليلة."'],

  ['paywall_hint_home: "قصة نوم هادئة وسحرية — من 7 إلى 10 دقائق، تضم طفلك بالاسم — تساعده على الاسترخاء والنوم."',
   'paywall_hint_home: "40 مغامرة وقت النوم شهريًا — مع طفلك بطلًا — مع استمرارية عاطفية وشخصيات متكررة ومكافآت خاصة."'],

  ['paywall_perks_note1: "قصة جديدة كل ليلة · مكتبة كاملة · احفظ القصص للأبد"',
   'paywall_perks_note1: "40 مغامرة/شهر · قصص متواصلة · مكافآت خاصة · بدون إعلانات"'],

  ['oneoff_home_btn: "★ قصة سحرية — 99p"',
   'oneoff_home_btn: "★ قصة سحرية تجريبية — 99p"'],

  ['paywall_perks_note2: "قصة كاملة 7–10 دقائق · بطولة طفلك · نفس السحر، ليلة واحدة"',
   'paywall_perks_note2: "قصة تجريبية جميلة · طفلك البطل · اكتشف السحر"'],

  // ═══════════════════════════════════════════════════════
  // hi
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "हर रात, एक जादुई साहसिक कहानी"',
   'paywall_h2: "एक कहानी जो आपका बच्चा सपने में देखेगा — हर रात"'],

  ['paywall_sub: "आपके बच्चे के लिए व्यक्तिगत। हर बार खूबसूरत।"',
   'paywall_sub: "व्यक्तिगत रोमांच जो स्मृति, निरंतरता और जादू के साथ हर रात बढ़ता है।"'],

  ['paywall_hint_home: "एक शांत, जादुई सोने की कहानी — 7–10 मिनट लंबी, आपके बच्चे की भूमिका में — उन्हें आराम और नींद में ले जाती है।"',
   'paywall_hint_home: "महीने में 40 प्रीमियम सोने की कहानियाँ — आपके बच्चे को नायक बनाकर — भावनात्मक निरंतरता, दोहराते पात्रों और विशेष पुरस्कारों के साथ।"'],

  ['paywall_perks_note1: "हर रात नई कहानी · पूर्ण पुस्तकालय · हमेशा के लिए बचाएं"',
   'paywall_perks_note1: "40 कहानियाँ/माह · जारी रहने वाली कहानियाँ · यादगार पुरस्कार · कोई विज्ञापन नहीं"'],

  ['oneoff_home_btn: "★ एक जादुई कहानी — 99p"',
   'oneoff_home_btn: "★ जादुई नमूना कहानी — 99p"'],

  ['paywall_perks_note2: "पूरी कहानी 7–10 मिनट · आपका बच्चा मुख्य भूमिका में · वही जादू, एक रात"',
   'paywall_perks_note2: "एक खूबसूरत नमूना कहानी · आपका बच्चा नायक · जादू का अनुभव करें"'],

  // ═══════════════════════════════════════════════════════
  // ur
  // ═══════════════════════════════════════════════════════
  ['paywall_h2: "ہر رات، ایک جادوئی مہم"',
   'paywall_h2: "ایک کہانی جو آپ کا بچہ خواب میں دیکھے گا — ہر رات"'],

  ['paywall_sub: "آپ کے بچے کے لیے ذاتی۔ ہر بار خوبصورت۔"',
   'paywall_sub: "ذاتی مہم جو یادداشت، تسلسل اور جادو کے ساتھ ہر رات بڑھتی ہے۔"'],

  ['paywall_hint_home: "ایک پرسکون، جادوئی سونے کی کہانی — 7–10 منٹ لمبی، آپ کے بچے کو مرکزی کردار میں رکھ کر — انہیں آرام اور نیند میں لے جاتی ہے۔"',
   'paywall_hint_home: "ماہانہ 40 پریمیم سونے کی کہانیاں — آپ کے بچے کو ہیرو بنا کر — جذباتی تسلسل، دہرائے جانے والے کرداروں اور خصوصی انعامات کے ساتھ۔"'],

  ['paywall_perks_note1: "ہر رات نئی کہانی · پوری لائبریری · ہمیشہ کے لیے محفوظ کریں"',
   'paywall_perks_note1: "40 کہانیاں/مہینہ · جاری رہنے والی کہانیاں · خصوصی انعامات · کوئی اشتہار نہیں"'],

  ['oneoff_home_btn: "★ ایک جادوئی کہانی — 99p"',
   'oneoff_home_btn: "★ جادوئی نمونہ کہانی — 99p"'],

  ['paywall_perks_note2: "مکمل کہانی 7–10 منٹ · آپ کا بچہ مرکزی کردار میں · وہی جادو، ایک رات"',
   'paywall_perks_note2: "ایک خوبصورت نمونہ کہانی · آپ کا بچہ ہیرو · جادو کا تجربہ کریں"'],
];

let applied = 0;
const missed = [];

for (const [oldStr, newStr] of REPLACEMENTS) {
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    applied++;
  } else {
    missed.push(oldStr.slice(0, 80));
  }
}

// Sanity: file must still contain all language block openers
const required = ['"en-GB"', '"fr"', '"es"', '"pt"', '"de"', '"it"', '"ja"', '"zh-CN"', '"ar"', '"hi"', '"ur"'];
const missingBlocks = required.filter(m => !content.includes(m));
if (missingBlocks.length) {
  console.error("ABORT — language blocks missing:", missingBlocks);
  process.exit(1);
}

console.log(`\nReplacements applied : ${applied}/${REPLACEMENTS.length}`);
if (missed.length) {
  console.warn("\nNOT FOUND (already updated or different value):");
  missed.forEach(m => console.warn("  →", m));
}
console.log(`Language blocks      : OK`);

if (isDry) {
  console.log("\nDry run — no file written.");
} else {
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`\nWritten: ${filePath}`);
}
