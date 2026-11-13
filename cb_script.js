// --- 1. CONFIGURATION ---
const WINDOW_WIDTH = 350; 
const WINDOW_HEIGHT = 500;
const SPACING = 10; // Gap between button and window


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
    // Get current button position
    const btnRect = chatBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // FIX: on small screens (phones) the fixed 350x500 window was wider/taller than the
    // screen. Shrink it to fit, then keep it fully on screen below.
    const winWidth = Math.min(WINDOW_WIDTH, viewportWidth - 2 * SPACING);
    const winHeight = Math.min(WINDOW_HEIGHT, viewportHeight * 0.8);
    chatWindow.style.width = winWidth + "px";
    chatWindow.style.height = winHeight + "px";

    // --- WINDOW POSITIONING ---
    // Try to place window ABOVE the button first
    let winTop = btnRect.top - winHeight - SPACING;
    let winLeft = btnRect.right - winWidth;

    // 1. Vertical Check: If not enough space above, go BELOW
    if (winTop < 0) {
        winTop = btnRect.bottom + SPACING;
    }

    // 2 + 3. Keep the window completely inside the screen (left, right, top AND bottom)
    winTop = Math.max(SPACING, Math.min(winTop, viewportHeight - winHeight - SPACING));
    winLeft = Math.max(SPACING, Math.min(winLeft, viewportWidth - winWidth - SPACING));

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

    // Only count as move if > 3px (prevents accidental clicks)
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
    // FIX: if the button was dragged and the window then got smaller, pull it back on screen
    if (chatBtn.style.left) {
        chatBtn.style.left = Math.max(0, Math.min(parseFloat(chatBtn.style.left), window.innerWidth - chatBtn.offsetWidth)) + "px";
        chatBtn.style.top = Math.max(0, Math.min(parseFloat(chatBtn.style.top), window.innerHeight - chatBtn.offsetHeight)) + "px";
    }
    if (chatWindow.style.display === "flex") {
        updateLayout();
    }
});

// ------- SENDING A MESSAGE ------
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chatBody = document.getElementById("chatBody");


// ================================================================
// SECTION 7.5: BACKEND API CONFIGURATION
// ================================================================
// This is the ONLY line you need to change when moving from testing
// on your own computer to your deployed backend on Render.
//
// Local development (backend running on your own machine):
//   const API_BASE_URL = "http://localhost:5000";
//
// After deploying the backend to Render, replace it with your real URL:
//   const API_BASE_URL = "https://your-app-name.onrender.com";
const API_BASE_URL = "https://hiraya-bot.onrender.com";


// ================================================================
// SECTION 8: FAQ DATABASE
// ================================================================
// This USED to contain a hardcoded array of all 8 FAQ topics directly
// inside this file. That data has been MOVED to the backend database
// (MongoDB Atlas -- see backend/seed/faqData.js) so that authorized
// staff can add, edit, or remove FAQ entries WITHOUT touching this
// file or redeploying the chatbot at all.
//
// This starts empty on purpose. initializeChatbot() in Section 10
// below fills it in by fetching the real data from the backend API
// when the page first loads.
let faqs = [];


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
    // FIX: Tagalog question/filler words - same job as "how", "when", "where"
    // above. Without these, "paano makita ang cor ko" and "paano makita ang
    // grades ko" looked alike because of the shared frame words.
    "paano", "kailan", "saan", "nasaan", "ano", "anong", "bakit", "hanggang",
    "pwede", "pwedeng", "kayo", "meron", "may", "mag", "ako", "akin", "ka",
    "pa", "rin", "din", "para", "pero", "kung", "lang", "until",
    "akong", "kong", "ninyo", "sino", "makita", "makikita",
    // FIX: generic verbs that appear in almost every topic ("see my grades", "view my COR",
    // "get a loan", "check my ledger", "cafeteria open") and so say nothing about WHICH topic
    "get", "got", "see", "view", "check", "open", "give", "want",
    // Tagalog pronouns ("our", "we") - say nothing about the topic
    "natin", "namin", "tayo", "kami",
    // The school's own name appears in every topic, so it can't tell topics apart
    "ama"
]);

// FIX: program names (BSIT, Data Science, ...) are treated as ONE shared token, so the
// topic word ("tuition", "loan", "offer") decides the intent - not which program was named.
const PROGRAM_NAMES = /\b(bsit|bscs|bsba|bscpe|cybersecurity|data science|computer engineering|computer science|artificial intelligence|information technology|business administration|ai)\b/g;

