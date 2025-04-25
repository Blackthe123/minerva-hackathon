// --- Configuration ---
// PASTE YOUR GOOGLE API KEY HERE:
const API_KEY = 'AIzaSyDQVJiaBAddOUDBLLdT0AxWzwmyeR8xmHI';
// --------------------

// --- Constants ---
// Construct the correct Gemini API endpoint URL
// For gemini-1.5-flash-latest use 'v1beta'
const API_ENDPOINT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

// --- DOM Elements ---
const textInput = document.getElementById('text-input');
const generateButton = document.getElementById('generate-button');
const statusMessage = document.getElementById('status-message');
const dueCountSpan = document.getElementById('due-count');
const reviewCard = document.getElementById('review-card');
const questionDisplay = document.getElementById('question-display');
const answerDisplay = document.getElementById('answer-display');
const showAnswerButton = document.getElementById('show-answer-button');
const difficultyButtons = document.getElementById('difficulty-buttons');
const noReviewsMessage = document.getElementById('no-reviews-message');

// --- State ---
let currentReviewItem = null; // Holds the item object currently being reviewed
let studyItems = []; // Array to hold all study items { id, question, answer, nextReviewDate, interval, easeFactor }

// --- Constants for SRS ---
const INITIAL_INTERVAL = 1; // days
const INITIAL_EASE_FACTOR = 2.5; // Standard SM-2 starting ease

// --- Event Listeners ---
// Add basic check if API key is placeholder
if (generateButton) {
    if (!API_KEY || API_KEY === 'YOUR_GOOGLE_API_KEY_HERE') {
        generateButton.disabled = true;
        if (statusMessage) {
            statusMessage.textContent = 'ERROR: API Key not configured in script.js!';
            statusMessage.style.color = 'red';
        }
    } else {
        generateButton.addEventListener('click', handleGeneratePrompts);
    }
}
if (showAnswerButton) {
    showAnswerButton.addEventListener('click', handleShowAnswer);
}
// Difficulty buttons use onclick in HTML

// --- Functions ---

/**
 * Initializes the application on page load.
 */
function initializeApp() {
    console.log("Initializing App...");
    loadItemsFromLocalStorage();
    updateDueCount();
    displayNextReviewItem();
    // Check API Key again after DOM load
     if (generateButton && (!API_KEY || API_KEY === 'YOUR_GOOGLE_API_KEY_HERE')) {
        generateButton.disabled = true;
        if (statusMessage && !statusMessage.textContent) {
             statusMessage.textContent = 'ERROR: API Key not configured in script.js!';
             statusMessage.style.color = 'red';
        }
    }
}


/**
 * Handles the click event for the 'Generate Recall Prompts' button.
 * Makes a DIRECT call to the Gemini REST API using fetch.
 */
