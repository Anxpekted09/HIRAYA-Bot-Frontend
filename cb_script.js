// --- 1. CONFIGURATION ---
const WINDOW_WIDTH = 350; 
const WINDOW_HEIGHT = 500;
const SPACING = 10;

// Base URL of your Render backend. Update this if your deployed URL is different.
// NOTE: your Express backend must have CORS enabled for your GitHub Pages origin
// (e.g. app.use(cors())) or the browser will block this fetch entirely.
const API_BASE_URL = "https://hiraya-bot.onrender.com";


// --- 2. SETUP TARGETS ---
const chatBtn = document.getElementById("chatBtn");
const chatWindow = document.getElementById("chatWindow");

// --- 3. STATE VARIABLES ---
let isDragging = false;
let hasMoved = false;
let startX, startY;
let initialBtnLeft, initialBtnTop;

// --- 4. THE POSITIONING ENGINE 🧠 ---
function updateLayout() {
    const btnRect = chatBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // --- WINDOW POSITIONING ---
    // Try to place window ABOVE the button first
    let winTop = btnRect.top - WINDOW_HEIGHT - SPACING;
    let winLeft = btnRect.right - WINDOW_WIDTH;

    // 1. Vertical Check: If not enough space above, go BELOW
    if (winTop < 0) {
        winTop = btnRect.bottom + SPACING;
    }

    // 2. Horizontal Check: If dragging too far left, align left
    if (winLeft < 0) {
        winLeft = btnRect.left;
    }
    
    // 3. Right Edge Check: If dragging too far right, push window back
    if (winLeft + WINDOW_WIDTH > viewportWidth) {
        winLeft = viewportWidth - WINDOW_WIDTH - SPACING;
    }

    // Apply Window Position
    chatWindow.style.top = winTop + "px";
    chatWindow.style.left = winLeft + "px";
    chatWindow.style.transform = "none";
}

// --- 5. DRAG LOGIC (Simplified & Robust) ---

chatBtn.addEventListener("mousedown", (e) => {
    isDragging = true;
    hasMoved = false;
    
    // Record start positions
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = chatBtn.getBoundingClientRect();
    initialBtnLeft = rect.left;
    initialBtnTop = rect.top;

    // Allow button to move freely
    chatBtn.style.bottom = "auto";
    chatBtn.style.right = "auto";
    chatBtn.style.left = initialBtnLeft + "px";
    chatBtn.style.top = initialBtnTop + "px";
    
    chatBtn.style.cursor = "grabbing";
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
    }

    // Calculate new button position
    let newLeft = initialBtnLeft + dx;
    let newTop = initialBtnTop + dy;

    // Boundary Checks for Button (Keep on screen)
    const maxLeft = window.innerWidth - chatBtn.offsetWidth;
    const maxTop = window.innerHeight - chatBtn.offsetHeight;
    
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    // Apply Move
    chatBtn.style.left = newLeft + "px";
    chatBtn.style.top = newTop + "px";

    // If chat is open, drag the window WITH the button
    if (chatWindow.style.display === "flex") {
        updateLayout();
    }
});

document.addEventListener("mouseup", () => {
    isDragging = false;
    chatBtn.style.cursor = "pointer";
});

// --- 6. CLICK TOGGLE ---

chatBtn.addEventListener("click", () => {
    if (hasMoved) return; // Ignore if it was a drag

    if (chatWindow.style.display === "none" || chatWindow.style.display === "") {
        // OPEN
        chatWindow.style.display = "flex";
        chatBtn.textContent = "Close ✖️";
        updateLayout(); // Snap window to button immediately
    } else {
        // CLOSE
        chatWindow.style.display = "none";
        chatBtn.textContent = "Chat 💬";
    }
});

// --- 7. RESIZE FIX ---
window.addEventListener("resize", () => {
    if (chatWindow.style.display === "flex") {
        updateLayout();
    }
});

// ------- SENDING A MESSAGE ------
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chatBody = document.getElementById("chatBody");


// ==============================================================================================
// SECTION 8: FAQ DATA (NOW LOADED FROM THE BACKEND — NOT HARDCODED)
// ==============================================================================================
// This used to be a hardcoded array. It's now populated at runtime by loadFaqsFromBackend()
// in Section 10, using the data your Express API returns from MongoDB Atlas. `faqs` starts
// empty and the NLP engine (Section 10/11) isn't built until it's filled in.
let faqs = [];

