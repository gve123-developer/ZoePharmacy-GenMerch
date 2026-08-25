let speakTimeout: any = null;
let isLoopingCount: number = 0; // Using a count as an ID to cancel superseded loops

export type VoiceMessage = string | { text: string; pause?: number };

export const stopSpeaking = () => {
    isLoopingCount++; // invalidate any active loop
    if (speakTimeout) clearTimeout(speakTimeout);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

export const speak = (input: VoiceMessage | VoiceMessage[], options?: { loop?: boolean }) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Cancel any existing speech and timeout
    stopSpeaking();
    
    const currentLoopId = isLoopingCount;
    const items = Array.isArray(input) ? input : [input];
    let index = 0;

    const speakItem = () => {
        if (currentLoopId !== isLoopingCount) return; // A newer call cancelled this

        if (index >= items.length) {
            if (options?.loop) {
                index = 0; // restart
            } else {
                return; // done
            }
        }

        const current = items[index];
        const text = typeof current === 'string' ? current : current.text;
        const pause = typeof current === 'string' ? 0 : (current.pause || 0);

        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();

        // Expanded search for female voices
        const femaleFound = voices.find(v => {
            const name = v.name.toLowerCase();
            // Ensure English
            if (!v.lang.startsWith('en')) return false;

            return (
                name.includes('female') ||
                name.includes('zira') ||
                name.includes('samantha') ||
                name.includes('google us english') ||
                name.includes('victoria') ||
                name.includes('hazel') ||
                name.includes('susan') ||
                name.includes('monica') ||
                name.includes('heera') ||
                name.includes('shruthi') ||
                name.includes('neur') // Neural voices often have names like this
            );
        });

        if (femaleFound) {
            utterance.voice = femaleFound;
        }

        utterance.rate = 0.9;
        utterance.pitch = 1.1; // Slightly higher pitch often sounds more feminine
        utterance.volume = 1;

        utterance.onend = () => {
            if (currentLoopId !== isLoopingCount) return;
            index++;
            // Apply pause before next message
            if (pause > 0) {
                speakTimeout = setTimeout(speakItem, pause);
            } else {
                speakItem();
            }
        };

        // Handle errors (e.g. if speech is blocked)
        utterance.onerror = (e) => {
            if (currentLoopId !== isLoopingCount) return;
            console.error("Speech synthesis error:", e);
            // Try to continue to next item anyway
            index++;
            speakItem();
        };

        window.speechSynthesis.speak(utterance);
    };

    // Ensure voices are loaded (Chrome sometimes needs this)
    if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            speakItem();
            window.speechSynthesis.onvoiceschanged = null;
        };
    } else {
        speakItem();
    }
};
