import React, { useState, useEffect, useRef } from 'react';
import { Play, HelpCircle, Database, Table as TableIcon, CheckCircle, XCircle, ChevronRight, Key, Sparkles, Terminal, BookOpen, ArrowRight, Bot, Loader2, Trophy, Star, Award, Copy, Network, Info, LayoutGrid, PlayCircle, ListFilter } from 'lucide-react';

// --- INTEGRAZIONE GEMINI API ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const generateAIHint = async (levelDescription, userQuery, dbSchema) => {
  // 1. Controllo di sicurezza: se la chiave manca, avvisa senza rompere l'app
  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY mancante.");
    return "Attenzione: Il Tutor AI non è configurato. Inserisci la chiave API nelle variabili d'ambiente di Vercel o nel file .env locale!";
  }

  // 2. Fix Modello 404: Utilizzo del modello stabile gemini-1.5-flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `L'obiettivo del livello è: "${levelDescription}". 
Lo schema del database attuale contiene le tabelle: ${dbSchema}.
Lo studente ha scritto questa query SQL: "${userQuery}".
Tuttavia, la query non è corretta o non raggiunge l'obiettivo.
Analizza l'errore e dai allo studente un suggerimento utile e mirato per fargli capire cosa ha sbagliato o cosa manca. 
REGOLA FONDAMENTALE: NON scrivere mai la query corretta nella tua risposta. Usa un tono incoraggiante e scrivi massimo 3 o 4 frasi brevi.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { 
      parts: [{ text: "Sei un tutor AI amichevole e paziente per studenti di informatica del quinto anno superiore. Il tuo scopo è guidarli a capire l'SQL insegnando loro a ragionare." }] 
    }
  };

  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(`Errore API: ${res.status} - ${errData?.error?.message || 'Sconosciuto'}`);
      }
      
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna risposta generata dal tutor.";
    } catch (error) {
      console.error("Tentativo Fallito:", error);
      if (i === 4) return "Si è verificato un errore di connessione col Tutor AI. Riprova più tardi!";
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
};

// --- CONFIGURAZIONE LIVELLI & MACRO-LIVELLI ---
const normalize = (q) => q.toLowerCase().replace(/\s+/g, ' ').replace(/;/g, '').trim();