// ----------------------------------------------------------------
// PART B: TEXT PREPROCESSOR
// ----------------------------------------------------------------
// fixTypos is only turned on for what the STUDENT types (see correctTypos below), never for the
// training questions.
function preprocessText(text, fixTypos) {
    text = text.toLowerCase();
    text = text.replace(PROGRAM_NAMES, " progname ");
    text = text.replace(/[^a-z0-9\s]/g, "");
    let words = text.split(/\s+/);
    words = words.filter(word => word.length > 0 && !STOPWORDS.has(word));
    if (fixTypos) words = correctTypos(words);
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
        // FIX: minimum root length raised from 3 to 4. Verified by testing:
        // a 3-letter minimum let "tuition" get stemmed down to "tui" - short
        // and ambiguous enough that it started scoring HIGHER for unrelated
        // topics (loan, scholarships - both of which also mention tuition
        // in passing) than for the tuition topic itself. Raising the
        // minimum to 4 keeps "tuition" intact while every other word's
        // stemming behavior (enrolled, requirements, scholarships, etc.)
        // stays exactly the same - confirmed with a side-by-side test.
        if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
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

    // Step 1: compute the raw log-probability score for every intent
    const rawScores = {};
    intents.forEach(function(intent) {
        let score = Math.log(1 / intents.length);
        words.forEach(function(word) {
            const wordCount = (intentWordCounts[intent][word] || 0) + 1;
            const total = intentTotals[intent] + vocabSize;
            score += Math.log(wordCount / total);
        });
        rawScores[intent] = score;
    });

    // Step 2: convert log-scores into real probabilities (0 to 1, summing to 1)
    // using the log-sum-exp trick — subtracting the max score before exponentiating
    // prevents Math.exp() from underflowing to 0 on very negative log-scores.
    const maxScore = Math.max(...Object.values(rawScores));
    let sumExp = 0;
    const expScores = {};
    intents.forEach(function(intent) {
        const e = Math.exp(rawScores[intent] - maxScore);
        expScores[intent] = e;
        sumExp += e;
    });

    let bestIntent = null;
    let bestConfidence = -Infinity;
    intents.forEach(function(intent) {
        const confidence = expScores[intent] / sumExp;
        if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestIntent = intent;
        }
    });

    // Returns BOTH the guess and how confident that guess actually is —
    // a low confidence means "this was just the least-bad option," not
    // a genuine match.
    return { intent: bestIntent, confidence: bestConfidence };
}

// ================================================================
// SECTION 10: FETCH FAQ DATA & START UP THE AI
// ================================================================
// This used to run immediately and synchronously, because "faqs" was
// hardcoded and already available the instant the script loaded. Now
// that FAQ data lives in the database, it must be FETCHED first -
// which takes time, and can fail (e.g. the backend server isn't
// running yet) - so this whole section is wrapped in an async
// function instead.

let isBotReady = false;
let corpus = [];
let idfScores = {};
let nbModel = null;
let faqVectors = [];

// FIX: Render's free tier "falls asleep" when idle and can take up to a minute to wake up.
// The old code waited forever with no timeout and gave up after one failed try. This tries
// up to 3 times (45 seconds each) before showing the error message.
async function fetchFaqsWithRetry() {
    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 45000;
    const WAIT_BETWEEN_MS = 3000;
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(function() { controller.abort(); }, TIMEOUT_MS);
        try {
            const response = await fetch(`${API_BASE_URL}/api/faqs`, { signal: controller.signal });
            clearTimeout(timer);

            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }
            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error("No FAQ data was returned from the database.");
            }
            return data;
        } catch (error) {
            clearTimeout(timer);
            lastError = error;
            console.warn(`FAQ load attempt ${attempt} of ${MAX_ATTEMPTS} failed:`, error);
            if (attempt < MAX_ATTEMPTS) {
                await new Promise(function(resolve) { setTimeout(resolve, WAIT_BETWEEN_MS); });
            }
        }
    }
    throw lastError;
}

let loadingBubble = null;

