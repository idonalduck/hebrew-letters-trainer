console.log('🚀 NEW APP STARTING');

let currentPrompt = '';
let currentInput = '';

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM ready - setting up app');
    initializeApp();
});

function initializeApp() {
    const generateImageBtn = document.getElementById('generateImageBtn');
    const correctBtn = document.getElementById('correctBtn'); 
    const incorrectBtn = document.getElementById('incorrectBtn');
    
    if (generateImageBtn) {
        generateImageBtn.addEventListener('click', handleGenerateWithAI);
        console.log('Generate AI Image button connected');
    }
    
    if (correctBtn) {
        correctBtn.addEventListener('click', () => handleFeedback(true));
        console.log('Correct button connected');
    }
    
    if (incorrectBtn) {
        incorrectBtn.addEventListener('click', () => handleFeedback(false));
        console.log('Incorrect button connected');
    }
    
    // Enter key support
    const letterInput = document.getElementById('letterInput');
    if (letterInput) {
        letterInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleGenerateWithAI();
            }
        });
    }
    
    console.log('🎯 All buttons ready');
}

async function handleGenerateWithAI() {
    console.log('🎨 Generate AI image clicked');
    
    const input = document.getElementById('letterInput').value.trim();
    
    if (!input) {
        showMessage('הכנס אות עברית או תיאור', 'error');
        return;
    }

    currentInput = input;
    showMessage('מכין פרומפט מדויק...', 'info');
    
    try {
        // Get the accurate prompt directly (without web search)
        const response = await fetch('/api/generate-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: input })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentPrompt = data.enhancedPrompt;
            
            // Show the prompt
            document.getElementById('generatedPrompt').textContent = currentPrompt;
            document.getElementById('promptSection').classList.remove('hidden');
            
            showMessage('יוצר תמונה עם AI...', 'info');
            
            // Generate image immediately
            const imageResponse = await fetch('/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: currentPrompt })
            });
            
            const imageData = await imageResponse.json();
            console.log('📊 Image response:', imageData);
            
            if (imageData.success) {
                const img = document.getElementById('generatedImage');
                img.src = imageData.imageUrl;
                img.alt = `תמונה של ${input}`;
                
                document.getElementById('imageSection').classList.remove('hidden');
                document.getElementById('feedbackSection').classList.remove('hidden');
                
                showMessage('תמונה נוצרה בהצלחה!', 'success');
                console.log('✅ Image created:', imageData.imageUrl, 'Source:', imageData.source);
            } else {
                showMessage('שגיאה ביצירת התמונה: ' + imageData.error, 'error');
            }
        } else {
            showMessage('שגיאה ביצירת הפרומפט: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        showMessage('שגיאה בחיבור לשרת', 'error');
    }
}

function handleGeneratePrompt() {
    console.log('🔄 Generate prompt clicked');
    
    const input = document.getElementById('letterInput').value.trim();
    
    if (!input) {
        showMessage('הכנס אות עברית או תיאור', 'error');
        return;
    }

    currentInput = input;
    currentPrompt = `A single Hebrew letter drawn clearly: ${input}. Black ink on white background. No text or decorations.`;
    
    document.getElementById('generatedPrompt').textContent = currentPrompt;
    document.getElementById('promptSection').classList.remove('hidden');
    
    showMessage('פרומפט נוצר בהצלחה!', 'success');
    console.log('✅ Prompt created:', currentPrompt);
    
    // Auto-generate image
    setTimeout(generateSampleImage, 500);
}

function generateSampleImage() {
    console.log('🎨 Creating sample image');
    
    const letter = currentInput.match(/[\u0590-\u05FF]/)?.[0] || 'א';
    
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 300, 200);
    
    // Border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 300, 200);
    
    // Hebrew letter
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 80px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 150, 100);
    
    const img = document.getElementById('sampleImage');
    img.src = canvas.toDataURL();
    
    document.getElementById('imageContainer').classList.remove('hidden');
    document.getElementById('feedbackSection').classList.remove('hidden');
    
    showMessage('תמונה נוצרה - נא לתת משוב', 'info');
    console.log('✅ Sample image created for:', letter);
}

async function handleFeedback(isCorrect) {
    console.log('📝 Feedback submitted:', isCorrect ? 'נכון' : 'לא נכון');
    
    if (!currentPrompt) {
        showMessage('שגיאה: אין נתונים לשמירה', 'error');
        return;
    }

    const feedbackData = {
        input: currentInput,
        prompt: currentPrompt,
        feedback: isCorrect,
        timestamp: new Date().toISOString()
    };

    // Save to localStorage for backup
    const savedData = JSON.parse(localStorage.getItem('hebrewFeedback') || '[]');
    savedData.push(feedbackData);
    localStorage.setItem('hebrewFeedback', JSON.stringify(savedData));

    // Send to learning system
    try {
        const hebrewText = currentInput.match(/[\u0590-\u05FF]+/)?.[0];
        if (hebrewText) {
            const response = await fetch('/api/learn-feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    letter: hebrewText,
                    prompt: currentPrompt,
                    isCorrect: isCorrect,
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                const learningResult = await response.json();
                const successRate = learningResult.successRate || 0;
                
                const feedbackText = isCorrect ? 'נכון' : 'לא נכון';
                const totalLearned = learningResult.totalFeedback || 0;
                showMessage(`${feedbackText} - שיעור הצלחה: ${successRate}% (סה"כ נתונים: ${totalLearned})`, 'success');
                
                console.log('🧠 Learning result:', learningResult);
            } else {
                const feedbackText = isCorrect ? 'נכון' : 'לא נכון';
                showMessage(`המשוב "${feedbackText}" נשמר במסד הנתונים`, 'success');
            }
        }
    } catch (error) {
        console.log('⚠️ Learning system offline, using local storage');
        const feedbackText = isCorrect ? 'נכון' : 'לא נכון';
        showMessage(`המשוב "${feedbackText}" נשמר מקומית`, 'success');
    }
    
    console.log('💾 Data saved:', feedbackData);
    console.log('📊 Total entries:', savedData.length);

    setTimeout(resetForNext, 2000);
}

function resetForNext() {
    document.getElementById('letterInput').value = '';
    document.getElementById('promptSection').classList.add('hidden');
    document.getElementById('imageSection').classList.add('hidden');
    document.getElementById('feedbackSection').classList.add('hidden');
    
    currentPrompt = '';
    currentInput = '';
    
    showMessage('מוכן לאות הבאה', 'success');
    console.log('🔄 Reset complete');
}

function showMessage(text, type) {
    const status = document.getElementById('statusMessage');
    status.textContent = text;
    status.className = `status-message ${type}`;
    status.classList.remove('hidden');
    
    setTimeout(() => {
        status.classList.add('hidden');
    }, 3000);
}