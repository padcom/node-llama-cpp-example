#!/usr/bin/env node
// Importujemy potrzebne moduły
import { getLlama, LlamaChatSession } from 'node-llama-cpp';  // Biblioteka node-llama-cpp do lokalnego uruchamiania modelu LLM
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import readline from 'readline';

// Ustalamy katalog roboczy (potrzebne do ESM)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
    // 1. Inicjalizacja modelu Llama
    // --------------------------------
    // Tworzymy instancję Llama oraz ładujemy lokalny model GGUF (np. Mistral-7B lub Llama-2)
    const llama = await getLlama();
    const modelPath = path.join(__dirname, 'models', 'Llama-3-8B-Instruct-GGUF-Q4_K_M.gguf');  // Ścieżka do pliku modelu
    console.log('Wczytywanie modelu z:', modelPath);
    const model = await llama.loadModel({ modelPath });  // Ładujemy model
    // --------------------------------

    // 2. Przygotowanie kontekstu embeddingów
    // --------------------------------
    // Tworzymy kontekst do generowania embeddingów. Użyjemy go do embedowania dokumentów i zapytań.
    const embContext = await model.createEmbeddingContext();  // :contentReference[oaicite:5]{index=5}

    // 3. Wczytanie dokumentów wiedzy
    // --------------------------------
    // Czytamy wszystkie pliki .txt z katalogu 'knowledge/' i obliczamy dla nich embeddingi.
    const knowledgeDir = path.join(__dirname, 'knowledge');
    let knowledgeFiles = [];
    try {
        knowledgeFiles = await fs.readdir(knowledgeDir);
    } catch (err) {
        console.error('Błąd wczytywania katalogu knowledge:', err);
        process.exit(1);
    }
    // Filtrujemy tylko pliki .txt
    knowledgeFiles = knowledgeFiles.filter(file => file.endsWith('.txt') || file.endsWith('.md'));
    if (knowledgeFiles.length === 0) {
        console.warn('Katalog knowledge jest pusty lub nie zawiera plików .txt.');
    }
    // Mapa dokument -> { content, embedding }
    const docMap = new Map();
    console.log(`Wczytywanie bazy wiedzy (${knowledgeFiles.length} plików)...`);
    for (const file of knowledgeFiles) {
        const filePath = path.join(knowledgeDir, file);
        try {
            const content = await fs.readFile(filePath, 'utf-8');  // Wczytujemy zawartość pliku
            // Tworzymy embedding dokumentu (można rozważyć dzielenie dużych dokumentów na fragmenty)
            const embedding = await embContext.getEmbeddingFor(content);  // :contentReference[oaicite:6]{index=6}
            docMap.set(file, { content, embedding });
            console.log(`  Dokument ${file} załadowany i zembedowany.`);
        } catch (err) {
            console.error(`  Błąd czytania pliku ${file}:`, err);
        }
    }
    // --------------------------------

    // 4. Inicjalizacja sesji czatu
    // --------------------------------
    // Tworzymy nowy kontekst czatu i instancję LlamaChatSession (historia rozmowy).
    const chatContext = await model.createContext();
    const session = new LlamaChatSession({ contextSequence: chatContext.getSequence() });  // :contentReference[oaicite:7]{index=7}
    console.log('Gotowy do czatu. Zadaj pytanie (wpisz "exit", aby zakończyć).');
    // --------------------------------

    // 5. Interaktywna pętla czatu
    // --------------------------------
    // Korzystamy z readline do odczytu pytań od użytkownika w terminalu.
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    rl.setPrompt('Użytkownik: ');
    rl.prompt();
    rl.on('line', async (line) => {
        const question = line.trim();
        if (!question) {
            rl.prompt();
            return;
        }
        // Możliwość zakończenia czatu
        if (question.toLowerCase() === 'exit' || question.toLowerCase() === 'wyjdz' || question.toLowerCase() === 'koniec') {
            console.log('Zakończono czat.');
            rl.close();
            return;
        }

        // 5.a Obliczanie embeddingu zapytania
        const queryEmbedding = await embContext.getEmbeddingFor(question);

        // 5.b Wyszukiwanie najbardziej podobnych dokumentów
        // Obliczamy podobieństwo kosinusowe względem każdego dokumentu i sortujemy.
        const similarities = [];
        for (const [file, { embedding: docEmb }] of docMap.entries()) {
            // calculateCosineSimilarity zwraca liczbę, większa = bardziej podobne:contentReference[oaicite:8]{index=8}
            const sim = queryEmbedding.calculateCosineSimilarity(docEmb);  // :contentReference[oaicite:9]{index=9}
            similarities.push({ file, score: sim });
        }
        similarities.sort((a, b) => b.score - a.score);  // Sortujemy malejąco
        // Wybieramy np. top 3 najbardziej podobne dokumenty (jeśli są dostępne)
        const topK = 3;
        const topDocs = similarities.slice(0, topK).map(item => item.file).filter(Boolean);

        // 5.c Budowanie prompta z kontekstem i pytaniem
        // Łączymy treść wybranych dokumentów jako dodatkowy kontekst dla modelu.
        let contextText = '';
        for (const docName of topDocs) {
            const docContent = docMap.get(docName).content;
            contextText += `Dokument (${docName}):\n${docContent}\n---\n`;
        }
        const fullPrompt = `Oto fragmenty dokumentów:\n${contextText}\nPytanie: ${question}\nOdpowiedź:`;

        // 5.d Generowanie odpowiedzi przez model
        console.log('Asystent: (myślę...)');
        const answer = await session.prompt(fullPrompt);  // Model generuje odpowiedź:contentReference[oaicite:10]{index=10}
        console.log('Asystent:', answer.trim());

        rl.prompt();
    });
})();