async function handleGeneratePrompts() {
    const text = textInput.value.trim();
    if (!text) {
        statusMessage.textContent = 'Please paste some text first!';
        statusMessage.style.color = 'red';
        return;
    }
     if (!API_KEY || API_KEY === 'YOUR_GOOGLE_API_KEY_HERE') {
        statusMessage.textContent = 'ERROR: API Key not configured in script.js!';
        statusMessage.style.color = 'red';
         return;
    }

    statusMessage.textContent = 'Generating prompts... (This may take a moment)';
    statusMessage.style.color = 'orange';
    generateButton.disabled = true;

    try {
        // --- Construct the Prompt for Gemini (Text part is the same) ---
        const promptText = `
Based on the following text, generate 5-7 diverse active recall prompts suitable for spaced repetition learning.
Include different types like definitions, explanations, fill-in-the-blanks, or comparing concepts found in the text.
For each prompt, provide both the question and a concise answer derived *only* from the text.

Return the output *ONLY* as a valid JSON array where each object has a "question" key and an "answer" key. Do not include any other text, comments, or markdown formatting like \`\`\`json.

Example JSON format:
[
  { "question": "What is concept X?", "answer": "Concept X is defined as..." },
  { "question": "Explain the process of Y.", "answer": "The process involves step 1, step 2..." }
]

--- Text to Analyze ---
${text}
--- End Text ---

Valid JSON Array Output:
`;
        // --- Construct the Request Body for the REST API ---
        const requestBody = {
            contents: [{
                parts: [{
                    text: promptText
                }]
            }],
            // Optional: Add safety settings if needed
            // safetySettings: [
            //   { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            //   { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            //   { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            //   { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
            // ],
            // Optional: Add generation config if needed
            // generationConfig: {
            //     temperature: 0.7,
            //     maxOutputTokens: 1000,
            // }
        };

        // --- DIRECT Call to Gemini REST API using fetch ---
        console.log("Sending request directly to Gemini REST API...");
        const response = await fetch(API_ENDPOINT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log("Received response status:", response.status);
        if (!response.ok) {
             const errorData = await response.json();
             console.error("API Error Response:", errorData);
             const message = errorData?.error?.message || `HTTP error! status: ${response.status}`;
             throw new Error(message);
        }

        const responseData = await response.json();
        console.log("Received raw response object from Gemini API:", responseData);

        // --- Extract and Parse the Response Text ---
        let responseText = '';
        if (responseData.candidates && responseData.candidates.length > 0 &&
            responseData.candidates[0].content && responseData.candidates[0].content.parts &&
            responseData.candidates[0].content.parts.length > 0) {
             responseText = responseData.candidates[0].content.parts[0].text;
        } else if (responseData.promptFeedback?.blockReason) {
             throw new Error(`Request blocked due to safety settings (${responseData.promptFeedback.blockReason}). Try different text.`);
        }
        else {
             console.error("Could not find expected text in API response structure:", responseData);
             throw new Error("Unexpected response structure from AI.");
        }

        if (!responseText) { // Add check if responseText is empty after extraction
             throw new Error("AI response structure did not contain text content.");
        }

        console.log("Raw response text content:", responseText); // Log before cleaning

        let generatedPrompts = [];
         try {
             // --- Improved Cleaning Logic ---
             // 1. Trim leading/trailing whitespace aggressively.
             let cleanResponse = responseText.trim();
             // 2. Remove optional ```json prefix (case-insensitive) potentially followed by a newline
             cleanResponse = cleanResponse.replace(/^```json\s*/i, '');
             // 3. Remove optional ``` suffix potentially preceded by a newline
             cleanResponse = cleanResponse.replace(/\s*```$/, '');
             // 4. Trim again just in case.
             cleanResponse = cleanResponse.trim();

             console.log("Cleaned response text for parsing:", cleanResponse); // Log after cleaning

             // Now parse the cleaned string
             generatedPrompts = JSON.parse(cleanResponse);

             // Basic validation (remains the same)
             if (!Array.isArray(generatedPrompts) || generatedPrompts.some(p => typeof p.question !== 'string' || typeof p.answer !== 'string')) {
                console.error("Parsed JSON is not in the expected format:", generatedPrompts);
                throw new Error("AI response was not in the expected format (Array of {question, answer}).");
            }
             console.log(`Successfully parsed ${generatedPrompts.length} prompts.`);

        } catch (parseError) {
            console.error('Error parsing Gemini response text:', parseError);
             // Log the cleaned string *before* parsing attempt for easier debugging
            console.error('Cleaned string that failed parsing:', cleanResponse);
            // Log the original raw text too
            console.error('Original raw response text was:', responseText);
            throw new Error('Failed to parse AI response content. The format might be incorrect.');
        }

        // --- Process successful generation (Same as before) ---
        if (!generatedPrompts || generatedPrompts.length === 0) {
             throw new Error("AI did not return any prompts, or the response was empty.");
        }
        saveNewPrompts(generatedPrompts);
        statusMessage.textContent = `Successfully generated ${generatedPrompts.length} prompts!`;
        statusMessage.style.color = 'green';
        textInput.value = '';
        updateDueCount();
        if (!currentReviewItem) {
            displayNextReviewItem();
        }

    } catch (error) {
        console.error('Error generating prompts:', error);
        let displayError = `Error: ${error.message}`;
        if (error.message && error.message.includes('API key not valid')) {
            displayError = 'ERROR: Invalid API Key configured in script.js.';
        } else if (error.message && error.message.includes('Quota')) {
             displayError = 'ERROR: API Quota exceeded. Please check your Google Cloud console.';
         }
        statusMessage.textContent = displayError;
        statusMessage.style.color = 'red';
    } finally {
        // Re-enable button if API key is present
         if (API_KEY && API_KEY !== 'YOUR_GOOGLE_API_KEY_HERE') {
             generateButton.disabled = false;
         }
    }
}

// --- Rest of the functions (handleShowAnswer, load/save localStorage, SRS, etc.) ---
// --- These remain exactly the same as the previous version ---

function handleShowAnswer() {
    if (answerDisplay && difficultyButtons && showAnswerButton) {
        answerDisplay.classList.remove('hidden');
        difficultyButtons.classList.remove('hidden');
        showAnswerButton.classList.add('hidden');
    }
}

function loadItemsFromLocalStorage() {
    const storedItems = localStorage.getItem('studyItems');
    if (storedItems) {
        try {
            studyItems = JSON.parse(storedItems);
            studyItems.forEach(item => {
                item.nextReviewDate = new Date(item.nextReviewDate);
                if (item.easeFactor === undefined) item.easeFactor = INITIAL_EASE_FACTOR;
                if (item.interval === undefined) item.interval = INITIAL_INTERVAL;
            });
            console.log(`Loaded ${studyItems.length} items from localStorage.`);
        } catch(e) {
            console.error("Error parsing localStorage items:", e);
            studyItems = [];
            localStorage.removeItem('studyItems'); // Clear potentially corrupted data
        }
    } else {
        studyItems = [];
        console.log("No items found in localStorage.");
    }
}

function saveItemsToLocalStorage() {
    try {
        const itemsToStore = studyItems.map(item => ({
            ...item,
            nextReviewDate: item.nextReviewDate.toISOString()
        }));
        localStorage.setItem('studyItems', JSON.stringify(itemsToStore));
        console.log(`Saved ${studyItems.length} items to localStorage.`);
    } catch (e) {
        console.error("Error saving to localStorage:", e);
        if (statusMessage) { // Check if element exists
            statusMessage.textContent = "Error saving progress. LocalStorage might be full or disabled.";
            statusMessage.style.color = 'red';
        }
    }
}

function saveNewPrompts(newPrompts) {
    const now = new Date();
    newPrompts.forEach(prompt => {
        // Basic sanitization or check if needed
        const question = typeof prompt.question === 'string' ? prompt.question : 'Invalid Question';
        const answer = typeof prompt.answer === 'string' ? prompt.answer : 'Invalid Answer';

        studyItems.push({
            id: Date.now() + Math.random(),
            question: question,
            answer: answer,
            nextReviewDate: now,
            interval: INITIAL_INTERVAL,
            easeFactor: INITIAL_EASE_FACTOR,
        });
    });
    saveItemsToLocalStorage();
}

function updateDueCount() {
    const now = new Date();
    // Get items due up to the end of the current moment
    const dueItems = studyItems.filter(item => item.nextReviewDate <= now);
    if (dueCountSpan) {
        dueCountSpan.textContent = dueItems.length;
    }
    console.log(`${dueItems.length} items due.`);
}

function displayNextReviewItem() {
    const now = new Date();
    // Find items due now or in the past
    const dueItems = studyItems
        .filter(item => item.nextReviewDate <= now)
        .sort((a, b) => a.nextReviewDate - b.nextReviewDate); // Sort by review date ascending

    if (dueItems.length > 0 && reviewCard && questionDisplay && answerDisplay && showAnswerButton && difficultyButtons && noReviewsMessage) {
        currentReviewItem = dueItems[0];
        questionDisplay.textContent = currentReviewItem.question;
        answerDisplay.textContent = currentReviewItem.answer;

        // Reset card state
        answerDisplay.classList.add('hidden');
        difficultyButtons.classList.add('hidden');
        showAnswerButton.classList.remove('hidden');

        reviewCard.classList.remove('hidden');
        noReviewsMessage.classList.add('hidden');
        console.log("Displaying review item ID:", currentReviewItem.id);

    } else {
        currentReviewItem = null;
        if (reviewCard) reviewCard.classList.add('hidden');
        if (noReviewsMessage) noReviewsMessage.classList.remove('hidden');
        console.log("No items due for review.");
    }
    updateDueCount(); // Keep count accurate
}

function calculateSRS(item, rating) {
    let easeFactor = item.easeFactor || INITIAL_EASE_FACTOR;
    let interval = item.interval || INITIAL_INTERVAL;
    let nextReviewDate = new Date(); // Start calculation from today
    let quality;
    if (rating === 'again') quality = 0;
    else if (rating === 'hard') quality = 1;
    else if (rating === 'good') quality = 3;
    else quality = 5; // easy

    // Update Ease Factor (clamp between 1.3 and ~3.0 if desired)
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    // Calculate Next Interval
    if (quality < 2) { // If 'again' or 'hard'
        interval = 1; // Reset interval to 1 day
        // Special case for 'again': review very soon (e.g., 1 minute)
        if (rating === 'again') {
             const minutes = 1;
             nextReviewDate.setTime(nextReviewDate.getTime() + minutes * 60 * 1000);
             console.log(`SRS calc (${rating}): Reset interval, next review in ${minutes} min.`);
             // Return early as interval doesn't strictly matter for immediate review
             // Use small interval value for logging consistency
             return { interval: 0.001, easeFactor, nextReviewDate };
        }
    } else { // If 'good' or 'easy'
        // Calculate next interval based on current interval and ease factor
        let qualityMultiplier = (rating === 'easy') ? 1.2 : 1.0; // Slightly faster for 'easy'
        interval = Math.ceil(interval * easeFactor * qualityMultiplier);
    }

    // Optional: Max interval (e.g., 1 year)
    interval = Math.min(interval, 365);

    // Set Next Review Date based on calculated interval (in days from *today*)
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    // Set to a consistent time (e.g., 4 AM local) to avoid issues near midnight/DST changes
    nextReviewDate.setHours(4, 0, 0, 0);

    console.log(`SRS calc (${rating}): New Interval=${interval.toFixed(0)} days, EF=${easeFactor.toFixed(2)}, NextReview=${nextReviewDate.toISOString().slice(0,10)}`);

    return { interval, easeFactor, nextReviewDate };
}


// Make rateDifficulty globally accessible for onclick handlers
window.rateDifficulty = function(rating) {
    if (!currentReviewItem) return;

    console.log(`Rating item ${currentReviewItem.id} as: ${rating}`);
    let { interval, easeFactor, nextReviewDate } = calculateSRS(currentReviewItem, rating);

    // Update the item in the main array
    const itemIndex = studyItems.findIndex(item => item.id === currentReviewItem.id);
    if (itemIndex > -1) {
        studyItems[itemIndex].interval = interval;
        studyItems[itemIndex].easeFactor = easeFactor;
        studyItems[itemIndex].nextReviewDate = nextReviewDate;
        saveItemsToLocalStorage(); // Save changes
        console.log(`Updated item ${studyItems[itemIndex].id} stored.`);
    } else {
         console.error("Could not find current item in studyItems array!");
    }

    displayNextReviewItem(); // Show the next due item
}


// --- Initial Load ---
// Use DOMContentLoaded to ensure elements are ready before running initializeApp
document.addEventListener('DOMContentLoaded', initializeApp);