// Small local safety net — used ONLY if the backend can't be reached (network failure,
// Render cold-start timeout, etc.) so a demo doesn't go completely silent.
const FALLBACK_FAQS = [
    {
        intent: "greeting",
        questions: ["hello", "hi", "good morning", "help", "kumusta"],
        answer: "Hello! 👋 I'm having trouble reaching my full knowledge base right now, but I can still try to help — ask me about tuition, enrollment, or admission requirements."
    },
    {
        intent: "offline_contact",
        questions: ["contact", "help", "talk to someone"],
        answer: `I can't reach my knowledge base at the moment. 😔<br><br>Please reach us directly:<br>📧 <a href="mailto:info@ama.edu.ph">info@ama.edu.ph</a><br>🌐 <a href="https://www.ama.edu.ph" target="_blank">www.ama.edu.ph</a>`
    }
];


// ================================================================
// SECTION 9: NLP ENGINE
// ================================================================

// ----------------------------------------------------------------
// PART A: STOPWORDS
// ----------------------------------------------------------------
const STOPWORDS = new Set([
    "a", "an", "the", "is", "it", "in", "on", "at", "to", "for",
    "of", "and", "or", "but", "i", "my", "me", "we", "you", "your",
    "he", "she", "they", "this", "that", "what", "which", "who",
    "how", "when", "where", "why", "do", "does", "did", "are",
    "was", "were", "be", "been", "being", "have", "has", "had",
    "will", "would", "can", "could", "should", "may", "might",
    "shall", "am", "its", "our", "their", "there", "here", "just",
    "about", "any", "some", "no", "not", "so", "if", "then", "than",
    "po", "ba", "yung", "ang", "ng", "sa", "na", "mga", "ko", "mo",
    "nang", "nga",
    // Tagalog question/filler words (same job as "how", "when", "where" above)
    "paano", "kailan", "saan", "nasaan", "ano", "anong", "bakit", "hanggang",
    "pwede", "pwedeng", "kayo", "meron", "may", "mag", "ako", "akin", "ka",
    "pa", "rin", "din", "para", "pero", "kung", "lang", "until",
    "akong", "kong", "ninyo",
    // The school's own name appears in every topic, so it can't tell topics apart
    "ama"
]);

// Program names (BSIT, Data Science, ...) are treated as ONE shared token so the
// topic word ("tuition", "loan", "offer") decides the intent, not which program was named.
const PROGRAM_NAMES = /\b(bsit|bscs|bsba|bscpe|cybersecurity|data science|computer engineering|computer science|artificial intelligence|information technology|business administration|ai)\b/g;

// ----------------------------------------------------------------
// PART B: TEXT PREPROCESSOR
// ----------------------------------------------------------------
function preprocessText(text) {
    text = text.toLowerCase();
    text = text.replace(PROGRAM_NAMES, " progname ");
    text = text.replace(/[^a-z0-9\s]/g, "");
    let words = text.split(/\s+/);
    words = words.filter(word => word.length > 0 && !STOPWORDS.has(word));
    words = words.map(word => basicStem(word));
    return words;
}

// ----------------------------------------------------------------
// PART C: BASIC STEMMER
// ----------------------------------------------------------------
function basicStem(word) {
    if (word.length <= 3) return word;
    const suffixes = ["ing", "tion", "ment", "ness", "ies", "ed", "er", "ly", "es", "s"];
    for (let suffix of suffixes) {
        if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
            return word.slice(0, word.length - suffix.length);
        }
    }
    return word;
}

// ----------------------------------------------------------------
// PART D: TF-IDF VECTORIZER
// ----------------------------------------------------------------
function buildCorpus() {
    const corpus = [];
    faqs.forEach(function(faq) {
        faq.questions.forEach(function(question) {
            corpus.push(preprocessText(question));
        });
    });
    return corpus;
}

function computeIDF(corpus) {
    const idf = {};
    const totalDocs = corpus.length;
    corpus.forEach(function(doc) {
        const uniqueWords = new Set(doc);
        uniqueWords.forEach(function(word) {
            idf[word] = (idf[word] || 0) + 1;
        });
    });
    Object.keys(idf).forEach(function(word) {
        idf[word] = Math.log(totalDocs / idf[word]) + 1;
    });
    return idf;
}

