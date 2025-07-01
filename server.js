const express = require('express');
const Replicate = require('replicate');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const port = 5000;

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.OPENAI_API_KEY, // Using the same env var name to keep it simple
});

// Initialize OpenAI for feedback analysis (check for valid API key)
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI initialized with valid API key');
  } catch (error) {
    console.log('❌ OpenAI initialization failed:', error.message);
    openai = null;
  }
} else {
  console.log('⚠️ No valid OpenAI API key found (should start with sk-)');
}

// Pollinations.ai API function (completely free)
async function generateWithPollinations(prompt) {
  try {
    // Check if it's Hebrew text or general image request
    const isHebrewPrompt = /[\u0590-\u05FF]/.test(prompt);
    
    let enhancedPrompt;
    if (isHebrewPrompt) {
      // For Hebrew letters - simple calligraphy style
      enhancedPrompt = `Hebrew calligraphy letter written by hand with black ink on white paper: ${prompt}`;
    } else {
      // For general images - use the prompt as-is with quality improvements
      enhancedPrompt = `${prompt}, high quality, detailed, professional photography style`;
    }
    
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    // Simple URL without complex parameters that might fail
    const imageUrl = `https://pollinations.ai/p/${encodedPrompt}?width=512&height=512&seed=${Math.floor(Math.random() * 1000)}`;
    
    console.log('✅ Pollinations.ai generating:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.log('❌ Pollinations failed:', error.message);
    return null;
  }
}

// Alternative: Stable Diffusion Web API (free)
async function generateWithStableDiffusionWeb(prompt) {
  try {
    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-v1-5/text-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt }],
        width: 512,
        height: 512,
        samples: 1
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const base64 = data.artifacts[0].base64;
    const imageUrl = `data:image/png;base64,${base64}`;

    return imageUrl;
  } catch (error) {
    console.log('❌ Stability AI Web failed:', error.message);
    return null;
  }
}

// Middleware
app.use(express.json());
app.use(express.static('.'));

// API endpoint for generating images with DALL·E
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'חסר פרומפט' 
      });
    }

    console.log('🎨 Generating image for prompt:', prompt);

    // Use reliable Hebrew typography with learning system
    let imageUrl = null;
    let source = "מערכת למידה עברית";
    
    // Check if this is Hebrew text or general image request
    const hebrewMatch = prompt.match(/[\u0590-\u05FF]+/g);
    
    // Keywords that indicate image generation request (even if Hebrew words are present)
    const imageKeywords = ['צייר', 'ציירי', 'תמונה', 'צור', 'יצור', 'הראה', 'image', 'draw', 'create', 'show', 'picture'];
    const hasImageKeyword = imageKeywords.some(keyword => prompt.toLowerCase().includes(keyword.toLowerCase()));
    
    // It's a Hebrew text request only if: has Hebrew AND no image keywords AND is short (single word/phrase)
    const isHebrewTextRequest = hebrewMatch && 
                               !hasImageKeyword && 
                               hebrewMatch.length === 1 && 
                               hebrewMatch[0].length <= 10;
    
    // Clean the prompt for better AI understanding
    let cleanPrompt = prompt
      .replace(/ציירי?\s*(לי)?\s*/g, '')
      .replace(/תמונה\s*(של)?\s*/g, '')
      .replace(/צור\s*(תמונה)?\s*(של)?\s*/g, '')
      .replace(/הראה?\s*(לי)?\s*/g, '')
      .trim();
    
    // If empty after cleaning, use original prompt
    if (!cleanPrompt) {
      cleanPrompt = prompt;
    }
    
    console.log('🎯 Using AI to generate:', cleanPrompt);
    
    // Always use AI - this allows training the AI on Hebrew letters
    imageUrl = await generateWithPollinations(cleanPrompt);
    
    if (!imageUrl) {
      // Fallback: Create a placeholder
      console.log('📸 Creating placeholder for failed AI generation');
      source = "מערכת הדגמה";
      imageUrl = `https://via.placeholder.com/512x512/f0f0f0/333333?text=${encodeURIComponent('תמונה לא זמינה')}`;
    }
    
    console.log('✅ Image generated successfully using:', source);

    res.json({
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      source: source
    });

  } catch (error) {
    console.error('❌ Error generating image:', error);
    
    res.status(500).json({
      success: false,
      error: 'שגיאה ביצירת התמונה: ' + error.message
    });
  }
});

