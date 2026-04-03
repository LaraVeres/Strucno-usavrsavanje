const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, VerticalAlign, ShadingType
} = require('docx');

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

// ── Supabase ──────────────────────────────────────────────────
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

app.get("/", (req, res) => {
    res.json({ status: "Backend radi sa Supabase bazom" });
});

// ── Helpers ───────────────────────────────────────────────────
function toCyrillic(text) {
    if (!text) return text;
    const digraphs = [
        ["Lj", "Љ"], ["LJ", "Љ"], ["lj", "љ"], ["Nj", "Њ"], ["NJ", "Њ"], ["nj", "њ"],
        ["Dž", "Џ"], ["DŽ", "Џ"], ["dž", "џ"], ["Dz", "Ѕ"], ["DZ", "Ѕ"], ["dz", "ѕ"],
        ["Dj", "Ђ"], ["DJ", "Ђ"], ["dj", "ђ"], ["Sh", "Ш"], ["SH", "Ш"], ["sh", "ш"],
        ["Š", "Ш"], ["š", "ш"], ["Ch", "Ч"], ["CH", "Ч"], ["ch", "ч"],
        ["Č", "Ч"], ["č", "ч"], ["Ć", "Ћ"], ["ć", "ћ"], ["Zh", "Ж"], ["ZH", "Ж"], ["zh", "ж"],
    ];
    const singles = {
        "A": "А", "B": "Б", "C": "Ц", "D": "Д", "E": "Е", "F": "Ф", "G": "Г", "H": "Х",
        "I": "И", "J": "Ј", "K": "К", "L": "Л", "M": "М", "N": "Н", "O": "О", "P": "П",
        "R": "Р", "S": "С", "T": "Т", "U": "У", "V": "В", "Z": "З",
        "a": "а", "b": "б", "c": "ц", "d": "д", "e": "е", "f": "ф", "g": "г", "h": "х",
        "i": "и", "j": "ј", "k": "к", "l": "л", "m": "м", "n": "н", "o": "о", "p": "п",
        "r": "р", "s": "с", "t": "т", "u": "у", "v": "в", "z": "з",
    };
    let result = "", i = 0;
    while (i < text.length) {
        let matched = false;
        for (const [latin, cyr] of digraphs) {
            if (text.substr(i, latin.length) === latin) { result += cyr; i += latin.length; matched = true; break; }
        }
        if (!matched) { result += singles[text[i]] ?? text[i]; i++; }
    }
    return result;
}

// ── DOCX helpers ──────────────────────────────────────────────
const TNR = "Times New Roman";
const LANG = { id: "sr-Cyrl-RS" };
const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 };
const PAGE_PROPS = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 } } };

function cell(text, w) {
    return new TableCell({
        borders, width: { size: w, type: WidthType.DXA }, margins: cellMargins, verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: text || "", font: TNR, size: 24, language: LANG })] })]
    });
}
function headerCell(text, w) {
    return new TableCell({
        borders, width: { size: w, type: WidthType.DXA }, margins: cellMargins, verticalAlign: VerticalAlign.CENTER,
        shading: { fill: "D9D9D9", type: ShadingType.CLEAR },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, font: TNR, size: 22, bold: true, language: LANG })] })]
    });
}
function centeredBold(text, size = 24, underline = false, spacing = {}) {
    return new Paragraph({
        alignment: AlignmentType.CENTER, spacing,
        children: [new TextRun({ text, font: TNR, size, bold: true, underline: underline ? {} : undefined, language: LANG })]
    });
}
function normalPara(runs, spacing = {}) { return new Paragraph({ spacing, children: runs }); }