async function initializeChatbot() {
    showLoadingState();

    try {
        faqs = await fetchFaqsWithRetry();

        // Now that real data actually exists, build the NLP models on
        // top of it - this is the exact same logic as before, just
        // delayed until after the fetch completes.
        corpus = buildCorpus();
        idfScores = computeIDF(corpus);
        nbModel = trainNaiveBayes();
        rawVocab = buildRawVocab();

        faqVectors = [];
        faqs.forEach(function(faq) {
            faq.questions.forEach(function(question) {
                const words = preprocessText(question);
                const vector = computeTFIDF(words, idfScores);
                faqVectors.push({ vector: vector, faq: faq });
            });
        });

        isBotReady = true;
        hideLoadingState();
        console.log(`Hiraya Bot ready \u2014 loaded ${faqs.length} FAQ topics from the database.`);

    } catch (error) {
        console.error("Failed to load FAQ data:", error);
        showConnectionError();
    }
}

// Disables the input while FAQ data is being fetched, so a student
// can't send a message before the bot actually has anything to match against.
function showLoadingState() {
    userInput.disabled = true;
    userInput.placeholder = "Loading knowledge base...";
    sendBtn.disabled = true;
    // FIX: tell the student WHY they are waiting (the server may be waking up)
    if (!loadingBubble) {
        loadingBubble = addMessage("\u23F3 Connecting to my knowledge base... if the server was asleep, this can take up to a minute.", "bot");
    }
}

// Re-enables the input once the bot is fully trained and ready.
function hideLoadingState() {
    userInput.disabled = false;
    userInput.placeholder = "Type here...";
    sendBtn.disabled = false;
    if (loadingBubble) { loadingBubble.remove(); loadingBubble = null; }
}

// Shown if the backend can't be reached at all - e.g. the server isn't
// running, or the URL in API_BASE_URL above is wrong.
function showConnectionError() {
    userInput.disabled = true;
    userInput.placeholder = "Connection error";
    sendBtn.disabled = true;
    if (loadingBubble) { loadingBubble.remove(); loadingBubble = null; }
    const errorBubble = addMessage(
        "\u26A0\uFE0F I'm having trouble connecting to my knowledge base right now. " +
        "Please try again in a moment, or contact the Registrar's Office directly at " +
        "<a href=\"mailto:info@ama.edu.ph\">info@ama.edu.ph</a>.<br><br>",
        "bot"
    );
    // FIX: a "Try again" button so the student doesn't have to reload the whole page
    const retryButton = document.createElement("button");
    retryButton.textContent = "Try again";
    retryButton.style.cssText = "padding:6px 14px;border:none;border-radius:14px;background:#fff;color:#b22b25;font-weight:bold;cursor:pointer;";
    retryButton.addEventListener("click", function() {
        errorBubble.remove();
        initializeChatbot();
    });
    errorBubble.appendChild(retryButton);
}

// Kick off loading as soon as the page loads - this matches "Part 1"
// of the system architecture diagram: fetching FAQ data once, up front.
initializeChatbot();

// ================================================================
// SECTION 10.5: CONVERSATION MEMORY
// ================================================================
// This is what lets the bot "remember" the current topic and ask
// a clarifying question when it isn't sure — instead of guessing
// or repeating a static fallback. Important: the bot NEVER writes
// new answers. It still only ever replies with text already written
// in the FAQ database above. What changes here is WHICH answer it
// decides to give, based on what was just discussed.

let botMemory = {
    lastIntent: null,           // the topic of the last question the bot successfully answered
    pendingClarification: null  // holds two candidate topics while waiting for the student to pick one
};

// Phrases that usually signal "this is a follow-up to my last question",
// e.g. "tuition for BSIT?" -> "what about BSCS?"
const FOLLOWUP_SIGNALS = [
    "what about", "how about", "paano naman", "eh yung", "yun din",
    "same for", "and for", "how much for", "kailan naman", "yan din",
    "what if", "paano po yun", "eh yun"
];

// A message counts as a likely follow-up if it contains one of the
// signal phrases above, OR if it's very short (2 words or fewer once
// stopwords are removed) — short messages rarely carry enough of their
// own meaning to stand alone, e.g. "for bscs?" or "sa cavite?"
function isLikelyFollowUp(rawMessage, wordCount) {
    const lower = rawMessage.toLowerCase();
    const hasSignal = FOLLOWUP_SIGNALS.some(function(phrase) {
        return lower.includes(phrase);
    });
    return hasSignal || wordCount <= 2;
}

