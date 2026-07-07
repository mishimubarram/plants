import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limits for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize GoogleGenAI on the server side
const getAI = () => {
  // Support different casing or names the user might have used in their .env file
  const apiKey = process.env.GEMINI_API_KEY || process.env.geminiAPI || process.env.GEMINI_API || process.env.gemini_api;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not set. Gemini features will fail.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || 'DUMMY_KEY_TO_PREVENT_CRASH',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
};

const ai = getAI();
const MODEL_NAME = 'gemini-3.5-flash';

// API Routes
app.post('/api/gemini/identify', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    };

    const textPart = {
      text: `Identify this plant and provide detailed care instructions in JSON format. 
      Include: name, scientificName, description, careInstructions (watering, sunlight, temperature, soil), and wateringFrequencyDays (a number).`,
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            scientificName: { type: Type.STRING },
            description: { type: Type.STRING },
            careInstructions: {
              type: Type.OBJECT,
              properties: {
                watering: { type: Type.STRING },
                sunlight: { type: Type.STRING },
                temperature: { type: Type.STRING },
                soil: { type: Type.STRING },
              },
            },
            wateringFrequencyDays: { type: Type.NUMBER },
          },
          required: ['name', 'scientificName', 'description', 'careInstructions', 'wateringFrequencyDays'],
        },
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Error in identify API:', error);
    res.status(500).json({ error: error.message || 'Failed to identify plant' });
  }
});

app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { history, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: `You are Botanic AI, a professional gardening assistant. 
        Your goal is to provide helpful, accurate, and easy-to-understand advice about plant care, identification, and gardening.
        
        Guidelines for your responses:
        - Use clear, structured Markdown (headings, bullet points, bold text).
        - Keep explanations simple but informative.
        - If a plant is in bad condition, provide a step-by-step recovery plan.
        - Be encouraging and friendly.
        - Use emojis to make the text more engaging.
        - If you don't know something, be honest and suggest where to find the info.`,
      },
      history: (history || []).map((h: any) => ({ role: h.role, parts: [{ text: h.content }] })),
    });

    const response = await chat.sendMessage({ message });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    res.status(500).json({ error: error.message || 'Failed to get chat response' });
  }
});

app.post('/api/gemini/diagnose', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    };

    const textPart = {
      text: `Analyze this plant photo for diseases or pests. Provide a diagnosis and suggest appropriate organic and chemical treatment methods. 
      Return in JSON format.`,
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosis: { type: Type.STRING },
            symptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
            organicTreatment: { type: Type.STRING },
            chemicalTreatment: { type: Type.STRING },
            prevention: { type: Type.STRING },
          },
          required: ['diagnosis', 'symptoms', 'organicTreatment', 'chemicalTreatment', 'prevention'],
        },
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Error in diagnose API:', error);
    res.status(500).json({ error: error.message || 'Failed to diagnose plant' });
  }
});

app.post('/api/gemini/health-advice', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    };

    const textPart = {
      text: `Analyze this plant photo. The user wants to know how to improve the health of this plant. 
      Look for dust, dirt, pests, or signs of poor health. 
      Provide a detailed care plan including cleaning instructions and general maintenance.
      Return in JSON format.`,
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            healthStatus: { type: Type.STRING },
            cleaningTips: { type: Type.STRING },
            maintenancePlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            recoverySteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            urgency: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
          },
          required: ['healthStatus', 'cleaningTips', 'maintenancePlan', 'recoverySteps', 'urgency'],
        },
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Error in health-advice API:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze plant health' });
  }
});

app.post('/api/gemini/care-guide', async (req, res) => {
  try {
    const { plantName } = req.body;
    if (!plantName) {
      return res.status(400).json({ error: 'Plant name is required' });
    }

    const prompt = `Provide a detailed care guide for the plant: ${plantName}. 
    Include: name, category (Indoor, Outdoor, Succulent, etc.), light (e.g., Bright Indirect), water (e.g., Once a week), detail (a brief description), and img (a placeholder image URL from picsum.photos/seed/${plantName.replace(/\s+/g, '')}/800/600).
    Return in JSON format.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            light: { type: Type.STRING },
            water: { type: Type.STRING },
            detail: { type: Type.STRING },
            img: { type: Type.STRING },
          },
          required: ['name', 'category', 'light', 'water', 'detail', 'img'],
        },
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Error in care-guide API:', error);
    res.status(500).json({ error: error.message || 'Failed to generate care guide' });
  }
});

app.post('/api/gemini/seasonal-tips', async (req, res) => {
  try {
    const { lat, lng, date } = req.body;
    if (lat === undefined || lng === undefined || !date) {
      return res.status(400).json({ error: 'Latitude, longitude, and date are required' });
    }

    const prompt = `Based on the location (lat: ${lat}, lng: ${lng}) and the date (${date}), provide 3 seasonal gardening tips for planting, maintenance, and harvesting. 
    Return in JSON format as an array of objects with 'title', 'category' (planting, maintenance, or harvesting), and 'advice'.`;
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['planting', 'maintenance', 'harvesting'] },
              advice: { type: Type.STRING },
            },
            required: ['title', 'category', 'advice'],
          },
        },
      },
    });

    res.json(JSON.parse(response.text || '[]'));
  } catch (error: any) {
    console.error('Error in seasonal-tips API:', error);
    res.status(500).json({ error: error.message || 'Failed to get seasonal tips' });
  }
});

app.post('/api/gemini/local-knowledge', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const prompt = `Based on the location (lat: ${lat}, lng: ${lng}), list 5 common native or popular plants in this area. Provide a brief description and care tip for each. Return in JSON format as an array of objects with 'name', 'description', and 'careTip'.`;
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              careTip: { type: Type.STRING },
            },
            required: ['name', 'description', 'careTip'],
          },
        },
      },
    });

    res.json(JSON.parse(response.text || '[]'));
  } catch (error: any) {
    console.error('Error in local-knowledge API:', error);
    res.status(500).json({ error: error.message || 'Failed to get local knowledge' });
  }
});

// Serve frontend assets using Vite middleware or Express static serving
async function setupFrontend() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupFrontend().catch((err) => {
  console.error('Failed to start server:', err);
});