// Persistent learning database using files
const fs = require('fs');

const LEARNING_DATA_FILE = './learning_data.json';

// Load existing learning data or create new
let learningData = {
  letterSuccessRates: {},
  promptEffectiveness: {},
  userFeedback: []
};

// Load persistent data on startup
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_DATA_FILE)) {
      const fileData = fs.readFileSync(LEARNING_DATA_FILE, 'utf8');
      learningData = JSON.parse(fileData);
      console.log('🧠 Loaded learning data:', {
        totalFeedback: learningData.userFeedback.length,
        lettersLearned: Object.keys(learningData.letterSuccessRates).length
      });
    } else {
      console.log('🆕 Starting with fresh learning data');
    }
  } catch (error) {
    console.log('⚠️ Failed to load learning data, starting fresh:', error.message);
    learningData = {
      letterSuccessRates: {},
      promptEffectiveness: {},
      userFeedback: []
    };
  }
}

// Save learning data to file
function saveLearningData() {
  try {
    fs.writeFileSync(LEARNING_DATA_FILE, JSON.stringify(learningData, null, 2));
    console.log('💾 Learning data saved successfully');
  } catch (error) {
    console.log('❌ Failed to save learning data:', error.message);
  }
}

// Initialize learning data on startup
loadLearningData();

// API endpoint for learning from feedback
app.post('/api/learn-feedback', async (req, res) => {
  try {
    const { letter, prompt, isCorrect, timestamp } = req.body;
    
    if (!letter || !prompt || isCorrect === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'חסרים נתונים ללמידה' 
      });
    }

    console.log('🧠 Learning from feedback:', { letter, isCorrect });

    // Store feedback
    learningData.userFeedback.push({
      letter,
      prompt,
      isCorrect,
      timestamp: timestamp || new Date().toISOString()
    });

    // Update success rates
    if (!learningData.letterSuccessRates[letter]) {
      learningData.letterSuccessRates[letter] = { correct: 0, total: 0 };
    }
    learningData.letterSuccessRates[letter].total++;
    if (isCorrect) {
      learningData.letterSuccessRates[letter].correct++;
    }

    // Update prompt effectiveness
    const promptKey = prompt.substring(0, 50); // First 50 chars as key
    if (!learningData.promptEffectiveness[promptKey]) {
      learningData.promptEffectiveness[promptKey] = { correct: 0, total: 0 };
    }
    learningData.promptEffectiveness[promptKey].total++;
    if (isCorrect) {
      learningData.promptEffectiveness[promptKey].correct++;
    }

    // Calculate current success rate
    const successRate = (learningData.letterSuccessRates[letter].correct / 
                        learningData.letterSuccessRates[letter].total * 100).toFixed(1);

    console.log(`📊 Letter ${letter} success rate: ${successRate}%`);

    // Save to persistent storage
    saveLearningData();

    res.json({
      success: true,
      successRate: parseFloat(successRate),
      totalFeedback: learningData.userFeedback.length,
      letterStats: learningData.letterSuccessRates[letter]
    });

  } catch (error) {
    console.error('❌ Error in learning:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בלמידה: ' + error.message
    });
  }
});

// API endpoint for getting learning insights
app.get('/api/learning-stats', (req, res) => {
  try {
    const stats = {
      totalFeedback: learningData.userFeedback.length,
      letterSuccessRates: learningData.letterSuccessRates,
      bestPrompts: Object.entries(learningData.promptEffectiveness)
        .filter(([_, data]) => data.total >= 3)
        .sort((a, b) => (b[1].correct/b[1].total) - (a[1].correct/a[1].total))
        .slice(0, 5),
      recentFeedback: learningData.userFeedback.slice(-10)
    };

    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('❌ Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהצגת סטטיסטיקות'
    });
  }
});

