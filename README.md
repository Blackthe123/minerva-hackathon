# 🧠 Contextual Recall Helper

This prototype helps users memorize information from their own notes using AI and learning science.

**Live Demo:** [https://blackthe123.github.io/minerva-hackathon/](url)

## Learning Science Integration

*   **Active Recall:** Users actively retrieve information via AI-generated questions instead of passive reading.
*   **Spaced Repetition:** A simple algorithm schedules reviews at increasing intervals based on user feedback ("Again", "Hard", "Good", "Easy") to combat forgetting.
*   **Generation Effect:** Recalling the answer before viewing strengthens memory.
*   **Contextual Learning:** Questions are generated directly from the user's provided text, keeping learning relevant.

## AI Integration

*   **AI Model:** Uses Google Gemini (`gemini-1.5-flash-latest`) via its REST API.
*   **Function:** The AI analyzes user-pasted text and generates relevant question-answer pairs based on a specific prompt.
*   **Implementation:** Called directly from frontend JavaScript (`fetch`) for simplicity.
