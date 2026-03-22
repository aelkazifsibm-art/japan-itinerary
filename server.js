import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ── Helper Anthropic Claude ─────────────────────────────────────────────────
// ── Convertir le profil voyageur en contexte pour les prompts IA ─────────────
function buildProfileContext(profile) {
    if (!profile) return '';
    const typeMap = { solo:'voyage solo', couple:'voyage en couple', famille:'voyage en famille', amis:'voyage entre amis', groupe:'voyage en groupe' };
    const intMap  = {
        culture:'temples/sanctuaires/quartiers historiques/châteaux',
        art:"musées d'art moderne/TeamLab/galeries contemporaines",
        nature:'parcs/jardins/forêts/nature',
        gastro:'marchés alimentaires/cours de cuisine/street food/restaurants typiques',
        shopping:'boutiques locales/vintage/artisanat',
        pop:'Akihabara/anime/manga/arcades/pop culture',
        wellness:'onsen/jardins zen/temples calmes/promenades',
        adventure:'randonnées/vélo/activités sportives',
        experiences:'cérémonie du thé/calligraphie/poterie/cours de cuisine',
        musees:'musées nationaux/musées de site/musées thématiques/expositions'
    };
    const budgetMap = { econome:'budget serré (konbini, < 1000¥, entrées gratuites prioritaires)', modere:'budget modéré (restaurants 1000–3000¥)', confortable:'budget confortable (restaurants et expériences premium OK)', luxe:'budget luxe (ryokan, gastronomique, exclusif)' };
    const constMap  = { mobility:'accessibilité PMR obligatoire', vegetarien:'options végétariennes', vegan:'options végétaliennes', halal:'options halal', noalcool:'sans alcool', nogluten:'sans gluten', enfants:'adapté aux jeunes enfants' };

    const parts = [];
    if (profile.travel_type) parts.push('Type: ' + (typeMap[profile.travel_type]||profile.travel_type));

    // Utiliser interests_order si disponible (1er intérêt = priorité maximale)
    const orderedInterests = profile.interests_order?.length ? profile.interests_order : (profile.interests || []);
    if (orderedInterests.length) {
        const mapped = orderedInterests.map((i,idx) => `${idx===0?'[PRIORITÉ HAUTE] ':''}${intMap[i]||i}`);
        parts.push("Centres intérêt (par ordre de préférence): " + mapped.join(' | '));
        parts.push("→ OBLIGATION: 1er intérêt prioritaire dans 40% des activités. Alterner les autres. Max 1 activité du même type par demi-journée.");
    }

    if (profile.budget) parts.push('Budget: ' + (budgetMap[profile.budget]||profile.budget));
    if (profile.constraints?.length) parts.push('Contraintes: ' + profile.constraints.map(c => constMap[c]||c).join(', '));
    if (profile.custom_constraint) parts.push('Contrainte spéciale: ' + profile.custom_constraint);

    // Nouveaux critères de rythme
    const sc = profile._score;
    if (sc) {
        parts.push(`Rythme: ${sc.activitiesPerDay} activités max/jour`);
        parts.push(`Heure début journée: ${sc.dayStartHour}h00`);
        if (sc.avoidCrowdedSlots) parts.push('Sensibilité foules forte → privilégier visites tôt matin (avant 9h) ou fin de journée (après 17h) pour sites touristiques');
    } else {
        if (profile.pace === 'tranquille') parts.push('Rythme: max 3 activités/jour — journées aérées, temps de pause');
        if (profile.pace === 'intense')    parts.push('Rythme: 6–7 activités/jour — journées bien remplies');
        if (profile.wake_time === 'tot')   parts.push('Départ dès 7h — peut accéder aux sites avant la foule');
        if (profile.wake_time === 'tard')  parts.push('Départ vers 10h — éviter activités matinales obligatoires');
        if (profile.crowd_sensitivity === 'forte') parts.push('Évite les foules → créneaux tôt matin ou après 17h pour Fushimi Inari, Arashiyama, etc.');
    }

    if (!parts.length) return '';
    return '\n=== PROFIL VOYAGEUR (OBLIGATOIRE À RESPECTER) ===\n' + parts.join('\n') + '\n=== FIN PROFIL ===\n';
}


// ── Nettoyage robuste du JSON IA ─────────────────────────────────────────────
function sanitizeJson(text) {
    let j = text.trim();
    j = j.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    j = j.replace(/[""]/g, '"').replace(/['']/g, "'");
    j = j.replace(/,\s*([}\]])/g, '$1');
    const m = j.match(/\{[\s\S]*\}/);
    if (m) j = m[0];
    try { JSON.parse(j); } catch(e) {
        const lastComma = j.lastIndexOf(',');
        const trimmed = j.slice(0, lastComma > 0 ? lastComma : j.length);
        let work = trimmed;
        const openB = (work.match(/\[/g)||[]).length - (work.match(/\]/g)||[]).length;
        const openC = (work.match(/\{/g)||[]).length - (work.match(/\}/g)||[]).length;
        for (let i=0; i<openB; i++) work += ']';
        for (let i=0; i<openC; i++) work += '}';
        work = work.replace(/,\s*([}\]])/g, '$1');
        try { JSON.parse(work); j = work; } catch(e2) { /* garder j original */ }
    }
    return j;
}