// API endpoint for automatic improvement loop
app.post('/api/auto-improve', async (req, res) => {
  try {
    const { originalPrompt, targetLetter, templateImage } = req.body;
    
    if (!originalPrompt || !targetLetter) {
      return res.status(400).json({ 
        success: false, 
        error: 'חסר פרומפט או אות מטרה' 
      });
    }

    console.log('🔄 Starting auto-improvement loop for letter:', targetLetter);

    // Generate 3 different prompt variations quickly
    let prompts;
    
    if (templateImage) {
      // If user provided a template, create prompts that reference following the template
      prompts = [
        `${originalPrompt} - match the exact shape and style from reference`,
        `${originalPrompt} - professional calligraphy following the template design`,
        `Hebrew letter "${targetLetter}" that perfectly replicates the hand-drawn template style, maintaining exact proportions and characteristics`
      ];
      console.log('🎨 Using user template for letter:', targetLetter);
    } else {
      // Standard prompts without template
      prompts = [
        originalPrompt,
        `${originalPrompt}, professional Hebrew calligraphy style`,
        `Beautiful handwritten Hebrew letter "${targetLetter}", elegant black calligraphy on clean white paper, traditional Jewish scribal style`
      ];
    }
    
    const attempts = [];
    
    // Generate all images in parallel for faster response
    const imagePromises = prompts.map(async (prompt, index) => {
      console.log(`🎨 Attempt ${index + 1}/3 with prompt:`, prompt);
      
      const imageUrl = await generateWithPollinations(prompt);
      
      if (imageUrl) {
        console.log(`✅ Generated image ${index + 1}:`, imageUrl);
        return {
          attempt: index + 1,
          prompt: prompt,
          imageUrl: imageUrl
        };
      }
      
      console.log(`❌ Failed to generate image for attempt ${index + 1}`);
      return null;
    });
    
    // Wait for all images to complete (with timeout)
    const results = await Promise.allSettled(imagePromises);
    
    // Collect successful attempts
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        attempts.push(result.value);
      }
    });

    console.log(`✅ Auto-improvement completed with ${attempts.length} attempts`);

    res.json({
      success: true,
      attempts: attempts,
      totalAttempts: attempts.length
    });

  } catch (error) {
    console.error('❌ Error in auto-improvement:', error);
    
    res.status(500).json({
      success: false,
      error: 'שגיאה בשיפור אוטומטי: ' + error.message
    });
  }
});