// FIX: greetings, thanks, goodbyes and "who are you" are not topics. If they were remembered,
// "what about bscs?" after "thanks" would try to follow up on... "thanks".
const NO_MEMORY_INTENTS = ["greeting", "thanks", "goodbye", "about_bot"];
function rememberIntent(intent) {
    if (NO_MEMORY_INTENTS.indexOf(intent) === -1) {
        botMemory.lastIntent = intent;
    }
}

// FIX: typo tolerance. "tuiton fee", "scolarship", "enrolment" used to get the "I don't have
// information" reply because the misspelled word was unknown. A word the bot does NOT know is
// now replaced by the ONE known word that is a single edit away (one letter missing, extra,
// wrong, or two neighbouring letters swapped). Only words of 5+ letters are corrected, and
// only when exactly one known word fits - so real unknown words ("pizza") are left alone.
let rawVocab = new Set(); // every (unstemmed) word that appears in the training questions

function buildRawVocab() {
    const vocab = new Set();
    faqs.forEach(function(faq) {
        faq.questions.forEach(function(question) {
            let text = question.toLowerCase().replace(PROGRAM_NAMES, " progname ").replace(/[^a-z0-9\s]/g, "");
            text.split(/\s+/).forEach(function(word) {
                if (word.length > 0 && !STOPWORDS.has(word)) vocab.add(word);
            });
        });
    });
    return vocab;
}

function isOneEditAway(a, b) {
    if (a === b) return true;
    const lengthDiff = Math.abs(a.length - b.length);
    if (lengthDiff > 1) return false;
    if (a.length === b.length) {
        const mismatches = [];
        for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) mismatches.push(i); }
        if (mismatches.length === 1) return true; // one wrong letter
        return mismatches.length === 2 && mismatches[1] === mismatches[0] + 1 &&
            a[mismatches[0]] === b[mismatches[1]] && a[mismatches[1]] === b[mismatches[0]]; // two swapped letters
    }
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    let i = 0;
    while (i < shorter.length && shorter[i] === longer[i]) i++;
    return shorter.slice(i) === longer.slice(i + 1); // one missing / extra letter
}

function correctTypos(words) {
    return words.map(function(word) {
        if (word.length < 5 || word === "progname" || rawVocab.has(word)) return word;
        const candidates = [];
        rawVocab.forEach(function(known) {
            if (known.length >= 4 && isOneEditAway(word, known)) candidates.push(known);
        });
        return candidates.length === 1 ? candidates[0] : word;
    });
}

// FIX: stopword-only phrases ("who are you", "what can you do") become EMPTY after stopword
// removal, so the normal matcher can never see them. These few are matched as whole phrases.
const SMALLTALK_PHRASES = {
    "who are you": "about_bot", "what are you": "about_bot", "what can you do": "about_bot",
    "what do you do": "about_bot", "who is this": "about_bot", "are you a bot": "about_bot",
    "are you a robot": "about_bot", "are you real": "about_bot", "how are you": "greeting",
    "how are you doing": "greeting", "kumusta ka": "greeting", "sino ka": "about_bot",
    "got it": "thanks", "see you": "goodbye", "see you later": "goodbye"
};

// FIX: decides which option a student picked when the bot asked "X or Y?". The old code only
// accepted the exact internal topic name (e.g. "cor_status"), which nobody types.
// Now it also accepts any keyword from the topic's label ("cor", "ledger", "drop"...)
// and "first"/"second"/"1"/"2".
const CLARIFY_IGNORE_WORDS = ["and", "the", "for", "offered", "status", "fees", "viewing"];
function optionKeywords(option) {
    const text = (option.intent.replace(/_/g, " ") + " " + option.label).toLowerCase();
    const words = text.split(/[^a-z0-9]+/).filter(function(word) {
        return word.length >= 3 && CLARIFY_IGNORE_WORDS.indexOf(word) === -1;
    });
    return Array.from(new Set(words));
}
function pickClarificationOption(lowerMessage, optionA, optionB) {
    const shortReply = lowerMessage.trim().split(/\s+/).length <= 4;
    if (shortReply && /(^|\s)(first|1st|1|una)(\s|$)/.test(lowerMessage)) return optionA;
    if (shortReply && /(^|\s)(second|2nd|2|pangalawa|ikalawa)(\s|$)/.test(lowerMessage)) return optionB;
    const scoreA = optionKeywords(optionA).filter(function(k) { return lowerMessage.includes(k); }).length;
    const scoreB = optionKeywords(optionB).filter(function(k) { return lowerMessage.includes(k); }).length;
    if (scoreA > scoreB) return optionA;
    if (scoreB > scoreA) return optionB;
    return null; // unclear - treat the message as a brand new question
}

