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
const API_BASE_URL = "http://localhost:5000";


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
    "nang", "nga"
]);

// ----------------------------------------------------------------
// PART B: TEXT PREPROCESSOR
// ----------------------------------------------------------------
function preprocessText(text) {
    text = text.toLowerCase();
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

async function initializeChatbot() {
    showLoadingState();

    try {
        const response = await fetch(`${API_BASE_URL}/api/faqs`);

        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        faqs = await response.json();

        if (!Array.isArray(faqs) || faqs.length === 0) {
            throw new Error("No FAQ data was returned from the database.");
        }

        // Now that real data actually exists, build the NLP models on
        // top of it - this is the exact same logic as before, just
        // delayed until after the fetch completes.
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
}

// Re-enables the input once the bot is fully trained and ready.
function hideLoadingState() {
    userInput.disabled = false;
    userInput.placeholder = "Type here...";
    sendBtn.disabled = false;
}

// Shown if the backend can't be reached at all - e.g. the server isn't
// running, or the URL in API_BASE_URL above is wrong.
function showConnectionError() {
    userInput.disabled = true;
    userInput.placeholder = "Connection error";
    sendBtn.disabled = true;
    addMessage(
        "\u26A0\uFE0F I'm having trouble connecting to my knowledge base right now. " +
        "Please make sure the backend server is running, or contact the Registrar's Office directly at " +
        "<a href=\"mailto:info@ama.edu.ph\">info@ama.edu.ph</a>.",
        "bot"
    );
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

        if (lower.includes(optionA.intent) || lower.includes(optionA.label.toLowerCase())) {
            botMemory.lastIntent = optionA.intent;
            return getFAQByIntent(optionA.intent).answer;
        }
        if (lower.includes(optionB.intent) || lower.includes(optionB.label.toLowerCase())) {
            botMemory.lastIntent = optionB.intent;
            return getFAQByIntent(optionB.intent).answer;
        }
        // Didn't clearly pick either option — fall through and treat this
        // message as a brand new question instead of getting stuck.
    }

    const userWords = preprocessText(userMessage);

    if (userWords.length === 0) {
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
    if (looksLikeFollowUp && (!top || top.score < SIMILARITY_THRESHOLD) && botMemory.lastIntent) {
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
    const MIN_OVERLAP_RATIO = 0.5;
    if (top && top.score >= SIMILARITY_THRESHOLD && wordOverlapRatio(userWords, top.faq.intent) >= MIN_OVERLAP_RATIO) {

        // Ambiguity check — is a second, different topic almost as strong a match?
        if (second && (top.score - second.score) < AMBIGUITY_GAP && second.score >= (SIMILARITY_THRESHOLD - 0.05)) {
            botMemory.pendingClarification = {
                optionA: { intent: top.faq.intent, label: getIntentLabel(top.faq.intent) },
                optionB: { intent: second.faq.intent, label: getIntentLabel(second.faq.intent) }
            };
            return `Just to make sure I understand \u2014 are you asking about <strong>${getIntentLabel(top.faq.intent)}</strong> or <strong>${getIntentLabel(second.faq.intent)}</strong>? 🤔`;
        }

        botMemory.lastIntent = top.faq.intent;
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
            botMemory.lastIntent = intentFAQ.intent;
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

// ================================================================
// SECTION 11.5: PROFANITY FILTER 🛡️
// ================================================================
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
// Adds a message bubble to the chat window
function addMessage(text, type) {
    // Using "div" (not "p") is intentional - #chatBody p in styles.css
    // colors ALL <p> tags maroon, which would make user and bot bubbles
    // look identical. "div" is unaffected by that rule.
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
    // Safety net - the input is already disabled while loading, but this
    // guards against sending a message in the split second before that
    // happens, or if the input gets re-enabled some other way.
    if (!isBotReady) return;

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
    showTypingIndicator();

    const thinkingTime = 800 + Math.random() * 700;
    setTimeout(function() {
        removeTypingIndicator();
        
        // 4. If they cursed, scold them! Otherwise, answer normally.
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