import { Database, ListFilter, Network, Table as TableIcon } from 'lucide-react';

const normalize = (q) => q.toLowerCase().replace(/\s+/g, ' ').replace(/;/g, '').trim();

export const SQL_MODULES = [
  {
    id: 'macro_1',
    type: 'query',
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
    type: 'query',
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
    type: 'query',
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
    type: 'query',
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

export const INITIAL_DB = {
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

export const getDbForMacro = (macroIndex) => {
  const db = JSON.parse(JSON.stringify(INITIAL_DB)); 
  if (macroIndex >= 3) {
    const stagista = db.dipendenti.find(d => d.ruolo === 'Stagista');
    if (stagista) stagista.stipendio = 1200;
    db.dipendenti = db.dipendenti.filter(d => d.id !== 5);
    db.progetti = [{ id: 1, nome: 'Rinnovo Portale', budget: 60000 }];
  }
  return db;
};