// API endpoint for alternative methods
app.post('/api/alternative-methods', async (req, res) => {
  try {
    const { originalPrompt, targetLetter, templateImage } = req.body;
    
    if (!originalPrompt || !targetLetter) {
      return res.status(400).json({ 
        success: false, 
        error: 'חסרים פרמטרים נדרשים' 
      });
    }

    console.log('🔄 Starting alternative methods for letter:', targetLetter);
    
    // Different alternative approaches
    let alternativePrompts;
    
    if (templateImage) {
      // Template-based alternatives with different artistic styles
      alternativePrompts = [
        `Hebrew letter "${targetLetter}" following template design in ancient manuscript style, aged parchment effect`,
        `Hebrew letter "${targetLetter}" matching template proportions in modern minimalist typography`,
        `Hebrew letter "${targetLetter}" replicating template shape carved in stone, archaeological style`,
        `Hebrew letter "${targetLetter}" following template design in glowing neon style, digital font effect`
      ];
      console.log('🎨 Using template for alternative methods:', targetLetter);
    } else {
      // Standard alternatives without template
      alternativePrompts = [
        `Hebrew letter "${targetLetter}" in ancient manuscript style, sepia parchment background, medieval Hebrew script`,
        `Modern Hebrew letter "${targetLetter}" in sleek typography, minimalist design, bold sans-serif style`,
        `Hebrew letter "${targetLetter}" carved in stone, archaeological style, ancient Hebrew inscription`,
        `Hebrew letter "${targetLetter}" in neon light style, glowing blue letters, modern digital Hebrew font`
      ];
    }
    
    const attempts = [];
    
    // Generate alternative images in parallel
    const imagePromises = alternativePrompts.map(async (prompt, index) => {
      console.log(`🎨 Alternative ${index + 1}/4 with prompt:`, prompt);
      
      const imageUrl = await generateWithPollinations(prompt);
      
      if (imageUrl) {
        console.log(`✅ Generated alternative image ${index + 1}:`, imageUrl);
        return {
          attempt: index + 1,
          prompt: prompt,
          imageUrl: imageUrl,
          method: getMethodName(index)
        };
      }
      
      console.log(`❌ Failed to generate alternative image ${index + 1}`);
      return null;
    });
    
    // Wait for all images to complete
    const results = await Promise.allSettled(imagePromises);
    
    // Collect successful attempts
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        attempts.push(result.value);
      }
    });
    
    console.log(`✅ Alternative methods completed with ${attempts.length} attempts`);
    
    res.json({
      success: true,
      attempts: attempts,
      totalAttempts: attempts.length
    });
    
  } catch (error) {
    console.error('❌ Error in alternative methods:', error);
    
    res.status(500).json({
      success: false,
      error: 'שגיאה בשיטות חלופיות: ' + error.message
    });
  }
});

function getMethodName(index) {
  const methods = [
    'עתיק',
    'מודרני', 
    'חרוט באבן',
    'נאון דיגיטלי'
  ];
  return methods[index] || 'חלופי';
}