// Looks up a FAQ entry's friendly label, falling back to the raw intent name
function getIntentLabel(intent) {
    const found = faqs.find(function(faq) { return faq.intent === intent; });
    return (found && found.label) ? found.label : intent;
}

// Looks up the full FAQ entry object for a given intent
function getFAQByIntent(intent) {
    return faqs.find(function(faq) { return faq.intent === intent; });
}

// Measures what fraction of the student's words actually belong to a
// given topic's training vocabulary. This exists because a single rare,
// heavily-weighted word (e.g. "open", which only appears in one training
// question) can drag cosine similarity above the threshold even when every
// OTHER word in the message is unrelated ("what time does the cafeteria
// open" incorrectly matched Enrollment purely because of the word "open").
// Requiring most of the message's words to genuinely belong to the topic
// closes that gap.
function wordOverlapRatio(words, intent) {
    if (words.length === 0) return 0;
    const vocab = nbModel.intentWordCounts[intent] || {};
    const matched = words.filter(function(word) {
        return Object.prototype.hasOwnProperty.call(vocab, word);
    });
    return matched.length / words.length;
}

// ================================================================
// SECTION 11: BOT BRAIN
// ================================================================
function getBotResponse(userMessage) {
    const SIMILARITY_THRESHOLD = 0.15;
    const AMBIGUITY_GAP = 0.05; // if the top 2 topics are this close, ask instead of guessing

    // ---- STEP 0: Are we waiting on an answer to a clarifying question? ----
    if (botMemory.pendingClarification) {
        const lower = userMessage.toLowerCase();
        const { optionA, optionB } = botMemory.pendingClarification;
        botMemory.pendingClarification = null; // clear it either way — never get stuck in a loop

        const chosen = pickClarificationOption(lower, optionA, optionB);
        if (chosen && getFAQByIntent(chosen.intent)) {
            rememberIntent(chosen.intent);
            return getFAQByIntent(chosen.intent).answer;
        }
        // Didn't clearly pick either option — fall through and treat this
        // message as a brand new question instead of getting stuck.
    }

    const userWords = preprocessText(userMessage, true);

    if (userWords.length === 0) {
        const phrase = userMessage.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
        const smallTalkFAQ = SMALLTALK_PHRASES[phrase] && getFAQByIntent(SMALLTALK_PHRASES[phrase]);
        if (smallTalkFAQ) return smallTalkFAQ.answer;
        return "I didn't quite catch that. Could you rephrase your question?";
    }

    const userVector = computeTFIDF(userWords, idfScores);

    // ---- STEP 1: Score every FAQ question, keep only the BEST score per topic ----
    // (Grouping by intent — rather than by individual training question — means
    // the "second best" comparison below reflects a genuinely different topic,
    // not just a second phrasing of the same one.)
    const bestPerIntent = {};

    faqVectors.forEach(function(item) {
        const similarity = cosineSimilarity(userVector, item.vector);
        const intent = item.faq.intent;
        if (!bestPerIntent[intent] || similarity > bestPerIntent[intent].score) {
            bestPerIntent[intent] = { score: similarity, faq: item.faq };
        }
    });

    const ranked = Object.values(bestPerIntent).sort(function(a, b) {
        return b.score - a.score;
    });
    const top = ranked[0];
    const second = ranked[1];

    // ---- STEP 2: Follow-up handling using conversation memory ----
    const looksLikeFollowUp = isLikelyFollowUp(userMessage, userWords.length);
    // FIX: two problems with the old follow-up rule.
    //  1) ANY short message with no match ("thanks", "ok", "pizza") repeated the last answer.
    //     Now at least one word must be something the bot actually knows.
    //  2) "what about bscs?" after a tuition answer was answered as a COURSES question, because the
    //     program name alone matches the courses topic. A message that contains ONLY a program name
    //     is now treated as a follow-up on the topic that was just discussed.
    const knownWordCount = userWords.filter(function(word) { return nbModel.vocab.has(word); }).length;
    const programOnly = userWords.every(function(word) { return word === "progname"; });
    const weakMatch = (!top || top.score < SIMILARITY_THRESHOLD);
    if (looksLikeFollowUp && botMemory.lastIntent && (programOnly || (weakMatch && knownWordCount > 0))) {
        const rememberedFAQ = getFAQByIntent(botMemory.lastIntent);
        if (rememberedFAQ) {
            return `Following up on <strong>${getIntentLabel(botMemory.lastIntent)}</strong>:<br><br>${rememberedFAQ.answer}`;
        }
    }

    // ---- STEP 3: Confident direct match ----
    // Verified by testing: unrelated queries topped out at a 0.33 overlap
    // ratio (only 1 of 3 words genuinely belonged to the matched topic);
    // every genuine query tested reached 1.00. 0.5 sits cleanly between
    // the two and is required here specifically so a single rare shared
    // word can no longer carry an otherwise unrelated message past the
    // similarity threshold on its own.
    const MIN_OVERLAP_RATIO = 0.6; // FIX: was 0.5 - at 0.5 a 2-word message passed on ONE known word ("tell me a joke", "magkano ang load")
    if (top && top.score >= SIMILARITY_THRESHOLD && wordOverlapRatio(userWords, top.faq.intent) >= MIN_OVERLAP_RATIO) {

        // Ambiguity check — is a second, different topic almost as strong a match?
        if (second && (top.score - second.score) < AMBIGUITY_GAP && second.score >= (SIMILARITY_THRESHOLD - 0.05)) {
            botMemory.pendingClarification = {
                optionA: { intent: top.faq.intent, label: getIntentLabel(top.faq.intent) },
                optionB: { intent: second.faq.intent, label: getIntentLabel(second.faq.intent) }
            };
            return `Just to make sure I understand \u2014 are you asking about <strong>${getIntentLabel(top.faq.intent)}</strong> or <strong>${getIntentLabel(second.faq.intent)}</strong>? 🤔`;
        }

        rememberIntent(top.faq.intent);
        return top.faq.answer;
    }

    // ---- STEP 4: Naive Bayes fallback ----
    // Only trust this guess if it's genuinely confident, not just the
    // least-bad option out of a bad lot.
    //
    // Verified by testing: with 8 intents, a random guess averages ~12.5%.
    // Truly unrelated queries ("what time does the cafeteria open",
    // "is there wifi in the library") scored 14.5%-23.2% — never higher.
    // Strong, well-matched queries scored as high as 75.9%.
    // BUT: some genuine Taglish paraphrases scored just as low as the
    // unrelated queries (14.5%-21.8%) — NOT because the confidence math
    // is wrong, but because Section 8's FAQ training data doesn't yet
    // contain enough Taglish phrasing variety for the model to recognize
    // them. A hard threshold cannot fully separate the two cases with a
    // small dataset; the real fix for that gap is adding more Taglish
    // example questions per intent, not tuning this number further.
    // 0.30 is set to reliably block the truly-unrelated queries, even
    // though it means some under-trained Taglish phrasings will also
    // fall through to the human-contact fallback until more training
    // examples are added.
    //
    // A second edge case surfaced during testing: "can I bring my dog to
    // campus" scored 31.8% confidence for Location — just above 0.30 —
    // purely because the word "campus" genuinely belongs to Location's
    // vocabulary, even though "bring" and "dog" do not. The same
    // wordOverlapRatio() guard used in Step 3 is applied here for the
    // same reason: a single real keyword shouldn't be enough on its own
    // to carry an otherwise unrelated sentence past the confidence floor.
    const NB_CONFIDENCE_THRESHOLD = 0.30;
    const nbResult = predictIntent(userWords, nbModel);
    if (nbResult.confidence >= NB_CONFIDENCE_THRESHOLD && wordOverlapRatio(userWords, nbResult.intent) >= MIN_OVERLAP_RATIO) {
        const intentFAQ = getFAQByIntent(nbResult.intent);
        if (intentFAQ) {
            rememberIntent(intentFAQ.intent);
            return intentFAQ.answer;
        }
    }

    // ---- STEP 5: Total fallback — redirect to a human ----
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


const BAD_WORDS = [
    "fuck", "shit", "bitch", "asshole", "dick", "pussy", "stupid",
    "putangina", "gago", "bobo", "tarantado", "tangina", "ulol", 
    "pakyu", "inamo", "leche", "hayop", "anak ng puta", "ul0l",
    "fuck you",

];

// This function finds bad words and replaces them with asterisks
function censorText(text) {
    // The \b ensures we only match whole words (so "glass" doesn't trigger "ass")
    // "gi" means Global (check whole sentence) and Case-Insensitive
    const profanityRegex = new RegExp("\\b(" + BAD_WORDS.join("|") + ")\\b", "gi");
    
    return text.replace(profanityRegex, function(match) {
        return "*".repeat(match.length); // Replaces "gago" with "****"
    });
}

// ================================================================
// SECTION 12: MESSAGE HANDLING
// ================================================================
// FIX: bot answers come from the database and are shown as HTML (for <strong>, <br>, links).
// If anyone ever got a <script> or onerror=... into an FAQ answer, it would run in every
// student's browser. This keeps only harmless formatting tags and safe links.
const ALLOWED_TAGS = ["A", "B", "BR", "EM", "I", "LI", "OL", "P", "SPAN", "STRONG", "U", "UL"];
const DROP_WITH_CONTENT = ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "SVG", "MATH", "TEMPLATE", "NOSCRIPT", "BASE"];
function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
    function clean(node) {
        Array.from(node.childNodes).forEach(function(child) {
            if (child.nodeType === 8) { child.remove(); return; }          // comments
            if (child.nodeType !== 1) return;                               // text stays
            if (DROP_WITH_CONTENT.indexOf(child.tagName) !== -1) { child.remove(); return; }
            clean(child);
            if (ALLOWED_TAGS.indexOf(child.tagName) === -1) {               // unknown tag: keep the text, drop the tag
                while (child.firstChild) node.insertBefore(child.firstChild, child);
                child.remove();
                return;
            }
            const href = child.tagName === "A" ? (child.getAttribute("href") || "").trim() : "";
            Array.from(child.attributes).forEach(function(attr) { child.removeAttribute(attr.name); });
            if (child.tagName === "A" && /^(https?:\/\/|mailto:)/i.test(href)) {   // only web and email links survive
                child.setAttribute("href", href);
                child.setAttribute("target", "_blank");
                child.setAttribute("rel", "noopener noreferrer");
            }
        });
    }
    clean(doc.body);
    return doc.body.innerHTML;
}