function computeTFIDF(words, idfScores) {
    const tf = {};
    const vector = {};
    const totalWords = words.length || 1;
    words.forEach(function(word) {
        tf[word] = (tf[word] || 0) + 1;
    });
    Object.keys(tf).forEach(function(word) {
        const tfScore = tf[word] / totalWords;
        const idfScore = idfScores[word] || 1;
        vector[word] = tfScore * idfScore;
    });
    return vector;
}

// ----------------------------------------------------------------
// PART E: COSINE SIMILARITY
// ----------------------------------------------------------------
function cosineSimilarity(vectorA, vectorB) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    Object.keys(vectorA).forEach(function(word) {
        dotProduct += vectorA[word] * (vectorB[word] || 0);
        magnitudeA += vectorA[word] ** 2;
    });
    Object.keys(vectorB).forEach(function(word) {
        magnitudeB += vectorB[word] ** 2;
    });
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
}

// ----------------------------------------------------------------
// PART F: NAIVE BAYES CLASSIFIER
// ----------------------------------------------------------------
function trainNaiveBayes() {
    const intentWordCounts = {};  
    const intentTotals = {};      
    const vocab = new Set();      

    faqs.forEach(function(faq) {
        const intent = faq.intent;
        if (!intentWordCounts[intent]) {
            intentWordCounts[intent] = {};
            intentTotals[intent] = 0;
        }
        faq.questions.forEach(function(question) {
            const words = preprocessText(question);
            words.forEach(function(word) {
                vocab.add(word);
                intentWordCounts[intent][word] = (intentWordCounts[intent][word] || 0) + 1;
                intentTotals[intent]++;
            });
        });
    });
    return { intentWordCounts, intentTotals, vocab };
}

function predictIntent(words, model) {
    const { intentWordCounts, intentTotals, vocab } = model;
    const vocabSize = vocab.size;
    const intents = Object.keys(intentWordCounts);

    let bestIntent = null;
    let bestScore = -Infinity;

    intents.forEach(function(intent) {
        let score = Math.log(1 / intents.length);
        words.forEach(function(word) {
            const wordCount = (intentWordCounts[intent][word] || 0) + 1;
            const total = intentTotals[intent] + vocabSize;
            score += Math.log(wordCount / total);
        });
        if (score > bestScore) {
            bestScore = score;
            bestIntent = intent;
        }
    });
    return bestIntent;
}

// ================================================================
// SECTION 10: START UP THE AI (NOW ASYNC — WAITS FOR THE BACKEND)
// ================================================================
let corpus = [];
let idfScores = {};
let nbModel = null;
let faqVectors = [];
let isChatbotReady = false;