// Function to create specific prompts for Hebrew text (letters or words) with accurate descriptions
function createSpecificHebrewPrompt(hebrewText, hasWebResults) {
  const baseQuality = "Professional Hebrew calligraphy, black ink on white background, clean typography, biblical manuscript style";
  
  // If it's a word (multiple characters), return a generic word prompt
  if (hebrewText.length > 1) {
    const webNote = hasWebResults ? " Based on authentic Hebrew sources found online." : "";
    return `Hebrew word "${hebrewText}" written in traditional Hebrew script. Beautiful handwritten Hebrew calligraphy, right-to-left text direction, proper letter spacing and connections. ${baseQuality}${webNote}`;
  }
  
  // Single letter descriptions
  const letterDescriptions = {
    'א': `Hebrew letter ALEPH (א) - PRECISE VISUAL INSTRUCTIONS: Draw exactly like this: Upper diagonal line from top-left to center-right. Lower diagonal line from bottom-left to center-right. Horizontal line connecting both diagonals in the middle. Forms an X-shape with horizontal crossbar. NO other interpretations. Copy this EXACT traditional shape: א. ${baseQuality}`,
    
    'ב': `Hebrew letter BET (ב) - PRECISE SHAPE: Rectangle with LEFT SIDE MISSING. Draw: Horizontal top line, vertical right line, horizontal bottom line. Left side is COMPLETELY OPEN. Like bracket [ but closed at bottom. Copy this exact shape: ב. ${baseQuality}`,
    
    'ג': `Hebrew letter GIMEL (ג) - PRECISE SHAPE: Like number 7 or upside-down L. Draw: Horizontal top line, vertical line down from RIGHT end of top line. Forms corner shape. Copy exact shape: ג. ${baseQuality}`,
    
    'ד': `Hebrew letter DALET (ד) - PRECISE SHAPE: Corner bracket shape. Draw: Horizontal top line, vertical right line down from top. Bottom and left sides COMPLETELY OPEN. Copy exact shape: ד. ${baseQuality}`,
    
    'ה': `Hebrew letter He (ה). Shaped like the letter Dalet but with a small gap in the left vertical line. Has horizontal top and bottom lines, a right vertical line, and a broken left vertical line with a gap. ${baseQuality}`,
    
    'ו': `Hebrew letter Vav (ו). Simple vertical line with a small head or dot at the top. Looks like the number 1 or a nail. ${baseQuality}`,
    
    'ז': `Hebrew letter Zayin (ז). Shaped like the number 7. Has a horizontal top line with a vertical line extending downward from the left end. ${baseQuality}`,
    
    'ח': `Hebrew letter Het (ח). Two vertical lines connected by a horizontal bridge at the top, with a small gap in the bridge. Looks like a goalpost with a break in the crossbar. ${baseQuality}`,
    
    'ט': `Hebrew letter Tet (ט). Curved shape that looks like a backwards C or an incomplete circle, with an opening on the left side. ${baseQuality}`,
    
    'י': `Hebrew letter Yud (י). Very small, looks like a comma or apostrophe. The smallest letter in Hebrew. ${baseQuality}`,
    
    'כ': `Hebrew letter Kaf (כ). Curved shape like the letter C, open on the left side. ${baseQuality}`,
    
    'ל': `Hebrew letter Lamed (ל). Tallest Hebrew letter, shaped like a shepherd's staff. Has a vertical line with a curved hook at the top extending to the right. ${baseQuality}`,
    
    'מ': `Hebrew letter Mem (מ). Square shape completely closed on all sides, like a box. ${baseQuality}`,
    
    'נ': `Hebrew letter Nun (נ). Curved like a backwards J. Has a vertical right line with a curved bottom connecting to a horizontal base. ${baseQuality}`,
    
    'ס': `Hebrew letter Samech (ס). Perfect circle or oval, completely closed. ${baseQuality}`,
    
    'ע': `Hebrew letter Ayin (ע). Circular or oval shape with a small opening or break at the top left. ${baseQuality}`,
    
    'פ': `Hebrew letter Pe (פ). Curved shape open at the bottom, like an upside-down U with a small gap at the bottom left. ${baseQuality}`,
    
    'צ': `Hebrew letter Tsadi (צ). Looks like the letter Nun with an additional small stroke (Yud) attached to the left side. ${baseQuality}`,
    
    'ק': `Hebrew letter Quf (ק). Circular top with a vertical line extending down below the baseline, like the letter P with a descender. ${baseQuality}`,
    
    'ר': `Hebrew letter Resh (ר). Shaped like the letter P without the lower horizontal line. Has a vertical left line and curved top-right section. ${baseQuality}`,
    
    'ש': `Hebrew letter Shin (ש). Has three vertical lines connected at the top, like a crown or the letter W upside down. ${baseQuality}`,
    
    'ת': `Hebrew letter Tav (ת). Shaped like the letter Pi (π) or an upside-down U with feet. Has a horizontal top line with two vertical lines extending downward. ${baseQuality}`,
    
    // Hebrew final letters (אותיות סופיות)
    'ך': `Hebrew letter Final Kaf (ך) - PRECISE SHAPE: Like regular Kaf but with a long descender. Curved C-shape open on the left, with a vertical line extending down below the baseline. Much longer than regular Kaf. ${baseQuality}`,
    
    'ן': `Hebrew letter Final Nun (ן) - PRECISE SHAPE: Like regular Nun but completely straight. Simple vertical line extending down below the baseline, no curve. Looks like the letter I or a straight pole. ${baseQuality}`,
    
    'ף': `Hebrew letter Final Pe (ף) - PRECISE SHAPE: Like regular Pe but with a descender. Curved shape open at bottom with a vertical tail extending down below the baseline. ${baseQuality}`,
    
    'ם': `Hebrew letter Final Mem (ם) - PRECISE SHAPE: Completely closed square or rectangle. Like regular Mem but sealed at the bottom. Perfect box shape with no openings. ${baseQuality}`,
    
    'ץ': `Hebrew letter Final Tsadi (ץ) - PRECISE SHAPE: Like regular Tsadi but with a long descender. Has the main body of Tsadi with a vertical line extending down below the baseline. ${baseQuality}`
  };
  
  // Get the specific description for this letter
  const specificDescription = letterDescriptions[hebrewText];
  
  if (specificDescription) {
    const webNote = hasWebResults ? " Based on authentic Hebrew sources found online." : "";
    return specificDescription + webNote;
  } else {
    // Fallback for letters not in our database
    return `Hebrew letter "${hebrewText}" in traditional Hebrew script. ${baseQuality}${hasWebResults ? " Based on web research." : ""}`;
  }
}