function buildPlanChildren(ime, outside, inside) {
    const ow = [3539, 1559, 1985, 1979];
    const iw = [3256, 2538, 1412];
    const imeCyr = toCyrillic(ime);
    return [
        centeredBold("ПЛАН СТРУЧНОГ УСАВРШАВАЊА ЗА 2025/2026. ГОДИНУ", 28, false, { after: 200 }),
        normalPara([
            new TextRun({ text: "Име и презиме запосленог: ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: imeCyr, font: TNR, size: 24, bold: true, language: LANG }),
        ], { after: 200 }),
        centeredBold("АКТИВНОСТИ СТРУЧНОГ УСАВРШАВАЊА", 24, false, { after: 0 }),
        centeredBold("ВАН УСТАНОВЕ", 24, true, { after: 120 }),
        new Table({
            width: { size: ow.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: ow,
            rows: [
                new TableRow({ children: [headerCell("Назив акредитованог семинара - програма", ow[0]), headerCell("Каталошки број", ow[1]), headerCell("Број бодова/сати", ow[2]), headerCell("Компетенције", ow[3])] }),
                ...outside.map(r => new TableRow({ children: [cell(r.naziv, ow[0]), cell(r.kataloski, ow[1]), cell(r.bodovi, ow[2]), cell(r.kompetencije, ow[3])] }))
            ]
        }),
        normalPara([
            new TextRun({ text: "Планирано је укупно ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: String(outside.reduce((s, r) => s + (parseFloat(r.bodovi) || 0), 0)), font: TNR, size: 24, bold: true, language: LANG }),
            new TextRun({ text: " бодова акредитованих програма ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: "ван установе.", font: TNR, size: 24, bold: true, language: LANG }),
        ], { before: 160, after: 240 }),
        centeredBold("АКТИВНОСТИ СТРУЧНОГ УСАВРШАВАЊА", 24, false, { after: 0 }),
        centeredBold("У УСТАНОВИ", 24, true, { after: 120 }),
        new Table({
            width: { size: iw.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: iw,
            rows: [
                new TableRow({ children: [headerCell("Активност", iw[0]), headerCell("Начин учествовања", iw[1]), headerCell("Број бодова", iw[2])] }),
                ...inside.map(r => new TableRow({ children: [cell(r.aktivnost, iw[0]), cell(r.nacin, iw[1]), cell(r.bodovi, iw[2])] }))
            ]
        }),
        normalPara([
            new TextRun({ text: "Планирано је укупно ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: String(inside.reduce((s, r) => s + (parseFloat(r.bodovi) || 0), 0)), font: TNR, size: 24, bold: true, language: LANG }),
            new TextRun({ text: " бодова стручног усавршавања ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: "у установи.", font: TNR, size: 24, bold: true, language: LANG }),
        ], { before: 160 }),
    ];
}

function buildIzvestajChildren(ime, outside, inside) {
    const ow = [3539, 1559, 1985, 1979];
    // Колоне: Врста активности | Назив активности | Начин учествовања | Датум реализације | Број бодова
    const iw = [2400, 2000, 1800, 1400, 862];
    const imeCyr = toCyrillic(ime);
    return [
        centeredBold("ИЗВЕШТАЈ О СТРУЧНОМ УСАВРШАВАЊУ ЗА 2024/2025. ГОДИНУ", 28, false, { after: 200 }),
        normalPara([
            new TextRun({ text: "Име и презиме запосленог: ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: imeCyr, font: TNR, size: 24, bold: true, language: LANG }),
        ], { after: 200 }),
        centeredBold("АКТИВНОСТИ СТРУЧНОГ УСАВРШАВАЊА", 24, false, { after: 0 }),
        centeredBold("ВАН УСТАНОВЕ", 24, true, { after: 120 }),
        new Table({
            width: { size: ow.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: ow,
            rows: [
                new TableRow({ children: [headerCell("Назив акредитованог семинара - програма", ow[0]), headerCell("Каталошки број", ow[1]), headerCell("Број бодова/сати", ow[2]), headerCell("Компетенције", ow[3])] }),
                ...outside.map(r => new TableRow({ children: [cell(r.naziv, ow[0]), cell(r.kataloski, ow[1]), cell(r.bodovi, ow[2]), cell(r.kompetencije, ow[3])] }))
            ]
        }),
        normalPara([
            new TextRun({ text: "Наставник/стручни сарадник је остварио укупно ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: String(outside.reduce((s, r) => s + (parseFloat(r.bodovi) || 0), 0)), font: TNR, size: 24, bold: true, language: LANG }),
            new TextRun({ text: " бодова акредитованих програма ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: "ван установе.", font: TNR, size: 24, bold: true, language: LANG }),
        ], { before: 160, after: 240 }),
        centeredBold("АКТИВНОСТИ СТРУЧНОГ УСАВРШАВАЊА", 24, false, { after: 0 }),
        centeredBold("У УСТАНОВИ", 24, true, { after: 120 }),
        new Table({
            width: { size: iw.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: iw,
            rows: [
                new TableRow({ children: [
                    headerCell("Врста активности", iw[0]),
                    headerCell("Назив активности", iw[1]),
                    headerCell("Начин учествовања", iw[2]),
                    headerCell("Датум реализације", iw[3]),
                    headerCell("Број бодова", iw[4])
                ] }),
                ...inside.map(r => new TableRow({ children: [
                    cell(r.aktivnost, iw[0]),
                    cell(r.naziv, iw[1]),
                    cell(r.nacin, iw[2]),
                    cell(r.datum, iw[3]),
                    cell(r.bodovi, iw[4])
                ]}))
            ]
        }),
        normalPara([
            new TextRun({ text: "Наставник/стручни сарадник је остварио укупно ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: String(inside.reduce((s, r) => s + (parseFloat(r.bodovi) || 0), 0)), font: TNR, size: 24, bold: true, language: LANG }),
            new TextRun({ text: " бодова стручног усавршавања ", font: TNR, size: 24, language: LANG }),
            new TextRun({ text: "у установи.", font: TNR, size: 24, bold: true, language: LANG }),
        ], { before: 160 }),
    ];
}

async function buildSingle(type, ime, outside, inside) {
    const children = type === 'izvestaj' ? buildIzvestajChildren(ime, outside, inside) : buildPlanChildren(ime, outside, inside);
    return Packer.toBuffer(new Document({ sections: [{ properties: PAGE_PROPS, children }] }));
}

async function buildCombined(type, entries) {
    return Packer.toBuffer(new Document({
        sections: entries.map(({ ime, outside, inside }) => ({
            properties: PAGE_PROPS,
            children: type === 'izvestaj' ? buildIzvestajChildren(ime, outside, inside) : buildPlanChildren(ime, outside, inside)
        }))
    }));
}

// ── ROUTES ────────────────────────────────────────────────────

// Login
app.post('/login', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email je obavezan" });

    const { data, error } = await supabase
        .from('korisnici')
        .select('*')
        .ilike('email', email.trim())
        .single();

    if (error || !data) return res.status(401).json({ error: "Email nije pronađen" });

    res.json({ ime: data.ime, email: data.email, admin: data.admin || false, super_admin: data.super_admin || false });
});

// Sacuvaj plan ili izvestaj
app.post('/submit/:type', async (req, res) => {
    const { email, ime, outside, inside } = req.body;
    if (!email) return res.status(400).json({ error: "Email je obavezan" });

    const table = req.params.type === 'izvestaj' ? 'izvestaji' : 'planovi';

    const { error } = await supabase
        .from(table)
        .upsert({
            email,
            ime,
            outside,
            inside,
            submitted_at: new Date().toISOString()
        }, { onConflict: 'email' });

    if (error) {
        console.error("Supabase upsert error:", error);
        return res.status(500).json({ error: "Greška pri čuvanju" });
    }

    res.json({ success: true });
});

// Ucitaj sacuvani plan/izvestaj za korisnika
app.get('/my/:type/:email', async (req, res) => {
    const table = req.params.type === 'izvestaj' ? 'izvestaji' : 'planovi';

    const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('email', req.params.email)
        .single();

    if (error || !data) return res.status(404).json({ error: "Nema sačuvanih podataka" });

    res.json(data);
});

// Admin — lista svih korisnika sa statusom
app.get('/admin/users', async (req, res) => {
    const { data: korisnici, error } = await supabase.from('korisnici').select('*');
    if (error) return res.status(500).json({ error: "Greška" });

    const { data: planovi } = await supabase.from('planovi').select('email, submitted_at');
    const { data: izvestaji } = await supabase.from('izvestaji').select('email, submitted_at');

    const planoviMap = Object.fromEntries((planovi || []).map(p => [p.email, p.submitted_at]));
    const izvestajiMap = Object.fromEntries((izvestaji || []).map(i => [i.email, i.submitted_at]));

    res.json(korisnici.map(k => ({
        email: k.email,
        ime: k.ime,
        admin: k.admin || false,
        super_admin: k.super_admin || false,
        planSubmitted: !!planoviMap[k.email],
        planSubmittedAt: planoviMap[k.email] || null,
        izvestajSubmitted: !!izvestajiMap[k.email],
        izvestajSubmittedAt: izvestajiMap[k.email] || null,
    })));
});

// Admin — ucitaj submission za jednog korisnika
app.get('/admin/submission/:type/:email', async (req, res) => {
    const table = req.params.type === 'izvestaj' ? 'izvestaji' : 'planovi';

    const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('email', req.params.email)
        .single();

    if (error || !data) return res.status(404).json({ error: "Нема предате документације" });

    res.json(data);
});

// Admin — obrisi submission (svi admini, zaštićeno lozinkom iz env)
app.delete('/admin/submission/:type/:email', async (req, res) => {
    const masterKey = req.headers['x-master-key'];
    const deletePassword = process.env.DELETE_PASSWORD;

    if (!deletePassword) {
        console.error("DELETE_PASSWORD env variable nije postavljena!");
        return res.status(500).json({ error: "Лозинка за брисање није конфигурисана на серверу." });
    }

    if (!masterKey || masterKey !== deletePassword) {
        return res.status(403).json({ error: "Погрешна лозинка. Брисање није дозвољено." });
    }

    const table = req.params.type === 'izvestaj' ? 'izvestaji' : 'planovi';

    const { error } = await supabase
        .from(table)
        .delete()
        .eq('email', req.params.email);

    if (error) {
        console.error("Supabase delete error:", error);
        return res.status(500).json({ error: "Грешка при брисању из базе." });
    }

    res.json({ success: true });
});

// Generisi jedan docx
app.post('/generate/:type', async (req, res) => {
    const { ime, outside, inside } = req.body;
    const type = req.params.type;
    try {
        const buffer = await buildSingle(type, ime, outside, inside);
        const prefix = type === 'izvestaj' ? 'Izvestaj' : 'Plan';
        res.setHeader('Content-Disposition', `attachment; filename="${prefix}_strucnog_usavrsavanja_${ime.replace(/\s+/g, '_')}.docx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);
    } catch (err) {
        console.error("Generate error:", err);
        res.status(500).json({ error: "Greška pri generisanju dokumenta" });
    }
});

// Generisi sve docx-ove u jednom fajlu
app.get('/generate-all/:type', async (req, res) => {
    const type = req.params.type;
    const table = type === 'izvestaj' ? 'izvestaji' : 'planovi';

    const { data, error } = await supabase.from(table).select('*');
    if (error || !data || data.length === 0) return res.status(404).json({ error: "Нема предатих докумената" });

    try {
        const buffer = await buildCombined(type, data);
        const prefix = type === 'izvestaj' ? 'Svi_izvestaji' : 'Svi_planovi';
        res.setHeader('Content-Disposition', `attachment; filename="${prefix}_strucnog_usavrsavanja.docx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);
    } catch (err) {
        console.error("Generate-all error:", err);
        res.status(500).json({ error: "Greška pri generisanju dokumenta" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("Server running on port", PORT));