async function anthropicChat(systemPrompt, userMessage, maxTokens = 400) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Clé ANTHROPIC_API_KEY manquante dans .env');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }]
        })
    });
    const data = await r.json();
    if (!r.ok) {
        const errMsg = data.error?.message || JSON.stringify(data);
        console.error('[Anthropic] Erreur API:', errMsg);
        throw new Error(errMsg);
    }
    const text = data.content?.[0]?.text || '';
    // Nettoyer les backticks markdown que le modèle peut inclure dans les JSON
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// ── Base de lieux japonais enrichis (1162 pépites) ──────────────────────
// Format: [lat, lon, nom_fr, nom_jp, ville, place_id, emoji, fatigue, type_fr, searchable]
const LIEUX_DB = [[36.562456,138.721263,"Higashiagatsuma","長野街道","Higashiagatsuma","ChIJY1sBIf55HmARJnQJPkZM3Ao","🛣️","medium","route historique","higashiagatsuma route historique higashiagatsuma"],[36.509542,139.188016,"Maebashi","つつじが峰通り","Maebashi","ChIJrbBn6t3zHmARVD7ORmWvg98","💎","medium","lieu secret","maebashi lieu secret maebashi"],[36.330988,140.12098,"Sakuragawa","坂東24番 雨引山 楽法寺 雨引観音","Sakuragawa","ChIJRdLYxBcCImARqLlDBAwHlS8","🛕","low","temple","sakuragawa temple sakuragawa"],[36.448175,138.609651,"Kitakaruizawa","長野原倉渕線","Naganohara","ChIJT1od-27aHWAR-lfC0bosBAA","💎","medium","lieu secret","kitakaruizawa lieu secret naganohara"],[36.336085,139.453465,"Ashikaga","足利学校跡","Ashikaga","ChIJ7dDztwUiH2ARfFpk4m6PlJU","🏛️","low","site historique","ashikaga site historique ashikaga"],[36.773455,140.368684,"Ikeda","大字池田","大子町","ChIJkUjR9BS_IWARgxSFPGxENs0","💎","medium","lieu secret","ikeda lieu secret 大子町"],[36.702223,139.207312,"Numata","日本ロマンチック街道","Numata","ChIJfaPM3MhaHmARphH--ih9mLk","🛣️","medium","route historique","numata route historique numata"],[36.764511,140.407156,"Fukuroda","袋田の滝","大子町","ChIJPdSyCy6-IWAR8yDZA-2PyKA","💧","high","cascade","fukuroda cascade 大子町"],[36.733366,140.617599,"Takahagi","Takahagi","Takahagi","","💎","medium","lieu secret","takahagi lieu secret takahagi"],[36.733313,140.617635,"Takahagi","Takahagi","Takahagi","","💎","medium","lieu secret","takahagi lieu secret takahagi"],[36.354467,140.610875,"Hitachinaka","水戸那珂湊線","Hitachinaka","ChIJr22ny1QuImAR5u6OP1x_p9w","💎","medium","lieu secret","hitachinaka lieu secret hitachinaka"],[36.405976,140.596476,"Hitachi Seaside Park","Hitachi Seaside Park","Hitachinaka","","🌿","medium","parc","hitachi seaside park parc hitachinaka"],[36.498655,138.916298,"Shibukawa","Shibukawa","Shibukawa","","💎","medium","lieu secret","shibukawa lieu secret shibukawa"],[36.498272,138.916513,"Shibukawa","カートルクラブ","Shibukawa","ChIJAV2Jvo1gHmARvQulkrPN_xk","💎","medium","lieu secret","shibukawa lieu secret shibukawa"],[36.463862,138.969114,"Ikaho Teddy Bear Museum","Ikaho Teddy Bear Museum","Yoshioka","","🏛️","low","musée","ikaho teddy bear museum musée yoshioka"],[36.73278,138.462147,"Hirao","湯道遊歩道","Yamanouchi","ChIJh1BYGhjxHWAR1nE0svhgB5Q","💎","medium","lieu secret","hirao lieu secret yamanouchi"],[36.642345,138.568506,"Nakanojō","Nakanojō","Nakanojō","","💎","medium","lieu secret","nakanojō lieu secret nakanojō"],[36.749269,139.589556,"Abîme de Kanman","Abîme de Kanman","Nikkō","","💎","medium","lieu secret","abîme de kanman lieu secret nikkō"],[36.565254,138.811122,"Higashiagatsuma","Higashiagatsuma","Higashiagatsuma","","💎","medium","lieu secret","higashiagatsuma lieu secret higashiagatsuma"],[36.89399,139.707547,"Nikkō","会津西街道","Nikkō","ChIJ0ciaxrekH2ARwNEdlkJrUm8","🛣️","medium","route historique","nikkō route historique nikkō"],[36.543115,140.64547,"Hitachi","河原子海水浴場","Hitachi","ChIJ7SpvDkKBIWARlGDuVCapy1k","💎","medium","lieu secret","hitachi lieu secret hitachi"],[36.738365,139.502157,"Nikkō","県営華厳の滝第1駐車場","Nikkō","ChIJ0ciaxrekH2ARwNEdlkJrUm8","💧","high","cascade","nikkō cascade nikkō"],[36.738084,139.501879,"Nikkō","県営華厳の滝第1駐車場","Nikkō","ChIJ0ciaxrekH2ARwNEdlkJrUm8","💧","high","cascade","nikkō cascade nikkō"],[36.780165,139.623726,"Aussichtsplattform","Aussichtsplattform","Nikkō","","💎","medium","lieu secret","aussichtsplattform lieu secret nikkō"],[36.406063,140.596476,"Hitachi Seaside Park","Hitachi Seaside Park","Hitachinaka","","🌿","medium","parc","hitachi seaside park parc hitachinaka"],[36.694835,138.774216,"Shima","伊東園ホテル四万","Nakanojō","ChIJ3QDPu7Z0HmARQBXJdiNcJmE","💎","medium","lieu secret","shima lieu secret nakanojō"],[36.694836,138.774324,"Shima","伊東園ホテル四万","Nakanojō","ChIJ3QDPu7Z0HmARQBXJdiNcJmE","💎","medium","lieu secret","shima lieu secret nakanojō"],[36.792501,139.428664,"Senjogahara Trail","Senjogahara Trail","Nikkō","","💎","medium","lieu secret","senjogahara trail lieu secret nikkō"],[36.142759,139.995049,"Shimotsuma","鯨","Shimotsuma","ChIJLzacYgupGGAR-xt_VMtTtw8","💎","medium","lieu secret","shimotsuma lieu secret shimotsuma"],[36.623098,138.596888,"Kusatsu","Kusatsu","Kusatsu","","💎","medium","lieu secret","kusatsu lieu secret kusatsu"],[36.620958,138.534312,"Kusatsu","本白根山展望所","Kusatsu","ChIJg67kMT_mHWAR0XtSkFA4zcY","🗻","high","montagne","kusatsu montagne kusatsu"],[36.70148,138.784181,"Shima","四万林道 (廃道)","Nakanojō","ChIJ3QDPu7Z0HmARQBXJdiNcJmE","💎","medium","lieu secret","shima lieu secret nakanojō"],[36.547965,140.224656,"Motegi","水戸街道","Motegi","ChIJhaluUBvwIWARSnPwa6x4eL8","🛣️","medium","route historique","motegi route historique motegi"],[36.700607,139.206417,"Numata","日本ロマンチック街道","Numata","ChIJfaPM3MhaHmARphH--ih9mLk","🛣️","medium","route historique","numata route historique numata"],[36.67253,138.78532,"Shima","国道353号","Nakanojō","ChIJ3QDPu7Z0HmARQBXJdiNcJmE","💎","medium","lieu secret","shima lieu secret nakanojō"],[36.620412,138.535086,"Kusatsu","本白根山展望所","Kusatsu","ChIJg67kMT_mHWAR0XtSkFA4zcY","🗻","high","montagne","kusatsu montagne kusatsu"],[36.226338,140.107663,"Tsukuba","白雲橋コース","Tsukuba","ChIJaQuD6-sLImARg7fEMay-UGo","🌉","low","pont","tsukuba pont tsukuba"],[36.405959,140.596519,"Hitachi Seaside Park","Hitachi Seaside Park","Hitachinaka","","🌿","medium","parc","hitachi seaside park parc hitachinaka"],[36.771225,139.557217,"Nikkō","日光","Nikkō","ChIJ0ciaxrekH2ARwNEdlkJrUm8","💎","medium","lieu secret","nikkō lieu secret nikkō"],[36.790806,139.69742,"Nikkō","江戸前横丁","Nikkō","ChIJ0ciaxrekH2ARwNEdlkJrUm8","💎","medium","lieu secret","nikkō lieu secret nikkō"],[36.585734,139.325496,"Midori","小中大滝駐車場","みどり市","ChIJ2csUg3n9HmAR08wXmQYnMAM","💧","high","cascade","midori cascade みどり市"],[36.301317,140.569199,"Minatochuo","サンビーチ通り","大洗町","ChIJrZ-BxzAxImARjBSiHLYNfw8","💎","medium","lieu secret","minatochuo lieu secret 大洗町"],[36.607707,138.617251,"Kusatsu","林道小雨線","Kusatsu","ChIJg67kMT_mHWAR0XtSkFA4zcY","💎","medium","lieu secret","kusatsu lieu secret kusatsu"],[36.922529,139.825128,"Yaita","塩原矢板線","Yaita","ChIJEestT3l4H2ARDyCaH0iElcY","💎","medium","lieu secret","yaita lieu secret yaita"],[36.833709,139.766847,"Shioya","西荒川林道","塩谷町","ChIJL1ie_l2dH2ARrDNubG0ugFw","🌊","medium","rivière","shioya rivière 塩谷町"],[36.600075,139.824638,"Utsunomiya","大谷町","Utsunomiya","ChIJO4BWk2xmH2ARwlSGeUl3Nck","💎","medium","lieu secret","utsunomiya lieu secret utsunomiya"],[36.936955,139.239765,"Hiuchigadake","竜宮沼尻川橋","檜枝岐村","ChIJeTEUAd4zHmARoCjhA4jvQyA","🌊","medium","rivière","hiuchigadake rivière 檜枝岐村"],[36.968565,139.849434,"Nasushiobara","竜化の滝","Nasushiobara","ChIJ52ovyqqIH2ARujh7RuJ0I90","💧","high","cascade","nasushiobara cascade nasushiobara"],[36.645752,140.139611,"Nasukarasuyama","滝","Nasukarasuyama","ChIJ5R2LXK_dIWAR1xCiweXrETg","💧","high","cascade","nasukarasuyama cascade nasukarasuyama"],[36.966623,139.249827,"Uonuma","段吉新道","檜枝岐村","ChIJo6_GsK2P9V8RsKrytlWwbOM","💎","medium","lieu secret","uonuma lieu secret 檜枝岐村"],[36.384312,138.5757,"Nagakura","千ヶ滝治山運搬路","軽井沢町","ChIJ2Smyp9LTHWARQKqT60zrujY","💧","high","cascade","nagakura cascade 軽井沢町"],[36.623354,138.795387,"Nakanojō","Nakanojō","Nakanojō","","💎","medium","lieu secret","nakanojō lieu secret nakanojō"],[36.646352,138.798109,"Shima","国道353号","Nakanojō","ChIJ3QDPu7Z0HmARQBXJdiNcJmE","💎","medium","lieu secret","shima lieu secret nakanojō"],[36.310981,138.980735,"Takasaki","高崎白衣大観音像","Takasaki","ChIJFRgmcJuIHmARUb-WsHiMau0","🛕","low","temple Kannon","takasaki temple kannon takasaki"],[36.225999,139.49993,"Tatebayashi","下三林町","Tatebayashi","ChIJz1TyiQ4wH2ARGldK2I1PQHc","💎","medium","lieu secret","tatebayashi lieu secret tatebayashi"],[36.81041,140.373712,"Daigo","月待ちの滝","大子町","ChIJS-UJ0LG4IWARLqTFi7SNd9E","💧","high","cascade","daigo cascade 大子町"],[36.51139,138.54132,"Kanbara","西窪","Tsumagoi","ChIJA54t4vfDHWAR3usPqfFjHvY","💎","medium","lieu secret","kanbara lieu secret tsumagoi"],[36.818318,139.093517,"Minakami","Minakami","Minakami","","💎","medium","lieu secret","minakami lieu secret minakami"],[36.336614,138.733648,"ED42 1","ED42 1","Annaka","","💎","medium","lieu secret","ed42 1 lieu secret annaka"],[36.795581,139.42856,"Nikkō","湯滝展望台","Nikkō","ChIJ0ciaxrekH2ARwNEdlkJrUm8","💧","high","cascade","nikkō cascade nikkō"],[43.821345,128.877175,"Mudanjiang","镜泊镇","镜泊镇","ChIJ78vkZzplTl4RHo2vAfaD1fw","💎","medium","lieu secret","mudanjiang lieu secret 镜泊镇"],[44.553608,129.630407,"Mudanjiang","学府社区","东兴街道","ChIJ78vkZzplTl4RHo2vAfaD1fw","💎","medium","lieu secret","mudanjiang lieu secret 东兴街道"],[37.745657,139.318865,"Aga","熊渡","Aga","ChIJK7mU2KUx9V8RaKIJ4wmtFXA","💎","medium","lieu secret","aga lieu secret aga"],[36.428297,136.936132,"Nanto","見座","Nanto","ChIJ3R95_Ls9-F8RswTgOhjX-78","💎","medium","lieu secret","nanto lieu secret nanto"],[37.485424,139.953588,"Aizuwakamatsu","湯川大町線","Aizu-Wakamatsu","ChIJM5s9z3tV9V8RQYEg09PkYF0","🌊","medium","rivière","aizuwakamatsu rivière aizu-wakamatsu"],[43.43384,144.089772,"Kushiro","国道240号","Kushiro","ChIJ0-NaIlRdcl8ReqtC8oEIzgQ","💎","medium","lieu secret","kushiro lieu secret kushiro"],[39.418449,140.150039,"Yurihonjō","Yurihonjō","Yurihonjō","","💎","medium","lieu secret","yurihonjō lieu secret yurihonjō"],[39.717447,140.121505,"Musée d'art d'Akita","Musée d'art d'Akita","Akita","","🏛️","low","musée","musée d'art d'akita musée akita"],[38.275431,140.603108,"Sendai","仙台山寺線","Sendai","ChIJ01XNMO4qil8R7rFGuOB5Jbo","🛕","low","temple","sendai temple sendai"],[36.815127,137.041791,"Takaoka","国道415号","Takaoka","ChIJo8Uv4X54918RLvuB4w9D-jY","💎","medium","lieu secret","takaoka lieu secret takaoka"],[36.814998,137.042112,"Takaoka","義経岩","Takaoka","ChIJo8Uv4X54918RLvuB4w9D-jY","💎","medium","lieu secret","takaoka lieu secret takaoka"],[40.521048,140.156787,"Kawaratai","暗門滝","西目屋村","ChIJv12nQ6j2ml8R_bzHW5pUZTc","💧","high","cascade","kawaratai cascade 西目屋村"],[40.831255,140.734738,"Aomori","５・６番線","Aomori","ChIJo2orHPCfm18RfqGFbZwtxv8","💎","medium","lieu secret","aomori lieu secret aomori"],[40.807514,140.700795,"Musée préfectoral d'Aomori","Musée préfectoral d'Aomori","Aomori","","🏛️","low","musée","musée préfectoral d'aomori musée aomori"],[42.927126,141.410415,"Sapporo","真駒内御料札幌線","Sapporo","ChIJMzaXWnXUCl8R1bqHRp1-kzM","💎","medium","lieu secret","sapporo lieu secret sapporo"],[36.976405,137.603711,"Asahi","Asahihisuikaigan Auto Camping Ground 朝日ヒスイ海岸オートキャンプ場","Asahi","ChIJEbE1xNyy918RjMovwy4LrhE","🏖️","medium","plage","asahi plage asahi"],[37.39414,140.375413,"Kōriyama","郡山湖南線","Kōriyama","ChIJk6rAHJkNIGARyzbbcxSRTrI","🌊","medium","lac","kōriyama lac kōriyama"],[40.89767,140.862767,"Aomori","浅虫水族館","Aomori","ChIJo2orHPCfm18RfqGFbZwtxv8","💎","medium","lieu secret","aomori lieu secret aomori"],[40.895211,140.859719,"Aomori","浅虫海水浴場","Aomori","ChIJo2orHPCfm18RfqGFbZwtxv8","💎","medium","lieu secret","aomori lieu secret aomori"],[40.890567,140.862895,"Aomori","浅虫観光案内所","Aomori","ChIJo2orHPCfm18RfqGFbZwtxv8","💎","medium","lieu secret","aomori lieu secret aomori"],[43.176188,141.067813,"Otaru","国道5号","Otaru","ChIJO3nvmK7fCl8RodlajWJ7Pgo","💎","medium","lieu secret","otaru lieu secret otaru"],[42.919261,141.372435,"Sapporo","真駒内御料札幌線","Sapporo","ChIJMzaXWnXUCl8R1bqHRp1-kzM","💎","medium","lieu secret","sapporo lieu secret sapporo"],[43.076895,140.985639,"Tokiwa","明治常盤林道","赤井川村","ChIJJU1E_7zcCl8RDYAX3f7wMTg","💎","medium","lieu secret","tokiwa lieu secret 赤井川村"],[42.911316,141.970039,"Yūbari","Yūbari","Yūbari","","💎","medium","lieu secret","yūbari lieu secret yūbari"],[36.865905,136.758472,"Hakui","千里浜なぎさドライブウェイ","Hodatsushimizu","ChIJdbIS0G1p918RqLKqZW5G6tQ","💎","medium","lieu secret","hakui lieu secret hodatsushimizu"],[36.86605,136.758364,"Hakui","千里浜なぎさドライブウェイ","Hodatsushimizu","ChIJdbIS0G1p918RqLKqZW5G6tQ","💎","medium","lieu secret","hakui lieu secret hodatsushimizu"],[38.947287,141.039408,"Ichinoseki","Ichinoseki","Ichinoseki","","💎","medium","lieu secret","ichinoseki lieu secret ichinoseki"],[40.488826,140.95121,"Towada","国道102号","Towada","ChIJYzcvYZk_m18ReGosRqypTH8","💎","medium","lieu secret","towada lieu secret towada"],[38.602624,139.88709,"Tsuruoka","注連寺","Tsuruoka","ChIJKxWZzi51jF8R15BilRYA6sY","🛕","low","temple","tsuruoka temple tsuruoka"],[43.508476,142.984363,"Kuttari","新得町","新得町","ChIJAUBt-qZsc18RKJ9vwtkZ6zQ","💎","medium","lieu secret","kuttari lieu secret 新得町"],[42.871341,141.385436,"Eniwa","恵庭岳公園線","Eniwa","ChIJTSmcsBYpdV8R4Aw9KoSV180","🌿","medium","parc","eniwa parc eniwa"],[41.867778,140.116002,"Esashi","瓶子岩","江差町","ChIJMYy-Nt4en18ROiAzgYaiZBk","💎","medium","lieu secret","esashi lieu secret 江差町"],[39.190246,140.643203,"Tagonai","東成瀬村","東成瀬村","ChIJ_yPzbT0ij18RQ86u-6L1fCc","💎","medium","lieu secret","tagonai lieu secret 東成瀬村"],[43.194861,140.839,"Yoichi","余市町","余市町","ChIJr1Wdl47lCl8R36_afFs-9sQ","💎","medium","lieu secret","yoichi lieu secret 余市町"],[38.055421,140.758857,"Funaoka","しばた千桜橋","柴田町","ChIJwWaMsSg-il8RKudOIbYAKVw","🌉","low","pont","funaoka pont 柴田町"],[44.09723,145.01475,"Onnebetsumura","ウトロ崎灯台","斜里町","ChIJUxB20nC5bF8RhltrRW3IoWY","💎","medium","lieu secret","onnebetsumura lieu secret 斜里町"],[44.09721,145.0147,"Onnebetsumura","ウトロ崎灯台","斜里町","ChIJUxB20nC5bF8RhltrRW3IoWY","💎","medium","lieu secret","onnebetsumura lieu secret 斜里町"],[38.331133,138.485904,"Sado","佐渡一周線","Sado","ChIJ5QEt03Nd818RE1pKKKZgZb8","💎","medium","lieu secret","sado lieu secret sado"],[37.093923,136.726801,"Shika","Shika","Shika","","💎","medium","lieu secret","shika lieu secret shika"],[37.094069,136.726823,"Shika","Shika","Shika","","💎","medium","lieu secret","shika lieu secret shika"],[40.831554,140.778913,"Aomori","国道4号","Aomori","ChIJo2orHPCfm18RfqGFbZwtxv8","💎","medium","lieu secret","aomori lieu secret aomori"],[40.319994,140.295384,"Fujikoto","滝の沢神社","藤里町","ChIJ__2lSVnrml8RbBNeNLhSOpY","⛩️","low","sanctuaire","fujikoto sanctuaire 藤里町"],[38.989582,141.255591,"Ichinoseki","東山町長坂","Ichinoseki","ChIJR0dUqjzQiF8RX-8lSsz0zXw","🗻","high","montagne","ichinoseki montagne ichinoseki"],[43.716633,142.975142,"Sōunkyō","国道39号","上川町","ChIJJym7TN0tDV8RI_ca_kmfXkQ","💎","medium","lieu secret","sōunkyō lieu secret 上川町"],[43.716923,142.974782,"Sōunkyō","国道39号","上川町","ChIJJym7TN0tDV8RI_ca_kmfXkQ","💎","medium","lieu secret","sōunkyō lieu secret 上川町"],[38.57072,140.530677,"Bain public Shirogane-yu","Bain public Shirogane-yu","Obanazawa","","💎","medium","lieu secret","bain public shirogane-yu lieu secret obanazawa"],[36.426655,136.935576,"Nanto","村社　地主神社","Nanto","ChIJ3R95_Ls9-F8RswTgOhjX-78","⛩️","low","sanctuaire","nanto sanctuaire nanto"],[36.426655,136.936048,"Nanto","見座","Nanto","ChIJ3R95_Ls9-F8RswTgOhjX-78","💎","medium","lieu secret","nanto lieu secret nanto"],[37.651251,140.073279,"Hibara","五色沼自然探勝路","北塩原村","ChIJI3OssT28il8RFOfsOuxXrV0","💎","medium","lieu secret","hibara lieu secret 北塩原村"],[39.954327,140.854168,"Semboku","鏡沼","Semboku","ChIJ7WvXuTNghV8R6Nn4LWFhmw8","💎","medium","lieu secret","semboku lieu secret semboku"],[43.626638,142.78669,"Higashikawa","羽衣の滝","Biei","ChIJ51tEMk3YDF8RR2-La0M7eNE","💧","high","cascade","higashikawa cascade biei"],[41.774233,140.789393,"Hakodate","湯川町二丁目","Hakodate","ChIJIU281S1cnl8RW8N4lip9fZE","🌊","medium","rivière","hakodate rivière hakodate"],[41.772559,140.725648,"Hakodate","はこだて","Hakodate","ChIJIU281S1cnl8RW8N4lip9fZE","💎","medium","lieu secret","hakodate lieu secret hakodate"],[42.866903,141.40149,"Eniwa","恵庭岳公園線","Eniwa","ChIJTSmcsBYpdV8R4Aw9KoSV180","🌿","medium","parc","eniwa parc eniwa"],[36.702079,137.837095,"Hokujo","白馬岳線","白馬村","ChIJRQv-ZMLN918RdwbxiNqBUr4","🗻","high","montagne","hokujo montagne 白馬村"],[43.698672,141.634861,"Uryū","雨竜町","雨竜町","ChIJb-si6GyEDF8RaCCJcKxUZ0Y","💎","medium","lieu secret","uryū lieu secret 雨竜町"],[42.866802,141.401502,"Eniwa","恵庭岳公園線","Eniwa","ChIJTSmcsBYpdV8R4Aw9KoSV180","🌿","medium","parc","eniwa parc eniwa"],[39.454739,141.062549,"Hanamaki","花巻停車場花巻温泉郷線","Hanamaki","ChIJgz0EI29gj18RQj6Zmh87hJA","♨️","low","onsen","hanamaki onsen hanamaki"],[36.945457,137.034668,"Himi","国道160号","Himi","ChIJQXOdsARy918RKCz-X22VMkA","💎","medium","lieu secret","himi lieu secret himi"],[38.987209,141.112284,"Hiraizumi","Hiraizumi","Hiraizumi","","💎","medium","lieu secret","hiraizumi lieu secret hiraizumi"],[38.992954,141.111062,"Hiraizumi","平泉文化遺産センター","Hiraizumi","ChIJnVnlqgTSiF8RAIoivd3z654","💎","medium","lieu secret","hiraizumi lieu secret hiraizumi"],[40.607953,140.463626,"Château de Hirosaki","Château de Hirosaki","Hirosaki","","🏯","medium","château","château de hirosaki château hirosaki"],[39.15403,140.150618,"Yurihonjō","Yurihonjō","Yurihonjō","","💎","medium","lieu secret","yurihonjō lieu secret yurihonjō"],[44.438081,142.493658,"Nayoro","Nayoro","Nayoro","","💎","medium","lieu secret","nayoro lieu secret nayoro"],[38.306533,140.660431,"Sendai","国道48号","Sendai","ChIJ01XNMO4qil8R7rFGuOB5Jbo","💎","medium","lieu secret","sendai lieu secret sendai"],[43.077208,142.598645,"Nakatomamu","雲海テラス","南富良野町","ChIJQ76RA2hhc18RX3l5EI2UTIM","💎","medium","lieu secret","nakatomamu lieu secret 南富良野町"],[41.310318,140.804196,"Chogo","大町桂月歌碑","佐井村","ChIJeTXx-RsQnF8RhwUlfwvxPDk","💎","medium","lieu secret","chogo lieu secret 佐井村"],[39.108131,140.159336,"Yurihonjō","法体の滝","Yurihonjō","ChIJx3Oz7oxVjl8RHowf8DckCF4","💧","high","cascade","yurihonjō cascade yurihonjō"],[37.905137,139.451753,"Shibata","南俣林道南俣支線","Shibata","ChIJiWgsRQsvi18RJNoup2z6ls0","💎","medium","lieu secret","shibata lieu secret shibata"],[36.433286,136.545862,"Nomi","いしかわ動物園","Nomi","ChIJt6tPyq1P-F8RTgrkn0XKMdE","💎","medium","lieu secret","nomi lieu secret nomi"],[38.429728,141.310943,"Ishinomaki","西中瀬橋","Ishinomaki","ChIJHSxGaSyliV8RRZUi_qbWR9I","🌉","low","pont","ishinomaki pont ishinomaki"],[36.802206,140.760082,"Kitaibaraki","磯原町磯原","Kitaibaraki","ChIJYUZoPVp1IWARktqM40QcqCM","💎","medium","lieu secret","kitaibaraki lieu secret kitaibaraki"],[42.336959,141.029032,"Muroran","東町三丁目","Muroran","ChIJXT2vKcnbn18RDbMPCapO1C8","💎","medium","lieu secret","muroran lieu secret muroran"],[38.193979,139.428638,"Murakami","岩船北浜町","Murakami","ChIJFzoHud13i18RYzzckT--Mk4","💎","medium","lieu secret","murakami lieu secret murakami"],[44.110907,145.089327,"Onnebetsumura","知床公園線","斜里町","ChIJUxB20nC5bF8RhltrRW3IoWY","🌿","medium","parc","onnebetsumura parc 斜里町"],[36.833348,140.802741,"Kitaibaraki","大津町字五浦三丁目","Kitaibaraki","ChIJYUZoPVp1IWARktqM40QcqCM","💎","medium","lieu secret","kitaibaraki lieu secret kitaibaraki"],[44.45211,142.625518,"Omu","Omu","Omu","","💎","medium","lieu secret","omu lieu secret omu"],[39.599285,140.561819,"Semboku","角館町","Semboku","ChIJ7WvXuTNghV8R6Nn4LWFhmw8","💎","medium","lieu secret","semboku lieu secret semboku"],[39.45578,141.066225,"Hanamaki","佳松園","Hanamaki","ChIJgz0EI29gj18RQj6Zmh87hJA","💎","medium","lieu secret","hanamaki lieu secret hanamaki"],[40.874709,141.134305,"Noheji","田名部道","野辺地町","ChIJ08_9jCuAnF8RxzXH6PBjbtA","💎","medium","lieu secret","noheji lieu secret 野辺地町"],[39.256749,141.900618,"Kamaishi","釜石大観音","Kamaishi","ChIJO5BE1jsJhl8RDxQAKuNwKdc","🛕","low","temple Kannon","kamaishi temple kannon kamaishi"],[45.118945,141.200181,"Senhoshi","沓形仙法志鴛泊線","Rishiri","ChIJX4oNki3GD18RWdOR8Gic47Q","💎","medium","lieu secret","senhoshi lieu secret rishiri"],[38.874925,140.455525,"Shinjō","Shinjō","Shinjō","","💎","medium","lieu secret","shinjō lieu secret shinjō"],[38.157309,140.276535,"Kaminoyama","土岐家由来の七層塔について","Kaminoyama","ChIJnR8zLxpNil8RnbFOcsAdBkE","💎","medium","lieu secret","kaminoyama lieu secret kaminoyama"],[43.142293,140.429811,"Kamoenai","神恵内村","神恵内村","ChIJbcPMu0XzCl8R3ne6Nw5X3ms","💎","medium","lieu secret","kamoenai lieu secret 神恵内村"],[44.152145,145.131106,"Onnebetsumura","立入禁止","斜里町","ChIJUxB20nC5bF8RhltrRW3IoWY","💎","medium","lieu secret","onnebetsumura lieu secret 斜里町"],[44.151906,145.133638,"Onnebetsumura","立入禁止","斜里町","ChIJUxB20nC5bF8RhltrRW3IoWY","💎","medium","lieu secret","onnebetsumura lieu secret 斜里町"],[44.158656,145.122254,"Onnebetsumura","知床公園線","斜里町","ChIJUxB20nC5bF8RhltrRW3IoWY","🌿","medium","parc","onnebetsumura parc 斜里町"],[36.57143,136.662714,"Kanazawa","金沢蓄音器館","Kanazawa","ChIJw2aFRlU2-F8RFWLeb8RV8Y0","💎","medium","lieu secret","kanazawa lieu secret kanazawa"],[44.246603,145.225788,"Onnebetsumura","斜里町","斜里町","ChIJUxB20nC5bF8RhltrRW3IoWY","💎","medium","lieu secret","onnebetsumura lieu secret 斜里町"],[38.831369,141.591193,"Kesennuma","気仙沼市東日本大震災遺構・伝承館","Kesennuma","ChIJu2OZ_v6UiF8Rd4p3l7LihwA","💎","medium","lieu secret","kesennuma lieu secret kesennuma"],[43.088512,145.081718,"Hamanaka","琵琶瀬茶内停車場線","浜中町","ChIJe8xAJHHjbV8RlRo2BF06Ux0","💎","medium","lieu secret","hamanaka lieu secret 浜中町"],[36.763533,140.739159,"Kitaibaraki","陸前浜街道","Kitaibaraki","ChIJYUZoPVp1IWARktqM40QcqCM","🛣️","medium","route historique","kitaibaraki route historique kitaibaraki"],[38.036667,138.241673,"Sado","北沢地区施設群","Sado","ChIJ5QEt03Nd818RE1pKKKZgZb8","💎","medium","lieu secret","sado lieu secret sado"],[40.614685,139.861313,"Furô-Fushi Onsen","Furô-Fushi Onsen","深浦町","","♨️","low","onsen","furô-fushi onsen onsen 深浦町"],[37.121639,139.998984,"Yumoto","駒止の滝観瀑台","Nasu","ChIJ8VldjD2KH2ARbtWmvFb0cA0","💧","high","cascade","yumoto cascade nasu"],[43.646819,142.788147,"Higashikawa","旭川旭岳温泉線","東川町","ChIJ51tEMk3YDF8RR2-La0M7eNE","🗻","high","montagne","higashikawa montagne 東川町"],[38.181359,140.159221,"Nanyō","Nanyō","Nanyō","","💎","medium","lieu secret","nanyō lieu secret nanyō"],[40.169813,141.724532,"Kuji","Kuji","Kuji","","💎","medium","lieu secret","kuji lieu secret kuji"],[40.520159,140.97341,"Towada","国道102号","Towada","ChIJYzcvYZk_m18ReGosRqypTH8","💎","medium","lieu secret","towada lieu secret towada"],[40.520216,140.973249,"Towada","国道102号","Towada","ChIJYzcvYZk_m18ReGosRqypTH8","💎","medium","lieu secret","towada lieu secret towada"],[40.520333,140.973232,"Towada","国道102号","Towada","ChIJYzcvYZk_m18ReGosRqypTH8","💎","medium","lieu secret","towada lieu secret towada"],[38.958241,140.773642,"Ichinoseki","東成瀬村","東成瀬村","ChIJR0dUqjzQiF8RX-8lSsz0zXw","💎","medium","lieu secret","ichinoseki lieu secret 東成瀬村"],[36.566761,137.662873,"Barrage de Kurobe","Barrage de Kurobe","立山町","","💎","medium","lieu secret","barrage de kurobe lieu secret 立山町"],[40.629642,140.11177,"Ajigasawa","鰺ヶ沢町","鰺ヶ沢町","ChIJsXxOtN5Wml8RnRv_63Nmh9E","💎","medium","lieu secret","ajigasawa lieu secret 鰺ヶ沢町"],[40.629013,140.111718,"Ajigasawa","鰺ヶ沢町","鰺ヶ沢町","ChIJsXxOtN5Wml8RnRv_63Nmh9E","💎","medium","lieu secret","ajigasawa lieu secret 鰺ヶ沢町"],[43.074027,144.320558,"Kushiro","釧路市湿原展望台","Kushiro","ChIJ0-NaIlRdcl8ReqtC8oEIzgQ","💎","medium","lieu secret","kushiro lieu secret kushiro"],[37.682611,140.056629,"Kitashiobara","会津若松裏磐梯線","北塩原村","ChIJy5w_S6u-il8Rfa7QjaxCRuA","💎","medium","lieu secret","kitashiobara lieu secret 北塩原村"],[38.202278,140.689486,"Ono","秋保温泉川崎線","川崎町","ChIJTQMPhrUxil8RGRrVssmbTJM","🌊","medium","rivière","ono rivière 川崎町"],[42.501936,141.179569,"Kojohama","白老町","白老町","ChIJ5SrONClkdV8R1QQvwgbxoEE","💎","medium","lieu secret","kojohama lieu secret 白老町"],[44.062428,144.147062,"Abashiri","Abashiri","Abashiri","","💎","medium","lieu secret","abashiri lieu secret abashiri"],[43.250274,145.518115,"Nemuro","Nemuro","Nemuro","","💎","medium","lieu secret","nemuro lieu secret nemuro"],[43.182797,144.500622,"Shibecha","国道391号","Shibecha","ChIJxb96UiqIbV8R8u4YnCfTyao","💎","medium","lieu secret","shibecha lieu secret shibecha"],[39.728467,140.663241,"Semboku","Semboku","Semboku","","💎","medium","lieu secret","semboku lieu secret semboku"],[40.479716,140.900404,"Towada","Towada","Towada","","💎","medium","lieu secret","towada lieu secret towada"],[42.584871,140.846927,"Sobetsu","Sobetsu","Sobetsu","","💎","medium","lieu secret","sobetsu lieu secret sobetsu"],[42.566358,140.821257,"Toyakoonsen","湖畔通り","Toyako","ChIJtUjRV8Din18Rds6kQjvXdBo","🌊","medium","lac","toyakoonsen lac toyako"],[37.686844,140.24803,"Fukushima","幕川温泉 吉倉屋旅館","Fukushima","ChIJ2U06KtGOil8RRuNPwQ9NBgw","🌊","medium","rivière","fukushima rivière fukushima"],[42.915427,141.393222,"Sapporo","鱒見の滝","Sapporo","ChIJMzaXWnXUCl8R1bqHRp1-kzM","💧","high","cascade","sapporo cascade sapporo"],[39.872481,140.922683,"Hachimantai","Hachimantai","Hachimantai","","💎","medium","lieu secret","hachimantai lieu secret hachimantai"],[39.895678,140.960137,"Hachimantai","雫石東八幡平線","Hachimantai","ChIJ5yn2VAo7hV8RRmTIinmmd5E","💎","medium","lieu secret","hachimantai lieu secret hachimantai"],[37.821684,140.132552,"Yonezawa","大平","Yonezawa","ChIJRW93fNftil8R942L7zfvrwc","💎","medium","lieu secret","yonezawa lieu secret yonezawa"],[40.558492,140.906453,"Towada","Towada","Towada","","💎","medium","lieu secret","towada lieu secret towada"],[38.313223,141.079375,"Shichigahama","吉田浜","七ヶ浜町","ChIJD-SML5KPiV8R6vRn8ejhruo","💎","medium","lieu secret","shichigahama lieu secret 七ヶ浜町"],[38.332607,141.096425,"Shiogama","鬼ヶ浜","Shiogama","ChIJkcFbPrSaiV8RE36Xj_17vt0","💎","medium","lieu secret","shiogama lieu secret shiogama"],[38.22489,140.857374,"Sendai","長町八木山線","Sendai","ChIJ01XNMO4qil8R7rFGuOB5Jbo","🗻","high","montagne","sendai montagne sendai"],[36.580551,137.597283,"Route à péage du mont Tate","Route à péage du mont Tate","立山町","","🗻","high","montagne","route à péage du mont tate montagne 立山町"],[40.292277,140.959037,"Takko","ミロク林道","田子町","ChIJt_lXmXorm18RquPCp5-N9co","💎","medium","lieu secret","takko lieu secret 田子町"],[39.119736,139.873493,"Nikaho","Nikaho","Nikaho","","💎","medium","lieu secret","nikaho lieu secret nikaho"],[38.04088,140.530478,"Shiroishi","宮城蔵王キツネ村","Shiroishi","ChIJRTlXkUJCil8RiIJS4NtRnXc","🏯","medium","château","shiroishi château shiroishi"],[39.693137,141.024493,"Morioka","盛岡手づくり村","Morioka","ChIJAf68lVF1hV8RllYAW94tPB8","💎","medium","lieu secret","morioka lieu secret morioka"],[41.763306,140.712974,"Hakodate","カトリック元町教会","Hakodate","ChIJIU281S1cnl8RW8N4lip9fZE","💎","medium","lieu secret","hakodate lieu secret hakodate"],[39.162587,139.952312,"Nikaho","元滝伏流水","Nikaho","ChIJHT8xwfL1jl8R4iqol5bv3is","💧","high","cascade","nikaho cascade nikaho"],[37.621801,140.287947,"Nihonmatsu","Nihonmatsu","Nihonmatsu","","💎","medium","lieu secret","nihonmatsu lieu secret nihonmatsu"],[37.722195,140.264162,"Fukushima","福島吾妻裏磐梯線","Fukushima","ChIJ2U06KtGOil8RRuNPwQ9NBgw","💎","medium","lieu secret","fukushima lieu secret fukushima"],[38.701114,139.999849,"Shōnai","立川鶴岡自転車道線","Shōnai","ChIJqbWwpQ8EjF8RZUMsvCyE3BU","🌊","medium","rivière","shōnai rivière shōnai"],[41.308977,141.087798,"Mutsu","恐山林道","Mutsu","ChIJmSRIktoVnF8Rv-lDdImwNGk","🗻","high","montagne","mutsu montagne mutsu"],[37.705312,138.809271,"Nagaoka","弥彦山スカイライン","Nagaoka","ChIJLTUCVXoH9V8R7_cio0uDPFE","🗻","high","montagne","nagaoka montagne nagaoka"],[42.827353,140.806649,"Kutchan","真狩コース · Makkari trail","Niseko","ChIJfTTAx-q5Cl8Rqx93lDjX1c0","💎","medium","lieu secret","kutchan lieu secret niseko"],[38.141303,140.442957,"Mt. Zizo","Mt. Zizo","Kaminoyama","","💎","medium","lieu secret","mt. zizo lieu secret kaminoyama"],[38.122269,140.448259,"Togattaonsen","蔵王エコーライン","蔵王町","ChIJl-QkOORHil8R8rmLPUYEonM","♨️","low","onsen","togattaonsen onsen 蔵王町"],[38.153337,140.446127,"Yamagata","Yamagata","Yamagata","","💎","medium","lieu secret","yamagata lieu secret yamagata"],[36.578969,137.599537,"Ashikuraji","立山室堂山荘","立山町","ChIJjwQzJIjo918R6NFuFMW2uyQ","🗻","high","montagne","ashikuraji montagne 立山町"],[36.850304,138.132905,"Myōkō","信濃町","信濃町","ChIJz6u_pbUV9l8RvrY1VZZUI_0","💎","medium","lieu secret","myōkō lieu secret 信濃町"],[36.563885,136.651217,"Street Vendor Hot Dog","Street Vendor Hot Dog","Kanazawa","","💎","medium","lieu secret","street vendor hot dog lieu secret kanazawa"],[38.014304,140.397295,"Shichikashuku","旬の市七ヶ宿 農林産物直売所","七ヶ宿町","ChIJI6byX7lail8RlmseWTZ-2ZM","💎","medium","lieu secret","shichikashuku lieu secret 七ヶ宿町"],[38.014432,140.396403,"Shichikashuku","国道113号","七ヶ宿町","ChIJI6byX7lail8RlmseWTZ-2ZM","💎","medium","lieu secret","shichikashuku lieu secret 七ヶ宿町"],[36.934876,137.600179,"Asahi","Asahi","Asahi","","💎","medium","lieu secret","asahi lieu secret asahi"],[38.319322,140.853901,"Sendai","加茂幹線２号線","Sendai","ChIJ01XNMO4qil8R7rFGuOB5Jbo","💎","medium","lieu secret","sendai lieu secret sendai"],[40.355931,140.783745,"Kazuno","大館十和田湖線","Kosaka","ChIJme_x5LHSml8R1fEWEG6qZH4","🌊","medium","lac","kazuno lac kosaka"],[37.525345,130.871161,"나리길","나리길","북면","","💎","medium","lieu secret","나리길 lieu secret 북면"],[38.72919,140.691005,"Ōsaki","鳴子峡レストハウス","Ōsaki","ChIJPxjwvzw-iV8RIoUF4Zv4xmM","💎","medium","lieu secret","ōsaki lieu secret ōsaki"],[40.829479,140.735532,"Aomori","青森ふるさとショップ アイモリー","Aomori","ChIJo2orHPCfm18RfqGFbZwtxv8","🌲","high","forêt","aomori forêt aomori"],[38.550315,139.57251,"Tsuruoka","国道345号","Tsuruoka","ChIJKxWZzi51jF8R15BilRYA6sY","💎","medium","lieu secret","tsuruoka lieu secret tsuruoka"],[40.2684,141.316848,"Ninohe","二戸九戸線","Ninohe","ChIJtyqUrMzWhF8R3Lu_M60RG78","💎","medium","lieu secret","ninohe lieu secret ninohe"],[42.559789,140.801488,"Toyako","Toyako","Toyako","","💎","medium","lieu secret","toyako lieu secret toyako"],[45.44877,141.643324,"Wakkanai","ノシャップ岬","Wakkanai","ChIJYytB70EwEF8RTMI1gt_NSGo","💎","medium","lieu secret","wakkanai lieu secret wakkanai"],[37.403731,136.946617,"Wajima","国道249号","Wajima","ChIJRVqGdSg58V8RslKCeDDWO9Q","💎","medium","lieu secret","wajima lieu secret wajima"],[37.908889,138.479625,"Sado","佐渡一周線","Sado","ChIJ5QEt03Nd818RE1pKKKZgZb8","💎","medium","lieu secret","sado lieu secret sado"],[39.942397,139.704406,"Aquarium GAO d'Oga","Aquarium GAO d'Oga","Oga","","💎","medium","lieu secret","aquarium gao d'oga lieu secret oga"],[39.931678,139.781975,"Oga","北浦安全寺","Oga","ChIJFSZCYhsXkF8RlukwHZo_szY","🛕","low","temple","oga temple oga"],[40.490068,140.952538,"Towada","国道102号","Towada","ChIJYzcvYZk_m18ReGosRqypTH8","💎","medium","lieu secret","towada lieu secret towada"],[38.136273,140.449567,"Maekawa","蔵王のお釜","蔵王町","ChIJG6vf-EQ2il8RVHT4vwczQCU","💎","medium","lieu secret","maekawa lieu secret 蔵王町"],[43.370042,143.978399,"Ashoro","Ashoro","Ashoro","","💎","medium","lieu secret","ashoro lieu secret ashoro"],[37.691221,140.12295,"Hibara","パークゴルフ","北塩原村","ChIJI3OssT28il8RFOfsOuxXrV0","💎","medium","lieu secret","hibara lieu secret 北塩原村"],[38.272722,140.845001,"Sendai","大崎八幡宮","Sendai","ChIJ01XNMO4qil8R7rFGuOB5Jbo","💎","medium","lieu secret","sendai lieu secret sendai"],[36.580008,140.660527,"Hitachi","会瀬海水浴場","Hitachi","ChIJ7SpvDkKBIWARlGDuVCapy1k","💎","medium","lieu secret","hitachi lieu secret hitachi"],[44.038094,144.935259,"Shari","国道334号","斜里町","ChIJOU_nKlvDbF8RHfNekp0elQA","💎","medium","lieu secret","shari lieu secret 斜里町"],[44.038298,144.935598,"Shari","斜里町","斜里町","ChIJOU_nKlvDbF8RHfNekp0elQA","💎","medium","lieu secret","shari lieu secret 斜里町"],[41.308816,141.088228,"Mutsu","恐山林道","Mutsu","ChIJmSRIktoVnF8Rv-lDdImwNGk","🗻","high","montagne","mutsu montagne mutsu"],[42.654383,141.069093,"Date","国道453号","Date","ChIJF2tL1LZbdV8RVo-dc5Kxm7c","💎","medium","lieu secret","date lieu secret date"],[43.199128,141.00217,"Otaru","小樽運河","Otaru","ChIJO3nvmK7fCl8RodlajWJ7Pgo","💎","medium","lieu secret","otaru lieu secret otaru"],[37.330917,139.860586,"Shimogō","下郷会津本郷線","下郷町","ChIJoaGTPKr6H2ARylfi32rs_sA","💎","medium","lieu secret","shimogō lieu secret 下郷町"],[38.276492,138.444942,"Sado","佐渡一周線","Sado","ChIJ5QEt03Nd818RE1pKKKZgZb8","💎","medium","lieu secret","sado lieu secret sado"],[43.912461,144.192522,"Ōzora","女満別眺湖台三丁目","Ozora","ChIJeypn-Y5GbV8Rw4xCaryS1Dc","🌊","medium","lac","ōzora lac ozora"],[42.865944,141.408918,"Eniwa","島松滝の沢林道","Eniwa","ChIJTSmcsBYpdV8R4Aw9KoSV180","💧","high","cascade","eniwa cascade eniwa"],[42.866124,141.408101,"Eniwa","島松滝の沢林道","Eniwa","ChIJTSmcsBYpdV8R4Aw9KoSV180","💧","high","cascade","eniwa cascade eniwa"],[44.01554,145.186339,"Rausu","羅臼国後展望塔","Rausu","ChIJ_YwxQ5bAbF8RB1nSuDecgTU","💎","medium","lieu secret","rausu lieu secret rausu"],[44.023509,145.192035,"Rausu","羅臼神社","Rausu","ChIJ_YwxQ5bAbF8RB1nSuDecgTU","⛩️","low","sanctuaire","rausu sanctuaire rausu"],[38.881049,141.549942,"Kesennuma","リアス・アーク美術館","Kesennuma","ChIJu2OZ_v6UiF8Rd4p3l7LihwA","🎨","low","musée art","kesennuma musée art kesennuma"],[43.718863,142.97457,"Sōunkyō","国道39号","上川町","ChIJJym7TN0tDV8RI_ca_kmfXkQ","💎","medium","lieu secret","sōunkyō lieu secret 上川町"],[43.717499,142.972589,"Sōunkyō","国道39号","上川町","ChIJJym7TN0tDV8RI_ca_kmfXkQ","💎","medium","lieu secret","sōunkyō lieu secret 上川町"],[39.860216,141.797091,"Iwaizumi","岩泉","Iwaizumi","ChIJB5T93fBThF8R6T5_LfQSpEc","💎","medium","lieu secret","iwaizumi lieu secret iwaizumi"],[38.058281,138.3259,"Sado","Sado","Sado","","💎","medium","lieu secret","sado lieu secret sado"],[37.898323,138.296197,"Sado","静平西三川線","Sado","ChIJ5QEt03Nd818RE1pKKKZgZb8","🌊","medium","rivière","sado rivière sado"],[42.86503,141.411058,"Eniwa","三段の滝","Eniwa","ChIJTSmcsBYpdV8R4Aw9KoSV180","💧","high","cascade","eniwa cascade eniwa"],[38.911,139.837285,"Sakata","吹浦酒田線","Sakata","ChIJo1dVzT2bjl8RxenugqXPXRQ","💎","medium","lieu secret","sakata lieu secret sakata"],[38.910958,139.837103,"Sakata","吹浦酒田線","Sakata","ChIJo1dVzT2bjl8RxenugqXPXRQ","💎","medium","lieu secret","sakata lieu secret sakata"],[38.828128,141.602203,"Kesennuma","大島浪板線","Kesennuma","ChIJu2OZ_v6UiF8Rd4p3l7LihwA","💎","medium","lieu secret","kesennuma lieu secret kesennuma"],[42.942068,141.342383,"Sapporo","ミュージアムショップポレール","Sapporo","ChIJMzaXWnXUCl8R1bqHRp1-kzM","💎","medium","lieu secret","sapporo lieu secret sapporo"],[41.315665,141.421879,"Shikkari","東通村","東通村","ChIJ8_Zae_Y1nF8RX3UwLgDQB94","💎","medium","lieu secret","shikkari lieu secret 東通村"],[38.386112,139.457842,"Murakami","国道345号","Murakami","ChIJFzoHud13i18RYzzckT--Mk4","💎","medium","lieu secret","murakami lieu secret murakami"],[37.855284,140.155676,"Yonezawa","関根","Yonezawa","ChIJRW93fNftil8R942L7zfvrwc","💎","medium","lieu secret","yonezawa lieu secret yonezawa"],[38.407522,140.509148,"Higashine","国道48号","Higashine","ChIJWRjYKMHbi18RFNPKPv-xAKo","💎","medium","lieu secret","higashine lieu secret higashine"],[39.302558,141.826442,"Kamaishi","Kamaishi","Kamaishi","","💎","medium","lieu secret","kamaishi lieu secret kamaishi"],[42.756685,141.455391,"Tomakomai","第一縦断林道","Chitose","ChIJiSKzxdUZdV8RDVulphgOYG4","💎","medium","lieu secret","tomakomai lieu secret chitose"],[36.775972,137.115564,"Horioka","新湊大橋","Imizu","ChIJy86rxCqc918RQhTfGToVPQU","🌉","low","pont","horioka pont imizu"],[36.781564,137.099861,"Imizu","八幡町二丁目","Imizu","ChIJsy_VM1eb918R8JyUCQnqcpc","💎","medium","lieu secret","imizu lieu secret imizu"],[39.313782,141.157269,"Kitakami","北上花巻温泉自転車道線","Kitakami","ChIJ0TDOF4tCj18R31InIBLGN48","♨️","low","onsen","kitakami onsen kitakami"],[36.975598,140.967135,"Iwaki","字二見台","Iwaki","ChIJx4sg1UcEIWARU3QHKNgEeoA","💎","medium","lieu secret","iwaki lieu secret iwaki"],[36.994864,140.981755,"Iwaki","塩屋埼灯台","Iwaki","ChIJx4sg1UcEIWARU3QHKNgEeoA","💎","medium","lieu secret","iwaki lieu secret iwaki"],[36.995164,140.981519,"Iwaki","塩屋埼灯台","Iwaki","ChIJx4sg1UcEIWARU3QHKNgEeoA","💎","medium","lieu secret","iwaki lieu secret iwaki"],[37.778011,140.117483,"Yonezawa","米沢猪苗代線","Yonezawa","ChIJRW93fNftil8R942L7zfvrwc","💎","medium","lieu secret","yonezawa lieu secret yonezawa"],[43.475259,142.638878,"Shirogane","白髭の滝観爆橋","Biei","ChIJS5-nXK0yc18Rm7w9pdsuWHg","💧","high","cascade","shirogane cascade biei"],[43.475306,142.638813,"Shirogane","白髭の滝観爆橋","Biei","ChIJS5-nXK0yc18Rm7w9pdsuWHg","💧","high","cascade","shirogane cascade biei"],[38.766124,140.056197,"Furukuchi","国道47号","戸沢村","ChIJxwknRPSpjl8RyDNmjqnaS50","💎","medium","lieu secret","furukuchi lieu secret 戸沢村"],[40.578868,140.298673,"Tashiro","白神山地ビジターセンター","西目屋村","ChIJv9AqgPL4ml8RioAWeyurA9Q","🗻","high","montagne","tashiro montagne 西目屋村"],[37.742392,139.120108,"Niigata","秋葉区","Niigata","ChIJ98DHVcLF9F8RDSOQycubUPE","💎","medium","lieu secret","niigata lieu secret niigata"],[36.435006,136.63653,"Hakusan","白山比咩神社","Hakusan","ChIJyTG34F1d-F8RhjvmgNa0N1Y","⛩️","low","sanctuaire","hakusan sanctuaire hakusan"],[44.124214,145.083116,"Onnebetsumura","地上遊歩道（大ループ）","斜里町","ChIJUxB20nC5bF8RhltrRW3IoWY","💎","medium","lieu secret","onnebetsumura lieu secret 斜里町"],[44.200018,145.239759,"Onnebetsumura","遠音別村","斜里町","ChIJUxB20nC5bF8RhltrRW3IoWY","💎","medium","lieu secret","onnebetsumura lieu secret 斜里町"],[43.479395,142.626034,"Route Tokachidake-onsen Biei","Route Tokachidake-onsen Biei","Biei","","♨️","low","onsen","route tokachidake-onsen biei onsen biei"],[43.731513,141.337308,"Ishikari","国道231号開通記念碑","Ishikari","ChIJs-YD4z5sC18RXjykGw8NQDQ","💎","medium","lieu secret","ishikari lieu secret ishikari"],[37.425704,136.999561,"Wajima","白米町","Wajima","ChIJRVqGdSg58V8RslKCeDDWO9Q","💎","medium","lieu secret","wajima lieu secret wajima"],[36.576126,137.523976,"Ashikuraji","弘法称名立山停車場線","立山町","ChIJjwQzJIjo918R6NFuFMW2uyQ","🗻","high","montagne","ashikuraji montagne 立山町"],[42.562514,140.885174,"Takinomachi","洞爺公園洞爺線","Sobetsu","ChIJu9H9FZVYdV8Rf9tYnOda2bA","🌿","medium","parc","takinomachi parc sobetsu"],[36.404272,136.886545,"Nanto","菅沼","Nanto","ChIJ3R95_Ls9-F8RswTgOhjX-78","💎","medium","lieu secret","nanto lieu secret nanto"],[38.343961,139.665139,"Murakami","高根鈴川（高根鈴川）林道","Murakami","ChIJFzoHud13i18RYzzckT--Mk4","🌊","medium","rivière","murakami rivière murakami"],[38.997228,140.053247,"Sakata","御嶽神社","Sakata","ChIJo1dVzT2bjl8RxenugqXPXRQ","⛩️","low","sanctuaire","sakata sanctuaire sakata"],[43.866492,142.418145,"Asahikawa","鷹栖東鷹栖比布線","Asahikawa","ChIJwwqCmgznDF8RsgnBr9YtEn4","💎","medium","lieu secret","asahikawa lieu secret asahikawa"],[36.582692,137.393742,"Ashikuraji","立山町","立山町","ChIJjwQzJIjo918R6NFuFMW2uyQ","🗻","high","montagne","ashikuraji montagne 立山町"],[37.593521,140.230597,"Kogai","林道不動滝線","Inawashiro","ChIJU_UtpFGhil8Riw1o-srOR8s","🛕","low","temple Fudo","kogai temple fudo inawashiro"],[43.491908,143.144872,"Kamishihoro","国道273号","Kamishihoro","ChIJm-bYLYDfcl8RuymOnxRn5C4","💎","medium","lieu secret","kamishihoro lieu secret kamishihoro"],[39.179259,140.753357,"Iwaikawa","東成瀬村","東成瀬村","ChIJWyv2ghwjj18Rudwq8Wugnok","💎","medium","lieu secret","iwaikawa lieu secret 東成瀬村"],[38.996556,141.113419,"Hiraizumi","Hiraizumi","Hiraizumi","","💎","medium","lieu secret","hiraizumi lieu secret hiraizumi"],[36.756721,138.080583,"Nagano","Nagano","Nagano","","💎","medium","lieu secret","nagano lieu secret nagano"],[36.761187,138.069041,"Nagano","信濃信州新線","Nagano","ChIJmUQ05l2AHWARyJIoB3SpKPE","💎","medium","lieu secret","nagano lieu secret nagano"],[39.750983,141.996284,"Miyako","Miyako","Miyako","","💎","medium","lieu secret","miyako lieu secret miyako"],[36.989242,140.9708,"Iwaki","豊間四倉線","Iwaki","ChIJx4sg1UcEIWARU3QHKNgEeoA","💎","medium","lieu secret","iwaki lieu secret iwaki"],[38.324784,141.155956,"Higashimatsushima","月浜海水浴場","Higashimatsushima","ChIJpb4hqVeYiV8R2C6oh-MImY0","💎","medium","lieu secret","higashimatsushima lieu secret higashimatsushima"],[37.88096,139.307604,"Shibata","月岡温泉","Shibata","ChIJiWgsRQsvi18RJNoup2z6ls0","♨️","low","onsen","shibata onsen shibata"],[37.312047,137.230384,"Noto","スルメイカのモニュメント","Noto","ChIJoy-cieXN9l8R8cpGddQ40yM","💎","medium","lieu secret","noto lieu secret noto"],[36.816361,137.582762,"Kurobe","宇奈月温泉総湯;湯めどころ宇奈月","Kurobe","ChIJF2Y9DW-3918RQNPssLt-EFo","♨️","low","onsen","kurobe onsen kurobe"],[39.411691,141.005983,"Hanamaki","湯口","Hanamaki","ChIJgz0EI29gj18RQj6Zmh87hJA","💎","medium","lieu secret","hanamaki lieu secret hanamaki"],[37.003251,140.980065,"Iwaki","薄磯海岸","Iwaki","ChIJx4sg1UcEIWARU3QHKNgEeoA","🏖️","medium","plage","iwaki plage iwaki"],[43.882997,143.303548,"Engaru","山彦の滝","Engaru","ChIJFX3QvhRFDV8R8fTVhB4yOgg","💧","high","cascade","engaru cascade engaru"],[38.310778,140.474505,"Yamagata","萱小屋沢林道","Yamagata","ChIJUW6dSwfKi18R6zG_DU6SsqY","💎","medium","lieu secret","yamagata lieu secret yamagata"],[38.313296,140.434696,"Yamagata","仙台山寺線","Yamagata","ChIJUW6dSwfKi18R6zG_DU6SsqY","🛕","low","temple","yamagata temple yamagata"],[38.255595,140.327845,"Kajo Park","Kajo Park","Yamagata","","🌿","medium","parc","kajo park parc yamagata"],[42.571643,139.833844,"Setana","瀬棚区北島歌","せたな町","ChIJiVOKmFbVoV8Rj4bJjKmXVbw","💎","medium","lieu secret","setana lieu secret せたな町"],[37.946503,138.492627,"Sado","林道岩首線","Sado","ChIJ5QEt03Nd818RE1pKKKZgZb8","💎","medium","lieu secret","sado lieu secret sado"],[38.949393,140.575987,"Yuzawa","湯ノ又コース","Yuzawa","ChIJuzNgxcXbjl8R2hcebbjzgFA","💎","medium","lieu secret","yuzawa lieu secret yuzawa"],[38.722472,139.685792,"Tsuruoka","由良二丁目","Tsuruoka","ChIJKxWZzi51jF8R15BilRYA6sY","💎","medium","lieu secret","tsuruoka lieu secret tsuruoka"],[36.795487,139.428485,"Nikkō","湯滝展望台","Nikkō","ChIJ0ciaxrekH2ARwNEdlkJrUm8","💧","high","cascade","nikkō cascade nikkō"],[35.44311,137.749059,"Komaba","駒場","阿智村","ChIJ0QqA01aiHGARpsGw0hyC5E8","💎","medium","lieu secret","komaba lieu secret 阿智村"],[34.56367,136.085787,"Nabari","ようこそ赤目四十八滝","Nabari","ChIJfc2XbZKsBmARnZEMpdyt524","💧","high","cascade","nabari cascade nabari"],[34.559101,136.094848,"Nabari","赤目掛線","Nabari","ChIJfc2XbZKsBmARnZEMpdyt524","💎","medium","lieu secret","nabari lieu secret nabari"],[35.077527,139.071319,"Atami","梅花町","Atami","ChIJnZqF49--GWARjiBklbOAzsc","🌸","medium","parc floral","atami parc floral atami"],[35.684373,136.085082,"Tsuruga","ローソン","Tsuruga","ChIJqd9LVMP6AWARL5rV3Zc1eM8","💎","medium","lieu secret","tsuruga lieu secret tsuruga"],[35.726645,139.189767,"Akiruno","石舟橋","Akiruno","ChIJIynh0gQjGWARz7r0LTv77hM","🌉","low","pont","akiruno pont akiruno"],[35.238873,139.599897,"Yokosuka","秋谷三丁目","Yokosuka","ChIJV56GCpc_GGARP2fZpDHiIFI","💎","medium","lieu secret","yokosuka lieu secret yokosuka"],[35.018693,136.445228,"Komono","国道477号","Komono","ChIJz5sy93rsA2ARmhKNS8vHDBE","💎","medium","lieu secret","komono lieu secret komono"],[34.991294,139.856085,"Tateyama","内房なぎさライン","Tateyama","ChIJI9tzpVP3F2AR_RiT6iqi_7s","💎","medium","lieu secret","tateyama lieu secret tateyama"],[35.15903,139.611934,"Bacardi","Bacardi","Miura","","💎","medium","lieu secret","bacardi lieu secret miura"],[35.211283,139.060482,"Hakone","箱根新道","Hakone","ChIJe9yyYAyiGWARJnuXrBe9BSY","💎","medium","lieu secret","hakone lieu secret hakone"],[34.950387,137.645701,"Shinshiro","東海自然歩道","Shinshiro","ChIJXYO8lmA2G2ARA74f9CSP6p8","💎","medium","lieu secret","shinshiro lieu secret shinshiro"],[35.219326,140.182382,"Ōtaki","小田代勝浦線","Otaki","ChIJK1bKFUWyImARVTYMbQ7dAD4","💧","high","cascade","ōtaki cascade otaki"],[35.219128,140.182452,"Ōtaki","小田代勝浦線","Otaki","ChIJK1bKFUWyImARVTYMbQ7dAD4","💧","high","cascade","ōtaki cascade otaki"],[35.131175,138.892505,"Numazu","富士山の溶岩がつくった鮎壺の滝","Nagaizumi","ChIJd8qCk3ePGWARj7rWaLvxuAk","💧","high","cascade","numazu cascade nagaizumi"],[36.128138,137.657886,"Matsumoto","滝上展望台","Matsumoto","ChIJx2hD6AAUHWAR3c0QMjZtjcs","💧","high","cascade","matsumoto cascade matsumoto"],[36.353051,138.161797,"Ueda","別所温泉","Ueda","ChIJsaSJhsy8HWARTFv1slYL1uE","♨️","low","onsen","ueda onsen ueda"],[34.920676,139.841909,"Tateyama","大神宮","Tateyama","ChIJI9tzpVP3F2AR_RiT6iqi_7s","💎","medium","lieu secret","tateyama lieu secret tateyama"],[35.900872,138.78172,"Chichibu","Chichibu","Chichibu","","💎","medium","lieu secret","chichibu lieu secret chichibu"],[36.08458,139.041482,"Minano","沢辺","皆野町","ChIJmUquKjPGHmAR-ueWbtlRWRw","💎","medium","lieu secret","minano lieu secret 皆野町"],[34.965044,139.960691,"Minamibōsō","千倉港線","Minamibouso","ChIJszoYpln5F2ARX_syYuPgOI4","💎","medium","lieu secret","minamibōsō lieu secret minamibouso"],[35.50524,136.023376,"Takashima","林道北マキノ線","Takashima","ChIJMeEC9CKVAWARxTLDGWaZ_R4","💎","medium","lieu secret","takashima lieu secret takashima"],[36.14484,137.264215,"Daiouji Temple","Daiouji Temple","Takayama","","🛕","low","temple","daiouji temple temple takayama"],[36.056888,136.356887,"Temple Eihei","Temple Eihei","Eiheiji","","🛕","low","temple","temple eihei temple eiheiji"],[36.339441,137.908464,"Azumino","夢のかけ橋","Azumino","ChIJaQHawwZsHWARVuICyjW5jS0","🌉","low","pont","azumino pont azumino"],[35.914743,138.419363,"Hokuto","吐竜の滝","Hokuto","ChIJc0iv_EsTHGARNNznJqdlDTQ","💧","high","cascade","hokuto cascade hokuto"],[36.254644,136.1478,"Sakai","三国町梶","Sakai","ChIJY3SpH13s-F8RYeHrU0y2ZoQ","💎","medium","lieu secret","sakai lieu secret sakai"],[35.986682,136.483127,"Château d'Echizen-Ōno","Château d'Echizen-Ōno","Ōno","","🏯","medium","château","château d'echizen-ōno château ōno"],[35.911114,136.244756,"Echizen","新在家町","Echizen","ChIJtTphSYCr-F8RIeWlVlHnXeI","💎","medium","lieu secret","echizen lieu secret echizen"],[35.401484,139.901142,"Kisarazu","江川海岸","Kisarazu","ChIJ_ZgfYJQKGGAR-EFgz8cL2So","🏖️","medium","plage","kisarazu plage kisarazu"],[36.056723,136.356897,"Temple Eihei","Temple Eihei","Eiheiji","","🛕","low","temple","temple eihei temple eiheiji"],[35.507223,137.449018,"Nakatsugawa","Nakatsugawa","Nakatsugawa","","💎","medium","lieu secret","nakatsugawa lieu secret nakatsugawa"],[35.301073,139.481083,"Sanctuaire Kodama","Sanctuaire Kodama","Fujisawa","","⛩️","low","sanctuaire","sanctuaire kodama sanctuaire fujisawa"],[34.703091,139.443377,"Ōshima","筆島","Tokyo","ChIJj-n2RtqCF2ARNBhW3Idmxjw","💎","medium","lieu secret","ōshima lieu secret tokyo"],[35.451811,139.250197,"Atsugi","三の橋","Atsugi","ChIJgcBb0t8AGWARYI4jLKg_PH4","🌉","low","pont","atsugi pont atsugi"],[35.609975,139.573615,"Kawasaki","藤子・F・不二雄ミュージアム","Kawasaki","ChIJV1C9AXtfGGARy9PPyhfzyYg","💎","medium","lieu secret","kawasaki lieu secret kawasaki"],[36.251704,136.82064,"Hakusan","白山白川郷ホワイトロード","Hakusan","ChIJyTG34F1d-F8RhjvmgNa0N1Y","🗻","high","montagne","hakusan montagne hakusan"],[35.681465,139.800549,"Tokyo","れいがん寺幼稚園","Arrondissement de Kōtō","ChIJXSModoWLGGARILWiCfeu2M0","🛕","low","temple","tokyo temple arrondissement de kōtō"],[35.672959,139.798537,"Fukagawa Fudō-son","Fukagawa Fudō-son","Arrondissement de Kōtō","","💎","medium","lieu secret","fukagawa fudō-son lieu secret arrondissement de kōtō"],[36.082436,136.506629,"Katsuyama","福井県立恐竜博物館","Katsuyama","ChIJCUaYVu-a-F8RPPnJ8cHI4ZE","🏛️","low","musée","katsuyama musée katsuyama"],[35.306868,139.811637,"Futtsu","大明神東","Futtsu","ChIJBZv_qDQOGGAROSmx5b1u8Rg","💎","medium","lieu secret","futtsu lieu secret futtsu"],[35.135391,136.083451,"Ōmihachiman","願成就寺本堂","Ōmihachiman","ChIJ1SEEYJd5AWARt9OEbSVCHnY","🛕","low","temple","ōmihachiman temple ōmihachiman"],[35.421015,137.099371,"Kani","室内路","Kani","ChIJZ-NTQBAUA2ARDebJHERy9cI","💎","medium","lieu secret","kani lieu secret kani"],[35.505089,137.155851,"Yaotsu","Yaotsu","Yaotsu","","💎","medium","lieu secret","yaotsu lieu secret yaotsu"],[35.900434,139.281226,"Hidaka","林道中野線","Hidaka","ChIJjyNMEkIoGWARRmgthOct6MY","💎","medium","lieu secret","hidaka lieu secret hidaka"],[35.183808,138.90478,"Susono","佐野","Susono","ChIJF0BHNrKCGWARGaMFvDjYRDM","💎","medium","lieu secret","susono lieu secret susono"],[35.753179,136.961388,"Château de Gujō Hachiman","Château de Gujō Hachiman","Gujō","","🏯","medium","château","château de gujō hachiman château gujō"],[34.377095,139.275939,"Niijima","新島村","Tokyo","ChIJryNpkggPF2ARYDJzd19i0ow","💎","medium","lieu secret","niijima lieu secret tokyo"],[36.10715,137.1153,"Takayama","Takayama","Takayama","","💎","medium","lieu secret","takayama lieu secret takayama"],[35.53559,138.782597,"Kawaguchi","母の白滝","Fujikawaguchiko","ChIJ-1nr14peGWARkT1C0cP9434","💧","high","cascade","kawaguchi cascade fujikawaguchiko"],[35.535575,138.782627,"Kawaguchi","母の白滝","Fujikawaguchiko","ChIJ-1nr14peGWARkT1C0cP9434","💧","high","cascade","kawaguchi cascade fujikawaguchiko"],[35.266301,139.017739,"Route de Hakone","Route de Hakone","Hakone","","💎","medium","lieu secret","route de hakone lieu secret hakone"],[36.254933,136.814123,"Hakusan","白山白川郷ホワイトロード","Hakusan","ChIJyTG34F1d-F8RhjvmgNa0N1Y","🗻","high","montagne","hakusan montagne hakusan"],[35.667229,136.822636,"Seki","Seki","Seki","","💎","medium","lieu secret","seki lieu secret seki"],[35.044413,139.832266,"Minamibōsō","富浦町原岡","Minamibouso","ChIJszoYpln5F2ARX_syYuPgOI4","💎","medium","lieu secret","minamibōsō lieu secret minamibouso"],[35.753267,140.832055,"Kamisu","波崎新港","Kamisu","ChIJ99wg2SsDI2ARTxpcMtQQDJI","💎","medium","lieu secret","kamisu lieu secret kamisu"],[34.972772,139.78839,"Tateyama","南安房公園線","Tateyama","ChIJI9tzpVP3F2AR_RiT6iqi_7s","🌿","medium","parc","tateyama parc tateyama"],[34.535947,135.906858,"Hase-dera","Hase-dera","Sakurai","","💎","medium","lieu secret","hase-dera lieu secret sakurai"],[35.488432,139.160523,"Sagamihara","大滝新道","Sagamihara","ChIJ0Rg03D8bGWARA77Ah2GxZf4","💧","high","cascade","sagamihara cascade sagamihara"],[36.13262,137.23509,"Takayama","国道158号","Takayama","ChIJScNPoUKjAmAR3OO48IT78tQ","💎","medium","lieu secret","takayama lieu secret takayama"],[35.22953,139.094937,"Yumoto","神奈川県道732号湯本元箱根線","Hakone","ChIJyQXNYKmjGWARIJIcvv__heQ","🌊","medium","rivière","yumoto rivière hakone"],[35.308039,139.486276,"Katasekaigan 1-chome","Katasekaigan 1-chome","Fujisawa","","💎","medium","lieu secret","katasekaigan 1-chome lieu secret fujisawa"],[35.276636,136.251825,"Hikone","西の丸水手御門虎口石垣の調査と修復","Hikone","ChIJgWxWu6QqAmARHB2ft1RAWcw","💎","medium","lieu secret","hikone lieu secret hikone"],[36.177507,137.559739,"Takayama","平湯大滝","Takayama","ChIJScNPoUKjAmAR3OO48IT78tQ","💧","high","cascade","takayama cascade takayama"],[34.607325,138.825779,"Minamiizu","ヒリゾ浜","南伊豆町","ChIJ78LrC5X9GWARCUr3jSi56wo","💎","medium","lieu secret","minamiizu lieu secret 南伊豆町"],[35.309394,139.542307,"Kamakura","滑川駐輪場","Kamakura","ChIJGVasgJtFGGARAiWfOXp0AFc","🌊","medium","rivière","kamakura rivière kamakura"],[34.81773,138.187811,"Shimada","牧之原","Shimada","ChIJk-ZEPRNUGmARrW0AEBv_TL8","💎","medium","lieu secret","shimada lieu secret shimada"],[34.983265,137.583142,"Shinshiro","東海自然歩道","Shinshiro","ChIJXYO8lmA2G2ARA74f9CSP6p8","💎","medium","lieu secret","shinshiro lieu secret shinshiro"],[35.727667,139.139147,"Hinohara","檜原村","Tokyo","ChIJlzPTNz05GWARQrhYm0fIo-E","💎","medium","lieu secret","hinohara lieu secret tokyo"],[35.727608,139.138861,"Hinohara","檜原村","Tokyo","ChIJlzPTNz05GWARQrhYm0fIo-E","💎","medium","lieu secret","hinohara lieu secret tokyo"],[35.141841,139.834611,"Hota","元名","Kyonan","ChIJEbRou0obGGARDqXVWUzK-IQ","💎","medium","lieu secret","hota lieu secret kyonan"],[35.854533,139.094458,"Hikawa","林道川乗線","Tokyo","ChIJGa3yFfY2GWARX6iKOCyb4GA","🌊","medium","rivière","hikawa rivière tokyo"],[36.005174,139.916312,"Bandō","茨城自然博物館","Bandō","ChIJlWHQSPykGGARtMBOBaAYWwY","🏯","medium","château","bandō château bandō"],[35.97873,136.307907,"Fukui","Fukui","Fukui","","💎","medium","lieu secret","fukui lieu secret fukui"],[35.999585,136.296029,"Fukui","厩舎","Fukui","ChIJTyt0O6---F8RvbsNWHYUG6Q","💎","medium","lieu secret","fukui lieu secret fukui"],[35.378392,140.391367,"Ichi-no-miya","一宮町","一宮町","ChIJuRRwd8nJImARXoNCQhc0gSQ","💎","medium","lieu secret","ichi-no-miya lieu secret 一宮町"],[34.752109,139.005058,"Midaka","国道135号","Kawazu","ChIJiX3xZOfgGWAR_XdPR0O4-SY","💎","medium","lieu secret","midaka lieu secret kawazu"],[35.686817,139.757198,"Tokyo","白鳥濠","Arrondissement de Chiyoda","ChIJXSModoWLGGARILWiCfeu2M0","💎","medium","lieu secret","tokyo lieu secret arrondissement de chiyoda"],[35.709253,140.866423,"Chōshi","海岸侵食対策事業（人工リーフ）","Chōshi","ChIJDRQH7-AYI2ARZIlTMnMsQNA","🏖️","medium","plage","chōshi plage chōshi"],[35.708017,140.868482,"Chōshi","犬吠埼灯台資料展示館","Chōshi","ChIJDRQH7-AYI2ARZIlTMnMsQNA","💎","medium","lieu secret","chōshi lieu secret chōshi"],[34.658341,138.926423,"Shimoda","入田","Shimoda","ChIJK3yhDPXiGWAR4AUIDxTjEkk","💎","medium","lieu secret","shimoda lieu secret shimoda"],[34.455042,136.725571,"Ise","御稻御倉","Ise","ChIJxW5CEJlQBGARGRH-87cfV_o","💎","medium","lieu secret","ise lieu secret ise"],[34.975661,139.09609,"Itō","国道135号","Itō","ChIJsdtX9q_DGWARIcCeW1Y_Ax0","💎","medium","lieu secret","itō lieu secret itō"],[34.737846,138.759536,"Matsuzaki","岩地","松崎町","ChIJ3S_lOzX6GWARC3bbp8LxwMA","💎","medium","lieu secret","matsuzaki lieu secret 松崎町"],[35.094207,139.84052,"Minamibōsō","久枝","Minamibouso","ChIJszoYpln5F2ARX_syYuPgOI4","💎","medium","lieu secret","minamibōsō lieu secret minamibouso"],[35.240208,137.144896,"Seto","針原町","Seto","ChIJGcTBgRJoA2ARI7WnoLoAxaM","💎","medium","lieu secret","seto lieu secret seto"],[35.240296,137.144724,"Seto","針原町","Seto","ChIJGcTBgRJoA2ARI7WnoLoAxaM","💎","medium","lieu secret","seto lieu secret seto"],[34.907302,139.100927,"Itō","伊豆シャボテン動物公園","Itō","ChIJsdtX9q_DGWARIcCeW1Y_Ax0","🌿","medium","parc","itō parc itō"],[34.872197,138.922239,"Izu","国道414号","Izu","ChIJAVFyTrftGWARFRpd_LJ46Jc","💎","medium","lieu secret","izu lieu secret izu"],[34.761542,138.015214,"Kakegawa","ペンギンプール","掛川市","ChIJ-0YDFZ_5GmAR2jNPbwFcgR4","💎","medium","lieu secret","kakegawa lieu secret 掛川市"],[35.106897,138.901732,"Fushimi","貴船神社","清水町","ChIJixF-PwqQGWARF6ujSGoEcQQ","⛩️","low","sanctuaire","fushimi sanctuaire 清水町"],[35.106906,138.901679,"Fushimi","貴船神社","清水町","ChIJixF-PwqQGWARF6ujSGoEcQQ","⛩️","low","sanctuaire","fushimi sanctuaire 清水町"],[35.107798,138.901529,"Fushimi","国道1号","清水町","ChIJixF-PwqQGWARF6ujSGoEcQQ","💎","medium","lieu secret","fushimi lieu secret 清水町"],[36.242639,136.372103,"Kaga","鶴仙渓遊歩道","Kaga","ChIJIQewZqz2-F8RJRvDTmLd2Rk","💎","medium","lieu secret","kaga lieu secret kaga"],[35.639888,136.927165,"Gujō","Gujō","Gujō","","💎","medium","lieu secret","gujō lieu secret gujō"],[35.322416,139.552657,"Kamakura","鎌倉まめや","Kamakura","ChIJGVasgJtFGGARAiWfOXp0AFc","💎","medium","lieu secret","kamakura lieu secret kamakura"],[34.91759,136.972102,"Handa","国道247号","Handa","ChIJQSNwFDiEBGARHW9ca-WfTFQ","💎","medium","lieu secret","handa lieu secret handa"],[34.818757,136.863159,"Tokoname","Tokoname","Tokoname","","💎","medium","lieu secret","tokoname lieu secret tokoname"],[35.356844,139.161407,"Hadano","神縄神山線","秦野市","ChIJlesnx-4HGWARYEy4q85gfUc","🗻","high","montagne","hadano montagne 秦野市"],[34.837564,137.44391,"Toyohashi","賀茂町","Toyohashi","ChIJvzrKelzSBGARxtl_0Fe1ecw","💎","medium","lieu secret","toyohashi lieu secret toyohashi"],[35.116027,140.120398,"Kamogawa","鴨川シーワールド","Kamogawa","ChIJO-HKPOlUPWARCQHDVekzrHM","🌊","medium","rivière","kamogawa rivière kamogawa"],[35.457258,138.806982,"Oshino","Oshino","Oshino","","💎","medium","lieu secret","oshino lieu secret oshino"],[35.258527,139.741011,"Route nationale 209","Route nationale 209","Yokosuka","","💎","medium","lieu secret","route nationale 209 lieu secret yokosuka"],[34.724227,138.224523,"Makinohara","道場","Makinohara","ChIJV8pUJK1dGmARBXpS3G-8u0I","💎","medium","lieu secret","makinohara lieu secret makinohara"],[35.247984,136.97204,"Kasugai","春日井市役所","Kasugai","ChIJmZKtNrdtA2ARd5tJMO4BA5M","💎","medium","lieu secret","kasugai lieu secret kasugai"],[35.528108,140.452452,"Katakai","九十九里ビーチライン","九十九里町","ChIJXc0qUtrDImARPmCIuLtovZU","💎","medium","lieu secret","katakai lieu secret 九十九里町"],[35.15513,139.609017,"Miura","諸磯神明社","Miura","ChIJa_DObU48GGARGhQ690MGki0","💎","medium","lieu secret","miura lieu secret miura"],[35.307269,139.485847,"Fujisawa","片瀬東浜","Fujisawa","ChIJ9cQA541RGGARqJsCmpW-ezQ","💎","medium","lieu secret","fujisawa lieu secret fujisawa"],[35.924663,139.485372,"Kawagoe","市庁舎南側駐車場","Kawagoe","ChIJt2YQ9knaGGARnq-5YFvX1d8","💎","medium","lieu secret","kawagoe lieu secret kawagoe"],[35.924462,139.483141,"Kawagoe","小松屋","Kawagoe","ChIJt2YQ9knaGGARnq-5YFvX1d8","💎","medium","lieu secret","kawagoe lieu secret kawagoe"],[35.924401,139.483012,"Kawagoe","一番街","Kawagoe","ChIJt2YQ9knaGGARnq-5YFvX1d8","💎","medium","lieu secret","kawagoe lieu secret kawagoe"],[35.522524,138.768747,"Kawaguchi","河口湖オルゴールの森美術館","Fujikawaguchiko","ChIJ-1nr14peGWARkT1C0cP9434","🌊","medium","lac","kawaguchi lac fujikawaguchiko"],[35.534692,139.730664,"Kawasaki","珈琲茶房 餅陣住吉","Kawasaki","ChIJV1C9AXtfGGARy9PPyhfzyYg","💎","medium","lieu secret","kawasaki lieu secret kawasaki"],[35.608575,139.561343,"Kawasaki","WONDER SCOPE 森の観察ステーション","Kawasaki","ChIJV1C9AXtfGGARy9PPyhfzyYg","🌲","high","forêt","kawasaki forêt kawasaki"],[34.750481,139.003724,"Midaka","国道135号","Kawazu","ChIJiX3xZOfgGWAR_XdPR0O4-SY","💎","medium","lieu secret","midaka lieu secret kawazu"],[34.795857,138.933685,"Nashimoto","カニ滝橋","Kawazu","ChIJpcK_KKXlGWARNvgWUQUcKUc","💧","high","cascade","nashimoto cascade kawazu"],[35.233696,139.080666,"Hakone","国道1号","Hakone","ChIJe9yyYAyiGWARJnuXrBe9BSY","💎","medium","lieu secret","hakone lieu secret hakone"],[34.38241,136.03505,"Mugitani","大又","東吉野村","ChIJ4fpKid68BmAR5UqIN-H6i4U","💎","medium","lieu secret","mugitani lieu secret 東吉野村"],[34.782656,137.097243,"Nishio","吉良町宮崎","Nishio","ChIJVeX4LTWRBGARBS1GXJ1lXNM","💎","medium","lieu secret","nishio lieu secret nishio"],[34.653618,138.919367,"Shimoda","吉佐美","Shimoda","ChIJK3yhDPXiGWAR4AUIDxTjEkk","💎","medium","lieu secret","shimoda lieu secret shimoda"],[35.694413,137.677749,"Suhara","国道19号","大桑村","ChIJMc8KON7DHGARRBdYT6sp3ZQ","💎","medium","lieu secret","suhara lieu secret 大桑村"],[35.729729,138.325795,"Hokuto","Hokuto","Hokuto","","💎","medium","lieu secret","hokuto lieu secret hokuto"],[35.950505,138.402625,"Hokuto","真教寺尾根コース","Hokuto","ChIJc0iv_EsTHGARNNznJqdlDTQ","🛕","low","temple","hokuto temple hokuto"],[35.839126,137.544954,"Ōtaki","御嶽古道遊歩","王滝村","ChIJUf5ZDW_VHGAR7FVwY-FGkiY","💧","high","cascade","ōtaki cascade 王滝村"],[34.843535,138.765902,"Ugusu","国道136号","西伊豆町","ChIJexMea1HxGWARs-VRreYbbVM","💎","medium","lieu secret","ugusu lieu secret 西伊豆町"],[34.580562,137.0259,"Tahara","田原豊橋自転車道線","Tahara","ChIJi_laC-PcBGARVI3Uy9bW0qU","🌉","low","pont","tahara pont tahara"],[35.705752,139.749218,"Pont Engetsu","Pont Engetsu","Arrondissement de Bunkyō","","💎","medium","lieu secret","pont engetsu lieu secret arrondissement de bunkyō"],[35.714856,139.214129,"152-090","152-090","Akiruno","","💎","medium","lieu secret","152-090 lieu secret akiruno"],[35.213539,140.190047,"Ōtaki","小田代勝浦線","Otaki","ChIJK1bKFUWyImARVTYMbQ7dAD4","💧","high","cascade","ōtaki cascade otaki"],[35.880257,139.82091,"Koshigaya","レイクタウン","Koshigaya","ChIJc9e06BeWGGARwvvDrb4u2s4","💎","medium","lieu secret","koshigaya lieu secret koshigaya"],[35.308565,139.489736,"Kamakura","国道134号","Kamakura","ChIJGVasgJtFGGARAiWfOXp0AFc","💎","medium","lieu secret","kamakura lieu secret kamakura"],[35.674048,139.813123,"Tokyo","東陽六丁目","Arrondissement de Kōtō","ChIJXSModoWLGGARILWiCfeu2M0","💎","medium","lieu secret","tokyo lieu secret arrondissement de kōtō"],[34.97797,136.033639,"Rittō","栗東信楽線","栗東市","ChIJecfralBuAWARpi62dGItnRs","💎","medium","lieu secret","rittō lieu secret 栗東市"],[35.388542,140.391587,"Hitotsumatsu","新地","長生村","ChIJazZqNXPIImARwFXpdOUDWz0","💎","medium","lieu secret","hitotsumatsu lieu secret 長生村"],[34.666706,138.980948,"Shimoda","須崎柿崎線","Shimoda","ChIJK3yhDPXiGWAR4AUIDxTjEkk","💎","medium","lieu secret","shimoda lieu secret shimoda"],[34.726384,138.743327,"Kumomi","国道136号","松崎町","ChIJX6Zp8_v4GWAR9jzyjsp1NEk","💎","medium","lieu secret","kumomi lieu secret 松崎町"],[35.942231,139.243611,"Ogose","林道猿岩線","Ogose","ChIJCSdSsWEsGWARvkRhxxPOXmQ","💎","medium","lieu secret","ogose lieu secret ogose"],[35.527133,137.567116,"Nakatsugawa","馬籠","Nakatsugawa","ChIJbdewQQ7LHGARgoI9xmIsPlU","💎","medium","lieu secret","nakatsugawa lieu secret nakatsugawa"],[35.141163,139.160612,"Manatsuru","真鶴半島公園線","真鶴町","ChIJWfGtJsO7GWARnmmXstJwmZ0","🌿","medium","parc","manatsuru parc 真鶴町"],[35.991163,138.881986,"Ogano","薄小森線","小鹿野町","ChIJ89zAWEe6HmAR6SNxN2cTV-U","🌲","high","forêt","ogano forêt 小鹿野町"],[35.991317,138.881943,"Ogano","薄小森線","小鹿野町","ChIJ89zAWEe6HmAR6SNxN2cTV-U","🌲","high","forêt","ogano forêt 小鹿野町"],[35.782102,139.644547,"Grand Bouddha de Tokyo","Grand Bouddha de Tokyo","Itabashi","","💎","medium","lieu secret","grand bouddha de tokyo lieu secret itabashi"],[34.7553,138.776201,"Matsuzaki","松崎児童遊園","松崎町","ChIJl7CMlr_5GWARWgmg8PXwgl4","💎","medium","lieu secret","matsuzaki lieu secret 松崎町"],[35.340555,136.988333,"Inuyama","市道富士本線","Inuyama","ChIJ0yLs0nQSA2ARwPw6Aaf4ScM","💎","medium","lieu secret","inuyama lieu secret inuyama"],[34.509343,136.788425,"Sanctuaire Futami Okitama","Sanctuaire Futami Okitama","Ise","","⛩️","low","sanctuaire","sanctuaire futami okitama sanctuaire ise"],[34.913456,139.825088,"Tateyama","キャンプマナビス 海サイト","Tateyama","ChIJI9tzpVP3F2AR_RiT6iqi_7s","💎","medium","lieu secret","tateyama lieu secret tateyama"],[34.973389,138.764164,"Numazu","御浜","Numazu","ChIJd8qCk3ePGWARj7rWaLvxuAk","💎","medium","lieu secret","numazu lieu secret numazu"],[35.016689,138.518515,"Arrondissement de Shimizu","Arrondissement de Shimizu","Shizuoka","","💎","medium","lieu secret","arrondissement de shimizu lieu secret shizuoka"],[36.223528,136.134853,"Sakai","三国東尋坊芦原線","Sakai","ChIJY3SpH13s-F8RYeHrU0y2ZoQ","💎","medium","lieu secret","sakai lieu secret sakai"],[35.431933,139.599738,"Yokohama","平戸桜木通り","Yokohama","ChIJCWW2u-xbGGARAFQoYPaDlgY","🌸","medium","cerisiers","yokohama cerisiers yokohama"],[35.531246,139.700133,"Kawasaki","バーガーキング","Kawasaki","ChIJV1C9AXtfGGARy9PPyhfzyYg","💎","medium","lieu secret","kawasaki lieu secret kawasaki"],[35.141558,139.614144,"Miura","横須賀三崎線","Miura","ChIJa_DObU48GGARGhQ690MGki0","💎","medium","lieu secret","miura lieu secret miura"],[35.122434,138.919013,"Mishima","三嶋大社本殿・幣殿・拝殿・舞殿・神門","Mishima","ChIJ3WhI6ayQGWARYxktfivhddo","⛩️","low","grand sanctuaire","mishima grand sanctuaire mishima"],[34.913896,136.013605,"Kōka","栗東信楽線","Koka","ChIJIbMvjxBfAWAR3kY7Qj7N2pY","💎","medium","lieu secret","kōka lieu secret koka"],[35.800549,139.183275,"Oume","御岳橋","Ōme","ChIJZ7wPLgMlGWAR0gACqxxqK8U","🗻","high","montagne","oume montagne ōme"],[35.78236,139.129667,"Okutama","林道海沢線","Tokyo","ChIJY-0NkT82GWARN1nKGXCH-sI","💎","medium","lieu secret","okutama lieu secret tokyo"],[35.1849,139.655964,"Miura","国道134号","Miura","ChIJa_DObU48GGARGhQ690MGki0","💎","medium","lieu secret","miura lieu secret miura"],[35.184237,139.65562,"Miura","国道134号","Miura","ChIJa_DObU48GGARGhQ690MGki0","💎","medium","lieu secret","miura lieu secret miura"],[35.189468,136.080276,"Ōmihachiman","休暇村近江八幡","Ōmihachiman","ChIJ1SEEYJd5AWARt9OEbSVCHnY","💎","medium","lieu secret","ōmihachiman lieu secret ōmihachiman"],[36.144791,137.25799,"Takayama","下三之町","Takayama","ChIJScNPoUKjAmAR3OO48IT78tQ","💎","medium","lieu secret","takayama lieu secret takayama"],[35.253642,139.049658,"Miyagino","木賀","Hakone","ChIJPQfEE-ahGWAR5DNtudyeFj8","💎","medium","lieu secret","miyagino lieu secret hakone"],[35.309307,136.000191,"Takashima","宮野","Takashima","ChIJMeEC9CKVAWARxTLDGWaZ_R4","💎","medium","lieu secret","takashima lieu secret takashima"],[35.245055,139.159186,"Odawara","西湘バイパス","Odawara","ChIJz9Gok1ikGWARVY5_s-sk9KI","💎","medium","lieu secret","odawara lieu secret odawara"],[35.738616,136.040836,"Tsuruga","竹波立石繩間線","Tsuruga","ChIJqd9LVMP6AWARL5rV3Zc1eM8","💎","medium","lieu secret","tsuruga lieu secret tsuruga"],[34.918746,138.363733,"Shizuoka","用宗四丁目","Shizuoka","ChIJb4VYeiC_G2ARAYGHqCZ2x60","💎","medium","lieu secret","shizuoka lieu secret shizuoka"],[35.658097,139.74612,"Parc de Shiba 4","Parc de Shiba 4","Arrondissement de Minato","","🌿","medium","parc","parc de shiba 4 parc arrondissement de minato"],[35.445902,140.002918,"Sodegaura","長浦駅前三丁目","Sodegaura","ChIJ2f8heakKGGAR88Cd3y0cuwY","💎","medium","lieu secret","sodegaura lieu secret sodegaura"],[35.550124,140.470752,"Route de la Plage de Kujukuri","Route de la Plage de Kujukuri","Sanmu","","🏖️","medium","plage","route de la plage de kujukuri plage sanmu"],[35.783213,139.14993,"Oume","武蔵御嶽神社","Ōme","ChIJZ7wPLgMlGWAR0gACqxxqK8U","⛩️","low","sanctuaire","oume sanctuaire ōme"],[35.62604,139.243567,"Hachiōji","木の肌にさわってみよう","Hachiōji","ChIJN_Qpt7keGWARYhxOnVQO2Cc","💎","medium","lieu secret","hachiōji lieu secret hachiōji"],[35.700958,139.774926,"Tokyo","株式会社ムラタヤ","Arrondissement de Chiyoda","ChIJXSModoWLGGARILWiCfeu2M0","💎","medium","lieu secret","tokyo lieu secret arrondissement de chiyoda"],[34.24764,136.184541,"Ōdai","大台ヶ原線","大台町","ChIJMdOxx4IlBGARUYJ2Vv99rsA","💎","medium","lieu secret","ōdai lieu secret 大台町"],[34.26886,136.100277,"Konotani","川上村","川上村","ChIJWUzCOUmWBmARSdDLHzbv7CE","🌊","medium","rivière","konotani rivière 川上村"],[35.082236,136.703427,"Village de Nabana","Village de Nabana","Kuwana","","💎","medium","lieu secret","village de nabana lieu secret kuwana"],[34.666816,138.93604,"Shimoda","五丁目","Shimoda","ChIJK3yhDPXiGWAR4AUIDxTjEkk","💎","medium","lieu secret","shimoda lieu secret shimoda"],[35.056305,139.069699,"Atami","国道135号","Atami","ChIJnZqF49--GWARjiBklbOAzsc","💎","medium","lieu secret","atami lieu secret atami"],[35.380752,136.26721,"Nagahama","市道宮豊国神社線(長浜大手門通り)","Nagahama","ChIJDc4Q0AonAmAR40iSpF6jRlU","⛩️","low","sanctuaire","nagahama sanctuaire nagahama"],[36.114496,139.109861,"Honnogami","長瀞町役場","長瀞町","ChIJawj3qmDGHmARtbzRSwB1MG4","💎","medium","lieu secret","honnogami lieu secret 長瀞町"],[36.09499,139.115675,"Nagatoro","岩畳","長瀞町","ChIJi_fKimrGHmARg7iNc8yajVA","💎","medium","lieu secret","nagatoro lieu secret 長瀞町"],[34.983945,138.997387,"Izu","中伊豆ワイナリーヒルズ","Izu","ChIJAVFyTrftGWARFRpd_LJ46Jc","💎","medium","lieu secret","izu lieu secret izu"],[35.709448,139.665642,"Tokyo","デイリーチコ","Arrondissement de Nakano","ChIJXSModoWLGGARILWiCfeu2M0","💎","medium","lieu secret","tokyo lieu secret arrondissement de nakano"],[35.722796,137.715257,"Ogihara","国道19号","上松町","ChIJwfod-WDCHGARrtgK6QrHGkA","💎","medium","lieu secret","ogihara lieu secret 上松町"],[34.661273,137.741369,"Chuo Ward","中田島砂丘","Hamamatsu","ChIJXfkwvzLfGmARVs3AOMt8pCo","💎","medium","lieu secret","chuo ward lieu secret hamamatsu"],[35.431477,140.399892,"Nakazato","白子町","白子町","ChIJpzggJLTHImARMCf8DhJwGkA","💎","medium","lieu secret","nakazato lieu secret 白子町"],[34.209612,136.152928,"Ōdai","大台町","大台町","ChIJMdOxx4IlBGARUYJ2Vv99rsA","💎","medium","lieu secret","ōdai lieu secret 大台町"],[35.909382,137.832182,"Shiojiri","坊主（羽淵）林道","Shiojiri","ChIJ5wtQdrXiHGARNN7zHA-e9e8","💎","medium","lieu secret","shiojiri lieu secret shiojiri"],[36.057514,137.875396,"Shiojiri","Shiojiri","Shiojiri","","💎","medium","lieu secret","shiojiri lieu secret shiojiri"],[35.781065,139.129234,"Okutama","林道海沢線","Tokyo","ChIJY-0NkT82GWARN1nKGXCH-sI","💎","medium","lieu secret","okutama lieu secret tokyo"],[34.905899,139.837833,"Minamibōsō","国道410号","Minamibouso","ChIJszoYpln5F2ARX_syYuPgOI4","💎","medium","lieu secret","minamibōsō lieu secret minamibouso"],[35.609957,139.561569,"Kawasaki","七草峠","Kawasaki","ChIJV1C9AXtfGGARy9PPyhfzyYg","🗻","high","col","kawasaki col kawasaki"],[34.375671,139.267648,"Niijima","本村三丁目","Tokyo","ChIJryNpkggPF2ARYDJzd19i0ow","💎","medium","lieu secret","niijima lieu secret tokyo"],[35.085582,139.08159,"Atami","和田浜南町","Atami","ChIJnZqF49--GWARjiBklbOAzsc","💎","medium","lieu secret","atami lieu secret atami"],[34.866794,137.04811,"Nishio","錦城町","Nishio","ChIJVeX4LTWRBGARBS1GXJ1lXNM","🏯","medium","château","nishio château nishio"],[35.55442,138.306223,"Hayakawa","慶雲館","早川町","ChIJZY0eXueNG2ARoLqtfKwW7eU","💎","medium","lieu secret","hayakawa lieu secret 早川町"],[35.869618,138.740176,"Yamanashi","西沢渓谷歩道","Yamanashi","ChIJ9W3lpT4AHGARwyTGrpcPwhc","🌿","high","gorges","yamanashi gorges yamanashi"],[35.959622,136.817502,"Gujō","石徹白前谷線","Gujō","ChIJm3ApmlbyAmARoWhv8xqHuII","💎","medium","lieu secret","gujō lieu secret gujō"],[35.779278,138.210032,"Hokuto","Hokuto","Hokuto","","💎","medium","lieu secret","hokuto lieu secret hokuto"],[35.160648,139.840638,"Futtsu","Adventureコース","Futtsu","ChIJBZv_qDQOGGAROSmx5b1u8Rg","💎","medium","lieu secret","futtsu lieu secret futtsu"],[35.185529,140.060127,"Kimitsu","亀岩の洞窟","Kimitsu","ChIJnUzbigoIGGARe03FvGVE1K4","💎","medium","lieu secret","kimitsu lieu secret kimitsu"],[35.084228,138.858347,"Numazu","千本港町","Numazu","ChIJd8qCk3ePGWARj7rWaLvxuAk","💎","medium","lieu secret","numazu lieu secret numazu"],[34.682607,136.296042,"Tsu","Tsu","Tsu","","💎","medium","lieu secret","tsu lieu secret tsu"],[35.630223,139.775734,"Route Daiba-Aomi","Route Daiba-Aomi","Arrondissement de Minato","","💎","medium","lieu secret","route daiba-aomi lieu secret arrondissement de minato"],[35.195191,138.770645,"Fuji","林道中里線","Fuji","ChIJDU26A4zVG2ARiTLOHSYy4Cw","💎","medium","lieu secret","fuji lieu secret fuji"],[35.259677,139.127578,"Odawara","マンリーの小径","Odawara","ChIJz9Gok1ikGWARVY5_s-sk9KI","💎","medium","lieu secret","odawara lieu secret odawara"],[36.263154,136.928252,"Ogi","国道360号","白川村","ChIJddsKEIZx-F8R2SWCJfgjcu4","💎","medium","lieu secret","ogi lieu secret 白川村"],[35.26141,140.400065,"Isumi","深堀","Isumi","ChIJn6TwL2m1ImARTPgtur6-LAo","💎","medium","lieu secret","isumi lieu secret isumi"],[35.308841,139.318767,"Oiso","西湘バイパス","Ōiso","ChIJaew7a6-tGWARS4kONgzcsoQ","💎","medium","lieu secret","oiso lieu secret ōiso"],[34.462562,136.722961,"Ise","おかげ横丁 若松屋","Ise","ChIJxW5CEJlQBGARGRH-87cfV_o","💎","medium","lieu secret","ise lieu secret ise"],[34.990078,139.826677,"Tateyama","館山港線","Tateyama","ChIJI9tzpVP3F2AR_RiT6iqi_7s","🗻","high","montagne","tateyama montagne tateyama"],[35.134901,140.249166,"Katsuura","興津海水浴場","Katsura","ChIJIdLwloBLPWARB6pFDt9mI58","💎","medium","lieu secret","katsuura lieu secret katsura"],[35.566627,139.025313,"Uenohara","無生野","Uenohara","ChIJl7g70Y8_GWAR47VJGAwxy7A","💎","medium","lieu secret","uenohara lieu secret uenohara"],[34.53397,136.737752,"Ise","大湊町","Ise","ChIJxW5CEJlQBGARGRH-87cfV_o","💎","medium","lieu secret","ise lieu secret ise"],[35.182188,140.35379,"Suka","国道128号","Onjuku","ChIJN98-_Pg1PWARPLB83pO4VqM","💎","medium","lieu secret","suka lieu secret onjuku"],[34.726272,139.352618,"Ōshima","大島循環線","Tokyo","ChIJj-n2RtqCF2ARNBhW3Idmxjw","💎","medium","lieu secret","ōshima lieu secret tokyo"],[35.228553,135.963497,"Ōtsu","幹１１１２号線","Ōtsu","ChIJLQyx4ex0AWARRoaQadW7zIs","💎","medium","lieu secret","ōtsu lieu secret ōtsu"],[35.716332,139.587741,"Tokyo","遅乃井","Musashino","ChIJXSModoWLGGARILWiCfeu2M0","💎","medium","lieu secret","tokyo lieu secret musashino"],[34.211577,136.150749,"Ōdai","大台町","大台町","ChIJMdOxx4IlBGARUYJ2Vv99rsA","💎","medium","lieu secret","ōdai lieu secret 大台町"],[35.312259,138.589251,"Chutes d'Otodome","Chutes d'Otodome","Fujinomiya","","💎","medium","lieu secret","chutes d'otodome lieu secret fujinomiya"],[35.312219,138.589247,"Chutes d'Otodome","Chutes d'Otodome","Fujinomiya","","💎","medium","lieu secret","chutes d'otodome lieu secret fujinomiya"],[36.036155,138.270887,"Chino","Chino","Chino","","💎","medium","lieu secret","chino lieu secret chino"],[35.148127,139.679097,"Miura","南下浦町松輪","Miura","ChIJa_DObU48GGARGhQ690MGki0","💎","medium","lieu secret","miura lieu secret miura"],[35.340602,138.973329,"Takenoshita","下古城","Oyama","ChIJ4dkMmaV1GWARUDYrabOX0S4","🏯","medium","château","takenoshita château oyama"],[36.033319,139.301861,"Kamagata","林道小倉線","Tokigawa","ChIJB5qX3tHUHmARLGcY9ZHNa-A","💎","medium","lieu secret","kamagata lieu secret tokigawa"],[35.563867,139.56345,"Yokohama","旧大山街道","Yokohama","ChIJCWW2u-xbGGARAFQoYPaDlgY","🗻","high","montagne","yokohama montagne yokohama"],[35.752654,139.41339,"Higashiyamato","れんげ保育園","Higashiyamato","ChIJHciJuJTgGGARg8rR1oHBNiM","💎","medium","lieu secret","higashiyamato lieu secret higashiyamato"],[35.423479,139.251615,"Isehara","良弁堂","伊勢原市","ChIJKYDWAhqqGWARZ4AhDEoUwF8","💎","medium","lieu secret","isehara lieu secret 伊勢原市"],[34.489423,136.863675,"Toba","坂手町","Toba","ChIJV6hXbb_-BGARKTa0a3zPOLI","💎","medium","lieu secret","toba lieu secret toba"],[36.118913,137.593259,"Matsumoto","乗鞍岳線","Matsumoto","ChIJx2hD6AAUHWAR3c0QMjZtjcs","🗻","high","montagne","matsumoto montagne matsumoto"],[35.417121,139.659009,"Yokohama","茶亭望塔亭","Yokohama","ChIJCWW2u-xbGGARAFQoYPaDlgY","💎","medium","lieu secret","yokohama lieu secret yokohama"],[34.353766,135.916372,"Otaki","国道169号","川上村","ChIJs0W_irG4BmARXNGuWupQSpM","💧","high","cascade","otaki cascade 川上村"],[35.293809,136.316897,"Maibara","Maibara","Maibara","","💎","medium","lieu secret","maibara lieu secret maibara"],[35.496473,136.918501,"Seki","関美濃線","Seki","ChIJi3P3cLj-AmARoLYzmyBp9FA","💎","medium","lieu secret","seki lieu secret seki"],[35.48188,136.916444,"Seki","関鍛冶伝承館","Seki","ChIJi3P3cLj-AmARoLYzmyBp9FA","💎","medium","lieu secret","seki lieu secret seki"],[35.481897,136.916401,"Seki","国道418号","Seki","ChIJi3P3cLj-AmARoLYzmyBp9FA","💎","medium","lieu secret","seki lieu secret seki"],[35.750095,138.566262,"Kōfu","猪狩町","Kōfu","ChIJqVF4l1D4G2ARCXPKVRfBdsI","💎","medium","lieu secret","kōfu lieu secret kōfu"],[34.722032,138.745069,"Kumomi","大漁","松崎町","ChIJX6Zp8_v4GWAR9jzyjsp1NEk","💎","medium","lieu secret","kumomi lieu secret 松崎町"],[34.815376,137.142917,"Nishio","Nishio","Nishio","","💎","medium","lieu secret","nishio lieu secret nishio"],[35.353382,139.06054,"Yamakita","矢倉沢山北線","山北町","ChIJk7sJTi1zGWARCbCyP7CylmU","🗻","high","montagne","yamakita montagne 山北町"],[35.304263,139.513837,"Kamakura","ファーストキッチン","Kamakura","ChIJGVasgJtFGGARAiWfOXp0AFc","💎","medium","lieu secret","kamakura lieu secret kamakura"],[35.099179,138.903729,"Doniwa","堂庭","清水町","ChIJ9dsB0WuQGWARp8ZK4kXNrA0","💎","medium","lieu secret","doniwa lieu secret 清水町"],[35.681677,139.735613,"Tokyo","皆香苑","Arrondissement de Chiyoda","ChIJXSModoWLGGARILWiCfeu2M0","💎","medium","lieu secret","tokyo lieu secret arrondissement de chiyoda"],[35.524363,139.276896,"Hanbara","田代","Aikawa","ChIJW_GGnpIEGWAR7PBSGa3Vnk8","💎","medium","lieu secret","hanbara lieu secret aikawa"],[35.218524,136.513236,"Inabe","北勢町川原","Inabe","ChIJ6ya1WLnAA2AR0XgmF3FolnI","🌊","medium","rivière","inabe rivière inabe"],[34.794852,136.256573,"Iga","山畑","Iga","ChIJGTWPCMZVAWARJdd6wGL2pOk","🗻","high","montagne","iga montagne iga"],[34.689889,138.973055,"Shimoda","国道135号","Shimoda","ChIJK3yhDPXiGWAR4AUIDxTjEkk","💎","medium","lieu secret","shimoda lieu secret shimoda"],[34.700148,138.975647,"Shimoda","国道135号","Shimoda","ChIJK3yhDPXiGWAR4AUIDxTjEkk","💎","medium","lieu secret","shimoda lieu secret shimoda"],[35.313394,138.587523,"Fujinomiya","富士富士宮線","Fujinomiya","ChIJGWeAlR7aG2ARfBoHEYNO3_M","💎","medium","lieu secret","fujinomiya lieu secret fujinomiya"],[35.768271,139.192946,"Oguno","林道タルクボ線","Tokyo","ChIJUx6Ny7EkGWARP4jIRFKo9Bc","💎","medium","lieu secret","oguno lieu secret tokyo"],[36.255384,136.902385,"Ogi","信称寺本堂","白川村","ChIJddsKEIZx-F8R2SWCJfgjcu4","🛕","low","temple","ogi temple 白川村"],[35.448392,140.40441,"Furutokoro","白子町","白子町","ChIJtenqoFTGImAR2UoW5EnZlrQ","💎","medium","lieu secret","furutokoro lieu secret 白子町"],[35.229653,138.61475,"Fujinomiya","元城町","Fujinomiya","ChIJGWeAlR7aG2ARfBoHEYNO3_M","🏯","medium","château","fujinomiya château fujinomiya"],[35.924083,139.273888,"Moroyama","林道阿諏訪支線","Moroyama","ChIJ_eDgTWQpGWAR5oxnLS7NfyI","💎","medium","lieu secret","moroyama lieu secret moroyama"],[34.983941,138.376029,"Shizuoka","麻機街道","Shizuoka","ChIJb4VYeiC_G2ARAYGHqCZ2x60","🛣️","medium","route historique","shizuoka route historique shizuoka"],[35.745562,138.567633,"Kōfu","竹日向町","Kōfu","ChIJqVF4l1D4G2ARCXPKVRfBdsI","💎","medium","lieu secret","kōfu lieu secret kōfu"],[35.911733,139.297527,"Moroyama","林道宿谷権現堂線","Moroyama","ChIJ_eDgTWQpGWAR5oxnLS7NfyI","💎","medium","lieu secret","moroyama lieu secret moroyama"],[34.518156,136.160273,"Taroji","名張曽爾線","曽爾村","ChIJ4QItjp-oBmARdessMAz388Q","💎","medium","lieu secret","taroji lieu secret 曽爾村"],[34.675235,138.972477,"Shimoda","外浦","Shimoda","ChIJK3yhDPXiGWAR4AUIDxTjEkk","💎","medium","lieu secret","shimoda lieu secret shimoda"],[35.928444,140.523548,"Katori","佐原ハ","Katori","ChIJ0zWuNZL5ImARODSm-xshUAA","💎","medium","lieu secret","katori lieu secret katori"],[35.710362,139.772437,"Rue Shinobazu","Rue Shinobazu","Arrondissement de Taitō","","💎","medium","lieu secret","rue shinobazu lieu secret arrondissement de taitō"],[34.782839,137.129081,"Nishio","寺部町","Nishio","ChIJVeX4LTWRBGARBS1GXJ1lXNM","🛕","low","temple","nishio temple nishio"],[35.002647,139.858398,"Tateyama","館山富浦線","Tateyama","ChIJI9tzpVP3F2AR_RiT6iqi_7s","🗻","high","montagne","tateyama montagne tateyama"],[36.143103,137.259461,"Takayama","平田","Takayama","ChIJScNPoUKjAmAR3OO48IT78tQ","💎","medium","lieu secret","takayama lieu secret takayama"],[35.686224,138.576967,"Kōfu","甲府山梨線","Kōfu","ChIJqVF4l1D4G2ARCXPKVRfBdsI","🗻","high","montagne","kōfu montagne kōfu"],[35.701912,139.328188,"Hachiōji","引橋","Hachiōji","ChIJN_Qpt7keGWARYhxOnVQO2Cc","🌉","low","pont","hachiōji pont hachiōji"],[35.229372,139.094454,"Tenseien","Tenseien","Hakone","","💎","medium","lieu secret","tenseien lieu secret hakone"],[35.707664,136.03901,"Tsuruga","竹波立石繩間線","Tsuruga","ChIJqd9LVMP6AWARL5rV3Zc1eM8","💎","medium","lieu secret","tsuruga lieu secret tsuruga"],[34.66058,138.931827,"Shimoda","多々戸","Shimoda","ChIJK3yhDPXiGWAR4AUIDxTjEkk","💎","medium","lieu secret","shimoda lieu secret shimoda"],[34.661004,138.932018,"Shimoda","多々戸","Shimoda","ChIJK3yhDPXiGWAR4AUIDxTjEkk","💎","medium","lieu secret","shimoda lieu secret shimoda"],[36.053665,138.122486,"Suwa","諏訪白樺湖小諸線","Suwa","ChIJ30EFZMxVHGARRiDmvSJjp-0","🌊","medium","lac","suwa lac suwa"],[35.240929,139.597422,"Route nationale 134","Route nationale 134","Yokosuka","","💎","medium","lieu secret","route nationale 134 lieu secret yokosuka"],[34.481742,136.845746,"Toba","鳥羽水族館","Toba","ChIJV6hXbb_-BGARKTa0a3zPOLI","💎","medium","lieu secret","toba lieu secret toba"],[34.449293,136.899563,"Toba","海の博物館","Toba","ChIJV6hXbb_-BGARKTa0a3zPOLI","🏛️","low","musée","toba musée toba"],[35.60395,139.646248,"Tokyo","利剣の橋","Arrondissement de Setagaya","ChIJXSModoWLGGARILWiCfeu2M0","🌉","low","pont","tokyo pont arrondissement de setagaya"],[35.603941,139.646205,"Tokyo","利剣の橋","Arrondissement de Setagaya","ChIJXSModoWLGGARILWiCfeu2M0","🌉","low","pont","tokyo pont arrondissement de setagaya"],[36.237813,136.125546,"Sakai","東尋坊","Sakai","ChIJY3SpH13s-F8RYeHrU0y2ZoQ","💎","medium","lieu secret","sakai lieu secret sakai"],[36.237805,136.125438,"Sakai","東尋坊","Sakai","ChIJY3SpH13s-F8RYeHrU0y2ZoQ","💎","medium","lieu secret","sakai lieu secret sakai"],[35.117551,140.124457,"Kamogawa","国道128号","Kamogawa","ChIJO-HKPOlUPWARCQHDVekzrHM","💎","medium","lieu secret","kamogawa lieu secret kamogawa"],[35.697297,140.853789,"Chōshi","外川町五丁目","Chōshi","ChIJDRQH7-AYI2ARZIlTMnMsQNA","🌊","medium","rivière","chōshi rivière chōshi"],[34.88624,136.833516,"Tokoname","新開町四丁目","Tokoname","ChIJPaAw5D-HBGARRa9tUXCiSzg","💎","medium","lieu secret","tokoname lieu secret tokoname"],[35.184362,136.932139,"Nagoya","徳川園","Nagoya","ChIJZSN7EJ5wA2ARUrPO6NQilio","🌊","medium","rivière","nagoya rivière nagoya"],[35.637077,139.719084,"Musée d'Art métropolitain Teien de Tokyo","Musée d'Art métropolitain Teien de Tokyo","Arrondissement de Minato","","🏛️","low","musée","musée d'art métropolitain teien de tokyo musée arrondissement de minato"],[35.680389,139.767989,"Tokyo","花道庵","Arrondissement de Chiyoda","ChIJXSModoWLGGARILWiCfeu2M0","🌸","medium","parc floral","tokyo parc floral arrondissement de chiyoda"],[35.68978,139.71809,"Tokyo Toy Museum","Tokyo Toy Museum","Arrondissement de Shinjuku","","🏛️","low","musée","tokyo toy museum musée arrondissement de shinjuku"],[34.463808,136.058668,"Higashiyoshino","吉野室生寺針線","東吉野村","ChIJ62J_sqm7BmARiWxzcNTW5ZU","🛕","low","temple","higashiyoshino temple 東吉野村"],[35.051574,139.831915,"Minamibōsō","富浦町豊岡","Minamibouso","ChIJszoYpln5F2ARX_syYuPgOI4","💎","medium","lieu secret","minamibōsō lieu secret minamibouso"],[35.698439,137.441662,"Nakatsugawa","Nakatsugawa","Nakatsugawa","","💎","medium","lieu secret","nakatsugawa lieu secret nakatsugawa"],[35.698404,137.44177,"Nakatsugawa","Nakatsugawa","Nakatsugawa","","💎","medium","lieu secret","nakatsugawa lieu secret nakatsugawa"],[35.664875,139.77023,"Tokyo","肉星","Arrondissement de Chūō","ChIJXSModoWLGGARILWiCfeu2M0","💎","medium","lieu secret","tokyo lieu secret arrondissement de chūō"],[35.335742,140.394942,"Torami","釣ヶ崎海岸","一宮町","ChIJUQsHg5DJImARmhhXEpwQ3J0","🏖️","medium","plage","torami plage 一宮町"],[35.549357,138.913253,"Tsuru","法能","Tsuru","ChIJFZ-LL1FoGWARSJSnN9O93MI","💎","medium","lieu secret","tsuru lieu secret tsuru"],[34.700991,137.004244,"Himakajima","日間賀島","南知多町","ChIJ47JzB6PtBGARsUafzct_Xm4","💎","medium","lieu secret","himakajima lieu secret 南知多町"],[36.254969,136.798615,"Hakusan","白山白川郷ホワイトロード","Hakusan","ChIJyTG34F1d-F8RhjvmgNa0N1Y","🗻","high","montagne","hakusan montagne hakusan"],[35.137256,140.274703,"Katsuura","鵜原","Katsura","ChIJIdLwloBLPWARB6pFDt9mI58","💎","medium","lieu secret","katsuura lieu secret katsura"],[35.137327,140.27434,"Katsuura","鵜原","Katsura","ChIJIdLwloBLPWARB6pFDt9mI58","💎","medium","lieu secret","katsuura lieu secret katsura"],[35.883838,138.71337,"Yamanashi","Yamanashi","Yamanashi","","💎","medium","lieu secret","yamanashi lieu secret yamanashi"],[35.953597,139.05256,"Chichibu","Chichibu","Chichibu","","💎","medium","lieu secret","chichibu lieu secret chichibu"],[35.659078,137.605965,"Yomikaki","国道19号","南木曽町","ChIJHx7HCjPGHGARYWY-wjwbyuE","💎","medium","lieu secret","yomikaki lieu secret 南木曽町"],[35.982871,140.220147,"Point de vue du Grand Bouddha d'Ushiku","Point de vue du Grand Bouddha d'Ushiku","Ushiku","","💎","medium","lieu secret","point de vue du grand bouddha d'ushiku lieu secret ushiku"],[36.196946,137.148523,"Takayama","Takayama","Takayama","","💎","medium","lieu secret","takayama lieu secret takayama"],[36.222796,138.120445,"Utsukusino-toh","Utsukusino-toh","長和町","","💎","medium","lieu secret","utsukusino-toh lieu secret 長和町"],[34.73365,136.870724,"Utsumi","南知多町","南知多町","ChIJ34amWL6LBGAR3KIX_02pDr0","💎","medium","lieu secret","utsumi lieu secret 南知多町"],[35.040557,140.021152,"Minamibōsō","和田町仁我浦","Minamibouso","ChIJszoYpln5F2ARX_syYuPgOI4","💎","medium","lieu secret","minamibōsō lieu secret minamibouso"],[35.559055,135.896444,"Wakasa","若狭三方縄文博物館","若狭町","ChIJFafRUdrCAWARCeEqhFgB5gs","🏛️","low","musée","wakasa musée 若狭町"],[35.732967,139.039517,"Hinohara","夢の瀧","Tokyo","ChIJlzPTNz05GWARQrhYm0fIo-E","💎","medium","lieu secret","hinohara lieu secret tokyo"],[34.796687,135.897873,"Wazuka","宇治木屋線","Wazuka","ChIJq6gCTwJBAWARO2Sb8Kmniaw","💎","medium","lieu secret","wazuka lieu secret wazuka"],[34.796713,135.897863,"Wazuka","宇治木屋線","Wazuka","ChIJq6gCTwJBAWARO2Sb8Kmniaw","💎","medium","lieu secret","wazuka lieu secret wazuka"],[34.913852,136.901358,"Handa","知多半島サイクリングロード","Handa","ChIJQSNwFDiEBGARHW9ca-WfTFQ","💎","medium","lieu secret","handa lieu secret handa"],[34.71978,136.89598,"Yamami","国道247号","南知多町","ChIJC_UFjGGLBGARC6-sVNfsX_s","💎","medium","lieu secret","yamami lieu secret 南知多町"],[36.252297,136.374425,"Kaga","山中温泉西桂木町","Kaga","ChIJIQewZqz2-F8RJRvDTmLd2Rk","🗻","high","montagne","kaga montagne kaga"],[35.342924,139.566858,"Kamakura","今泉不動","Kamakura","ChIJGVasgJtFGGARAiWfOXp0AFc","🛕","low","temple Fudo","kamakura temple fudo kamakura"],[35.161789,139.615556,"Miura","みなとや","Miura","ChIJa_DObU48GGARGhQ690MGki0","💎","medium","lieu secret","miura lieu secret miura"],[35.194897,139.600416,"Yokosuka","マイルストーン「タカアシガニ」","Yokosuka","ChIJV56GCpc_GGARP2fZpDHiIFI","💎","medium","lieu secret","yokosuka lieu secret yokosuka"],[35.191069,139.609726,"Parc balnéaire Soleil Hill","Parc balnéaire Soleil Hill","Yokosuka","","🌿","medium","parc","parc balnéaire soleil hill parc yokosuka"],[35.173986,140.141993,"Kamogawa","四方木","Kamogawa","ChIJO-HKPOlUPWARCQHDVekzrHM","💎","medium","lieu secret","kamogawa lieu secret kamogawa"],[35.28051,136.53418,"Yōrō","養老の滝観爆台","Yoro","ChIJo-KeQm63A2ARL1H7uXE4oaU","💧","high","cascade","yōrō cascade yoro"],[35.283044,136.549476,"Yōrō","高林","Yoro","ChIJo-KeQm63A2ARL1H7uXE4oaU","💎","medium","lieu secret","yōrō lieu secret yoro"],[35.280522,136.534244,"Yōrō","養老の滝観爆台","Yoro","ChIJo-KeQm63A2ARL1H7uXE4oaU","💧","high","cascade","yōrō cascade yoro"],[34.123795,135.925896,"Shimokitayama","下北山村","下北山村","ChIJux0nQ9qLBmARCNHOXlP5A1I","🗻","high","montagne","shimokitayama montagne 下北山村"],[34.462485,136.010723,"Uda","榛原菟田野御杖線","Uda","ChIJWYm6NeqzBmARWotM-EF2Qbc","💎","medium","lieu secret","uda lieu secret uda"],[35.310592,139.025566,"Minamiashigara","Minamiashigara","Minamiashigara","","💎","medium","lieu secret","minamiashigara lieu secret minamiashigara"],[35.216404,138.233401,"Shizuoka","南アルプス公園線","Shizuoka","ChIJb4VYeiC_G2ARAYGHqCZ2x60","🌿","medium","parc","shizuoka parc shizuoka"],[34.634093,138.889923,"Minato","湊","南伊豆町","ChIJT8twOSNYF2AR_hp_WKteJCU","💎","medium","lieu secret","minato lieu secret 南伊豆町"],[34.564292,135.0122,"Awaji","夢舞台","Awaji","ChIJwQRvVG3JVDURRIx96J9J7As","💎","medium","lieu secret","awaji lieu secret awaji"],[33.951022,134.335326,"Kamiyama","Kamiyama","Kamiyama","","💎","medium","lieu secret","kamiyama lieu secret kamiyama"],[35.559249,135.187565,"Route d'Amanohashidate","Route d'Amanohashidate","Miyazu","","💎","medium","lieu secret","route d'amanohashidate lieu secret miyazu"],[35.387431,133.551244,"Daisen","大山登山道ユートピアコース","Daisen","ChIJFfjLWsRhVjURYPzj4GJINeo","🗻","high","montagne","daisen montagne daisen"],[34.144478,131.298995,"Ube","美祢小郡線","Ube","ChIJPZ0jvSqARDURgvQuDknI1qE","💎","medium","lieu secret","ube lieu secret ube"],[34.797118,135.247887,"Kobe","おもちゃレストラン","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","💎","medium","lieu secret","kobe lieu secret kobe"],[34.070288,134.545001,"Tokushima","国道438号","Tokushima","ChIJU-wn2gINUzUR94WNIAhofbU","💎","medium","lieu secret","tokushima lieu secret tokushima"],[35.379135,133.603944,"Kotoura","中国自然歩道","Kotoura","ChIJieklAtJ6VjUR1VMsh2RC57o","💎","medium","lieu secret","kotoura lieu secret kotoura"],[34.302355,134.84374,"Sumoto","畑田組栄町線","Sumoto","ChIJAcUnaVilVDUR-p7RiGYgQa4","💎","medium","lieu secret","sumoto lieu secret sumoto"],[33.921523,133.309324,"Niihama","別子銅山記念館","Niihama","ChIJP1Qvmp7FUTURvEZMMl9gQwM","🗻","high","montagne","niihama montagne niihama"],[34.980706,133.648757,"Maniwa","Maniwa","Maniwa","","💎","medium","lieu secret","maniwa lieu secret maniwa"],[34.809117,133.621941,"Takahashi","史跡 備中松山城跡","Takahashi","ChIJISL6YeC0VjURoQCCZxMoBHs","🗻","high","montagne","takahashi montagne takahashi"],[35.071194,135.696002,"Kyoto","菩提の滝入口","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","💧","high","cascade","kyoto cascade kyoto"],[33.557991,131.438736,"Bungotakada","金谷町","Bungotakada","ChIJW-2tzZ4TRDURfkCTFblTzog","💎","medium","lieu secret","bungotakada lieu secret bungotakada"],[34.34509,135.488768,"Katsuragi","大字東谷","かつらぎ町","ChIJ-ZAUwv8lB2ARyUtopuz9NB8","💎","medium","lieu secret","katsuragi lieu secret かつらぎ町"],[34.18947,133.648699,"Mitoyo","父母ヶ浜(ちちぶがはま)海水浴場","Mitoyo","ChIJXQptipN4UTURMFI6lpFPOOA","💎","medium","lieu secret","mitoyo lieu secret mitoyo"],[34.416348,135.652771,"Chihaya","史蹟 千早城阯","Chihaya Akasaka","ChIJOVqSVpPUBmARD6Dh1LDmkFI","🏯","medium","château","chihaya château chihaya akasaka"],[33.315982,131.469632,"Beppu","海地獄","Beppu","ChIJxySfUBimRjURImdrJRj4yIk","💎","medium","lieu secret","beppu lieu secret beppu"],[33.119021,131.230378,"Kokonoe","Kokonoe","Kokonoe","","💎","medium","lieu secret","kokonoe lieu secret kokonoe"],[33.802767,133.380447,"Inokawa","大川村","大川村","ChIJvU7dOYTbUTUR5QUGropDH8Y","🌊","medium","rivière","inokawa rivière 大川村"],[33.890618,133.265485,"Niihama","Niihama","Niihama","","💎","medium","lieu secret","niihama lieu secret niihama"],[35.510586,133.494409,"Daisen","御来屋","Daisen","ChIJoxqLddlgVjUR_mLi8UQfNfc","💎","medium","lieu secret","daisen lieu secret daisen"],[35.375167,133.595086,"Kotoura","中国自然歩道","Kotoura","ChIJieklAtJ6VjUR1VMsh2RC57o","💎","medium","lieu secret","kotoura lieu secret kotoura"],[33.851782,132.786657,"Matsuyama","道後湯之町","Matsuyama","ChIJnThD3TLlTzURpzJmJKYS83E","💎","medium","lieu secret","matsuyama lieu secret matsuyama"],[33.852164,132.786356,"Matsuyama","6号","Matsuyama","ChIJnThD3TLlTzURpzJmJKYS83E","💎","medium","lieu secret","matsuyama lieu secret matsuyama"],[35.21281,135.06783,"Tamba","絹山市島線","Tamba","ChIJ9V5dSm4GAGARMk5FPQmiXjY","🗻","high","montagne","tamba montagne tamba"],[35.496199,134.227143,"Tottori","鳥取民藝美術館","Tottori","ChIJiW-EoMmWVTURVlTlKYZjRzg","🎨","low","musée art","tottori musée art tottori"],[34.182401,134.085963,"Takamatsu","塩江屋島西線","Takamatsu","ChIJ30eNVMXBUzURG_cenNQp9HI","💎","medium","lieu secret","takamatsu lieu secret takamatsu"],[34.632764,133.281438,"Fukuyama","藤尾井関線","Fukuyama","ChIJM0QQmrwQUTURtwFn4wbERQk","💎","medium","lieu secret","fukuyama lieu secret fukuyama"],[33.345972,131.327785,"Usa","安心院町山ノ口","Usa","ChIJt7rCQBcBRDURy4_-zrM7LYI","🗻","high","montagne","usa montagne usa"],[34.861803,133.469748,"Takahashi","吹屋郵便局","Takahashi","ChIJISL6YeC0VjURoQCCZxMoBHs","💎","medium","lieu secret","takahashi lieu secret takahashi"],[34.967765,135.779252,"Kyoto","稲荷山トンネル","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","⛩️","low","sanctuaire Inari","kyoto sanctuaire inari kyoto"],[35.035923,132.35277,"Gōtsu","岩滝寺滝","Ōda","ChIJ778de-RrWjUR9kqg68wEP8Q","🛕","low","temple","gōtsu temple ōda"],[35.363685,133.182695,"Yasugi","史跡富田城跡","Yasugi","ChIJsQCzl4riVjUR04YI_g8xXhg","🏯","medium","château","yasugi château yasugi"],[35.360633,133.185864,"Yasugi","勝日高守神社","Yasugi","ChIJsQCzl4riVjUR04YI_g8xXhg","⛩️","low","sanctuaire","yasugi sanctuaire yasugi"],[34.790291,135.70385,"Katano","東倉治三丁目","Katano","ChIJTdLUQyYZAWARdQ-ZvE5QMds","💎","medium","lieu secret","katano lieu secret katano"],[34.076148,132.209992,"Iwakuni","国道188号","Iwakuni","ChIJwfpYc1gzRTURTUR_ietS7vE","💎","medium","lieu secret","iwakuni lieu secret iwakuni"],[34.62717,132.655881,"Akitakata","吉田町下入江","Akitakata","ChIJi5WnwLWFUDURWh2Ge2ehWSU","💎","medium","lieu secret","akitakata lieu secret akitakata"],[35.682123,134.973948,"Kyōtango","Kyōtango","Kyōtango","","💎","medium","lieu secret","kyōtango lieu secret kyōtango"],[34.630046,135.046066,"Kobe","西垂水１１９号線","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","💎","medium","lieu secret","kobe lieu secret kobe"],[34.338386,135.387958,"Izumisano","犬鳴山 七宝瀧寺","Izumisano","ChIJKwaD_7LJAGAR6vZPnd7e5W8","🛕","low","temple","izumisano temple izumisano"],[34.483268,135.388632,"Kishiwada","戎町","Kishiwada","ChIJO_TyQvzOAGAR_ZhFW-j39eY","💎","medium","lieu secret","kishiwada lieu secret kishiwada"],[34.409577,131.399868,"Hagi","国道191号","Hagi","ChIJB30JXXatRDUR1oOgtH18Now","💎","medium","lieu secret","hagi lieu secret hagi"],[34.428291,131.418334,"Hagi","萩反射炉","Hagi","ChIJB30JXXatRDUR1oOgtH18Now","💎","medium","lieu secret","hagi lieu secret hagi"],[34.201496,133.07548,"Imabari","道の駅伯方SCパーク","Imabari","ChIJhz4P1Iw5UDURv4XnBx1nGCo","💎","medium","lieu secret","imabari lieu secret imabari"],[34.201829,133.075544,"Imabari","道の駅伯方SCパーク","Imabari","ChIJhz4P1Iw5UDURv4XnBx1nGCo","💎","medium","lieu secret","imabari lieu secret imabari"],[35.52604,134.116551,"Tottori","国道9号","Tottori","ChIJiW-EoMmWVTURVlTlKYZjRzg","💎","medium","lieu secret","tottori lieu secret tottori"],[34.953222,132.120438,"Hamada","国道9号","Hamada","ChIJUahEjqRYWjUR7K5zuqBPt6M","💎","medium","lieu secret","hamada lieu secret hamada"],[35.19808,134.501781,"Shisō","カンカケ三室林道（併）","Shisō","ChIJ1yGBOHcSVTURF19wGC0eH2E","💎","medium","lieu secret","shisō lieu secret shisō"],[33.484358,135.790511,"Kushimoto","橋杭海水浴場休憩所","串本町","ChIJbZC3x4c6BmAR7VgE51rFQ1w","🌉","low","pont","kushimoto pont 串本町"],[33.488214,135.795823,"Kushimoto","元岩","串本町","ChIJbZC3x4c6BmAR7VgE51rFQ1w","💎","medium","lieu secret","kushimoto lieu secret 串本町"],[33.359579,131.383749,"Usa","安心院町東椎屋","Usa","ChIJt7rCQBcBRDURy4_-zrM7LYI","💎","medium","lieu secret","usa lieu secret usa"],[33.359599,131.383669,"Usa","安心院町東椎屋","Usa","ChIJt7rCQBcBRDURy4_-zrM7LYI","💎","medium","lieu secret","usa lieu secret usa"],[33.359396,131.383764,"Usa","安心院町東椎屋","Usa","ChIJt7rCQBcBRDURy4_-zrM7LYI","💎","medium","lieu secret","usa lieu secret usa"],[34.871091,134.764362,"Himeji","姫路セントラルパーク","Himeji","ChIJ0djrGS3iVDURaQtrcU2Tq9s","💎","medium","lieu secret","himeji lieu secret himeji"],[34.402763,132.459127,"Hiroshima","祇園新道","Hiroshima","ChIJu0_z7giZWjURcvfBz1DO5Ac","💎","medium","lieu secret","hiroshima lieu secret hiroshima"],[35.071758,135.862229,"Ōtsu","比叡山線","Ōtsu","ChIJLQyx4ex0AWARRoaQadW7zIs","🗻","high","montagne","ōtsu montagne ōtsu"],[34.063297,131.574192,"Hōfu","三田尻港徳地線","Hōfu","ChIJrUgYi5aSRDURO3yvJRftX6Y","💎","medium","lieu secret","hōfu lieu secret hōfu"],[34.752965,135.685275,"Katano","星のブランコ","Katano","ChIJTdLUQyYZAWARdQ-ZvE5QMds","💎","medium","lieu secret","katano lieu secret katano"],[35.023362,135.641371,"Kyoto","京都日吉美山線","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","🗻","high","montagne","kyoto montagne kyoto"],[34.295224,133.106895,"Onomichi","Onomichi","Onomichi","","💎","medium","lieu secret","onomichi lieu secret onomichi"],[34.928064,133.524883,"Niimi","Niimi","Niimi","","💎","medium","lieu secret","niimi lieu secret niimi"],[34.928126,133.524679,"Niimi","Niimi","Niimi","","💎","medium","lieu secret","niimi lieu secret niimi"],[34.296443,132.266662,"Hatsukaichi","栗谷大野線","Hatsukaichi","ChIJM43IbwLHWjURRhJyosPqkNc","💎","medium","lieu secret","hatsukaichi lieu secret hatsukaichi"],[35.400245,132.672345,"Izumo","伊佐の浜","Izumo","ChIJVxq2lFxEVzURLAlvLF-gm2s","💎","medium","lieu secret","izumo lieu secret izumo"],[35.67579,135.287709,"Ine","国道178号旧道","Ine","ChIJ54StjXUK_18RKBn7P9WjHn0","💎","medium","lieu secret","ine lieu secret ine"],[34.248212,131.584451,"Yamaguchi","引谷篠目線","Yamaguchi","ChIJdf2eTMWVRDUR960yDjJWMSY","💎","medium","lieu secret","yamaguchi lieu secret yamaguchi"],[34.248247,131.584448,"Yamaguchi","引谷篠目線","Yamaguchi","ChIJdf2eTMWVRDUR960yDjJWMSY","💎","medium","lieu secret","yamaguchi lieu secret yamaguchi"],[35.000172,135.779505,"Kyoto","はぎ","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","💎","medium","lieu secret","kyoto lieu secret kyoto"],[34.296131,132.319775,"Hatsukaichi","長橋","Hatsukaichi","ChIJM43IbwLHWjURRhJyosPqkNc","🌉","low","pont","hatsukaichi pont hatsukaichi"],[35.106831,132.437565,"Ōda","大森町","Ōda","ChIJqUvqbkIGWjURfrpLGZJbP4w","🌲","high","forêt","ōda forêt ōda"],[34.951963,132.120436,"Hamada","国道9号","Hamada","ChIJUahEjqRYWjUR7K5zuqBPt6M","💎","medium","lieu secret","hamada lieu secret hamada"],[35.113262,132.443643,"Ōda","大森町","Ōda","ChIJqUvqbkIGWjURfrpLGZJbP4w","🌲","high","forêt","ōda forêt ōda"],[33.986089,132.187107,"Yanai","神代","Yanai","ChIJb72Ua9AVRTURw1kCUxR_B5o","💎","medium","lieu secret","yanai lieu secret yanai"],[34.586902,135.023248,"Route nationale 28","Route nationale 28","Awaji","","💎","medium","lieu secret","route nationale 28 lieu secret awaji"],[33.70448,133.807543,"Kami","香北町東山","Kami","ChIJJ-tfQEocUjURbfmmmuhJRcs","🗻","high","montagne","kami montagne kami"],[33.882169,133.928436,"Miyoshi","国道439号","Miyoshi","ChIJj38fyzovUjURMcNvV1FL7-8","💎","medium","lieu secret","miyoshi lieu secret miyoshi"],[33.881974,133.928434,"Miyoshi","国道439号","Miyoshi","ChIJj38fyzovUjURMcNvV1FL7-8","💎","medium","lieu secret","miyoshi lieu secret miyoshi"],[35.118949,133.678507,"Maniwa","Maniwa","Maniwa","","💎","medium","lieu secret","maniwa lieu secret maniwa"],[33.726088,135.9956,"Shingū","亀八鮨","Shingū","ChIJ5yc7z99CBmARra4NLMDkZII","💎","medium","lieu secret","shingū lieu secret shingū"],[34.863357,132.726504,"Miyoshi","Miyoshi","Miyoshi","","💎","medium","lieu secret","miyoshi lieu secret miyoshi"],[34.279119,135.073902,"Wakayama","加太海水浴場","Wakayama","ChIJeX68GYWyAGARynFP_dR2zo8","💎","medium","lieu secret","wakayama lieu secret wakayama"],[34.721176,132.629511,"Akitakata","七間横丁","Akitakata","ChIJi5WnwLWFUDURWh2Ge2ehWSU","💎","medium","lieu secret","akitakata lieu secret akitakata"],[33.255808,131.464331,"Beppu","枝郷","Beppu","ChIJxySfUBimRjURImdrJRj4yIk","💎","medium","lieu secret","beppu lieu secret beppu"],[35.459281,133.362263,"Yonago","渚の散歩道","Yonago","ChIJkx5-McH3VjURHS12V7ivMww","💎","medium","lieu secret","yonago lieu secret yonago"],[35.529858,135.182425,"Miyazu","滝馬","Miyazu","ChIJ_Y7E8kqX_18RsgCKe_uNr08","💧","high","cascade","miyazu cascade miyazu"],[35.118391,133.679144,"Maniwa","Maniwa","Maniwa","","💎","medium","lieu secret","maniwa lieu secret maniwa"],[33.316407,131.478008,"Beppu","鉄輪むし湯","Beppu","ChIJxySfUBimRjURImdrJRj4yIk","💎","medium","lieu secret","beppu lieu secret beppu"],[34.681616,135.848526,"Nara","風宮神社","Nara","ChIJwQyneMU3AWARIiZJubDZ_ko","⛩️","low","sanctuaire","nara sanctuaire nara"],[34.184262,135.169322,"Wakayama","新和歌浦線","Wakayama","ChIJeX68GYWyAGARynFP_dR2zo8","💎","medium","lieu secret","wakayama lieu secret wakayama"],[34.865846,135.491151,"Minoh","本堂","Minō","ChIJEZDfa4T5AGARge4fsXytA5A","💎","medium","lieu secret","minoh lieu secret minō"],[34.101275,132.510884,"Kure","音戸倉橋線","Kure","ChIJP1UhjG0PUDURg7jnoEviGR0","🌉","low","pont","kure pont kure"],[33.069436,131.99558,"Tsukumi","四浦港津井浦線","Tsukumi","ChIJX9qQg8eARjURp93w3bnvvns","💎","medium","lieu secret","tsukumi lieu secret tsukumi"],[34.670818,133.850618,"Kita-ku","吉備津神社","Okayama","ChIJiQn_BVgDVDURFQaXPsLMdzo","⛩️","low","sanctuaire","kita-ku sanctuaire okayama"],[35.655757,134.824614,"Toyooka","香美久美浜線","Toyooka","ChIJhY1k0pHD_18RChPo8m-O1bs","💎","medium","lieu secret","toyooka lieu secret toyooka"],[35.62472,134.813298,"Toyooka","長崎","Toyooka","ChIJhY1k0pHD_18RChPo8m-O1bs","💎","medium","lieu secret","toyooka lieu secret toyooka"],[34.256828,132.210767,"Ōtake","山陽自動車道;広島岩国道路","Ōtake","ChIJlQTJ9r3KWjURdnaTVRkY4ec","🗻","high","montagne","ōtake montagne ōtake"],[34.908802,133.536456,"Niimi","国道180号","Niimi","ChIJVXnUj_3GVjURSPf2J0zwILo","💎","medium","lieu secret","niimi lieu secret niimi"],[35.291233,132.631529,"Izumo","道の駅 キララ多伎","Izumo","ChIJVxq2lFxEVzURLAlvLF-gm2s","💎","medium","lieu secret","izumo lieu secret izumo"],[33.68644,132.634956,"Iyo","国道378号","Iyo","ChIJ_zTPAPeMTzURknm7Xmiikbg","💎","medium","lieu secret","iyo lieu secret iyo"],[35.559512,133.151899,"Matsue","北浦","Matsue","ChIJJf1X6YgDVzURnMvaG_KNin8","💎","medium","lieu secret","matsue lieu secret matsue"],[35.031393,135.735155,"Kyoto","御后三柱","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","💎","medium","lieu secret","kyoto lieu secret kyoto"],[33.417494,131.61558,"Kitsuki","大字杵築","Kitsuki","ChIJcwSOkIIXRDURrHh1TNi2B14","💎","medium","lieu secret","kitsuki lieu secret kitsuki"],[33.415423,131.620226,"Kitsuki","きつき城下町資料館","Kitsuki","ChIJcwSOkIIXRDURrHh1TNi2B14","🏯","medium","château","kitsuki château kitsuki"],[33.875362,133.291224,"Niihama","通行止め","Niihama","ChIJP1Qvmp7FUTURvEZMMl9gQwM","💎","medium","lieu secret","niihama lieu secret niihama"],[35.425431,134.942864,"Toyooka","但東町西谷","Toyooka","ChIJhY1k0pHD_18RChPo8m-O1bs","💎","medium","lieu secret","toyooka lieu secret toyooka"],[35.695271,135.031359,"Kyōtango","網野町小浜","Kyōtango","ChIJT079tGW7_18RSR1Yd4jVXvs","💎","medium","lieu secret","kyōtango lieu secret kyōtango"],[34.704454,135.193951,"Gare inférieure du jardin d'herbes aromatiques","Gare inférieure du jardin d'herbes aromatiques","Kobe","","💎","medium","lieu secret","gare inférieure du jardin d'herbes aromatiques lieu secret kobe"],[34.704489,135.193768,"Gare inférieure du jardin d'herbes aromatiques","Gare inférieure du jardin d'herbes aromatiques","Kobe","","💎","medium","lieu secret","gare inférieure du jardin d'herbes aromatiques lieu secret kobe"],[33.560821,133.531388,"Château de Kōchi","Château de Kōchi","Kōchi","","🏯","medium","château","château de kōchi château kōchi"],[33.793403,133.425538,"Ōkawa","本川大杉線","大川村","ChIJOUcNZXfcUTURRr13fWuS8JE","🌊","medium","rivière","ōkawa rivière 大川村"],[34.2113,135.587232,"Mont Kōya","Mont Kōya","Kōya","","🗻","high","montagne","mont kōya montagne kōya"],[35.37653,132.852455,"Site archéologique de Kōjindani","Site archéologique de Kōjindani","Izumo","","💎","medium","lieu secret","site archéologique de kōjindani lieu secret izumo"],[33.172857,131.225591,"Tano","九重“夢”大吊橋","Kokonoe","ChIJH1IJ179KQTURCCVwCFgoP6w","🌉","low","pont","tano pont kokonoe"],[34.936991,132.107533,"Hamada","Hamada","Hamada","","💎","medium","lieu secret","hamada lieu secret hamada"],[34.09056,134.604312,"Tokushima","鳴門徳島自転車道","Tokushima","ChIJU-wn2gINUzUR94WNIAhofbU","💎","medium","lieu secret","tokushima lieu secret tokushima"],[35.571609,134.793634,"Toyooka","国道178号","Toyooka","ChIJhY1k0pHD_18RChPo8m-O1bs","💎","medium","lieu secret","toyooka lieu secret toyooka"],[34.674625,132.703992,"Akitakata","広島県自然歩道案内図","Akitakata","ChIJi5WnwLWFUDURWh2Ge2ehWSU","💎","medium","lieu secret","akitakata lieu secret akitakata"],[34.651894,135.779151,"Pont Gokuraku","Pont Gokuraku","Yamatokōriyama","","💎","medium","lieu secret","pont gokuraku lieu secret yamatokōriyama"],[34.652114,135.779222,"Yamatokōriyama","奈良県景観遺産","Yamatokōriyama","ChIJ2X2NH546AWARo-8Eh4mImoo","💎","medium","lieu secret","yamatokōriyama lieu secret yamatokōriyama"],[35.13911,135.438909,"Kyotamba","Kyotamba","Kyotamba","","💎","medium","lieu secret","kyotamba lieu secret kyotamba"],[35.702666,135.04968,"Kyōtango","国道178号","Kyōtango","ChIJT079tGW7_18RSR1Yd4jVXvs","💎","medium","lieu secret","kyōtango lieu secret kyōtango"],[34.191781,133.823485,"Enai","榎井","Kotohira","ChIJHW0wMFfWUzURMJabH9hUwpI","💎","medium","lieu secret","enai lieu secret kotohira"],[34.213247,135.584332,"Koyasan","髙野山真言宗","Kōya","ChIJfZhw_WAnB2ARt77F1yK7kaI","🗻","high","montagne","koyasan montagne kōya"],[33.048425,131.24388,"Taketa","国道442号","Taketa","ChIJT7FvU1HMRjURb4LCN2gxfv0","💎","medium","lieu secret","taketa lieu secret taketa"],[34.14742,133.085163,"Imabari","大崎","Imabari","ChIJhz4P1Iw5UDURv4XnBx1nGCo","💎","medium","lieu secret","imabari lieu secret imabari"],[33.805131,135.563119,"Tanabe","熊野古道","Tanabe","ChIJt5g8uDcAB2ARlyu1nmetnmg","💎","medium","lieu secret","tanabe lieu secret tanabe"],[33.478335,131.525856,"Bungotakada","熊野摩崖仏","Kitsuki","ChIJW-2tzZ4TRDURfkCTFblTzog","💎","medium","lieu secret","bungotakada lieu secret kitsuki"],[35.630006,134.911863,"Kyōtango","久美浜町神崎","Kyōtango","ChIJT079tGW7_18RSR1Yd4jVXvs","💎","medium","lieu secret","kyōtango lieu secret kyōtango"],[35.242022,132.876055,"Unnan","Unnan","Unnan","","💎","medium","lieu secret","unnan lieu secret unnan"],[34.595827,133.772012,"Kurashiki","旅館くらしき","Kurashiki","ChIJHRYTPbhZUTURPsJqUXABtgM","💎","medium","lieu secret","kurashiki lieu secret kurashiki"],[35.431775,133.836429,"Kurayoshi","倉吉未来中心","Kurayoshi","ChIJ69UgxZh5VjURu4RXXBIjNb4","💎","medium","lieu secret","kurayoshi lieu secret kurayoshi"],[35.432288,133.824531,"SADAR CHOWK","SADAR CHOWK","Kurayoshi","","💎","medium","lieu secret","sadar chowk lieu secret kurayoshi"],[34.290853,132.511492,"Kure","国道31号","Kure","ChIJP1UhjG0PUDURg7jnoEviGR0","💎","medium","lieu secret","kure lieu secret kure"],[35.23317,134.880473,"Kurokawa Onsen","Kurokawa Onsen","Asago","","♨️","low","onsen","kurokawa onsen onsen asago"],[34.665512,135.506219,"Osaka","鳥貴族","Osaka","ChIJ4eIGNFXmAGAR5y9q5G7BW8U","💎","medium","lieu secret","osaka lieu secret osaka"],[34.599614,134.159097,"Setouchi","黒島古墳","Setouchi","ChIJx6UA6AdyVDUROPzl5_BxhNg","💎","medium","lieu secret","setouchi lieu secret setouchi"],[34.309474,135.850375,"Terado","赤滝五條線","黒滝村","ChIJj8ry8LXGBmARR5w3drxjfp4","💧","high","cascade","terado cascade 黒滝村"],[33.728356,135.933109,"Shingū","高田相賀線","Shingū","ChIJ5yc7z99CBmARra4NLMDkZII","💎","medium","lieu secret","shingū lieu secret shingū"],[35.051507,135.648512,"Kyoto","空也瀧","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","💎","medium","lieu secret","kyoto lieu secret kyoto"],[35.777275,135.223402,"Kyōtango","経ヶ岬灯台","Kyōtango","ChIJT079tGW7_18RSR1Yd4jVXvs","💎","medium","lieu secret","kyōtango lieu secret kyōtango"],[35.162895,135.450828,"Kyōtamba","太閤坦CC","Kyotamba","ChIJ7XYv10M5AGAR4r7wDo2RNlA","💎","medium","lieu secret","kyōtamba lieu secret kyotamba"],[35.048802,135.762963,"Kyoto","時計","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","💎","medium","lieu secret","kyoto lieu secret kyoto"],[35.479086,133.890914,"Yurihama","千年亭","Yurihama","ChIJD7uWKHTdVTURN15_WZxG4Y8","💎","medium","lieu secret","yurihama lieu secret yurihama"],[33.895937,133.328015,"Niihama","Niihama","Niihama","","💎","medium","lieu secret","niihama lieu secret niihama"],[34.443112,131.490134,"Hagi","Hagi","Hagi","","💎","medium","lieu secret","hagi lieu secret hagi"],[35.433759,133.101568,"Matsue","Matsue","Matsue","","💎","medium","lieu secret","matsue lieu secret matsue"],[35.477258,132.944542,"Matsue","松江フォーゲルパーク","Matsue","ChIJJf1X6YgDVzURnMvaG_KNin8","💎","medium","lieu secret","matsue lieu secret matsue"],[33.845719,132.76561,"Matsuyama","重要文化財　仕切門内塀","Matsuyama","ChIJnThD3TLlTzURpzJmJKYS83E","💎","medium","lieu secret","matsuyama lieu secret matsuyama"],[35.230104,135.885022,"Ōtsu","Ōtsu","Ōtsu","","💎","medium","lieu secret","ōtsu lieu secret ōtsu"],[35.651033,135.157204,"Kyōtango","味土野大宮線","Kyōtango","ChIJT079tGW7_18RSR1Yd4jVXvs","💎","medium","lieu secret","kyōtango lieu secret kyōtango"],[35.568491,133.304662,"Matsue","美保関町美保関","Matsue","ChIJJf1X6YgDVzURnMvaG_KNin8","💎","medium","lieu secret","matsue lieu secret matsue"],[35.011991,135.754945,"Sanctuaire Mikane","Sanctuaire Mikane","Kyoto","","⛩️","low","sanctuaire","sanctuaire mikane sanctuaire kyoto"],[34.853969,135.47197,"Minoh","豊中亀岡線","Minō","ChIJEZDfa4T5AGARge4fsXytA5A","💎","medium","lieu secret","minoh lieu secret minō"],[34.8471,135.472371,"Minoh","箕面公園","Minō","ChIJEZDfa4T5AGARge4fsXytA5A","🌿","medium","parc","minoh parc minō"],[34.853813,135.471832,"Minoh","豊中亀岡線","Minō","ChIJEZDfa4T5AGARge4fsXytA5A","💎","medium","lieu secret","minoh lieu secret minō"],[35.410401,133.892647,"Misasa","三朝","Misasa","ChIJlbm8WoXbVTURrF9ICdhtAlw","💎","medium","lieu secret","misasa lieu secret misasa"],[34.2361,135.875675,"Tenkawa","Tenkawa","Tenkawa","","💎","medium","lieu secret","tenkawa lieu secret tenkawa"],[35.001659,135.775505,"Kyoto","ギオンコーナー","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","💎","medium","lieu secret","kyoto lieu secret kyoto"],[34.613254,132.307301,"Kake","弁財天加計線","Akiota","ChIJo5Y2deKNWjURn_NuI-5o3mI","💎","medium","lieu secret","kake lieu secret akiota"],[35.545213,133.223849,"Sakaiminato","米子空港境港停車場線","Sakaiminato","ChIJuQm7de1VVjURzDQe4jaUWFI","💎","medium","lieu secret","sakaiminato lieu secret sakaiminato"],[34.701089,135.18924,"Kobe","神戸方面第７号線","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","💎","medium","lieu secret","kobe lieu secret kobe"],[34.431345,132.038089,"Iwakuni","右谷山林道","Iwakuni","ChIJwfpYc1gzRTURTUR_ietS7vE","🗻","high","montagne","iwakuni montagne iwakuni"],[34.062291,134.516874,"Tokushima","南庄町二丁目","Tokushima","ChIJU-wn2gINUzUR94WNIAhofbU","💎","medium","lieu secret","tokushima lieu secret tokushima"],[35.378674,133.54991,"Daisen","大山登山道ユートピアコース","Daisen","ChIJFfjLWsRhVjURYPzj4GJINeo","🗻","high","montagne","daisen montagne daisen"],[34.217862,135.605042,"Koyasan","親鸞聖人墓参道","Kōya","ChIJfZhw_WAnB2ARt77F1yK7kaI","💎","medium","lieu secret","koyasan lieu secret kōya"],[34.787257,135.709878,"Katano","枚方大和郡山線","Katano","ChIJTdLUQyYZAWARdQ-ZvE5QMds","🗻","high","montagne","katano montagne katano"],[35.124988,135.770715,"Kyoto","京都広河原美山線","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","🗻","high","montagne","kyoto montagne kyoto"],[34.456693,135.682303,"Gose","ダイヤモンドトレール","Gose","ChIJ9eONg_vSBmAR8sKBQNG_gUY","💎","medium","lieu secret","gose lieu secret gose"],[34.356893,135.870231,"Yoshino","Yoshino","Yoshino","","💎","medium","lieu secret","yoshino lieu secret yoshino"],[33.283121,131.389898,"Yufu","Yufu","Yufu","","💎","medium","lieu secret","yufu lieu secret yufu"],[33.243765,134.176349,"Muroto","室戸岬乱礁遊歩道","Muroto","ChIJVam2cmKKTTURTVwNt-QACYc","💎","medium","lieu secret","muroto lieu secret muroto"],[33.676803,135.887501,"Nachikatsuura","那智山勝浦線","Nachikatsuura","ChIJ7R0rhEk-BmAR-Bbt4DMV0FM","🗻","high","montagne","nachikatsuura montagne nachikatsuura"],[33.426846,131.706276,"Kitsuki","Kitsuki","Kitsuki","","💎","medium","lieu secret","kitsuki lieu secret kitsuki"],[34.673787,135.666562,"Higashiōsaka","第二阪奈道路","Higashiōsaka","ChIJveSxRGAgAWAR5efE9Gget6Y","💎","medium","lieu secret","higashiōsaka lieu secret higashiōsaka"],[34.266528,132.864825,"Osakikamijima","Osakikamijima","Osakikamijima","","💎","medium","lieu secret","osakikamijima lieu secret osakikamijima"],[34.059673,131.723499,"Shūnan","長田町","Shūnan","ChIJh8mdA-XbRDURoD0yhnbtcmc","💎","medium","lieu secret","shūnan lieu secret shūnan"],[34.361863,131.551603,"Yamaguchi","萩長門峡線","Hagi","ChIJdf2eTMWVRDUR960yDjJWMSY","💎","medium","lieu secret","yamaguchi lieu secret hagi"],[33.856557,134.019507,"Route nationale 439","Route nationale 439","Miyoshi","","💎","medium","lieu secret","route nationale 439 lieu secret miyoshi"],[33.561146,133.129759,"Niyodogawa","竹屋敷","Niyodogawa","ChIJQ85erJfLTzURtdUlgMHdH8g","💎","medium","lieu secret","niyodogawa lieu secret niyodogawa"],[33.203702,132.657922,"Uwajima","Uwajima","Uwajima","","💎","medium","lieu secret","uwajima lieu secret uwajima"],[34.183775,135.149748,"Wakayama","田野","Wakayama","ChIJeX68GYWyAGARynFP_dR2zo8","💎","medium","lieu secret","wakayama lieu secret wakayama"],[33.132532,132.505466,"Uwajima","幸迎橋","Uwajima","ChIJxS1LOoTzRTURrO7L9BnbCxU","🌉","low","pont","uwajima pont uwajima"],[34.459093,133.986134,"Naoshima","町立直島小学校","Naoshima","ChIJ7XUFs7bxUzURxXGF6z4IH64","💎","medium","lieu secret","naoshima lieu secret naoshima"],[33.968739,131.916598,"Hikari","虹ケ浜二丁目","Hikari","ChIJLaR0DiAcRTURX-dfJnNstbw","💎","medium","lieu secret","hikari lieu secret hikari"],[35.146467,132.404652,"Ōda","仁摩サンドミュージアム","Ōda","ChIJqUvqbkIGWjURfrpLGZJbP4w","💎","medium","lieu secret","ōda lieu secret ōda"],[34.438279,135.334964,"Kaizuka","二色の浜公園 レストハウス","Kaizuka","ChIJW_Jww9HOAGARB3vwAM_r3Nk","🌿","medium","parc","kaizuka parc kaizuka"],[34.437385,135.334321,"Kaizuka","二色の浜公園 レストハウス","Kaizuka","ChIJW_Jww9HOAGARB3vwAM_r3Nk","🌿","medium","parc","kaizuka parc kaizuka"],[33.355749,131.250758,"Kusu","Kusu","Kusu","","💎","medium","lieu secret","kusu lieu secret kusu"],[33.536949,133.255793,"Ochi","Ochi","Ochi","","💎","medium","lieu secret","ochi lieu secret ochi"],[35.392457,135.547232,"Ōi","林道頭巾山線","おおい町","ChIJhVl_h1jSAWARRFTMYf70-Rg","🗻","high","montagne","ōi montagne おおい町"],[35.127287,135.177677,"Tamba","高坂","Tambasasayama","ChIJ9V5dSm4GAGARMk5FPQmiXjY","💎","medium","lieu secret","tamba lieu secret tambasasayama"],[34.709753,135.193881,"Kobe","阪神高速32号新神戸トンネル","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","💎","medium","lieu secret","kobe lieu secret kobe"],[34.709855,135.193816,"Kobe","阪神高速32号新神戸トンネル","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","💎","medium","lieu secret","kobe lieu secret kobe"],[34.708325,135.194245,"Kobe","阪神高速32号新神戸トンネル","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","💎","medium","lieu secret","kobe lieu secret kobe"],[34.710372,135.193858,"Kobe","布引大竜寺線","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","🛕","low","temple","kobe temple kobe"],[34.276921,135.632181,"Hashimoto","国道371号","橋本市","ChIJA030OSbWBmARPLevweSdk9k","💎","medium","lieu secret","hashimoto lieu secret 橋本市"],[33.893365,133.757055,"Miyoshi","国道32号","Miyoshi","ChIJj38fyzovUjURMcNvV1FL7-8","💎","medium","lieu secret","miyoshi lieu secret miyoshi"],[34.180696,133.315465,"Kamijima","大木","Kamijima","ChIJo4b3PNetUTURtEFhZqoobQw","💎","medium","lieu secret","kamijima lieu secret kamijima"],[34.42693,134.059825,"Takamatsu","極楽橋","Takamatsu","ChIJ30eNVMXBUzURG_cenNQp9HI","🌉","low","pont","takamatsu pont takamatsu"],[34.172956,131.381872,"Mine","Mine","Mine","","💎","medium","lieu secret","mine lieu secret mine"],[34.309243,132.9935,"Jetée n°2 d'Okunoshima","Jetée n°2 d'Okunoshima","Takehara","","💎","medium","lieu secret","jetée n°2 d'okunoshima lieu secret takehara"],[34.03056,134.588296,"Tokushima","徳島南部自動車道","Tokushima","ChIJU-wn2gINUzUR94WNIAhofbU","💎","medium","lieu secret","tokushima lieu secret tokushima"],[33.747525,133.103338,"Kumakōgen","久万高原町","久万高原町","ChIJl-yB9bHHTzUReMPQkHZNgSk","💎","medium","lieu secret","kumakōgen lieu secret 久万高原町"],[33.270617,131.473219,"Beppu","東九州自動車道","Beppu","ChIJxySfUBimRjURImdrJRj4yIk","💎","medium","lieu secret","beppu lieu secret beppu"],[33.890584,136.116409,"Promenade d'Onigajō","Promenade d'Onigajō","Kumano","","💎","medium","lieu secret","promenade d'onigajō lieu secret kumano"],[34.412158,133.222734,"Onomichi","尾崎本町","Onomichi","ChIJYQlrv9X_UDURMa-XPVvqfXs","💎","medium","lieu secret","onomichi lieu secret onomichi"],[34.409727,133.205203,"Onomichi","東土堂町","Onomichi","ChIJYQlrv9X_UDURMa-XPVvqfXs","💎","medium","lieu secret","onomichi lieu secret onomichi"],[34.697276,135.521062,"Osaka","長谷川為造君","Osaka","ChIJ4eIGNFXmAGAR5y9q5G7BW8U","🌊","medium","rivière","osaka rivière osaka"],[35.118485,135.837518,"Tour du Clocher","Tour du Clocher","Kyoto","","💎","medium","lieu secret","tour du clocher lieu secret kyoto"],[35.120641,135.839727,"Temple Raigō","Temple Raigō","Kyoto","","🛕","low","temple","temple raigō temple kyoto"],[34.994641,135.785217,"Veilleuse","Veilleuse","Kyoto","","💎","medium","lieu secret","veilleuse lieu secret kyoto"],[33.50963,132.541409,"Ōzu","大洲城","Ōzu","ChIJnb65G-GFTzUR7HRxp1IM8YU","🏯","medium","château","ōzu château ōzu"],[35.299844,135.608294,"Nantan","Nantan","Nantan","","💎","medium","lieu secret","nantan lieu secret nantan"],[34.330054,134.045834,"16","16","Takamatsu","","💎","medium","lieu secret","16 lieu secret takamatsu"],[34.761966,135.240071,"Kobe","六甲高山植物園","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","🗻","high","montagne","kobe montagne kobe"],[34.751631,135.20896,"Kobe","明石神戸宝塚線","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","💎","medium","lieu secret","kobe lieu secret kobe"],[35.019159,135.804922,"Kyoto","京都一周トレイル","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","💎","medium","lieu secret","kyoto lieu secret kyoto"],[33.276248,131.207404,"Matsugi","下恵良九重線","Kokonoe","ChIJnThzq-5NQTUR5E_xVnpEdOw","💎","medium","lieu secret","matsugi lieu secret kokonoe"],[34.818416,135.824399,"Taka","井手町","井手町","ChIJEyEG7goWAWARpZ-IC-_KGs4","💎","medium","lieu secret","taka lieu secret 井手町"],[34.681182,133.354066,"Fukuyama","井関加茂線","Fukuyama","ChIJM0QQmrwQUTURtwFn4wbERQk","💎","medium","lieu secret","fukuyama lieu secret fukuyama"],[34.790783,132.226385,"Hamada","Hamada","Hamada","","💎","medium","lieu secret","hamada lieu secret hamada"],[35.195535,132.784577,"Unnan","Unnan","Unnan","","💎","medium","lieu secret","unnan lieu secret unnan"],[34.992362,135.683742,"Kyoto","大歇橋","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","🌉","low","pont","kyoto pont kyoto"],[34.832062,135.38881,"Takarazuka","満願寺町","Kawanishi","ChIJ-XpVVnpfAGARxGAgghw5p8c","🛕","low","temple","takarazuka temple kawanishi"],[34.601163,135.446324,"Sakai","築港八幡町","Sakai","ChIJW2vFrmfaAGARIKSY9p7Ut74","💎","medium","lieu secret","sakai lieu secret sakai"],[35.538953,133.230403,"Sakaiminato","湊町","Sakaiminato","ChIJuQm7de1VVjURzDQe4jaUWFI","💎","medium","lieu secret","sakaiminato lieu secret sakaiminato"],[34.664107,135.433169,"2-1-33","2-1-33","Osaka","","💎","medium","lieu secret","2-1-33 lieu secret osaka"],[34.631359,132.186762,"Akiota","Akiota","Akiota","","💎","medium","lieu secret","akiota lieu secret akiota"],[34.599988,132.207101,"Akiōta","柴木","Akiota","ChIJxV0pSumSWjURi5pN2ZEGfss","💎","medium","lieu secret","akiōta lieu secret akiota"],[35.119875,135.834556,"Kyoto","未明橋","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","🌉","low","pont","kyoto pont kyoto"],[35.434297,134.614838,"Kami","日影養父線","Kami","ChIJn4KxjDXX_18Res_-74PpORA","💎","medium","lieu secret","kami lieu secret kami"],[35.07354,135.217577,"Sasayama","帳台","Tambasasayama","ChIJZXH1BWVrAGAR-dCGi9awuJY","💎","medium","lieu secret","sasayama lieu secret tambasasayama"],[34.721159,133.451733,"Takahashi","上大竹高山線","Takahashi","ChIJISL6YeC0VjURoQCCZxMoBHs","🗻","high","montagne","takahashi montagne takahashi"],[34.388922,131.194697,"Nagato","仙崎","Nagato","ChIJbcaHpZJnQzURubGPFww5jm0","💎","medium","lieu secret","nagato lieu secret nagato"],[34.714257,135.571481,"Moriguchi","高瀬錯雑地","Moriguchi","ChIJa26M2r_hAGARz0iIzSKmM-E","💎","medium","lieu secret","moriguchi lieu secret moriguchi"],[34.531099,132.140183,"Hatsukaichi","吉和戸河内線","Hatsukaichi","ChIJM43IbwLHWjURRhJyosPqkNc","💎","medium","lieu secret","hatsukaichi lieu secret hatsukaichi"],[34.280146,131.90261,"Iwakuni","錦鹿野線","Iwakuni","ChIJwfpYc1gzRTURTUR_ietS7vE","💎","medium","lieu secret","iwakuni lieu secret iwakuni"],[34.425635,133.762477,"Kurashiki","牛首","Kurashiki","ChIJHRYTPbhZUTURPsJqUXABtgM","💎","medium","lieu secret","kurashiki lieu secret kurashiki"],[34.680187,133.014804,"Miyoshi","Miyoshi","Miyoshi","","💎","medium","lieu secret","miyoshi lieu secret miyoshi"],[34.680194,133.014734,"Miyoshi","Miyoshi","Miyoshi","","💎","medium","lieu secret","miyoshi lieu secret miyoshi"],[33.169381,131.225621,"Tano","飯田高原中村線","Kokonoe","ChIJH1IJ179KQTURCCVwCFgoP6w","💎","medium","lieu secret","tano lieu secret kokonoe"],[34.651734,135.50587,"DAIEI","DAIEI","Osaka","","💎","medium","lieu secret","daiei lieu secret osaka"],[33.376425,132.386938,"Seiyo","国道378号","Seiyo","ChIJI3sOktZ4TzURBu2-tx_wvcE","💎","medium","lieu secret","seiyo lieu secret seiyo"],[34.964726,135.787313,"Kyoto","深草極楽寺山町","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","🛕","low","temple","kyoto temple kyoto"],[35.494342,135.55347,"Takahama","事代","高浜町","ChIJ2QJxVxsqAGAR-svJ9mgvoTY","💎","medium","lieu secret","takahama lieu secret 高浜町"],[34.478233,134.188766,"Ko","国道436号","土庄町","ChIJr8-vrpaJUzURmMCXefRyyC8","💎","medium","lieu secret","ko lieu secret 土庄町"],[34.472921,134.273615,"Nishimura","国道436号","小豆島町","ChIJKfBQtGd4VDURWY2BDLSA2Wk","💎","medium","lieu secret","nishimura lieu secret 小豆島町"],[34.471902,133.017673,"Mihara","久井町土取","Mihara","ChIJhQeb4wlYUDUR0AT2ars5MQQ","💎","medium","lieu secret","mihara lieu secret mihara"],[34.316865,131.293665,"Mine","Mine","Mine","","💎","medium","lieu secret","mine lieu secret mine"],[34.337719,134.902915,"Sumoto","洲本城","Sumoto","ChIJAcUnaVilVDUR-p7RiGYgQa4","🏯","medium","château","sumoto château sumoto"],[33.545826,135.493761,"Susami","国道42号","すさみ町","ChIJ6VIme722B2ARSk2NIeNwz5o","💎","medium","lieu secret","susami lieu secret すさみ町"],[33.545737,135.493632,"Susami","国道42号","すさみ町","ChIJ6VIme722B2ARSk2NIeNwz5o","💎","medium","lieu secret","susami lieu secret すさみ町"],[34.990909,135.746832,"Kankijichō","Kankijichō","Kyoto","","💎","medium","lieu secret","kankijichō lieu secret kyoto"],[35.296089,132.736813,"Izumo","霊光寺","Izumo","ChIJVxq2lFxEVzURLAlvLF-gm2s","🛕","low","temple","izumo temple izumo"],[33.772385,134.583985,"321 Taihama Camping Ground","321 Taihama Camping Ground","Minami","","💎","medium","lieu secret","321 taihama camping ground lieu secret minami"],[34.792063,133.626867,"Takahashi","奥万田町","Takahashi","ChIJISL6YeC0VjURoQCCZxMoBHs","💎","medium","lieu secret","takahashi lieu secret takahashi"],[34.344126,134.049149,"Takamatsu","高松市美術館","Takamatsu","ChIJ30eNVMXBUzURG_cenNQp9HI","🎨","low","musée art","takamatsu musée art takamatsu"],[34.330125,134.045652,"16","16","Takamatsu","","💎","medium","lieu secret","16 lieu secret takamatsu"],[33.258573,131.532718,"Ōita","国道10号","Ōita","ChIJi7xfnQacRjUR2l4jZyAVr4U","💎","medium","lieu secret","ōita lieu secret ōita"],[35.300641,134.829024,"Route de liaison de Bantan","Route de liaison de Bantan","Asago","","💎","medium","lieu secret","route de liaison de bantan lieu secret asago"],[35.297517,134.835228,"Asago","上町","Asago","ChIJoQ_tX81bVTURkInbDdHEXZo","💎","medium","lieu secret","asago lieu secret asago"],[34.346992,132.910356,"Takehara","ほり川","Takehara","ChIJKXh7wy5dUDURtGAykSpk8VY","🌊","medium","rivière","takehara rivière takehara"],[35.131107,135.659897,"Kyoto","京北細野町","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","💎","medium","lieu secret","kyoto lieu secret kyoto"],[34.101301,135.762742,"Uenoji","谷瀬の吊り橋","十津川村","ChIJM6Cx5XLvBmARoy0eu11Rh9I","🌉","low","pont","uenoji pont 十津川村"],[34.336461,135.185486,"Tannowa","淡輪停車場線","Misaki","ChIJnSYkcaaxAGARdaYX2f4BBGY","💎","medium","lieu secret","tannowa lieu secret misaki"],[33.256635,131.547838,"Ōita","国道10号","Ōita","ChIJi7xfnQacRjUR2l4jZyAVr4U","💎","medium","lieu secret","ōita lieu secret ōita"],[34.868697,134.544883,"Tatsuno","玉川橋","Tatsuno","ChIJZWE8X_X8VDURTemDL6WnWl8","🌊","medium","rivière","tatsuno rivière tatsuno"],[34.556924,135.795619,"Sakate","新町","Tawaramoto","ChIJP3A4ksczAWARctXK9KULiBI","💎","medium","lieu secret","sakate lieu secret tawaramoto"],[35.335471,134.6079,"Yabu","天瀧三社大権現","Yabu","ChIJXx5b57VgVTURQhdU7DVk3d8","💎","medium","lieu secret","yabu lieu secret yabu"],[35.332905,134.617645,"Yabu","天滝渓谷駐車場","Yabu","ChIJXx5b57VgVTURQhdU7DVk3d8","💧","high","cascade","yabu cascade yabu"],[34.223648,135.841782,"Tsubonouchi","旧 白飯寺","Tenkawa","ChIJRwPhhqzrBmARgr4E033zzT8","🛕","low","temple","tsubonouchi temple tenkawa"],[35.53973,134.238454,"Tottori","鳥取砂丘細川線","Tottori","ChIJiW-EoMmWVTURVlTlKYZjRzg","🌊","medium","rivière","tottori rivière tottori"],[35.705582,135.285757,"Ine","泊","Ine","ChIJ54StjXUK_18RKBn7P9WjHn0","💎","medium","lieu secret","ine lieu secret ine"],[34.383347,133.38094,"Fukuyama","田渕屋","Fukuyama","ChIJM0QQmrwQUTURtwFn4wbERQk","💎","medium","lieu secret","fukuyama lieu secret fukuyama"],[35.152332,134.689665,"Kamikawa","舞台","Kamikawa","ChIJsVEqNylHVTURCIac3eP_6kY","💎","medium","lieu secret","kamikawa lieu secret kamikawa"],[35.544195,134.229061,"Tottori","鳥取砂丘","Tottori","ChIJiW-EoMmWVTURVlTlKYZjRzg","💎","medium","lieu secret","tottori lieu secret tottori"],[35.544782,134.226916,"Tottori","鳥取砂丘","Tottori","ChIJiW-EoMmWVTURVlTlKYZjRzg","💎","medium","lieu secret","tottori lieu secret tottori"],[34.286517,134.2561,"Sanuki","津田引田線","Sanuki","ChIJd_5SUjCXUzURiUMFOjjpXUY","💎","medium","lieu secret","sanuki lieu secret sanuki"],[34.78927,135.246104,"Kobe","滝見茶屋","Kobe","ChIJ2YntKoF9AGAR9HD2wgZhEsc","💧","high","cascade","kobe cascade kobe"],[33.55651,132.653514,"Uchiko","内子","Uchiko","ChIJYQRT08qFTzURrO7j62fS_GA","💎","medium","lieu secret","uchiko lieu secret uchiko"],[33.660279,134.403045,"Mugi","内妻大橋","Mugi","ChIJHR7GsID3UjUR2ijZA5VNxGQ","🌉","low","pont","mugi pont mugi"],[34.689265,135.873644,"Nara","Nara","Nara","","💎","medium","lieu secret","nara lieu secret nara"],[34.884237,135.800935,"Uji","宇治","Uji","ChIJ7VMo54QRAWAR3t1BYKpGatY","💎","medium","lieu secret","uji lieu secret uji"],[35.195065,134.850707,"Asago","国道429号","Asago","ChIJoQ_tX81bVTURkInbDdHEXZo","💎","medium","lieu secret","asago lieu secret asago"],[35.459891,135.84249,"Wakasa","天徳寺","若狭町","ChIJFafRUdrCAWARCeEqhFgB5gs","🛕","low","temple","wakasa temple 若狭町"],[33.121695,131.80321,"Usuki","臼杵停車場線","Usuki","ChIJQ3yDgk-FRjURCm8R9d2yLY4","💎","medium","lieu secret","usuki lieu secret usuki"],[33.089836,131.762986,"Usuki","下中尾","Usuki","ChIJQ3yDgk-FRjURCm8R9d2yLY4","💎","medium","lieu secret","usuki lieu secret usuki"],[35.492858,135.574847,"Wada","青戸の入江探勝のみち","高浜町","ChIJrXm5DDMqAGARChgmSfCJRck","💎","medium","lieu secret","wada lieu secret 高浜町"],[34.0844,131.727757,"Shūnan","若山城跡","Shūnan","ChIJh8mdA-XbRDURoD0yhnbtcmc","🗻","high","montagne","shūnan montagne shūnan"],[34.162291,135.182991,"Wakayama","毛見","Wakayama","ChIJeX68GYWyAGARynFP_dR2zo8","💎","medium","lieu secret","wakayama lieu secret wakayama"],[35.504458,134.233386,"Tottori","鳥取県立童謡館;鳥取世界おもちゃ館;わらべ館","Tottori","ChIJiW-EoMmWVTURVlTlKYZjRzg","💎","medium","lieu secret","tottori lieu secret tottori"],[35.157094,132.806076,"Unnan","Unnan","Unnan","","💎","medium","lieu secret","unnan lieu secret unnan"],[34.965575,135.778496,"Kyoto","深草笹山町","Kyoto","ChIJ8cM8zdaoAWARPR27azYdlsA","🗻","high","montagne","kyoto montagne kyoto"],[34.705775,132.270865,"Kitahiroshima","川小田","Kitahiroshima","ChIJl-FN2FqIWjUROkDippjhq2k","🌊","medium","rivière","kitahiroshima rivière kitahiroshima"],[34.685547,135.8363,"Nara","奈良午餐小店","Nara","ChIJwQyneMU3AWARIiZJubDZ_ko","💎","medium","lieu secret","nara lieu secret nara"],[33.235359,131.451345,"Beppu","Beppu","Beppu","","💎","medium","lieu secret","beppu lieu secret beppu"],[35.664592,134.965625,"Kyōtango","国道178号旧道","Kyōtango","ChIJT079tGW7_18RSR1Yd4jVXvs","💎","medium","lieu secret","kyōtango lieu secret kyōtango"],[33.195607,132.584739,"Uwajima","大超寺奥","Uwajima","ChIJxS1LOoTzRTURrO7L9BnbCxU","🛕","low","temple","uwajima temple uwajima"],[35.096406,132.34963,"Ōda","温泉津","Ōda","ChIJqUvqbkIGWjURfrpLGZJbP4w","♨️","low","onsen","ōda onsen ōda"],[32.991886,131.303438,"Taketa","Taketa","Taketa","","💎","medium","lieu secret","taketa lieu secret taketa"],[32.992007,131.302682,"Taketa","Taketa","Taketa","","💎","medium","lieu secret","taketa lieu secret taketa"],[33.49885,131.156065,"Nakatsu","本耶馬渓町曽木","Nakatsu","ChIJ1Xv9qgtYQTUR1kUz0pHaQng","💎","medium","lieu secret","nakatsu lieu secret nakatsu"],[31.803197,131.470163,"Miyazaki","青島二丁目","Miyazaki","ChIJe6Jox_a1ODURfe54GDviTA0","💎","medium","lieu secret","miyazaki lieu secret miyazaki"],[31.805607,131.47641,"Aoshima-jinja","Aoshima-jinja","Miyazaki","","💎","medium","lieu secret","aoshima-jinja lieu secret miyazaki"],[31.802077,131.470004,"Miyazaki","青島二丁目","Miyazaki","ChIJe6Jox_a1ODURfe54GDviTA0","💎","medium","lieu secret","miyazaki lieu secret miyazaki"],[33.356476,129.500492,"Hirado","下中野町","Hirado","ChIJcX87vZ76ajUR1RXhnECN2Fg","💎","medium","lieu secret","hirado lieu secret hirado"],[33.411254,130.320882,"Kanzaki","佐賀脊振線","Kanzaki","ChIJLUv1XCy4QTURVetHavvm-Wk","💎","medium","lieu secret","kanzaki lieu secret kanzaki"],[32.919153,131.065883,"Aso","黒川","Aso","ChIJO_UmZHMmQTURSBmB048cO3g","🌊","medium","rivière","aso rivière aso"],[32.885641,131.052014,"Aso","阿蘇火山博物館","南阿蘇村","ChIJO_UmZHMmQTURSBmB048cO3g","🗻","high","montagne","aso montagne 南阿蘇村"],[32.899082,131.087175,"Aso","Aso","Aso","","💎","medium","lieu secret","aso lieu secret aso"],[32.706223,130.29741,"Minamishimabara","Minamishimabara","Minamishimabara","","💎","medium","lieu secret","minamishimabara lieu secret minamishimabara"],[33.281166,131.158433,"Hoashi","転車台","Kusu","ChIJlZnPJDFOQTURXJ6qDFqoAr4","💎","medium","lieu secret","hoashi lieu secret kusu"],[31.986129,130.378868,"Satsuma","登尾コース","Satsuma","ChIJDRpWgk2tPzURaYVvy79D2zw","💎","medium","lieu secret","satsuma lieu secret satsuma"],[32.984068,131.520881,"Bungo-ōno","Bungo-ōno","Bungo-ōno","","💎","medium","lieu secret","bungo-ōno lieu secret bungo-ōno"],[32.983563,131.521066,"Bungo-ōno","Bungo-ōno","Bungo-ōno","","💎","medium","lieu secret","bungo-ōno lieu secret bungo-ōno"],[31.36373,130.434303,"Minamikyūshū","知覧特攻平和会館","Minamikyūshū","ChIJwVSzYTJ2PjURn5hfFGOTm-E","💎","medium","lieu secret","minamikyūshū lieu secret minamikyūshū"],[31.377432,130.44273,"Minamikyūshū","西郷氏庭園","Minamikyūshū","ChIJwVSzYTJ2PjURn5hfFGOTm-E","🌸","low","jardin","minamikyūshū jardin minamikyūshū"],[33.297246,130.748007,"Ukiha","八女香春線","Ukiha","ChIJV42HvatyQTURjVwznoDN4SM","💎","medium","lieu secret","ukiha lieu secret ukiha"],[32.681293,130.994959,"Yamato","通潤橋","Yamato","ChIJrUdYKSLEQDURpnEIDpErTWI","🌉","low","pont","yamato pont yamato"],[32.681633,130.994889,"Yamato","通潤橋","Yamato","ChIJrUdYKSLEQDURpnEIDpErTWI","🌉","low","pont","yamato pont yamato"],[32.416157,130.214456,"Amakusa","Amakusa","Amakusa","","💎","medium","lieu secret","amakusa lieu secret amakusa"],[32.700386,128.772078,"Gotô","Gotô","Gotô","","💎","medium","lieu secret","gotô lieu secret gotô"],[33.637436,130.553185,"Sasaguri","宗像篠栗線","篠栗町","ChIJ6XTP-PiDQTURsz4ZG1Uor84","💎","medium","lieu secret","sasaguri lieu secret 篠栗町"],[32.62784,129.738452,"Nagasaki","慰霊碑","Nagasaki","ChIJZ9oYhFRMFTURk8wyyu2m94s","💎","medium","lieu secret","nagasaki lieu secret nagasaki"],[33.55302,129.851622,"Karatsu","波戸岬線","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","💎","medium","lieu secret","karatsu lieu secret karatsu"],[33.592929,130.410571,"Fukuoka","櫛田神社飾り山笠","Fukuoka","ChIJKYSE6aHtQTURg4c5NplyCvY","⛩️","low","sanctuaire","fukuoka sanctuaire fukuoka"],[32.964587,131.45141,"Bungo-ōno","原尻の滝","Bungo-ōno","ChIJKytiz7DGRjUR7mtXk-EUVbg","💧","high","cascade","bungo-ōno cascade bungo-ōno"],[32.629133,130.254218,"Minamishimabara","長崎と天草地方の潜伏キリシタン関連遺産","Minamishimabara","ChIJW6yI3rgLQDURd7Rp12x3tXs","💎","medium","lieu secret","minamishimabara lieu secret minamishimabara"],[33.299902,129.442652,"Hirado","平戸田平線","Hirado","ChIJcX87vZ76ajUR1RXhnECN2Fg","💎","medium","lieu secret","hirado lieu secret hirado"],[32.217162,130.758777,"Hitoyoshi","坂本人吉線","Hitoyoshi","ChIJ_S8gsYdxPzURElYtdHlYpM4","💎","medium","lieu secret","hitoyoshi lieu secret hitoyoshi"],[32.423502,131.685448,"Hyūga","細島港線","Hyūga","ChIJhX-q4tVGRzURKeNtNjUP0zQ","💎","medium","lieu secret","hyūga lieu secret hyūga"],[32.425292,131.687233,"Umagase Hyuga","Umagase Hyuga","Hyūga","","💎","medium","lieu secret","umagase hyuga lieu secret hyūga"],[32.4251,131.68595,"Hyūga","細島港線","Hyūga","ChIJhX-q4tVGRzURKeNtNjUP0zQ","💎","medium","lieu secret","hyūga lieu secret hyūga"],[31.238559,130.64247,"Ibusuki","湊一丁目","Ibusuki","ChIJ__46iFXUPTURmmcjF59QuWY","💎","medium","lieu secret","ibusuki lieu secret ibusuki"],[32.885462,129.59857,"Nagasaki","池島循環線","Nagasaki","ChIJZ9oYhFRMFTURk8wyyu2m94s","💎","medium","lieu secret","nagasaki lieu secret nagasaki"],[33.276661,129.882181,"Imari","伊万里停車場線","Imari","ChIJrU2uF9GGajURPNTCly4oH84","💎","medium","lieu secret","imari lieu secret imari"],[33.354349,129.846072,"Imari","国道204号","Imari","ChIJrU2uF9GGajURPNTCly4oH84","💎","medium","lieu secret","imari lieu secret imari"],[32.758548,129.845699,"Nagasaki","遊具広場","Nagasaki","ChIJZ9oYhFRMFTURk8wyyu2m94s","💎","medium","lieu secret","nagasaki lieu secret nagasaki"],[32.915226,130.591593,"Tamana","田崎","Tamana","ChIJo6yddoBZQDURns1EOvSzwrk","💎","medium","lieu secret","tamana lieu secret tamana"],[32.728196,130.259847,"Unzen","Unzen","Unzen","","💎","medium","lieu secret","unzen lieu secret unzen"],[30.455234,130.495986,"Route Kamiyaku-Nagata-Yaku","Route Kamiyaku-Nagata-Yaku","Yakushima","","💎","medium","lieu secret","route kamiyaku-nagata-yaku lieu secret yakushima"],[32.451098,130.376774,"Kamiamakusa","祝口観音の滝","Kami-Amakusa","ChIJ__E7rlCJPzURH6VhjWLNPfs","🛕","low","temple Kannon","kamiamakusa temple kannon kami-amakusa"],[33.265036,131.068299,"Hita","慈恩の滝","Kusu","ChIJCfyvE1YVQTURew3P4XzYpjk","💧","high","cascade","hita cascade kusu"],[30.360838,130.531885,"Miyanoura","縄文杉","Yakushima","ChIJKQymZLYePTUR7usoBWG5sno","💎","medium","lieu secret","miyanoura lieu secret yakushima"],[33.285502,130.993267,"Hita","Hita","Hita","","💎","medium","lieu secret","hita lieu secret hita"],[31.596149,130.564675,"Kagoshima","かごしま水族館","Kagoshima","ChIJPcXjAFJhPjURhVhcXa393Jo","💎","medium","lieu secret","kagoshima lieu secret kagoshima"],[33.435542,130.12988,"Karatsu","七山厳木線","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","🗻","high","montagne","karatsu montagne karatsu"],[33.435174,130.130118,"Karatsu","福聚院","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","💎","medium","lieu secret","karatsu lieu secret karatsu"],[33.486991,130.305063,"Fukuoka","花乱ノ滝","Fukuoka","ChIJKYSE6aHtQTURg4c5NplyCvY","💧","high","cascade","fukuoka cascade fukuoka"],[33.486489,130.304978,"Fukuoka","花乱ノ滝","Fukuoka","ChIJKYSE6aHtQTURg4c5NplyCvY","💧","high","cascade","fukuoka cascade fukuoka"],[33.956715,130.945867,"Shimonoseki","唐戸市場","Shimonoseki","ChIJp19vVVt1QzURcwp5jknBAXE","🏪","low","marché","shimonoseki marché shimonoseki"],[33.453511,129.978251,"Karatsu","唐津城","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","🏯","medium","château","karatsu château karatsu"],[32.766963,132.629328,"Ōtsuki","柏島","大月町","ChIJObJ4KEKtSDURsaePk3ZPggI","💎","medium","lieu secret","ōtsuki lieu secret 大月町"],[32.767424,132.629297,"Ōtsuki","柏島二ツ石線","大月町","ChIJObJ4KEKtSDURsaePk3ZPggI","💎","medium","lieu secret","ōtsuki lieu secret 大月町"],[33.003026,130.945095,"Kikuchi","水源林道","Kikuchi","ChIJqSSBKJAdQTURDNYFvIqq9Q0","💎","medium","lieu secret","kikuchi lieu secret kikuchi"],[33.003062,130.945117,"Kikuchi","水源林道","Kikuchi","ChIJqSSBKJAdQTURDNYFvIqq9Q0","💎","medium","lieu secret","kikuchi lieu secret kikuchi"],[31.939819,130.778719,"Koba","鹿児島県霧島アートの森","Yusui","ChIJk3LIKAUFPzURIzrMCbe9er0","🌲","high","forêt","koba forêt yusui"],[31.830325,131.45338,"Miyazaki","Miyazaki","Miyazaki","","💎","medium","lieu secret","miyazaki lieu secret miyazaki"],[33.325868,130.214961,"Ogi","小城富士線","Ogi","ChIJjZusO-HMQTURF8UOzA9bdlM","🏯","medium","château","ogi château ogi"],[33.32579,130.214864,"Ogi","小城富士線","Ogi","ChIJjZusO-HMQTURF8UOzA9bdlM","🏯","medium","château","ogi château ogi"],[33.077315,130.689794,"Yamaga","Yamaga","Yamaga","","💎","medium","lieu secret","yamaga lieu secret yamaga"],[32.806303,130.705887,"Passage of Darkness","Passage of Darkness","Kumamoto","","💎","medium","lieu secret","passage of darkness lieu secret kumamoto"],[32.774651,130.747626,"Kumamoto","熊本市動植物園","Kumamoto","ChIJTxvxrBT0QDURMVzPm9HOURo","💎","medium","lieu secret","kumamoto lieu secret kumamoto"],[32.72073,131.278699,"Oshikata","高千穂町","高千穂町","ChIJaWgxNdzSQDURmxWcAO0e7no","💎","medium","lieu secret","oshikata lieu secret 高千穂町"],[31.375266,130.169524,"Minamisatsuma","Minamisatsuma","Minamisatsuma","","💎","medium","lieu secret","minamisatsuma lieu secret minamisatsuma"],[33.51841,130.538348,"2","2","Dazaifu","","💎","medium","lieu secret","2 lieu secret dazaifu"],[31.236051,130.560134,"Ibusuki","池田","Ibusuki","ChIJ__46iFXUPTURmmcjF59QuWY","💎","medium","lieu secret","ibusuki lieu secret ibusuki"],[31.272421,130.290421,"Makurazaki","桜木町","Makurazaki","ChIJzyccA_jdPTUR8QEi_n4E6DU","🌸","medium","cerisiers","makurazaki cerisiers makurazaki"],[32.070597,131.084851,"Kobayashi","Kobayashi","Kobayashi","","💎","medium","lieu secret","kobayashi lieu secret kobayashi"],[32.702547,131.300879,"Mitai","高千穂峡遊歩道","高千穂町","ChIJldjoLYgsRzURTkrGYZ3gs0E","💎","medium","lieu secret","mitai lieu secret 高千穂町"],[31.893184,130.832062,"Kirishima","丸尾滝","Kirishima","ChIJn9EiMFf8PjURH5FYtNAhpAg","💧","high","cascade","kirishima cascade kirishima"],[32.980272,129.945783,"Ōmura","松原本町","Ōmura","ChIJraZ75pIdQDUR8WlnHzZbuEE","💎","medium","lieu secret","ōmura lieu secret ōmura"],[32.74725,129.880158,"Pont Megane","Pont Megane","Nagasaki","","💎","medium","lieu secret","pont megane lieu secret nagasaki"],[33.084561,131.113931,"Route nationale 422","Route nationale 422","Minamioguni","","💎","medium","lieu secret","route nationale 422 lieu secret minamioguni"],[33.366726,130.033906,"Karatsu","相知町伊岐佐","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","💎","medium","lieu secret","karatsu lieu secret karatsu"],[33.367945,130.039741,"Karatsu","見帰りの滝","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","💧","high","cascade","karatsu cascade karatsu"],[33.368346,130.039982,"Karatsu","見帰りの滝","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","💧","high","cascade","karatsu cascade karatsu"],[32.147362,130.458906,"Minamata","葛渡","Minamata","ChIJdf1ouDajPzUR3glRW85Xu7w","💎","medium","lieu secret","minamata lieu secret minamata"],[32.605661,130.468821,"Uki","国道57号","宇城市","ChIJU1ZaB0h9QDURzNO2fS2fgGg","💎","medium","lieu secret","uki lieu secret 宇城市"],[32.622025,130.45589,"Uki","三角町三角浦","宇城市","ChIJU1ZaB0h9QDURzNO2fS2fgGg","💎","medium","lieu secret","uki lieu secret 宇城市"],[33.385393,130.453419,"Tosu","九千部山横断線","Tosu","ChIJI_qv_z6jQTURHQU9n5mrTx0","🗻","high","montagne","tosu montagne tosu"],[33.778306,130.47018,"Fukutsu","宮司浜四丁目","Fukutsu","ChIJHapY68UoQjURxwDORGkfy2g","💎","medium","lieu secret","fukutsu lieu secret fukutsu"],[31.937577,131.424249,"Miyazaki","宮崎神宮徴古館","Miyazaki","ChIJe6Jox_a1ODURfe54GDviTA0","💎","medium","lieu secret","miyazaki lieu secret miyazaki"],[33.946257,130.963085,"Kitakyūshū","国道198号","Kitakyūshū","ChIJqW1jSWjHQzUR5zh-KTC5ijg","💎","medium","lieu secret","kitakyūshū lieu secret kitakyūshū"],[32.280449,131.453149,"Tsuno","Tsuno","Tsuno","","💎","medium","lieu secret","tsuno lieu secret tsuno"],[32.899581,131.087646,"Aso","Aso","Aso","","💎","medium","lieu secret","aso lieu secret aso"],[31.180613,130.528734,"Chemin d'ascension au mont Kaimon","Chemin d'ascension au mont Kaimon","Ibusuki","","🗻","high","montagne","chemin d'ascension au mont kaimon montagne ibusuki"],[32.780734,130.267404,"Unzen","田代原118林道","Unzen","ChIJr_wtvQYOQDURpV3lWbb-MLM","💎","medium","lieu secret","unzen lieu secret unzen"],[32.628886,131.578784,"Nobeoka","Nobeoka","Nobeoka","","💎","medium","lieu secret","nobeoka lieu secret nobeoka"],[33.13759,131.035728,"Kurobuchi","鍋ヶ滝","小国町","ChIJNSoqJiM8QTURrzEiryC72eM","💧","high","cascade","kurobuchi cascade 小国町"],[33.137606,131.035363,"Kurobuchi","鍋ヶ滝","小国町","ChIJNSoqJiM8QTURrzEiryC72eM","💧","high","cascade","kurobuchi cascade 小国町"],[31.901915,130.51847,"Satsumasendai","Satsumasendai","Satsumasendai","","💎","medium","lieu secret","satsumasendai lieu secret satsumasendai"],[32.988281,129.783414,"Saikai","長崎バイオパーク","Saikai","ChIJ_Qm4d1nOajURce5w8zX_ZyM","💎","medium","lieu secret","saikai lieu secret saikai"],[32.758352,129.946779,"Nagasaki","長崎ペンギン水族館","Nagasaki","ChIJZ9oYhFRMFTURk8wyyu2m94s","💎","medium","lieu secret","nagasaki lieu secret nagasaki"],[30.40702,130.432728,"Route Kamiyaku-Nagata-Yaku","Route Kamiyaku-Nagata-Yaku","Yakushima","","💎","medium","lieu secret","route kamiyaku-nagata-yaku lieu secret yakushima"],[33.606659,131.186432,"Nakatsu","中津城","Nakatsu","ChIJ1Xv9qgtYQTUR1kUz0pHaQng","🏯","medium","château","nakatsu château nakatsu"],[33.545642,129.90324,"Karatsu","呼子町小友","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","💎","medium","lieu secret","karatsu lieu secret karatsu"],[33.548901,129.931792,"Karatsu","七ツ釜","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","💎","medium","lieu secret","karatsu lieu secret karatsu"],[33.023968,129.660716,"Saikai","九州自然歩道(周回コース)","Saikai","ChIJ_Qm4d1nOajURce5w8zX_ZyM","💎","medium","lieu secret","saikai lieu secret saikai"],[33.546842,130.573476,"Umi","九州自然歩道","Chikushino","ChIJ_xMM6EqbQTURUVBQEZthQDg","💎","medium","lieu secret","umi lieu secret chikushino"],[33.619954,130.573,"Nanzoin lying Buddha","Nanzoin lying Buddha","篠栗町","","💎","medium","lieu secret","nanzoin lying buddha lieu secret 篠栗町"],[33.446174,129.994004,"Karatsu","虹の松原線","Karatsu","ChIJld_zhvZ4ajUR88P7B_O4EsY","💎","medium","lieu secret","karatsu lieu secret karatsu"],[31.912125,130.2235,"Satsumasendai","国道3号","Satsumasendai","ChIJw8NNiBgjPjURNdkDNOt8Akw","💎","medium","lieu secret","satsumasendai lieu secret satsumasendai"],[33.623313,130.305807,"Noko","Noko","Fukuoka","","💎","medium","lieu secret","noko lieu secret fukuoka"],[33.63149,130.301627,"Fukuoka","アイランドパーク チケット売り場","Fukuoka","ChIJKYSE6aHtQTURg4c5NplyCvY","💎","medium","lieu secret","fukuoka lieu secret fukuoka"],[33.296878,130.694262,"Yame","Yame","Yame","","💎","medium","lieu secret","yame lieu secret yame"],[31.62876,131.350566,"Nichinan","飫肥城","Nichinan","ChIJ7wvuoPDUODURbFkWNNFsmnI","🏯","medium","château","nichinan château nichinan"],[33.456878,129.816191,"Karatsu","Karatsu","Karatsu","","💎","medium","lieu secret","karatsu lieu secret karatsu"],[31.20003,130.825736,"Kinko","Kinko","Kinko","","💎","medium","lieu secret","kinko lieu secret kinko"],[31.186019,130.766339,"Minamiōsumi","国道269号","Minamiosumi","ChIJTWNML0gvPDUR2shMRCuZdo0","💎","medium","lieu secret","minamiōsumi lieu secret minamiosumi"],[33.199528,129.06191,"Ojika","中村郷","Odika","ChIJlw8e_k82azURQ8p7xxArYKc","💎","medium","lieu secret","ojika lieu secret odika"],[30.300053,130.413737,"Yakushima","大川の滝","Yakushima","ChIJad0NvhM8PTURgMhqCaxvraQ","💧","high","cascade","yakushima cascade yakushima"],[33.234958,129.893397,"Imari","黒髪山公園線","Imari","ChIJrU2uF9GGajURPNTCly4oH84","🌿","medium","parc","imari parc imari"],[33.234877,129.893526,"Imari","大川内山","Imari","ChIJrU2uF9GGajURPNTCly4oH84","🗻","high","montagne","imari montagne imari"],[30.299896,130.413727,"Yakushima","大川の滝","Yakushima","ChIJad0NvhM8PTURgMhqCaxvraQ","💧","high","cascade","yakushima cascade yakushima"],[32.663921,130.53216,"Uto","国道57号","Uto","ChIJG9WEX0RiQDURGsTFtlrDp70","💎","medium","lieu secret","uto lieu secret uto"],[32.378553,131.630593,"Hyūga","平岩","Hyūga","ChIJhX-q4tVGRzURKeNtNjUP0zQ","💎","medium","lieu secret","hyūga lieu secret hyūga"],[32.92008,129.93699,"Ōmura","森園町","Ōmura","ChIJraZ75pIdQDUR8WlnHzZbuEE","🌲","high","forêt","ōmura forêt ōmura"],[33.741892,129.643734,"Iki","郷ノ浦町大島","Iki","ChIJFeL09tUTajURPOys2KkduU4","💎","medium","lieu secret","iki lieu secret iki"],[32.363735,130.488702,"Ashikita","御立岬海水浴場","芦北町","ChIJt02yh4qbPzURdfTKG-mQHeo","💎","medium","lieu secret","ashikita lieu secret 芦北町"],[33.002709,129.956853,"Higashisonogi","里郷","東彼杵町","ChIJdYnzPYufajUR1I7EwJmDAns","💎","medium","lieu secret","higashisonogi lieu secret 東彼杵町"],[32.78213,131.321801,"Takachiho","高千穂町","高千穂町","ChIJnU15sYMrRzURpIV1AxSG7n8","💎","medium","lieu secret","takachiho lieu secret 高千穂町"],[32.685658,131.045336,"Yamato","国道218号","Yamato","ChIJrUdYKSLEQDURpnEIDpErTWI","💎","medium","lieu secret","yamato lieu secret yamato"],[33.218352,129.890345,"Arita","大木有田線","Arita","ChIJzWyEAxabajURt79lBlk-kLo","💎","medium","lieu secret","arita lieu secret arita"],[33.053228,129.757936,"Sasebo","西海橋","Saikai","ChIJT0H6gODcajURhFxirfPht7M","🌉","low","pont","sasebo pont saikai"],[32.118882,131.389555,"Saito","鬼の窟古墳","Saito","ChIJ5RFqt_GqODURqAV2PKd3srE","💎","medium","lieu secret","saito lieu secret saito"],[31.517103,131.381909,"Nichinan","Nichinan","Nichinan","","💎","medium","lieu secret","nichinan lieu secret nichinan"],[32.312237,130.026038,"Amakusa","崎津カトリック保育園","Amakusa","ChIJL8ffMC_oPzUROBKggFK90pg","💎","medium","lieu secret","amakusa lieu secret amakusa"],[32.172826,130.106976,"Nagashima","国道389号","Nagashima","ChIJWWwkP3rFPzURCWAyB9jzXck","💎","medium","lieu secret","nagashima lieu secret nagashima"],[33.251845,131.022937,"Hita","天瀬町桜竹","Hita","ChIJCfyvE1YVQTURew3P4XzYpjk","🌸","medium","cerisiers","hita cerisiers hita"],[33.252153,131.02306,"Hita","天瀬町桜竹","Hita","ChIJCfyvE1YVQTURew3P4XzYpjk","🌸","medium","cerisiers","hita cerisiers hita"],[33.638941,130.196587,"Itoshima","福岡志摩前原線","Itoshima","ChIJAY960vrnQTURDqzeTmlWlJE","💎","medium","lieu secret","itoshima lieu secret itoshima"],[33.639128,130.196791,"Itoshima","福岡志摩前原線","Itoshima","ChIJAY960vrnQTURDqzeTmlWlJE","💎","medium","lieu secret","itoshima lieu secret itoshima"],[31.591647,130.593446,"Nagisa lava trail","Nagisa lava trail","Kagoshima","","💎","medium","lieu secret","nagisa lava trail lieu secret kagoshima"],[33.624287,130.523505,"Central","中央一丁目","篠栗町","ChIJu5NKc0eEQTUREIazk32EKhw","💎","medium","lieu secret","central lieu secret 篠栗町"],[33.632675,130.503237,"Sasaguri","国道201号","篠栗町","ChIJw1IqKgKEQTURoY-A8JWyKBo","💎","medium","lieu secret","sasaguri lieu secret 篠栗町"],[31.882006,130.864549,"Kirishima","永池林道","Kirishima","ChIJn9EiMFf8PjURH5FYtNAhpAg","💎","medium","lieu secret","kirishima lieu secret kirishima"],[33.296438,129.681813,"Sasebo","吉井町草ノ尾","Sasebo","ChIJT0H6gODcajURhFxirfPht7M","💎","medium","lieu secret","sasebo lieu secret sasebo"],[32.790231,130.367025,"Shimabara","東堀端通り","Shimabara","ChIJb7ZS4L1sQDURMaD9TQA11-8","💎","medium","lieu secret","shimabara lieu secret shimabara"],[33.325798,130.214928,"Ogi","小城富士線","Ogi","ChIJjZusO-HMQTURF8UOzA9bdlM","🏯","medium","château","ogi château ogi"],[33.719259,130.438164,"Shingū","松の運河","Shingū","ChIJedpJmlOIQTURAKtHGiZ96Oo","💎","medium","lieu secret","shingū lieu secret shingū"],[33.417141,129.423438,"Hirado","平戸生月線","Hirado","ChIJcX87vZ76ajUR1RXhnECN2Fg","💎","medium","lieu secret","hirado lieu secret hirado"],[32.809679,130.904378,"Kawahara","滝","西原村","ChIJldECWHHoQDURbL-A2zS8mNA","💧","high","cascade","kawahara cascade 西原村"],[32.278595,131.443095,"Kawakita","尾鈴林道","Tsuno","ChIJ4U0-wUxbRzURrMfPbgFEwTw","💎","medium","lieu secret","kawakita lieu secret tsuno"],[32.01152,130.577199,"Isa","曽木の滝","Isa","ChIJzZfwzK2nPzUR1qjPvHyAu00","💧","high","cascade","isa cascade isa"],[32.011883,130.57699,"Isa","曽木の滝","Isa","ChIJzZfwzK2nPzUR1qjPvHyAu00","💧","high","cascade","isa cascade isa"],[32.888403,130.989116,"Kawayo","南阿蘇村","南阿蘇村","ChIJY2b49uneQDURCIh2zK0vJk4","💎","medium","lieu secret","kawayo lieu secret 南阿蘇村"],[32.87744,132.691401,"Ōtsuki","大月町","大月町","ChIJObJ4KEKtSDURsaePk3ZPggI","💎","medium","lieu secret","ōtsuki lieu secret 大月町"],[32.682601,130.150912,"Unzen","国道251号","Unzen","ChIJr_wtvQYOQDURpV3lWbb-MLM","💎","medium","lieu secret","unzen lieu secret unzen"],[32.701565,131.300469,"Mitai","貸しボート乗り場","高千穂町","ChIJldjoLYgsRzURTkrGYZ3gs0E","💎","medium","lieu secret","mitai lieu secret 高千穂町"],[32.709106,128.660886,"Gotō","国道384号","Gotô","ChIJ7Tt15Ip3FDURj3QIRriqxWs","💎","medium","lieu secret","gotō lieu secret gotô"],[31.456363,131.170174,"Kushima","大字高松","Kushima","ChIJieLpbtgsOTUR_-mvP7D7PtE","💎","medium","lieu secret","kushima lieu secret kushima"],[33.019997,130.17887,"Tara","太良町","太良町","ChIJg0fitSAjQDURbzfq_DL8geo","💎","medium","lieu secret","tara lieu secret 太良町"],[32.784391,131.322443,"Takachiho","高千穂町","高千穂町","ChIJnU15sYMrRzURpIV1AxSG7n8","💎","medium","lieu secret","takachiho lieu secret 高千穂町"],[32.790613,132.86305,"Tosashimizu","国道321号","Tosashimizu","ChIJgcGA7HA2TzUR1SjI6hBFzyI","💎","medium","lieu secret","tosashimizu lieu secret tosashimizu"],[34.291528,131.101297,"Nagato","Nagato","Nagato","","💎","medium","lieu secret","nagato lieu secret nagato"],[31.867861,130.793714,"Kirishima","Kirishima","Kirishima","","💎","medium","lieu secret","kirishima lieu secret kirishima"],[32.945053,130.110999,"Isahaya","多良岳公園線","Isahaya","ChIJD_hYzbgcQDURnFdIZKmOHig","🌿","medium","parc","isahaya parc isahaya"],[33.088313,129.976164,"Ureshino","国道34号","Ureshino","ChIJC-YJx8sgQDURdW4zhPYvroE","💎","medium","lieu secret","ureshino lieu secret ureshino"],[32.692269,130.266681,"Minamishimabara","西有家町長野","Minamishimabara","ChIJW6yI3rgLQDURd7Rp12x3tXs","💎","medium","lieu secret","minamishimabara lieu secret minamishimabara"],[32.692317,130.266446,"Minamishimabara","西有家町長野","Minamishimabara","ChIJW6yI3rgLQDURd7Rp12x3tXs","💎","medium","lieu secret","minamishimabara lieu secret minamishimabara"],[32.914204,129.698403,"Saikai","九州自然歩道","Saikai","ChIJ_Qm4d1nOajURce5w8zX_ZyM","💎","medium","lieu secret","saikai lieu secret saikai"],[32.914133,129.698334,"Saikai","九州自然歩道","Saikai","ChIJ_Qm4d1nOajURce5w8zX_ZyM","💎","medium","lieu secret","saikai lieu secret saikai"],[32.681685,130.993786,"Yamato","通潤橋 tsujunkyo bridge (aqueduct)","Yamato","ChIJrUdYKSLEQDURpnEIDpErTWI","🌉","low","pont","yamato pont yamato"],[33.756148,129.789292,"Iki","Iki","Iki","","💎","medium","lieu secret","iki lieu secret iki"],[32.996234,131.219224,"Yamaga","笹倉久住線","産山村","ChIJF1UfzwUyQTURxILMW4lgW2g","💎","medium","lieu secret","yamaga lieu secret 産山村"],[31.650639,131.466627,"Sanctuaire Udo","Sanctuaire Udo","Nichinan","","⛩️","low","sanctuaire","sanctuaire udo sanctuaire nichinan"],[33.666933,130.360413,"Fukuoka","潮見台","Fukuoka","ChIJKYSE6aHtQTURg4c5NplyCvY","💎","medium","lieu secret","fukuoka lieu secret fukuoka"],[33.297176,130.741453,"Ukiha","Ukiha","Ukiha","","💎","medium","lieu secret","ukiha lieu secret ukiha"],[33.096531,129.981433,"Ureshino","嬉野バスセンター","Ureshino","ChIJC-YJx8sgQDURdW4zhPYvroE","💎","medium","lieu secret","ureshino lieu secret ureshino"],[33.68284,130.432768,"Fukuoka","和白一丁目","Fukuoka","ChIJKYSE6aHtQTURg4c5NplyCvY","💎","medium","lieu secret","fukuoka lieu secret fukuoka"],[33.499974,131.171391,"Nakatsu","青の洞門","Nakatsu","ChIJ1Xv9qgtYQTUR1kUz0pHaQng","💎","medium","lieu secret","nakatsu lieu secret nakatsu"],[30.354714,130.501307,"Yakushima","Yakushima","Yakushima","","💎","medium","lieu secret","yakushima lieu secret yakushima"],[30.304842,130.575347,"Route Parc Yakushima-Awa","Route Parc Yakushima-Awa","Yakushima","","🌿","medium","parc","route parc yakushima-awa parc yakushima"],[32.923715,129.982302,"Ōmura","荒平町","Ōmura","ChIJraZ75pIdQDUR8WlnHzZbuEE","💎","medium","lieu secret","ōmura lieu secret ōmura"],[33.160993,130.403441,"Yanagawa","三尊預修板碑","Yanagawa","ChIJ60Wm9sFMQDURHGNQppJuHN0","💎","medium","lieu secret","yanagawa lieu secret yanagawa"],[33.583033,130.408535,"Fukuoka","柳橋連合市場","Fukuoka","ChIJKYSE6aHtQTURg4c5NplyCvY","🌉","low","pont","fukuoka pont fukuoka"],[33.324026,130.388684,"Tade","吉野ヶ里町","吉野ヶ里町","ChIJ8SQtylS3QTURvRG512AQQPE","💎","medium","lieu secret","tade lieu secret 吉野ヶ里町"],[26.170108,127.345792,"Aharen","阿波連","Tokashiki","ChIJg6tT_3lU5TQRTeaNh8hg-84","💎","medium","lieu secret","aharen lieu secret tokashiki"],[26.226529,127.292606,"Ama","阿真ビーチ","Zamami","ChIJ669DSOSs-jQRk44K5mVzBRU","💎","medium","lieu secret","ama lieu secret zamami"],[28.282957,129.368212,"Amami","林道赤房線","Uken","ChIJY0vV46u7HzURYeHGskw-YMI","💎","medium","lieu secret","amami lieu secret uken"],[28.43734,129.628084,"Tatsugo","Tatsugo","Tatsugo","","💎","medium","lieu secret","tatsugo lieu secret tatsugo"],[24.434782,123.817105,"Taketomi","Taketomi","Taketomi","","💎","medium","lieu secret","taketomi lieu secret taketomi"],[26.872942,128.264679,"Hedo","日本トレイル起終点","国頭村","ChIJVxY2qGVs5DQRTdmSLPunX98","💎","medium","lieu secret","hedo lieu secret 国頭村"],[26.694463,127.87797,"Bise","石川","本部町","ChIJ4R1VqCT65DQRrVo6Hz9b1kw","🌊","medium","rivière","bise rivière 本部町"],[24.937476,125.245253,"Hirara","池間大浦線","Miyakojima","ChIJ17XH3iRS9DQRC2jkmsvPkIQ","💎","medium","lieu secret","hirara lieu secret miyakojima"],[26.22294,127.308074,"Zamami","座間味港線","Zamami","ChIJyQooJShT5TQRFCnEt641oqk","💎","medium","lieu secret","zamami lieu secret zamami"],[26.325143,127.951388,"Uruma","勝連浜","Uruma","ChIJ1UiZizQJ5TQRBZnEpLVIlE0","💎","medium","lieu secret","uruma lieu secret uruma"],[24.838002,125.157235,"Miyakojima","Miyakojima","Miyakojima","","💎","medium","lieu secret","miyakojima lieu secret miyakojima"],[26.346226,126.885582,"Plage de Hate","Plage de Hate","Kumejima","","🏖️","medium","plage","plage de hate plage kumejima"],[24.063662,123.780004,"Hateruma","波照間一周道路","Taketomi","ChIJhaihQpr1YDQRbn_xn7o7uws","💎","medium","lieu secret","hateruma lieu secret taketomi"],[24.719364,125.468515,"Phare de Hennasaki","Phare de Hennasaki","Miyakojima","","💎","medium","lieu secret","phare de hennasaki lieu secret miyakojima"],[26.710658,128.186643,"Grande chute de Hiji","Grande chute de Hiji","国頭村","","💎","medium","lieu secret","grande chute de hiji lieu secret 国頭村"],[26.096602,127.690372,"Itoman","中庭","Itoman","ChIJF1gjUkhm5TQRIXljcKvPqxI","💎","medium","lieu secret","itoman lieu secret itoman"],[24.572274,124.298418,"Ishigaki","県道206号平野伊原間線","Ishigaki","ChIJq0cOLdAIXzQRh0xs3hItKtg","💎","medium","lieu secret","ishigaki lieu secret ishigaki"],[24.436684,123.777396,"Uehara","レストラン星の砂","Taketomi","ChIJ7VT7mjR-YDQR8Ns9dslldUc","💎","medium","lieu secret","uehara lieu secret taketomi"],[26.709597,127.825402,"Higashiemae","伊江島環状線","Ie","ChIJD6dI7M_65DQRwzJEQeZ5WbI","💎","medium","lieu secret","higashiemae lieu secret ie"],[24.334191,123.815775,"Taketomi","Taketomi","Taketomi","","💎","medium","lieu secret","taketomi lieu secret taketomi"],[24.375664,124.126268,"Ishigaki","Ishigaki","Ishigaki","","💎","medium","lieu secret","ishigaki lieu secret ishigaki"],[24.451952,124.140367,"Ishigaki","Ishigaki","Ishigaki","","💎","medium","lieu secret","ishigaki lieu secret ishigaki"],[24.320128,124.076871,"Taketomi","星砂浜","Taketomi","ChIJ_ah5HbV1YDQR1rIDXQEXghg","💎","medium","lieu secret","taketomi lieu secret taketomi"],[26.450274,127.852263,"Yaka","屋嘉","金武町","ChIJ8Qs5fKoF5TQRPRJ7XWxo5as","💎","medium","lieu secret","yaka lieu secret 金武町"],[26.330502,127.879679,"Uruma","門口のガー","Uruma","ChIJ1UiZizQJ5TQRBZnEpLVIlE0","💎","medium","lieu secret","uruma lieu secret uruma"],[27.06027,142.195098,"Chichijima","小港道路","Tokyo","ChIJqbKmM1zF8GARtgQHESspdzs","💎","medium","lieu secret","chichijima lieu secret tokyo"],[24.325477,124.077205,"Taketomi","環状線","Taketomi","ChIJ_ah5HbV1YDQR1rIDXQEXghg","💎","medium","lieu secret","taketomi lieu secret taketomi"],[26.694579,128.021014,"Kouri","古宇利","Nakijin","ChIJN8GPYjRY5DQRJSrNKGHcQ-s","💎","medium","lieu secret","kouri lieu secret nakijin"],[24.333995,124.18897,"Ishigaki","ANAインターコンチネンタル石垣リゾート","Ishigaki","ChIJq0cOLdAIXzQRh0xs3hItKtg","💎","medium","lieu secret","ishigaki lieu secret ishigaki"],[26.503592,127.858915,"Onna","ANAインターコンチネンタル万座ビーチリゾート","恩納村","ChIJAcDKwmIE5TQRT9rJUE2ktmU","💎","medium","lieu secret","onna lieu secret 恩納村"],[26.134596,127.79138,"Nanjō","新原ビーチ","Nanjō","ChIJGfHjJ8Nx5TQRk3jRkMmxuHA","💎","medium","lieu secret","nanjō lieu secret nanjō"],[26.716968,128.218467,"Okuma","国頭村","国頭村","ChIJZXg_4HdD5DQRA0Q1NKclBTE","💎","medium","lieu secret","okuma lieu secret 国頭村"],[27.681804,142.133418,"Île du Gendre","Île du Gendre","Tokyo","","💎","medium","lieu secret","île du gendre lieu secret tokyo"],[26.437004,127.798045,"Nakadomari","シーキャプテン","恩納村","ChIJe7_3qaka5TQR9o7Maivkwnw","💎","medium","lieu secret","nakadomari lieu secret 恩納村"],[26.691385,127.928926,"Imadomari","史跡 今帰仁城跡","Nakijin","ChIJv4HPtLb55DQRegUPFFN-D5g","🏯","medium","château","imadomari château nakijin"],[26.201835,127.287475,"Nishibama Beach House","Nishibama Beach House","Zamami","","🏖️","medium","plage","nishibama beach house plage zamami"],[26.089821,127.706145,"Itoman","大度","Itoman","ChIJF1gjUkhm5TQRIXljcKvPqxI","💎","medium","lieu secret","itoman lieu secret itoman"],[26.129518,127.772496,"Nanjō","玉城奥武","Nanjō","ChIJGfHjJ8Nx5TQRk3jRkMmxuHA","🏯","medium","château","nanjō château nanjō"],[26.477639,127.833758,"Onna","恩納村","恩納村","ChIJAcDKwmIE5TQRT9rJUE2ktmU","💎","medium","lieu secret","onna lieu secret 恩納村"],[26.476957,127.834027,"Onna","おんなサンセット海道","恩納村","ChIJAcDKwmIE5TQRT9rJUE2ktmU","💎","medium","lieu secret","onna lieu secret 恩納村"],[24.426125,124.07741,"Ishigaki","林道屋良部線","Ishigaki","ChIJq0cOLdAIXzQRh0xs3hItKtg","💎","medium","lieu secret","ishigaki lieu secret ishigaki"],[26.429623,127.775259,"Yamada","琉球村","恩納村","ChIJx5kX7XEQ5TQR5dHABMEIIlE","💎","medium","lieu secret","yamada lieu secret 恩納村"],[26.172211,127.82657,"Nanjō","国道331号","Nanjō","ChIJGfHjJ8Nx5TQRk3jRkMmxuHA","💎","medium","lieu secret","nanjō lieu secret nanjō"],[24.720187,125.340663,"Miyakojima","シギラビーチ","Miyakojima","ChIJmaOR-ddT9DQRpjdmdGLP90U","💎","medium","lieu secret","miyakojima lieu secret miyakojima"],[26.203941,127.715285,"Naha","県道222号真地泉崎線","Naha","ChIJi7WmQXFp5TQRmF5YFvav2Cw","💎","medium","lieu secret","naha lieu secret naha"],[24.839486,125.280679,"Hirara","県道83号保良西里線","Miyakojima","ChIJ17XH3iRS9DQRC2jkmsvPkIQ","💎","medium","lieu secret","hirara lieu secret miyakojima"],[26.336163,126.824015,"Kumejima","バーデハウス (Bade Haus)","Kumejima","ChIJXeE0i_y55DQRoQ6nRIinLyU","💎","medium","lieu secret","kumejima lieu secret kumejima"],[26.365778,127.737014,"Toguchi","渡具知","Yomitan","ChIJIeCm0eMT5TQR36r2LdsGz3E","💎","medium","lieu secret","toguchi lieu secret yomitan"],[26.185736,127.34756,"Tokashiki","渡嘉敷港線","Tokashiki","ChIJY1u3ayJS5TQRrVL1fqyBFEQ","💎","medium","lieu secret","tokashiki lieu secret tokashiki"],[28.461722,129.718807,"Amami","子抱岩","Amami","ChIJY0vV46u7HzURYeHGskw-YMI","💎","medium","lieu secret","amami lieu secret amami"],[26.156457,127.647248,"Tomigusuku","Tomigusuku","Tomigusuku","","💎","medium","lieu secret","tomigusuku lieu secret tomigusuku"],[24.459823,123.018498,"Yonaguni","Yonaguni","Yonaguni","","💎","medium","lieu secret","yonaguni lieu secret yonaguni"],[24.435556,123.011183,"Yonaguni","与那国島海底地形","Yonaguni","ChIJUeN6dQpOZzQRMGVKahP5Or8","💎","medium","lieu secret","yonaguni lieu secret yonaguni"],[24.734933,125.263103,"Miyakojima","県道235号保良上地線","Miyakojima","ChIJmaOR-ddT9DQRpjdmdGLP90U","💎","medium","lieu secret","miyakojima lieu secret miyakojima"],[24.453794,124.185731,"Ishigaki","県道79号石垣港伊原間線","Ishigaki","ChIJq0cOLdAIXzQRh0xs3hItKtg","💎","medium","lieu secret","ishigaki lieu secret ishigaki"],[24.748517,125.442387,"Miyakojima","Miyakojima","Miyakojima","","💎","medium","lieu secret","miyakojima lieu secret miyakojima"],[38.040948,140.530328,"Shiroishi","宮城蔵王キツネ村","Shiroishi","ChIJRTlXkUJCil8RiIJS4NtRnXc","🏯","medium","château","shiroishi château shiroishi"]];