// Adds a message bubble to the chat window (returns the bubble so callers can remove it later)
function addMessage(text, type) {
    // Using "div" (not "p") is intentional - #chatBody p in styles.css
    // colors ALL <p> tags maroon, which would make user and bot bubbles
    // look identical. "div" is unaffected by that rule.
    const bubble = document.createElement("div");

    if (type === "user") {
        bubble.textContent = text;
        bubble.classList.add("user-message");
    } else {
        bubble.innerHTML = sanitizeHtml(text);
        bubble.classList.add("bot-message");
    }

    chatBody.appendChild(bubble);

    // Always scroll down to show the newest message
    chatBody.scrollTop = chatBody.scrollHeight;
    return bubble;
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

// FIX: two quick messages used to get replies in random order (each reply has a random delay),
// which also scrambled the conversation memory. Now one reply is processed at a time.
let isReplying = false;

// Main send message function
function sendMessage() {
    // Safety net - the input is already disabled while loading, but this
    // guards against sending a message in the split second before that
    // happens, or if the input gets re-enabled some other way.
    if (!isBotReady || isReplying) return;

    const rawMessage = userInput.value.trim();

    if (rawMessage === "") return;

    // 1. Pass the message through our new censor function
    const censoredMessage = censorText(rawMessage);
    
    // 2. Check if the text was changed (meaning a bad word was caught)
    const isNaughty = (censoredMessage !== rawMessage);

    // 3. Show the CENSORED message on the user's side
    addMessage(censoredMessage, "user");
    userInput.value = "";

    // Show the "..." typing dots
    isReplying = true;
    showTypingIndicator();

    const thinkingTime = 800 + Math.random() * 700;
    setTimeout(function() {
        removeTypingIndicator();
        
        // 4. If they cursed, scold them! Otherwise, answer normally.
        try {
            if (isNaughty) {
                addMessage("⚠️ Please maintain respectful language. How can I help you with your university inquiries?", "bot");
            } else {
                const response = getBotResponse(censoredMessage);
                addMessage(response, "bot");
            }
        } catch (error) {
            console.error("Bot error:", error);
            addMessage("Sorry, something went wrong on my side. Please try asking again.", "bot");
        } finally {
            isReplying = false;
        }
    }, thinkingTime);
}

sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});