const MACRO_LEVELS = [
  {
    id: 'macro_1',
    title: "Fondamenti SQL",
    description: "Impara a estrarre dati, selezionare colonne e applicare filtri numerici e testuali semplici.",
    icon: <Database size={32} className="text-blue-400" />,
    color: "from-blue-900 to-blue-950",
    borderColor: "border-blue-500/30",
    levels: [
      {
        id: 1, title: "Esplorazione Dati",
        description: "Benvenuto nel database dell'azienda! Iniziamo dalle basi. Scrivi una query per estrarre TUTTI i dati dalla tabella 'dipendenti'.",
        hint: { title: "Il comando SELECT", theory: "Usa SELECT * per estrarre tutte le colonne da una tabella specifica.", example: "SELECT * FROM nome_tabella;" },
        validate: (q) => normalize(q) === "select * from dipendenti",
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: db.dipendenti, message: "Ottimo! Hai recuperato tutti i record." })
      },
      {
        id: 2, title: "Selezione Specifica",
        description: "Spesso non ci servono tutti i dati. Estrai SOLO le colonne 'nome' e 'ruolo' dalla tabella 'dipendenti'.",
        hint: { title: "Proiezione", theory: "Al posto dell'asterisco, elenca i nomi delle colonne separati da virgola.", example: "SELECT colonna1, colonna2 FROM tabella;" },
        validate: (q) => { const n = normalize(q); return n.includes("select") && n.includes("nome") && n.includes("ruolo") && n.includes("from dipendenti"); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: db.dipendenti.map(d => ({ nome: d.nome, ruolo: d.ruolo })), message: "Perfetto! Hai filtrato le colonne." })
      },
      {
        id: 3, title: "Filtri Numerici",
        description: "Vogliamo trovare i dipendenti con lo stipendio più alto. Mostra tutti i dati dei dipendenti che hanno uno 'stipendio' maggiore di 2500.",
        hint: { title: "La clausola WHERE", theory: "WHERE filtra le righe che rispettano una condizione. Puoi usare operatori come >, <, =, >=", example: "SELECT * FROM auto WHERE prezzo > 10000;" },
        validate: (q) => { const n = normalize(q); return n.includes("where stipendio > 2500"); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: db.dipendenti.filter(d => d.stipendio > 2500), message: "Esatto! Ecco i dipendenti più pagati." })
      },
      {
        id: 4, title: "Filtri Testuali",
        description: "Abbiamo bisogno di parlare con il DBA. Trova tutti i dati dei dipendenti il cui 'ruolo' è esattamente 'DBA'.",
        hint: { title: "Stringhe nel DB", theory: "Quando filtri per testo, ricorda di racchiudere il valore tra apici singoli ('valore').", example: "SELECT * FROM auto WHERE colore = 'Rosso';" },
        validate: (q) => { const n = normalize(q).replace(/"/g, "'"); return n.includes("where ruolo = 'dba'"); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: db.dipendenti.filter(d => d.ruolo === 'DBA'), message: "Trovato! Luca è il nostro DBA." })
      },
      {
        id: 5, title: "Condizioni Multiple (AND)",
        description: "Aumentiamo la precisione. Trova i dipendenti del dipartimento 1 (dipartimento_id = 1) CHE HANNO uno stipendio maggiore o uguale a 3000.",
        hint: { title: "L'operatore AND", theory: "AND richiede che ENTRAMBE le condizioni siano vere.", example: "WHERE colore = 'Rosso' AND prezzo < 5000;" },
        validate: (q) => { const n = normalize(q); return n.includes("and") && n.includes("dipartimento_id = 1") && n.includes("stipendio >="); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: db.dipendenti.filter(d => d.dipartimento_id === 1 && d.stipendio >= 3000), message: "Doppio filtro applicato correttamente!" })
      }
    ]
  },
  {
    id: 'macro_2',
    title: "Filtri Avanzati",
    description: "Padroneggia gli operatori logici (OR, IN), l'ordinamento (ORDER BY) e la ricerca testuale (LIKE).",
    icon: <ListFilter size={32} className="text-green-400" />,
    color: "from-green-900 to-green-950",
    borderColor: "border-green-500/30",
    levels: [
      {
        id: 6, title: "Condizioni Alternative (OR)",
        description: "Vogliamo convocare gli sviluppatori. Estrai i dipendenti che hanno ruolo 'Frontend Dev' OPPURE 'Backend Dev'.",
        hint: { title: "L'operatore OR", theory: "OR richiede che ALMENO UNA delle condizioni sia vera.", example: "WHERE tipo = 'SUV' OR tipo = 'Crossover';" },
        validate: (q) => { const n = normalize(q).replace(/"/g, "'"); return n.includes("or") && n.includes("'frontend dev'") && n.includes("'backend dev'"); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: db.dipendenti.filter(d => d.ruolo === 'Frontend Dev' || d.ruolo === 'Backend Dev'), message: "Sviluppatori trovati." })
      },
      {
        id: 7, title: "Ordinamento Dati",
        description: "Estrai tutti i dipendenti, ma questa volta ordinali per 'stipendio' in ordine decrescente (dal più alto al più basso).",
        hint: { title: "ORDER BY", theory: "Usa ORDER BY colonna per ordinare. Aggiungi DESC per l'ordine decrescente (ASC è di default).", example: "ORDER BY prezzo DESC;" },
        validate: (q) => { const n = normalize(q); return n.includes("order by stipendio desc"); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: [...db.dipendenti].sort((a,b) => b.stipendio - a.stipendio), message: "Dati ordinati perfettamente!" })
      },
      {
        id: 8, title: "Limitare i Risultati",
        description: "Chi è il dipendente più pagato in assoluto? Usa l'ordinamento decrescente per stipendio come prima, ma limita il risultato a 1 sola riga.",
        hint: { title: "LIMIT", theory: "LIMIT n restringe l'output alle prime 'n' righe. Si posiziona alla fine della query.", example: "ORDER BY prezzo DESC LIMIT 1;" },
        validate: (q) => { const n = normalize(q); return n.includes("order by stipendio desc") && n.includes("limit 1"); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: [...db.dipendenti].sort((a,b) => b.stipendio - a.stipendio).slice(0, 1), message: "Hai trovato il dipendente più pagato!" })
      },
      {
        id: 9, title: "Ricerca per Pattern (LIKE)",
        description: "Ricordi che c'era un dipendente il cui nome iniziava per 'M', ma non ricordi il cognome. Trovalo usando l'operatore LIKE.",
        hint: { title: "Wildcards %", theory: "LIKE permette ricerche parziali. Il simbolo % rappresenta 'qualsiasi numero di caratteri'.", example: "WHERE nome LIKE 'A%';" },
        validate: (q) => { const n = normalize(q).replace(/"/g, "'"); return n.includes("like 'm%'"); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: db.dipendenti.filter(d => d.nome.startsWith('M')), message: "Mario Rossi individuato!" })
      },
      {
        id: 10, title: "Operatore IN",
        description: "Al posto di usare molti OR, trova i dipendenti che appartengono ai dipartimenti 1 e 2 usando l'operatore IN.",
        hint: { title: "IN (val1, val2)", theory: "IN verifica se un valore è presente in una lista specificata tra parentesi.", example: "WHERE colore IN ('Rosso', 'Blu');" },
        validate: (q) => { const n = normalize(q); return n.includes("in") && n.includes("1") && n.includes("2") && n.includes("dipartimento_id"); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: db.dipendenti.filter(d => [1, 2].includes(d.dipartimento_id)), message: "Sintassi elegante e corretta." })
      }
    ]
  },
  {
    id: 'macro_3',
    title: "Struttura (DDL/DML)",
    description: "Crea tabelle (CREATE), inserisci (INSERT), modifica (UPDATE) ed elimina (DELETE) record.",
    icon: <TableIcon size={32} className="text-amber-400" />,
    color: "from-amber-900 to-amber-950",
    borderColor: "border-amber-500/30",
    levels: [
      {
        id: 11, title: "Definizione Dati (CREATE)",
        description: "Basta leggere, passiamo all'azione! Crea una nuova tabella 'progetti' con le colonne: 'id' (INT), 'nome' (VARCHAR), 'budget' (INT).",
        hint: { title: "CREATE TABLE", theory: "Definisce la struttura di una nuova tabella specificando nome e tipo di ogni colonna.", example: "CREATE TABLE auto (id INT, modello VARCHAR);" },
        validate: (q) => { const n = normalize(q); return n.includes('create table progetti') && n.includes('id') && n.includes('budget'); },
        onSuccess: (setDb, setOutput) => { setDb(p => ({ ...p, progetti: [] })); setOutput({ type: 'success', message: "Tabella 'progetti' creata!" }); }
      },
      {
        id: 12, title: "Inserimento (INSERT)",
        description: "La tabella progetti è vuota. Inserisci un record con id: 1, nome: 'Rinnovo Portale', budget: 50000.",
        hint: { title: "INSERT INTO", theory: "Aggiunge nuove tuple. L'ordine dei VALUES deve corrispondere all'ordine delle colonne.", example: "INSERT INTO auto (id, modello) VALUES (1, 'Punto');" },
        validate: (q) => { const n = normalize(q).replace(/'/g, ""); return n.includes('insert into progetti') && n.includes('rinnovo portale') && n.includes('50000'); },
        onSuccess: (setDb, setOutput) => { setDb(p => ({ ...p, progetti: [{ id: 1, nome: 'Rinnovo Portale', budget: 50000 }] })); setOutput({ type: 'success', message: "Progetto inserito!" }); }
      },
      {
        id: 13, title: "Modifica (UPDATE)",
        description: "Abbiamo ottenuto più fondi! Aggiorna il 'budget' a 60000 per il progetto con id = 1.",
        hint: { title: "UPDATE", theory: "Aggiorna i dati esistenti. Usa SEMPRE la clausola WHERE, altrimenti modificherai tutte le righe!", example: "UPDATE auto SET prezzo = 12000 WHERE id = 1;" },
        validate: (q) => { const n = normalize(q); return n.includes('update progetti') && n.includes('set budget = 60000') && n.includes('where id = 1'); },
        onSuccess: (setDb, setOutput) => { setDb(p => ({ ...p, progetti: [{ id: 1, nome: 'Rinnovo Portale', budget: 60000 }] })); setOutput({ type: 'success', message: "Budget aggiornato!" }); }
      },
      {
        id: 14, title: "Update Matematico",
        description: "Il nostro Stagista è stato promosso! Fai un UPDATE sulla tabella 'dipendenti' impostando lo stipendio a 1200 DOVE il ruolo è 'Stagista'.",
        hint: { title: "Operazioni Dinamiche", theory: "Puoi usare espressioni matematiche o assegnazioni dirette nei SET.", example: "UPDATE auto SET prezzo = prezzo + 500 WHERE id = 1;" },
        validate: (q) => { const n = normalize(q).replace(/"/g, "'"); return n.includes('update dipendenti') && n.includes('set stipendio = 1200') && n.includes("ruolo = 'stagista'"); },
        onSuccess: (setDb, setOutput) => { 
          setDb(p => ({ ...p, dipendenti: p.dipendenti.map(d => d.ruolo === 'Stagista' ? {...d, stipendio: 1200} : d) }));
          setOutput({ type: 'success', message: "Congratulazioni a Paolo per l'aumento!" });
        }
      },
      {
        id: 15, title: "Eliminazione (DELETE)",
        description: "Purtroppo il dipendente con id = 5 si è dimesso. Elimina il suo record dalla tabella 'dipendenti'.",
        hint: { title: "DELETE FROM", theory: "Rimuove intere righe da una tabella. Anche qui, la clausola WHERE è vitale!", example: "DELETE FROM auto WHERE id = 5;" },
        validate: (q) => { const n = normalize(q); return n.includes('delete from dipendenti') && n.includes('where id = 5'); },
        onSuccess: (setDb, setOutput) => { 
          setDb(p => ({ ...p, dipendenti: p.dipendenti.filter(d => d.id !== 5) }));
          setOutput({ type: 'success', message: "Record rimosso in modo permanente." });
        }
      }
    ]
  },
  {
    id: 'macro_4',
    title: "Relazioni e JOIN",
    description: "Modifica tabelle esistenti, usa funzioni di aggregazione (COUNT, SUM) e unisci tabelle con le JOIN.",
    icon: <Network size={32} className="text-indigo-400" />,
    color: "from-indigo-900 to-indigo-950",
    borderColor: "border-indigo-500/30",
    levels: [
      {
        id: 16, title: "Modifica Struttura (ALTER)",
        description: "Dobbiamo aggiungere una scadenza ai progetti. Aggiungi una colonna 'scadenza' di tipo DATE alla tabella 'progetti'.",
        hint: { title: "ALTER TABLE", theory: "Permette di modificare la struttura di una tabella già esistente (aggiungere/rimuovere colonne).", example: "ALTER TABLE auto ADD targa VARCHAR;" },
        validate: (q) => { const n = normalize(q); return n.includes('alter table progetti') && n.includes('add scadenza date'); },
        onSuccess: (setDb, setOutput) => { 
          setDb(p => ({ ...p, progetti: p.progetti.map(pr => ({ ...pr, scadenza: null })) }));
          setOutput({ type: 'success', message: "Colonna aggiunta. I valori esistenti sono impostati a NULL." });
        }
      },
      {
        id: 17, title: "Funzioni: COUNT",
        description: "Quanti dipendenti abbiamo attualmente? Usa la funzione COUNT(*) per contare il numero totale di righe in 'dipendenti'.",
        hint: { title: "Funzioni di Aggregazione", theory: "COUNT restituisce il numero di righe che corrispondono a un criterio.", example: "SELECT COUNT(*) FROM auto;" },
        validate: (q) => { const n = normalize(q); return n.includes('select count(*)') && n.includes('from dipendenti'); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: [{ 'count(*)': db.dipendenti.length }], message: "Conteggio effettuato!" })
      },
      {
        id: 18, title: "Funzioni: SUM",
        description: "Qual è il costo totale mensile degli stipendi? Usa la funzione SUM(stipendio) sulla tabella dipendenti.",
        hint: { title: "Somma", theory: "SUM calcola la somma totale di una colonna numerica.", example: "SELECT SUM(prezzo) FROM auto;" },
        validate: (q) => { const n = normalize(q); return n.includes('select sum(stipendio)') && n.includes('from dipendenti'); },
        onSuccess: (setDb, setOutput, db) => setOutput({ type: 'table', data: [{ 'sum(stipendio)': db.dipendenti.reduce((a,b) => a + b.stipendio, 0) }], message: "Somma calcolata con successo!" })
      },
      {
        id: 19, title: "Relazioni (INNER JOIN)",
        description: "Finalmente le JOIN! Mostra il 'nome' del dipendente e il 'nome_dip' del dipartimento. Usa INNER JOIN tra dipendenti e dipartimenti collegandoli tramite dipartimento_id = id.",
        hint: { title: "Unire i Dati", theory: "La JOIN unisce due tabelle affiancando le righe che hanno una chiave in comune.", example: "SELECT a.modello, b.nome FROM auto a INNER JOIN marca b ON a.marca_id = b.id;" },
        validate: (q) => { const n = normalize(q); return n.includes('join dipartimenti') && (n.includes('on dipendenti.dipartimento_id = dipartimenti.id') || n.includes('where dipendenti.dipartimento_id = dipartimenti.id')); },
        onSuccess: (setDb, setOutput, db) => setOutput({ 
          type: 'table', 
          data: db.dipendenti.map(dip => ({ nome: dip.nome, nome_dip: db.dipartimenti.find(d => d.id === dip.dipartimento_id)?.nome_dip || 'N/A' })),
          message: "JOIN riuscita! Hai combinato dati da due tabelle." 
        })
      },
      {
        id: 20, title: "Il Livello del Boss",
        description: "L'esame finale! Mostra il 'nome' del dipendente e la 'sede' del dipartimento tramite una JOIN. Filtra (WHERE) solo chi ha uno stipendio > 2500 e ordina (ORDER BY) il risultato alfabeticamente per sede (ASC).",
        hint: { title: "Tutto Insieme", theory: "L'ordine delle clausole SQL è rigoroso: SELECT -> FROM -> JOIN -> ON -> WHERE -> ORDER BY.", example: "Credi in te stesso!" },
        validate: (q) => { const n = normalize(q); return n.includes('join dipartimenti') && n.includes('where') && n.includes('stipendio > 2500') && n.includes('order by'); },
        onSuccess: (setDb, setOutput, db) => {
          const result = db.dipendenti
            .filter(d => d.stipendio > 2500)
            .map(dip => ({ nome: dip.nome, sede: db.dipartimenti.find(d => d.id === dip.dipartimento_id).sede }))
            .sort((a,b) => a.sede.localeCompare(b.sede));
          setOutput({ type: 'table', data: result, message: "🎉 INCREDIBILE! Hai superato l'esame finale di SQL!" });
        }
      }
    ]
  }
];

// --- STATO INIZIALE DEL DATABASE ---
const INITIAL_DB = {
  dipartimenti: [
    { id: 1, nome_dip: 'IT & Sviluppo', sede: 'Milano' },
    { id: 2, nome_dip: 'Risorse Umane', sede: 'Roma' }
  ],
  dipendenti: [
    { id: 1, nome: 'Mario Rossi', ruolo: 'Backend Dev', stipendio: 3200, dipartimento_id: 1 },
    { id: 2, nome: 'Giulia Bianchi', ruolo: 'Frontend Dev', stipendio: 2800, dipartimento_id: 1 },
    { id: 3, nome: 'Luca Verdi', ruolo: 'DBA', stipendio: 3500, dipartimento_id: 1 },
    { id: 4, nome: 'Anna Neri', ruolo: 'Recruiter', stipendio: 2100, dipartimento_id: 2 },
    { id: 5, nome: 'Paolo Gialli', ruolo: 'Stagista', stipendio: 800, dipartimento_id: 1 }
  ]
};

// Funzione helper per preparare il DB in base al modulo selezionato (così i salti in avanti funzionano)
const getDbForMacro = (macroIndex) => {
  const db = JSON.parse(JSON.stringify(INITIAL_DB)); 
  if (macroIndex >= 3) { // Se si salta al modulo 4, applica le modifiche DML/DDL del modulo 3
    const stagista = db.dipendenti.find(d => d.ruolo === 'Stagista');
    if (stagista) stagista.stipendio = 1200;
    db.dipendenti = db.dipendenti.filter(d => d.id !== 5);
    db.progetti = [{ id: 1, nome: 'Rinnovo Portale', budget: 60000 }];
  }
  return db;
};

// --- COMPONENTE GRAFICO E-R ---
const ERDiagram = ({ db }) => {
  const containerRef = useRef(null);
  const refs = useRef({});
  const [lines, setLines] = useState([]);

  useEffect(() => {
    const updateLines = () => {
      if (!containerRef.current) return;
      const container = containerRef.current.getBoundingClientRect();
      const newLines = [];
      const tables = Object.keys(db);

      tables.forEach(fromTable => {
        const data = db[fromTable] || [];
        let cols = data.length > 0 ? Object.keys(data[0]) : [];
        
        // Regola dinamica per mostrare la struttura delle tabelle appena create ma senza dati
        if (cols.length === 0 && fromTable === 'progetti') cols = ['id', 'nome', 'budget'];

        cols.forEach(col => {
          if (col.endsWith('_id')) {
            const targetBase = col.replace('_id', '');
            const baseStem = targetBase.slice(0, -1);
            const toTable = tables.find(t => 
              t === targetBase || t === targetBase + 's' || t === baseStem + 'i' || t === baseStem + 'e'
            );
            
            if (toTable && refs.current[fromTable] && refs.current[toTable]) {
              const rect1 = refs.current[fromTable].getBoundingClientRect();
              const rect2 = refs.current[toTable].getBoundingClientRect();

              const x1 = rect1.left + rect1.width / 2 - container.left;
              const y1 = rect1.top + rect1.height / 2 - container.top;
              const x2 = rect2.left + rect2.width / 2 - container.left;
              const y2 = rect2.top + rect2.height / 2 - container.top;

              const dx = x2 - x1;
              const dy = y2 - y1;
              const length = Math.sqrt(dx * dx + dy * dy);
              const nx = length > 0 ? dx / length : 0;
              const ny = length > 0 ? dy / length : 0;

              // Previene divisioni per zero
              const safeNx = nx === 0 ? 0.0001 : nx;
              const safeNy = ny === 0 ? 0.0001 : ny;

              // Calcolo esatto dell'intersezione tra il raggio della linea e il bordo del rettangolo
              const r1 = Math.min(
                Math.abs((rect1.width / 2) / safeNx),
                Math.abs((rect1.height / 2) / safeNy)
              );
              const r2 = Math.min(
                Math.abs((rect2.width / 2) / safeNx),
                Math.abs((rect2.height / 2) / safeNy)
              );

              // L'etichetta sarà posizionata esattamente a 16px dal bordo della tabella
              const offset1 = r1 + 16;
              const offset2 = r2 + 16;

              newLines.push({
                id: `${fromTable}-${toTable}-${col}`,
                x1, y1, x2, y2,
                lblNx: x1 + nx * offset1,
                lblNy: y1 + ny * offset1,
                lbl1x: x2 - nx * offset2,
                lbl1y: y2 - ny * offset2,
              });
            }
          }
        });
      });
      setLines(newLines);
    };

    const timeoutId = setTimeout(updateLines, 200);
    window.addEventListener('resize', updateLines);
    return () => { clearTimeout(timeoutId); window.removeEventListener('resize', updateLines); };
  }, [db]);

  return (
    <div className="w-full flex-1 bg-slate-900/50 rounded-xl border border-slate-700/50 shadow-inner p-3 sm:p-4 md:p-6 flex flex-col">
      {/* Aumentato il gap (spazio) tra le entità a 20 e il padding verticale (py-12) per evitare sovrapposizioni su mobile */}
      <div ref={containerRef} className="relative w-full flex-1 flex flex-wrap justify-center gap-20 md:gap-24 items-start min-h-[350px] py-12 px-4 sm:px-8">
        
        {/* L'SVG usa overflow-visible per non troncare le linee tra le card impilate */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
          {lines.map(line => (
            <g key={line.id}>
              <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#818cf8" strokeWidth="2.5" strokeDasharray="6,6" opacity="0.6" />
              <rect x={line.lblNx - 10} y={line.lblNy - 10} width="20" height="20" rx="4" fill="#1e293b" stroke="#818cf8" strokeWidth="1.5" />
              <text x={line.lblNx} y={line.lblNy} fill="#c7d2fe" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">N</text>
              <rect x={line.lbl1x - 10} y={line.lbl1y - 10} width="20" height="20" rx="4" fill="#1e293b" stroke="#34d399" strokeWidth="1.5" />
              <text x={line.lbl1x} y={line.lbl1y} fill="#a7f3d0" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">1</text>
            </g>
          ))}
        </svg>

        {Object.keys(db).map(tableName => {
          const data = db[tableName] || [];
          let cols = data.length > 0 ? Object.keys(data[0]) : [];
          
          if (cols.length === 0 && tableName === 'progetti') cols = ['id', 'nome', 'budget'];

          return (
            <div key={tableName} ref={el => refs.current[tableName] = el} className="relative z-10 w-40 sm:w-48 bg-slate-800 rounded-xl border border-slate-600 shadow-xl overflow-hidden flex flex-col transform transition-transform hover:scale-105">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-3 py-2 border-b border-slate-600 flex items-center gap-2 shadow-sm">
                <Database size={14} className="text-blue-400" />
                <span className="font-bold text-slate-100 uppercase tracking-wider text-[10px] sm:text-xs drop-shadow-md">{tableName}</span>
              </div>
              <div className="p-3 flex flex-col gap-2 sm:gap-2.5 bg-slate-800/90 backdrop-blur-sm">
                {cols.length > 0 ? cols.map(col => {
                  const isPK = col === 'id';
                  const isFK = col.endsWith('_id');
                  
                  let colType = 'VARCHAR';
                  if (isPK || isFK || col === 'budget' || col === 'stipendio') colType = 'INT';
                  if (col === 'scadenza') colType = 'DATE';

                  return (
                    <div key={col} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono text-slate-300">
                      {isPK ? <Key size={12} className="text-amber-400 flex-shrink-0" title="Primary Key" /> : 
                       isFK ? <Key size={12} className="text-indigo-400 flex-shrink-0" title="Foreign Key" /> :
                       <div className="w-[12px] flex justify-center"><div className="w-1.5 h-1.5 rounded-full bg-slate-500 opacity-50"></div></div>}
                      <span className={isPK ? 'font-bold text-amber-200 truncate' : isFK ? 'font-bold text-indigo-300 truncate' : 'truncate'}>{col}</span>
                      <span className="ml-auto text-[8px] sm:text-[9px] text-slate-500 font-sans tracking-widest uppercase">{colType}</span>
                    </div>
                  );
                }) : <span className="text-[10px] sm:text-xs text-slate-500 italic text-center py-2">Struttura sconosciuta</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-700/50 w-full flex justify-center flex-none">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-indigo-500/50 border border-indigo-400"></div> Relazione N:1</div>
          <div className="flex items-center gap-1.5"><Key size={10} className="sm:w-3 sm:h-3 text-amber-400" /> Chiave Primaria</div>
          <div className="flex items-center gap-1.5"><Key size={10} className="sm:w-3 sm:h-3 text-indigo-400" /> Chiave Esterna</div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // --- STATI MENU E NAVIGAZIONE ---
  const [activeMacroIndex, setActiveMacroIndex] = useState(null); // null = Menu Principale
  const [currentSubLevelIndex, setCurrentSubLevelIndex] = useState(0);

  // --- STATI GIOCO ---
  const [db, setDb] = useState(INITIAL_DB);
  const [query, setQuery] = useState('');
  const [output, setOutput] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [animStep, setAnimStep] = useState(0);
  
  // --- STATI AI E GAMIFICATION ---
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentScore, setCurrentScore] = useState(0); // Punteggio relativo al modulo corrente
  const [levelAttempts, setLevelAttempts] = useState(0);
  const [usedAI, setUsedAI] = useState(false);
  const [levelStats, setLevelStats] = useState([]);
  const [isMacroFinished, setIsMacroFinished] = useState(false);
  const [viewMode, setViewMode] = useState('data');
  const [showRules, setShowRules] = useState(false);

  // Recupera l'oggetto livello attivo in base al modulo selezionato
  const activeMacro = activeMacroIndex !== null ? MACRO_LEVELS[activeMacroIndex] : null;
  const level = activeMacro ? activeMacro.levels[currentSubLevelIndex] : null;

  // Funzione per avviare un Modulo
  const startMacroLevel = (index) => {
    setActiveMacroIndex(index);
    setCurrentSubLevelIndex(0);
    setCurrentScore(0);
    setLevelStats([]);
    setDb(getDbForMacro(index)); // Setup del DB intelligente
    setIsMacroFinished(false);
    setShowBriefing(true);
  };

  // Funzione per tornare al Menu
  const returnToMenu = () => {
    setActiveMacroIndex(null);
    setIsMacroFinished(false);
  };

  useEffect(() => {
    if (showBriefing && level) {
      setAnimStep(0);
      const t1 = setTimeout(() => setAnimStep(1), 100);
      const t2 = setTimeout(() => setAnimStep(2), 800);
      const t3 = setTimeout(() => setAnimStep(3), 1500);
      const t4 = setTimeout(() => setAnimStep(4), 2200);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }
  }, [showBriefing, currentSubLevelIndex]);

  useEffect(() => {
    setQuery('');
    setOutput(null);
    setShowHint(false);
    setAiFeedback(null);
    setLevelAttempts(0);
    setUsedAI(false);
  }, [currentSubLevelIndex, activeMacroIndex]);

  useEffect(() => {
    if (aiFeedback && !isAiLoading) setAiFeedback(null);
  }, [query]);

  const handleRunQuery = () => {
    if (!query.trim()) { setOutput({ type: 'error', message: "La query è vuota. Scrivi un comando SQL." }); return; }
    if (output?.type === 'success' || output?.type === 'table') return;

    const isValid = level.validate(query);
    const currentAttempt = levelAttempts + 1;

    if (isValid) {
      let pointsEarned = 100 - ((currentAttempt - 1) * 10);
      if (usedAI) pointsEarned -= 30;
      if (pointsEarned < 20) pointsEarned = 20;

      let starsEarned = 1;
      if (currentAttempt === 1 && !usedAI) starsEarned = 3;
      else if (currentAttempt <= 3 && !usedAI) starsEarned = 2;

      setCurrentScore(prev => prev + pointsEarned);
      setLevelStats(prev => [...prev, { level: level.id, points: pointsEarned, stars: starsEarned, attempts: currentAttempt, usedAI }]);

      level.onSuccess(setDb, setOutput, db);
      setAiFeedback(null);
      setOutput(prev => ({ ...prev, message: `${prev.message} (+${pointsEarned} pt, ${starsEarned} Stelle)` }));
    } else {
      setLevelAttempts(currentAttempt);
      setOutput({ type: 'error', message: "Errore di sintassi o logica errata per questo esercizio. Controlla i nomi delle tabelle/colonne o chiedi aiuto." });
    }
  };

  const handleAskAI = async () => {
    setIsAiLoading(true); setAiFeedback(null); setUsedAI(true);
    const dbSchema = Object.keys(db).join(', ');
    const hint = await generateAIHint(level.description, query, dbSchema);
    setAiFeedback(hint); setIsAiLoading(false);
  };

  const handleNextLevel = () => {
    if (currentSubLevelIndex < activeMacro.levels.length - 1) {
      setCurrentSubLevelIndex(prev => prev + 1);
      setShowBriefing(true);
    } else {
      setIsMacroFinished(true);
    }
  };

  const copyToClipboard = () => {
    const totalStars = levelStats.reduce((acc, curr) => acc + curr.stars, 0);
    const maxScore = activeMacro.levels.length * 100;
    const finalGrade = Math.max(2, Math.min(10, (currentScore / maxScore) * 10)).toFixed(1);
    
    const text = `🎮 SQL Quest - Risultati Modulo: ${activeMacro.title}\nPunteggio: ${currentScore}/${maxScore}\nStelle: ${totalStars}/${activeMacro.levels.length * 3}\nVOTO MODULO: ${finalGrade}/10`;
    
    const textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select();
    try { document.execCommand('copy'); alert("Risultati copiati! Incollali e inviali al professore."); } catch (err) { console.error('Impossibile copiare', err); }
    document.body.removeChild(textArea);
  };

  const renderTable = (tableName, data) => {
    if (!data) return null;
    let columns = data.length > 0 ? Object.keys(data[0]) : [];
    
    // Regola dinamica: inserisce le colonne se la tabella è stata creata ma è vuota
    if (columns.length === 0 && tableName === 'progetti') columns = ['id', 'nome', 'budget'];

    return (
      <div key={tableName} className="mb-4 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-lg">
        <div className="bg-slate-900 px-3 py-2 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center text-blue-400 font-mono font-bold text-sm"><TableIcon size={14} className="mr-2" />{tableName}</div>
          {data.length === 0 && <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">0 record</span>}
        </div>
        {columns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-3 py-2 font-semibold">
                      <div className="flex items-center gap-1">
                        {col === 'id' && <Key size={10} className="text-amber-400" title="Primary Key" />}
                        {col.endsWith('_id') && <Key size={10} className="text-slate-400" title="Foreign Key" />}
                        {col}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  data.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      {columns.map(col => <td key={col} className="px-3 py-2 font-mono">{row[col] === null ? <span className="text-slate-500 italic">NULL</span> : row[col]}</td>)}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-6 text-center text-xs text-slate-500 italic bg-slate-800/20">
                      Tabella creata con successo. In attesa di inserimento dati...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : <div className="p-3 text-center text-slate-500 text-xs font-mono">Struttura non definita.</div>}
      </div>
    );
  };

  // --- RENDER MENU PRINCIPALE ---
  if (activeMacroIndex === null) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 text-slate-200 font-sans flex flex-col p-4 md:p-6 items-center justify-center relative overflow-x-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-950 pointer-events-none"></div>
        <div className="z-10 max-w-4xl w-full">
          <div className="text-center mb-8">
            <div className="bg-blue-600 p-3 rounded-xl inline-block mb-3 shadow-[0_0_30px_rgba(37,99,235,0.4)]">
              <Database className="text-white sm:w-9 sm:h-9" size={32} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight">SQL Quest</h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-400 max-w-2xl mx-auto">Scegli un modulo didattico e metti alla prova le tue abilità. Ogni modulo contiene 5 query progressive da completare.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MACRO_LEVELS.map((macro, idx) => (
              <button
                key={macro.id}
                onClick={() => startMacroLevel(idx)}
                className={`group relative bg-slate-800/80 backdrop-blur-sm border ${macro.borderColor} p-4 sm:p-5 rounded-2xl text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:bg-slate-800 flex flex-col`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border ${macro.borderColor} [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6`}>
                    {macro.icon}
                  </div>
                  <div className="bg-slate-900/80 px-2 sm:px-3 py-1 rounded-full border border-slate-700 flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-400">
                    <LayoutGrid size={12} className="sm:w-[14px] sm:h-[14px]" /> 5 Livelli
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2 group-hover:text-blue-400 transition-colors">{macro.title}</h3>
                <p className="text-slate-400 text-[11px] sm:text-sm leading-relaxed flex-1 mb-3 sm:mb-4">{macro.description}</p>
                <div className="flex items-center text-blue-400 text-xs sm:text-sm font-bold gap-2 mt-auto">
                  <PlayCircle size={16} className="sm:w-[18px] sm:h-[18px] group-hover:translate-x-1 transition-transform" />
                  Inizia Modulo
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER GIOCO (Briefing o Gameplay o Fine Modulo) ---
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-200 font-sans flex flex-col">
      {/* HEADER COMPATTO PER MOBILE E DESKTOP */}
      <header className="bg-slate-900 border-b border-slate-800 p-2.5 sm:p-3 flex justify-between items-center flex-none z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={returnToMenu} className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
            <LayoutGrid size={16} className="sm:w-[20px] sm:h-[20px]" />
          </button>
          <div className="h-5 sm:h-6 w-px bg-slate-700 mx-0.5 sm:mx-1"></div>
          <div className="flex flex-col">
            <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white leading-none max-w-[120px] sm:max-w-none truncate">{activeMacro.title}</h1>
            <p className="hidden sm:block text-[10px] text-slate-400 font-mono mt-0.5">Modulo in corso</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* DISPLAY PUNTEGGIO RESPONSIVE */}
          <button 
            onClick={() => setShowRules(true)}
            className="flex bg-slate-800/80 hover:bg-slate-700/80 border border-amber-500/30 px-2 sm:px-3 py-1 rounded-full items-center gap-1.5 sm:gap-2 shadow-[0_0_10px_rgba(245,158,11,0.1)] transition-colors group"
          >
            <Trophy className="text-amber-400 group-hover:scale-110 transition-transform sm:w-[14px] sm:h-[14px]" size={12} />
            <span className="font-mono font-bold text-amber-50 text-xs sm:text-sm">{currentScore} <span className="hidden sm:inline text-amber-400/70 text-xs">PT</span></span>
            <Info size={14} className="hidden sm:block text-slate-400 group-hover:text-amber-200 ml-1" />
          </button>
          
          {/* PROGRESS DOTS ADATTIVI */}
          <div className="flex gap-1 sm:gap-1.5">
            {activeMacro.levels.map((_, idx) => (
              <div key={idx} className={`h-1.5 w-1.5 sm:w-3 md:w-6 rounded-full transition-colors ${idx < currentSubLevelIndex ? 'bg-green-500' : idx === currentSubLevelIndex ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-800'}`} />
            ))}
          </div>
        </div>
      </header>

      {/* MODALE REGOLAMENTO SCORREVOLE */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="bg-slate-900 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2"><Trophy className="text-amber-400" size={18} /> Regolamento Punteggio</h3>
              <button onClick={() => setShowRules(false)} className="text-slate-400 hover:text-white transition-colors"><XCircle size={20} className="sm:w-6 sm:h-6" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">Il tuo Voto Finale dipende da quanti punti e stelle accumuli. Cerca di risolvere le query con meno tentativi possibili!</p>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-300 font-medium">
                <li className="flex items-center gap-2 sm:gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50"><div className="w-6 h-6 sm:w-8 sm:h-8 rounded bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-xs sm:text-sm">+100</div><span>Punti base per ogni livello.</span></li>
                <li className="flex items-center gap-2 sm:gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50"><div className="w-6 h-6 sm:w-8 sm:h-8 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs sm:text-sm">-10</div><span>Penalità per query errata.</span></li>
                <li className="flex items-center gap-2 sm:gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50"><div className="w-6 h-6 sm:w-8 sm:h-8 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs sm:text-sm">-30</div><span>Penalità se usi Tutor AI.</span></li>
              </ul>
              <div className="pt-3 sm:pt-4 border-t border-slate-700/80">
                <h4 className="font-bold text-slate-200 mb-2 sm:mb-3 text-xs sm:text-sm uppercase tracking-wider">Sistema a Stelle</h4>
                <div className="space-y-2 text-xs sm:text-sm text-slate-300">
                  <div className="flex items-center gap-2 sm:gap-3"><div className="flex text-amber-400 w-10 sm:w-12"><Star size={12} fill="currentColor" className="sm:w-[14px] sm:h-[14px]"/><Star size={12} fill="currentColor" className="sm:w-[14px] sm:h-[14px]"/><Star size={12} fill="currentColor" className="sm:w-[14px] sm:h-[14px]"/></div> <span>1° tentativo, no AI.</span></div>
                  <div className="flex items-center gap-2 sm:gap-3"><div className="flex text-amber-400 w-10 sm:w-12"><Star size={12} fill="currentColor" className="sm:w-[14px] sm:h-[14px]"/><Star size={12} fill="currentColor" className="sm:w-[14px] sm:h-[14px]"/><Star size={12} className="text-slate-600 sm:w-[14px] sm:h-[14px]"/></div> <span>Max 3 tentativi, no AI.</span></div>
                  <div className="flex items-center gap-2 sm:gap-3"><div className="flex text-amber-400 w-10 sm:w-12"><Star size={12} fill="currentColor" className="sm:w-[14px] sm:h-[14px]"/><Star size={12} className="text-slate-600 sm:w-[14px] sm:h-[14px]"/><Star size={12} className="text-slate-600 sm:w-[14px] sm:h-[14px]"/></div> <span>&gt;3 tentativi o AI usata.</span></div>
                </div>
              </div>
              <button onClick={() => setShowRules(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 sm:py-3 rounded-xl transition-all active:scale-95 shadow-md text-sm sm:text-base">Ho capito!</button>
            </div>
          </div>
        </div>
      )}

      {isMacroFinished ? (
        <div className="flex-1 flex items-center justify-center p-4 md:p-6 bg-slate-900 relative overflow-y-auto overflow-x-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-950 min-h-full"></div>
          <div className="z-10 max-w-xl w-full bg-slate-800/90 backdrop-blur-md border border-slate-700 p-5 md:p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center my-auto">
            <div className="bg-amber-500/20 p-3 sm:p-4 rounded-full inline-block mb-3 sm:mb-4 border border-amber-500/30">
              <Award className="text-amber-400 w-10 h-10 sm:w-12 sm:h-12" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-1.5 sm:mb-2 tracking-tight">Modulo Superato!</h2>
            <p className="text-slate-400 mb-5 sm:mb-6 text-xs sm:text-sm md:text-base">Hai completato il modulo <strong className="text-white">{activeMacro.title}</strong>.</p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-5 sm:mb-6">
              <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center shadow-inner">
                <span className="text-slate-400 font-mono text-[10px] sm:text-xs uppercase mb-1">Punteggio</span>
                <div className="flex items-center gap-1.5 sm:gap-2"><Trophy className="text-amber-400 w-4 h-4 sm:w-5 sm:h-5" /><span className="text-2xl sm:text-3xl font-black text-white">{currentScore}</span></div>
                <span className="text-slate-500 text-[9px] sm:text-[10px] mt-1">su {activeMacro.levels.length * 100} max</span>
              </div>
              <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center shadow-inner">
                <span className="text-slate-400 font-mono text-[10px] sm:text-xs uppercase mb-1">Stelle Totali</span>
                <div className="flex items-center gap-1.5 sm:gap-2"><Star className="text-yellow-400 fill-yellow-400 w-4 h-4 sm:w-5 sm:h-5" /><span className="text-2xl sm:text-3xl font-black text-white">{levelStats.reduce((acc, curr) => acc + curr.stars, 0)}</span></div>
                <span className="text-slate-500 text-[9px] sm:text-[10px] mt-1">su {activeMacro.levels.length * 3} max</span>
              </div>
            </div>
            <div className="w-full bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-xl p-3 sm:p-4 mb-5 sm:mb-6 flex items-center justify-between">
              <div className="text-left">
                <span className="text-blue-300 font-bold uppercase tracking-wider text-[11px] sm:text-xs">Voto del Modulo</span>
                <p className="text-slate-300 text-[10px] sm:text-xs mt-0.5">Valutazione basata su questa unità.</p>
              </div>
              <div className="bg-black/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-blue-500/50">
                <span className="text-xl sm:text-2xl font-black text-blue-400">{Math.max(2, Math.min(10, (currentScore / (activeMacro.levels.length * 100)) * 10)).toFixed(1)}<span className="text-xs sm:text-sm text-slate-500">/10</span></span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
              <button onClick={returnToMenu} className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all active:scale-95">
                <LayoutGrid size={16} className="sm:w-[18px] sm:h-[18px]" /> Torna al Menu
              </button>
              <button onClick={copyToClipboard} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2.5 sm:py-3 rounded-lg font-bold text-xs sm:text-sm transition-all active:scale-95 shadow-md hover:shadow-lg">
                <Copy size={16} className="sm:w-[18px] sm:h-[18px]" /> Copia Voto
              </button>
            </div>
          </div>
        </div>
      ) : showBriefing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-900 relative overflow-y-auto overflow-x-hidden">
          <div className="absolute top-1/4 left-1/4 w-40 sm:w-64 h-40 sm:h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-48 sm:w-80 h-48 sm:h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.7s' }}></div>
          <div className="z-10 max-w-3xl w-full flex flex-col items-center text-center space-y-6 sm:space-y-8 my-auto py-8">
            <div className={`transition-all duration-700 transform ${animStep >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
              <div className="bg-blue-600/20 p-4 sm:p-5 rounded-full inline-block mb-3 sm:mb-4 shadow-[0_0_30px_rgba(37,99,235,0.3)]"><BookOpen className="text-blue-400 animate-bounce w-10 h-10 sm:w-14 sm:h-14" /></div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-2 sm:mb-3 tracking-tight">Livello {level.id}: {level.title}</h2>
              <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-blue-900/50 text-blue-300 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full font-mono text-xs sm:text-sm border border-blue-700/50"><Sparkles size={14} className="sm:w-4 sm:h-4" /><span>Concetto Chiave: {level.hint.title}</span></div>
            </div>
            <div className={`w-full bg-slate-800/80 backdrop-blur-sm border border-slate-700 p-5 sm:p-8 rounded-xl sm:rounded-2xl shadow-xl transition-all duration-700 transform ${animStep >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
              <p className="text-base sm:text-xl text-slate-300 leading-relaxed font-medium">{level.hint.theory}</p>
            </div>
            <div className={`w-full bg-black/80 border border-green-900/50 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-2xl transition-all duration-700 transform ${animStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="flex items-center gap-2 mb-3 sm:mb-4 text-slate-400 border-b border-slate-800 pb-2 sm:pb-3"><Terminal size={16} className="text-green-500 sm:w-[18px] sm:h-[18px]" /><span className="text-xs sm:text-sm font-mono uppercase tracking-wider font-bold text-green-500/80">Esempio Pratico</span></div>
              <pre className="text-green-400 font-mono text-left text-sm sm:text-xl overflow-x-auto whitespace-pre-wrap">{level.hint.example}</pre>
            </div>
            <div className={`transition-all duration-700 transform ${animStep >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <button onClick={() => setShowBriefing(false)} className="group flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] hover:scale-105 active:scale-95">
                <Terminal className="group-hover:animate-pulse w-5 h-5 sm:w-6 sm:h-6" /> Entra nel Terminale <ArrowRight className="group-hover:translate-x-2 transition-transform w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        // OVERFLOW-Y-AUTO su main per permettere lo scorrimento dei blocchi impilati su Mobile
        <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          
          {/* PANNELLO SINISTRO (EDITOR). Rimosso overflow-hidden su mobile, ora il pannello può allungarsi spingendo la console */}
          <div className="w-full lg:w-1/2 flex-none lg:flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 min-h-[70vh] lg:min-h-0 lg:h-full lg:overflow-hidden">
            <div className="p-3 sm:p-4 bg-slate-900/50 flex-none border-b border-slate-800">
              <div className="flex justify-between items-start mb-1.5 sm:mb-2">
                <div>
                  <span className="text-blue-400 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider">Query {currentSubLevelIndex + 1} di 5</span>
                  <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">{level.title}</h2>
                </div>
                <button onClick={() => setShowHint(!showHint)} className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md transition-colors border border-slate-700"><HelpCircle size={12} className={`sm:w-[14px] sm:h-[14px] ${showHint ? "text-amber-400" : ""}`} />{showHint ? 'Chiudi Aiuto' : 'Aiuto'}</button>
              </div>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{level.description}</p>
            </div>
            {showHint && (
              <div className="mx-3 sm:mx-4 my-2 bg-amber-900/20 border border-amber-500/30 rounded-lg p-2.5 sm:p-3 flex-none animate-in fade-in slide-in-from-top-4">
                <h3 className="text-amber-400 font-bold mb-1 sm:mb-1.5 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">💡 Flashcard: {level.hint.title}</h3>
                <p className="text-slate-300 mb-1.5 sm:mb-2 text-[11px] sm:text-xs leading-relaxed">{level.hint.theory}</p>
                <div className="bg-black/50 p-2 rounded text-[10px] sm:text-xs font-mono text-amber-200 border border-amber-900/50">{level.hint.example}</div>
              </div>
            )}
            <div className="flex-1 flex flex-col p-3 sm:p-4 pt-2 sm:pt-3 min-h-[150px] lg:min-h-0">
              <div className="flex-1 bg-slate-900 rounded-lg border border-slate-700 flex flex-col overflow-hidden shadow-inner min-h-[100px] lg:min-h-0">
                <div className="bg-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 border-b border-slate-700 flex justify-between items-center flex-none">
                  <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase">query.sql</span><span className="text-[9px] sm:text-[10px] font-mono text-blue-400">PostgreSQL/MySQL</span>
                </div>
                {/* L'editor di testo */}
                <textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scrivi qui la tua query..." className="flex-1 w-full bg-transparent text-green-400 font-mono p-2 sm:p-3 focus:outline-none resize-none text-sm sm:text-base selection:bg-blue-500/30" spellCheck="false" />
              </div>
              <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 flex-none">
                <button onClick={handleRunQuery} className="flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm transition-all hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] active:scale-95"><Play size={14} className="sm:w-4 sm:h-4" /> Esegui Query</button>
                {(output?.type === 'success' || output?.type === 'table') && (
                  <button onClick={handleNextLevel} className="flex justify-center items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm transition-all animate-pulse hover:animate-none">
                    {currentSubLevelIndex < activeMacro.levels.length - 1 ? 'Prossima Query' : 'Completa Modulo'} <ChevronRight size={14} className="sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* CONSOLE: Altezza fissa e garantita su mobile per prevenire overlap e scivolare fluidamente in basso */}
            <div className="flex-none h-48 sm:h-56 lg:h-[35%] lg:min-h-[140px] bg-black border-t border-slate-800 p-2.5 sm:p-3 font-mono text-[11px] sm:text-xs overflow-y-auto">
              <div className="text-slate-500 mb-1.5 sm:mb-2">-- Output Console</div>
              {!output && <div className="text-slate-600 italic">In attesa di esecuzione...</div>}
              {output?.type === 'error' && (
                <div className="flex flex-col gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className="flex items-start gap-1.5 sm:gap-2 text-red-400 bg-red-950/30 p-2 sm:p-3 rounded border border-red-900/50"><XCircle size={14} className="sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" /><span>{output.message}</span></div>
                  {!aiFeedback && !isAiLoading && (
                    <button onClick={handleAskAI} className="self-start flex items-center gap-1.5 sm:gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-bold transition-colors"><Sparkles size={12} className="sm:w-[14px] sm:h-[14px] text-indigo-400" />Chiedi un indizio al Tutor AI ✨</button>
                  )}
                  {isAiLoading && <div className="flex items-center gap-1.5 sm:gap-2 text-indigo-400 bg-indigo-950/20 p-2 sm:p-3 rounded border border-indigo-900/50 animate-pulse"><Loader2 size={14} className="sm:w-4 sm:h-4 animate-spin" /><span>Il Tutor AI sta analizzando la tua query...</span></div>}
                  {aiFeedback && (
                    <div className="flex items-start gap-1.5 sm:gap-2 text-indigo-200 bg-indigo-900/30 p-2.5 sm:p-3 rounded-lg border border-indigo-500/40 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-400 to-purple-500"></div><Bot size={14} className="sm:w-4 sm:h-4 mt-0.5 flex-shrink-0 text-indigo-400" /><span className="leading-relaxed whitespace-pre-wrap">{aiFeedback}</span>
                    </div>
                  )}
                </div>
              )}
              {output?.type === 'success' && <div className="flex items-start gap-1.5 sm:gap-2 text-green-400 bg-green-950/30 p-2 sm:p-2.5 rounded border border-green-900/50 mb-2 sm:mb-3"><CheckCircle size={12} className="sm:w-[14px] sm:h-[14px] mt-0.5 flex-shrink-0" /><span>{output.message}</span></div>}
              {output?.type === 'table' && (
                <><div className="flex items-start gap-1.5 sm:gap-2 text-green-400 bg-green-950/30 p-2 sm:p-2.5 rounded border border-green-900/50 mb-2 sm:mb-3"><CheckCircle size={12} className="sm:w-[14px] sm:h-[14px] mt-0.5 flex-shrink-0" /><span>{output.message}</span></div>{renderTable("Risultato Query", output.data)}</>
              )}
            </div>
          </div>
          
          {/* PANNELLO DESTRO (DATABASE/ER). Flex-none su mobile per permettere scroll della pagina. */}
          <div className="w-full lg:w-1/2 flex-none lg:flex-1 bg-slate-900 p-3 sm:p-4 min-h-[50vh] lg:min-h-0 lg:h-full overflow-y-auto flex flex-col border-t lg:border-t-0 border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2 flex-none">
              <div className="flex items-center gap-1.5 sm:gap-2 text-slate-300">
                {viewMode === 'data' ? <Database size={16} className="sm:w-[18px] sm:h-[18px] text-blue-400" /> : <Network size={16} className="sm:w-[18px] sm:h-[18px] text-indigo-400" />}
                <h2 className="text-base sm:text-lg font-bold">{viewMode === 'data' ? 'Database Corrente' : 'Modello E-R'}</h2>
              </div>
              <div className="flex w-full sm:w-auto bg-slate-800 rounded-lg p-1 border border-slate-700 shadow-inner">
                 <button onClick={() => setViewMode('data')} className={`flex-1 sm:flex-none justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 ${viewMode === 'data' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}><TableIcon size={12} className="sm:w-[14px] sm:h-[14px]" /> Dati</button>
                 <button onClick={() => setViewMode('er')} className={`flex-1 sm:flex-none justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 ${viewMode === 'er' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}><Network size={12} className="sm:w-[14px] sm:h-[14px]" /> Grafico</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
              {viewMode === 'data' ? (
                <div className="space-y-3 sm:space-y-4">
                  {Object.entries(db).map(([tableName, data]) => renderTable(tableName, data))}
                  <div className="mt-6 sm:mt-8 bg-slate-800/50 rounded-lg p-2.5 sm:p-3 border border-slate-700/50">
                    <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 mb-1.5 sm:mb-2 uppercase tracking-wider">Legenda Struttura</h3>
                    <ul className="text-[9px] sm:text-xs space-y-1.5 sm:space-y-2 text-slate-400 font-mono">
                      <li className="flex items-center gap-1.5 sm:gap-2"><Key size={8} className="sm:w-[10px] sm:h-[10px] text-amber-400" /> Primary Key</li>
                      <li className="flex items-center gap-1.5 sm:gap-2"><Key size={8} className="sm:w-[10px] sm:h-[10px] text-slate-400" /> Foreign Key</li>
                      <li className="flex items-center gap-1.5 sm:gap-2"><span className="text-slate-500 italic font-bold bg-slate-900 px-1 sm:px-1.5 py-0.5 rounded border border-slate-700">NULL</span> Assenza di dato</li>
                    </ul>
                  </div>
                </div>
              ) : <ERDiagram db={db} />}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