app.use(express.static('public'));

// IA : appel direct Anthropic Claude via fetch

// ── Cache suggestion-preview (mémoire serveur) ────────────────────────────
// Clé : nom normalisé de l'activité → évite les appels OpenAI répétés
// TTL : 24h (les infos touristiques ne changent pas)
const _suggestionCache = new Map();
const _SUGGESTION_TTL = 24 * 60 * 60 * 1000; // 24h en ms
function getCachedSuggestion(name) {
    const key = name.toLowerCase().trim();
    const entry = _suggestionCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > _SUGGESTION_TTL) { _suggestionCache.delete(key); return null; }
    return entry.data;
}
function setCachedSuggestion(name, data) {
    _suggestionCache.set(name.toLowerCase().trim(), { data, ts: Date.now() });
}

// Configuration OSRM (Gratuit)
const OSRM_BASE_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1';

// PROTOCOLE TRANSIT SAFE TIME V1
const CONFIG_SAFE_TIME = {
    BUFFER_DEPART_MIN: 7,
    COEFF_REALITE_JAPON: 1.25,
    ARRONDI_MULTIPLE: 5
};

function mustEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
}

async function fetchJson(url, options, timeoutMs = 9000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(url, { ...options, signal: ctrl.signal });
        clearTimeout(timer);
        const j = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, json: j };
    } catch(e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error('Timeout Google Places (' + timeoutMs + 'ms)');
        throw e;
    }
}

