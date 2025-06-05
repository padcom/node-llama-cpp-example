#!/usr/bin/env node

import {fileURLToPath} from "url";
import path from "path";
import readline from 'readline';
import {getLlama, LlamaChatSession} from "node-llama-cpp";
import { functions } from './functions.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "models", "Llama-3-8B-Instruct-GGUF-Q4_K_M.gguf")
    // modelPath: path.join(__dirname, "models", "DeepSeek-R1-0528-Qwen3-8B-Q3_K_S.gguf")
});
const context = await model.createContext();
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});

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

    process.stdout.write('Asystent: ')
    const answer = await session.prompt(question, {
        onTextChunk(text) {
            process.stdout.write(text)
        },
        functions,
    })
    console.log()

    rl.prompt();
})