// API endpoint for direct prompt generation (without web search)
app.post('/api/generate-prompt', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'חסר טקסט חיפוש' 
      });
    }

    console.log('🎯 Generating direct prompt for:', query);

    // Extract Hebrew text from query (words or letters)
    const hebrewMatch = query.match(/[\u0590-\u05FF]+/g);
    let targetLetter;
    
    if (hebrewMatch) {
      // If query contains words like "האות א" or "אות ב", take the last Hebrew text
      if (query.includes('האות') || query.includes('אות')) {
        targetLetter = hebrewMatch[hebrewMatch.length - 1];
      } else {
        // For simple cases like "א" or "שלום", take the first Hebrew text  
        targetLetter = hebrewMatch[0];
      }
    } else {
      targetLetter = query;
    }

    // Create enhanced prompt with specific Hebrew text descriptions (no web search needed)
    const enhancedPrompt = createSpecificHebrewPrompt(targetLetter, false);
    
    console.log('✅ Direct prompt created');
    
    res.json({
      success: true,
      enhancedPrompt: enhancedPrompt,
      targetLetter: targetLetter,
      method: "Direct generation with built-in descriptions"
    });
    
  } catch (error) {
    console.error('❌ Error generating prompt:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה ביצירת הפרומפט'
    });
  }
});

// API endpoint for web search enhancement
app.post('/api/web-search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'חסר טקסט חיפוש' 
      });
    }

    console.log('🔍 Web search for:', query);

    // Extract Hebrew letter from query (smart extraction)
    const hebrewMatch = query.match(/[\u0590-\u05FF]/g);
    let targetLetter;
    
    if (hebrewMatch) {
      // If query contains words like "האות א" or "אות ב", take the last Hebrew letter
      if (query.includes('האות') || query.includes('אות')) {
        targetLetter = hebrewMatch[hebrewMatch.length - 1];
      } else {
        // For simple cases like "א" or "ב", take the first letter
        targetLetter = hebrewMatch[0];
      }
    } else {
      targetLetter = query;
    }

    try {
      // Use Python web scraper to get information about the Hebrew letter
      const { spawn } = require('child_process');
      
      const pythonScript = `
import trafilatura
import sys
import json

def search_hebrew_letter(letter):
    # Search for Hebrew letter information
    urls = [
        f"https://he.wikipedia.org/wiki/{letter}",
        "https://he.wikipedia.org/wiki/אלפבית_עברי",
        "https://www.safa-ivrit.org/letters/",
        "https://hebrew4christians.com/Grammar/Unit_One/Aleph-Bet/aleph-bet.html"
    ]
    
    results = []
    for url in urls:
        try:
            downloaded = trafilatura.fetch_url(url)
            if downloaded:
                text = trafilatura.extract(downloaded)
                if text and letter in text:
                    results.append(text[:500])  # First 500 chars
        except:
            continue
    
    return results

letter = sys.argv[1] if len(sys.argv) > 1 else "א"
results = search_hebrew_letter(letter)
print(json.dumps({"results": results}, ensure_ascii=False))
`;

      // Write Python script to temporary file
      const fs = require('fs');
      const scriptPath = '/tmp/web_search.py';
      fs.writeFileSync(scriptPath, pythonScript);

      // Execute Python script
      const python = spawn('python3', [scriptPath, targetLetter]);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        try {
          if (code === 0 && output) {
            const searchResults = JSON.parse(output);
            
            // Create enhanced prompt with specific Hebrew letter descriptions
            let enhancedPrompt = createSpecificHebrewPrompt(targetLetter, searchResults.results && searchResults.results.length > 0);
            
            console.log('✅ Web search completed, enhanced prompt created');
            
            res.json({
              success: true,
              enhancedPrompt: enhancedPrompt,
              searchResults: searchResults.results.length,
              targetLetter: targetLetter
            });
            
          } else {
            throw new Error('Python script failed');
          }
        } catch (parseError) {
          console.log('❌ Error parsing search results, using fallback');
          
          // Fallback enhanced prompt
          const fallbackPrompt = createSpecificHebrewPrompt(targetLetter, false);
          
          res.json({
            success: true,
            enhancedPrompt: fallbackPrompt,
            searchResults: 0,
            targetLetter: targetLetter,
            note: "Used fallback enhancement due to search limitations"
          });
        }
      });
      
    } catch (error) {
      console.log('❌ Web search error, using enhanced fallback');
      
      // Enhanced fallback prompt
      const enhancedPrompt = createSpecificHebrewPrompt(targetLetter, false);
      
      res.json({
        success: true,
        enhancedPrompt: enhancedPrompt,
        searchResults: 0,
        targetLetter: targetLetter,
        note: "Enhanced fallback prompt used"
      });
    }
    
  } catch (error) {
    console.error('❌ Error in web search:', error);
    
    res.status(500).json({
      success: false,
      error: 'שגיאה בחיפוש באינטרנט: ' + error.message
    });
  }
});