/**
 * Calcule la distance et la durée à pied via OSRM (Gratuit)
 */
async function getWalkingDirections(fromCoords, toCoords) {
    try {
        const url = `${OSRM_BASE_URL}/foot/${fromCoords.lng},${fromCoords.lat};${toCoords.lng},${toCoords.lat}?overview=false`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.code === "Ok") {
            const route = data.routes[0];
            return { distance: route.distance, duration: Math.round(route.duration / 60), success: true };
        }
        return { success: false, error: data.code };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Trouve les stations et arrêts de bus à proximité via Google Places
 */
async function getNearbyTransit(coords, serverKey) {
    try {
        const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
        url.searchParams.set("location", `${coords.lat},${coords.lng}`);
        url.searchParams.set("radius", "1000");
        url.searchParams.set("type", "transit_station");
        url.searchParams.set("key", serverKey);
        const resp = await fetchJson(url.toString());
        if (resp.json?.status === "OK") {
            return resp.json.results.slice(0, 8).map(r => ({
                name: r.name,
                coords: r.geometry.location,
                types: r.types
            }));
        }
        return [];
    } catch (e) {
        return [];
    }
}

// --- 1️⃣ PHASE IA : NORMALISATION TEXTE ---
app.post("/api/normalize-text", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "Texte manquant" });

        const completionText = await anthropicChat(
            `Tu es un expert en voyages au Japon. Réponds UNIQUEMENT avec du JSON brut valide, SANS backticks, SANS markdown, SANS texte avant ou après.\nFormat exact: {"title_clean":"Nom Propre — description courte","suggested_location":"Nom du lieu, Ville, Japan"}`,
            text, 200
        );

        let parsedNorm;
        try { parsedNorm = JSON.parse(completionText); }
        catch(e) { parsedNorm = { title_clean: text, suggested_location: text + ", Japan" }; }
        res.json(parsedNorm);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- 2️⃣ PHASE VALIDATION GOOGLE PLACES ---