// Pulls FAQ documents from your Express/MongoDB backend.
// Expects each record shaped like { intent, questions: [...], answer } —
// matching the Faqs schema described in your Chapter 3 Data Layer.
async function loadFaqsFromBackend() {
    const response = await fetch(`${API_BASE_URL}/api/faqs`);
    if (!response.ok) {
        throw new Error(`Backend responded with status ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Backend returned no FAQ records");
    }
    return data;
}

// Builds the TF-IDF corpus, IDF scores, Naive Bayes model, and FAQ vectors
// from whatever is currently in `faqs` (backend data, or the fallback set).
function buildNlpEngine() {
    corpus = buildCorpus();
    idfScores = computeIDF(corpus);
    nbModel = trainNaiveBayes();

    faqVectors = [];
    faqs.forEach(function(faq) {
        faq.questions.forEach(function(question) {
            const words = preprocessText(question);
            const vector = computeTFIDF(words, idfScores);
            faqVectors.push({ vector: vector, faq: faq });
        });
    });
}

async function initChatbot() {
    addMessage("Connecting to Hiraya Bot's knowledge base... ⏳", "bot");

    try {
        faqs = await loadFaqsFromBackend();
    } catch (err) {
        console.warn("Could not load FAQs from backend, using local fallback:", err);
        faqs = FALLBACK_FAQS;
    }

    buildNlpEngine();
    isChatbotReady = true;

    // Swap the "connecting..." bubble for a ready message
    const connectingBubble = chatBody.lastElementChild;
    if (connectingBubble) connectingBubble.remove();
    addMessage("Hello! I'm Hiraya Bot 🤖, how can I help you? Ask me about tuition, enrollment, courses, or admission requirements.", "bot");
}

// ================================================================
// SECTION 11: BOT BRAIN
// ================================================================
function getBotResponse(userMessage) {
    const SIMILARITY_THRESHOLD = 0.15;
    const userWords = preprocessText(userMessage);

    if (userWords.length === 0) {
        return "I didn't quite catch that. Could you rephrase your question?";
    }

    const userVector = computeTFIDF(userWords, idfScores);

    let bestFAQ = null;
    let bestSimilarity = 0;

    faqVectors.forEach(function(item) {
        const similarity = cosineSimilarity(userVector, item.vector);
        if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestFAQ = item.faq;
        }
    });

    if (bestSimilarity >= SIMILARITY_THRESHOLD && bestFAQ) {
        return bestFAQ.answer;
    }

    const predictedIntent = predictIntent(userWords, nbModel);
    const intentFAQ = faqs.find(function(faq) {
        return faq.intent === predictedIntent;
    });
    if (intentFAQ) return intentFAQ.answer;

    return `I'm sorry, I don't have information about that yet. 😔
<br><br>
For further assistance, you may reach us through:
<br><br>
🌐 <a href="https://www.ama.edu.ph" target="_blank">www.ama.edu.ph</a>
<br>
📧 <a href="mailto:info@ama.edu.ph">info@ama.edu.ph</a>
<br>
📘 <a href="https://www.facebook.com/AMAEducationSystem" target="_blank">AMA Education System on Facebook</a>`;
}

// ================================================================
// SECTION 12: PROFANITY FILTER
// ================================================================

// Single words — word boundary \b works correctly for these
const BAD_WORDS_SINGLE = [
    "fuck", "shit", "bitch", "asshole", "dick", "pussy", "stupid",
    "putangina", "gago", "bobo", "tarantado", "tangina", "ulol",
    "pakyu", "inamo", "leche", "hayop", "ul0l", "sex", 
];

// Multi-word phrases — handled separately without \b
// because \b only works reliably on single-word boundaries
const BAD_WORDS_PHRASES = [
    "anak ng puta",
    "fuck you",
];

function censorText(text) {
    let result = text;

    // Step 1: Catch multi-word phrases first
    BAD_WORDS_PHRASES.forEach(function(phrase) {
        const phraseRegex = new RegExp(
            phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"
        );
        result = result.replace(phraseRegex, function(match) {
            return "*".repeat(match.length);
        });
    });

    // Step 2: Catch single bad words using word boundaries
    // \b prevents "glass" from accidentally triggering "ass"
    const singleRegex = new RegExp("\\b(" + BAD_WORDS_SINGLE.join("|") + ")\\b", "gi");
    result = result.replace(singleRegex, function(match) {
        return "*".repeat(match.length);
    });

    return result;
}


// ================================================================
// SECTION 13: MESSAGE HANDLING
// ================================================================
// Adds a message bubble to the chat window
function addMessage(text, type) {
    const bubble = document.createElement("div");

    if (type === "user") {
        bubble.textContent = text;
        bubble.classList.add("user-message");
    } else {
        bubble.innerHTML = text;
        bubble.classList.add("bot-message");
    }

    chatBody.appendChild(bubble);

    // Always scroll down to show the newest message
    chatBody.scrollTop = chatBody.scrollHeight;
}

function showTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("typing-indicator");
    typingDiv.id = "typingIndicator";
    typingDiv.innerHTML = "<span></span><span></span><span></span>";
    chatBody.appendChild(typingDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    if (indicator) indicator.remove();
}

// Main send message function
function sendMessage() {
    const rawMessage = userInput.value.trim();

    if (rawMessage === "") return;

    // Guard: don't try to answer before the FAQ dataset has finished loading
    if (!isChatbotReady) {
        addMessage("I'm still connecting to my knowledge base — one moment please! ⏳", "bot");
        return;
    }

    
    const censoredMessage = censorText(rawMessage);
    
    
    const isNaughty = (censoredMessage !== rawMessage);

    
    addMessage(censoredMessage, "user");
    userInput.value = "";

    // Show the "..." typing dots
    showTypingIndicator();

    const thinkingTime = 800 + Math.random() * 700;
    setTimeout(function() {
        removeTypingIndicator();
        
        
        if (isNaughty) {
            addMessage("⚠️ Please maintain respectful language. How can I help you with your university inquiries?", "bot");
        } else {
            const response = getBotResponse(censoredMessage);
            addMessage(response, "bot");
        }
    }, thinkingTime);
}

sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});

// ================================================================
// SECTION 14: BOOT
// ================================================================
// Kick off the backend fetch + NLP build as soon as the script runs.
initChatbot();