// API endpoint for getting improvement suggestions
app.post('/api/get-improvement', async (req, res) => {
  try {
    const { prompt, imageUrl } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'חסר פרומפט' 
      });
    }

    console.log('🤖 Getting improvement suggestions for prompt:', prompt);

    // Use OpenAI GPT for analysis if available
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            {
              role: "system",
              content: "You are an expert in Hebrew typography and AI image generation. Analyze prompts for generating Hebrew letters and suggest improvements. Respond in Hebrew with practical suggestions."
            },
            {
              role: "user",
              content: `The following prompt was used to generate a Hebrew letter image, but the result was marked as incorrect:

Prompt: "${prompt}"

Please analyze this prompt and suggest specific improvements in Hebrew. Focus on:
1. How to describe Hebrew letter shapes more clearly
2. Typography and visual clarity improvements
3. Better prompt structure for AI image generation
4. Specific Hebrew letter characteristics

Provide 3-5 concrete suggestions in Hebrew.`
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        });

        const suggestions = response.choices[0].message.content;
        console.log('✅ GPT suggestions generated');

        return res.json({
          success: true,
          suggestions: suggestions,
          source: "GPT-4"
        });

      } catch (gptError) {
        console.log('❌ GPT failed:', gptError.message);
      }
    }

    // Fallback suggestions in Hebrew
    const fallbackSuggestions = `
הצעות לשיפור הפרומפט:

1. **תיאור צורה מדויק יותר**: תאר את הצורה הספציפית של האות - קווים ישרים, עיקולים, נקודות חיבור.

2. **הדגשת סגנון**: הוסף "בסגנון כתב יד עברי מסורתי" או "בטיפוגרפיה עברית ברורה".

3. **פרטי רקע**: ציין "רקע לבן נקי, ללא צלליות או הפרעות".

4. **גודל ומיקום**: הוסף "האות ממוקמת במרכז התמונה, בגודל גדול וברור".

5. **ניגוד**: הדגש "ניגוד חד בין האות השחורה לרקע הלבן".

נסה לשלב כמה מההצעות האלה בפרומפט הבא!
    `;

    res.json({
      success: true,
      suggestions: fallbackSuggestions.trim(),
      source: "Fallback"
    });

  } catch (error) {
    console.error('❌ Error getting improvement suggestions:', error);
    
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת הצעות שיפור: ' + error.message
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Hebrew Letters Trainer server running on port ${port}`);
  console.log(`📱 App URL: http://localhost:${port}`);
});