app.get("/api/places/autocomplete", async (req, res) => {
    try {
        const key = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const q = String(req.query.q || "").trim();
        if (q.length < 2) return res.json({ predictions: [] });

        const u = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
        u.searchParams.set("input", q);
        u.searchParams.set("region", "jp");
        u.searchParams.set("language", "fr");
        u.searchParams.set("key", key);

        const r = await fetchJson(u.toString());
        res.json({ status: r.json.status, predictions: r.json.predictions || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/places/details", async (req, res) => {
    try {
        const key = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const placeId = String(req.query.place_id || "").trim();
        if (!placeId) return res.status(400).json({ ok: false, error: "missing place_id" });

        const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        u.searchParams.set("place_id", placeId);
        u.searchParams.set("fields", "place_id,name,formatted_address,geometry,opening_hours,current_opening_hours,price_level,types,editorial_summary,business_status,rating,user_ratings_total,photos");
        u.searchParams.set("language", "fr");
        u.searchParams.set("key", key);

        const r = await fetchJson(u.toString());
        if (r.json.status !== "OK") return res.json({ ok: false, status: r.json.status });

        const p = r.json.result;
        let opening_hours = p.current_opening_hours?.weekday_text || p.opening_hours?.weekday_text || null;
        let open_now      = p.current_opening_hours?.open_now ?? p.opening_hours?.open_now ?? null;
        let price_level   = p.price_level ?? null;
        let ai_hours      = false;
        // Note et avis directement depuis Google Maps (source la plus fiable)
        let rating        = p.rating ?? null;
        let review_count  = p.user_ratings_total ?? null;
        let visit_duration = null;
        let price_eur     = null;

        // ── Fallback OpenAI web search si Google n'a pas les horaires/prix ─
        const needsHours = !opening_hours;
        const needsPrice = price_level === null;
        if (needsHours || needsPrice) {
            try {
                const tokyoTime = new Date().toLocaleString('fr-FR', {timeZone: 'Asia/Tokyo'});
                const aiResText = await anthropicChat(
                    "Tu es un assistant de voyage expert au Japon. Cherche en mémoire les infos pratiques sur ce lieu japonais et réponds UNIQUEMENT en JSON valide.",
                    `Infos pour : "${p.name}", ${p.formatted_address || "Japon"}. Heure à Tokyo : ${tokyoTime}.\nIMPORTANT: prix ENTRÉE DIRECTE (pas visites guidées). Sources: site officiel, Japan-guide.com.\nRéponds UNIQUEMENT avec ce JSON :\n{\n  "opening_hours": ["Lundi: 06:00 - 17:00", ...] ou null,\n  "open_now": true/false/null,\n  "price_level": 0 si gratuit, 1 si <1000¥, 2 si 1000-2000¥, 3 si 2000-4000¥, 4 si >4000¥, null si inconnu,\n  "price_detail": "ex: 800¥ adulte" ou null,\n  "price_eur": 5.00 ou null,\n  "visit_duration": 90 ou null,\n  "booking_url": "https://..." ou null,\n  "booking_required": true/false\n}`,
                    600
                );
                const raw = aiResText?.trim();
                const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
                if (needsHours && parsed.opening_hours) opening_hours = parsed.opening_hours;
                if (parsed.open_now !== undefined && open_now === null) open_now = parsed.open_now;
                if (needsPrice && parsed.price_level !== undefined && parsed.price_level !== null) price_level = parsed.price_level;
                if (parsed.price_detail)    p._price_detail    = parsed.price_detail;
                if (parsed.price_eur)       price_eur          = parsed.price_eur;
                if (parsed.booking_url)     p._booking_url     = parsed.booking_url;
                if (parsed.booking_required !== undefined) p._booking_required = parsed.booking_required;
                if (parsed.visit_duration)  visit_duration     = parsed.visit_duration;
                ai_hours = true;
            } catch(aiErr) {
                console.warn("OpenAI search fallback failed:", aiErr.message);
            }
        }

        // Types d'espaces publics accessibles H24
        const publicTypes = ['neighborhood','sublocality','political','locality','geocode',
                             'natural_feature','park','street_address','route','intersection',
                             'premise','tourist_attraction','point_of_interest'];
        const isPublicSpace = (p.types || []).some(t => publicTypes.includes(t));
        // Si espace public sans horaires → H24
        if (isPublicSpace && !opening_hours && open_now === null) {
            opening_hours = ['Lundi: Ouvert 24h/24','Mardi: Ouvert 24h/24','Mercredi: Ouvert 24h/24',
                             'Jeudi: Ouvert 24h/24','Vendredi: Ouvert 24h/24','Samedi: Ouvert 24h/24',
                             'Dimanche: Ouvert 24h/24'];
            open_now = true;
            ai_hours = true;
        }

        res.json({
            ok: true,
            place: {
                place_id: p.place_id,
                name: p.name,
                formatted_address: p.formatted_address,
                lat: p.geometry?.location?.lat,
                lng: p.geometry?.location?.lng,
                opening_hours,
                open_now,
                price_level,
                price_detail:     p._price_detail     || null,
                price_eur:        price_eur          || null,
                booking_url:      p._booking_url     || null,
                booking_required: p._booking_required !== undefined ? p._booking_required : null,
                rating:           rating             || null,
                review_count:    review_count    || null,
                rating_source:   rating ? 'google' : null,
                visit_duration:  visit_duration  || null,
                types: p.types || [],
                ai_hours,
                photo_reference: p.photos?.[0]?.photo_reference || null
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- 3️⃣ GÉNÉRATION NAVIGATION (ENTRE ACTIVITÉS) ---
app.post('/api/route', async (req, res) => {
    try {
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const { from_place, to_place } = req.body;

        if (!from_place?.place_id || !to_place?.place_id) {
            throw new Error("Place IDs manquants pour le calcul.");
        }

        const fromCoords = { lat: from_place.lat, lng: from_place.lng };
        const toCoords = { lat: to_place.lat, lng: to_place.lng };

        // SCAN & MATRICE
        const [rawStationsFrom, rawStationsTo] = await Promise.all([
            getNearbyTransit(fromCoords, serverKey),
            getNearbyTransit(toCoords, serverKey)
        ]);

        const matrixFrom = await Promise.all(rawStationsFrom.map(async s => {
            const w = await getWalkingDirections(fromCoords, s.coords);
            return { ...s, walk_min: w.success ? w.duration : 999 };
        }));
        const matrixTo = await Promise.all(rawStationsTo.map(async s => {
            const w = await getWalkingDirections(toCoords, s.coords);
            return { ...s, walk_min: w.success ? w.duration : 999 };
        }));

        matrixFrom.sort((a, b) => a.walk_min - b.walk_min);
        matrixTo.sort((a, b) => a.walk_min - b.walk_min);

        const bestFrom = matrixFrom[0];
        const bestTo   = matrixTo[0];

        // Distance à vol d'oiseau entre les deux lieux (haversine)
        function haversineKm(a, b) {
            const R = 6371;
            const dLat = (b.lat - a.lat) * Math.PI / 180;
            const dLng = (b.lng - a.lng) * Math.PI / 180;
            const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2;
            return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
        }
        const distKm = haversineKm(fromCoords, toCoords).toFixed(1);

        // Durée OSRM à pied entre les deux lieux (pour détecter si tout est faisable à pied)
        const walkDirect = await getWalkingDirections(fromCoords, toCoords);
        const walkDirectMin = walkDirect.success ? walkDirect.duration : 999;

        // Si distance < 1.2km : tout à pied, pas de transit
        const useTransit = distKm > 1.2;

        const walkFrom = bestFrom?.walk_min || 3;
        const walkTo   = bestTo?.walk_min   || 3;

        let transit = 0;
        let mode = 'walk';
        let steps = '';

        if (!useTransit) {
            // Trajet entièrement à pied
            transit = 0;
            mode = 'walk';
            steps = `🚶 ${walkDirectMin}min`;
            const totalReal = walkDirectMin;
            return res.json({
                success: true,
                summary: steps,
                details: steps,
                total_minutes: totalReal,
                walk_from_min: walkDirectMin,
                transit_min: 0,
                walk_to_min: 0,
                mode: 'walk'
            });
        }

        // Trajet avec transit — demander à l'IA la durée du segment en transports
        const aiRouteText = await anthropicChat(`Tu es un expert des transports en commun au Japon (Tokyo, Kyoto, Osaka...).
On connait déjà les segments de marche. Tu dois UNIQUEMENT estimer la durée du trajet en transports entre deux stations.

Données :
- DÉPART : ${from_place.name}
- Station départ : ${bestFrom?.name ?? '?'} (${walkFrom}min à pied du départ)
- ARRIVÉE : ${to_place.name}  
- Station arrivée : ${bestTo?.name ?? '?'} (${walkTo}min à pied de l'arrivée)
- Distance directe : ${distKm} km

RÈGLE : transit_min = durée réelle en métro/train entre les deux stations (sans les marches).
Pour ${distKm}km au Japon, le transit typique est entre ${Math.round(distKm * 2)}min et ${Math.round(distKm * 4)}min selon les correspondances.
Si les deux stations sont sur la même ligne : moins de correspondances.
Si les stations sont différentes : ajouter 5-10min de correspondance.

Réponds UNIQUEMENT avec ce JSON :
{
  "transit_min": <int>,
  "mode": "metro|train|bus",
  "line_hint": "ex: Ginza Line direction Shibuya"
}`, `De "${bestFrom?.name}" à "${bestTo?.name}" pour aller de ${from_place.name} à ${to_place.name}.`, 400);


        const r = JSON.parse(aiRouteText);

        // Calcul arithmétique — serveur est maître du total
        transit = Math.max(1, parseInt(r.transit_min) || Math.round(distKm * 3));
        // Clamp transit entre 1 et 120min (sécurité anti-valeurs IA aberrantes)
        transit = Math.min(120, transit);
        mode    = r.mode || 'metro';
        const modeEmoji = { metro: '🚇', train: '🚄', bus: '🚌' }[mode] || '🚇';
        const totalReal = walkFrom + transit + walkTo;
        steps = `🚶 ${walkFrom}min + ${modeEmoji} ${transit}min + 🚶 ${walkTo}min`;

        res.json({
            success: true,
            summary: steps,
            details: steps,
            total_minutes: totalReal,
            walk_from_min: walkFrom,
            transit_min: transit,
            walk_to_min: walkTo,
            mode
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/health", async (req, res) => {
    try {
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const testPlaceId = "ChIJ51cu8IcbXWARiRtXIothAS4";
        const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        u.searchParams.set("place_id", testPlaceId);
        u.searchParams.set("key", serverKey);
        const p = await fetchJson(u.toString());
        res.json({ env_ok: !!serverKey, places_ok: p.json?.status === "OK", engine: "Master Pipeline V4" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- INFOS ACTIVITÉ AVEC IA ---
app.post("/api/activity-info", async (req, res) => {
    try {
        const { place_name, place_address, visit_time, traveler_profile: tp_info } = req.body;
        const profileCtxInfo = buildProfileContext(tp_info);
        
        if (!place_name) {
            return res.status(400).json({ error: "Nom du lieu manquant" });
        }

        const completionText = await anthropicChat(
            `Tu es un expert du tourisme au Japon. Réponds UNIQUEMENT avec un objet JSON valide, SANS markdown, SANS backticks, SANS texte autour.
Format exact attendu :
{"why_visit":"...","history_detail":"...","cultural_context":"...","crowd_level":"low|medium|high","best_times":["09:00-10:00"],"rules":["Règle 1"],"tips":"...","local_tip":"...","nearby_food":"..."}`,
            `${profileCtxInfo}Lieu: ${place_name}${place_address ? ", " + place_address : ""}. Heure de visite prévue: ${visit_time || "journée"}.`,
            600
        );

        let info;
        try {
            info = JSON.parse(completionText);
        } catch(parseErr) {
            console.error('[activity-info] JSON.parse error:', parseErr.message, '| raw:', completionText.slice(0, 200));
            // Fallback: construire un objet minimal depuis le texte brut
            info = {
                why_visit: `${place_name} est un lieu incontournable au Japon, riche en histoire et en culture.`,
                history_detail: '', cultural_context: '',
                crowd_level: 'medium', best_times: ['09:00-11:00', '15:00-17:00'],
                rules: [], tips: 'Arrivez tôt pour éviter la foule.',
                local_tip: '', nearby_food: ''
            };
        }
        res.json({ success: true, info });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});


// --- ASSISTANT PLANNING IA ---
app.post('/api/ai-planner', async (req, res) => {
    try {
        const { message, context } = req.body;
        if (!message) return res.status(400).json({ error: 'Message manquant' });

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return res.status(500).json({ success: false, error: 'Clé ANTHROPIC_API_KEY manquante dans .env' });

        const dayActsSummary = (context.dayActivities || []).map(a =>
            `- id:${a.id} "${a.title}" à ${a.time} (${a.duration_minutes||90}min) — ${a.place?.name || 'lieu ?'}`
        ).join('\n') || '(aucune activité)';

        const allDaysSummary = (context.allDays || []).map((d, i) =>
            `Jour ${i+1} [dayIndex:${i}]: ${d.label || ''} — ${d.count||0} activité(s)`
        ).join('\n') || '';

        const systemPrompt = `Tu es un assistant de voyage expert au Japon, intégré dans une app de planification.
Tu peux VRAIMENT modifier le planning : ajouter, déplacer, supprimer des activités.

PROGRAMME COMPLET :
${allDaysSummary}

JOUR ACTUEL (Jour ${(context.dayIndex||0)+1}, dayIndex:${context.dayIndex||0}) :
${dayActsSummary}

Ville(s) visitée(s) : ${context.cities?.join(', ') || context.city || 'Japon'}
Durée totale : ${context.totalDays||1} jour(s)

INSTRUCTIONS :
- Réponds TOUJOURS avec un JSON valide, SANS backticks.
- Format : {"reply":"message en français max 4 phrases","actions":[...]}
- Actions possibles :
  * Ajouter : {"type":"add","dayIndex":N,"title":"Nom lieu","search_query":"Nom lieu Ville Japan","time":"HH:MM","duration_minutes":N,"note":"conseil court"}
  * Déplacer : {"type":"move","activity_id":N,"new_time":"HH:MM"}
  * Supprimer : {"type":"remove","activity_id":N}
  * Rien : actions:[]
- Si l'utilisateur dit "oui" ou confirme, EXECUTE les actions proposées dans le message précédent.
- Si l'utilisateur demande d'ajouter des activités sur un autre jour, utilise le bon dayIndex.
- Propose max 3 activités à la fois.
- Utilise des lieux japonais réels avec leur nom en japonais entre parenthèses.
- Ne promets JAMAIS d'ajouter si tu ne mets pas l'action correspondante dans "actions".`;

        const history = (context.history || []).slice(-8).map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
        }));

        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 800,
                system: systemPrompt,
                messages: [...history, { role: 'user', content: message }]
            })
        });

        const data = await r.json();
        if (!r.ok) return res.status(500).json({ success: false, error: data.error?.message || 'Erreur Anthropic' });

        const raw = data.content?.[0]?.text || '{}';
        let parsed;
        try {
            parsed = JSON.parse(sanitizeJson(raw));
        } catch(e) {
            // Fallback : texte pur sans actions
            parsed = { reply: raw.replace(/\{[\s\S]*\}/g, '').trim() || raw, actions: [] };
        }

        // ── Résoudre les lieux via Google Places pour chaque action "add" ──
        const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
        const resolvedActions = [];
        for (const action of (parsed.actions || [])) {
            if (action.type === 'add' && serverKey) {
                try {
                    const query = action.search_query || action.title;
                    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
                    searchUrl.searchParams.set('query', query);
                    searchUrl.searchParams.set('language', 'fr');
                    searchUrl.searchParams.set('key', serverKey);
                    const placesRes = await fetchJson(searchUrl.toString(), {}, 6000);
                    const first = placesRes.json?.results?.[0];
                    if (first) {
                        action.place = {
                            place_id: first.place_id,
                            name: first.name,
                            formatted_address: first.formatted_address,
                            lat: first.geometry?.location?.lat,
                            lng: first.geometry?.location?.lng,
                            types: first.types || [],
                            rating: first.rating || null,
                            user_ratings_total: first.user_ratings_total || 0,
                            photo_reference: first.photos?.[0]?.photo_reference || null,
                            rating_source: 'google'
                        };
                    }
                } catch(e) {
                    console.warn('[ai-planner] place resolve failed:', e.message);
                }
            }
            resolvedActions.push(action);
        }

        res.json({ success: true, reply: parsed.reply || '', actions: resolvedActions });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- MÉTÉO ---
app.get("/api/weather", async (req, res) => {
    try {
        const { lat, lng, date } = req.query;
        const weatherKey = process.env.OPENWEATHER_API_KEY;
        
        if (!weatherKey) {
            return res.json({ success: false, error: "Clé OpenWeather manquante" });
        }
        
        if (!lat || !lng) {
            return res.json({ success: false, error: "Coordonnées manquantes" });
        }
        
        // API OpenWeather One Call
        const url = new URL("https://api.openweathermap.org/data/3.0/onecall");
        url.searchParams.set("lat", lat);
        url.searchParams.set("lon", lng);
        url.searchParams.set("appid", weatherKey);
        url.searchParams.set("units", "metric");
        url.searchParams.set("lang", "fr");
        url.searchParams.set("exclude", "minutely,alerts");
        
        const response = await fetchJson(url.toString());
        
        if (!response.json) {
            return res.json({ success: false, error: "Erreur API météo" });
        }
        
        const weather = response.json;
        
        // Extraire les données pertinentes
        const forecast = {
            current: {
                temp: Math.round(weather.current?.temp || 0),
                feels_like: Math.round(weather.current?.feels_like || 0),
                humidity: weather.current?.humidity || 0,
                description: weather.current?.weather?.[0]?.description || '',
                icon: weather.current?.weather?.[0]?.icon || '',
                rain: weather.current?.rain?.['1h'] || 0,
                is_raining: (weather.current?.rain?.['1h'] || 0) > 0
            },
            daily: weather.daily?.slice(0, 7).map(day => ({
                date: new Date(day.dt * 1000).toLocaleDateString('fr-FR'),
                temp_max: Math.round(day.temp.max),
                temp_min: Math.round(day.temp.min),
                description: day.weather[0].description,
                icon: day.weather[0].icon,
                rain_probability: Math.round((day.pop || 0) * 100),
                rain_mm: day.rain || 0,
                is_rainy: (day.pop || 0) > 0.3 // Plus de 30% de chance de pluie
            })) || []
        };
        
        res.json({ success: true, forecast });
        
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- AJOUT RAPIDE IA ---
app.post("/api/quick-add-activity", async (req, res) => {
    try {
        const { description, day_index, time_flexible, fixed_time } = req.body;
        
        // Analyser avec l'IA
        const completionText = await anthropicChat(`Tu es un expert du tourisme au Japon. Analyse l'activité et retourne un JSON:
{
  "title": "Titre propre de l'activité",
  "description": "Description courte (1 phrase)",
  "search_query": "Requête Google Places précise pour trouver le lieu",
  "suggested_time": "09:00",
  "duration_minutes": 90,
  "duration_reason": "Raison courte ex: temple + jardins nécessitent 1h30 min"
}
Pour duration_minutes: base-toi sur les recommandations réelles (TripAdvisor, guides). Ex: Senso-ji=90min, Tsukiji=60min, Fushimi Inari=150min, musée=120min, marché=45min.`, `Activité: "${description}"\n\nCrée une activité structurée avec la durée de visite recommandée.`, 400);


        let parsed;
        try { parsed = JSON.parse(completionText); }
        catch(e) {
            console.error('[activity-analyze] JSON.parse error:', e.message, '| raw:', completionText.slice(0,200));
            parsed = { title: description, description: '', search_query: description + ' Japan', suggested_time: '10:00', duration_minutes: 90, duration_reason: '' };
        }

        // Rechercher le lieu sur Google Places
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
        searchUrl.searchParams.set("query", parsed.search_query);
        searchUrl.searchParams.set("key", serverKey);
        
        const placesRes = await fetchJson(searchUrl.toString());
        
        if (!placesRes.json?.results?.[0]) {
            return res.json({ success: false, error: "Lieu non trouvé" });
        }
        
        const firstResult = placesRes.json.results[0];
        
        // Obtenir les détails
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.set("place_id", firstResult.place_id);
        detailsUrl.searchParams.set("fields", "place_id,name,formatted_address,geometry,opening_hours,price_level,types,photos,rating");
        detailsUrl.searchParams.set("language", "fr");
        detailsUrl.searchParams.set("key", serverKey);
        
        const detailsRes = await fetchJson(detailsUrl.toString());
        const place = detailsRes.json?.result;
        
        if (!place) {
            return res.json({ success: false, error: "Détails du lieu non disponibles" });
        }
        
        res.json({
            success: true,
            activity: {
                title: parsed.title,
                description: parsed.description,
                suggested_time: time_flexible ? null : (fixed_time || parsed.suggested_time),
                duration_minutes: parsed.duration_minutes || 90,
                duration_reason: parsed.duration_reason || '',
                place: {
                    place_id: place.place_id,
                    name: place.name,
                    formatted_address: place.formatted_address,
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng,
                    opening_hours: place.opening_hours?.weekday_text || null,
                    open_now: place.opening_hours?.open_now ?? null,
                    price_level: place.price_level ?? null,
                    types: place.types || [],
                    photo_reference: place.photos?.[0]?.photo_reference || null,
                    rating: place.rating || null,
                    user_ratings_total: place.user_ratings_total || null
                }
            }
        });
        
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- FICHE SUGGESTION IA ---
app.post("/api/suggestion-preview", async (req, res) => {
    try {
        const { name, query, existing_activities } = req.body;

        // ── Vérifier le cache serveur d'abord ──────────────────────────
        const cached = getCachedSuggestion(name);
        if (cached) {
            console.log(`[cache HIT] suggestion-preview: ${name}`);
            return res.json({ success: true, ...cached, _cached: true });
        }
        console.log(`[cache MISS] suggestion-preview: ${name} — appel OpenAI`);

        const activitiesContext = (existing_activities || [])
            .map(a => `${a.time} - ${a.title}`)
            .join('\n') || 'Aucune activité planifiée';

        const completionText = await anthropicChat(
            `Tu es un expert du tourisme au Japon. Réponds UNIQUEMENT avec du JSON brut valide, SANS backticks, SANS markdown, SANS texte avant ou après.
Format exact: {"why_visit":"...","best_time":"...","duration_minutes":90,"crowd_level":"low|medium|high","price_eur":null,"tips":"...","energy_level":"légère|modérée|intense"}`,
            `Activité : "${name}" (${query})`,
            400
        );

        let preview;
        try {
            preview = JSON.parse(completionText);
        } catch(e) {
            console.error('[suggestion-preview] JSON.parse error:', e.message, '| raw:', completionText.slice(0,200));
            preview = { why_visit: `${name} est un lieu incontournable.`, best_time: '09:00', duration_minutes: 90, crowd_level: 'medium', price_eur: null, tips: '', energy_level: 'modérée' };
        }

        // Rechercher le lieu sur Google Places pour avoir le place_id
        const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
        const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
        searchUrl.searchParams.set("query", query);
        searchUrl.searchParams.set("key", serverKey);
        const placesRes = await fetchJson(searchUrl.toString());
        const firstResult = placesRes.json?.results?.[0];

        let place = null;
        if (firstResult) {
            const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
            detailsUrl.searchParams.set("place_id", firstResult.place_id);
            detailsUrl.searchParams.set("fields", "place_id,name,formatted_address,geometry,opening_hours,price_level,types,photos,rating");
            detailsUrl.searchParams.set("language", "fr");
            detailsUrl.searchParams.set("key", serverKey);
            const detailsRes = await fetchJson(detailsUrl.toString());
            const p = detailsRes.json?.result;
            if (p) {
                place = {
                    place_id: p.place_id,
                    name: p.name,
                    formatted_address: p.formatted_address,
                    lat: p.geometry?.location?.lat,
                    lng: p.geometry?.location?.lng,
                    opening_hours: p.opening_hours?.weekday_text || null,
                    open_now: p.opening_hours?.open_now ?? null,
                    price_level: p.price_level ?? null,
                    types: p.types || []
                };
            }
        }

        // ── Mettre en cache serveur ────────────────────────────────────
        setCachedSuggestion(name, { preview, place });
        res.json({ success: true, preview, place });
    } catch (e) {
        console.error("suggestion-preview error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- OPTIMISATION JOURNÉE ---
// ── GÉNÉRATION DE PROGRAMME COMPLET ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE SERVEUR — 5 solutions intégrées sans conflit
// Ordre d'exécution : S2 → S1(+S5) → S4 → S3(merge) → realTimes
// ═══════════════════════════════════════════════════════════════════════════

// ── S2 : Densité de ville + rayon pivot dynamique ─────────────────────────
const CITY_DENSITY_MAP = {
    // Ultra-dense : tout à 2 km, metro dense
    ultra_dense: ['tokyo','osaka','yokohama','nagoya','fukuoka','sapporo','kobe'],
    // Kyoto: sites dispersés sur 10+ km (Arashiyama, Fushimi, Ohara) → étendue
    // Étendue : sites dispersés, bus/taxi nécessaires
    etendue: ['kyoto','nara','hiroshima','kanazawa','sendai','matsumoto','nikko','kamakura','takayama'],
    // Rurale : grands espaces, peu de transports
    rurale: ['hakone','miyajima','beppu','yakushima','shirakawago'],
};

// Couples incontournables — bypass du rayon, transit obligatoire dans le prompt
const INCONTOURNABLE_COUPLES = [
    { cities:['hiroshima','miyajima'],    transit_min:40,  note:'Ferry 15min + attente, prévoir 1h aller-retour' },
    { cities:['nara','horyuji'],          transit_min:30,  note:'Bus local depuis Nara JR, 15min' },
    { cities:['kyoto','uji'],             transit_min:35,  note:'Keihan ou JR, 20min depuis Kyoto' },
    { cities:['tokyo','nikko'],           transit_min:120, note:'Shinkansen+train, journée entière conseillée' },
    { cities:['osaka','kobe'],            transit_min:25,  note:'Hankyu ou JR, 25min' },
    { cities:['kanazawa','shirakawago'],  transit_min:75,  note:'Bus express Nohi, excursion demi-journée' },
];

function getCityDensity(zone) {
    const z = (zone || '').toLowerCase().replace(/[^a-z]/g, '');
    for (const [type, cities] of Object.entries(CITY_DENSITY_MAP)) {
        if (cities.some(c => z.includes(c) || c.includes(z))) {
            return {
                density_type: type,
                pivot_radius: type === 'ultra_dense' ? 2 : type === 'etendue' ? 5 : 10,
            };
        }
    }
    return { density_type: 'etendue', pivot_radius: 5 }; // fallback sûr
}

function findCouple(zone) {
    const z = (zone || '').toLowerCase().replace(/[^a-z]/g, '');
    return INCONTOURNABLE_COUPLES.find(c =>
        c.cities.some(city => z.includes(city))
    ) || null;
}

// ── S5 : Ordre de priorité des contraintes ────────────────────────────────
// Retourne un objet de filtres pour S1 (Places Nearby) et pour le prompt
function buildConstraints(profile, dayInfo, pivotCoords) {
    const constraints = {
        must_be_open_at: null,    // heure minimale d'ouverture
        avoid_types: [],          // types Places à éviter
        prefer_types: [],         // types Places à privilégier
        crowd_rules: [],          // règles foule pour le prompt
        max_transit_min: 25,      // cap transit par défaut
        priority_order: ['horaires','cap22h','foule','pace','budget','interet'],
    };

    // P1 : Horaires d'ouverture — contrainte physique absolue
    constraints.must_be_open_at = profile.startHour || '09:00';

    // P2 : Cap 22h — calculé dans realTimes, pas ici

    // P3 : Foule — horaires stricts si crowd=forte
    if (profile.crowd_sensitivity === 'forte') {
        constraints.crowd_rules.push('temples_before_0930');
        constraints.crowd_rules.push('museums_avoid_1014_weekend');
        constraints.crowd_rules.push('prefer_evening_local');
    }

    // P3b : Lundi → exclure musées (60% fermés au Japon)
    if (dayInfo?.isMonday) {
        constraints.avoid_types.push('museum');
        constraints.crowd_rules.push('no_museums_monday');
    }

    // P4 : Pace → transit max
    const transitByPace = { tranquille: 20, normal: 25, intense: 35 };
    constraints.max_transit_min = transitByPace[profile.pace || 'normal'];

    // P5 : Budget → filtrer activités payantes
    if (profile.budget === 'econome') {
        constraints.prefer_types.push('park','shrine','neighborhood','market');
        constraints.avoid_types.push('amusement_park');
    }

    // P6 : Intérêts → types prioritaires (si disponibles, pas obligatoires)
    const interestToType = {
        culture: ['temple','shrine','museum','castle'],
        nature: ['park','garden','mountain'],
        gastro: ['restaurant','market','food'],
        shopping: ['shopping_mall','store'],
        pop: ['theme_park','arcade'],
    };
    const interests = profile.interests || [];
    constraints.prefer_types.push(
        ...interests.flatMap(i => interestToType[i] || [])
    );

    return constraints;
}

// ── S1 : Validation géographique + remplacement (embarque S5) ─────────────
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function validateAndFixBlocks(blocks, pivotCoords, pivotRadius, constraints, apiKey) {
    if (!pivotCoords || !apiKey) return blocks; // pas de coords = pas de validation

    const validated = [];
    for (const blk of blocks) {
        // Garder repas, transits, hotel_start/end — valider uniquement les activités
        if (blk.type !== 'activity') { validated.push(blk); continue; }

        const blkCoords = blk.coordinates;
        if (!blkCoords?.lat || !blkCoords?.lng) {
            // Pas de coords IA → on garde (sera résolu par _resolveGeneratedActivities côté client)
            validated.push(blk); continue;
        }

        const dist = haversineKm(pivotCoords.lat, pivotCoords.lng, blkCoords.lat, blkCoords.lng);
        if (dist <= pivotRadius) {
            validated.push(blk); continue; // dans le rayon → OK
        }

        // Hors rayon → chercher un remplacement via Places Nearby
        const types = (blk.tags || []).join('|') || 'tourist_attraction';
        const avoidTypes = constraints.avoid_types || [];

        try {
            const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
            url.searchParams.set('location', `${pivotCoords.lat},${pivotCoords.lng}`);
            url.searchParams.set('radius', String(pivotRadius * 1000));
            url.searchParams.set('keyword', blk.search_query || blk.title || 'attraction touristique');
            url.searchParams.set('language', 'fr');
            url.searchParams.set('key', apiKey);

            const resp = await fetch(url.toString()).then(r => r.json());
            const results = (resp.results || []).filter(r =>
                !avoidTypes.some(t => (r.types || []).includes(t)) &&
                r.opening_hours?.open_now !== false // ouvert si info disponible
            );

            if (results.length > 0) {
                const best = results[0];
                // Remplacer le bloc hors-zone par le résultat nearest valide
                validated.push({
                    ...blk,
                    title: best.name,
                    search_query: best.name,
                    coordinates: {
                        lat: best.geometry.location.lat,
                        lng: best.geometry.location.lng
                    },
                    _replaced_geo: true, // flag pour debug
                });
            }
            // Si aucun résultat → supprimer silencieusement (mieux que garder une erreur)
        } catch(e) {
            // En cas d'erreur réseau → garder l'original (dégradé gracieux)
            validated.push(blk);
        }
    }
    return validated;
}

// ── S4 : Filtre activités complétées pour le recalcul ────────────────────
// Retourne { toKeep: [...], anchor: { time, position } }
function prepareRecalcPayload(activities, completedIds, currentTime, currentPosition) {
    const completed = activities.filter(a => completedIds.includes(a.id));
    const remaining = activities.filter(a => !completedIds.includes(a.id));

    // Ancrage = fin de la dernière activité complétée OU heure actuelle
    let anchorTime = currentTime;
    let anchorNote = 'position GPS actuelle';

    if (completed.length > 0) {
        const lastDone = completed.sort((a,b) => a.time.localeCompare(b.time)).pop();
        const endMin = timeToMin(lastDone.time) + (lastDone.duration_minutes || 90);
        anchorTime = minToTime(endMin);
        anchorNote = `fin de "${lastDone.title}"`;
    }

    return {
        remaining_activities: remaining,   // uniquement les non-complétées
        anchor_time: anchorTime,
        anchor_note: anchorNote,
        anchor_position: currentPosition,
        completed_count: completed.length,
    };
}

function timeToMin(t) { const [h,m]=(t||'00:00').split(':').map(Number); return h*60+m; }
function minToTime(m) { return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }

// ── S3 : MERGE (pas remplacement) des activités recalculées ───────────────
// Fix du conflit S3→S4 : on ne remplace pas activities[] côté client,
// on met à jour uniquement les times des activités non-complétées
function mergeRecalculatedActivities(existingActivities, recalcResult, completedIds) {
    const recalcMap = new Map(
        (recalcResult.updated_activities || []).map(a => [a.original_id || a.id, a])
    );

    return existingActivities.map(act => {
        // Activités complétées → ne jamais toucher
        if (completedIds.includes(act.id)) return act;
        // Activité recalculée → mettre à jour uniquement le time
        const updated = recalcMap.get(act.id);
        if (updated) {
            return { ...act, time: updated.time, time_flexible: true };
        }
        return act;
    });
    // NOTE : on ne push() pas de nouvelles activités ici — c'est voulu.
    // Le recalcul repositionne, il n'invente pas de nouveaux lieux.
}

// — fin pipeline solutions —


app.post("/api/generate-program", async (req, res) => {
    try {
        const { zone: zoneRaw, hotel_name, hotel_address, nb_days, start_day_index, start_date, intensity, existing_activities, traveler_profile, anchor_activity } = req.body;
        // Normaliser la zone : "Osaka, Préfecture d'Osaka, Japon" → "Osaka"
        // "Yao, Préfecture d'Osaka" → "Yao" (ville réelle, pas la métropole)
        const zone = zoneRaw ? zoneRaw.split(',')[0].trim() : '';
        const profileCtx = buildProfileContext(traveler_profile);
        if (!zone || !nb_days) return res.status(400).json({ success: false, error: 'Zone et nb_days requis' });

        const dayNames = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
        // ── Profils journée : activités réelles, horaires humains ──────────
        // Règle absolue : hotel_end <= 21:30, dîner <= 20:00, petit-déj >= 08:00
        const intensityProfiles = {
            relax:   { n: 2, mealDur: {breakfast:30,lunch:60,dinner:75}, startHour:'09:00', dinnerHour:'18:30', endHour:'20:30' },
            normal:  { n: 3, mealDur: {breakfast:25,lunch:50,dinner:65}, startHour:'08:30', dinnerHour:'19:00', endHour:'21:00' },
            intense: { n: 4, mealDur: {breakfast:20,lunch:40,dinner:60}, startHour:'08:00', dinnerHour:'19:30', endHour:'21:30' }
        };
        const profile = intensityProfiles[intensity||'normal'];
        const existingTitles = (existing_activities||[]).map(a=>(a.title||'').toLowerCase()).slice(0,10);

        // Règles transit selon zone
        const getTransitRules = (z) => {
            const zl = z.toLowerCase();
            if (zl.includes('tokyo')) return 'Tokyo: meme quartier=12min marche, adjacent=20min metro, eloigne=35min metro, heure pointe +12min';
            if (zl.includes('kyoto')) return 'Kyoto: centre=15min, Arashiyama=30min JR, Fushimi=15min Keihan, Nara=45min Kintetsu';
            return 'Calculer transit realiste point a point selon distance';
        };

        const getDayInfo = (i) => {
            const dayIdx = (start_day_index||0) + i;
            if (!start_date) return { index: dayIdx, name: 'Jour '+(i+1), isWeekend:false, isMonday:false, isFriday:false };
            // Parse en local (évite le décalage UTC)
            const [y,mo,dd] = start_date.split('T')[0].split('-').map(Number);
            const d = new Date(y, mo-1, dd);
            d.setDate(d.getDate() + dayIdx);
            const dow = d.getDay();
            return { index: dayIdx, name: dayNames[dow], isWeekend: dow===0||dow===6,
                     isMonday: dow===1, isFriday: dow===5, isSaturday: dow===6, isSunday: dow===0,
                     date: d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) };
        };

        // ── Génération jour par jour pour éviter troncature JSON ──────────────
        const allDays = [];
        let globalSummary = '';

        // S2 : densité + rayon + couple incontournable
        const cityDensity = getCityDensity(zone);
        const coupleInfo  = findCouple(zone);

        // Détecter les transitions de villes (Shinkansen) depuis les stays côté client
        // Note: le serveur ne connaît pas les stays, mais on peut le déduire de
        // start_day_index + nb_days si l'appel vient d'un jour de transition
        // Pour l'instant on laisse l'IA gérer avec la contrainte de pivot

        await Promise.all(Array.from({ length: nb_days }, async (_, di) => {
            const dayInfo = getDayInfo(di);

            // S5 : contraintes selon profil + jour
            const constraints = buildConstraints(traveler_profile || {}, dayInfo);

            const dayNote = dayInfo.isMonday ? 'LUNDI: INTERDIT musees (fermes). Parcs, quartiers, shopping, marches.' :
                            dayInfo.isSaturday ? 'SAMEDI: forte affluence, temples OBLIGATOIREMENT avant 9h30' :
                            dayInfo.isSunday ? 'DIMANCHE: familles dans les parcs, eviter grandes attractions 10h-15h' :
                            dayInfo.isFriday ? 'VENDREDI: affluence montante apres 14h, privilegier matin' :
                            'Semaine: creneaux ideaux 14h-17h pour musees';

            const crowdNote = constraints.crowd_rules.length > 0
                ? 'FOULE: '+constraints.crowd_rules.join(' · ')
                : '';

            const coupleNote = coupleInfo
                ? `EXCEPTION GEOGRAPHIQUE AUTORISEE: ${coupleInfo.cities.join('+')} sont un couple incontournable. Transit explicite: ${coupleInfo.transit_min}min. Note: ${coupleInfo.note}`
                : '';

            const anchorNote = anchor_activity
                ? `ACTIVITE ANCRE OBLIGATOIRE: Inclure ABSOLUMENT "${anchor_activity}" dans cette journee. Construire le quartier pivot autour de ce lieu. C'est la priorite numero 1.`
                : '';

            const prompt = `Expert voyages Japon. Genere 1 journee complete a ${zone} pour le ${dayInfo.name} (${dayInfo.date||'jour '+(di+1)}).
Hotel: ${hotel_name||'centre-ville'}${hotel_address?' ('+hotel_address+')':''}
Intensite: ${intensity||'normal'} — ${profile.n} activites culturelles
Note jour: ${dayNote}
${crowdNote}
${anchorNote}
${coupleNote}
Transits: ${getTransitRules(zone)}
Deja planifie (a eviter): ${existingTitles.join(', ')||'aucun'}

STRUCTURE OBLIGATOIRE (respecter EXACTEMENT ces horaires):
- hotel_start a ${profile.startHour}
- breakfast ${profile.startHour} (${profile.mealDur.breakfast}min) — konbini/kissaten
- MAX ${profile.n} activites culturelles dans la journee (pas plus)
- lunch autour de 12h30 (${profile.mealDur.lunch}min) — restaurant local
- dinner a ${profile.dinnerHour} (${profile.mealDur.dinner}min) — izakaya
- hotel_end a ${profile.endHour} MAX — LA JOURNEE FINIT ICI

CONTRAINTE GEOGRAPHIQUE ABSOLUE (PIVOT):
- Choisir 1 seul quartier principal pour TOUTE la journee
- Rayon max autour du quartier: ${cityDensity.pivot_radius} km (ville ${cityDensity.density_type})
- Transit max entre 2 activites consecutives: ${constraints.max_transit_min} min
- Jamais 2 quartiers distants de plus de 30 min dans la meme journee
${coupleNote ? '- Exception autorisee: voir EXCEPTION GEOGRAPHIQUE ci-dessus' : ''}
- Types a eviter: ${constraints.avoid_types.join(', ')||'aucun'}
- Types preferes: ${[...new Set(constraints.prefer_types)].slice(0,5).join(', ')||'selon interets'}

REGLES HORAIRES STRICTES:
- Premiere activite entre 09:00 et 10:00
- Dejeuner entre 12:00 et 13:30 MAX
- Derniere activite culturelle terminee avant 18:00
- Diner entre ${profile.dinnerHour} et 20:00 MAX
- Retour hotel avant ${profile.endHour}
- Durees realistes: temple 60-90min, musee 90-120min, parc 60min, quartier 90min
- Transits realistes: meme quartier 10-15min, adjacent 20-30min
- NE PAS depasser minuit, NE PAS placer activites apres 21h

${profileCtx}
REGLES:
- Grouper les activites par quartier (min de transit)
- Jamais 2 temples consecutifs
- 1 activite hors-touristes minimum
- Titres courts (max 30 chars)
- Notes courtes (max 60 chars)

JSON BRUT UNIQUEMENT (pas de markdown):
{
  "day_index": ${dayInfo.index},
  "day_label": "Quartier1 & Quartier2",
  "quartiers": ["Q1","Q2"],
  "blocks": [
    {"type":"hotel_start","time":"08:00","title":"Depart hotel","duration_minutes":0},
    {"type":"transit","time":"08:00","title":"Hotel vers Q1","duration_minutes":20,"from":"Hotel","to":"Q1","mode":"metro","note":"Ligne X"},
    {"type":"meal","meal_type":"breakfast","time":"08:20","title":"Konbini 7-Eleven","duration_minutes":15,"quartier":"Q1","suggestion":"Onigiri + cafe ~300Y","local_tip":"Manger devant le temple"},
    {"type":"transit","time":"08:35","title":"Marche vers A1","duration_minutes":5,"from":"Konbini","to":"A1","mode":"walk","note":""},
    {"type":"activity","time":"08:40","title":"Activite 1","search_query":"Activite 1 ${zone}","duration_minutes":80,"local_tip":"Conseil court","crowd_note":"Peu de monde avant 9h"},
    {"type":"transit","time":"10:00","title":"Metro vers Q2","duration_minutes":20,"from":"Q1","to":"Q2","mode":"metro","note":""},
    {"type":"activity","time":"10:20","title":"Activite 2","search_query":"Activite 2 ${zone}","duration_minutes":100,"local_tip":"Conseil court","crowd_note":""},
    {"type":"transit","time":"12:00","title":"Vers restaurant","duration_minutes":10,"from":"Q2","to":"Resto","mode":"walk","note":""},
    {"type":"meal","meal_type":"lunch","time":"12:10","title":"Dejeuner teishoku","duration_minutes":${profile.mealDur.lunch},"quartier":"Q2","suggestion":"Teishoku poisson+riz ~900Y","local_tip":"Eviter les rues principales"},
    {"type":"transit","time":"13:00","title":"Vers Q3","duration_minutes":15,"from":"Q2","to":"Q3","mode":"metro","note":""},
    {"type":"activity","time":"13:15","title":"Activite 3","search_query":"Activite 3 ${zone}","duration_minutes":90,"local_tip":"Conseil court","crowd_note":"Ideal apres 13h"},
    {"type":"transit","time":"18:00","title":"Vers diner","duration_minutes":20,"from":"Q3","to":"Quartier diner","mode":"metro","note":""},
    {"type":"meal","meal_type":"dinner","time":"18:20","title":"Diner izakaya","duration_minutes":${profile.mealDur.dinner},"quartier":"Quartier diner","suggestion":"Yakitori + biere ~2000Y","local_tip":"Comptoir face au chef"},
    {"type":"transit","time":"19:40","title":"Retour hotel","duration_minutes":20,"from":"Quartier diner","to":"Hotel","mode":"metro","note":""},
    {"type":"hotel_end","time":"20:00","title":"Retour hotel","duration_minutes":0}
  ]
}`;

            const raw = await anthropicChat(
                "Expert voyages Japon. Reponds UNIQUEMENT avec le JSON demande, SANS backticks, SANS texte avant ou apres. Utilise uniquement des guillemets doubles. Titres et notes en francais.",
                prompt, 3000
            );

            let dayParsed;
            try { dayParsed = JSON.parse(raw); }
            catch(e) {
                try { dayParsed = JSON.parse(sanitizeJson(raw)); }
                catch(e2) {
                    console.error(`Jour ${di+1} JSON invalide:`, e2.message, raw.slice(0,200));
                    // Fallback minimal pour ce jour
                    dayParsed = {
                        day_index: dayInfo.index,
                        day_label: zone,
                        quartiers: [zone],
                        blocks: [
                            {type:'hotel_start', time: profile.startHour, title:'Depart hotel', duration_minutes:0},
                            {type:'activity', time:'09:00', title:`Exploration ${zone}`, search_query:`tourist attractions ${zone}`, duration_minutes:180, local_tip:'Journee libre', crowd_note:''},
                            {type:'meal', meal_type:'lunch', time:'12:00', title:'Dejeuner local', duration_minutes:45, quartier:zone, suggestion:'Restaurant de quartier', local_tip:''},
                            {type:'activity', time:'14:00', title:`${zone} centre`, search_query:`${zone} center attractions`, duration_minutes:120, local_tip:'', crowd_note:''},
                            {type:'meal', meal_type:'dinner', time:'19:00', title:'Diner izakaya', duration_minutes:60, quartier:zone, suggestion:'Izakaya local', local_tip:''},
                            {type:'hotel_end', time:'20:30', title:'Retour hotel', duration_minutes:0}
                        ]
                    };
                }
            }

            // ── S1 : Validation géographique + S5 filtres ──────────────────
            if (dayParsed.blocks && hotel_address) {
                const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_PLACES_API_KEY || '';
                // Trouver le pivot = 1er bloc activity avec coordonnées
                const firstActWithCoords = dayParsed.blocks.find(b => b.type==='activity' && b.coordinates?.lat);
                if (firstActWithCoords && serverKey) {
                    const pivotCoords = firstActWithCoords.coordinates;
                    dayParsed.blocks = await validateAndFixBlocks(
                        dayParsed.blocks, pivotCoords, cityDensity.pivot_radius, constraints, serverKey
                    );
                }
            }

            // ── Validation et correction des horaires ──────────────────────
            if (dayParsed.blocks) {
                const END_LIMIT = 22 * 60; // 22:00 max
                const timeToMin = t => { const [h,m]=(t||'09:00').split(':').map(Number); return h*60+(m||0); };
                const minToTime = m => { const hh=Math.floor(m/60)%24, mm=m%60; return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0'); };
                // Compter activités réelles
                const actCount = dayParsed.blocks.filter(b=>b.type==='activity').length;
                const maxAct = profile.n + 1; // +1 tolérance
                if (actCount > maxAct) {
                    // Garder seulement les N meilleures (supprimer les dernières)
                    let kept = 0;
                    dayParsed.blocks = dayParsed.blocks.filter(b => {
                        if (b.type !== 'activity') return true;
                        kept++;
                        return kept <= maxAct;
                    });
                }
                // Couper les blocs après 21:30
                dayParsed.blocks = dayParsed.blocks.filter(b => timeToMin(b.time) < END_LIMIT);
            }

            // Forcer day_index correct — l'IA retourne souvent 0 quel que soit le jour
            dayParsed.day_index = Number(dayInfo.index);
            if (dayParsed.blocks) {
                dayParsed.blocks.forEach(b => { b.day_index = Number(dayInfo.index); });
            }
            allDays[di] = dayParsed;
            if (di === 0) globalSummary = `Programme ${nb_days} jour(s) a ${zone} — ${intensity||'normal'}`;
                }));
        res.json({ success: true, program: allDays, summary: globalSummary });

    } catch(e) {
        console.error('generate-program error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});


// ── RÉSOLUTION PLACE DIRECTE (sans IA, pour generate-program) ───────────────
app.post("/api/resolve-place", async (req, res) => {
    try {
        const { search_query, title } = req.body;
        const query = search_query || title;
        if (!query) return res.json({ success: false, error: "query manquant" });

        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");

        // ── Étape 1 : TextSearch (7s max) ─────────────────────────────────
        const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
        searchUrl.searchParams.set("query", query);
        searchUrl.searchParams.set("language", "fr");
        searchUrl.searchParams.set("key", serverKey);

        let first;
        try {
            const placesRes = await fetchJson(searchUrl.toString(), {}, 7000);
            first = placesRes.json?.results?.[0];
        } catch(e) {
            console.warn("[resolve-place] textsearch timeout:", query);
            return res.json({ success: false, error: "Timeout recherche" });
        }

        if (!first) return res.json({ success: false, error: "Lieu non trouvé: " + query });

        // ── Étape 2 : Details (6s max) — optionnel, fallback sur textsearch ─
        let place = null;
        try {
            const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
            detailsUrl.searchParams.set("place_id", first.place_id);
            detailsUrl.searchParams.set("fields", "place_id,name,formatted_address,geometry,opening_hours,price_level,types,rating,user_ratings_total,photos,website");
            detailsUrl.searchParams.set("language", "fr");
            detailsUrl.searchParams.set("key", serverKey);
            const detailsRes = await fetchJson(detailsUrl.toString(), {}, 6000);
            place = detailsRes.json?.result || null;
        } catch(e) {
            console.warn("[resolve-place] details timeout, fallback textsearch:", query);
        }

        // Fallback : construire depuis le résultat textsearch si details a échoué
        if (!place) {
            place = {
                place_id: first.place_id,
                name: first.name,
                formatted_address: first.formatted_address,
                geometry: first.geometry,
                types: first.types || [],
                rating: first.rating || null,
                user_ratings_total: first.user_ratings_total || 0,
                photos: first.photos || [],
                price_level: first.price_level ?? null,
                opening_hours: null
            };
        }

        const photo = place.photos?.[0]?.photo_reference || null;

        res.json({
            success: true,
            place: {
                place_id: place.place_id,
                name: place.name,
                formatted_address: place.formatted_address,
                lat: place.geometry?.location?.lat,
                lng: place.geometry?.location?.lng,
                opening_hours: place.opening_hours?.weekday_text || null,
                price_level: place.price_level ?? null,
                types: place.types || [],
                rating: place.rating || null,
                user_ratings_total: place.user_ratings_total || 0,
                photo_reference: photo,
                website: place.website || null,
                rating_source: 'google'
            }
        });
    } catch(e) {
        console.error("[resolve-place] error:", e.message);
        res.json({ success: false, error: e.message });
    }
});


app.post("/api/optimize-day", async (req, res) => {
    try {
        const { activities, day_index, hotel, traveler_profile: tp_opt } = req.body;
        const profileCtxOpt = buildProfileContext(tp_opt);

        const validActivities = activities.filter(a => a.place && a.place.name);
        if (validActivities.length === 0) {
            return res.status(400).json({ success: false, error: "Aucune activité avec lieu valide." });
        }

        const hotelName = hotel?.place?.name || hotel?.hotelName || null;
        const activitiesContext = validActivities.map(a => ({
            id: a.id,
            title: a.title,
            place: a.place.name,
            current_time: a.time,
            is_flexible: a.time_flexible !== false
        }));

        const dayDate = (() => {
            try {
                const d = new Date(req.body.start_date || Date.now());
                d.setDate(d.getDate() + (day_index || 0));
                return d;
            } catch(e) { return new Date(); }
        })();
        const dayOfWeek = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][dayDate.getDay()];
        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
        const fatigueMode = req.body.fatigue_mode || false;
        const weatherMode = req.body.weather_mode || false;

        // ── Prompt ultra-compact pour éviter la troncature JSON ──────────────
        const actListStr = activitiesContext.map(a =>
            '- id:' + a.id + ' "' + a.title + '" (' + a.place + ') a ' + a.current_time
        ).join('\n');
        const contexte = dayOfWeek
            + (isWeekend ? ' (weekend, affluence élevée)' : ' (semaine)')
            + (fatigueMode ? ' | Mode fatigue: reduire intensite, pause apres-midi' : '')
            + (weatherMode ? ' | Privilegier activites couvertes' : '')
            + (hotelName ? ' | Depart: ' + hotelName : '');
        const regles = 'Grouper par quartier, respecter horaires (musees fermes lundi), marges 15-25min, durees: temple 60-90min, musee 90-150min, resto 45min.'
            + (isWeekend ? ' Weekend: temples avant 9h ou apres 16h.' : '')
            + (fatigueMode ? ' Fatigue: -20% durees, pause 45min apres 13h.' : '');
        const prompt = 'Optimise cette journee au Japon. Reponds UNIQUEMENT en JSON brut valide.\n'
            + profileCtxOpt + '\n'
            + 'Contexte: ' + contexte + '\n\n'
            + 'Activites:\n' + actListStr + '\n\n'
            + regles + '\n\n'
            + 'REPONSE: JSON brut, ' + validActivities.length + ' objets dans optimized_activities.\n'
            + 'Format: {"optimized_activities":[{"id":NUM,"time":"HH:MM","duration_minutes":NUM,"breathing_after_minutes":NUM,"breathing_reason":"txt","reason":"txt","local_tip":"txt","time_changed":BOOL}],"day_summary":"txt","energy_level":"txt","warnings":[]}\n'
            + 'IMPORTANT: Inclure TOUTES les ' + validActivities.length + ' activites. Textes courts (<60 chars).\n';

        const completionText = await anthropicChat(
            "Expert Japon. JSON brut uniquement, SANS backticks ni markdown.",
            prompt, 4000);

        let result;
        try {
            result = JSON.parse(sanitizeJson(completionText));
        } catch(parseErr) {
            // Tentative de réparation : extraire le tableau optimized_activities même si JSON tronqué
            const arrMatch = completionText.match(/"optimized_activities"\s*:\s*(\[[\s\S]*)/);
            if (arrMatch) {
                try {
                    let partial = arrMatch[1];
                    // Fermer le tableau et l'objet si tronqué
                    const openBrackets = (partial.match(/\[/g)||[]).length - (partial.match(/\]/g)||[]).length;
                    const openBraces  = (partial.match(/\{/g)||[]).length - (partial.match(/\}/g)||[]).length;
                    for (let i=0; i<openBraces; i++) partial += '}';
                    for (let i=0; i<openBrackets; i++) partial += ']';
                    const repaired = `{"optimized_activities":${sanitizeJson(partial)},"day_summary":"","energy_level":"modérée","warnings":[]}`;
                    result = JSON.parse(repaired);
                    console.warn('[optimize-day] JSON réparé après troncature');
                } catch(e2) {
                    throw new Error(`JSON invalide : ${parseErr.message}`);
                }
            } else {
                throw new Error(`JSON invalide : ${parseErr.message}`);
            }
        }
        if (!result?.optimized_activities) throw new Error('Structure JSON inattendue');

        const optimizedWithFullData = result.optimized_activities.map(opt => {
            const original = validActivities.find(a => a.id === opt.id);
            if (!original) return null;
            return {
                id: opt.id,
                time: opt.time,
                title: original.title,
                description: original.description || '',
                place: original.place,
                reason: opt.reason || '',
                breathing_after_minutes: opt.breathing_after_minutes || 0,
                breathing_reason: opt.breathing_reason || '',
                duration_minutes: opt.duration_minutes || 90,
                time_changed: opt.time_changed || false
            };
        }).filter(Boolean);

        res.json({
            success: true,
            optimized_activities: optimizedWithFullData,
            day_summary: result.day_summary || '',
            energy_level: result.energy_level || ''
        });

    } catch (e) {
        console.error("optimize-day error:", e);
        // ── Fallback : retourner les activités non-modifiées plutôt que d'échouer ──
        // Permet au client d'afficher un mode édition pour que l'utilisateur reprenne
        const { activities } = req.body || {};
        const validFallback = (activities || []).filter(a => a.place && a.place.name);
        if (validFallback.length > 0) {
            console.warn('[optimize-day] Fallback: retour activités originales non optimisées');
            return res.json({
                success: false,
                partial: true,
                error: e.message,
                optimized_activities: validFallback.map(a => ({
                    id: a.id,
                    time: a.time,
                    title: a.title,
                    description: a.description || '',
                    place: a.place,
                    reason: '',
                    breathing_after_minutes: 0,
                    breathing_reason: '',
                    duration_minutes: a.duration_minutes || 60,
                    time_changed: false
                })),
                day_summary: '',
                energy_level: ''
            });
        }
        res.status(500).json({ success: false, error: e.message });
    }
});



// ── Proxy photo Google Places (évite CORS + cache navigateur) ──────────────
app.get('/api/place-photo', async (req, res) => {
    try {
        const key = mustEnv('GOOGLE_MAPS_SERVER_KEY');
        const ref = String(req.query.ref || '').trim();
        const maxw = Math.min(800, parseInt(req.query.maxw) || 400);
        if (!ref) return res.status(400).json({ error: 'missing ref' });

        const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxw}&photoreference=${ref}&key=${key}`;
        const r = await fetch(url);
        if (!r.ok) return res.status(r.status).send('Photo unavailable');

        // Cache 7 jours côté navigateur
        res.set('Cache-Control', 'public, max-age=604800');
        res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
        const buf = await r.arrayBuffer();
        res.send(Buffer.from(buf));
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Expose clé Maps navigateur au client ─────────────────────────────────
app.get('/api/maps-key', (req, res) => {
    const key = process.env.GOOGLE_MAPS_BROWSER_KEY || '';
    res.json({ key });
});


// ── Recherche restos proches pour slot machine repas ─────────────────────────
app.post('/api/nearby-food', async (req, res) => {
    try {
        const key = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_PLACES_API_KEY || '';
        if (!key) return res.json({ success:false, error:'No API key', results:[] });

        const { lat, lng, food_query, meal_type } = req.body || {};
        if (!lat || !lng) return res.json({ success:false, error:'Missing coords', results:[] });

        // Type de recherche selon le repas
        const placeType = (meal_type==='breakfast') ? 'cafe|bakery|restaurant' : 'restaurant|izakaya|food';
        const keyword   = food_query || (meal_type==='breakfast' ? 'breakfast cafe morning' : 'restaurant');
        const radius    = 800; // ~10 min à pied

        const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
        url.searchParams.set('location', `${lat},${lng}`);
        url.searchParams.set('radius', String(radius));
        url.searchParams.set('keyword', keyword);
        url.searchParams.set('language', 'ja');
        url.searchParams.set('key', key);

        const resp = await fetchJson(url.toString());
        if (resp.json?.status !== 'OK' && resp.json?.status !== 'ZERO_RESULTS') {
            return res.json({ success:false, error: resp.json?.status, results:[] });
        }

        const raw = (resp.json?.results || []).slice(0, 5);
        const results = raw.map(r => ({
            name:        r.name,
            address:     r.vicinity,
            rating:      r.rating || null,
            review_count: r.user_ratings_total || 0,
            photo_reference: r.photos?.[0]?.photo_reference || null,
            place_id:    r.place_id,
            lat:         r.geometry?.location?.lat,
            lng:         r.geometry?.location?.lng,
            open_now:    r.opening_hours?.open_now ?? null,
        }));

        res.json({ success:true, results });
    } catch(e) {
        res.status(500).json({ success:false, error:e.message, results:[] });
    }
});


// ── Recalcul depuis position actuelle (S3+S4) ──────────────────────────────
app.post('/api/recalculate-day', async (req, res) => {
    try {
        const { activities, completed_ids, current_time, anchor_note, traveler_profile, zone } = req.body;
        if (!activities?.length) return res.json({ success:false, error:'no activities' });

        // S4 : séparer complétées / restantes
        const completedIds = completed_ids || [];
        const { remaining_activities, anchor_time } = prepareRecalcPayload(
            activities, completedIds, current_time || '09:00', null
        );

        if (!remaining_activities.length) {
            return res.json({ success:true, updated_activities:[], message:'Toutes les activités sont complétées' });
        }

        // S2 : densité ville pour le contexte
        const cityDensity = getCityDensity(zone || '');
        // S5 : contraintes profil
        const constraints = buildConstraints(traveler_profile || {}, {});

        // Réordonner les restantes depuis l'ancrage
        const timeToMin = t => { const [h,m]=(t||'09:00').split(':').map(Number); return h*60+(m||0); };
        const minToTime = m => String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');

        let cursor = timeToMin(anchor_time);
        const updated = remaining_activities.map(act => {
            const newTime = minToTime(Math.min(cursor, 22*60-1));
            cursor += (act.duration_minutes || 90) + constraints.max_transit_min;
            return { ...act, original_id: act.id, time: newTime };
        }).filter(act => timeToMin(act.time) < 22*60);

        res.json({ success:true, updated_activities: updated, anchor_time, anchor_note });
    } catch(e) {
        res.status(500).json({ success:false, error:e.message });
    }
});


// ── Pépites secrètes à proximité ─────────────────────────────────────────
app.post('/api/nearby-pepites', async (req, res) => {
    try {
        const { lat, lng, radius_km = 15, limit = 8 } = req.body;
        if (!lat || !lng) return res.status(400).json({ success:false, error:'lat/lng requis' });
        const results = [];
        for (const p of LIEUX_DB) {
            const d = haversineKm(lat, lng, p[0], p[1]);
            if (d <= radius_km) {
                results.push({
                    lat: p[0], lon: p[1],
                    nom_fr: p[2], nom_jp: p[3],
                    ville: p[4], place_id: p[5]||null,
                    emoji: p[6], fatigue: p[7],
                    type_fr: p[8]||'lieu secret',
                    distance_km: Math.round(d*10)/10,
                    maps_url: `https://www.google.com/maps/search/?api=1&query=${p[0]},${p[1]}`
                });
            }
        }
        results.sort((a,b) => a.distance_km - b.distance_km);
        res.json({ success:true, pepites: results.slice(0,limit), total_nearby: results.length });
    } catch(e) {
        res.status(500).json({ success:false, error: e.message });
    }
});

app.listen(port, () => console.log(`✅ Serveur prêt sur http://localhost:${port}`));
